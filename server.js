const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { WebSocketServer, WebSocket } = require('ws');
const crypto = require('crypto');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Constants
const AUTH_TIMEOUT_MS = 5000;
const HEARTBEAT_INTERVAL_MS = 30000;
const WS_MAX_MESSAGES_PER_MINUTE = 60;
const JWT_REVALIDATION_INTERVAL_MS = 5 * 60 * 1000; // Revalidate JWT every 5 minutes

// Track graceful shutdown state
let isShuttingDown = false;

// Track active HTTP requests for graceful shutdown
let activeRequests = 0;

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    // Reject new requests during shutdown
    if (isShuttingDown) {
      res.statusCode = 503;
      res.setHeader('Connection', 'close');
      res.end('Server is shutting down');
      return;
    }

    // Track active request
    activeRequests++;

    // Decrement on response finish or close
    const decrementActiveRequests = () => {
      activeRequests--;
    };
    res.on('finish', decrementActiveRequests);
    res.on('close', decrementActiveRequests);

    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Initialize WebSocket server
  const wss = new WebSocketServer({
    server,
    path: '/api/ws'
  });

  // Client tracking: email -> WebSocket[]
  const clients = new Map();
  // Pending authentication: WebSocket -> timeout
  const pendingAuth = new Map();

  wss.on('connection', (ws, req) => {
    console.log('[WS] New connection attempt');

    // Initialize connection state
    ws.isAlive = true;
    ws.messageCount = 0;
    ws.messageWindowStart = Date.now();
    ws.authenticated = false;
    ws.userEmail = null;
    ws.userId = null;

    // Set up pong handler for heartbeat
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Flag to track if auth process has started (to prevent race condition)
    ws.authInProgress = false;

    // Set authentication timeout - client must send AUTH message within timeout
    const authTimeout = setTimeout(() => {
      // Only close if auth hasn't started AND not authenticated
      // This prevents race condition where timeout fires while handleAuth is running
      if (!ws.authInProgress && !ws.authenticated) {
        console.log('[WS] Authentication timeout - closing connection');
        ws.close(1008, 'Authentication timeout');
      }
    }, AUTH_TIMEOUT_MS);
    pendingAuth.set(ws, authTimeout);

    // Send auth required message
    safeSend(ws, {
      type: 'AUTH_REQUIRED',
      data: { message: 'Send AUTH message with token to authenticate' },
      timestamp: Date.now()
    });

    ws.on('message', (data) => {
      // Rate limiting check
      const now = Date.now();
      if (now - ws.messageWindowStart > 60000) {
        ws.messageWindowStart = now;
        ws.messageCount = 0;
      }
      ws.messageCount++;

      if (ws.messageCount > WS_MAX_MESSAGES_PER_MINUTE) {
        safeSend(ws, {
          type: 'ERROR',
          data: { message: 'Rate limit exceeded' },
          timestamp: Date.now()
        });
        return;
      }

      try {
        const message = JSON.parse(data.toString());
        handleMessage(ws, message, authTimeout);
      } catch (error) {
        console.error('[WS] Error parsing message:', error);
      }
    });

    ws.on('close', () => {
      handleClose(ws);
      // Clear pending auth timeout
      const timeout = pendingAuth.get(ws);
      if (timeout) {
        clearTimeout(timeout);
        pendingAuth.delete(ws);
      }
    });

    ws.on('error', (error) => {
      console.error('[WS] Connection error:', error);
    });
  });

  function handleMessage(ws, message, authTimeout) {
    switch (message.type) {
      case 'AUTH':
        handleAuth(ws, message, authTimeout);
        break;
      case 'PING':
        safeSend(ws, { type: 'PONG', timestamp: Date.now() });
        break;
      default:
        if (!ws.authenticated) {
          safeSend(ws, {
            type: 'ERROR',
            data: { message: 'Not authenticated' },
            timestamp: Date.now()
          });
        }
    }
  }

  function handleAuth(ws, message, authTimeout) {
    // Mark auth as in progress IMMEDIATELY to prevent timeout race condition
    ws.authInProgress = true;

    // Clear the auth timeout since we're now handling authentication
    clearTimeout(authTimeout);
    pendingAuth.delete(ws);

    const token = message.data?.token;

    if (!token) {
      safeSend(ws, {
        type: 'AUTH_FAILED',
        data: { message: 'Token required' },
        timestamp: Date.now()
      });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('[WS] JWT_SECRET not configured');
      safeSend(ws, {
        type: 'AUTH_FAILED',
        data: { message: 'Server configuration error' },
        timestamp: Date.now()
      });
      return;
    }

    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, jwtSecret);

      // Mark as authenticated and store token for revalidation
      ws.authenticated = true;
      ws.userId = decoded.id;
      ws.userEmail = decoded.email;
      ws.jwtToken = token; // Store for periodic revalidation

      // Register client
      const userKey = decoded.email;
      if (!clients.has(userKey)) {
        clients.set(userKey, []);
      }
      clients.get(userKey).push(ws);

      console.log(`[WS] Client authenticated: ${userKey} (Total: ${getTotalClients()})`);

      safeSend(ws, {
        type: 'AUTH_SUCCESS',
        data: { message: 'Authenticated successfully' },
        timestamp: Date.now()
      });
    } catch (err) {
      console.log('[WS] Authentication failed:', err.message);
      safeSend(ws, {
        type: 'AUTH_FAILED',
        data: { message: 'Invalid or expired token' },
        timestamp: Date.now()
      });
    }
  }

  function handleClose(ws) {
    if (ws.userEmail) {
      const userClients = clients.get(ws.userEmail);
      if (userClients) {
        const filtered = userClients.filter(client => client !== ws);
        if (filtered.length === 0) {
          clients.delete(ws.userEmail);
        } else {
          clients.set(ws.userEmail, filtered);
        }
      }
      console.log(`[WS] Client disconnected: ${ws.userEmail} (Total: ${getTotalClients()})`);
    }
  }

  function safeSend(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
        return true;
      } catch (err) {
        console.error('[WS] Error sending message:', err);
      }
    }
    return false;
  }

  function getTotalClients() {
    let total = 0;
    clients.forEach(clientList => {
      total += clientList.length;
    });
    return total;
  }

  // Heartbeat to detect dead connections
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        console.log('[WS] Terminating dead connection');
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL_MS);

  // Periodic JWT revalidation to disconnect clients with expired tokens
  const jwtRevalidationInterval = setInterval(() => {
    const jwt = require('jsonwebtoken');
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) return;

    let disconnectedCount = 0;

    wss.clients.forEach((ws) => {
      // Only check authenticated connections that have a stored token
      if (!ws.authenticated || !ws.jwtToken) return;

      try {
        // Verify the token is still valid
        jwt.verify(ws.jwtToken, jwtSecret);
      } catch (err) {
        // Token is expired or invalid - disconnect the client
        console.log(`[WS] JWT expired for ${ws.userEmail || 'unknown'}, disconnecting`);
        safeSend(ws, {
          type: 'AUTH_EXPIRED',
          data: { message: 'Your session has expired. Please reconnect.' },
          timestamp: Date.now()
        });
        ws.close(1008, 'Token expired');
        disconnectedCount++;
      }
    });

    if (disconnectedCount > 0) {
      console.log(`[WS] Disconnected ${disconnectedCount} clients with expired tokens`);
    }
  }, JWT_REVALIDATION_INTERVAL_MS);

  // Make broadcast functions available globally for API routes
  global.wsClients = clients;

  global.wsBroadcast = function(message) {
    const payload = JSON.stringify(message);
    let sentCount = 0;
    clients.forEach((clientList, userKey) => {
      clientList.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(payload);
            sentCount++;
          } catch (err) {
            console.error(`[WS] Error sending to ${userKey}:`, err);
          }
        }
      });
    });
    console.log(`[WS] Broadcast to ${sentCount} clients:`, message.type);
    return sentCount;
  };

  global.wsBroadcastToUser = function(userKey, message) {
    const payload = JSON.stringify(message);
    const userClients = clients.get(userKey);
    let sentCount = 0;
    if (userClients) {
      userClients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(payload);
            sentCount++;
          } catch (err) {
            console.error(`[WS] Error sending to ${userKey}:`, err);
          }
        }
      });
    }
    return sentCount;
  };

  // Graceful shutdown handler
  function gracefulShutdown(signal) {
    if (isShuttingDown) {
      console.log('Shutdown already in progress...');
      return;
    }

    isShuttingDown = true;
    console.log(`\n${signal} received. Starting graceful shutdown...`);
    console.log(`Active HTTP requests: ${activeRequests}`);

    // Stop accepting new connections
    server.close((err) => {
      if (err) {
        console.error('Error closing HTTP server:', err);
      } else {
        console.log('HTTP server closed');
      }
    });

    // Stop heartbeat and JWT revalidation
    clearInterval(heartbeatInterval);
    clearInterval(jwtRevalidationInterval);

    // Clear pending auth timeouts
    pendingAuth.forEach((timeout) => clearTimeout(timeout));
    pendingAuth.clear();

    // Close all WebSocket connections gracefully
    console.log(`Closing ${getTotalClients()} WebSocket connections...`);
    wss.clients.forEach((ws) => {
      safeSend(ws, {
        type: 'SERVER_SHUTDOWN',
        data: { message: 'Server is shutting down' },
        timestamp: Date.now()
      });
      ws.close(1001, 'Server shutting down');
    });

    // Close WebSocket server
    wss.close(() => {
      console.log('WebSocket server closed');
    });

    // Wait for active HTTP requests to complete
    const waitForRequests = () => {
      if (activeRequests === 0 && getTotalClients() === 0) {
        console.log('All requests and connections closed. Exiting.');
        process.exit(0);
      }
    };

    // Check periodically for all requests/connections to close
    const requestCheckInterval = setInterval(() => {
      console.log(`Waiting for ${activeRequests} HTTP requests and ${getTotalClients()} WebSocket clients...`);
      waitForRequests();
    }, 500);

    // Force exit after timeout (max 30 seconds for graceful shutdown)
    const forceExitTimeout = setTimeout(() => {
      clearInterval(requestCheckInterval);
      console.log(`Force exit: ${activeRequests} requests still active, ${getTotalClients()} WebSocket clients`);
      process.exit(0);
    }, 10000);

    // Don't let these timers prevent exit
    forceExitTimeout.unref();
    requestCheckInterval.unref();

    // Initial check - maybe everything is already closed
    waitForRequests();
  }

  // Register shutdown handlers
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
  });

  server.once('error', (err) => {
    console.error('Server error:', err);
    process.exit(1);
  });

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> WebSocket ready on ws://${hostname}:${port}/api/ws`);
    console.log(`> Environment: ${process.env.NODE_ENV || 'development'}`);
  });
});

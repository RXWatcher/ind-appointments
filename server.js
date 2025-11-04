const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
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
  // We'll do this after the HTTP server is created
  // Import the WebSocket manager (we'll need to compile this first)
  // For now, we'll add a simple WebSocket Server directly
  const { WebSocketServer } = require('ws');

  const wss = new WebSocketServer({
    server,
    path: '/api/ws'
  });

  const clients = new Map(); // username -> WebSocket[]

  wss.on('connection', (ws, req) => {
    console.log('New WebSocket connection');

    const url = new URL(req.url, `http://${req.headers.host}`);
    const username = url.searchParams.get('username');
    const userId = url.searchParams.get('userId');

    if (!username) {
      ws.close(1008, 'Username required');
      return;
    }

    // Register client
    if (!clients.has(username)) {
      clients.set(username, []);
    }
    clients.get(username).push(ws);

    console.log(`Client connected: ${username} (Total: ${getTotalClients()})`);

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'CONNECTION_ESTABLISHED',
      data: { message: 'Connected to real-time updates' },
      timestamp: Date.now()
    }));

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('Received:', data);
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    });

    ws.on('close', () => {
      console.log(`Client disconnected: ${username}`);
      const userClients = clients.get(username);
      if (userClients) {
        const filtered = userClients.filter(client => client !== ws);
        if (filtered.length === 0) {
          clients.delete(username);
        } else {
          clients.set(username, filtered);
        }
      }
      console.log(`Total clients: ${getTotalClients()}`);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  function getTotalClients() {
    let total = 0;
    clients.forEach(clientList => {
      total += clientList.length;
    });
    return total;
  }

  // Make clients map available globally for API routes
  global.wsClients = clients;

  server.once('error', (err) => {
    console.error(err);
    process.exit(1);
  });

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> WebSocket ready on ws://${hostname}:${port}/api/ws`);
  });
});

// WebSocket Manager - Replaces global state with proper module pattern

import { WebSocket, WebSocketServer } from 'ws';
import type { Server } from 'http';
import type { IncomingMessage } from 'http';
import jwt from 'jsonwebtoken';
import { WEBSOCKET, RATE_LIMIT } from './constants';
import type { WebSocketMessage, AuthUser } from './types';
import logger from './logger';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: number;
  userEmail?: string;
  isAlive?: boolean;
  messageCount?: number;
  messageWindowStart?: number;
}

interface ClientInfo {
  ws: AuthenticatedWebSocket;
  userId: number;
  userEmail: string;
  connectedAt: Date;
}

class WebSocketManager {
  private static instance: WebSocketManager;
  private wss: WebSocketServer | null = null;
  private clients: Map<string, ClientInfo[]> = new Map();
  private pendingAuth: Map<WebSocket, NodeJS.Timeout> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private jwtSecret: string | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  public static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  /**
   * Initialize the WebSocket server
   */
  public initialize(server: Server, jwtSecret: string): void {
    if (this.wss) {
      logger.warn('[WS] WebSocket server already initialized');
      return;
    }

    this.jwtSecret = jwtSecret;

    this.wss = new WebSocketServer({
      server,
      path: '/api/ws',
    });

    this.wss.on('connection', (ws: AuthenticatedWebSocket, req: IncomingMessage) => {
      this.handleConnection(ws, req);
    });

    // Start heartbeat to detect dead connections
    this.startHeartbeat();

    logger.info('[WS] WebSocket server initialized');
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: AuthenticatedWebSocket, req: IncomingMessage): void {
    logger.info('[WS] New connection attempt');

    ws.isAlive = true;
    ws.messageCount = 0;
    ws.messageWindowStart = Date.now();

    // Set up pong handler for heartbeat
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Set authentication timeout
    const authTimeout = setTimeout(() => {
      if (!ws.userId) {
        logger.warn('[WS] Authentication timeout - closing connection');
        ws.close(1008, 'Authentication timeout');
      }
    }, WEBSOCKET.AUTH_TIMEOUT_MS);

    this.pendingAuth.set(ws, authTimeout);

    // Send auth required message
    this.sendToClient(ws, {
      type: 'AUTH_REQUIRED',
      data: { message: 'Send AUTH message with token to authenticate' },
      timestamp: Date.now(),
    });

    // Handle messages
    ws.on('message', (data) => {
      this.handleMessage(ws, data);
    });

    // Handle close
    ws.on('close', () => {
      this.handleClose(ws);
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error('[WS] Connection error:', { error: error.message });
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(ws: AuthenticatedWebSocket, data: Buffer | ArrayBuffer | Buffer[]): void {
    // Rate limiting check
    if (!this.checkRateLimit(ws)) {
      this.sendToClient(ws, {
        type: 'ERROR',
        data: { message: 'Rate limit exceeded' },
        timestamp: Date.now(),
      });
      return;
    }

    try {
      const dataStr = Buffer.isBuffer(data) ? data.toString() : String(data);
      const message = JSON.parse(dataStr) as WebSocketMessage;

      switch (message.type) {
        case 'AUTH':
          this.handleAuth(ws, message);
          break;
        case 'PING':
          this.sendToClient(ws, {
            type: 'PONG',
            timestamp: Date.now(),
          });
          break;
        default:
          // Only authenticated clients can send other messages
          if (!ws.userId) {
            this.sendToClient(ws, {
              type: 'ERROR',
              data: { message: 'Not authenticated' },
              timestamp: Date.now(),
            });
          }
      }
    } catch (error) {
      logger.error('[WS] Error parsing message:', { error });
    }
  }

  /**
   * Handle authentication message
   */
  private handleAuth(ws: AuthenticatedWebSocket, message: WebSocketMessage): void {
    const data = message.data as { token?: string } | undefined;
    const token = data?.token;

    if (!token || !this.jwtSecret) {
      this.sendToClient(ws, {
        type: 'AUTH_FAILED',
        data: { message: 'Invalid token' },
        timestamp: Date.now(),
      });
      return;
    }

    try {
      const decoded = jwt.verify(token, this.jwtSecret) as AuthUser;

      // Clear auth timeout
      const timeout = this.pendingAuth.get(ws);
      if (timeout) {
        clearTimeout(timeout);
        this.pendingAuth.delete(ws);
      }

      // Store user info on connection
      ws.userId = decoded.id;
      ws.userEmail = decoded.email;

      // Register client
      const userKey = decoded.email;
      if (!this.clients.has(userKey)) {
        this.clients.set(userKey, []);
      }
      this.clients.get(userKey)!.push({
        ws,
        userId: decoded.id,
        userEmail: decoded.email,
        connectedAt: new Date(),
      });

      logger.info(`[WS] Client authenticated: ${userKey} (Total: ${this.getTotalClients()})`);

      this.sendToClient(ws, {
        type: 'AUTH_SUCCESS',
        data: { message: 'Authenticated successfully' },
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.warn('[WS] Authentication failed:', { error: error instanceof Error ? error.message : error });
      this.sendToClient(ws, {
        type: 'AUTH_FAILED',
        data: { message: 'Invalid or expired token' },
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Handle connection close
   */
  private handleClose(ws: AuthenticatedWebSocket): void {
    // Clear pending auth timeout
    const timeout = this.pendingAuth.get(ws);
    if (timeout) {
      clearTimeout(timeout);
      this.pendingAuth.delete(ws);
    }

    // Remove from clients
    if (ws.userEmail) {
      const userClients = this.clients.get(ws.userEmail);
      if (userClients) {
        const filtered = userClients.filter((client) => client.ws !== ws);
        if (filtered.length === 0) {
          this.clients.delete(ws.userEmail);
        } else {
          this.clients.set(ws.userEmail, filtered);
        }
      }
      logger.info(`[WS] Client disconnected: ${ws.userEmail} (Total: ${this.getTotalClients()})`);
    }
  }

  /**
   * Check rate limit for WebSocket messages
   */
  private checkRateLimit(ws: AuthenticatedWebSocket): boolean {
    const now = Date.now();

    // Reset window if needed
    if (!ws.messageWindowStart || now - ws.messageWindowStart > 60000) {
      ws.messageWindowStart = now;
      ws.messageCount = 0;
    }

    ws.messageCount = (ws.messageCount || 0) + 1;

    return ws.messageCount <= RATE_LIMIT.WEBSOCKET_MAX_MESSAGES_PER_MINUTE;
  }

  /**
   * Start heartbeat to detect dead connections
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (!this.wss) return;

      this.wss.clients.forEach((ws: AuthenticatedWebSocket) => {
        if (ws.isAlive === false) {
          logger.info('[WS] Terminating dead connection');
          return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, WEBSOCKET.HEARTBEAT_INTERVAL_MS);
  }

  /**
   * Send message to a specific client
   */
  private sendToClient(ws: WebSocket, message: WebSocketMessage): boolean {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
        return true;
      } catch (error) {
        logger.error('[WS] Error sending to client:', { error });
      }
    }
    return false;
  }

  /**
   * Broadcast message to all connected clients
   */
  public broadcast(message: WebSocketMessage): number {
    const payload = JSON.stringify(message);
    let sentCount = 0;

    this.clients.forEach((clientList, userKey) => {
      clientList.forEach((client) => {
        if (client.ws.readyState === WebSocket.OPEN) {
          try {
            client.ws.send(payload);
            sentCount++;
          } catch (error) {
            logger.error(`[WS] Error sending to ${userKey}:`, { error });
          }
        }
      });
    });

    logger.info(`[WS] Broadcast to ${sentCount} clients: ${message.type}`);
    return sentCount;
  }

  /**
   * Send message to a specific user (all their connections)
   */
  public sendToUser(userEmail: string, message: WebSocketMessage): number {
    const payload = JSON.stringify(message);
    const userClients = this.clients.get(userEmail);
    let sentCount = 0;

    if (userClients) {
      userClients.forEach((client) => {
        if (client.ws.readyState === WebSocket.OPEN) {
          try {
            client.ws.send(payload);
            sentCount++;
          } catch (error) {
            logger.error(`[WS] Error sending to ${userEmail}:`, { error });
          }
        }
      });
    }

    return sentCount;
  }

  /**
   * Get total number of connected clients
   */
  public getTotalClients(): number {
    let total = 0;
    this.clients.forEach((clientList) => {
      total += clientList.length;
    });
    return total;
  }

  /**
   * Get list of connected user emails
   */
  public getConnectedUsers(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Graceful shutdown
   */
  public shutdown(): Promise<void> {
    return new Promise((resolve) => {
      logger.info('[WS] Shutting down WebSocket server...');

      // Stop heartbeat
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }

      // Clear pending auth timeouts
      this.pendingAuth.forEach((timeout) => clearTimeout(timeout));
      this.pendingAuth.clear();

      // Close all connections gracefully
      if (this.wss) {
        this.wss.clients.forEach((ws) => {
          ws.close(1001, 'Server shutting down');
        });

        this.wss.close(() => {
          logger.info('[WS] WebSocket server shut down');
          resolve();
        });
      } else {
        resolve();
      }

      this.clients.clear();
    });
  }
}

// Export singleton instance
export const wsManager = WebSocketManager.getInstance();
export default wsManager;

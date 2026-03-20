'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// Constants for WebSocket connection
const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;
const MAX_RECONNECT_ATTEMPTS = 10;
const HEARTBEAT_INTERVAL_MS = 25000; // Send ping every 25 seconds

interface WebSocketMessage {
  type: string;
  data?: unknown;
  timestamp: number;
}

interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onNewAppointments?: (appointments: unknown[], source: string) => void;
  onConnectionChange?: (connected: boolean) => void;
  autoReconnect?: boolean;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  isAuthenticated: boolean;
  lastMessage: WebSocketMessage | null;
  connect: () => void;
  disconnect: () => void;
  sendMessage: (message: object) => boolean;
  reconnectAttempts: number;
}

/**
 * Calculate reconnect delay with exponential backoff and jitter
 * This prevents thundering herd when server restarts
 */
function calculateReconnectDelay(attempt: number): number {
  // Exponential backoff: 1s, 2s, 4s, 8s, etc. capped at max
  const exponentialDelay = Math.min(
    INITIAL_RECONNECT_DELAY_MS * Math.pow(2, attempt),
    MAX_RECONNECT_DELAY_MS
  );

  // Add jitter (0.5 to 1.5 multiplier) to prevent thundering herd
  const jitter = 0.5 + Math.random();

  return Math.round(exponentialDelay * jitter);
}

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const {
    onMessage,
    onNewAppointments,
    onConnectionChange,
    autoReconnect = true,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isDisconnectingRef = useRef(false);
  const connectRef = useRef<() => void>(() => {});

  // Clear all timers
  const clearTimers = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  // Start heartbeat to keep connection alive
  const startHeartbeat = useCallback(() => {
    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
      }
    }, HEARTBEAT_INTERVAL_MS);
  }, []);

  // Connect to WebSocket server
  const connect = useCallback(() => {
    // Get token from localStorage
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

    if (!token) {
      console.log('[WS] No auth token, skipping WebSocket connection');
      return;
    }

    // Don't connect if already connected or connecting
    if (wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    isDisconnectingRef.current = false;
    clearTimers();

    // Build WebSocket URL - NO TOKEN IN URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws`;

    try {
      console.log('[WS] Connecting...');
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] Connected, waiting for auth prompt...');
        setIsConnected(true);
        onConnectionChange?.(true);
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);

          // Handle authentication flow
          if (message.type === 'AUTH_REQUIRED') {
            // Server is asking for authentication - send token via message
            const authToken = localStorage.getItem('token');
            if (authToken) {
              console.log('[WS] Sending authentication...');
              ws.send(JSON.stringify({
                type: 'AUTH',
                data: { token: authToken },
                timestamp: Date.now(),
              }));
            } else {
              console.log('[WS] No token available for auth');
              ws.close(1000, 'No authentication token');
            }
            return;
          }

          if (message.type === 'AUTH_SUCCESS') {
            console.log('[WS] Authenticated successfully');
            setIsAuthenticated(true);
            reconnectAttemptsRef.current = 0;
            setReconnectAttempts(0);
            startHeartbeat();
            return;
          }

          if (message.type === 'AUTH_FAILED') {
            console.log('[WS] Authentication failed:', message.data);
            setIsAuthenticated(false);
            // Don't auto-reconnect on auth failure - token is likely invalid
            isDisconnectingRef.current = true;
            ws.close(1000, 'Authentication failed');
            return;
          }

          if (message.type === 'SERVER_SHUTDOWN') {
            console.log('[WS] Server shutting down');
            // Will reconnect after delay
            return;
          }

          if (message.type === 'PONG') {
            // Heartbeat response - connection is alive
            return;
          }

          // Call user's onMessage handler
          onMessage?.(message);

          // Handle specific message types
          if (message.type === 'NEW_APPOINTMENTS' && onNewAppointments) {
            const data = message.data as { appointments?: unknown[]; source?: string } | undefined;
            onNewAppointments(data?.appointments || [], data?.source || 'unknown');
          }
        } catch (error) {
          console.error('[WS] Error parsing message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('[WS] Disconnected:', event.code, event.reason);
        setIsConnected(false);
        setIsAuthenticated(false);
        onConnectionChange?.(false);
        wsRef.current = null;
        clearTimers();

        // Attempt to reconnect with exponential backoff and jitter
        if (
          autoReconnect &&
          !isDisconnectingRef.current &&
          reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS
        ) {
          const delay = calculateReconnectDelay(reconnectAttemptsRef.current);
          reconnectAttemptsRef.current++;
          setReconnectAttempts(reconnectAttemptsRef.current);

          console.log(
            `[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`
          );

          reconnectTimeoutRef.current = setTimeout(() => connectRef.current(), delay);
        } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          console.log('[WS] Max reconnect attempts reached');
        }
      };

      ws.onerror = (error) => {
        console.error('[WS] Error:', error);
      };
    } catch (error) {
      console.error('[WS] Connection error:', error);
    }
  }, [onMessage, onNewAppointments, onConnectionChange, autoReconnect, clearTimers, startHeartbeat]);

  // Keep connectRef in sync with latest connect function
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  // Disconnect from WebSocket server
  const disconnect = useCallback(() => {
    console.log('[WS] Disconnecting...');
    isDisconnectingRef.current = true;
    clearTimers();

    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnect');
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsAuthenticated(false);
    reconnectAttemptsRef.current = MAX_RECONNECT_ATTEMPTS; // Prevent auto-reconnect
    setReconnectAttempts(reconnectAttemptsRef.current);
  }, [clearTimers]);

  // Send a message through WebSocket
  const sendMessage = useCallback((message: object): boolean => {
    if (wsRef.current?.readyState === WebSocket.OPEN && isAuthenticated) {
      try {
        wsRef.current.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error('[WS] Error sending message:', error);
      }
    }
    return false;
  }, [isAuthenticated]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Reconnect when token changes (e.g., after login)
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'token') {
        if (event.newValue) {
          // New token - reconnect
          reconnectAttemptsRef.current = 0;
          setReconnectAttempts(0);
          isDisconnectingRef.current = false;
          connect();
        } else {
          // Token removed - disconnect
          disconnect();
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [connect, disconnect]);

  return {
    isConnected,
    isAuthenticated,
    lastMessage,
    connect,
    disconnect,
    sendMessage,
    reconnectAttempts,
  };
}

export default useWebSocket;

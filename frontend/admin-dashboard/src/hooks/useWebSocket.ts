import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseWebSocketOptions {
  reconnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
  timeout?: number;
}

interface WebSocketState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  lastMessage: any;
  reconnectCount: number;
}

export const useWebSocket = (
  url: string,
  options: UseWebSocketOptions = {}
) => {
  const {
    reconnect = true,
    reconnectAttempts = 5,
    reconnectDelay = 1000,
    timeout = 10000
  } = options;

  const [state, setState] = useState<WebSocketState>({
    connected: false,
    connecting: false,
    error: null,
    lastMessage: null,
    reconnectCount: 0
  });

  const [data, setData] = useState<any>(null);
  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    setState(prev => ({
      ...prev,
      connecting: true,
      error: null
    }));

    const token = localStorage.getItem('auth_token');
    const socketUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080';

    const socket = io(socketUrl, {
      path: url,
      auth: {
        token
      },
      timeout,
      transports: ['websocket', 'polling'],
      forceNew: true
    });

    socket.on('connect', () => {
      console.log('WebSocket connected:', url);
      if (!mountedRef.current) return;
      
      setState(prev => ({
        ...prev,
        connected: true,
        connecting: false,
        error: null,
        reconnectCount: 0
      }));
    });

    socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      if (!mountedRef.current) return;

      setState(prev => ({
        ...prev,
        connected: false,
        connecting: false
      }));

      // Attempt reconnection if enabled and not a manual disconnect
      if (reconnect && reason !== 'io client disconnect' && 
          state.reconnectCount < reconnectAttempts) {
        scheduleReconnect();
      }
    });

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      if (!mountedRef.current) return;

      setState(prev => ({
        ...prev,
        connected: false,
        connecting: false,
        error: error.message || 'Connection failed'
      }));

      if (reconnect && state.reconnectCount < reconnectAttempts) {
        scheduleReconnect();
      }
    });

    // Listen for data events
    socket.on('data', (message) => {
      if (!mountedRef.current) return;
      
      setData(message);
      setState(prev => ({
        ...prev,
        lastMessage: message
      }));
    });

    // Listen for specific event types
    socket.on('metrics', (metrics) => {
      if (!mountedRef.current) return;
      setData(metrics);
    });

    socket.on('notification', (notification) => {
      if (!mountedRef.current) return;
      setData(notification);
    });

    socket.on('agent-update', (agentData) => {
      if (!mountedRef.current) return;
      setData(agentData);
    });

    socket.on('task-update', (taskData) => {
      if (!mountedRef.current) return;
      setData(taskData);
    });

    socket.on('error', (error) => {
      console.error('WebSocket error:', error);
      if (!mountedRef.current) return;

      setState(prev => ({
        ...prev,
        error: error.message || 'WebSocket error'
      }));
    });

    socketRef.current = socket;
  }, [url, reconnect, reconnectAttempts, timeout, state.reconnectCount]);

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return;

    setState(prev => ({
      ...prev,
      reconnectCount: prev.reconnectCount + 1
    }));

    const delay = reconnectDelay * Math.pow(2, state.reconnectCount);
    console.log(`Attempting reconnect in ${delay}ms (attempt ${state.reconnectCount + 1})`);

    reconnectTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current && !state.connected) {
        connect();
      }
    }, delay);
  }, [connect, reconnectDelay, state.reconnectCount, state.connected]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    setState(prev => ({
      ...prev,
      connected: false,
      connecting: false,
      error: null
    }));
  }, []);

  const sendMessage = useCallback((event: string, data?: any) => {
    if (socketRef.current && state.connected) {
      socketRef.current.emit(event, data);
      return true;
    }
    console.warn('WebSocket not connected, message not sent');
    return false;
  }, [state.connected]);

  const subscribe = useCallback((event: string, callback: (data: any) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
      return () => {
        if (socketRef.current) {
          socketRef.current.off(event, callback);
        }
      };
    }
    return () => {};
  }, []);

  // Connect on mount
  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  return {
    ...state,
    data,
    connect,
    disconnect,
    sendMessage,
    subscribe,
    socket: socketRef.current
  };
};
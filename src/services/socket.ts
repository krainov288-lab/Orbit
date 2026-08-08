import { api } from './api';

type Listener = (data: any) => void;

class SocketService {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<Listener>> = new Map();
  private isConnecting = false;
  private isAuthenticated = false;
  private reconnectTimer: any = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 20;
  private pendingQueue: any[] = [];
  private isWindowListenerAttached = false;

  constructor() {
    this.setupWindowListeners();
  }

  private setupWindowListeners(): void {
    if (typeof window !== 'undefined' && !this.isWindowListenerAttached) {
      this.isWindowListenerAttached = true;
      window.addEventListener('online', () => {
        if (api.getToken() && (!this.ws || this.ws.readyState === WebSocket.CLOSED)) {
          this.reconnectAttempts = 0;
          this.connect();
        }
      });
      window.addEventListener('focus', () => {
        if (api.getToken() && (!this.ws || this.ws.readyState === WebSocket.CLOSED)) {
          this.connect();
        }
      });
    }
  }

  public isConnected(): boolean {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN && this.isAuthenticated;
  }

  public connect(): void {
    const token = api.getToken();
    if (!token) return;

    // If socket is already OPEN or actively CONNECTING, don't open duplicate sockets
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      if (this.ws.readyState === WebSocket.OPEN && !this.isAuthenticated) {
        // Retry authentication if socket is open but unauthenticated
        this.rawSend({ type: 'auth', token });
      }
      return;
    }

    if (this.isConnecting) return;

    this.isConnecting = true;
    this.isAuthenticated = false;

    // Clean up staled socket if any
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        // Authenticate socket session safely
        this.rawSend({ type: 'auth', token });
        this.notify('connection_change', { connected: true });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'auth_success') {
            this.isAuthenticated = true;
            this.flushQueue();
            this.notify('authenticated', data);
          }
          if (data.type) {
            this.notify(data.type, data);
            this.notify('*', data);
          }
        } catch (e) {
          console.error('Failed to parse WS message', e);
        }
      };

      this.ws.onclose = () => {
        this.ws = null;
        this.isConnecting = false;
        this.isAuthenticated = false;
        this.notify('connection_change', { connected: false });

        // Schedule reconnection with backoff
        clearTimeout(this.reconnectTimer);
        if (api.getToken() && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts - 1), 10000);
          this.reconnectTimer = setTimeout(() => {
            if (api.getToken()) {
              this.connect();
            }
          }, delay);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('WebSocket error:', err);
        this.isConnecting = false;
      };
    } catch (e) {
      this.isConnecting = false;
      console.error('WebSocket connection error:', e);
    }
  }

  private rawSend(payload: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        const msg = typeof payload === 'string' ? payload : JSON.stringify(payload);
        this.ws.send(msg);
      } catch (e) {
        console.error('WebSocket rawSend error:', e);
      }
    }
  }

  public send(payload: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.isAuthenticated) {
      this.rawSend(payload);
    } else {
      // Queue message to send once connection and auth complete
      this.pendingQueue.push(payload);
      if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
        this.connect();
      }
    }
  }

  private flushQueue(): void {
    if (this.pendingQueue.length === 0) return;
    const queue = [...this.pendingQueue];
    this.pendingQueue = [];
    queue.forEach((payload) => {
      this.rawSend(payload);
    });
  }

  public emit(eventType: string, data: any = {}): void {
    this.send({ type: eventType, ...data });
  }

  public disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null; // Prevent onclose handler from triggering reconnect
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.isConnecting = false;
    this.isAuthenticated = false;
    this.reconnectAttempts = 0;
    this.pendingQueue = [];
  }

  public subscribe(eventType: string, callback: Listener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);

    return () => {
      this.listeners.get(eventType)?.delete(callback);
    };
  }

  private notify(eventType: string, data: any): void {
    const callbacks = this.listeners.get(eventType);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(data);
        } catch (err) {
          console.error(`Error in socket callback for event "${eventType}":`, err);
        }
      });
    }
  }
}

export const socketService = new SocketService();


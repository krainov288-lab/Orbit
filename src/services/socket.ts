import { api } from './api';

type Listener = (data: any) => void;

class SocketService {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<Listener>> = new Map();
  private isConnecting = false;
  private reconnectTimer: any = null;

  public connect(): void {
    const token = api.getToken();
    if (!token || this.ws || this.isConnecting) return;

    this.isConnecting = true;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnecting = false;
        // Authenticate socket session safely
        this.send({ type: 'auth', token });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
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
        // Attempt reconnect after 3s
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
          if (api.getToken()) {
            this.connect();
          }
        }, 3000);
      };

      this.ws.onerror = (err) => {
        console.warn('WebSocket error:', err);
      };
    } catch (e) {
      this.isConnecting = false;
      console.error('WebSocket connection error:', e);
    }
  }

  public send(payload: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        const msg = typeof payload === 'string' ? payload : JSON.stringify(payload);
        this.ws.send(msg);
      } catch (e) {
        console.error('WebSocket send error:', e);
      }
    } else {
      console.warn('WebSocket is not OPEN when trying to send:', this.ws?.readyState);
    }
  }

  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    clearTimeout(this.reconnectTimer);
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
      callbacks.forEach((cb) => cb(data));
    }
  }
}

export const socketService = new SocketService();

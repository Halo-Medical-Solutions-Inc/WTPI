type ConnectionState = "connecting" | "connected" | "disconnected" | "error";

interface WebSocketEvent {
  type: string;
  data: unknown;
}

type MessageCallback = (event: WebSocketEvent) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private url: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private messageCallback: MessageCallback | null = null;
  private reconnectCallback: (() => void) | null = null;
  private connectionState: ConnectionState = "disconnected";

  private getWebSocketUrl(): string {
    if (typeof window === "undefined") {
      return "";
    }

    if (this.url) {
      return this.url;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host =
      process.env.NEXT_PUBLIC_API_URL?.replace(/^https?:\/\//, "") ||
      "localhost:8000";
    this.url = `${protocol}//${host}/ws`;
    return this.url;
  }

  connect(token: string): void {
    if (typeof window === "undefined") {
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    this.token = token;
    this.connectionState = "connecting";
    const wsUrl = this.getWebSocketUrl();

    try {
      this.ws = new WebSocket(`${wsUrl}?token=${token}`);

      this.ws.onopen = () => {
        const wasReconnect = this.reconnectAttempts > 0;
        this.connectionState = "connected";
        this.reconnectAttempts = 0;
        this.startPingInterval();
        if (wasReconnect && this.reconnectCallback) {
          this.reconnectCallback();
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketEvent;

          if (message.type === "ping") {
            this.send({ type: "pong" });
            return;
          }

          if (message.type === "pong") {
            return;
          }

          if (this.messageCallback) {
            this.messageCallback(message);
          }
        } catch {
        }
      };

      this.ws.onerror = () => {
        this.connectionState = "error";
      };

      this.ws.onclose = () => {
        this.connectionState = "disconnected";
        this.stopPingInterval();
        this.attemptReconnect();
      };
    } catch {
      this.connectionState = "error";
      this.attemptReconnect();
    }
  }

  disconnect(): void {
    this.stopPingInterval();
    this.clearReconnectTimeout();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.token = null;
    this.connectionState = "disconnected";
    this.reconnectAttempts = 0;
  }

  send(message: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  onMessage(callback: MessageCallback): void {
    this.messageCallback = callback;
  }

  onReconnect(callback: () => void): void {
    this.reconnectCallback = callback;
  }

  getState(): ConnectionState {
    return this.connectionState;
  }

  private attemptReconnect(): void {
    if (!this.token || this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts - 1),
      30000
    );

    this.reconnectTimeout = setTimeout(() => {
      if (this.token) {
        this.connect(this.token);
      }
    }, delay);
  }

  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: "ping" });
      }
    }, 30000);
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
}

export const websocketClient = new WebSocketClient();

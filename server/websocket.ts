import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { securityManager } from './security.js';

const JWT_SECRET = process.env.JWT_SECRET || 'orbit_jwt_secret_super_key_2026_prod';

interface ClientSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

class RealtimeServer {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, Set<ClientSocket>> = new Map();

  public init(server: HttpServer): void {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: ClientSocket, req) => {
      ws.isAlive = true;
      const clientIp = req.socket.remoteAddress || 'unknown_ws';

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', (message: string) => {
        const rateKey = ws.userId || clientIp;
        if (!securityManager.checkWebSocketRate(rateKey)) {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'error', message: 'Превышена частота отправки команд по WebSocket (Anti-Spam).' }));
          }
          return;
        }
        try {
          const data = JSON.parse(message.toString());
          if (data.type === 'auth') {
            const token = data.token;
            if (!token) return;

            jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
              if (ws.readyState !== WebSocket.OPEN) return;

              if (err || !decoded) {
                ws.send(JSON.stringify({ type: 'error', message: 'Auth failed' }));
                return;
              }

              ws.userId = decoded.id;
              if (!this.clients.has(decoded.id)) {
                this.clients.set(decoded.id, new Set());
              }
              this.clients.get(decoded.id)!.add(ws);

              ws.send(JSON.stringify({ type: 'auth_success', userId: decoded.id }));
            });
          } else if (data.type === 'call_user') {
            const { targetUserId, callType, caller, channelId } = data;
            if (targetUserId) {
              this.sendToUser(targetUserId, {
                type: 'incoming_call',
                caller,
                callType,
                channelId,
              });
            } else {
              this.broadcast({
                type: 'incoming_call',
                caller,
                callType,
                channelId,
              });
            }
          } else if (data.type === 'accept_call') {
            if (data.callerId) {
              this.sendToUser(data.callerId, {
                type: 'call_accepted',
                callerId: data.callerId,
                responderId: ws.userId || data.responderId,
              });
            } else {
              this.broadcast({
                type: 'call_accepted',
                callerId: data.callerId,
                responderId: ws.userId || data.responderId,
              });
            }
          } else if (data.type === 'decline_call') {
            if (data.callerId) {
              this.sendToUser(data.callerId, {
                type: 'call_declined',
                callerId: data.callerId,
                responderId: ws.userId || data.responderId,
              });
            } else {
              this.broadcast({
                type: 'call_declined',
                callerId: data.callerId,
                responderId: ws.userId || data.responderId,
              });
            }
          } else if (data.type === 'end_call') {
            const { targetUserId } = data;
            if (targetUserId) {
              this.sendToUser(targetUserId, {
                type: 'call_ended',
                fromUserId: ws.userId,
              });
            } else {
              this.broadcast({
                type: 'call_ended',
                fromUserId: ws.userId,
              });
            }
          } else if (data.type === 'webrtc_offer') {
            const { targetUserId, offer, callerId } = data;
            if (targetUserId) {
              this.sendToUser(targetUserId, {
                type: 'webrtc_offer',
                offer,
                callerId: callerId || ws.userId,
              });
            } else {
              this.broadcast({
                type: 'webrtc_offer',
                offer,
                callerId: callerId || ws.userId,
              });
            }
          } else if (data.type === 'webrtc_answer') {
            const { targetUserId, answer, responderId } = data;
            if (targetUserId) {
              this.sendToUser(targetUserId, {
                type: 'webrtc_answer',
                answer,
                responderId: responderId || ws.userId,
              });
            } else {
              this.broadcast({
                type: 'webrtc_answer',
                answer,
                responderId: responderId || ws.userId,
              });
            }
          } else if (data.type === 'webrtc_ice_candidate') {
            const { targetUserId, candidate, senderId } = data;
            if (targetUserId) {
              this.sendToUser(targetUserId, {
                type: 'webrtc_ice_candidate',
                candidate,
                senderId: senderId || ws.userId,
              });
            } else {
              this.broadcast({
                type: 'webrtc_ice_candidate',
                candidate,
                senderId: senderId || ws.userId,
              });
            }
          } else if (data.type === 'start_live_stream') {
            this.broadcast({
              type: 'live_stream_started',
              channelId: data.channelId,
              channelTitle: data.channelTitle,
              authorName: data.authorName,
            });
          } else if (data.type === 'typing') {
            const { targetUserId, channelGroupId, isTyping } = data;
            const senderId = ws.userId;
            if (targetUserId) {
              this.sendToUser(targetUserId, {
                type: 'user_typing',
                senderId,
                channelGroupId,
                isTyping: !!isTyping,
              });
            } else if (channelGroupId) {
              this.broadcast({
                type: 'user_typing',
                senderId,
                channelGroupId,
                isTyping: !!isTyping,
              });
            }
          }
        } catch (e) {
          console.error('WebSocket message parsing error:', e);
        }
      });

      ws.on('close', () => {
        if (ws.userId && this.clients.has(ws.userId)) {
          this.clients.get(ws.userId)!.delete(ws);
          if (this.clients.get(ws.userId)!.size === 0) {
            this.clients.delete(ws.userId);
          }
        }
      });
    });

    // Heartbeat ping interval
    const interval = setInterval(() => {
      this.wss?.clients.forEach((ws: ClientSocket) => {
        if (ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);

    this.wss.on('close', () => {
      clearInterval(interval);
    });
  }

  public sendToUser(userId: string, payload: any): void {
    const userSockets = this.clients.get(userId);
    if (userSockets) {
      const msg = JSON.stringify(payload);
      userSockets.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(msg);
        }
      });
    }
  }

  public broadcast(payload: any): void {
    if (!this.wss) return;
    const msg = JSON.stringify(payload);
    this.wss.clients.forEach((ws: ClientSocket) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    });
  }

  public isUserOnline(userId: string): boolean {
    return this.clients.has(userId) && this.clients.get(userId)!.size > 0;
  }
}

export const realtimeServer = new RealtimeServer();

import { Request, Response, NextFunction } from 'express';

interface RequestLog {
  timestamps: number[];
  messages?: { content: string; timestamp: number }[];
  blockedUntil?: number;
}

// In-memory sliding window rate limiters
class SecurityManager {
  private ipLogs: Map<string, RequestLog> = new Map();
  private userLogs: Map<string, RequestLog> = new Map();
  private reactionLogs: Map<string, RequestLog> = new Map();
  private wsLogs: Map<string, RequestLog> = new Map();

  // Cleanup expired entries periodically to prevent memory leaks
  constructor() {
    setInterval(() => this.cleanup(), 60000);
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, log] of this.ipLogs.entries()) {
      log.timestamps = log.timestamps.filter((t) => now - t < 30000);
      if (log.timestamps.length === 0 && (!log.blockedUntil || log.blockedUntil < now)) {
        this.ipLogs.delete(key);
      }
    }
    for (const [key, log] of this.userLogs.entries()) {
      log.timestamps = log.timestamps.filter((t) => now - t < 30000);
      if (log.messages) {
        log.messages = log.messages.filter((m) => now - m.timestamp < 30000);
      }
      if (log.timestamps.length === 0 && (!log.blockedUntil || log.blockedUntil < now)) {
        this.userLogs.delete(key);
      }
    }
    for (const [key, log] of this.reactionLogs.entries()) {
      log.timestamps = log.timestamps.filter((t) => now - t < 30000);
      if (log.timestamps.length === 0) {
        this.reactionLogs.delete(key);
      }
    }
  }

  // 1. DDoS Mitigation: Sliding window token bucket
  public checkRateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    let log = this.ipLogs.get(key);
    if (!log) {
      log = { timestamps: [] };
      this.ipLogs.set(key, log);
    }

    if (log.blockedUntil && log.blockedUntil > now) {
      return { allowed: false, retryAfter: Math.ceil((log.blockedUntil - now) / 1000) };
    }

    log.timestamps = log.timestamps.filter((t) => now - t < windowMs);

    if (log.timestamps.length >= limit) {
      log.blockedUntil = now + 5000; // Temporary block for 5 seconds
      return { allowed: false, retryAfter: 5 };
    }

    log.timestamps.push(now);
    return { allowed: true };
  }

  // 2. Click-Spam Defense for interactive buttons/endpoints
  public checkClickSpam(key: string): { allowed: boolean; retryAfter?: number } {
    return this.checkRateLimit(`click:${key}`, 60, 5000); // Max 60 requests per 5s
  }

  // 3. Reaction & Like Anti-Cheat Protection
  public checkReactionAntiCheat(userId: string): { allowed: boolean; error?: string } {
    const now = Date.now();
    let log = this.reactionLogs.get(userId);
    if (!log) {
      log = { timestamps: [] };
      this.reactionLogs.set(userId, log);
    }

    log.timestamps = log.timestamps.filter((t) => now - t < 10000);

    if (log.timestamps.length >= 8) {
      return {
        allowed: false,
        error: 'Анти-чит защита: Слишком частая смена реакций/лайков (Anti-Farming). Попробуйте позже.',
      };
    }

    log.timestamps.push(now);
    return { allowed: true };
  }

  // 4. Anti-Spam System for Messages
  public checkMessageSpam(userId: string, content: string): { isSpam: boolean; error?: string } {
    const now = Date.now();
    let log = this.userLogs.get(userId);
    if (!log) {
      log = { timestamps: [], messages: [] };
      this.userLogs.set(userId, log);
    }

    if (log.blockedUntil && log.blockedUntil > now) {
      const waitSec = Math.ceil((log.blockedUntil - now) / 1000);
      return {
        isSpam: true,
        error: `Аккаунт временно заблокирован за спам-активность. Подождите ${waitSec} сек.`,
      };
    }

    // Filter recent history
    log.timestamps = log.timestamps.filter((t) => now - t < 3000); // 3-second window
    log.messages = (log.messages || []).filter((m) => now - m.timestamp < 15000); // 15-second window

    // Rule A: High frequency (more than 5 messages in 3s)
    if (log.timestamps.length >= 5) {
      log.blockedUntil = now + 15000; // Block for 15s
      return {
        isSpam: true,
        error: 'Обнаружена спам-рассылка: Слишком частая отправка сообщений. Доступ ограничен на 15 сек.',
      };
    }

    // Rule B: Repetitive identical content (3 identical messages in 15s)
    const trimmed = (content || '').trim().toLowerCase();
    if (trimmed.length > 0) {
      const identicalCount = log.messages.filter((m) => m.content === trimmed).length;
      if (identicalCount >= 2) {
        log.blockedUntil = now + 15000;
        return {
          isSpam: true,
          error: 'Обнаружена спам-активность: Повторяющийся текст сообщений за короткий промежуток времени.',
        };
      }
    }

    log.timestamps.push(now);
    if (!log.messages) log.messages = [];
    log.messages.push({ content: trimmed, timestamp: now });

    return { isSpam: false };
  }

  // 5. WebSocket message throttling
  public checkWebSocketRate(clientId: string): boolean {
    const now = Date.now();
    let log = this.wsLogs.get(clientId);
    if (!log) {
      log = { timestamps: [] };
      this.wsLogs.set(clientId, log);
    }

    log.timestamps = log.timestamps.filter((t) => now - t < 5000);
    if (log.timestamps.length >= 25) {
      return false; // Exceeded 25 socket messages per 5s
    }

    log.timestamps.push(now);
    return true;
  }
}

export const securityManager = new SecurityManager();

// Global DDoS Protection Express Middleware
export function globalDdosProtection(req: Request, res: Response, next: NextFunction): void {
  const clientKey = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
  const result = securityManager.checkRateLimit(clientKey, 120, 10000); // 120 requests / 10s

  if (!result.allowed) {
    res.setHeader('Retry-After', result.retryAfter || 5);
    res.status(429).json({
      error: 'Превышена частота запросов к серверу (DDoS Protection). Пожалуйста, подождите...',
    });
    return;
  }

  next();
}

// Click-Spam Protection Middleware for Interactive Routes
export function clickSpamProtection(req: Request, res: Response, next: NextFunction): void {
  const clientKey = (req as any).user?.id || (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
  const result = securityManager.checkClickSpam(clientKey);

  if (!result.allowed) {
    res.setHeader('Retry-After', result.retryAfter || 5);
    res.status(429).json({
      error: 'Зафиксирован слишком частый клик-спам по интерактивным элементам. Подождите пару секунд.',
    });
    return;
  }

  next();
}

// Reaction & Like Anti-Cheat Middleware
export function reactionAntiCheat(req: Request, res: Response, next: NextFunction): void {
  const userId = (req as any).user?.id || 'anonymous';
  const result = securityManager.checkReactionAntiCheat(userId);

  if (!result.allowed) {
    res.status(429).json({ error: result.error });
    return;
  }

  next();
}

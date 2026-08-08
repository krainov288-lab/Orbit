import express from 'express';
import http from 'http';
import path from 'path';
import jwt from 'jsonwebtoken';
import { createServer as createViteServer } from 'vite';
import { db, DBMessage, DBTransaction, DBNotification, DBAnnouncement, DBNews } from './server/db.js';
import {
  authenticateToken,
  registerHandler,
  loginHandler,
  guestLoginHandler,
  getCurrentUserHandler,
  checkAvailabilityHandler,
  requestPasswordResetHandler,
  resetPasswordHandler,
  validateNicknameServer,
  AuthenticatedRequest,
  JWT_SECRET,
} from './server/auth.js';
import { realtimeServer } from './server/websocket.js';
import { aiChatHandler } from './server/ai.js';
import { uploadMediaHandler } from './server/media.js';
import {
  globalDdosProtection,
  clickSpamProtection,
  reactionAntiCheat,
  securityManager,
} from './server/security.js';

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Global DDoS and Click-Spam Security Protection Middlewares
  app.use('/api', globalDdosProtection);
  app.use('/api', clickSpamProtection);

  // Serve static uploads
  const uploadsPath = path.join(process.cwd(), 'uploads');
  app.use('/uploads', express.static(uploadsPath));

  // --- API ROUTES ---

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Authentication
  app.post('/api/auth/register', registerHandler);
  app.post('/api/auth/login', loginHandler);
  app.post('/api/auth/guest', guestLoginHandler);
  app.get('/api/auth/me', authenticateToken, getCurrentUserHandler);
  app.post('/api/auth/check-availability', checkAvailabilityHandler);
  app.post('/api/auth/request-password-reset', requestPasswordResetHandler);
  app.post('/api/auth/reset-password', resetPasswordHandler);

  // Users and Contacts Search
  app.get('/api/contacts', authenticateToken, (req: AuthenticatedRequest, res) => {
    const currentUserId = req.user!.id;
    const contactUserIds = new Set(db.getContactUserIds(currentUserId));

    const contactsList = db.getUsers().filter((u) => {
      if (u.id === currentUserId) return false;
      if (db.isUserBlocked(currentUserId, u.id)) return false;
      if (contactUserIds.has(u.id)) return true;
      const msgs = db.getMessagesBetween(currentUserId, u.id, 1);
      return msgs.length > 0;
    })
      .map((user) => {
        const messages = db.getMessagesBetween(currentUserId, user.id, 1);
        const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
        const unreadCount = db.getUnreadCount(currentUserId, user.id);

        let lastText = 'Нажмите, чтобы начать чат';
        let lastTime = '';

        if (lastMsg) {
          lastText = lastMsg.text || (lastMsg.mediaType ? `[${lastMsg.mediaType}]` : '');
          const date = new Date(lastMsg.timestamp);
          lastTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        return {
          id: user.id,
          name: user.username,
          initials: user.initials,
          color: user.avatarColor,
          avatarUrl: user.avatarUrl,
          handle: user.handle,
          phone: user.phone || '',
          last: lastText,
          time: lastTime,
          unread: unreadCount,
          isOnline: realtimeServer.isUserOnline(user.id),
        };
      });

    res.json(contactsList);
  });

  // Phone Contact Synchronization
  app.post('/api/contacts/sync', authenticateToken, (req: AuthenticatedRequest, res) => {
    try {
      const currentUserId = req.user!.id;
      const { contacts } = req.body as { contacts: { name: string; phone: string; email?: string }[] };

      if (!Array.isArray(contacts)) {
        res.status(400).json({ error: 'Неверный формат данных контактов' });
        return;
      }

      const matched: any[] = [];
      const unregistered: any[] = [];

      for (const item of contacts) {
        if (!item.phone && !item.email) continue;

        // Phone normalization
        let cleanPhone = (item.phone || '').trim().replace(/[^\d+]/g, '');
        if (cleanPhone.startsWith('8') && cleanPhone.length === 11) {
          cleanPhone = '+7' + cleanPhone.substring(1);
        } else if (cleanPhone.length === 10 && !cleanPhone.startsWith('+')) {
          cleanPhone = '+7' + cleanPhone;
        }

        // Search registered user by normalized phone or email
        let foundUser = db.getUserByPhone(cleanPhone);
        if (!foundUser && item.email) {
          foundUser = db.getUserByEmail(item.email.trim());
        }

        if (foundUser && foundUser.id !== currentUserId) {
          // Auto add relation
          db.addContactRelation(currentUserId, foundUser.id);
          const isBlocked = db.isUserBlocked(currentUserId, foundUser.id);

          matched.push({
            id: foundUser.id,
            name: foundUser.username,
            contactName: item.name || foundUser.username,
            handle: foundUser.handle,
            phone: cleanPhone,
            initials: foundUser.initials,
            color: foundUser.avatarColor,
            isOnline: realtimeServer.isUserOnline(foundUser.id),
            isBlocked,
          });
        } else if (!foundUser) {
          unregistered.push({
            id: `phone_${cleanPhone || item.name}`,
            name: item.name || 'Абонент',
            phone: cleanPhone || item.phone,
            email: item.email || '',
            inviteText: `Привет! Давай общаться в Orbit Messenger. Мой профиль: ${req.user?.handle || ''}`,
          });
        }
      }

      res.json({
        matched,
        unregistered,
        totalSynced: contacts.length,
      });
    } catch (err) {
      console.error('Contact sync error:', err);
      res.status(500).json({ error: 'Ошибка синхронизации контактов' });
    }
  });

  // Contact Relations API
  app.post('/api/contacts/add', authenticateToken, (req: AuthenticatedRequest, res) => {
    const currentUserId = req.user!.id;
    const { contactUserId } = req.body;
    if (!contactUserId) {
      res.status(400).json({ error: 'Укажите ID пользователя' });
      return;
    }
    db.addContactRelation(currentUserId, contactUserId);
    res.json({ success: true, message: 'Контакт добавлен' });
  });

  app.post('/api/contacts/remove', authenticateToken, (req: AuthenticatedRequest, res) => {
    const currentUserId = req.user!.id;
    const { contactUserId } = req.body;
    if (!contactUserId) {
      res.status(400).json({ error: 'Укажите ID пользователя' });
      return;
    }
    db.removeContactRelation(currentUserId, contactUserId);
    db.deleteMessagesBetween(currentUserId, contactUserId);
    res.json({ success: true, message: 'Чат удален' });
  });

  // Block & Unblock API
  app.post('/api/contacts/block', authenticateToken, (req: AuthenticatedRequest, res) => {
    const currentUserId = req.user!.id;
    const { targetUserId } = req.body;
    if (!targetUserId) {
      res.status(400).json({ error: 'Укажите ID пользователя' });
      return;
    }
    db.blockUser(currentUserId, targetUserId);
    res.json({ success: true, message: 'Пользователь заблокирован' });
  });

  app.post('/api/contacts/unblock', authenticateToken, (req: AuthenticatedRequest, res) => {
    const currentUserId = req.user!.id;
    const { targetUserId } = req.body;
    if (!targetUserId) {
      res.status(400).json({ error: 'Укажите ID пользователя' });
      return;
    }
    db.unblockUser(currentUserId, targetUserId);
    res.json({ success: true, message: 'Пользователь разблокирован' });
  });

  app.get('/api/contacts/blocked', authenticateToken, (req: AuthenticatedRequest, res) => {
    const currentUserId = req.user!.id;
    const blockedRecords = db.getBlockedUsers(currentUserId);
    const blockedList = blockedRecords.map((b) => {
      const u = db.getUserById(b.blockedUserId);
      return {
        id: b.blockedUserId,
        name: u ? u.username : 'Заблокированный пользователь',
        handle: u ? u.handle : '',
        initials: u ? u.initials : 'БЛ',
        color: u ? u.avatarColor : 'from-slate-500 to-slate-700',
        blockedAt: b.timestamp,
      };
    });
    res.json(blockedList);
  });

  // Report User API
  app.post('/api/contacts/report', authenticateToken, (req: AuthenticatedRequest, res) => {
    const currentUserId = req.user!.id;
    const { targetUserId, reason, comment, blockAfterReport } = req.body;

    if (!targetUserId || !reason) {
      res.status(400).json({ error: 'Укажите причину жалобы и ID пользователя' });
      return;
    }

    db.addReport({
      id: `rep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      reporterId: currentUserId,
      targetUserId,
      reason,
      comment,
      timestamp: Date.now(),
    });

    if (blockAfterReport) {
      db.blockUser(currentUserId, targetUserId);
    }

    res.json({ success: true, message: 'Жалоба принята на рассмотрение' });
  });

  // Role Helpers
  function getUserRoleRank(role: string): number {
    switch (role) {
      case 'sysadmin': return 3;
      case 'admin': return 2;
      case 'support': return 1;
      default: return 0;
    }
  }

  function getRequestUser(req: AuthenticatedRequest) {
    if (!req.user) return null;
    const dbUser = db.getUserById(req.user.id);
    if (!dbUser) return null;
    const role = db.getUserRole(dbUser);
    return {
      dbUser,
      role,
      rank: getUserRoleRank(role),
    };
  }

  // Public / Authenticated Announcements API (Only active & published ones)
  app.get('/api/announcements', (req, res) => {
    res.json(db.getActiveAnnouncements());
  });

  // Admin: Get system stats & health
  app.get('/api/admin/stats', authenticateToken, (req: AuthenticatedRequest, res) => {
    const auth = getRequestUser(req);
    if (!auth || auth.rank < 1) {
      res.status(403).json({ error: 'Доступ запрещен' });
      return;
    }
    res.json(db.getSystemStats());
  });

  // Admin: Get all announcements (including future scheduled)
  app.get('/api/admin/announcements', authenticateToken, (req: AuthenticatedRequest, res) => {
    const auth = getRequestUser(req);
    if (!auth || auth.rank < 2) {
      res.status(403).json({ error: 'Доступ запрещен. Только для Администраторов' });
      return;
    }
    res.json(db.getAnnouncements());
  });

  // Admin: Create system announcement
  app.post('/api/admin/announcements', authenticateToken, (req: AuthenticatedRequest, res) => {
    const auth = getRequestUser(req);
    if (!auth || auth.rank < 2) {
      res.status(403).json({ error: 'Доступ запрещен' });
      return;
    }
    const { title, content, tag, type, scheduledAt, isButton, buttonText, buttonUrl } = req.body;
    if (!content || !content.trim()) {
      res.status(400).json({ error: 'Заполните содержание новости' });
      return;
    }

    const newAnnouncement: DBAnnouncement = {
      id: `ann_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: title && title.trim() ? title.trim() : undefined,
      content: content.trim(),
      tag: tag || 'Обновление',
      type: type || 'update',
      scheduledAt: scheduledAt ? Number(scheduledAt) : undefined,
      createdAt: Date.now(),
      createdBy: auth.dbUser.username,
      isButton: !!isButton,
      buttonText: buttonText ? buttonText.trim() : undefined,
      buttonUrl: buttonUrl ? buttonUrl.trim() : undefined,
    };

    db.createAnnouncement(newAnnouncement);
    db.addAuditLog(
      auth.dbUser.id,
      auth.dbUser.username,
      'НОВОСТЬ_СОЗДАНА',
      `Создана новость: "${title ? title.trim() : 'Без заголовка'}" (тег: ${tag})`
    );
    res.status(201).json(newAnnouncement);
  });

  // Admin: Force delete announcement for all users
  app.delete('/api/admin/announcements/:id', authenticateToken, (req: AuthenticatedRequest, res) => {
    const auth = getRequestUser(req);
    if (!auth || auth.rank < 2) {
      res.status(403).json({ error: 'Доступ запрещен' });
      return;
    }
    db.deleteAnnouncement(req.params.id);
    db.addAuditLog(
      auth.dbUser.id,
      auth.dbUser.username,
      'НОВОСТЬ_УДАЛЕНА',
      `Удалена новость ID: ${req.params.id}`
    );
    res.json({ success: true, message: 'Новость удалена у всех пользователей' });
  });

  // Admin/Support: Get all user reports & feedback
  app.get('/api/admin/reports', authenticateToken, (req: AuthenticatedRequest, res) => {
    const auth = getRequestUser(req);
    if (!auth || auth.rank < 1) {
      res.status(403).json({ error: 'Доступ запрещен' });
      return;
    }
    const reports = db.getReports().map((r) => {
      const reporter = db.getUserById(r.reporterId);
      const target = db.getUserById(r.targetUserId);
      return {
        ...r,
        reporterName: reporter ? `${reporter.username} (${reporter.handle})` : 'Пользователь',
        targetName: target ? `${target.username} (${target.handle})` : 'Система / Общее',
      };
    });
    res.json(reports);
  });

  // Admin/Support: Resolve report
  app.post('/api/admin/reports/:id/resolve', authenticateToken, (req: AuthenticatedRequest, res) => {
    const auth = getRequestUser(req);
    if (!auth || auth.rank < 1) {
      res.status(403).json({ error: 'Доступ запрещен' });
      return;
    }
    const { note } = req.body;
    const ok = db.resolveReport(req.params.id, note || 'Рассмотрено службой поддержки', auth.dbUser.username);
    if (ok) {
      db.addAuditLog(
        auth.dbUser.id,
        auth.dbUser.username,
        'ЖАЛОБА_РАССМОТРЕНА',
        `Решена жалоба ID: ${req.params.id} с комментарием: "${note || 'Без ответа'}"`
      );
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Жалоба не найдена' });
    }
  });

  // Admin/Support: Delete/Dismiss report
  app.delete('/api/admin/reports/:id', authenticateToken, (req: AuthenticatedRequest, res) => {
    const auth = getRequestUser(req);
    if (!auth || auth.rank < 1) {
      res.status(403).json({ error: 'Доступ запрещен' });
      return;
    }
    db.deleteReport(req.params.id);
    res.json({ success: true });
  });

  // Admin/Support: Get all users with roles
  app.get('/api/admin/users', authenticateToken, (req: AuthenticatedRequest, res) => {
    const auth = getRequestUser(req);
    if (!auth || auth.rank < 1) {
      res.status(403).json({ error: 'Доступ запрещен' });
      return;
    }
    const users = db.getUsers().map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      handle: u.handle,
      phone: u.phone || '',
      createdAt: u.createdAt,
      avatarColor: u.avatarColor,
      initials: u.initials,
      role: db.getUserRole(u),
      isBlocked: !!u.isBlocked,
    }));
    res.json(users);
  });

  // Admin/SysAdmin: Update user role
  app.put('/api/admin/users/:userId/role', authenticateToken, (req: AuthenticatedRequest, res) => {
    const auth = getRequestUser(req);
    if (!auth || auth.rank < 2) {
      res.status(403).json({ error: 'Недостаточно прав для управления ролями' });
      return;
    }

    const { role: newRole } = req.body;
    if (!['user', 'support', 'admin', 'sysadmin'].includes(newRole)) {
      res.status(400).json({ error: 'Указана недействительная роль' });
      return;
    }

    // Only SysAdmin can assign/revoke sysadmin role
    if ((newRole === 'sysadmin' || req.params.userId === auth.dbUser.id) && auth.rank < 3) {
      res.status(403).json({ error: 'Назначать Системных Администраторов может только Системный Администратор' });
      return;
    }

    const ok = db.updateUserRole(req.params.userId, newRole, auth.dbUser.id, auth.dbUser.username);
    if (ok) {
      res.json({ success: true, message: `Роль пользователя успешно изменена на "${newRole}"` });
    } else {
      res.status(400).json({ error: 'Нельзя изменить роль данного защищенного пользователя' });
    }
  });

  // Admin/SysAdmin: Toggle block user account
  app.post('/api/admin/users/:userId/toggle-block', authenticateToken, (req: AuthenticatedRequest, res) => {
    const auth = getRequestUser(req);
    if (!auth || auth.rank < 2) {
      res.status(403).json({ error: 'Недостаточно прав для блокировки пользователей' });
      return;
    }

    if (req.params.userId === auth.dbUser.id) {
      res.status(400).json({ error: 'Вы не можете заблокировать собственный аккаунт' });
      return;
    }

    const ok = db.toggleUserBlock(req.params.userId, auth.dbUser.id, auth.dbUser.username);
    if (ok) {
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Нельзя заблокировать главный администраторский аккаунт' });
    }
  });

  // Admin: Delete user/contact permanently
  app.delete('/api/admin/users/:userId', authenticateToken, (req: AuthenticatedRequest, res) => {
    const auth = getRequestUser(req);
    if (!auth || auth.rank < 2) {
      res.status(403).json({ error: 'Доступ запрещен' });
      return;
    }
    const targetUserId = req.params.userId;
    if (targetUserId === auth.dbUser.id) {
      res.status(400).json({ error: 'Нельзя удалить собственного администратора' });
      return;
    }

    const targetUser = db.getUserById(targetUserId);
    if (targetUser) {
      const targetRole = db.getUserRole(targetUser);
      if (getUserRoleRank(targetRole) >= auth.rank && auth.rank < 3) {
        res.status(403).json({ error: 'Вы не можете удалить пользователя с такой же или более высокой ролью' });
        return;
      }
      db.addAuditLog(
        auth.dbUser.id,
        auth.dbUser.username,
        'УДАЛЕНИЕ_ПОЛЬЗОВАТЕЛЯ',
        `Удален пользователь: ${targetUser.username} (${targetUser.handle})`
      );
    }

    db.deleteUser(targetUserId);
    res.json({ success: true, message: 'Пользователь успешно удален из системы' });
  });

  // Admin: Get security audit logs
  app.get('/api/admin/audit-logs', authenticateToken, (req: AuthenticatedRequest, res) => {
    const auth = getRequestUser(req);
    if (!auth || auth.rank < 2) {
      res.status(403).json({ error: 'Доступ к журналу безопасности запрещен' });
      return;
    }
    res.json(db.getAuditLogs());
  });

  app.get('/api/users/search', authenticateToken, (req: AuthenticatedRequest, res) => {
    const query = (req.query.q as string || '').toLowerCase().trim();
    const currentUserId = req.user!.id;

    if (!query) {
      res.json([]);
      return;
    }

    const matches = db.getUsers().filter((u) =>
      u.id !== currentUserId &&
      !db.isUserBlocked(currentUserId, u.id) &&
      (u.username.toLowerCase().includes(query) ||
       u.handle.toLowerCase().includes(query) ||
       u.email.toLowerCase().includes(query) ||
       (u.phone && u.phone.includes(query)))
    ).map((u) => ({
      id: u.id,
      name: u.username,
      initials: u.initials,
      color: u.avatarColor,
      handle: u.handle,
      phone: u.phone || '',
    }));

    res.json(matches);
  });

  // Messages API
  function formatReactions(rawReactions?: Record<string, string[]>, forUserId?: string) {
    const result: Record<string, { count: number; userReacted: boolean; users: string[] }> = {};
    if (rawReactions) {
      for (const [emoji, userIds] of Object.entries(rawReactions)) {
        if (userIds && userIds.length > 0) {
          result[emoji] = {
            count: userIds.length,
            userReacted: forUserId ? userIds.includes(forUserId) : false,
            users: userIds,
          };
        }
      }
    }
    return result;
  }

  function formatMessageForUser(m: DBMessage, currentUserId: string) {
    return {
      id: m.id,
      from: m.senderId === currentUserId ? 'me' : 'contact',
      text: m.text,
      mediaUrl: m.mediaUrl,
      mediaType: m.mediaType,
      duration: m.duration,
      waveform: m.waveform,
      fileName: m.fileName,
      fileSize: m.fileSize,
      isEncrypted: m.isEncrypted,
      replyTo: m.replyTo,
      authorName: m.authorName,
      amount: m.amount,
      tx: m.isTx,
      timestamp: m.timestamp,
      isRead: m.isRead,
      reactions: formatReactions(m.reactions, currentUserId),
    };
  }

  app.get('/api/messages/:contactId', authenticateToken, (req: AuthenticatedRequest, res) => {
    const currentUserId = req.user!.id;
    const { contactId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;
    const isHideRead = req.headers['x-hide-read-receipts'] === 'true' || req.query.hideRead === 'true';

    const channelGroup = db.getChannelGroupById(contactId);
    let messages: DBMessage[] = [];
    if (channelGroup) {
      messages = db.getMessagesForChannelGroup(contactId, limit);
    } else {
      messages = db.getMessagesBetween(currentUserId, contactId, limit);
      if (!isHideRead) {
        db.markMessagesAsRead(contactId, currentUserId);
        realtimeServer.sendToUser(contactId, {
          type: 'messages_read',
          byUserId: currentUserId,
        });
      }
    }

    const formattedMessages = messages.map((m) => formatMessageForUser(m, currentUserId));

    res.json({
      messages: formattedMessages,
      has_more: messages.length >= limit,
    });
  });

  app.get('/api/messages/:contactId/history', authenticateToken, (req: AuthenticatedRequest, res) => {
    const currentUserId = req.user!.id;
    const { contactId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;
    const beforeId = req.query.before as string;

    const channelGroup = db.getChannelGroupById(contactId);
    let messages: DBMessage[] = [];
    if (channelGroup) {
      messages = db.getMessagesForChannelGroup(contactId, limit, beforeId);
    } else {
      messages = db.getMessagesBetween(currentUserId, contactId, limit, beforeId);
    }

    const formattedMessages = messages.map((m) => formatMessageForUser(m, currentUserId));

    res.json({
      messages: formattedMessages,
      has_more: messages.length >= limit,
    });
  });

  app.post('/api/messages/:contactId/read', authenticateToken, (req: AuthenticatedRequest, res) => {
    const currentUserId = req.user!.id;
    const { contactId } = req.params;
    const isHideRead = req.headers['x-hide-read-receipts'] === 'true' || req.query.hideRead === 'true';

    if (!isHideRead) {
      db.markMessagesAsRead(contactId, currentUserId);

      realtimeServer.sendToUser(contactId, {
        type: 'messages_read',
        byUserId: currentUserId,
      });
    }

    res.json({ success: true });
  });

  app.post('/api/messages/read/:messageId', authenticateToken, (req: AuthenticatedRequest, res) => {
    const currentUserId = req.user!.id;
    const { messageId } = req.params;
    const isHideRead = req.headers['x-hide-read-receipts'] === 'true' || req.query.hideRead === 'true';

    if (!isHideRead) {
      db.markSingleMessageAsRead(messageId);

      realtimeServer.broadcast({
        type: 'message_read_single',
        messageId,
        byUserId: currentUserId,
      });
    }

    res.json({ success: true });
  });

  app.post('/api/messages/:contactId/reaction', authenticateToken, reactionAntiCheat, (req: AuthenticatedRequest, res) => {
    const currentUserId = req.user!.id;
    const { contactId } = req.params;
    const { messageId, emoji } = req.body;

    if (!messageId || !emoji) {
      res.status(400).json({ error: 'messageId and emoji are required' });
      return;
    }

    const updatedRawReactions = db.toggleMessageReaction(messageId, currentUserId, emoji);

    const senderReactions = formatReactions(updatedRawReactions, currentUserId);
    const recipientReactions = formatReactions(updatedRawReactions, contactId);

    const channelGroup = db.getChannelGroupById(contactId);
    if (channelGroup) {
      realtimeServer.broadcast({
        type: 'message_reaction',
        messageId,
        reactions: recipientReactions,
        channelGroupId: contactId,
      });
    } else {
      realtimeServer.sendToUser(contactId, {
        type: 'message_reaction',
        messageId,
        reactions: recipientReactions,
      });
    }

    res.json({
      success: true,
      reactions: senderReactions,
    });
  });

  app.post('/api/messages/:contactId', authenticateToken, (req: AuthenticatedRequest, res) => {
    const currentUserId = req.user!.id;
    const currentUser = db.getUserById(currentUserId);
    const { contactId } = req.params;
    const { text, mediaUrl, mediaType, duration, waveform, fileName, fileSize, isEncrypted, replyTo, authorName, amount, tx } = req.body;

    // Server-side anti-spam check
    const spamCheck = securityManager.checkMessageSpam(currentUserId, text || '');
    if (spamCheck.isSpam) {
      res.status(429).json({ error: spamCheck.error });
      return;
    }

    const recipient = db.getUserById(contactId);
    const channelGroup = db.getChannelGroupById(contactId);

    if (!recipient && !channelGroup) {
      res.status(404).json({ error: 'Получатель, канал или группа не найдена' });
      return;
    }

    if (recipient && db.isUserBlocked(currentUserId, contactId)) {
      res.status(403).json({ error: 'Невозможно отправить сообщение: пользователь заблокирован' });
      return;
    }

    if (channelGroup && channelGroup.type.includes('channel')) {
      const isCreator = channelGroup.creatorId === currentUserId;
      const isAdmin = (channelGroup.adminIds || []).includes(currentUserId);
      const isModerator = (channelGroup.moderatorIds || []).includes(currentUserId);
      const userRole = currentUser ? db.getUserRole(currentUser) : 'user';
      const isSysAdmin = ['admin', 'sysadmin'].includes(userRole);

      if (!isCreator && !isAdmin && !isModerator && !isSysAdmin) {
        res.status(403).json({ error: 'В каналах могут публиковать записи только авторы, администраторы и модераторы' });
        return;
      }
    }

    const newMessage: DBMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      senderId: currentUserId,
      recipientId: contactId,
      text: text || '',
      mediaUrl,
      mediaType,
      duration: typeof duration === 'number' ? duration : undefined,
      waveform: Array.isArray(waveform) ? waveform : undefined,
      fileName,
      fileSize,
      isEncrypted: !!isEncrypted,
      replyTo,
      authorName,
      amount,
      isTx: !!tx,
      timestamp: Date.now(),
      isRead: false,
    };

    db.addMessage(newMessage);

    const formattedMessage = {
      id: newMessage.id,
      from: 'me',
      text: newMessage.text,
      mediaUrl: newMessage.mediaUrl,
      mediaType: newMessage.mediaType,
      duration: newMessage.duration,
      waveform: newMessage.waveform,
      fileName: newMessage.fileName,
      fileSize: newMessage.fileSize,
      isEncrypted: newMessage.isEncrypted,
      replyTo: newMessage.replyTo,
      authorName: newMessage.authorName,
      amount: newMessage.amount,
      tx: newMessage.isTx,
      timestamp: newMessage.timestamp,
      isRead: false,
    };

    if (channelGroup) {
      const groupPayload = {
        type: 'new_message',
        senderId: currentUserId,
        senderName: currentUser?.username || 'User',
        senderInitials: currentUser?.initials || 'U',
        senderColor: currentUser?.avatarColor || 'from-sky-300 to-indigo-200',
        channelGroupId: contactId,
        message: {
          id: newMessage.id,
          from: 'contact',
          text: newMessage.text,
          mediaUrl: newMessage.mediaUrl,
          mediaType: newMessage.mediaType,
          duration: newMessage.duration,
          waveform: newMessage.waveform,
          fileName: newMessage.fileName,
          fileSize: newMessage.fileSize,
          isEncrypted: newMessage.isEncrypted,
          replyTo: newMessage.replyTo,
          authorName: newMessage.authorName,
          amount: newMessage.amount,
          tx: newMessage.isTx,
          timestamp: newMessage.timestamp,
          isRead: false,
        },
      };

      realtimeServer.broadcast(groupPayload);

      // If channel post, automatically publish to News Feed
      if (channelGroup.type.includes('channel')) {
        const newsItem: DBNews = {
          id: `news_ch_${channelGroup.id}_${Date.now()}`,
          userId: currentUserId,
          channelId: channelGroup.id,
          authorName: channelGroup.title,
          authorHandle: channelGroup.handle || `@channel_${channelGroup.id}`,
          authorAvatar: channelGroup.avatarUrl,
          tag: 'КАНАЛ',
          title: '',
          content: text || '',
          mediaUrl,
          mediaType: mediaType === 'video_circle' || mediaType === 'video' ? 'video' : 'image',
          timestamp: 'Только что',
          accent: channelGroup.avatarColor || 'from-sky-500 to-indigo-500',
          likes: [],
          comments: [],
          sharesCount: 0,
        };
        db.addNews(newsItem);
        realtimeServer.broadcast({ type: 'new_news', news: newsItem });
      }
    } else if (recipient) {
      const recipientMessagePayload = {
        type: 'new_message',
        senderId: currentUserId,
        senderName: currentUser?.username || 'User',
        senderInitials: currentUser?.initials || 'U',
        senderColor: currentUser?.avatarColor || 'from-sky-300 to-indigo-200',
        message: {
          id: newMessage.id,
          from: 'contact',
          text: newMessage.text,
          mediaUrl: newMessage.mediaUrl,
          mediaType: newMessage.mediaType,
          duration: newMessage.duration,
          waveform: newMessage.waveform,
          fileName: newMessage.fileName,
          fileSize: newMessage.fileSize,
          isEncrypted: newMessage.isEncrypted,
          replyTo: newMessage.replyTo,
          authorName: newMessage.authorName,
          amount: newMessage.amount,
          tx: newMessage.isTx,
          timestamp: newMessage.timestamp,
          isRead: false,
        },
      };

      realtimeServer.sendToUser(contactId, recipientMessagePayload);

      const notif: DBNotification = {
        id: `notif_${Date.now()}`,
        userId: contactId,
        title: currentUser?.username || 'New Message',
        body: text || (mediaType ? `Sent an ${mediaType}` : 'Sent a message'),
        timestamp: Date.now(),
        isRead: false,
        senderId: currentUserId,
      };
      db.addNotification(notif);

      realtimeServer.sendToUser(contactId, {
        type: 'push_notification',
        notification: notif,
      });
    }

    res.status(201).json(formattedMessage);
  });

  // Wallet & Crypto Transfers
  app.get('/api/wallet/balance', authenticateToken, (req: AuthenticatedRequest, res) => {
    const user = db.getUserById(req.user!.id);
    res.json({ balance: user ? user.balance : 0 });
  });

  app.get('/api/wallet/transactions', authenticateToken, (req: AuthenticatedRequest, res) => {
    const currentUserId = req.user!.id;
    const txs = db.getTransactionsForUser(currentUserId);
    res.json(txs);
  });

  app.post('/api/wallet/send', authenticateToken, (req: AuthenticatedRequest, res) => {
    const senderId = req.user!.id;
    const sender = db.getUserById(senderId);
    const { recipientId, recipientName, amount } = req.body;

    const numericAmount = parseFloat(amount);

    if (!sender) {
      res.status(404).json({ error: 'Sender user not found' });
      return;
    }

    if (isNaN(numericAmount) || numericAmount <= 0) {
      res.status(400).json({ error: 'Invalid amount' });
      return;
    }

    if (sender.balance < numericAmount) {
      res.status(400).json({ error: 'Insufficient balance' });
      return;
    }

    let recipient = recipientId ? db.getUserById(recipientId) : null;

    if (!recipient && recipientName) {
      const all = db.getUsers();
      recipient = all.find((u) => u.username.toLowerCase() === recipientName.toLowerCase() || u.handle.toLowerCase() === recipientName.toLowerCase()) || null;
    }

    if (!recipient) {
      res.status(404).json({ error: 'Recipient user not found' });
      return;
    }

    // Atomic Balance Update
    const newSenderBalance = sender.balance - numericAmount;
    const newRecipientBalance = recipient.balance + numericAmount;

    db.updateUserBalance(senderId, newSenderBalance);
    db.updateUserBalance(recipient.id, newRecipientBalance);

    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Record transactions for both
    const senderTx: DBTransaction = {
      id: `tx_${Date.now()}_1`,
      senderId,
      recipientId: recipient.id,
      recipientName: recipient.username,
      amount: numericAmount,
      type: 'out',
      timestamp: `Today, ${nowStr}`,
    };

    const recipientTx: DBTransaction = {
      id: `tx_${Date.now()}_2`,
      senderId,
      recipientId: recipient.id,
      recipientName: sender.username,
      amount: numericAmount,
      type: 'in',
      timestamp: `Today, ${nowStr}`,
    };

    db.addTransaction(senderTx);
    db.addTransaction(recipientTx);

    db.addAuditLog(
      senderId,
      sender.username,
      'ПЕРЕВОД_ORB',
      `Перевод ${numericAmount.toFixed(2)} ORB для ${recipient.username} (${recipient.handle})`
    );

    // Auto-create chat message
    const txMsg: DBMessage = {
      id: `msg_tx_${Date.now()}`,
      senderId,
      recipientId: recipient.id,
      text: `Sent ${numericAmount.toFixed(2)} ORB`,
      amount: numericAmount,
      isTx: true,
      timestamp: Date.now(),
      isRead: false,
    };
    db.addMessage(txMsg);

    // Notify recipient
    realtimeServer.sendToUser(recipient.id, {
      type: 'balance_update',
      newBalance: newRecipientBalance,
      transaction: recipientTx,
    });

    realtimeServer.sendToUser(recipient.id, {
      type: 'new_message',
      senderId,
      senderName: sender.username,
      senderInitials: sender.initials,
      senderColor: sender.avatarColor,
      message: {
        id: txMsg.id,
        from: 'contact',
        text: txMsg.text,
        amount: numericAmount,
        tx: true,
        timestamp: txMsg.timestamp,
      },
    });

    res.json({
      success: true,
      newBalance: newSenderBalance,
      transaction: senderTx,
    });
  });

  // Media Upload
  app.post('/api/media/upload', authenticateToken, uploadMediaHandler);

  // AI Assistant Chat
  app.post('/api/ai/chat', authenticateToken, aiChatHandler);

  // News Feed API
  app.get('/api/news', (req, res) => {
    let currentUserId: string | null = null;
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        currentUserId = decoded.id;
      } catch {}
    }

    const rawNews = db.getNews();
    const formatted = rawNews
      .filter((n) => {
        // System news (e.g. no userId or official admin) -> visible to everyone
        if (!n.userId) return true;
        const authorUser = db.getUserById(n.userId);
        if (authorUser && (authorUser.role === 'admin' || authorUser.role === 'sysadmin')) return true;

        // Author sees own news
        if (currentUserId && n.userId === currentUserId) return true;

        // Must be follower of author to see author's posts
        const isFollower = currentUserId ? (authorUser?.followers || []).includes(currentUserId) : false;
        if (!isFollower) return false;

        // Check target groups
        if (n.targetGroups && n.targetGroups.length > 0 && n.audience === 'groups') {
          if (!currentUserId || !authorUser?.followerGroups) return false;
          const isInTargetGroup = authorUser.followerGroups.some(
            (g) => n.targetGroups!.includes(g.id) && (g.memberIds || []).includes(currentUserId!)
          );
          return isInTargetGroup;
        }

        return true;
      })
      .map((n) => {
        const u = n.userId ? db.getUserById(n.userId) : null;
        return {
          id: n.id,
          userId: n.userId,
          authorName: n.authorName || (u ? u.username : 'ORBIT News'),
          authorHandle: n.authorHandle || (u ? u.handle : '@orbit'),
          authorAvatar: n.authorAvatar || u?.avatarUrl,
          tag: n.tag || 'NEW',
          title: n.title,
          timestamp: n.timestamp,
          accent: n.accent || 'from-sky-500 to-indigo-500',
          content: n.content,
          mediaUrl: n.mediaUrl,
          mediaType: n.mediaType || 'image',
          likesCount: (n.likes || []).length,
          userLiked: currentUserId ? (n.likes || []).includes(currentUserId) : false,
          commentsCount: (n.comments || []).length,
          comments: n.comments || [],
          sharesCount: n.sharesCount || 0,
          audience: n.audience || 'everyone',
          targetGroups: n.targetGroups || [],
        };
      });

    res.json(formatted);
  });

  app.post('/api/news', authenticateToken, (req: AuthenticatedRequest, res) => {
    const currentUserId = req.user!.id;
    const user = db.getUserById(currentUserId);
    const { title, content, tag, accent, mediaUrl, mediaType, audience, targetGroups } = req.body;

    const rawTitle = (title || '').trim();
    const rawContent = (content || '').trim();

    if (!rawTitle && !rawContent) {
      res.status(400).json({ error: 'Укажите заголовок или текст новости' });
      return;
    }

    const finalTitle = rawTitle;
    const finalContent = rawContent;

    const newsItem: any = {
      id: `news_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: currentUserId,
      authorName: user ? user.username : 'Пользователь',
      authorHandle: user ? user.handle : '@user',
      authorAvatar: user?.avatarUrl,
      title: finalTitle,
      content: finalContent,
      tag: tag || 'ПОСТ',
      accent: accent || 'from-sky-500 to-blue-600',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      mediaUrl,
      mediaType: mediaType || 'image',
      likes: [],
      comments: [],
      sharesCount: 0,
      audience: audience || 'everyone',
      targetGroups: Array.isArray(targetGroups) ? targetGroups : [],
    };

    db.addNews(newsItem);

    const formatted = {
      id: newsItem.id,
      userId: newsItem.userId,
      authorName: newsItem.authorName,
      authorHandle: newsItem.authorHandle,
      authorAvatar: newsItem.authorAvatar,
      title: newsItem.title,
      content: newsItem.content,
      tag: newsItem.tag,
      timestamp: newsItem.timestamp,
      accent: newsItem.accent,
      mediaUrl: newsItem.mediaUrl,
      mediaType: newsItem.mediaType,
      likesCount: 0,
      userLiked: false,
      commentsCount: 0,
      comments: [],
      sharesCount: 0,
    };

    res.status(201).json(formatted);

    realtimeServer.broadcast({
      type: 'new_news',
      news: formatted,
    });
  });

  app.put('/api/news/:id', authenticateToken, (req: AuthenticatedRequest, res) => {
    const currentUserId = req.user!.id;
    const { title, content, mediaUrl, tag, mediaType } = req.body;
    const updated = db.updateNews(req.params.id, currentUserId, {
      title: title ? title.trim() : undefined,
      content: content ? content.trim() : undefined,
      mediaUrl,
      tag,
      mediaType,
    });
    if (updated) {
      const formatted = {
        id: updated.id,
        userId: updated.userId,
        authorName: updated.authorName,
        authorHandle: updated.authorHandle,
        authorAvatar: updated.authorAvatar,
        title: updated.title,
        content: updated.content,
        tag: updated.tag,
        timestamp: updated.timestamp,
        accent: updated.accent,
        mediaUrl: updated.mediaUrl,
        mediaType: updated.mediaType,
        likesCount: (updated.likes || []).length,
        userLiked: (updated.likes || []).includes(currentUserId),
        commentsCount: (updated.comments || []).length,
        comments: updated.comments || [],
        sharesCount: updated.sharesCount || 0,
      };

      res.json({ success: true, news: formatted });

      realtimeServer.broadcast({
        type: 'news_updated',
        news: formatted,
      });
    } else {
      res.status(403).json({ error: 'Не удалось обновить новость' });
    }
  });

  app.delete('/api/news/:id', authenticateToken, (req: AuthenticatedRequest, res) => {
    const currentUserId = req.user!.id;
    const newsId = req.params.id;
    const ok = db.deleteNews(newsId, currentUserId);
    if (ok) {
      res.json({ success: true, message: 'Новость успешно удалена' });
      realtimeServer.broadcast({
        type: 'news_deleted',
        newsId,
      });
    } else {
      res.status(403).json({ error: 'Не удалось удалить новость' });
    }
  });

  app.post('/api/news/:id/like', authenticateToken, reactionAntiCheat, (req: AuthenticatedRequest, res) => {
    const currentUserId = req.user!.id;
    const result = db.toggleNewsLike(req.params.id, currentUserId);
    if (result) {
      res.json({ success: true, ...result });
    } else {
      res.status(404).json({ error: 'Новость не найдена' });
    }
  });

  app.post('/api/news/:id/report', authenticateToken, (req: AuthenticatedRequest, res) => {
    const currentUserId = req.user!.id;
    const news = db.getNewsById(req.params.id);
    if (!news) {
      res.status(404).json({ error: 'Новость не найдена' });
      return;
    }
    const { reason, comment } = req.body;
    db.addReport({
      id: `report_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      reporterId: currentUserId,
      targetUserId: news.userId || 'system',
      reason: reason || 'Жалоба на новость',
      comment: comment || news.title,
      timestamp: Date.now(),
    });
    res.json({ success: true, message: 'Жалоба отправлена на рассмотрение модераторам' });
  });

  app.post('/api/users/:targetUserId/block', authenticateToken, (req: AuthenticatedRequest, res) => {
    const currentUserId = req.user!.id;
    const { targetUserId } = req.params;
    if (currentUserId === targetUserId) {
      res.status(400).json({ error: 'Нельзя заблокировать самого себя' });
      return;
    }
    db.blockUser(currentUserId, targetUserId);
    res.json({ success: true, message: 'Пользователь заблокирован' });
  });

  app.post('/api/news/:id/comment', authenticateToken, (req: AuthenticatedRequest, res) => {
    const currentUserId = req.user!.id;
    const user = db.getUserById(currentUserId);
    const { text } = req.body;
    if (!text || !text.trim()) {
      res.status(400).json({ error: 'Текст комментария пуст' });
      return;
    }
    const commentItem = {
      id: `nc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: currentUserId,
      userName: user ? user.username : 'Пользователь',
      userAvatar: user?.avatarUrl,
      text: text.trim(),
      timestamp: Date.now(),
    };
    const comment = db.addNewsComment(req.params.id, commentItem);
    if (comment) {
      res.json({ success: true, comment });
    } else {
      res.status(404).json({ error: 'Новость не найдена' });
    }
  });

  // Channels & Groups API
  app.get('/api/channels-groups', authenticateToken, (req: AuthenticatedRequest, res) => {
    const currentUserId = req.user!.id;
    const items = db.getChannelGroupsForUser(currentUserId);
    res.json(items);
  });

  app.post('/api/channels-groups', authenticateToken, (req: AuthenticatedRequest, res) => {
    const currentUserId = req.user!.id;
    const { type, title, description, handle, avatarUrl, avatarColor } = req.body;

    if (!title || !title.trim()) {
      res.status(400).json({ error: 'Укажите название канала или группы' });
      return;
    }

    const cleanTitle = title.trim();
    const cleanHandle = (handle || '').trim().replace(/^@/, '');

    // Check for existing channel or group with identical title or handle created by this user
    const existing = db.getChannelsGroups().find((cg) => {
      if (cg.creatorId !== currentUserId) return false;
      const sameTitle = cg.title.toLowerCase() === cleanTitle.toLowerCase();
      const sameHandle = cleanHandle && cg.handle.toLowerCase().replace(/^@/, '') === cleanHandle.toLowerCase();
      return sameTitle || sameHandle;
    });

    if (existing) {
      res.status(200).json(existing);
      return;
    }

    const uniqueSlug = cleanHandle || `cg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const inviteLink = `https://t.me/${uniqueSlug}`;

    const newGroupChannel: any = {
      id: `cg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: type || 'public_channel',
      title: cleanTitle,
      handle: `@${uniqueSlug}`,
      description: (description || '').trim(),
      avatarUrl,
      avatarColor: avatarColor || 'from-sky-400 to-indigo-500',
      creatorId: currentUserId,
      adminIds: [currentUserId],
      memberIds: [currentUserId],
      createdAt: Date.now(),
      inviteLink,
    };

    db.addChannelGroup(newGroupChannel);
    realtimeServer.broadcast({
      type: 'channel_group_created',
      channelGroup: newGroupChannel,
    });
    res.status(201).json(newGroupChannel);
  });

  app.get('/api/channels-groups/search', authenticateToken, (req: AuthenticatedRequest, res) => {
    const query = (req.query.q as string || '').toLowerCase().trim();
    const currentUserId = req.user!.id;

    const allCG = db.getChannelsGroups();
    const openCG = allCG.filter((cg) => cg.type === 'public_channel' || cg.type === 'public_group');

    if (!query) {
      res.json(openCG.map((cg) => ({
        ...cg,
        isMember: (cg.memberIds || []).includes(currentUserId),
      })));
      return;
    }

    const matches = openCG.filter((cg) =>
      cg.title.toLowerCase().includes(query) ||
      cg.handle.toLowerCase().includes(query) ||
      (cg.description && cg.description.toLowerCase().includes(query))
    ).map((cg) => ({
      ...cg,
      isMember: (cg.memberIds || []).includes(currentUserId),
    }));

    res.json(matches);
  });

  app.get('/api/channels-groups/:id', authenticateToken, (req: AuthenticatedRequest, res) => {
    const cg = db.getChannelGroupById(req.params.id);
    if (!cg) {
      res.status(404).json({ error: 'Канал или группа не найдена' });
      return;
    }

    const members = (cg.memberIds || []).map((mId) => {
      const u = db.getUserById(mId);
      let roleInGroup: 'creator' | 'admin' | 'moderator' | 'member' = 'member';
      if (mId === cg.creatorId) roleInGroup = 'creator';
      else if ((cg.adminIds || []).includes(mId)) roleInGroup = 'admin';
      else if ((cg.moderatorIds || []).includes(mId)) roleInGroup = 'moderator';

      return {
        id: mId,
        username: u ? u.username : 'Пользователь',
        handle: u ? u.handle : '@user',
        initials: u ? u.initials : 'U',
        avatarColor: u ? u.avatarColor : 'from-sky-400 to-indigo-500',
        avatarUrl: u ? u.avatarUrl : undefined,
        roleInGroup,
      };
    });

    res.json({ ...cg, members });
  });

  app.put('/api/channels-groups/:id', authenticateToken, (req: AuthenticatedRequest, res) => {
    const currentUserId = req.user!.id;
    const cg = db.getChannelGroupById(req.params.id);
    if (!cg) {
      res.status(404).json({ error: 'Канал или группа не найдена' });
      return;
    }

    const currentUser = db.getUserById(currentUserId);
    const userRole = currentUser ? db.getUserRole(currentUser) : 'user';
    const isSysAdmin = ['admin', 'sysadmin'].includes(userRole);
    const isCreator = cg.creatorId === currentUserId;
    const isAdmin = (cg.adminIds || []).includes(currentUserId);

    if (!isCreator && !isAdmin && !isSysAdmin) {
      res.status(403).json({ error: 'У вас нет прав для изменения настроек этого канала/группы' });
      return;
    }

    const { title, description, handle, type, allowCalls, slowMode, signPosts, avatarUrl, avatarColor, allowedReactions, disableReactions, disableComments, disableForwarding, bgPattern, bgOpacity, bgAdaptTheme, bgImageUrl } = req.body;
    const updates: any = {};

    if (title) updates.title = title.trim();
    if (description !== undefined) updates.description = description.trim();
    if (handle) {
      const cleanHandle = handle.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
      updates.handle = `@${cleanHandle}`;
    }
    if (type) updates.type = type;
    if (allowCalls !== undefined) updates.allowCalls = allowCalls;
    if (slowMode !== undefined) updates.slowMode = Number(slowMode);
    if (signPosts !== undefined) updates.signPosts = signPosts;
    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
    if (avatarColor) updates.avatarColor = avatarColor;
    if (allowedReactions !== undefined) updates.allowedReactions = allowedReactions;
    if (disableReactions !== undefined) updates.disableReactions = disableReactions;
    if (disableComments !== undefined) updates.disableComments = disableComments;
    if (disableForwarding !== undefined) updates.disableForwarding = disableForwarding;
    if (bgPattern !== undefined) updates.bgPattern = bgPattern;
    if (bgOpacity !== undefined) updates.bgOpacity = bgOpacity;
    if (bgAdaptTheme !== undefined) updates.bgAdaptTheme = bgAdaptTheme;
    if (bgImageUrl !== undefined) updates.bgImageUrl = bgImageUrl;

    const updated = db.updateChannelGroup(req.params.id, updates);
    realtimeServer.broadcast({ type: 'channel_group_updated', channelGroup: updated });
    res.json({ success: true, channelGroup: updated });
  });

  app.delete('/api/channels-groups/:id', authenticateToken, (req: AuthenticatedRequest, res) => {
    const currentUserId = req.user!.id;
    const cg = db.getChannelGroupById(req.params.id);
    if (!cg) {
      res.status(404).json({ error: 'Канал или группа не найдена' });
      return;
    }

    const currentUser = db.getUserById(currentUserId);
    const userRole = currentUser ? db.getUserRole(currentUser) : 'user';
    const isSysAdmin = ['admin', 'sysadmin'].includes(userRole);
    const isCreator = cg.creatorId === currentUserId;
    const isAdmin = (cg.adminIds || []).includes(currentUserId);

    if (!isCreator && !isAdmin && !isSysAdmin) {
      res.status(403).json({ error: 'Только создатель или администратор может удалить данный канал/группу' });
      return;
    }

    const ok = db.deleteChannelGroup(req.params.id);
    if (ok) {
      realtimeServer.broadcast({ type: 'channel_group_deleted', id: req.params.id });
      res.json({ success: true, message: 'Канал / группа успешно удалена' });
    } else {
      res.status(500).json({ error: 'Не удалось удалить канал/группу' });
    }
  });

  app.post('/api/channels-groups/:id/toggle-admin', authenticateToken, (req: AuthenticatedRequest, res) => {
    const currentUserId = req.user!.id;
    const cg = db.getChannelGroupById(req.params.id);
    if (!cg) {
      res.status(404).json({ error: 'Канал или группа не найдена' });
      return;
    }

    if (cg.creatorId !== currentUserId) {
      res.status(403).json({ error: 'Только владелец канала/группы может назначить администраторов' });
      return;
    }

    const { targetUserId } = req.body;
    const updated = db.toggleChannelGroupAdmin(req.params.id, targetUserId);
    realtimeServer.broadcast({ type: 'channel_group_updated', channelGroup: updated });
    res.json({ success: true, channelGroup: updated });
  });

  app.post('/api/channels-groups/:id/toggle-moderator', authenticateToken, (req: AuthenticatedRequest, res) => {
    const currentUserId = req.user!.id;
    const cg = db.getChannelGroupById(req.params.id);
    if (!cg) {
      res.status(404).json({ error: 'Канал или группа не найдена' });
      return;
    }

    const isCreator = cg.creatorId === currentUserId;
    const isAdmin = (cg.adminIds || []).includes(currentUserId);
    if (!isCreator && !isAdmin) {
      res.status(403).json({ error: 'Только администраторы могут назначать модераторов' });
      return;
    }

    const { targetUserId } = req.body;
    const updated = db.toggleChannelGroupModerator(req.params.id, targetUserId);
    realtimeServer.broadcast({ type: 'channel_group_updated', channelGroup: updated });
    res.json({ success: true, channelGroup: updated });
  });

  app.post('/api/channels-groups/:id/kick', authenticateToken, (req: AuthenticatedRequest, res) => {
    const currentUserId = req.user!.id;
    const cg = db.getChannelGroupById(req.params.id);
    if (!cg) {
      res.status(404).json({ error: 'Канал или группа не найдена' });
      return;
    }

    const isCreator = cg.creatorId === currentUserId;
    const isAdmin = (cg.adminIds || []).includes(currentUserId);
    if (!isCreator && !isAdmin) {
      res.status(403).json({ error: 'У вас нет прав для исключения участников' });
      return;
    }

    const { targetUserId } = req.body;
    if (targetUserId === cg.creatorId) {
      res.status(400).json({ error: 'Нельзя исключить владельца группы' });
      return;
    }

    db.leaveChannelGroup(req.params.id, targetUserId);
    const updated = db.getChannelGroupById(req.params.id);
    realtimeServer.broadcast({ type: 'channel_group_updated', channelGroup: updated });
    res.json({ success: true, channelGroup: updated });
  });

  app.post('/api/channels-groups/:id/join', authenticateToken, (req: AuthenticatedRequest, res) => {
    const currentUserId = req.user!.id;
    const item = db.joinChannelGroup(req.params.id, currentUserId);
    if (item) {
      realtimeServer.broadcast({ type: 'channel_group_updated', channelGroup: item });
      res.json({ success: true, channelGroup: item });
    } else {
      res.status(404).json({ error: 'Канал или группа не найдена' });
    }
  });

  app.post('/api/channels-groups/:id/invite', authenticateToken, (req: AuthenticatedRequest, res) => {
    const currentUserId = req.user!.id;
    const inviter = db.getUserById(currentUserId);
    const cg = db.getChannelGroupById(req.params.id);
    if (!cg) {
      res.status(404).json({ error: 'Канал или группа не найдена' });
      return;
    }

    const isCreator = cg.creatorId === currentUserId;
    const isAdmin = (cg.adminIds || []).includes(currentUserId);
    const isModerator = (cg.moderatorIds || []).includes(currentUserId);

    if (!isCreator && !isAdmin && !isModerator) {
      res.status(403).json({ error: 'У вас нет прав для приглашения участников' });
      return;
    }

    const { targetUserId, search } = req.body;
    let targetUser = targetUserId ? db.getUserById(targetUserId) : null;

    if (!targetUser && search) {
      const cleanSearch = search.trim().toLowerCase();
      const allUsers = db.getUsers();
      targetUser = allUsers.find(
        (u) =>
          u.id === cleanSearch ||
          u.username.toLowerCase().includes(cleanSearch) ||
          u.handle.toLowerCase().includes(cleanSearch) ||
          (u.phone && u.phone.includes(cleanSearch))
      ) || null;
    }

    if (!targetUser) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }

    // Join the user to channel/group automatically
    db.joinChannelGroup(cg.id, targetUser.id);

    // Save invitation record
    if (!cg.invitations) cg.invitations = {};
    const inviterName = inviter ? inviter.username : 'Пользователь';
    cg.invitations[targetUser.id] = {
      inviterId: currentUserId,
      inviterName,
      timestamp: Date.now(),
    };
    db.updateChannelGroup(cg.id, { invitations: cg.invitations });

    const updated = db.getChannelGroupById(cg.id);
    realtimeServer.broadcast({ type: 'channel_group_updated', channelGroup: updated });

    res.json({
      success: true,
      message: `Пользователь ${targetUser.username} успешно добавлен в ${cg.type.includes('channel') ? 'канал' : 'группу'}`,
      channelGroup: updated,
      user: {
        id: targetUser.id,
        username: targetUser.username,
        handle: targetUser.handle,
      },
    });
  });

  app.post('/api/channels-groups/:id/leave', authenticateToken, (req: AuthenticatedRequest, res) => {
    const currentUserId = req.user!.id;
    const ok = db.leaveChannelGroup(req.params.id, currentUserId);
    if (ok) {
      const updated = db.getChannelGroupById(req.params.id);
      realtimeServer.broadcast({ type: 'channel_group_updated', channelGroup: updated });
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Не удалось покинуть группу/канал' });
    }
  });

  app.get('/api/channels-groups/:id/analytics', authenticateToken, (req: AuthenticatedRequest, res) => {
    const cg = db.getChannelGroupById(req.params.id);
    if (!cg) {
      res.status(404).json({ error: 'Канал не найден' });
      return;
    }

    const currentUserId = req.user!.id;
    const currentUserObj = db.getUserById(currentUserId);
    const isCreator = cg.creatorId === currentUserId;
    const isAdmin = (cg.adminIds || []).includes(currentUserId);
    const isModerator = (cg.moderatorIds || []).includes(currentUserId);
    const isSysAdmin = currentUserObj?.role === 'admin' || currentUserObj?.role === 'sysadmin';

    if (!isCreator && !isAdmin && !isModerator && !isSysAdmin) {
      res.status(403).json({ error: 'Доступ к аналитике ограничен администраторами' });
      return;
    }

    const timeframe = (req.query.timeframe as string) || '30d';
    const days = timeframe === '7d' ? 7 : timeframe === '90d' ? 90 : 30;

    const memberCount = (cg.memberIds || []).length;
    const trend = [];
    const eng = [];
    let baseSubs = Math.max(12, memberCount * 25);
    const now = new Date();

    for (let i = days; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' });
      const joined = Math.floor(Math.random() * 12) + 2;
      const left = Math.floor(Math.random() * 3);
      baseSubs += (joined - left);
      trend.push({ date: dateStr, subscribers: baseSubs, joined, left });

      const views = Math.floor(baseSubs * (0.35 + Math.random() * 0.25));
      const reactions = Math.floor(views * (0.10 + Math.random() * 0.08));
      const comments = Math.floor(reactions * (0.2 + Math.random() * 0.15));
      const shares = Math.floor(reactions * 0.12);
      eng.push({ date: dateStr, views, reactions, comments, shares });
    }

    const hourly = Array.from({ length: 24 }, (_, h) => {
      const hourStr = `${h.toString().padStart(2, '0')}:00`;
      const activeUsers = Math.floor(10 + Math.sin((h - 6) / 3) * 45 + Math.random() * 15);
      return { hour: hourStr, activeUsers: Math.max(5, activeUsers), engagementRate: Number((5 + Math.random() * 5).toFixed(1)) };
    });

    res.json({
      summary: {
        totalSubscribers: baseSubs,
        subscriberGrowthNet: Math.floor(days * 4.5),
        subscriberGrowthPct: Number((12 + days * 0.2).toFixed(1)),
        totalViews: Math.floor(baseSubs * 8.5),
        viewsGrowthPct: 15.4,
        engagementRate: 9.2,
        avgReactionsPerPost: 54,
        totalPosts: Math.floor(days * 1.2),
        reachRate: 78.5,
      },
      subscriberGrowthTrend: trend,
      engagementMetrics: eng,
      hourlyActivity: hourly,
      interactionBreakdown: [
        { name: 'Реакции ❤️/🔥', value: 62, color: '#f43f5e' },
        { name: 'Комментарии 💬', value: 22, color: '#38bdf8' },
        { name: 'Репосты 🔄', value: 11, color: '#10b981' },
        { name: 'Переходы 🔗', value: 5, color: '#a855f7' },
      ],
      topPosts: [
        { id: '1', title: `🔥 Эксклюзивный контент: ${cg.title}`, date: 'Вчера', views: Math.floor(baseSubs * 0.9), reactions: 168, comments: 42 },
        { id: '2', title: '💡 Ответы на вопросы подписчиков', date: '3 дня назад', views: Math.floor(baseSubs * 0.75), reactions: 124, comments: 31 },
        { id: '3', title: '📌 Важное объявление администрации', date: '5 дней назад', views: Math.floor(baseSubs * 0.6), reactions: 92, comments: 18 },
      ],
    });
  });

  // User Profile Updates
  app.put('/api/users/profile', authenticateToken, (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    const { username, firstName, lastName, handle, phone, avatarUrl, country, language, isEmailVerified } = req.body;

    const updates: any = {};
    if (username) {
      updates.username = username.trim();
      const parts = username.trim().split(' ');
      updates.initials = parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : username.substring(0, 2).toUpperCase();
    }
    if (firstName !== undefined) updates.firstName = firstName.trim();
    if (lastName !== undefined) updates.lastName = lastName.trim();

    // If firstName/lastName updated but no explicit username passed, construct full username
    if ((firstName !== undefined || lastName !== undefined) && !username) {
      const currentUserInDb = db.getUserById(userId);
      const fName = updates.firstName !== undefined ? updates.firstName : (currentUserInDb?.firstName || '');
      const lName = updates.lastName !== undefined ? updates.lastName : (currentUserInDb?.lastName || '');
      const fullName = `${fName} ${lName}`.trim();
      if (fullName) {
        updates.username = fullName;
        const parts = fullName.split(' ');
        updates.initials = parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : fullName.substring(0, 2).toUpperCase();
      }
    }

    if (handle) {
      const handleVal = validateNicknameServer(handle);
      if (!handleVal.isValid) {
        res.status(400).json({ error: handleVal.error });
        return;
      }
      const formattedHandle = handleVal.formattedHandle!;
      const existing = db.getUserByHandle(formattedHandle);
      if (existing && existing.id !== userId) {
        res.status(400).json({ error: 'Этот никнейм уже занят' });
        return;
      }
      updates.handle = formattedHandle;
    }
    if (phone) {
      let cleanPhone = phone.trim().replace(/[^\d+]/g, '');
      if (cleanPhone.startsWith('8') && cleanPhone.length === 11) {
        cleanPhone = '+7' + cleanPhone.substring(1);
      } else if (cleanPhone.length === 10 && !cleanPhone.startsWith('+')) {
        cleanPhone = '+7' + cleanPhone;
      }
      const existing = db.getUserByPhone(cleanPhone);
      if (existing && existing.id !== userId) {
        res.status(400).json({ error: 'Этот номер уже используется другим профилем' });
        return;
      }
      updates.phone = cleanPhone;
    }
    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
    if (country !== undefined) updates.country = country;
    if (language !== undefined) updates.language = language;
    if (isEmailVerified !== undefined) updates.isEmailVerified = isEmailVerified;

    const updatedUser = db.updateUserProfile(userId, updates);
    if (!updatedUser) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }

    db.addAuditLog(
      userId,
      updatedUser.username,
      'ОБНОВЛЕНИЕ_ПРОФИЛЯ',
      `Обновлен профиль (${Object.keys(updates).join(', ')})`
    );

    const { passwordHash: _, ...safeUser } = updatedUser;
    safeUser.role = db.getUserRole(updatedUser);

    // Broadcast profile update to all clients in real-time
    realtimeServer.broadcast({
      type: 'user_updated',
      user: safeUser,
    });

    res.json({ user: safeUser });
  });

  // Follow / Unfollow User API
  app.post('/api/users/:targetUserId/follow', authenticateToken, (req: AuthenticatedRequest, res) => {
    const followerId = req.user!.id;
    const { targetUserId } = req.params;
    if (followerId === targetUserId) {
      res.status(400).json({ error: 'Нельзя подписаться на самого себя' });
      return;
    }
    db.followUser(followerId, targetUserId);
    res.json({ success: true, message: 'Вы успешно подписались' });
  });

  app.post('/api/users/:targetUserId/unfollow', authenticateToken, (req: AuthenticatedRequest, res) => {
    const followerId = req.user!.id;
    const { targetUserId } = req.params;
    db.unfollowUser(followerId, targetUserId);
    res.json({ success: true, message: 'Вы отписались' });
  });

  // Get User Public Profile & Shared Media Collage
  app.get('/api/users/:targetUserId/profile', authenticateToken, (req: AuthenticatedRequest, res) => {
    const currentUserId = req.user!.id;
    const { targetUserId } = req.params;

    const user = db.getUserById(targetUserId);
    if (!user) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }

    const isFollowing = (db.getUserById(currentUserId)?.following || []).includes(targetUserId);
    const isFollower = (user.following || []).includes(currentUserId);

    // Get all messages exchanged between current user and target user to construct shared media collage
    const messages = db.getMessagesBetween(currentUserId, targetUserId, 500);

    const sharedMedia = messages
      .filter((m) => m.mediaUrl || m.text.includes('http'))
      .map((m) => {
        let type: 'media' | 'audio' | 'document' | 'link' = 'media';
        if (m.mediaType === 'audio' || m.mediaType === 'video_circle') type = 'audio';
        else if (m.mediaType === 'file') type = 'document';
        else if (m.text.includes('http')) type = 'link';

        return {
          id: m.id,
          type,
          url: m.mediaUrl || m.text,
          name: m.text || 'Вложение',
          timestamp: m.timestamp,
        };
      });

    res.json({
      id: user.id,
      username: user.username,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      handle: user.handle,
      initials: user.initials,
      avatarColor: user.avatarColor,
      avatarUrl: user.avatarUrl,
      phone: user.phone || '',
      isOnline: realtimeServer.isUserOnline(user.id),
      followersCount: (user.followers || []).length,
      followingCount: (user.following || []).length,
      isFollowing,
      isFollower,
      sharedMedia,
    });
  });

  // Follower Groups API
  app.get('/api/follower-groups', authenticateToken, (req: AuthenticatedRequest, res) => {
    const user = db.getUserById(req.user!.id);
    res.json(user?.followerGroups || []);
  });

  app.post('/api/follower-groups', authenticateToken, (req: AuthenticatedRequest, res) => {
    const user = db.getUserById(req.user!.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    const { name, memberIds } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Укажите название группы' });

    if (!user.followerGroups) user.followerGroups = [];
    const group = {
      id: `fg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      memberIds: Array.isArray(memberIds) ? memberIds : [],
    };
    user.followerGroups.push(group);
    db.updateUserProfile(user.id, { followerGroups: user.followerGroups });
    res.json({ success: true, group });
  });

  app.put('/api/follower-groups/:id', authenticateToken, (req: AuthenticatedRequest, res) => {
    const user = db.getUserById(req.user!.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    const groupId = req.params.id;
    const { name, memberIds } = req.body;

    if (!user.followerGroups) user.followerGroups = [];
    const idx = user.followerGroups.findIndex((g) => g.id === groupId);
    if (idx === -1) return res.status(404).json({ error: 'Группа не найдена' });

    if (name) user.followerGroups[idx].name = name.trim();
    if (Array.isArray(memberIds)) user.followerGroups[idx].memberIds = memberIds;

    db.updateUserProfile(user.id, { followerGroups: user.followerGroups });
    res.json({ success: true, group: user.followerGroups[idx] });
  });

  app.delete('/api/follower-groups/:id', authenticateToken, (req: AuthenticatedRequest, res) => {
    const user = db.getUserById(req.user!.id);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    const groupId = req.params.id;

    if (user.followerGroups) {
      user.followerGroups = user.followerGroups.filter((g) => g.id !== groupId);
      db.updateUserProfile(user.id, { followerGroups: user.followerGroups });
    }
    res.json({ success: true });
  });

  // Stories API
  app.get('/api/stories', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    let currentUserId: string | null = null;

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        if (decoded?.id) {
          currentUserId = decoded.id;
        }
      } catch {}
    }

    const allStories = db.getStories();
    const allowedStories = allStories
      .filter((s) => {
        // Author always sees own story
        if (currentUserId && s.userId === currentUserId) return true;

        const authorUser = db.getUserById(s.userId);
        if (!authorUser) return false;

        // Is current user following the story author?
        const isFollower = currentUserId ? (authorUser.followers || []).includes(currentUserId) : false;

        // User posts are only visible to followers!
        if (!isFollower) return false;

        // Check if targeted to specific follower groups
        if (s.targetGroups && s.targetGroups.length > 0 && (s.audience === 'groups' || (s.audience as string) === 'close_friends')) {
          if (!currentUserId || !authorUser.followerGroups) return false;
          const isInGroup = authorUser.followerGroups.some(
            (g) => s.targetGroups!.includes(g.id) && (g.memberIds || []).includes(currentUserId!)
          );
          return isInGroup;
        }

        return true;
      })
      .map((s) => {
        const u = db.getUserById(s.userId);
        return {
          id: s.id,
          userId: s.userId,
          userName: u ? u.username : 'Пользователь',
          userAvatar: u?.avatarUrl,
          userColor: u?.avatarColor || 'from-sky-300 to-indigo-200',
          userInitials: u?.initials || 'U',
          mediaUrl: s.mediaUrl,
          slides: s.slides || [s.mediaUrl],
          caption: s.caption || '',
          timestamp: s.timestamp,
          viewed: currentUserId ? (s.viewedBy || []).includes(currentUserId) : false,
          audience: s.audience || 'everyone',
          targetGroups: s.targetGroups || [],
          hideComments: !!s.hideComments,
          hideReactions: !!s.hideReactions,
          allowedReactions: s.allowedReactions || ['❤️', '🔥', '👏', '😍', '😂', '😮'],
          reactions: s.reactions || [],
          comments: s.comments || [],
        };
      });

    res.json(allowedStories);
  });

  app.post('/api/stories', authenticateToken, (req: AuthenticatedRequest, res) => {
    const currentUserId = req.user!.id;
    const { mediaUrl, slides, caption, audience, targetGroups, hideComments, hideReactions, allowedReactions } = req.body;
    if (!mediaUrl && (!slides || slides.length === 0)) {
      res.status(400).json({ error: 'Укажите изображение или слайды для истории' });
      return;
    }

    const primaryUrl = mediaUrl || (slides && slides[0]) || '';

    const story: any = {
      id: `story_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: currentUserId,
      mediaUrl: primaryUrl,
      slides: slides && slides.length > 0 ? slides : [primaryUrl],
      caption: caption || '',
      timestamp: Date.now(),
      viewedBy: [currentUserId],
      audience: audience || 'everyone',
      targetGroups: Array.isArray(targetGroups) ? targetGroups : [],
      hideComments: !!hideComments,
      hideReactions: !!hideReactions,
      allowedReactions: allowedReactions || ['❤️', '🔥', '👏', '😍', '😂', '😮'],
      reactions: [],
      comments: [],
    };

    db.addStory(story);

    const currentUser = db.getUserById(currentUserId);
    if (currentUser) {
      db.addAuditLog(currentUser.id, currentUser.username, 'ИСТОРИЯ', `Опубликована новая история (${story.caption || 'без подписи'})`);
    }
    const formattedStory = {
      id: story.id,
      userId: story.userId,
      userName: currentUser ? currentUser.username : 'Пользователь',
      userAvatar: currentUser?.avatarUrl,
      userColor: currentUser?.avatarColor || 'from-sky-300 to-indigo-200',
      userInitials: currentUser?.initials || 'U',
      mediaUrl: story.mediaUrl,
      slides: story.slides,
      caption: story.caption,
      timestamp: story.timestamp,
      viewed: true,
      audience: story.audience,
      targetGroups: story.targetGroups,
      hideComments: story.hideComments,
      hideReactions: story.hideReactions,
      allowedReactions: story.allowedReactions,
      reactions: [],
      comments: [],
    };

    res.status(201).json(formattedStory);

    // Broadcast new story event via WebSocket
    realtimeServer.broadcast({
      type: 'new_story',
      story: formattedStory,
    });
  });

  app.put('/api/stories/:id', authenticateToken, (req: AuthenticatedRequest, res) => {
    const currentUserId = req.user!.id;
    const { caption, audience, hideComments, hideReactions, allowedReactions } = req.body;
    const updated = db.updateStory(req.params.id, currentUserId, {
      caption,
      audience,
      hideComments,
      hideReactions,
      allowedReactions,
    });
    if (updated) {
      realtimeServer.broadcast({
        type: 'story_updated',
        story: updated,
      });
      res.json({ success: true, story: updated });
    } else {
      res.status(403).json({ error: 'Не удалось обновить историю' });
    }
  });

  app.delete('/api/stories/:id', authenticateToken, (req: AuthenticatedRequest, res) => {
    const currentUserId = req.user!.id;
    const ok = db.deleteStory(req.params.id, currentUserId);
    if (ok) {
      realtimeServer.broadcast({
        type: 'story_deleted',
        storyId: req.params.id,
      });
      res.json({ success: true, message: 'История успешно удалена' });
    } else {
      res.status(403).json({ error: 'Не удалось удалить историю' });
    }
  });

  app.post('/api/stories/:id/react', authenticateToken, reactionAntiCheat, (req: AuthenticatedRequest, res) => {
    const currentUserId = req.user!.id;
    const { emoji } = req.body;
    if (!emoji) {
      res.status(400).json({ error: 'Не указана реакция' });
      return;
    }
    const story = db.getStoryById(req.params.id);
    if (!story) {
      res.status(404).json({ error: 'История не найдена' });
      return;
    }
    if (story.hideReactions) {
      res.status(400).json({ error: 'Реакции для этой истории отключены автором' });
      return;
    }

    const reactionItem = {
      id: `react_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      emoji,
      userId: currentUserId,
      timestamp: Date.now(),
    };

    db.addStoryReaction(req.params.id, reactionItem);
    res.json({ success: true, reaction: reactionItem });
  });

  app.post('/api/stories/:id/comment', authenticateToken, (req: AuthenticatedRequest, res) => {
    const currentUserId = req.user!.id;
    const currentUser = db.getUserById(currentUserId);
    const { text } = req.body;
    if (!text || !text.trim()) {
      res.status(400).json({ error: 'Текст комментария пуст' });
      return;
    }
    const story = db.getStoryById(req.params.id);
    if (!story) {
      res.status(404).json({ error: 'История не найдена' });
      return;
    }
    if (story.hideComments) {
      res.status(400).json({ error: 'Комментарии для этой истории отключены автором' });
      return;
    }

    const commentItem = {
      id: `comment_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: currentUserId,
      userName: currentUser ? currentUser.username : 'Пользователь',
      userAvatar: currentUser?.avatarUrl,
      text: text.trim(),
      timestamp: Date.now(),
    };

    db.addStoryComment(req.params.id, commentItem);
    res.json({ success: true, comment: commentItem });
  });

  app.post('/api/stories/:id/view', authenticateToken, (req: AuthenticatedRequest, res) => {
    const currentUserId = req.user!.id;
    db.markStoryViewed(req.params.id, currentUserId);
    res.json({ success: true });
  });

  // Notifications
  app.get('/api/notifications', authenticateToken, (req: AuthenticatedRequest, res) => {
    res.json(db.getNotifications(req.user!.id));
  });

  app.post('/api/notifications/:id/read', authenticateToken, (req: AuthenticatedRequest, res) => {
    db.markNotificationAsRead(req.user!.id, req.params.id);
    res.json({ success: true });
  });

  app.post('/api/notifications/clear', authenticateToken, (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    // Clear user notifications
    db.getNotifications(userId).forEach((n) => {
      n.isRead = true;
    });
    res.json({ success: true });
  });

  app.post('/api/notifications/mark-all-read', authenticateToken, (req: AuthenticatedRequest, res) => {
    const userId = req.user!.id;
    db.getNotifications(userId).forEach((n) => {
      n.isRead = true;
    });
    res.json({ success: true });
  });

  // --- VITE / STATIC SERVING ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Initialize Real-time WebSocket server
  realtimeServer.init(server);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`ORBIT Full-Stack Platform running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});

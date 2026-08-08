import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { db, DBUser } from './db.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'orbit_jwt_secret_super_key_2026_prod';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    username: string;
    handle: string;
    firstName?: string;
    lastName?: string;
  };
}

export function generateToken(user: DBUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      username: user.username,
      handle: user.handle,
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err || !decoded) {
      res.status(403).json({ error: 'Invalid or expired token' });
      return;
    }
    const decodedUser = decoded as AuthenticatedRequest['user'];
    if (decodedUser?.id) {
      const dbUser = db.getUserById(decodedUser.id);
      if (!dbUser) {
        res.status(403).json({ error: 'Пользователь не найден' });
        return;
      }
      if (dbUser.isBlocked) {
        res.status(403).json({ error: 'Ваш аккаунт заблокирован администрацией за нарушение правил' });
        return;
      }
    }
    req.user = decodedUser;
    next();
  });
}

// Controller handlers
const FAILED_LOGIN_LIMIT = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

const loginAttempts = new Map<string, { count: number; lockUntil: number }>();
const resetCodes = new Map<string, { code: string; expiresAt: number; attempts: number }>();
const resetRequests = new Map<string, { count: number; lockUntil: number }>();

export function validateNicknameServer(input: string): { isValid: boolean; error?: string; formattedHandle?: string } {
  if (!input) {
    return { isValid: false, error: 'Никнейм не может быть пустым' };
  }
  let clean = input.trim();
  if (clean.startsWith('@')) {
    clean = clean.slice(1);
  }
  if (!clean) {
    return { isValid: false, error: 'Никнейм не может состоять только из @' };
  }
  if (clean.length < 3) {
    return { isValid: false, error: 'Минимальная длина никнейма — 3 символа' };
  }
  if (clean.length > 24) {
    return { isValid: false, error: 'Максимальная длина никнейма — 24 символа' };
  }
  if (/\s/.test(clean)) {
    return { isValid: false, error: 'Никнейм не должен содержать пробелы' };
  }
  if (/[^\x00-\x7F]/.test(clean)) {
    return { isValid: false, error: 'Запрещены смайлы, стикеры, спецсимволы и кириллица. Используйте только латиницу (a-z)' };
  }
  if (!/^[a-zA-Z0-9_.]+$/.test(clean)) {
    return { isValid: false, error: 'Никнейм может содержать только латинские буквы (a-z), цифры (0-9), символы _ и .' };
  }
  if (/^[._]/.test(clean) || /[._]$/.test(clean)) {
    return { isValid: false, error: 'Никнейм не может начинаться или заканчиваться на точку или подчёркивание' };
  }
  if (/\.\.|\_\_|\.\_|\_\./.test(clean)) {
    return { isValid: false, error: 'Никнейм не может содержать несколько спецсимволов подряд' };
  }
  const lower = clean.toLowerCase();
  const forbiddenDomains = [
    'http', 'https', 'www', '.com', '.ru', '.org', '.net', '.io', '.xyz', '.app',
    '.dev', '.site', '.me', '.cc', '.info', '.biz', 't.me', 'vk.com', 'tg.me'
  ];
  for (const domain of forbiddenDomains) {
    if (lower.includes(domain)) {
      return { isValid: false, error: 'Запрещено использовать ссылки, домены и веб-адреса в никнейме' };
    }
  }
  return { isValid: true, formattedHandle: `@${lower}` };
}

export function registerHandler(req: Request, res: Response): void {
  try {
    const { username, email, password, phone, handle } = req.body;

    if (!username || !email || !password || !phone) {
      res.status(400).json({ error: 'Заполните все обязательные поля (Имя, Email, Пароль, Телефон)' });
      return;
    }

    // Phone normalization & validation
    let cleanPhone = (phone || '').trim().replace(/[^\d+]/g, '');
    if (cleanPhone.startsWith('8') && cleanPhone.length === 11) {
      cleanPhone = '+7' + cleanPhone.substring(1);
    } else if (cleanPhone.length === 10 && !cleanPhone.startsWith('+')) {
      cleanPhone = '+7' + cleanPhone;
    }

    if (cleanPhone.length < 10) {
      res.status(400).json({ error: 'Некорректный формат номера телефона' });
      return;
    }

    const existingPhone = db.getUserByPhone(cleanPhone);
    if (existingPhone) {
      res.status(400).json({ error: 'Пользователь с таким номером телефона уже зарегистрирован' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Пароль должен содержать не менее 8 символов' });
      return;
    }

    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      res.status(400).json({ error: 'Пароль должен содержать заглавные и строчные буквы, цифры и спецсимволы' });
      return;
    }

    const existingEmail = db.getUserByEmail(email);
    if (existingEmail) {
      res.status(400).json({ error: 'Пользователь с такой почтой уже существует' });
      return;
    }

    const rawHandle = handle ? handle.trim() : username.toLowerCase().replace(/\s+/g, '_');
    const handleVal = validateNicknameServer(rawHandle);
    if (!handleVal.isValid) {
      res.status(400).json({ error: handleVal.error });
      return;
    }
    const formattedHandle = handleVal.formattedHandle!;
    const existingHandle = db.getUserByHandle(formattedHandle);
    if (existingHandle) {
      res.status(400).json({ error: 'Этот никнейм уже занят' });
      return;
    }

    // Generate initials and color gradient
    const parts = username.trim().split(' ');
    const initials = parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : username.substring(0, 2).toUpperCase();
    
    const gradients = [
      'from-sky-300 to-cyan-200',
      'from-sky-300 to-indigo-200',
      'from-emerald-300 to-teal-200',
      'from-violet-300 to-indigo-200',
      'from-amber-300 to-orange-200',
      'from-pink-300 to-rose-200'
    ];
    const avatarColor = gradients[Math.floor(Math.random() * gradients.length)];

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    const newUser: DBUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      username: username.trim(),
      email: email.trim().toLowerCase(),
      phone: cleanPhone,
      passwordHash,
      avatarColor,
      initials,
      handle: formattedHandle,
      balance: 0.00, // Regular users start strictly with 0.00 ORB
      createdAt: new Date().toISOString()
    };

    db.createUser(newUser);
    const token = generateToken(newUser);

    const { passwordHash: _, ...safeUser } = newUser;
    // Log audit for registration
    db.addAuditLog(newUser.id, newUser.username, 'РЕГИСТРАЦИЯ', `Зарегистрирован пользователь ${newUser.email} (${newUser.phone || 'без телефона'})`);

    res.status(201).json({
      token,
      user: safeUser
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message || 'Ошибка регистрации на сервере' });
  }
}

export function loginHandler(req: Request, res: Response): void {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Укажите email, логин или номер телефона и пароль' });
      return;
    }

    const inputClean = email.trim();
    const normalizedEmail = inputClean.toLowerCase();
    const now = Date.now();

    // Check if account is locked due to too many failed attempts
    const lockInfo = loginAttempts.get(normalizedEmail);
    if (lockInfo && lockInfo.lockUntil > now) {
      const remainingMinutes = Math.ceil((lockInfo.lockUntil - now) / 60000);
      res.status(429).json({
        error: `Слишком много неудачных попыток входа. Доступ заблокирован на ${remainingMinutes} мин.`
      });
      return;
    }

    // Flexible multi-field lookup: email, handle, phone, username
    let user = db.getUserByEmail(normalizedEmail);
    if (!user) {
      const handleQuery = normalizedEmail.startsWith('@') ? normalizedEmail : `@${normalizedEmail}`;
      user = db.getUserByHandle(handleQuery);
    }
    if (!user) {
      user = db.getUserByPhone(inputClean);
    }
    if (!user) {
      user = db.getUsers().find((u) => u.username.toLowerCase() === normalizedEmail);
    }

    const passwordMatch = (user && user.passwordHash) ? bcrypt.compareSync(password, user.passwordHash) : false;

    if (!user || !passwordMatch) {
      const current = loginAttempts.get(normalizedEmail) || { count: 0, lockUntil: 0 };
      current.count += 1;

      if (current.count >= FAILED_LOGIN_LIMIT) {
        current.lockUntil = now + LOGIN_LOCKOUT_MS;
        current.count = 0;
        loginAttempts.set(normalizedEmail, current);
        db.addAuditLog(user?.id || 'guest', normalizedEmail, 'БЛОКИРОВКА_ВХОДА', `Превышено число попыток входа`);
        res.status(429).json({
          error: 'Превышено лимитированное количество попыток входа. Аккаунт заблокирован на 15 минут.'
        });
        return;
      }

      loginAttempts.set(normalizedEmail, current);
      const remainingAttempts = FAILED_LOGIN_LIMIT - current.count;

      res.status(401).json({
        error: `Неверные учетные данные. Осталось попыток: ${remainingAttempts}`
      });
      return;
    }

    // Reset login attempt counter on successful login
    loginAttempts.delete(normalizedEmail);

    const token = generateToken(user);
    const { passwordHash: _, ...safeUser } = user;
    safeUser.role = db.getUserRole(user);

    db.addAuditLog(user.id, user.username, 'АВТОРИЗАЦИЯ', `Успешный вход в аккаунт ${user.email}`);

    res.json({
      token,
      user: safeUser
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message || 'Ошибка входа на сервере' });
  }
}

export function requestPasswordResetHandler(req: Request, res: Response): void {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Введите адрес почты' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const now = Date.now();

    // Rate limiting for password reset requests
    const reqInfo = resetRequests.get(normalizedEmail) || { count: 0, lockUntil: 0 };
    if (reqInfo.lockUntil > now) {
      const remainingMinutes = Math.ceil((reqInfo.lockUntil - now) / 60000);
      res.status(429).json({
        error: `Превышен лимит запросов сброса. Попробуйте через ${remainingMinutes} мин.`
      });
      return;
    }

    reqInfo.count += 1;
    if (reqInfo.count > 3) {
      reqInfo.lockUntil = now + LOGIN_LOCKOUT_MS;
      reqInfo.count = 0;
      resetRequests.set(normalizedEmail, reqInfo);
      res.status(429).json({
        error: 'Слишком много запросов. Восстановление заблокировано на 15 минут.'
      });
      return;
    }
    resetRequests.set(normalizedEmail, reqInfo);

    const user = db.getUserByEmail(normalizedEmail);
    if (!user) {
      res.status(400).json({ error: 'Пользователь с такой почтой не найден' });
      return;
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    resetCodes.set(normalizedEmail, {
      code,
      expiresAt: now + 10 * 60 * 1000, // 10 minutes
      attempts: 0
    });

    res.json({
      success: true,
      code,
      message: 'Код подтверждения для сброса пароля сгенерирован.'
    });
  } catch (error: any) {
    console.error('Password reset request error:', error);
    res.status(500).json({ error: 'Ошибка отправки запроса' });
  }
}

export function resetPasswordHandler(req: Request, res: Response): void {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      res.status(400).json({ error: 'Заполните все поля' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const now = Date.now();

    const record = resetCodes.get(normalizedEmail);
    if (!record) {
      res.status(400).json({ error: 'Запрос на сброс пароля не найден или истёк' });
      return;
    }

    if (record.expiresAt < now) {
      resetCodes.delete(normalizedEmail);
      res.status(400).json({ error: 'Срок действия кода подтверждения истёк' });
      return;
    }

    if (record.attempts >= 5) {
      resetCodes.delete(normalizedEmail);
      res.status(429).json({ error: 'Превышено количество попыток ввода кода' });
      return;
    }

    if (record.code !== code.trim()) {
      record.attempts += 1;
      resetCodes.set(normalizedEmail, record);
      const remaining = 5 - record.attempts;
      res.status(400).json({ error: `Неверный код сброса. Осталось попыток: ${remaining}` });
      return;
    }

    // Password validation
    if (newPassword.length < 8) {
      res.status(400).json({ error: 'Новый пароль должен быть не менее 8 символов' });
      return;
    }

    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
      res.status(400).json({ error: 'Пароль должен содержать заглавные и строчные буквы, цифры и спецсимволы' });
      return;
    }

    const user = db.getUserByEmail(normalizedEmail);
    if (!user) {
      res.status(404).json({ error: 'Пользователь не найден' });
      return;
    }

    // Update password
    const salt = bcrypt.genSaltSync(10);
    user.passwordHash = bcrypt.hashSync(newPassword, salt);
    db.save();

    // Clean up reset codes & login attempt lockouts
    resetCodes.delete(normalizedEmail);
    loginAttempts.delete(normalizedEmail);
    resetRequests.delete(normalizedEmail);

    res.json({
      success: true,
      message: 'Пароль успешно изменён'
    });
  } catch (error: any) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Не удалось сбросить пароль' });
  }
}

export function getCurrentUserHandler(req: AuthenticatedRequest, res: Response): void {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const user = db.getUserById(req.user.id);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const { passwordHash: _, ...safeUser } = user;
  safeUser.role = db.getUserRole(user);
  res.json({ user: safeUser });
}

export function checkAvailabilityHandler(req: Request, res: Response): void {
  try {
    const { email, handle, phone } = req.body;
    let emailAvailable = true;
    let handleAvailable = true;
    let phoneAvailable = true;

    if (email) {
      const existingUser = db.getUserByEmail(email);
      if (existingUser) emailAvailable = false;
    }

    if (handle) {
      const handleVal = validateNicknameServer(handle);
      if (!handleVal.isValid) {
        handleAvailable = false;
      } else {
        const formattedHandle = handleVal.formattedHandle!;
        const existingHandle = db.getUserByHandle(formattedHandle);
        if (existingHandle) handleAvailable = false;
      }
    }

    if (phone) {
      let cleanPhone = (phone || '').trim().replace(/[^\d+]/g, '');
      if (cleanPhone.startsWith('8') && cleanPhone.length === 11) {
        cleanPhone = '+7' + cleanPhone.substring(1);
      } else if (cleanPhone.length === 10 && !cleanPhone.startsWith('+')) {
        cleanPhone = '+7' + cleanPhone;
      }
      const existingPhone = db.getUserByPhone(cleanPhone);
      if (existingPhone) phoneAvailable = false;
    }

    res.json({ emailAvailable, handleAvailable, phoneAvailable });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check availability' });
  }
}

export function guestLoginHandler(req: Request, res: Response): void {
  try {
    const guestId = `usr_guest_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const guestNumber = Math.floor(1000 + Math.random() * 9000);
    const guestUsername = `Гость #${guestNumber}`;
    const guestHandle = `@guest_${guestNumber}_${Math.random().toString(36).substring(2, 5)}`;
    const guestEmail = `guest_${guestId}@orbit.app`;

    const gradients = [
      'from-sky-300 to-cyan-200',
      'from-sky-300 to-indigo-200',
      'from-emerald-300 to-teal-200',
      'from-violet-300 to-indigo-200',
      'from-amber-300 to-orange-200',
      'from-pink-300 to-rose-200',
    ];
    const avatarColor = gradients[Math.floor(Math.random() * gradients.length)];

    const newUser: DBUser = {
      id: guestId,
      username: guestUsername,
      email: guestEmail,
      phone: `+7999${guestNumber}00`,
      passwordHash: '',
      avatarColor,
      initials: 'Г',
      handle: guestHandle,
      balance: 100.00,
      createdAt: new Date().toISOString(),
      role: 'user',
      isEmailVerified: true,
    };

    db.createUser(newUser);
    const token = generateToken(newUser);
    const { passwordHash: _, ...safeUser } = newUser;
    safeUser.role = 'user';
    res.json({ token, user: safeUser });
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка входа гостя' });
  }
}

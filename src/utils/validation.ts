export interface NicknameValidationResult {
  isValid: boolean;
  error?: string;
  formattedHandle?: string;
}

export function validateNickname(input: string): NicknameValidationResult {
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

  // Length check: 3 to 24 chars
  if (clean.length < 3) {
    return { isValid: false, error: 'Минимальная длина никнейма — 3 символа' };
  }
  if (clean.length > 24) {
    return { isValid: false, error: 'Максимальная длина никнейма — 24 символа' };
  }

  // Check for spaces
  if (/\s/.test(clean)) {
    return { isValid: false, error: 'Никнейм не должен содержать пробелы' };
  }

  // Non-ASCII check (blocks emojis, stickers, Cyrillic, special unicode)
  if (/[^\x00-\x7F]/.test(clean)) {
    return { isValid: false, error: 'Запрещены смайлы, стикеры, спецсимволы и кириллица. Используйте только латиницу (a-z)' };
  }

  // Allowed character set check: Latin letters, numbers, dot, underscore
  if (!/^[a-zA-Z0-9_.]+$/.test(clean)) {
    return { isValid: false, error: 'Никнейм может содержать только латинские буквы (a-z), цифры (0-9), символы _ и .' };
  }

  // Must start and end with a letter or digit
  if (/^[._]/.test(clean) || /[._]$/.test(clean)) {
    return { isValid: false, error: 'Никнейм не может начинаться или заканчиваться на точку или подчёркивание' };
  }

  // Cannot contain consecutive dots or underscores
  if (/\.\.|\_\_|\.\_|\_\./.test(clean)) {
    return { isValid: false, error: 'Никнейм не может содержать несколько спецсимволов подряд' };
  }

  // Check for link/domain syntax
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

  return {
    isValid: true,
    formattedHandle: `@${lower}`,
  };
}

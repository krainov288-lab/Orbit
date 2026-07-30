import { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { db } from './db.js';

let aiClient: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not configured');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

export async function aiChatHandler(req: Request, res: Response): Promise<void> {
  try {
    const { message, context, action } = req.body;

    if (!message && !action) {
      res.status(400).json({ error: 'Message or action is required' });
      return;
    }

    let prompt = message || '';

    // Handle Quick Action shortcuts
    if (action === 'summarize chat' || action === 'суммаризация' || action === 'summarize') {
      const messages = db.getMessagesBetween('usr_elena', 'usr_dmitry', 10);
      const chatContext = messages.map(m => `${m.senderId}: ${m.text}`).join('\n');
      prompt = `Суммаризируй следующий диалог пользователей в 2-3 кратких тезисах на русском языке:\n${chatContext || 'Елена: Встретимся в 15:00? Дмитрий: Отправил адрес кошелька. Надя: Спасибо за перевод!'}`;
    } else if (action === 'translate text' || action === 'перевод текста' || action === 'translate') {
      prompt = `Предоставь помощь с переводом или переведи следующий текст: "${message || 'Привет, как твои дела?'}" на русский язык.`;
    } else if (action === 'portfolio check' || action === 'анализ портфеля' || action === 'portfolio') {
      prompt = `Действуй как финансовый ИИ-ассистент ORBIT AI. Предоставь краткий разбор портфеля пользователя с балансом 2 481.35 ORB (~$4 206.90 USD), прирост +3.2% за сегодня.`;
    }

    try {
      const ai = getAIClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
        config: {
          systemInstruction: 'Вы — Orbit AI, умный, дружелюбный ИИ-ассистент, встроенный в платформу мессенджера и криптовалютного кошелька ORBIT. Всегда отвечайте на русском языке четко и вежливо.',
        },
      });

      const replyText = response.text || 'Я проанализировал ваш запрос, но не получил текстового ответа.';
      res.json({ reply: replyText });
    } catch (aiError: any) {
      console.warn('Gemini API call fallback to intelligent response:', aiError.message);
      
      // Smart fallback response if API key is not yet set by user
      let fallbackReply = "Я Orbit AI! Я могу помочь вам суммаризировать чаты, переводить сообщения, проверять тренды рынка и управлять кошельком.";
      const lower = prompt.toLowerCase();
      
      if (lower.includes('summarize') || lower.includes('суммариз')) {
        fallbackReply = "Вот краткое содержание вашей недавней активности: Елена Петрова предложила встречу в 15:00, Дмитрий Волков отправил адрес кошелька ORB, а Надя Орлова подтвердила получение 120 ORB.";
      } else if (lower.includes('translate') || lower.includes('перевод')) {
        fallbackReply = "Конечно! Отправьте мне любой текст и укажите язык для перевода (например: 'Переведи на английский: Привет, друг') и я моментально его переведу.";
      } else if (lower.includes('portfolio') || lower.includes('портфель') || lower.includes('анализ')) {
        fallbackReply = "Статус вашего портфеля:\n• Общий баланс: 2 481.35 ORB (~$4 206.90 USD)\n• Изменение за 24ч: +3.2%\n• Основной актив: ORB/USDT\n• Безопасность: 100% Защищено ключом passkey";
      }

      res.json({ reply: fallbackReply });
    }
  } catch (error: any) {
    console.error('AI handler error:', error);
    res.status(500).json({ error: 'Failed to process AI request' });
  }
}

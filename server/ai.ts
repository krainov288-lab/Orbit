import { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { db } from './db.js';
import { AuthenticatedRequest } from './auth.js';

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
    const authReq = req as AuthenticatedRequest;
    const { message, action, isTranslationMode } = req.body;

    // Retrieve user name from database if authenticated
    let userName = 'Пользователь';
    if (authReq.user?.id) {
      const u = db.getUserById(authReq.user.id);
      if (u) {
        userName = u.username || u.firstName || 'Пользователь';
      }
    }

    if (!message && !action) {
      res.status(400).json({ error: 'Message or action is required' });
      return;
    }

    // Handle portfolio analysis as temporarily unavailable
    if (action === 'portfolio check' || action === 'анализ портфеля' || action === 'portfolio') {
      res.json({ reply: 'Функция "Анализ портфеля" временно недоступна. Пожалуйста, воспользуйтесь другими возможностями Orbit AI.' });
      return;
    }

    // Handle translation action without prompt text
    if ((action === 'translate text' || action === 'перевод текста' || action === 'translate') && (!message || !message.trim())) {
      res.json({ reply: 'Какой текст вы хотите перевести? Напишите или вставьте его в сообщение, и я выполню точный перевод.' });
      return;
    }

    let prompt = message || '';

    if (action === 'translate text' || action === 'перевод текста' || action === 'translate' || isTranslationMode) {
      prompt = `Пожалуйста, переведи следующий текст. Если текст на иностранном языке — переведи его на русский. Если текст на русском — переведи его на английский. Предоставь только точный перевод без лишних вводных фраз:\n\n"${message}"`;
    }

    const systemInstruction = `Вы — Orbit AI, умный и дружелюбный ИИ-ассистент в мессенджере ORBIT. Пользователя зовут ${userName}. Обращайтесь к пользователю по имени (${userName}), когда это уместно. Всегда отвечайте вежливо и четко на русском языке.`;

    try {
      const ai = getAIClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
        config: {
          systemInstruction,
        },
      });

      const replyText = response.text || 'Я проанализировал ваш запрос, но не получил текстового ответа.';
      res.json({ reply: replyText });
    } catch (aiError: any) {
      console.warn('Gemini API call fallback:', aiError.message);
      
      let fallbackReply = `Привет, ${userName}! Я Orbit AI. Чем я могу помочь вам сегодня?`;
      const lower = prompt.toLowerCase();
      
      if (lower.includes('translate') || lower.includes('перевод') || isTranslationMode) {
        fallbackReply = `Перевод сообщения:\n"${message}"`;
      }

      res.json({ reply: fallbackReply });
    }
  } catch (error: any) {
    console.error('AI handler error:', error);
    res.status(500).json({ error: 'Failed to process AI request' });
  }
}


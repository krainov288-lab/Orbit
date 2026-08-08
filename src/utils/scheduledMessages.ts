import { ScheduledMessage } from '../types';

const STORAGE_KEY = 'orbit_scheduled_messages';

export function getScheduledMessages(): ScheduledMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (err) {
    console.error('Failed to parse scheduled messages:', err);
    return [];
  }
}

export function saveScheduledMessages(messages: ScheduledMessage[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch (err) {
    console.error('Failed to save scheduled messages:', err);
  }
}

export function addScheduledMessage(msg: Omit<ScheduledMessage, 'id' | 'createdAt'>): ScheduledMessage {
  const all = getScheduledMessages();
  const newMsg: ScheduledMessage = {
    ...msg,
    id: `sched_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: Date.now(),
  };
  all.push(newMsg);
  saveScheduledMessages(all);
  return newMsg;
}

export function removeScheduledMessage(id: string): void {
  const all = getScheduledMessages();
  const filtered = all.filter((m) => m.id !== id);
  saveScheduledMessages(filtered);
}

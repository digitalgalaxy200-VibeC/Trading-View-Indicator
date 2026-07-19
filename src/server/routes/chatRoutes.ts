import { Router, Request, Response } from 'express';
import { AiAssistantService, ChatMessage } from '../../services/aiAssistantService';
import db from '../../db/connection';

export const chatRoutes = Router();

// ── Thread management ──

chatRoutes.get('/threads', (_req: Request, res: Response) => {
  try {
    const threads = db.prepare(
      'SELECT * FROM chat_threads ORDER BY updated_at DESC LIMIT 20'
    ).all();
    res.json(threads);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

chatRoutes.post('/threads', (_req: Request, res: Response) => {
  try {
    const now = Date.now();
    const info = db.prepare(
      'INSERT INTO chat_threads (title, created_at, updated_at) VALUES (?, ?, ?)'
    ).run('New Conversation', now, now);
    const thread = db.prepare('SELECT * FROM chat_threads WHERE id = ?').get(info.lastInsertRowid);
    res.json(thread);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

chatRoutes.get('/threads/:id/messages', (req: Request, res: Response) => {
  try {
    const threadId = parseInt(req.params.id, 10);
    const messages = db.prepare(
      'SELECT * FROM chat_messages WHERE thread_id = ? ORDER BY created_at ASC LIMIT 50'
    ).all(threadId);
    res.json(messages);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Send a chat message ──

chatRoutes.post('/threads/:id/messages', async (req: Request, res: Response) => {
  try {
    const threadId = parseInt(req.params.id, 10);
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'content is required' });

    // Save user message
    const now = Date.now();
    db.prepare(
      'INSERT INTO chat_messages (thread_id, role, content, created_at) VALUES (?, ?, ?, ?)'
    ).run(threadId, 'user', content.trim(), now);

    // Load recent history for context (last 10 exchanges = 20 messages)
    const historyRows = db.prepare(
      'SELECT role, content FROM chat_messages WHERE thread_id = ? ORDER BY created_at DESC LIMIT 20'
    ).all(threadId) as { role: string; content: string }[];

    // Reverse so oldest-first for the prompt
    const history: ChatMessage[] = historyRows
      .reverse()
      .slice(0, -1) // exclude the message we just saved (we'll pass it as userMessage)
      .map(r => ({ role: r.role as any, content: r.content }));

    console.log(`🧠 [AI Chat] Thread #${threadId}: "${content.trim().substring(0, 60)}..."`);

    // Call the AI
    const aiReply = await AiAssistantService.chat(content.trim(), history);

    // Save assistant reply
    db.prepare(
      'INSERT INTO chat_messages (thread_id, role, content, created_at) VALUES (?, ?, ?, ?)'
    ).run(threadId, 'assistant', aiReply, Date.now());

    // Update thread timestamp and auto-title if still default
    db.prepare('UPDATE chat_threads SET updated_at = ? WHERE id = ?').run(Date.now(), threadId);
    const titleRow = db.prepare('SELECT title FROM chat_threads WHERE id = ?').get(threadId) as any;
    if (titleRow?.title === 'New Conversation') {
      const autoTitle = content.trim().substring(0, 50);
      db.prepare('UPDATE chat_threads SET title = ? WHERE id = ?').run(autoTitle, threadId);
    }

    res.json({ reply: aiReply });
  } catch (err: any) {
    console.error('Chat route error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

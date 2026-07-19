import { Router, Request, Response } from 'express';
import { marketStateRepository } from '../../db/marketStateRepository';
import { eventRepository } from '../../db/eventRepository';
import { alertRepository } from '../../db/alertRepository';
import { emailRepository } from '../../db/emailRepository';
import { configRepository } from '../../db/configRepository';
import { watchTaskRepository } from '../../db/watchTaskRepository';
import { symbolRepository } from '../../db/symbolRepository';
import { profileRepository } from '../../db/profileRepository';
import { opportunityRepository } from '../../db/opportunityRepository';

export const stateRoutes = Router();

// ── Market State ──
stateRoutes.get('/state', (_req: Request, res: Response) => {
  try {
    const state = marketStateRepository.getAll();
    res.json(state);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Alert History (with filter) ──
stateRoutes.get('/alerts', (req: Request, res: Response) => {
  try {
    const since = req.query.since ? parseInt(req.query.since as string, 10) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 200;
    const alerts = since
      ? alertRepository.getRecentSince(since)
      : alertRepository.getRecent(limit);
    res.json(alerts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Single Alert Detail (for modal) ──
stateRoutes.get('/alerts/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const alert = alertRepository.getById(id);
    if (!alert) return res.status(404).json({ error: 'Not found' });
    res.json(alert);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Email History ──
stateRoutes.get('/emails', (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const emails = emailRepository.getRecent(limit);
    res.json(emails);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Single Email Detail with its alerts (for modal) ──
stateRoutes.get('/emails/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const email = emailRepository.getById(id);
    if (!email) return res.status(404).json({ error: 'Not found' });
    const alerts = alertRepository.getByEmailId(id);
    res.json({ ...email, alerts });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Stats ──
stateRoutes.get('/stats', (_req: Request, res: Response) => {
  try {
    const stats = eventRepository.getStats();
    const pendingAlerts = alertRepository.count();
    const emailsSent = emailRepository.count();
    res.json({ ...stats, emailsSent, pendingAlerts });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Latest alert timestamp (for push notifications polling) ──
stateRoutes.get('/latest', (_req: Request, res: Response) => {
  try {
    const latest = alertRepository.getLatestTimestamp();
    res.json({ timestamp: latest });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Config ──
stateRoutes.get('/config', (_req: Request, res: Response) => {
  try {
    const cfg = configRepository.get();
    res.json(cfg);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

stateRoutes.patch('/config', (req: Request, res: Response) => {
  try {
    configRepository.update(req.body);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Opportunities (System 2) ──

stateRoutes.get('/opportunities', (_req: Request, res: Response) => {
  try {
    // Show all active + triggered + recent invalidated/closed?
    // Let's just show active for now.
    res.json(opportunityRepository.getAllActive());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Profile
stateRoutes.get('/profile', (_req: Request, res: Response) => {
  try {
    const content = profileRepository.get();
    res.json({ content });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

stateRoutes.post('/profile', (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    if (typeof content !== 'string') return res.status(400).json({ error: 'content is required' });
    profileRepository.update(content);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// V4: Opportunities
stateRoutes.get('/opportunities', (_req: Request, res: Response) => {
  try {
    const opps = opportunityRepository.getAllActive();
    res.json(opps);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

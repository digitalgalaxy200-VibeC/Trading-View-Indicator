import { Router, Request, Response } from 'express';
import { marketStateRepository } from '../../db/marketStateRepository';
import { eventRepository } from '../../db/eventRepository';
import { alertRepository } from '../../db/alertRepository';
import { emailRepository } from '../../db/emailRepository';
import { configRepository } from '../../db/configRepository';

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

// ── Alert History ──
stateRoutes.get('/alerts', (req: Request, res: Response) => {
  try {
    const since = req.query.since ? parseInt(req.query.since as string, 10) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 200;

    let alerts;
    if (since) {
      alerts = alertRepository.getRecentSince(since);
    } else {
      alerts = alertRepository.getRecent(limit);
    }
    res.json(alerts);
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

import express, { Request, Response } from 'express';
import path from 'path';
import { stateRoutes } from './routes/stateRoutes';
import { config } from '../config/env';

export function createApp(): express.Application {
  const app = express();
  app.use(express.json());

  // API routes
  app.use('/api', stateRoutes);

  // Static dashboard
  app.use(express.static(path.join(__dirname, '..', '..', 'public')));

  app.get('/', (_req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '..', '..', 'public', 'index.html'));
  });

  app.get('/ai', (_req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '..', '..', 'public', 'ai.html'));
  });

  return app;
}

export function startServer(): void {
  const app = createApp();
  app.listen(config.port, () => {
    console.log(`Dashboard running at http://localhost:${config.port}`);
  });
}

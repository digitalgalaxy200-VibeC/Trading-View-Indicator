import { CandleManager } from './candleManager';

// Shared reference so the dashboard API can read live pipeline state
let _managers: Map<string, CandleManager> | null = null;

export function setManagers(m: Map<string, CandleManager>): void {
  _managers = m;
}

export function getManagers(): Map<string, CandleManager> | null {
  return _managers;
}

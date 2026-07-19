import { BreakoutEvent } from '../types';
import { symbolRepository } from '../db/symbolRepository';
import { eventRepository } from '../db/eventRepository';
import { opportunityRepository } from '../db/opportunityRepository';
import { calculateFibLevels, isRetracementReached, calculateRR } from '../utils/fibonacci';

export type L3Callback = (opp: any) => void;

export class OpportunityEngine {
  private onL3Ready: L3Callback | null = null;

  onLevel3(cb: L3Callback): void {
    this.onL3Ready = cb;
  }

  handleEvent(symbol: string, event: BreakoutEvent): void {
    const symbolId = symbolRepository.getId(symbol);
    if (!symbolId) return;

    const isChoch = event.event.includes('CHOCH');
    const isBos = event.event.includes('BOS');
    const direction = event.direction;

    opportunityRepository.expireInactive(symbolId, event.trendAfter);

    if (isChoch) this.handleChoch(symbolId, direction, event);
    if (isBos) this.handleBos(symbolId, direction, event);
  }

  private handleChoch(symbolId: number, direction: string, event: BreakoutEvent): void {
    const eventRow = eventRepository.getBySymbol(symbolId, 1)[0];
    if (!eventRow) return;

    const existing = opportunityRepository.getActive(symbolId, direction)
      .find(o => o.workflow_type === 'reversal' && o.watch_level === 1 && !o.bos_event_id);

    if (!existing) {
      opportunityRepository.create({
        symbol_id: symbolId, direction, workflow_type: 'reversal',
        watch_level: 1, status: 'active', choch_event_id: eventRow.id,
        bos_event_id: null, impulse_high: null, impulse_low: null,
        fib_0: null, fib_50: null, fib_100: null,
        entry_price: null, stop_loss: null, take_profit: null, risk_reward: null,
      });
      console.log(`  🔍 L1 Reversal: ${direction} CHOCH → waiting for BOS`);
    }
  }

  private handleBos(symbolId: number, direction: string, event: BreakoutEvent): void {
    const eventRow = eventRepository.getBySymbol(symbolId, 1)[0];
    if (!eventRow) return;

    // L1 → L2 promotion
    const l1Opps = opportunityRepository.getActive(symbolId, direction)
      .filter(o => o.workflow_type === 'reversal' && o.watch_level === 1 && !o.bos_event_id);
    for (const opp of l1Opps) {
      this.promoteToL2(opp.id, eventRow.id, direction, event);
      return;
    }

    // Workflow B: new continuation L2
    const existing = opportunityRepository.getActive(symbolId, direction)
      .filter(o => o.workflow_type === 'continuation' && o.watch_level >= 2);
    if (existing.length === 0) {
      opportunityRepository.create({
        symbol_id: symbolId, direction, workflow_type: 'continuation',
        watch_level: 2, status: 'active', choch_event_id: null,
        bos_event_id: eventRow.id, impulse_high: null, impulse_low: null,
        fib_0: null, fib_50: null, fib_100: null,
        entry_price: null, stop_loss: null, take_profit: null, risk_reward: null,
      });
      console.log(`  🔍 L2 Continuation: ${direction} BOS → monitoring retracement`);
    }
  }

  private promoteToL2(oppId: number, bosEventId: number, direction: string, event: BreakoutEvent): void {
    const impulseHigh = direction === 'BULLISH' ? event.price : event.pivotLevel;
    const impulseLow = direction === 'BULLISH' ? event.pivotLevel : event.price;

    const fib = calculateFibLevels(impulseHigh, impulseLow, direction as 'BULLISH' | 'BEARISH');
    const entry = fib.fib50;
    const sl = fib.fib0;
    const tp = fib.fib100;
    const rr = calculateRR(entry, sl, tp);

    opportunityRepository.update(oppId, {
      watch_level: 2, bos_event_id: bosEventId,
      impulse_high: impulseHigh, impulse_low: impulseLow,
      fib_0: fib.fib0, fib_50: fib.fib50, fib_100: fib.fib100,
      entry_price: entry, stop_loss: sl, take_profit: tp, risk_reward: rr,
    });
    console.log(`  📈 L1→L2: Fib 50% at ${entry.toFixed(2)} | R:R ${rr}`);
  }

  monitorRetracement(symbol: string, currentPrice: number): void {
    const symbolId = symbolRepository.getId(symbol);
    if (!symbolId) return;

    const l2Opps = opportunityRepository.getByWatchLevel(2)
      .filter(o => o.symbol_id === symbolId);

    for (const opp of l2Opps) {
      if (opp.fib_50 === null) continue;
      const fib = { fib0: opp.fib_0!, fib50: opp.fib_50, fib100: opp.fib_100! };

      if (isRetracementReached(currentPrice, fib, opp.direction as 'BULLISH' | 'BEARISH')) {
        const entry = opp.fib_50;
        const sl = opp.fib_0!;
        const tp = opp.fib_100!;
        const rr = calculateRR(entry, sl, tp);

        opportunityRepository.update(opp.id, {
          watch_level: 3, entry_price: entry, stop_loss: sl, take_profit: tp, risk_reward: rr,
        });
        console.log(`  🎯 L3 READY: ${opp.direction} ${opp.workflow_type} | Entry: ${entry.toFixed(2)} | R:R ${rr}`);

        if (this.onL3Ready) this.onL3Ready(opp);
      }
    }
  }
}

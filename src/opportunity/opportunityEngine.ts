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

    // Invalidate opposing opportunities
    opportunityRepository.invalidateOpposing(symbolId, direction as 'BULLISH' | 'BEARISH');

    if (isChoch) this.handleChoch(symbolId, direction, event);
    if (isBos) this.handleBos(symbolId, direction, event);
  }

  private handleChoch(symbolId: number, direction: string, event: BreakoutEvent): void {
    const existing = opportunityRepository.getActiveBySymbol(symbolId)
      .filter((o: any) => o.type === 'REVERSAL' && o.status === 'LEVEL_1' && !o.impulse_end_price);

    if (existing.length === 0) {
      opportunityRepository.insert(symbolId, 'REVERSAL', direction as any, 'LEVEL_1', event.price);
      console.log(`  🔍 L1 Reversal: ${direction} CHOCH → waiting for BOS`);
    }
  }

  private handleBos(symbolId: number, direction: string, event: BreakoutEvent): void {
    // L1 → L2 promotion
    const l1Opps = opportunityRepository.getActiveBySymbol(symbolId)
      .filter((o: any) => o.type === 'REVERSAL' && o.status === 'LEVEL_1');

    for (const opp of l1Opps) {
      const impulseHigh = direction === 'BULLISH' ? event.price : opp.impulse_start_price!;
      const impulseLow = direction === 'BULLISH' ? opp.impulse_start_price! : event.price;
      const fib = calculateFibLevels(impulseHigh, impulseLow, direction as any);
      opportunityRepository.updateLevel2(opp.id, event.price, fib.fib50);
      console.log(`  📈 L1→L2: Fib 50% at ${fib.fib50.toFixed(2)}`);
      return;
    }

    // New continuation L2
    const existing = opportunityRepository.getActiveBySymbol(symbolId)
      .filter((o: any) => o.type === 'CONTINUATION' && o.status === 'LEVEL_2');
    if (existing.length === 0) {
      opportunityRepository.insert(symbolId, 'CONTINUATION', direction as any, 'LEVEL_2', event.price);
      console.log(`  🔍 L2 Continuation: ${direction} BOS`);
    }
  }

  monitorRetracement(symbol: string, currentPrice: number): void {
    const symbolId = symbolRepository.getId(symbol);
    if (!symbolId) return;

    const l2Opps = opportunityRepository.getActiveBySymbol(symbolId)
      .filter((o: any) => o.status === 'LEVEL_2' && o.entry_price);

    for (const opp of l2Opps) {
      if (!opp.entry_price) continue;

      // Check if price retraced to entry zone
      const reached = opp.direction === 'BULLISH'
        ? currentPrice <= opp.entry_price
        : currentPrice >= opp.entry_price;

      if (reached) {
        const rr = opp.direction === 'BULLISH'
          ? calculateRR(opp.entry_price, opp.impulse_start_price!, opp.impulse_end_price!)
          : calculateRR(opp.entry_price, opp.impulse_end_price!, opp.impulse_start_price!);

        opportunityRepository.updateStatus(opp.id, 'TRIGGERED', undefined, undefined);
        console.log(`  🎯 L3 READY: ${opp.direction} ${opp.type} | Entry: ${opp.entry_price.toFixed(2)} | R:R ${rr}`);

        if (this.onL3Ready) this.onL3Ready(opp);
      }
    }
  }
}

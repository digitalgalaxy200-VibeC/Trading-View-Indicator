import { Candle, ContinuationState, EngineAction, StructureEvent, Bias } from '../types';
import { computeFibLevels } from '../utils/fibonacci';

const CHAIN_CONFIRM_CANDLES = 3;

export function processCandle(
  state: ContinuationState,
  candle: Candle,
  event: StructureEvent | null,
  htfBias: Bias
): { state: ContinuationState; actions: EngineAction[] } {
  const actions: EngineAction[] = [];

  // ── 1) Resolve an open trade first ──
  if (state.stage === 'IN_TRADE' && state.trade) {
    const t = state.trade;
    const hitTarget = t.direction === 'bullish' ? candle.high >= t.target : candle.low <= t.target;
    const hitStop = t.direction === 'bullish' ? candle.low <= t.stop : candle.high >= t.stop;

    if (hitTarget) {
      actions.push({ kind: 'TARGET_HIT', trade: t, price: t.target, time: candle.time });
      state.trade = null;
      state.stage = 'IDLE';
      state.confirmCount = 0;
    } else if (hitStop) {
      actions.push({ kind: 'STOP_HIT', trade: t, price: t.stop, time: candle.time });
      state.trade = null;
      state.stage = 'IDLE';
      state.bias = 'neutral';
      state.confirmCount = 0;
    }
    if (state.stage === 'IN_TRADE') return { state, actions };
  }

  if (!event) return { state, actions };

  // ── 2) CHOCH — warning only ──
  if (event.type === 'CHOCH') {
    state.stage = 'CHOCH_WARN';
    actions.push({ kind: 'CHOCH_WARNING', event });
    return { state, actions };
  }

  // ── 3) BOS matching HTF bias — arm, with chain-confirmation after a win ──
  if (event.type === 'BOS' && event.direction === htfBias) {
    if (state.stage === 'IDLE' && !state.trade) {
      armLeg(state, event, actions);
    }
    return { state, actions };
  }

  return { state, actions };
}

function armLeg(state: ContinuationState, event: StructureEvent, actions: EngineAction[]) {
  const fib = computeFibLevels(event.leg);
  state.leg = event.leg;
  state.fib = fib;
  state.stage = 'ARMED';
  actions.push({ kind: 'LEG_ARMED', event, fib });
}

/** Call every candle while stage === 'ARMED' to check for the 50% touch. */
export function checkEntryFill(state: ContinuationState, candle: Candle): EngineAction[] {
  const actions: EngineAction[] = [];
  if (state.stage !== 'ARMED' || !state.fib || !state.leg) return actions;

  const { entry, stop, target } = state.fib;
  const direction = state.leg.direction;
  const touchedEntry = direction === 'bullish' ? candle.low <= entry : candle.high >= entry;

  if (touchedEntry) {
    const chainCount = (state.trade?.chainCount ?? 0) + 1;
    state.trade = { symbol: state.symbol, direction, entry, stop, target, entryTime: candle.time, chainCount };
    state.stage = 'IN_TRADE';
    actions.push({ kind: 'TRADE_ENTERED', trade: state.trade });
  }

  return actions;
}

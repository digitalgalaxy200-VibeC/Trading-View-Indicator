import {
  Candle,
  ContinuationState,
  EngineAction,
  StructureEvent,
  Bias,
} from '../types';
import { computeFibLevels } from '../utils/fibonacci';

const CHAIN_CONFIRM_CANDLES = 3; // candles that must close beyond the level

/**
 * Call once per new closed 5m candle, after structureEngine.updateStructure()
 * has already run for this candle. Pass the resulting `event` (or null),
 * the current HTF bias, and the raw candle.
 */
export function processCandle(
  state: ContinuationState,
  candle: Candle,
  event: StructureEvent | null,
  htfBias: Bias
): { state: ContinuationState; actions: EngineAction[] } {
  const actions: EngineAction[] = [];

  // 1) Manage an already-open trade first — check for TP/SL on this candle.
  if (state.stage === 'IN_TRADE' && state.trade) {
    const t = state.trade;
    const hitTarget =
      t.direction === 'bullish' ? candle.high >= t.target : candle.low <= t.target;
    const hitStop =
      t.direction === 'bullish' ? candle.low <= t.stop : candle.high >= t.stop;

    if (hitTarget) {
      actions.push({ kind: 'TARGET_HIT', trade: t, price: t.target, time: candle.time });
      state.trade = null;
      state.stage = 'IDLE'; // now watching for a confirmed chain continuation
      state.confirmCount = 0;
    } else if (hitStop) {
      actions.push({ kind: 'STOP_HIT', trade: t, price: t.stop, time: candle.time });
      state.trade = null;
      state.stage = 'IDLE'; // possible character change — reset clean, don't force a bias
      state.bias = 'neutral';
      state.confirmCount = 0;
    }
    // if neither hit, fall through — a new event this candle can't also arm
    // a fresh trade while one is open, so return early.
    if (state.stage === 'IN_TRADE') {
      return { state, actions };
    }
  }

  // 2) No structure event this candle and nothing else to do.
  if (!event) {
    return { state, actions };
  }

  // 3) A CHoCH is always just a warning, regardless of stage.
  if (event.type === 'CHOCH') {
    state.stage = 'CHOCH_WARN';
    actions.push({ kind: 'CHOCH_WARNING', event });
    return { state, actions };
  }

  // 4) A BOS only matters if it agrees with the higher-timeframe bias.
  if (event.type === 'BOS' && event.direction === htfBias) {
    const isFirstLegOfRun = state.stage !== 'ARMED';

    if (isFirstLegOfRun) {
      // fresh leg after CHoCH/IDLE — arm immediately, no confirmation delay.
      armLeg(state, event, actions);
    } else {
      // we're chaining after a prior win — require confirmation candles
      // closing beyond the level before treating it as valid continuation.
      state.confirmCount += 1;
      if (state.confirmCount >= CHAIN_CONFIRM_CANDLES) {
        state.confirmCount = 0;
        armLeg(state, event, actions);
      }
    }
    return { state, actions };
  }

  // BOS against bias, or CHoCH already handled above — nothing to do.
  return { state, actions };
}

function armLeg(state: ContinuationState, event: StructureEvent, actions: EngineAction[]) {
  const fib = computeFibLevels(event.leg);
  state.leg = event.leg;
  state.fib = fib;
  state.stage = 'ARMED';
  actions.push({ kind: 'LEG_ARMED', event, fib });
}

/**
 * Call on every candle while state.stage === 'ARMED' to check whether price
 * has retraced into the 50% entry and should fill.
 */
export function checkEntryFill(
  state: ContinuationState,
  candle: Candle
): EngineAction[] {
  const actions: EngineAction[] = [];
  if (state.stage !== 'ARMED' || !state.fib || !state.leg) return actions;

  const { entry, stop, target } = state.fib;
  const direction = state.leg.direction;

  const touchedEntry =
    direction === 'bullish' ? candle.low <= entry : candle.high >= entry;

  if (touchedEntry) {
    const chainCount = (state.trade?.chainCount ?? 0) + 1;
    state.trade = {
      symbol: state.symbol,
      direction,
      entry,
      stop,
      target,
      entryTime: candle.time,
      chainCount,
    };
    state.stage = 'IN_TRADE';
    actions.push({ kind: 'TRADE_ENTERED', trade: state.trade });
  }

  return actions;
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfirmationLayer = void 0;
/**
 * ConfirmationLayer
 *
 * Sits between the detection engine and the notification service.
 * The detection algorithm is completely unchanged — it still detects every BOS and CHOCH.
 * This layer decides whether a detected event is significant enough to notify the user.
 *
 * NOTIFICATION RULES:
 *
 * Rule 1: CHOCH → BOS = Notify ✅
 *   The market changed character and has now confirmed the new direction.
 *
 * Rule 2: BOS → BOS = Notify ✅
 *   The existing trend has produced another continuation BOS.
 *
 * Rule 3: Lone CHOCH = No Notify ❌
 *   A CHOCH alone is a potential reversal signal, not yet confirmed.
 *
 * Rule 4: First-ever BOS (no prior context) = No Notify ❌
 *   We need at least one prior event to establish context.
 */
class ConfirmationLayer {
    // Stores the recent event history per symbol (we only need the last 2)
    history = [];
    /**
     * Evaluates whether a newly detected event should trigger a notification.
     * Returns true if the notification should be sent, false otherwise.
     */
    shouldNotify(event) {
        const newType = event.event.includes('CHoCH') ? 'CHOCH' : 'BOS';
        // Record this new event
        this.history.push({ type: newType, epoch: event.epoch });
        // Keep only the last 3 events in memory
        if (this.history.length > 3) {
            this.history.shift();
        }
        // We need at least 2 events to evaluate a sequence
        if (this.history.length < 2) {
            console.log(`[ConfirmationLayer] First event recorded (${newType}). Waiting for sequence.`);
            return false;
        }
        // Get the previous event (second-to-last in history)
        const previous = this.history[this.history.length - 2];
        const current = this.history[this.history.length - 1];
        // Rule 1: CHOCH → BOS = Notify
        if (previous.type === 'CHOCH' && current.type === 'BOS') {
            console.log(`[ConfirmationLayer] ✅ Rule 1 matched: CHOCH → BOS. Notifying.`);
            return true;
        }
        // Rule 2: BOS → BOS = Notify
        if (previous.type === 'BOS' && current.type === 'BOS') {
            console.log(`[ConfirmationLayer] ✅ Rule 2 matched: BOS → BOS. Notifying.`);
            return true;
        }
        // Rule 3: Lone CHOCH or BOS → CHOCH = No Notify
        console.log(`[ConfirmationLayer] ⏸ Sequence ${previous.type} → ${current.type} does not meet confirmation threshold. Holding.`);
        return false;
    }
    /**
     * Returns a human-readable summary of the current confirmation state.
     */
    getStateDescription() {
        if (this.history.length === 0)
            return 'No events recorded yet.';
        return this.history.map(e => e.type).join(' → ');
    }
}
exports.ConfirmationLayer = ConfirmationLayer;

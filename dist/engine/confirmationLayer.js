"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfirmationLayer = void 0;
/**
 * ConfirmationLayer filters out insignificant breakouts.
 * Currently passes all events through — extend with custom logic.
 */
class ConfirmationLayer {
    eventCount = 0;
    shouldNotify(event) {
        this.eventCount++;
        // Pass through all events for now
        // Future: add sequence confirmation (e.g., require CHOCH before BOS)
        return true;
    }
    getStateDescription() {
        return `Events processed: ${this.eventCount}`;
    }
}
exports.ConfirmationLayer = ConfirmationLayer;

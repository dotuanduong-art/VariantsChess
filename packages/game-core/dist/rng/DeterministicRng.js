"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeterministicRng = void 0;
/**
 * Mulberry32 — fast, seedable 32-bit PRNG.
 * State is serializable (seed + counter) so snapshots restore exact sequence.
 */
class DeterministicRng {
    seed;
    counter;
    constructor(seed, counter = 0) {
        this.seed = seed;
        this.counter = counter;
    }
    /** Returns a float in [0, 1) — deterministic given seed + call count */
    next() {
        let t = (this.seed + this.counter++) | 0;
        // Mulberry32 generator
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    /** Returns integer in [min, max] inclusive */
    nextInt(min, max) {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }
    /** Shuffle array in place — Fisher-Yates with deterministic source */
    shuffle(array) {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = this.nextInt(0, i);
            const temp = result[i];
            result[i] = result[j];
            result[j] = temp;
        }
        return result;
    }
    /** Serializable state for snapshot/restore */
    getState() {
        return { seed: this.seed, counter: this.counter };
    }
    static fromState(state) {
        return new DeterministicRng(state.seed, state.counter);
    }
}
exports.DeterministicRng = DeterministicRng;
//# sourceMappingURL=DeterministicRng.js.map
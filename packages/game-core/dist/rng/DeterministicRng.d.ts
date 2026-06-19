/**
 * Mulberry32 — fast, seedable 32-bit PRNG.
 * State is serializable (seed + counter) so snapshots restore exact sequence.
 */
export declare class DeterministicRng {
    private seed;
    private counter;
    constructor(seed: number, counter?: number);
    /** Returns a float in [0, 1) — deterministic given seed + call count */
    next(): number;
    /** Returns integer in [min, max] inclusive */
    nextInt(min: number, max: number): number;
    /** Shuffle array in place — Fisher-Yates with deterministic source */
    shuffle<T>(array: T[]): T[];
    /** Serializable state for snapshot/restore */
    getState(): {
        seed: number;
        counter: number;
    };
    static fromState(state: {
        seed: number;
        counter: number;
    }): DeterministicRng;
}
//# sourceMappingURL=DeterministicRng.d.ts.map
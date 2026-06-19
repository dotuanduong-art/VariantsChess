/**
 * Mulberry32 — fast, seedable 32-bit PRNG.
 * State is serializable (seed + counter) so snapshots restore exact sequence.
 */
export class DeterministicRng {
  private seed: number;
  private counter: number;

  constructor(seed: number, counter = 0) {
    this.seed = seed;
    this.counter = counter;
  }

  /** Returns a float in [0, 1) — deterministic given seed + call count */
  next(): number {
    let t = (this.seed + this.counter++) | 0;
    // Mulberry32 generator
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns integer in [min, max] inclusive */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Shuffle array in place — Fisher-Yates with deterministic source */
  shuffle<T>(array: T[]): T[] {
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
  getState(): { seed: number; counter: number } {
    return { seed: this.seed, counter: this.counter };
  }

  static fromState(state: { seed: number; counter: number }): DeterministicRng {
    return new DeterministicRng(state.seed, state.counter);
  }
}

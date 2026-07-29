/**
 * Deterministic pseudo-random generator (mulberry32). A fixed seed makes the entire
 * Munaxa Academy dataset reproducible: the baseline is identical on every boot and in
 * every browser, which is what lets us "reset to the original seeded state" reliably.
 */
export class Prng {
  private state: number;

  constructor(seed = 0x4d554e58 /* "MUNX" */) {
    this.state = seed >>> 0;
  }

  /** Float in [0, 1). */
  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Random element of an array. */
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)] as T;
  }

  /** Pick `n` distinct elements. */
  sample<T>(arr: readonly T[], n: number): T[] {
    const pool = [...arr];
    const out: T[] = [];
    for (let i = 0; i < n && pool.length; i++) {
      out.push(pool.splice(Math.floor(this.next() * pool.length), 1)[0] as T);
    }
    return out;
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.next() < p;
  }
}

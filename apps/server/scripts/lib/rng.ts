// Seeded randomness for the fixture generators only (docs/algorithms.md §2); never imported by src/algorithms.
// Draw order is part of the contract: any change to the number or order of draws changes every fixture.

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gaussian(rand: () => number, mean: number, sigma: number): number {
  let u1 = rand();
  while (u1 === 0) u1 = rand();            // log(0) guard; consumes an extra draw only if u1 is exactly 0
  const u2 = rand();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + sigma * z;
}

/** Applied where a value is written, never inside a draw. */
export function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

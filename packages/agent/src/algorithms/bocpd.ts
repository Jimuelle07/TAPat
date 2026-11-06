// Bayesian Online Changepoint Detection (docs/algorithms.md §6): Gaussian likelihood with known variance, normal prior
// on each segment's mean, constant hazard, truncated run length. Pure and deterministic.

export interface BocpdConfig {
  hazard: number;
  maxRunLength: number;
  warmup: number;
  priorMeanVar: number;
  sigmaSquareFloor: number;
  cpRecentWindow: number;
}

export const DEFAULT_BOCPD: BocpdConfig = {
  hazard: 1 / 50,
  maxRunLength: 200,
  warmup: 10,
  priorMeanVar: 4,
  sigmaSquareFloor: 0.05,
  cpRecentWindow: 10,
};

export interface BocpdPoint {
  index: number;
  price: number;
  cpRecent: number;
  mapRunLength: number;
  segmentMean: number;
}

function logSumExp(xs: number[]): number {
  let m = -Infinity;
  for (const x of xs) if (x > m) m = x;
  if (m === -Infinity) return -Infinity;
  let s = 0;
  for (const x of xs) if (m - x <= 700) s += Math.exp(x - m);
  return m + Math.log(s);
}

function mean(xs: number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

export class Bocpd {
  readonly points: BocpdPoint[] = [];
  readonly sigma2: number;
  private readonly cfg: BocpdConfig;
  private mu0: number;
  private readonly prices: number[] = [];
  private logP: number[] = [0];
  private mu: number[];
  private vr: number[];

  /**
   * `warmupValues` sets `mu0` and `sigma2` (the first `warmup` points of the series). With fewer than 3 values,
   * `sigma2` is the floor; with none, `mu0` is taken from the first pushed price.
   */
  constructor(config?: Partial<BocpdConfig>, warmupValues: number[] = []) {
    this.cfg = { ...DEFAULT_BOCPD, ...config };
    const w = warmupValues.slice(0, this.cfg.warmup);
    this.mu0 = w.length > 0 ? mean(w) : NaN;
    let s2 = this.cfg.sigmaSquareFloor;
    if (w.length >= 3) {
      const m = this.mu0;
      let ss = 0;
      for (const x of w) ss += (x - m) * (x - m);
      s2 = Math.max(ss / (w.length - 1), this.cfg.sigmaSquareFloor);
    }
    this.sigma2 = s2;
    this.mu = [this.mu0];
    this.vr = [this.cfg.priorMeanVar];
  }

  push(price: number): BocpdPoint {
    const { hazard: H, maxRunLength: R, priorMeanVar: var0, cpRecentWindow } = this.cfg;
    const sigma2 = this.sigma2;
    if (Number.isNaN(this.mu[0])) {
      this.mu0 = price;
      this.mu = [price];
    }
    const mu0 = this.mu0;
    const n = this.logP.length;

    const joint = new Array<number>(n);
    for (let r = 0; r < n; r++) {
      const vPred = this.vr[r] + sigma2;
      const d = price - this.mu[r];
      joint[r] = this.logP[r] - 0.5 * Math.log(2 * Math.PI * vPred) - (d * d) / (2 * vPred);
    }

    let newLogP = new Array<number>(n + 1);
    newLogP[0] = logSumExp(joint) + Math.log(H);
    const log1mH = Math.log(1 - H);
    for (let r = 0; r < n; r++) newLogP[r + 1] = joint[r] + log1mH;
    let L = logSumExp(newLogP);
    for (let k = 0; k <= n; k++) newLogP[k] -= L;

    let newMu = new Array<number>(n + 1);
    let newVar = new Array<number>(n + 1);
    // r = 0 means x_t opens the new segment, so its posterior is the prior updated with x_t; the segment then holds
    // mapRunLength + 1 points (§6.3 step 7).
    newVar[0] = 1 / (1 / var0 + 1 / sigma2);
    newMu[0] = newVar[0] * (mu0 / var0 + price / sigma2);
    for (let r = 0; r < n; r++) {
      const v = 1 / (1 / this.vr[r] + 1 / sigma2);
      newVar[r + 1] = v;
      newMu[r + 1] = v * (this.mu[r] / this.vr[r] + price / sigma2);
    }

    if (newLogP.length > R + 1) {
      newLogP = newLogP.slice(0, R + 1);
      newMu = newMu.slice(0, R + 1);
      newVar = newVar.slice(0, R + 1);
      L = logSumExp(newLogP);
      for (let k = 0; k < newLogP.length; k++) newLogP[k] -= L;
    }

    this.logP = newLogP;
    this.mu = newMu;
    this.vr = newVar;
    this.prices.push(price);

    let cpRecent = 0;
    for (let r = 0; r < Math.min(cpRecentWindow, newLogP.length); r++) cpRecent += Math.exp(newLogP[r]);
    let mapRunLength = 0;
    for (let r = 1; r < newLogP.length; r++) if (newLogP[r] > newLogP[mapRunLength]) mapRunLength = r;
    const t = this.prices.length;
    const start = Math.max(0, t - 1 - mapRunLength);
    const segmentMean = mean(this.prices.slice(start, t));

    const point: BocpdPoint = { index: t - 1, price, cpRecent, mapRunLength, segmentMean };
    this.points.push(point);
    return point;
  }
}

export function bocpdRun(prices: number[], config?: Partial<BocpdConfig>): BocpdPoint[] {
  const warmup = config?.warmup ?? DEFAULT_BOCPD.warmup;
  const det = new Bocpd(config, prices.slice(0, warmup));
  for (const p of prices) det.push(p);
  return det.points;
}

/** First index satisfying the §6.4 fire rule; the caller owns the fire-once policy. */
export function trancheShouldFire(
  points: BocpdPoint[],
  thresholdPhp: number,
): { fire: boolean; at: number | null; reason: string } {
  for (const p of points) {
    if (p.cpRecent >= 0.9 && p.mapRunLength >= 3 && p.mapRunLength < p.index && p.segmentMean >= thresholdPhp) {
      return {
        fire: true,
        at: p.index,
        reason: `changepoint ${p.mapRunLength + 1} points ago; segment mean ${p.segmentMean.toFixed(2)} >= ${thresholdPhp.toFixed(2)}`,
      };
    }
  }
  return { fire: false, at: null, reason: 'no sustained changepoint above threshold' };
}

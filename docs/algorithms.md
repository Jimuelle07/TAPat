# TAPat Algorithms

Exact specifications for the five algorithms behind TAPat's automatic decisions, so each can be implemented from this document alone.

Last updated: 2026-11-05

Owner: Dev2. Consumers: the intake service (names, matcher, CRC), the Tranche Agent (BOCPD), the Freeze Agent (CMS, MIDAS-F), and the fixture generators. The algorithms themselves live in `packages/agent/src/algorithms/**` (`@tapat/agent`, pure); the services that call them live in `apps/server/src/services/**`.

Read with [system-design.md](./system-design.md) §6 for how each algorithm is called, and [api-and-data.md](./api-and-data.md) §5 for the fixture file paths.

---

## 1. Conventions

| Rule | Detail |
|---|---|
| Location | `packages/agent/src/algorithms/{names,matcher,crc,bocpd,cms,midas}.ts` (the `@tapat/agent` package) |
| Purity | No I/O, no `process.env`, no SQLite, no network, no `Date.now()` default arguments. Data comes in as arguments; results go out as values. |
| Dependency direction | `matcher` imports `names` and `crc`. `midas` imports `cms`. Nothing imports `db/`, `velo/`, `agents/` or `services/` — those live in `apps/server`, which imports this package, never the reverse. |
| Determinism | Same input → identical output, on every run and every machine. No `Math.random()`, no locale-sensitive comparison (`String.prototype.localeCompare` is banned), no `Intl`. |
| Numbers | Scores and probabilities are rounded to 6 decimals (`round6(x) = Math.round(x * 1e6) / 1e6`) before any comparison or storage. Money never appears here. |
| Tests | Vitest, colocated as `packages/agent/src/algorithms/<name>.test.ts`. The vectors in §12 are mandatory. |

The three published methods:

| Algorithm | Source | Decision it makes |
|---|---|---|
| Conformal Risk Control | Angelopoulos et al. 2022, arXiv:2208.02814 | approve / reject / uncertain a beneficiary, with a bounded wrongful-denial rate |
| Bayesian Online Changepoint Detection | Adams & MacKay 2007, arXiv:0710.3742 | fund a tranche only on a sustained price shift above the LGU threshold |
| MIDAS-F | Bhatia et al., arXiv:1911.04464 and arXiv:2009.08452 | freeze a station whose tap pattern is anomalous |

Jaro-Winkler and Count-Min Sketch are standard building blocks, written in-house (~40 and ~60 lines) so the demo has no extra dependencies.

---

## 2. Deterministic randomness (generators only)

Fixtures must be byte-reproducible, so every generator uses the same seeded PRNG. This module is used by `apps/server/scripts/*` and **never** by `packages/agent/src/algorithms/*`.

`apps/server/scripts/lib/rng.ts`:

```ts
export function mulberry32(seed: number): () => number;
export function gaussian(rand: () => number, mean: number, sigma: number): number;
export function round2(x: number): number;
```

### 2.1 mulberry32

```ts
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
```

* Uniform in `[0, 1)`.
* One call advances the state exactly once. **Draw order is part of the contract**: any change to the number or order of draws changes every fixture and invalidates the MIDAS threshold. Never "skip" a draw — when a value is overwritten (the price spike), the draw is still consumed.

### 2.2 Box-Muller Gaussian

```ts
export function gaussian(rand: () => number, mean: number, sigma: number): number {
  let u1 = rand();
  while (u1 === 0) u1 = rand();            // log(0) guard; consumes an extra draw only if u1 is exactly 0
  const u2 = rand();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + sigma * z;
}
```

* Two draws per value (plus the rare re-draw when `u1 === 0`).
* `round2(x) = Math.round(x * 100) / 100` is applied at the point of writing a price, never inside a draw.

---

## 3. `names.ts` — Filipino name normalization

Normalization is the only reason "Dela Cruz", "De la Cruz", and "Delacruz" ever compare as the same string. It produces one canonical string per field, plus a middle initial and an extracted suffix.

### 3.1 Types

```ts
export interface RawName {
  last: string;
  first: string;
  middle: string;
  suffix: string | null;
  birthdate: string;      // YYYY-MM-DD
  plate: string;
  toda: string;
  barangay: string;
}

export interface NormalizedName {
  last: string;                    // canonical surname, space-separated after particle merging
  first: string;
  middle: string;
  middleInitial: string | null;    // first character of middle, or null when middle is empty
  suffix: string | null;           // 'jr' | 'sr' | 'ii' | 'iii' | 'iv' | null
  tokens: string[];                // canonical surname tokens, kept for the UI and debugging
}

export function stripDiacritics(input: string): string;
export function normalizeToken(raw: string): string;
export function normalizeSurname(raw: string): { value: string; tokens: string[] };
export function normalizePerson(raw: RawName): NormalizedName;
export function normalizePlate(raw: string): string;
export function ageOn(birthdate: string, onDate: string): number | null;
```

### 3.2 Token pipeline

`normalizeToken` performs, in this order:

1. `stripDiacritics`: `input.normalize('NFD').replace(/\p{M}+/gu, '')` — so `ñ` → `n`, `é` → `e`, `ñ` never survives.
2. Lowercase (`toLowerCase`, not locale-aware).
3. Replace every character outside `[a-z0-9\s]` with a space — this removes `.`, `,`, `-`, `'`, and the particle apostrophes.
4. Collapse whitespace and trim; split on `\s+` into tokens; drop empties.
5. Substitute the known abbreviations, token by token: `ma` → `maria`, `sto` → `santo`, `sta` → `santa`.
6. Extract a trailing suffix: while the last token is in `{jr, sr, ii, iii, iv}`, pop it and keep the popped value as `suffix` (rightmost wins; `"Juan Santos Jr."` → tokens `[juan, santos]`, suffix `jr`).
7. Merge particle runs (below).

### 3.3 Particle-run merging

Particles are `{de, del, dela, la, los, delos, san}`. A *run* is a maximal sequence of consecutive particle tokens. A run is concatenated with the token that follows it.

```
PARTICLES = new Set(['de', 'del', 'dela', 'la', 'los', 'delos', 'san'])

mergeParticles(tokens):
  out = []
  i = 0
  while i < tokens.length:
    if PARTICLES.has(tokens[i]):
      run = ''
      while i < tokens.length and PARTICLES.has(tokens[i]):
        run += tokens[i]
        i += 1
      if i < tokens.length:
        run += tokens[i]
        i += 1
      out.push(run)
    else:
      out.push(tokens[i])
      i += 1
  return out
```

Traces (this is the behaviour the tests pin):

| Input | Tokens after 1–6 | After merging |
|---|---|---|
| `Dela Cruz` | `[dela, cruz]` | `[delacruz]` |
| `De la Cruz` | `[de, la, cruz]` | `[delacruz]` |
| `Delacruz` | `[delacruz]` | `[delacruz]` |
| `Dela Cruz Santos` | `[dela, cruz, santos]` | `[delacruz, santos]` |
| `San Roque` | `[san, roque]` | `[sanroque]` |
| `Ma. Teresa` (first name) | `[maria, teresa]` | `[maria, teresa]` |
| `Maria Theresa` (first name) | `[maria, theresa]` | `[maria, theresa]` |

`value = tokens.join(' ')` — a single space between merged groups. `tokens` is the merged array. The rule is applied to `last`, `first`, and `middle` alike so behaviour is uniform; on a first name it is a no-op unless someone is actually called "de la …".

### 3.4 Other helpers

```ts
normalizePlate(raw) = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
// "abc 1234", "ABC-1234", " Abc1234 "  ->  "ABC1234"

middleInitial = middle.length > 0 ? middle[0] : null
```

`ageOn(birthdate, onDate)` returns completed years: parse both as UTC `YYYY-MM-DD`; return `null` when the birthdate is missing or unparseable; subtract one year when the (month, day) of `onDate` precedes the (month, day) of the birthdate. `onDate` is the program start date in Asia/Manila, passed in by the caller — this module never reads the clock.

Empty or missing fields become `''` (and `middleInitial === null`), never `undefined`, so the matcher has one shape to handle.

---

## 4. `matcher.ts` — Jaro-Winkler and pair probability

### 4.1 Jaro-Winkler

```ts
export function jaroWinkler(a: string, b: string): number;
export function jaro(a: string, b: string): number;
```

Jaro, exactly:

1. If `a === b` return `1`. If either is empty return `0`.
2. `window = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1)`.
3. Match: `aMatch`, `bMatch` boolean arrays of `false`. For each `i` in `a`, scan `j` from `max(0, i - window)` to `min(b.length - 1, i + window)`; on the first `j` with `!bMatch[j] && a[i] === b[j]`, set both flags and `matches++`, then stop scanning for that `i`.
4. Transpositions: walk `a` left to right; for every matched `a[i]`, advance `k` in `b` to the next matched-but-unvisited position; if `a[i] !== b[k]` then `t++`. `transpositions = t / 2`.
5. If `matches === 0` return `0`.
6. `jaro = (matches / a.length + matches / b.length + (matches - transpositions) / matches) / 3`.

Winkler boost:

```
prefix = number of equal leading characters, capped at 4
jw = jaro + prefix * 0.1 * (1 - jaro)
```

Scale is **0.1** and the prefix cap is **4** — these are constants, not parameters. Compares are plain `<` on code units; no locale.

### 4.2 Pair match probability

```ts
export interface MatchRecord extends NormalizedName {
  birthdate: string | null;
  barangay: string | null;
}

export function pairProbability(a: MatchRecord, b: MatchRecord): number;
export function middleInitialScore(a: string | null, b: string | null): number;   // 1 | 0.5 | 0
export function sigmoid(x: number): number;
```

```
lastSim  = jaroWinkler(a.last,  b.last)
firstSim = jaroWinkler(a.first, b.first)
mi       = middleInitialScore(a.middleInitial, b.middleInitial)

nameSim  = 0.5 * lastSim + 0.35 * firstSim + 0.15 * mi

x = 10 * (nameSim - 0.85)
x += 2.5   when both birthdates are present and equal
x += -2.5  when both birthdates are present and differ
x += 0     when either birthdate is missing
x += 1.5   when both barangays are present and equal after normalization (lowercase, punctuation removed)
x += 0     otherwise

p = sigmoid(x)
if (a.suffix !== null && b.suffix !== null && a.suffix !== b.suffix) p *= 0.2
return round6(clamp(p, 0, 1))
```

`middleInitialScore`: `1` when both are non-null and equal, `0.5` when either is null, `0` when both are non-null and differ.

`sigmoid(x) = 1 / (1 + Math.exp(-x))`, guarded for stability: `x <= -30 → 0`, `x >= 30 → 1`, else the formula. (Without the guard `Math.exp(710)` is `Infinity`.)

The suffix penalty is applied **after** the sigmoid, so a Jr/Sr pair with an otherwise perfect name and an identical birthdate scores at most `0.2`.

### 4.3 Genuineness score

```ts
export function genuinenessScores(records: MatchRecord[]): number[];
```

For the uploaded file in **file order**, `p(i, j)` is `pairProbability(records[i], records[j])`:

```
s[0] = 1
s[i] = 1 - max over j < i of p(i, j)      (0 when there is no earlier row)
```

The score is stored to 6 decimals. Position matters: a duplicate is only a duplicate relative to the record before it, which is exactly how a masterlist is built (oldest entry first).

### 4.4 Hard rules

```ts
export type HardRuleCode = 'UNDERAGE' | 'PLATE_MULTI_NAME' | 'DUPLICATE_PLATE';

export function applyHardRules(
  records: MatchRecord[],
  opts: { programStartDate: string },     // YYYY-MM-DD
): Map<number, HardRuleCode>;              // record index -> rule, only for blocked records
```

Hard rules run **before** scoring and always block, regardless of any probability.

| Rule | Condition | Action |
|---|---|---|
| `UNDERAGE` | `ageOn(birthdate, programStartDate) < 18` | reject that record |
| `PLATE_MULTI_NAME` | within one group of records sharing `normalizePlate(plate)`, some pair has `p < 0.5` | reject **every** record in that group |
| `DUPLICATE_PLATE` | within one group of records sharing `normalizePlate(plate)`, pairs have `p >= 0.5` | keep the earliest record, reject every later one |

Order of evaluation per group: compute all pairwise `p` inside the group first; if any pair is `< 0.5` apply `PLATE_MULTI_NAME` to the whole group and stop; otherwise apply `DUPLICATE_PLATE`. A missing/empty plate is never grouped (no plate means no plate rule).

`UNDERAGE` wins over a plate rule when both apply to the same record.

### 4.5 Decision assembly

```ts
export type IntakeStatus = 'approved' | 'rejected' | 'uncertain';

export interface IntakeDecision {
  index: number;
  status: IntakeStatus;
  score: number;
  ruleCode: HardRuleCode | null;
  reason: string;               // human sentence stored in beneficiaries.decision_reason
  duplicateOfIndex: number | null;
}

export function decideIntake(
  records: MatchRecord[],
  opts: { programStartDate: string; lambdaLo: number; lambdaHi: number },
): IntakeDecision[];
```

```
blocked = applyHardRules(records, opts)
scores  = genuinenessScores(records)

for each i in file order:
  if blocked.has(i):
     status = 'rejected', ruleCode = blocked.get(i), score = scores[i]
  else:
     status = crcDecide(scores[i], opts)      // §5
     ruleCode = null
  duplicateOfIndex = argmax_{j < i} p(i, j)  when scores[i] < 1, else null
```

`reason` templates (fixed strings, used by the UI and the CSV):

| Case | `reason` |
|---|---|
| underage | `age {age} is below 18 on {programStartDate}` |
| plate shared by different names | `plate {plate} appears on records of different people` |
| duplicate plate | `plate {plate} duplicates record {j}` |
| CRC reject | `genuineness {score} below reject threshold {lambdaLo}; closest earlier record {j} at p={p}` |
| CRC uncertain | `genuineness {score} between {lambdaLo} and {lambdaHi}` |
| approved | `genuineness {score} at or above {lambdaHi}` |

Uncertain records are not decided by this function's caller: they become `evidence_requested` (or surface the Telegram deep link), per [system-design.md](./system-design.md) §6.1.

---

## 5. `crc.ts` — Conformal Risk Control

The LGU picks two error rates: `alpha` (maximum rate of wrongful denials) and `beta` (maximum rate of ghost admissions). CRC turns a labeled calibration set into two thresholds that respect them **with a finite-sample correction**, instead of a hand-tuned cutoff.

Program defaults: `alpha = 0.05`, `beta = 0.02`.

### 5.1 Types

```ts
export interface CalibrationPoint {
  score: number;      // 1 - pairProbability(a, b), 6 decimals
  genuine: boolean;   // true = two different people (approving is correct)
}

export interface CrcThresholds {
  lambdaLo: number;
  lambdaHi: number;
  alpha: number;
  beta: number;
  n: number;                 // number of calibration points
  wrongfulDenialRate: number;  // empirical, at lambdaLo
  ghostAdmissionRate: number;  // empirical, at lambdaHi
  feasible: boolean;
}

export function riskDenial(points: CalibrationPoint[], lambda: number): number;
export function riskAdmission(points: CalibrationPoint[], lambda: number): number;
export function calibrateCrc(points: CalibrationPoint[], alpha: number, beta: number): CrcThresholds;
export function crcDecide(score: number, t: Pick<CrcThresholds, 'lambdaLo' | 'lambdaHi'>): IntakeStatus;
```

### 5.2 The risk functions

With `n` points, the finite-sample corrected estimated risk at threshold `lambda` is

```
R_denial(lambda)  = (n / (n + 1)) * mean_i( 1{ genuine_i AND score_i <  lambda } ) + 1 / (n + 1)
R_admission(lambda) = (n / (n + 1)) * mean_i( 1{ ghost_i   AND score_i >= lambda } ) + 1 / (n + 1)
```

Both are monotone in `lambda` in opposite directions: raising `lambda` rejects more genuine records (risk up) and admits fewer ghosts (risk down). That monotonicity is what makes the two searches a scan rather than a search.

### 5.3 Calibration

Grid `G = {0.00, 0.01, 0.02, …, 1.00}` (101 values, generated as `round6(k / 100)` — never accumulated by addition).

```
lambdaLo = max { lambda in G : R_denial(lambda)  <= alpha }
lambdaHi = min { lambda in G : R_admission(lambda) <= beta  }

if lambdaLo is undefined: lambdaLo = 0.00,  feasible = false
if lambdaHi is undefined: lambdaHi = 1.00,  feasible = false
if lambdaLo > lambdaHi:   lambdaLo = lambdaHi          // empty uncertain band
```

* `lambdaLo = 0.00` always satisfies the denial bound (`R_denial(0) = 1/(n+1)`, which is ≤ `alpha` for `n ≥ 19`), so the undefined branch is defensive only.
* `lambdaHi = 1.00` still admits a record whose score is exactly `1` (the first row always scores `1`). That is intentional: the first row can never be a duplicate of anything, and no calibration point may score `1` as a ghost.
* `wrongfulDenialRate = mean_i(1{genuine_i AND score_i < lambdaLo})` and `ghostAdmissionRate = mean_i(1{ghost_i AND score_i >= lambdaHi})` — the **uncorrected** empirical rates, reported by `GET /api/intake/calibration` as `CalibrationResponse` (`{ alpha, beta, lambdaLo, lambdaHi, n, wrongfulDenialRate, ghostAdmissionRate, feasible }`). Those eight names are exactly the `CrcThresholds` fields, so the endpoint serializes the object §5.1 returns with no renaming.

### 5.4 Decision

```
if score >= lambdaHi  -> 'approved'
if score <  lambdaLo  -> 'rejected'
otherwise             -> 'uncertain'
```

With `lambdaLo = lambdaHi` the uncertain band is empty and every record is decided.

### 5.5 Calibration set

`fixtures/calibration/labeled.json`, generated by `gen-calibration.ts` seed 42: `n = 400` points — 320 genuine (different people), 60 ghost duplicates with name variants, 20 hard negatives such as a Jr/Sr pair that must **not** be treated as a duplicate (label `genuine`).

Each calibration entry is a pair, so its score is `1 - pairProbability(a, b)` directly; there is no file-order prefix to subtract. An in-file duplicate would be scored with §4.3 instead.

---

## 6. `bocpd.ts` — Bayesian Online Changepoint Detection

A price series is a sequence of segments with different means. BOCPD maintains a probability distribution over the current *run length* (how many points since the last changepoint); a sustained shift drives that mass to small run lengths. The Tranche Agent fires on a changepoint that is both recent and sustained above the LGU threshold.

### 6.1 Model

| Element | Value | Meaning |
|---|---|---|
| Likelihood | Gaussian, **known** variance `sigma2` | `sigma2 = max(sampleVariance(x_1..x_10), 0.05)`, frozen at warm-up |
| Prior on each segment's mean | Normal, `mu0 = mean(x_1..x_10)`, `var0 = 4` | wide enough that a 12-peso shift is obvious |
| Hazard | `H = 1/50` | constant changepoint rate per point |
| Run-length cap | `R = 200` | truncation; probabilities beyond it are dropped |
| Warm-up | first 10 points | used only to set `mu0` and `sigma2`; scored from point 1 on |

### 6.2 Types

```ts
export interface BocpdConfig {
  hazard: number;            // 1/50
  maxRunLength: number;      // 200
  warmup: number;            // 10
  priorMeanVar: number;      // 4
  sigmaSquareFloor: number;  // 0.05
  cpRecentWindow: number;    // 10
}

export const DEFAULT_BOCPD: BocpdConfig;

export interface BocpdPoint {
  index: number;          // 0-based index into the price series
  price: number;
  cpRecent: number;       // sum of P(r_t = r) for r < 10
  mapRunLength: number;   // argmax_r P(r_t = r)
  segmentMean: number;    // mean of the last mapRunLength + 1 prices
}

export class Bocpd {
  constructor(config?: Partial<BocpdConfig>, warmupValues?: number[]);
  push(price: number): BocpdPoint;
  readonly points: BocpdPoint[];
  readonly sigma2: number;
}

export function bocpdRun(prices: number[], config?: Partial<BocpdConfig>): BocpdPoint[];
export function trancheShouldFire(
  points: BocpdPoint[],
  thresholdPhp: number,
): { fire: boolean; at: number | null; reason: string };
```

The constructor's `warmupValues` (only the first `warmup` of them are used) establish the frozen constants for the instance: `mu0 = mean(warmupValues)` and `sigma2` = their sample variance (`n - 1` denominator) floored at `sigmaSquareFloor`. With 1 or 2 values the variance is not estimated, so `sigma2` is the floor; with no values `mu0` is left unset until the first `push` adopts that price as `mu0`, while `sigma2` remains the floor. `sigma2` is public and read-only: it is the known variance used by every predictive likelihood and posterior update, and it never changes after construction.

The Tranche Agent uses `push` once per `PRICE_TICK_MS` so it can broadcast each point; `bocpdRun` is the same recursion over an array, used by tests and the fixture generator's checks.

### 6.3 Full recursion

State after observing `x_1..x_t`: for each run length `r ∈ [0, R]`, a posterior weight `P_t(r)`, a posterior mean `mu[r]`, and a posterior variance `var[r]`. `P` is held in log space; `mu`/`var` in linear space.

**Warm-up.** `mu0 = mean(x_1..x_10)`, `sigma2 = max(sampleVariance(x_1..x_10), 0.05)` where `sampleVariance` uses `n - 1`. If fewer than 3 points are supplied, `sigma2 = sigmaSquareFloor`.

**Initialise** at `t = 0`:

```
logP = [0]          (P_0(0) = 1)
mu   = [mu0]
var  = [var0]
```

**For each new observation `x_t`, `t = 1, 2, …`:**

1. **Predictive probability per run length.** With a known variance and a normal prior on the mean, the marginal of the next point is normal:

   ```
   for each active r:
     vPred   = var[r] + sigma2
     logPi[r] = -0.5 * log(2 * PI * vPred) - (x_t - mu[r])^2 / (2 * vPred)
   ```

2. **Growth probabilities** (no changepoint — the run continues):

   ```
   logGrowth[r + 1] = logP[r] + logPi[r] + log(1 - H)      for every active r
   ```

3. **Changepoint probability** (run restarts at 0):

   ```
   logCP = logSumExp_r( logP[r] + logPi[r] ) + log(H)
   ```

4. **Assemble and normalize** (`logSumExp` = `m + log(sum(exp(x - m)))` with `m = max(x)`; the `exp` of a value `> 700` apart is skipped):

   ```
   newLogP[0]   = logCP
   newLogP[r+1] = logGrowth[r+1]
   L = logSumExp(newLogP)
   newLogP[k] -= L
   ```

5. **Posterior update** (conjugate normal–normal with known `sigma2`, per run length):

   ```
   for each r with weight logGrowth[r+1]:
     prec      = 1 / var[r] + 1 / sigma2
     newVar[r+1] = 1 / prec
     newMu[r+1]  = newVar[r+1] * ( mu[r] / var[r] + x_t / sigma2 )
   newVar[0] = 1 / (1 / var0 + 1 / sigma2)                  // r = 0: x_t opens the new segment,
   newMu[0]  = newVar[0] * ( mu0 / var0 + x_t / sigma2 )    // so the prior absorbs x_t
   ```

6. **Truncate** at `R = 200`: drop every index `> R`, then renormalize `P` (`L = logSumExp(newLogP); newLogP[k] -= L`).

7. **Report** for this point:

   ```
   cpRecent     = sum over r < cpRecentWindow of exp(newLogP[r])
   mapRunLength = index of the maximum of newLogP (lowest index on ties)
   segmentMean  = mean( x_{t - mapRunLength - 1} .. x_{t - 1} )   // 0-based indices, mapRunLength + 1 values
   ```

   `segmentMean` uses 0-based indices: with `t` observed points, the current point is index `t - 1`, so the segment starts at `t - 1 - mapRunLength`. Clamp the start at 0.

### 6.4 Fire rule

```ts
fire  = cpRecent >= 0.9
     && mapRunLength >= 3
     && mapRunLength < point.index
     && segmentMean >= thresholdPhp
```

`thresholdPhp` is `program.price_threshold_php` (default `65.00`).

The clause `mapRunLength >= 3` forces the average over at least 4 points: a single outlier can never push `segmentMean` over the threshold. The clause `mapRunLength < point.index` requires the changepoint to be strictly in the past, not "the series just started": `point.index` is the point's original 0-based index in the price series (`pointsObserved - 1` for that point), so the rule gives the same answer whether the caller passes the full history or a trailing slice. Combined, the earliest possible fire is the 4th point of a new segment (on the fixture: the step starts at index 30, the fire lands at index 33).

The agent fires at most once per program (`program.tranche_fired`); `trancheShouldFire` returns the first index that satisfies the rule and is pure — the caller owns the "once" policy.

### 6.5 The price fixture

`fixtures/prices/doe-diesel-sim.json`, produced by `gen-prices.ts` seed 3: 45 daily points.

| Points (1-based) | Value |
|---|---|
| 1–30 | `58.50 + N(0, 0.40)` |
| 15 | overwritten to exactly `66.00` — a one-day spike that must **not** fire |
| 31–45 | `71.00 + N(0, 0.50)` |

The fixture is labelled `"source": "simulated"` and is displayed as such. The spike sits above the ₱65 threshold on its own, so it tests exactly the failure mode that matters: a price alert that fires on one noisy day.

---

## 7. `cms.ts` — Count-Min Sketch

```ts
export interface SketchConfig {
  depth: number;    // 2
  width: number;    // 1024
  seeds: number[];  // [0x9747b28c, 0x85ebca6b]
}

export const DEFAULT_SKETCH: SketchConfig;

export interface SketchState {
  current: number[];        // depth * width, decayed each tick
  totals: number[];         // depth * width, never decayed
  totalCount: number;       // sum of accepted counts (one per accepted event)
  distinctKeys: string[];   // keys accepted into totals, for the category count
}

export function fnv1a32(input: string, seed: number): number;
export function sketchInit(cfg?: SketchConfig): SketchState;
export function sketchAdd(state: SketchState, key: string, target: 'current' | 'totals' | 'both', cfg?: SketchConfig): void;
export function sketchEstimate(state: SketchState, key: string, cfg?: SketchConfig): number;
export function sketchDecay(state: SketchState, factor: number): void;
export function sketchClone(state: SketchState): SketchState;
export function chiSquare(observed: number, total: number, categories: number): number;
```

### 7.1 FNV-1a 32-bit with a seed

```ts
export function fnv1a32(input: string, seed: number): number {
  let h = (0x811c9dc5 ^ seed) >>> 0;                 // offset basis mixed with the seed
  const bytes = new TextEncoder().encode(input);     // UTF-8; keys are ASCII in practice
  for (const b of bytes) {
    h = (h ^ b) >>> 0;
    h = Math.imul(h, 0x01000193) >>> 0;              // FNV prime 16777619
  }
  return h >>> 0;
}

bucket(key, row) = fnv1a32(key, cfg.seeds[row]) % cfg.width
```

All arithmetic is 32-bit via `>>> 0` and `Math.imul`; never use `*` on hashes (JS doubles lose the low bits above 2^53).

### 7.2 Operations

* `sketchAdd` increments `bucket(key, r)` by 1 in every row, for the requested target.
* `sketchEstimate` returns the **minimum** over rows of `current[bucket(key, r)]`.
* `sketchDecay(factor)` multiplies every entry of `current` by `factor` (0.6) — leaked mass from old ticks fades.
* `totalCount` counts accepted events (not memory cells), and one key counts once in `distinctKeys` no matter how often it appears.
* `sketchClone` deep-copies both arrays and the key list, so `midas.ts` can stay value-oriented.

### 7.3 Category score

```ts
export function chiSquare(observed: number, total: number, categories: number): number {
  if (total <= 0 || categories <= 1) return 0;
  const expected = total / categories;
  return (Math.pow(observed - expected, 2) * categories * categories) / (total * (categories - 1));
}
```

That is the standard chi-squared score for categorical data:

```
chi2 = (a - s/t)^2 * t^2 / (s * (t - 1))      with a = observed, s = total, t = categories
```

It grows when one category dominates a background that should be spread out.

---

## 8. `midas.ts` — MIDAS-F

Every tap is an edge `card -> station`. Three sketches score it: the edge itself, the source node (the card), and the destination node (the station). MIDAS-F adds *filtering*: an edge whose score is already over the threshold is counted in the current window but **not** in the background totals, so an attack inflates the score instead of being absorbed into the norm.

### 8.1 Types

```ts
export interface EdgeEvent {
  tick: number;
  cardId: string;                   // card identity: cards.id for an authorized tap (Read card or Simulate tap), taps.card_ref for a burst edge
  stationId: string;
  amountStroops: string | bigint;   // carried for logging; not used by the score
}

export interface MidasConfig {
  threshold: number;      // from apps/server/config/midas.json
  decay: number;          // 0.6
  sketch: SketchConfig;   // DEFAULT_SKETCH
}

export interface MidasScore {
  tick: number;
  edge: number;           // chi-square of the edge sketch
  source: number;         // chi-square of the source-node sketch
  destination: number;    // chi-square of the destination-node sketch
  score: number;          // log1p(max of the three)
  filtered: boolean;      // score >= threshold
}

export interface MidasState {
  tick: number;
  edge: SketchState;
  source: SketchState;
  destination: SketchState;
}

export function initMidasState(cfg?: Partial<MidasConfig>): MidasState;
export function stepMidas(
  state: MidasState,
  event: EdgeEvent,
  cfg: MidasConfig,
): { state: MidasState; score: MidasScore };
export function replayMidas(events: EdgeEvent[], cfg: MidasConfig): MidasScore[];
```

### 8.2 `stepMidas`

```
1. if event.tick > state.tick:
     sketchDecay(edge.current, 0.6); sketchDecay(source.current, 0.6); sketchDecay(destination.current, 0.6)
     state.tick = event.tick
2. keyEdge = `${cardId}|${stationId}`
   sketchAdd(edge.current,         keyEdge)
   sketchAdd(source.current,       cardId)
   sketchAdd(destination.current,  stationId)
3. a_edge = sketchEstimate(edge, keyEdge)          a_src = sketchEstimate(source, cardId)
   a_dst  = sketchEstimate(destination, stationId)
   edge   = chiSquare(a_edge, edge.totalCount,        edge.distinctKeys.length)
   source = chiSquare(a_src,  source.totalCount,      source.distinctKeys.length)
   dest   = chiSquare(a_dst,  destination.totalCount, destination.distinctKeys.length)
4. score = log1p(max(edge, source, dest))          // Math.log1p, natural log
5. filtered = score >= cfg.threshold
6. if not filtered:
     sketchAdd(edge.totals, keyEdge); sketchAdd(source.totals, cardId); sketchAdd(destination.totals, stationId)
     // this also increments each totalCount and registers the keys in distinctKeys
7. return the new state (arrays cloned) and the score
```

Notes that matter:

* Decay happens **once per tick change**, before the event of the new tick, never per event. Ten edges in one tick each see the same decayed background.
* `s` and `t` come from the *totals*, `a` from the *current* window. An edge that is filtered keeps inflating `a` while `s`/`t` stay put, which is the intended ratchet.
* Scores are rounded to 6 decimals before comparison with the threshold.
* The amount is irrelevant to the score by design: MIDAS-F is a structure-anomaly detector, not an amount detector. Amount anomalies are the LGU's `NEAR_CAP_STREAK` rule ([system-design.md](./system-design.md) §6.5).

### 8.3 Threshold calibration

`apps/server/scripts/calibrate-midas.ts`:

1. For `seed = 1..50`: generate an honest stream with `gen-taps.ts` (`--mode honest --seed <seed> --ticks 60`), replay it through `stepMidas` with `threshold = Infinity` (so nothing is filtered and the background stays clean), and record the maximum `score` over the stream.
2. `maxHonestScore = max over the 50 seeds`.
3. `threshold = round2(1.25 * maxHonestScore)` — a 25% margin over the worst honest stream.
4. Write `apps/server/config/midas.json`:

```json
{
  "threshold": 3.42,
  "maxHonestScore": 2.74,
  "seedCount": 50,
  "ticks": 60,
  "decay": 0.6,
  "depth": 2,
  "width": 1024,
  "hashSeeds": ["0x9747b28c", "0x85ebca6b"],
  "generatedBy": "calibrate-midas.ts",
  "generatedAt": "2026-11-06T00:00:00.000Z"
}
```

The numeric values are whatever the script computes — treat the file as generated output and never hand-edit it. It is committed so the demo runs without a calibration step.

### 8.4 Freeze Agent rules on top of MIDAS-F

MIDAS-F is one of three triggers; the other two are the LGU's plain-English rules, and either can freeze a station on its own ([system-design.md](./system-design.md) §6.5):

| Rule | Condition |
|---|---|
| `MIDAS_F` | `score >= midas.json.threshold` |
| `NEAR_CAP_STREAK` | 3 consecutive authorized taps at one station, each `amount_stroops >= 0.9 * program.per_tap_cap_stroops` |
| `VOLUME_SPIKE` | taps at one station in the last 10 ticks exceed `3 * baselineMeanPer10(station)` |

`baselineMeanPer10(station) = (edges at that station in the 60-tick honest replay / 60) * 10`.

---

## 9. Fixture generators

All three scripts live in `apps/server/scripts/`, import `lib/rng.ts`, and write into `fixtures/`. Run them with `pnpm --filter server tsx scripts/<name>.ts`; every generated fixture records its `source` (always `"simulated"`) and its seed so a reviewer can reproduce it.

### 9.1 `gen-prices.ts`

```
pnpm --filter server tsx scripts/gen-prices.ts --seed 3 --out fixtures/prices/doe-diesel-sim.json
```

Algorithm (draw order is contractual):

```
rand = mulberry32(3)
n = 0
for d = 1..45:
   if d <= 30: price = gaussian(rand, 58.50, 0.40)
   else:       price = gaussian(rand, 71.00, 0.50)
   n = n + 1                                  // the draw is consumed even for d = 15
   if d == 15: price = 66.00                  // overwrite after the draw
   points.push({ idx: d, price_php: round2(price) })
```

Output shape — exactly the fixture shape in [api-and-data.md](./api-and-data.md) §4:

```json
{
  "source": "simulated",
  "currency": "PHP",
  "unit": "L",
  "seed": 3,
  "points": [
    { "idx": 1, "price_php": 58.81 },
    { "idx": 15, "price_php": 66.0 }
  ]
}
```

Exactly 45 entries, `idx` 1..45, `price_php` a 2-decimal number. The Tranche Agent reads `points` in order and maps fixture `idx` (1-based) to `BocpdPoint.index` (0-based) by subtracting 1; `points[idx].price_php` is the price it feeds the model.

### 9.2 `gen-calibration.ts`

```
pnpm --filter server tsx scripts/gen-calibration.ts --seed 42 --out fixtures/calibration/labeled.json
```

Composition — 400 pairs, drawn in this order (320 genuine, then 60 ghosts, then 20 hard negatives, so the rng stream is stable if a count later changes at the end):

| Group | Count | How | Label |
|---|---|---|---|
| genuine | 320 | two different people from the name pool: different surnames, or the same surname with different first names and birthdates at least 1 year apart | `genuine` |
| ghost | 60 | the same person written twice: particle variants (`Dela Cruz` / `De la Cruz` / `Delacruz`), `ma`/`sto`/`sta` substitutions, a missing middle name, or a birthdate dropped on one side | `ghost` |
| hard negatives | 20 | `Jr` vs `Sr` on the same name and the same birthdate; must stay `genuine` because they are different people | `genuine` |

Name pool: 24 Filipino surnames (including `Dela Cruz`, `Santos`, `Reyes`, `Bautista`, `Garcia`, `Villanueva`), 20 first names (including `Juan`, `Maria`, `Teresa`, `Pedro`, `Ana`, `Lito`, `Ramon`), 8 barangays. `birthdate` uniform in `1960-01-01..2005-12-31`; genuine pairs force a different birth year.

Output shape:

```json
{
  "generator": "gen-calibration.ts",
  "seed": 42,
  "alpha": 0.05,
  "beta": 0.02,
  "counts": { "genuine": 320, "ghost": 60, "hardNegative": 20 },
  "records": [
    {
      "id": "c0001",
      "label": "genuine",
      "a": { "last": "Dela Cruz", "first": "Juan", "middle": "Santos", "suffix": null,
             "birthdate": "1980-03-02", "barangay": "San Roque" },
      "b": { "last": "Reyes", "first": "Pedro", "middle": "Cruz", "suffix": null,
             "birthdate": "1975-11-20", "barangay": "San Roque" }
    }
  ]
}
```

The CRC loader computes `score = 1 - pairProbability(a, b)` and `genuine = label === 'genuine'`. If the resulting thresholds do not produce the required decision mix on the masterlist, **edit the fixture rows, never `alpha`, `beta`, or the weights**.

### 9.3 `gen-taps.ts`

```
pnpm --filter server tsx scripts/gen-taps.ts --mode honest --seed 7 --ticks 60 --out fixtures/taps/honest-history.json
pnpm --filter server tsx scripts/gen-taps.ts --mode burst  --seed 11 --out fixtures/taps/burst.json
```

**Honest mode** (used by the Freeze Agent warm-up with seed 7, and by `calibrate-midas.ts` with seeds 1..50):

```
rand = mulberry32(seed)
cards = virtual01 .. virtual20
for tick = 0..ticks-1:
   k = rand() < 0.5 ? 1 : 2                     // 1 or 2 taps this tick
   repeat k times:
     card = cards[ floor(rand() * 20) ]
     station = rand() < 0.75 ? 'A' : 'B'
     if this card already has 3 edges at this station within the last 10 ticks: skip (no draw consumed for the amount)
     amountPhp = round2(60 + rand() * 290)      // 60.00 .. 350.00
     push edge { tick: tick + 1, card_ref: card, station_id: station, amount_php: amountPhp }
```

The three-in-ten skip keeps honest streams from tripping `NEAR_CAP_STREAK` or `VOLUME_SPIKE`, so calibration measures MIDAS-F alone. Amounts stay under 90% of the ₱500 cap (350 < 450).

**Burst mode** (the demo's 30 edges):

```
rand = mulberry32(11)
cards = virtual01 .. virtual20
for tick = 0..2:
   for i = 0..9:
     card = cards[(tick * 10 + i) % 20]
     amountPhp = round2(400 + rand() * 100)     // 400.00 .. 500.00, i.e. >= 80% of the cap
     push edge { tick_offset: tick + 1, card_ref: card, station_id: 'B', amount_php: amountPhp }
```

Output shapes — exactly the fixture shapes in [api-and-data.md](./api-and-data.md) §4:

```json
{
  "source": "simulated",
  "seed": 7,
  "tick_ms": 1000,
  "ticks": [
    { "tick": 1, "card_ref": "virtual07", "station_id": "A", "amount_php": 122.4 }
  ]
}
```

```json
{
  "source": "simulated",
  "edges": [
    { "tick_offset": 1, "card_ref": "virtual01", "station_id": "B", "amount_php": 431.7 }
  ]
}
```

The loader converts `amount_php` to stroops with `BigInt(Math.round(amount_php * 1e6)).toString()` at read time; nothing money-shaped is stored twice. Every edge is `simulated`; the value is mirrored into `taps.simulated`, and a burst edge becomes a `taps` row with `status='refused'`, `reason_code='SIMULATED_EDGE'`, `card_id=NULL`, `card_ref=<card_ref>`, and `tick = freezeStartTick + tick_offset`. The Freeze Agent then feeds `card_ref` into `EdgeEvent.cardId`, so the MIDAS key is still `<cardRef>|<stationId>`.

---

## 10. Wiring summary

| Caller | Uses | Per |
|---|---|---|
| `POST /api/intake/upload` | `normalizePerson` → `decideIntake` (which uses `pairProbability`, `genuinenessScores`, `applyHardRules`, `crcDecide`) | one upload |
| `GET /api/intake/calibration` | `calibrateCrc` over `fixtures/calibration/labeled.json` | one request |
| Tranche Agent | `new Bocpd()` + `trancheShouldFire` | one `PRICE_TICK_MS` (700 ms) |
| Freeze Agent | `initMidasState` + `stepMidas` per tap, `replayMidas` for the 60-tick warm-up | one `FREEZE_TICK_MS` (1000 ms) |
| `calibrate-midas.ts` | `replayMidas` × 50 seeds | build time |

Every one of these is a pure call: the caller supplies the numbers and persists what comes back into `agent_decisions`.

Two renames happen only at the persistence boundary, never inside these modules: a `BocpdPoint` becomes SSE/DB `PricePoint` with `idx = point.index + 1`, `pricePhp = point.price`, `cpRecent = point.cpRecent`, `mapR = point.mapRunLength`; and the tranche decision's numbers are stored as `inputs_json { pricePhp, segmentMeanPhp, thresholdPhp, cpRecent, mapR, budgetBeforeStroops }` per [api-and-data.md](./api-and-data.md) §2.2.

---

## 11. Demo trace (why the numbers land)

| Beat | Algorithm output | Effect |
|---|---|---|
| Price feed | BOCPD ignores index 14 (`cpRecent` may spike, `segmentMean` stays ≈58.5 < 65); at index 33–36 `cpRecent ≥ 0.9`, `mapRunLength ≥ 3`, `segmentMean ≈ 71 ≥ 65` → fire | 3 × ₱1,500 funded; D3 skipped as expired |
| Intake upload | CRC: the Dela Cruz ghost lands below `lambdaLo` (rejected), the underage row is blocked by `UNDERAGE`, the two Santos variants land in `[lambdaLo, lambdaHi)` (uncertain) | 1 ghost, 1 underage, 2 evidence requests |
| Burst | MIDAS-F crosses the threshold within the 30 burst edges (the two D2 ₱480 taps alone are far below it) | Station B frozen; settlement claims A only, holds ₱960. `NEAR_CAP_STREAK` needs 3 consecutive *authorized* taps, and the burst edges are `refused`, so it does not fire in the scripted demo |

---

## 12. Mandatory test vectors

Vitest, in `packages/agent/src/algorithms/`. Each row is one `it(...)`.

### 12.1 `names.test.ts`

| Input | Expectation |
|---|---|
| `normalizeSurname('Dela Cruz').value` | `'delacruz'` |
| `normalizeSurname('De la Cruz').value` | `'delacruz'` |
| `normalizeSurname('Delacruz').value` | `'delacruz'` |
| `normalizeSurname('Dela Cruz Santos').tokens` | `['delacruz', 'santos']` |
| `normalizePerson({ first: 'Ma. Teresa', … }).first` | `'maria teresa'` |
| `normalizePerson({ last: 'Peña', … }).last` | `'pena'` |
| `normalizePerson({ last: 'Dela Cruz', suffix: 'Jr.', … }).suffix` | `'jr'` |
| `normalizePlate('abc 1234')` | `'ABC1234'` |
| `normalizePlate('ABC-1234')` | `'ABC1234'` |
| `ageOn('2008-01-02', '2026-11-05')` | `18` |
| `ageOn('2008-11-06', '2026-11-05')` | `17` |
| `ageOn('', '2026-11-05')` | `null` |

### 12.2 `matcher.test.ts`

| Input | Expectation |
|---|---|
| `jaroWinkler('martha', 'marhta')` | `0.961` ± 0.0005 (the published value; pins window, transpositions, and the 0.1 prefix boost) |
| `jaroWinkler('dixon', 'dicksonx')` | `0.813` ± 0.0005 |
| `jaroWinkler('juan', 'juan')` | `1` |
| `jaroWinkler('a', 'b')` | `0` |
| `pairProbability` of `Dela Cruz / De la Cruz / Delacruz`, first `Juan`, birthdate `1980-03-02`, barangay `San Roque` — all three pairings | `>= 0.9` (computed `0.9914`) |
| `pairProbability` of `Juan Dela Cruz Jr` vs `Juan Dela Cruz Sr`, same birthdate | `< 0.5` (computed `0.198`) |
| `genuinenessScores` on two identical records | `[1, 0]` |
| `applyHardRules` with a record aged 17 | that index blocked with `UNDERAGE` |
| `applyHardRules` with one plate on two different people | **both** indices blocked with `PLATE_MULTI_NAME` |
| `applyHardRules` with one plate on the same person twice | the later index blocked with `DUPLICATE_PLATE`, the earlier not blocked |

### 12.3 `crc.test.ts`

| Input | Expectation |
|---|---|
| `calibrateCrc(points from fixtures/calibration/labeled.json, 0.05, 0.02)` | `wrongfulDenialRate <= 0.05`, `ghostAdmissionRate <= 0.02`, `lambdaLo <= lambdaHi`, `feasible === true` |
| the same call | `n === 400`, i.e. `n` equals the number of records in the fixture |
| `crcDecide(1, thresholds)` | `'approved'` |
| `crcDecide(0, thresholds)` | `'rejected'` |
| `riskDenial` monotonicity on 100 synthetic points | non-decreasing in `lambda` |
| `riskAdmission` monotonicity | non-increasing in `lambda` |

### 12.4 `bocpd.test.ts`

| Input | Expectation |
|---|---|
| `bocpdRun(fixtures/prices/doe-diesel-sim.json points)` | `trancheShouldFire(points, 65).fire === true` and `at ∈ [33, 36]` (0-based) |
| the same run, point index 14 (the ₱66.00 spike) | `cpRecent` may exceed 0.9, but `trancheShouldFire` must not report `at === 14`; and no fire occurs at any index `< 31` |
| a constant series `[58.5 × 45]` | never fires |
| `sigma2` on the fixture warm-up | `>= 0.05` (floored) |
| `Bocpd.push` fed one at a time | identical `points` to `bocpdRun` on the same array (incremental == batch) |

### 12.5 `cms.test.ts`

| Input | Expectation |
|---|---|
| `fnv1a32('abc', 0x9747b28c)` | a fixed constant recorded in the test (compute once, then pin) |
| `sketchEstimate` after adding the same key 5 times | `5` for `width = 1024`, `depth = 2` on a small key set |
| `sketchEstimate` never below the true count | property check over 200 random keys |
| `sketchDecay(state, 0.6)` | every `current` entry multiplied by 0.6, `totals` untouched |
| `chiSquare(0, 0, 5)` | `0` |
| `chiSquare(5, 5, 1)` | `0` |
| `chiSquare(10, 100, 10)` | `(10 - 10)^2 * 100 / (100 * 9) = 0` |
| `chiSquare(20, 100, 10)` | `(20 - 10)^2 * 100 / (100 * 9) ≈ 11.111111` |

### 12.6 `midas.test.ts`

| Input | Expectation |
|---|---|
| `calibrate` output with seeds 1..50 (recompute in-test with `threshold = Infinity`) | every honest seed's max score `< midas.json.threshold` |
| `replayMidas(burst.json)` | `some(score.score >= midas.json.threshold)` within the first 30 edges |
| `replayMidas(honest-history.json)` | no edge filtered |
| decay behaviour: two edges in tick 0, one in tick 1 | the tick-1 estimate for the tick-0 edge is `0.6 ×` its pre-decay value (checked through `sketchEstimate`) |
| filtering behaviour: an edge above the threshold twice | `totals` unchanged for that key, `current` increased |

### 12.7 Service-level vectors (detailed in [test-plan.md](./test-plan.md))

| Test | Expectation |
|---|---|
| Tap reason mapping from a mocked `NoirContractError{code: 3}` + the `checkPayment` reason | `expired` → `EXPIRED`; `over_limit` → `OVER_CAP`; `no_agent` / `wrong_agent` / `wrong_asset` / `invalid_amount` → `POLICY_DENIED` |
| Tap mapping from a mocked `NoirContractError{code: 2}` | `INSUFFICIENT_ESCROW`, tap `rejected`, HTTP 200 |
| Tap mapping from a mocked `NoirContractError{code: 6}` / `{code: 8}` / any other code | tap `failed`, `reasonCode === null`, HTTP `502 CHAIN_ERROR`, cause on `chain_txs.error_code` |
| `NoirContractError` on `register`/`fund_escrow`/`claim`/`sweep` | HTTP `502 CHAIN_ERROR`, `message` containing the SDK error name (`CONTRACT_<errorName>`); never a tap reason code |
| Budget webhook idempotency | the same `x-velo-delivery` twice credits budget once |
| Gas status mapping | a failed `velo.gas.submit` (hand-off uncertain) produces `submission_unknown` and no second `sponsor()`/`submit()` for that row |

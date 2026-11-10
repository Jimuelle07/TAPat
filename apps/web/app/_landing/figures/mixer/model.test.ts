import { describe, expect, it } from "vitest";
import {
  CRUDE_RANGE,
  FX_RANGE,
  OPENING,
  OPENING_PUMP,
  TEETH,
  WEEKS_PER_YEAR,
  WEEK_S,
  YEAR_S,
  kin,
  pointerAngleOf,
  pumpFromBenchmark,
  simulateDieselYear,
  stateAt,
  wheelsOf,
} from "./model";

describe("the linkage solves the pump-price formula", () => {
  it("reads the simulator's pump price for any benchmark in range", () => {
    for (let crude = CRUDE_RANGE[0]; crude <= CRUDE_RANGE[1]; crude += 7.3) {
      for (let fx = FX_RANGE[0]; fx <= FX_RANGE[1]; fx += 0.9) {
        expect(kin(crude, fx).pump).toBeCloseTo(pumpFromBenchmark(crude, fx), 9);
      }
    }
  });

  it("puts the pointer where the scale says", () => {
    for (const [crude, fx] of [[80, 57.5], [60, 55], [118, 60.5]] as const) {
      const k = kin(crude, fx);
      expect(k.pointer).toBeCloseTo(pointerAngleOf(pumpFromBenchmark(crude, fx)), 9);
    }
  });

  it("uses a 28:25 gear pair for the 12% VAT", () => {
    expect(TEETH.a / TEETH.b).toBeCloseTo(1.12, 12);
  });
});

describe("the simulator's opening", () => {
  it("is the pump price of the opening benchmark", () => {
    expect(OPENING_PUMP).toBeCloseTo(pumpFromBenchmark(OPENING.crudeUsd, OPENING.phpPerUsd), 1);
    for (const seed of [1, 2, 3, 4, 5, 6, 40]) {
      expect(simulateDieselYear(seed)[0]!.pumpPhp).toBeCloseTo(OPENING_PUMP, 2);
    }
  });

  it("has every Tuesday pump price follow last week's benchmark within one 5-centavo step", () => {
    const year = simulateDieselYear(3);
    for (let i = 1; i < WEEKS_PER_YEAR; i++) {
      const seen = kin(year[i - 1]!.crudeUsd, year[i - 1]!.phpPerUsd).pump;
      expect(Math.abs(seen - year[i]!.pumpPhp)).toBeLessThan(0.06);
    }
  });
});

describe("the clock", () => {
  const year = simulateDieselYear(2);

  it("only moves the counter while the cam gate is open", () => {
    for (let week = 0; week < WEEKS_PER_YEAR; week++) {
      let counter = stateAt(year, week * WEEK_S).counter;
      for (let step = 1; step <= 200; step++) {
        const s = stateAt(year, week * WEEK_S + (step / 200) * WEEK_S * 0.999);
        if (s.counter !== counter) expect(s.gate).toBeGreaterThan(0);
        counter = s.counter;
      }
    }
  });

  it("ends each Tuesday on the simulator's price and each week on its benchmark", () => {
    for (const week of [1, 7, 33, 52]) {
      const s = stateAt(year, (week - 0.001) * WEEK_S);
      expect(s.counter).toBeCloseTo(year[week - 1]!.pumpPhp, 6);
      expect(s.crude).toBeCloseTo(year[week - 1]!.crudeUsd, 1);
      expect(s.fx).toBeCloseTo(year[week - 1]!.phpPerUsd, 1);
    }
  });

  it("returns to the opening state by the end of the hold", () => {
    const s = stateAt(year, YEAR_S - 1e-6);
    expect(s.counter).toBeCloseTo(OPENING_PUMP, 2);
    expect(s.crude).toBeCloseTo(OPENING.crudeUsd, 2);
  });
});

describe("the counter wheels", () => {
  it("show a settled price digit by digit", () => {
    const [h, t, u, tens] = wheelsOf(65.25);
    expect([h % 10, t % 10, u % 10, tens % 10]).toEqual([5, 2, 5, 6]);
  });

  it("carry into the next wheel only while the lower one passes 9 to 0", () => {
    const half = wheelsOf(64.995);
    expect(half[0] % 10).toBeCloseTo(9.5, 6);
    expect(half[1] % 10).toBeCloseTo(9.5, 6); // tenths half-way from 9 to 0
    expect(half[2] % 10).toBeCloseTo(4.5, 6); // units half-way from 4 to 5
    expect(wheelsOf(64.9)[2] % 10).toBeCloseTo(4, 9); // nothing carries while the tenths wheel sits on 9
    expect(wheelsOf(65)[3] % 10).toBeCloseTo(6, 9);
  });
});

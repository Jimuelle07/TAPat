import { describe, expect, it } from "vitest";
import { splitNumbers } from "./numbers";

const numbers = (text: string) => splitNumbers(text).filter((_, i) => i % 2 === 1);

describe("splitNumbers", () => {
  it("finds amounts with their sign, percents and plain counts", () => {
    expect(numbers("3 cards × ₱1,500.00")).toEqual(["3", "₱1,500.00"]);
    expect(numbers("−₱350.00")).toEqual(["₱350.00"]);
    expect(numbers("5%")).toEqual(["5%"]);
    expect(numbers("MIDAS 2.31 ≥ 1.78")).toEqual(["2.31", "1.78"]);
  });

  it("leaves digits inside IDs alone", () => {
    expect(numbers("Ana V. …A1B2")).toEqual([]);
    expect(numbers("Juan D. …9C7E")).toEqual([]);
    expect(numbers("Pedro R. …3A54")).toEqual([]);
    expect(numbers("R01")).toEqual([]);
  });

  it("keeps every character, in order", () => {
    const text = "Station A · ₱800.00 · 0 tx";
    expect(splitNumbers(text).join("")).toBe(text);
  });
});

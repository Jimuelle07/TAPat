// A standalone figure, with its peso sign and percent. Digits inside an ID like "…A1B2" or "R01" do not count.
const NUMBER = /((?<![\p{L}\p{N}])₱?\d[\d,.]*%?(?![\p{L}\p{N}]))/gu;

/** Splits text around its numbers: odd indexes are the numbers, even indexes the words between them. */
export function splitNumbers(text: string): string[] {
  return text.split(NUMBER);
}

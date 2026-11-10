import { DEFAULT_PHP_PER_XLM, phpToStroops } from "@tapat/shared";
import { phpTile } from "@/lib/format";
import { DAY_PRICE, MARK, type Copy } from "./model";

// Money through the site's helpers, as the page's own money() does it (whole amounts drop the ".00").
const money = (pesos: number) => phpTile(phpToStroops(pesos), DEFAULT_PHP_PER_XLM).replace("PHP ", "₱");

export const COPY: Copy = {
  money: Array.from({ length: 46 }, (_, index) => money(index * 100)),
  price: DAY_PRICE.map((price) => price.toFixed(2)),
  mark: MARK.toFixed(2),
  lgu: "LGU",
};

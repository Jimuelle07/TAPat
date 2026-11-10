// Still pages of the agent figures for the drawing checks (`lines.mjs`, close-ups), written outside the app.
//   pnpm --filter server exec tsx ../web/app/_landing/figures/agents/preview.tsx <out dir> tranche|freeze <frame,frame,...> [columns]
// Each frame is the real scene component rendered to a string; the page carries the kit's own CSS and the figure CSS, in the light theme.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";

const here = dirname(fileURLToPath(import.meta.url));
const [outDir, agent, framesArg = "0", columnsArg = "1"] = process.argv.slice(2);
if (!outDir || (agent !== "tranche" && agent !== "freeze")) throw new Error("usage: preview.tsx <out dir> tranche|freeze <frames> [columns]");
const frames = framesArg.split(",").map(Number);
const css = readFileSync(join(here, "../../iso/iso.css"), "utf8") + readFileSync(join(here, "../../agents.css"), "utf8");

async function sceneOf(frame: number) {
  if (agent === "tranche") {
    const [{ TrancheScene }, { trancheAt }, { COPY, DAYS }, view] = await Promise.all([import("./tranche-scene"), import("./tranche-model"), import("./tranche.gen"), import("./tranche-view")]);
    return { svg: renderToStaticMarkup(<TrancheScene state={trancheAt(frame, DAYS, COPY)} />), w: view.WIDTH, h: view.HEIGHT };
  }
  const [{ FreezeScene }, { freezeAt }, { COPY, TRACE }, view] = await Promise.all([import("./freeze-scene"), import("./freeze-model"), import("./freeze.gen"), import("./freeze-view")]);
  return { svg: renderToStaticMarkup(<FreezeScene state={freezeAt(frame, TRACE, COPY)} />), w: view.WIDTH, h: view.HEIGHT };
}

async function main() {
  const cells = await Promise.all(frames.map(async (frame) => ({ frame, ...(await sceneOf(frame)) })));
  const { w } = cells[0]!;
  const sheet = cells
    .map(({ frame, svg, w: cw, h }) => `<div class="iso-plate ag-sheet-cell" style="padding:0"><svg class="iso-svg" viewBox="0 0 ${cw} ${h}" width="${cw}">${svg}</svg><span class="ag-tag">frame ${frame}</span></div>`)
    .join("");
  const html = `<!doctype html><meta charset="utf-8"><style>${css}
  body{margin:0;background:#fdfaf0}#sheet{display:grid;grid-template-columns:repeat(${columnsArg},${w}px);gap:12px;padding:12px;width:max-content}.ag-tag{position:absolute;left:6px;top:4px;font:10px monospace;color:#777}.ag-sheet-cell{position:relative}</style>
  <body><div class="iso" data-theme="light" id="sheet">${sheet}</div>`;
  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, `${agent}.html`);
  writeFileSync(file, html);
  console.log(`wrote ${file}`);
}

void main();

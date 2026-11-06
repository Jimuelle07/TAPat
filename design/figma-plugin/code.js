'use strict';
// TAPat UI Builder: generates tokens, components, screens and prototype links in the open Figma file.
// What the screens show comes from docs/api-and-data.md and docs/PRD.md; how they look comes from "TAPat Kit 2 - Clean Fintech".
// Re-running removes only what this plugin built (tagged with plugin data), so a user's own layers are never touched.

const FLOAT_SHADOW = [{ type: 'DROP_SHADOW', color: { r: 0.106, g: 0.18, b: 0.157, a: 0.16 }, offset: { x: 0, y: 2 }, radius: 4, spread: 0, visible: true, blendMode: 'NORMAL' }];
const BUTTON_SHADOW = [{ type: 'DROP_SHADOW', color: { r: 0.106, g: 0.18, b: 0.157, a: 0.3 }, offset: { x: 0, y: 2 }, radius: 4, spread: 0, visible: true, blendMode: 'NORMAL' }];
const FLOAT_GAP = 20; // floating buttons sit this far above the tab bar, clear of the curved line
const RULE_W = 1.5;
const RULE_TONE = 'text'; // divider colour: 'text' is Ink, 'ring-surface' is the kit's yellow line
const W = 390, H = 844, PAD = 20, BW = W - 2 * PAD, TAB_H = 90, STATUS_H = 47, TOP_H = 56;

// Kit colours are exact (printed in the kit). The tints are sampled from kit screenshots, so they are close, not exact.
const COLORS = {
  surface: 'FBF5E3', primary: '2E6F55', text: '1B2E28', accent: 'F7B93E', declined: 'C8552F',
  raised: 'FDFAF0', sunken: 'F2E8CC', mint: 'D8E7DF', pressed: '1F5540', 'declined-tint': 'F6DFD3', 'accent-tint': 'FBD88F',
  muted: '5C6B65', frozen: 'BFE6F7', danger: 'C0392B', // both requested by the user, outside the kit palette
  'primary-deep': '29664E', 'ring-surface': 'E3D6B2', 'ring-accent': 'C98F1E',
};
const TOKEN_NAMES = {
  surface: 'color/surface', primary: 'color/primary', text: 'color/text', accent: 'color/accent', declined: 'color/declined',
  raised: 'color/surface-raised', sunken: 'color/surface-sunken', mint: 'color/positive-tint', pressed: 'color/primary-pressed',
  'declined-tint': 'color/declined-tint', 'accent-tint': 'color/accent-tint',
  muted: 'color/text-muted', frozen: 'color/frozen', danger: 'color/danger', 'primary-deep': 'color/primary-deep', 'ring-surface': 'color/ring-surface', 'ring-accent': 'color/ring-accent',
};
const SPACE = [4, 8, 12, 16, 20, 24, 32, 40];
const RADIUS = { sm: 8, md: 12, lg: 20 };
const TYPE = {
  display: ['Outfit', 'SemiBold', 56, 112, 'text/display'],
  h1: ['Outfit', 'SemiBold', 28, 120, 'text/heading-1'],
  h2: ['Outfit', 'Medium', 22, 135, 'text/heading-2'],
  body: ['Outfit', 'Regular', 18, 150, 'text/body'],
  small: ['Outfit', 'Regular', 15, 145, 'text/body-sm'],
  label: ['Outfit', 'Medium', 15, 130, 'text/label'],
  caption: ['Outfit', 'Medium', 13, 140, 'text/caption'],
  tabOn: ['Outfit', 'SemiBold', 13, 140, 'text/tab-active'],
  amountLg: ['Azeret Mono', 'Medium', 40, 115, 'text/amount-lg'],
  amountMd: ['Azeret Mono', 'Medium', 36, 115, 'text/amount-md'],
  cardValue: ['Outfit', 'Medium', 28, 120, 'text/card-value'],
  cardValueSm: ['Outfit', 'Medium', 24, 120, 'text/card-value-sm'],
  amountSm: ['Azeret Mono', 'Medium', 16, 130, 'text/amount-sm'],
  mono: ['Azeret Mono', 'Regular', 13, 140, 'text/mono'],
};
// Simulated DOE series, copied from fixtures/prices/doe-diesel-sim.json.
const PRICES = [58.81, 58.95, 58.21, 58.75, 57.88, 59.13, 58.18, 58.7, 58.28, 58.2, 58.72, 58.94, 58.42, 58.52, 66, 57.98, 58.82, 57.27, 58.33, 58.58, 58.14, 57.86, 58.74, 57.98, 58.07, 58.68, 58.25, 58.39, 58.99, 58.45, 71.42, 71.34, 69.87, 70.85, 70.86, 70.41, 70.59, 71.17, 70.9, 71.05, 69.99, 70.65, 70.74, 71.08, 70.91];
const EDGES = [0.12, 0.14, 0.2, 0.18, 0.35, 0.42, 0.61, 0.93, 1.24, 1.52, 1.97, 2.31];
const MIDAS = 1.78;

const ICONS = {
  home: '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4v-9z"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  idcard: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="11" r="2"/><path d="M5.5 16c.6-1.6 1.7-2.2 3-2.2s2.4.6 3 2.2M14 10h4M14 14h4"/>',
  pump: '<path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h14M8 7h4v4H8z"/><path d="M15 10h2a2 2 0 0 1 2 2v4a1.5 1.5 0 0 0 3 0V9l-3-3"/>',
  pulse: '<path d="M3 12h4l2.5-6 4 12 2.5-6H21"/>',
  tap: '<rect x="3" y="7" width="12" height="10" rx="2"/><path d="M7 11h4M18 8l3-2M19 12h3M18 16l3 2"/>',
  wallet: '<path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7zM4 7l2-3h11v3"/><circle cx="16.5" cy="13.5" r="1"/>',
  receipt: '<path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21V3z"/><path d="M9 8h6M9 12h6"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  alert: '<path d="M12 4l9 16H3l9-16z"/><path d="M12 10v4M12 17v.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.5"/>',
  pause: '<circle cx="12" cy="12" r="9"/><path d="M10 9v6M14 9v6"/>',
  upload: '<path d="M12 16V5M7 10l5-5 5 5M4 19h16"/>',
  download: '<path d="M12 5v11M7 11l5 5 5-5M4 20h16"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
  send: '<path d="M21 3L3 10.5l7 3 3 7L21 3zM10 13.5L21 3"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v4h-4"/>',
};

const report = { warnings: [], sets: 0, variants: 0, screens: 0, links: 0, linkErrors: [], overflow: [] };
const log = (msg) => figma.ui.postMessage({ type: 'log', msg });
const warn = (msg) => { report.warnings.push(msg); log('Warning: ' + msg); };
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const hexRgb = (h) => ({ r: parseInt(h.slice(0, 2), 16) / 255, g: parseInt(h.slice(2, 4), 16) / 255, b: parseInt(h.slice(4, 6), 16) / 255 });

const V = {};      // bound variables by name
const STYLE = {};  // text styles by TYPE key
const FONT = {};   // resolved FontName by TYPE key
let sheetEffect = null, floatEffect = null, buttonEffect = null;
let pendingStyles = [];  // dynamic-page only allows async style setters, so they are applied in batches
let pendingEffects = [];
let logoSource = null;
const CMP = {};    // component registry: CMP.Button['Primary|Default']
const FRAMES = {}; // finished screens by name
const LINKS = [];  // [node, destinationName | 'BACK']

// ---------- tokens ----------

function paint(tok) {
  const p = { type: 'SOLID', color: hexRgb(COLORS[tok]) };
  const v = V[TOKEN_NAMES[tok]];
  return v ? figma.variables.setBoundVariableForPaint(p, 'color', v) : p;
}

async function setupTokens() {
  const cols = await figma.variables.getLocalVariableCollectionsAsync();
  const vars = await figma.variables.getLocalVariablesAsync();
  const col = (name) => cols.find((c) => c.name === name) || figma.variables.createVariableCollection(name);
  const mk = (name, c, type, value, scopes) => {
    const v = vars.find((x) => x.name === name && x.variableCollectionId === c.id) || figma.variables.createVariable(name, c, type);
    v.setValueForMode(c.modes[0].modeId, value);
    v.scopes = scopes;
    V[name] = v;
  };
  const colors = col('TAPat/Color');
  const sizes = col('TAPat/Size');
  Object.keys(COLORS).forEach((k) => mk(TOKEN_NAMES[k], colors, 'COLOR', hexRgb(COLORS[k]), ['ALL_FILLS', 'STROKE_COLOR']));
  SPACE.forEach((n) => mk('space/' + n, sizes, 'FLOAT', n, ['GAP']));
  Object.keys(RADIUS).forEach((k) => mk('radius/' + k, sizes, 'FLOAT', RADIUS[k], ['CORNER_RADIUS']));
}

async function setupType() {
  const available = await figma.listAvailableFontsAsync();
  const norm = (s) => s.toLowerCase().replace(/\s/g, '');
  const resolve = (family, style) => {
    const ofFamily = available.filter((f) => f.fontName.family === family);
    const match = ofFamily.find((f) => norm(f.fontName.style) === norm(style));
    if (match) return match.fontName;
    warn(family + ' ' + style + ' is not available, using Inter instead.');
    return { family: 'Inter', style: style === 'Regular' ? 'Regular' : 'Medium' };
  };
  const styles = await figma.getLocalTextStylesAsync();
  for (const key of Object.keys(TYPE)) {
    const t = TYPE[key];
    const font = resolve(t[0], t[1]);
    await figma.loadFontAsync(font);
    FONT[key] = font;
    const s = styles.find((x) => x.name === t[4]) || figma.createTextStyle();
    s.name = t[4];
    s.fontName = font;
    s.fontSize = t[2];
    s.lineHeight = { unit: 'PERCENT', value: t[3] };
    STYLE[key] = s;
  }
  const effects = await figma.getLocalEffectStylesAsync();
  sheetEffect = effects.find((x) => x.name === 'shadow/sheet') || figma.createEffectStyle();
  effects.filter((x) => x.name.indexOf('depth/rule') === 0).forEach((x) => x.remove());
  buttonEffect = effects.find((x) => x.name === 'shadow/button') || figma.createEffectStyle();
  buttonEffect.name = 'shadow/button';
  buttonEffect.effects = BUTTON_SHADOW;
  floatEffect = effects.find((x) => x.name === 'shadow/float') || figma.createEffectStyle();
  floatEffect.name = 'shadow/float';
  floatEffect.effects = FLOAT_SHADOW;
  sheetEffect.name = 'shadow/sheet';
  sheetEffect.effects = [{ type: 'DROP_SHADOW', color: { r: 0.106, g: 0.18, b: 0.157, a: 0.18 }, offset: { x: 0, y: -4 }, radius: 24, spread: 0, visible: true, blendMode: 'NORMAL' }];
}

async function flushStyles() {
  const texts = pendingStyles; pendingStyles = [];
  const effects = pendingEffects; pendingEffects = [];
  await Promise.all(texts.map((p) => p[0].setTextStyleIdAsync(p[1].id)));
  await Promise.all(effects.map((p) => p[0].setEffectStyleIdAsync(p[1].id)));
}

// ---------- layout helpers (always top-down: a parent is placed before its children, so FILL is valid) ----------

function bindNum(f, key, value) {
  f[key] = value;
  const v = V['space/' + value];
  if (v) f.setBoundVariable(key, v);
}

function setRadius(f, r) {
  const v = Object.keys(RADIUS).find((k) => RADIUS[k] === r);
  ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius'].forEach((k) => {
    f[k] = r;
    if (v) f.setBoundVariable(k, V['radius/' + v]);
  });
}

/** One flat Ink divider on a container's top, bottom or right edge, 1.5px like the kit's. Call it after the container's children exist, so its size is known. */
function rule(f, side, inset) {
  inset = inset || 0; // gap kept at both ends of the line
  const r = figma.createRectangle();
  r.name = 'Rule';
  r.fills = [paint(RULE_TONE)];
  f.appendChild(r);
  r.layoutPositioning = 'ABSOLUTE';
  if (side === 'r') {
    r.resize(RULE_W, f.height - inset * 2);
    r.x = f.width - RULE_W;
    r.y = inset;
    r.constraints = { horizontal: 'MAX', vertical: 'STRETCH' };
  } else {
    r.resize(f.width - inset * 2, RULE_W);
    r.x = inset;
    r.y = side === 't' ? 0 : f.height - RULE_W;
    r.constraints = { horizontal: 'STRETCH', vertical: side === 't' ? 'MIN' : 'MAX' };
  }
  return r;
}

function setStroke(n, tok, weight) {
  n.strokes = [paint(tok)];
  n.strokeWeight = weight || 1.5;
  n.strokeAlign = 'INSIDE';
}

function fit(n, parent, o) {
  const pm = parent.layoutMode;
  if (!pm || pm === 'NONE') return;
  const vertical = pm === 'VERTICAL';
  const hugW = vertical ? parent.counterAxisSizingMode === 'AUTO' : parent.primaryAxisSizingMode === 'AUTO';
  const hugH = vertical ? parent.primaryAxisSizingMode === 'AUTO' : parent.counterAxisSizingMode === 'AUTO';
  let hz, vt;
  if (o.w) hz = 'FIXED';
  else if (vertical) hz = o.hug || hugW ? 'HUG' : 'FILL';
  else hz = o.flex && !hugW ? 'FILL' : 'HUG';
  if (o.h) vt = 'FIXED';
  else if (vertical) vt = o.flex && !hugH ? 'FILL' : 'HUG';
  else vt = o.stretch && !hugH ? 'FILL' : 'HUG';
  n.layoutSizingHorizontal = hz;
  n.layoutSizingVertical = vt;
}

function style(f, o) {
  f.fills = o.fill ? [paint(o.fill)] : [];
  if (o.stroke) setStroke(f, o.stroke, o.sw);
  if (o.r !== undefined) setRadius(f, o.r);
  f.clipsContent = !!o.clip;
  if (o.gap !== undefined) bindNum(f, 'itemSpacing', o.gap);
  const px = o.px !== undefined ? o.px : o.p;
  const py = o.py !== undefined ? o.py : o.p;
  if (px !== undefined) { bindNum(f, 'paddingLeft', px); bindNum(f, 'paddingRight', px); }
  if (py !== undefined) { bindNum(f, 'paddingTop', py); bindNum(f, 'paddingBottom', py); }
  if (o.pt !== undefined) bindNum(f, 'paddingTop', o.pt);
  if (o.pb !== undefined) bindNum(f, 'paddingBottom', o.pb);
  if (o.pl !== undefined) bindNum(f, 'paddingLeft', o.pl);
  if (o.pr !== undefined) bindNum(f, 'paddingRight', o.pr);
  if (o.align) f.counterAxisAlignItems = o.align;
  if (o.justify) f.primaryAxisAlignItems = o.justify;
}

function box(parent, o) {
  o = o || {};
  const f = figma.createFrame();
  f.name = o.name || 'Group';
  f.layoutMode = o.dir === 'H' ? 'HORIZONTAL' : 'VERTICAL';
  f.primaryAxisSizingMode = 'AUTO';
  f.counterAxisSizingMode = 'AUTO';
  parent.appendChild(f);
  if (o.w || o.h) f.resize(o.w || f.width, o.h || f.height);
  fit(f, parent, o);
  style(f, o);
  return f;
}
const row = (parent, o) => box(parent, Object.assign({ dir: 'H', align: 'CENTER' }, o));
const card = (parent, o) => box(parent, Object.assign({ name: 'Card', fill: 'raised', stroke: 'text', r: RADIUS.md, p: 16, gap: 12 }, o));

function text(parent, chars, type, o) {
  o = o || {};
  const t = figma.createText();
  t.name = o.name || chars.slice(0, 32);
  t.fontName = FONT[type];
  t.fontSize = TYPE[type][2];
  t.lineHeight = { unit: 'PERCENT', value: TYPE[type][3] };
  t.characters = chars;
  t.fills = [paint(o.c || 'text')];
  parent.appendChild(t);
  const pm = parent.layoutMode;
  if (pm && pm !== 'NONE') {
    const hugW = pm === 'VERTICAL' ? parent.counterAxisSizingMode === 'AUTO' : parent.primaryAxisSizingMode === 'AUTO';
    const wide = !o.hug && !hugW && (pm === 'VERTICAL' || o.flex);
    if (wide) {
      t.textAutoResize = 'HEIGHT';
      t.layoutSizingHorizontal = 'FILL';
    } else {
      t.textAutoResize = 'WIDTH_AND_HEIGHT';
    }
  }
  if (o.ta) t.textAlignHorizontal = o.ta;
  pendingStyles.push([t, STYLE[type]]);
  return t;
}

function divider(parent, width, dashed) {
  const l = figma.createLine();
  l.name = 'Divider';
  parent.appendChild(l);
  l.resize(width, 0);
  l.strokes = [paint(dashed ? 'text' : 'sunken')];
  l.strokeWeight = 1;
  if (dashed) l.dashPattern = [4, 4];
  return l;
}

/** Open polyline from absolute points, normalised to its own box so the node position stays predictable. */
function polyline(parent, pts, tok, weight, fillTok) {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const minX = Math.min.apply(null, xs), minY = Math.min.apply(null, ys);
  const v = figma.createVector();
  v.name = 'Line';
  parent.appendChild(v);
  v.vectorPaths = [{ windingRule: fillTok ? 'NONZERO' : 'NONE', data: pts.map((p, i) => (i ? 'L ' : 'M ') + (p[0] - minX).toFixed(2) + ' ' + (p[1] - minY).toFixed(2)).join(' ') }];
  v.fills = fillTok ? [paint(fillTok)] : [];
  v.strokes = [paint(tok)];
  v.strokeWeight = weight;
  v.strokeJoin = 'ROUND';
  if (parent.layoutMode === 'NONE') { v.x = minX; v.y = minY; }
  return v;
}

function find(inst, name) {
  const n = inst.findOne((x) => x.name === name);
  if (!n) throw new Error('Layer "' + name + '" not found in ' + inst.name);
  return n;
}

/** Sets text layers by name; null hides the layer. */
function setT(inst, map) {
  Object.keys(map).forEach((k) => {
    const n = find(inst, k);
    if (map[k] === null) n.visible = false;
    else n.characters = String(map[k]);
  });
  return inst;
}

function tint(inst, tok) {
  inst.findAll((n) => 'strokes' in n && n.strokes.length > 0).forEach((n) => { n.strokes = [paint(tok)]; });
}

function place(inst, parent, o) {
  o = o || {};
  parent.appendChild(inst);
  fit(inst, parent, o);
  if (o.name) inst.name = o.name;
  if (o.to) LINKS.push([inst, o.to]);
  return inst;
}

function icon(parent, name, tok, o) {
  const i = CMP.Icon[name].createInstance();
  i.name = 'Icon/' + name;
  parent.appendChild(i);
  if (tok && tok !== 'text') tint(i, tok);
  if (o && o.to) LINKS.push([i, o.to]);
  return i;
}

// ---------- components ----------

function makeSet(page, name, description, axes, build) {
  const keys = Object.keys(axes);
  let combos = [{}];
  keys.forEach((k) => {
    const next = [];
    combos.forEach((c) => axes[k].forEach((v) => { const d = Object.assign({}, c); d[k] = v; next.push(d); }));
    combos = next;
  });
  CMP[name] = {};
  const comps = combos.map((c) => {
    const comp = figma.createComponent();
    comp.name = keys.map((k) => k + '=' + c[k]).join(', ');
    comp.setPluginData('tapat', '1');
    page.appendChild(comp);
    build(comp, c);
    CMP[name][keys.map((k) => c[k]).join('|')] = comp;
    return comp;
  });
  const set = figma.combineAsVariants(comps, page);
  set.name = name;
  set.setPluginData('tapat', '1');
  set.description = description;
  set.fills = [paint('surface')];
  let x = 24, y = 24, rowH = 0, maxX = 0;
  set.children.forEach((c) => {
    if (x + c.width > 1400 && x > 24) { x = 24; y += rowH + 24; rowH = 0; }
    c.x = x; c.y = y;
    x += c.width + 24;
    rowH = Math.max(rowH, c.height);
    maxX = Math.max(maxX, x);
  });
  set.resizeWithoutConstraints(maxX, y + rowH + 24);
  report.sets += 1;
  report.variants += comps.length;
  return set;
}

function makeOne(page, name, description, build) {
  const comp = figma.createComponent();
  comp.name = name;
  comp.setPluginData('tapat', '1');
  comp.description = description;
  page.appendChild(comp);
  build(comp);
  CMP[name] = comp;
  report.sets += 1;
  report.variants += 1;
  return comp;
}

/** Root setup for a component: fixed width, height hugs its content. */
function root(comp, dir, width, o) {
  comp.layoutMode = dir === 'H' ? 'HORIZONTAL' : 'VERTICAL';
  comp.resize(width || 100, comp.height);
  comp.primaryAxisSizingMode = dir === 'H' ? (width ? 'FIXED' : 'AUTO') : 'AUTO';
  comp.counterAxisSizingMode = dir === 'H' ? 'AUTO' : (width ? 'FIXED' : 'AUTO');
  style(comp, o || {});
}

/** Kit card decoration: concentric rings and a large arc, positioned from the kit's own cards. */
function decor(c, shape, cx, cy, r, o) {
  const e = figma.createEllipse();
  e.name = o.name;
  e.resize(r * 2, r * 2);
  e.fills = o.fill ? [paint(o.fill)] : [];
  if (o.stroke) { e.strokes = [paint(o.stroke)]; e.strokeWeight = 1; }
  c.appendChild(e);
  e.layoutPositioning = 'ABSOLUTE';
  e.x = cx - r;
  e.y = cy - r;
  e.constraints = shape;
}
const rings = (c, shape, cx, cy, radii, tok) => radii.forEach((r) => decor(c, shape, cx, cy, r, { name: 'Ring', stroke: tok }));

function logoInto(comp, w, h) {
  comp.resize(w, h);
  comp.fills = [];
  if (!logoSource) {
    const t = text(comp, 'TAPat', w > 100 ? 'h1' : 'label', { c: 'primary', name: 'Logo placeholder: paste the kit logo and re-run' });
    t.y = (h - t.height) / 2;
    return;
  }
  try {
    const n = logoSource.type === 'COMPONENT' ? logoSource.createInstance()
      : logoSource.type === 'COMPONENT_SET' ? logoSource.defaultVariant.createInstance() : logoSource.clone();
    comp.appendChild(n);
    n.rescale(Math.min(w / n.width, h / n.height));
    n.x = 0;
    n.y = (h - n.height) / 2;
    n.locked = false;
  } catch (e) {
    warn('Could not use the pasted logo (' + e.message + '). Using a text placeholder.');
    text(comp, 'TAPat', 'label', { c: 'primary' });
  }
}

function buildComponents(page) {
  const P = page;
  CMP.Icon = {};
  Object.keys(ICONS).forEach((name) => {
    const svg = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g stroke="#1B2E28" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + ICONS[name] + '</g></svg>';
    const n = figma.createNodeFromSvg(svg);
    const c = figma.createComponent();
    c.name = 'Icon/' + name;
    c.setPluginData('tapat', '1');
    c.resize(24, 24);
    c.fills = [];
    P.appendChild(c);
    n.children.slice().forEach((k) => c.appendChild(k));
    n.remove();
    tint(c, 'text');
    CMP.Icon[name] = c;
    report.sets += 1;
    report.variants += 1;
  });

  makeOne(P, 'Logo/Small', 'Top bar and receipt. Kit rule: never under 48px wide, never stretched or tilted.', (c) => logoInto(c, 88, 44));
  makeOne(P, 'Logo/Large', 'Cover and Foundations. Full colour on cream only.', (c) => logoInto(c, 240, 140));

  const BTN = {
    Primary: { Default: ['primary', null, 'surface'], Pressed: ['pressed', null, 'surface'], Disabled: ['sunken', null, 'text'], Loading: ['primary', null, 'surface'] },
    Secondary: { Default: ['raised', 'text', 'text'], Pressed: ['mint', 'text', 'text'], Disabled: ['sunken', null, 'text'], Loading: ['raised', 'text', 'text'] },
    Tertiary: { Default: [null, null, 'primary'], Pressed: ['mint', null, 'primary'], Disabled: [null, null, 'text'], Loading: [null, null, 'primary'] },
  };
  makeSet(P, 'Button', 'Height 54 meets the 44px tap target. Primary for the one main action on a screen.', { Style: ['Primary', 'Secondary', 'Tertiary'], State: ['Default', 'Pressed', 'Disabled', 'Loading'] }, (c, v) => {
    const s = BTN[v.Style][v.State];
    root(c, 'H', BW, { fill: s[0], stroke: s[1], r: RADIUS.md, gap: 8, justify: 'CENTER', align: 'CENTER', px: 16 });
    c.minHeight = 54; // not a fixed height: an instance set to HUG would collapse below the tap target
    if (v.Style === 'Primary' && v.State !== 'Disabled') {
      c.effects = BUTTON_SHADOW;
      pendingEffects.push([c, buttonEffect]);
    }
    if (v.State === 'Loading') icon(c, 'refresh', s[2]);
    text(c, 'Charge', 'label', { c: s[2], name: 'Label', hug: true });
  });

  const CHIP = { Outline: ['raised', 'text', 'text'], Mint: ['mint', 'text', 'text'], Accent: ['accent', 'text', 'text'], Danger: ['danger', 'danger', 'surface'], Frozen: ['frozen', 'text', 'text'], Ink: ['text', 'text', 'surface'] };
  makeSet(P, 'Chip', 'Status is always written out, so colour is never the only signal. Accent: at most one per screen. Danger: failed and declined. Frozen: ice blue, stations only. Ink: other strong states such as Down, Held and MISMATCH.', { Tone: Object.keys(CHIP) }, (c, v) => {
    const s = CHIP[v.Tone];
    root(c, 'H', 0, { fill: s[0], stroke: s[1], r: RADIUS.sm, px: 8, py: 4, gap: 4, align: 'CENTER' });
    text(c, 'Station A', 'caption', { c: s[2], name: 'Label', hug: true });
  });

  makeSet(P, 'Filter chip', 'Filters and the station switch. 44px tall for touch.', { State: ['Default', 'Selected'] }, (c, v) => {
    const on = v.State === 'Selected';
    root(c, 'H', 0, { fill: on ? 'primary' : 'raised', stroke: on ? 'primary' : 'text', r: RADIUS.sm, px: 12, align: 'CENTER', justify: 'CENTER' });
    c.minHeight = 44;
    text(c, 'All', 'label', { c: on ? 'surface' : 'text', name: 'Label', hug: true });
  });

  const INPUT = { Default: ['raised', 'text', 1.5], Focused: ['raised', 'primary', 2.5], Error: ['declined-tint', 'declined', 2], Disabled: ['sunken', 'sunken', 1.5] };
  makeSet(P, 'Input', 'Label, value and helper. The error message is written out, not shown by colour alone.', { State: Object.keys(INPUT) }, (c, v) => {
    root(c, 'V', BW, { gap: 4 });
    const s = INPUT[v.State];
    const f = box(c, { name: 'Field', fill: s[0], stroke: s[1], sw: s[2], r: RADIUS.md, px: 16, py: 12, gap: 4 });
    text(f, 'Amount', 'caption', { name: 'Label' });
    text(f, 'PHP 350.00', 'amountSm', { name: 'Value' });
    text(c, 'Helper text', 'caption', { name: 'Helper' });
  });

  makeSet(P, 'Amount field', 'The station terminal amount, from the kit Station Terminal mockup.', { State: ['Empty', 'Filled'] }, (c, v) => {
    root(c, 'V', BW, { fill: 'raised', stroke: 'text', r: RADIUS.md, p: 24, gap: 8 });
    const top = row(c, { justify: 'SPACE_BETWEEN' });
    text(top, 'Amount', 'label', { name: 'Label', hug: true });
    text(top, 'Cap PHP 500.00', 'mono', { name: 'Cap', hug: true });
    text(c, v.State === 'Empty' ? 'PHP 0.00' : 'PHP 350.00', 'amountLg', { name: 'Value' });
  });

  const STAT = { Cream: ['raised', 'sunken', 'text', 'ring-surface'], Mustard: ['accent', 'accent-tint', 'text', 'ring-accent'], Forest: ['primary-deep', 'primary', 'surface', 'pressed'] };
  makeOne(P, 'Table row', 'Detail row with a rule above it, so each fact reads as its own line. The first row in a table turns the rule off.', (c) => {
    root(c, 'H', 318, { gap: 12, py: 8, justify: 'SPACE_BETWEEN', align: 'MIN' });
    text(c, 'Station ID', 'mono', { name: 'Key', hug: true });
    text(c, 'A', 'mono', { name: 'Value', flex: true, ta: 'RIGHT' });
    rule(c, 't');
  });

  const TOP_RIGHT = { horizontal: 'MAX', vertical: 'MIN' }, BOTTOM_RIGHT = { horizontal: 'MAX', vertical: 'MAX' }, BOTTOM_LEFT = { horizontal: 'MIN', vertical: 'MAX' };
  makeSet(P, 'Stat card', 'Kit card: value over caption, large arc and rings. Full matches the kit proportions; Half is the same card for two-up rows. Mustard counts as the accent for its screen.', { Tone: Object.keys(STAT), Size: ['Full', 'Half'] }, (c, v) => {
    const s = STAT[v.Tone];
    const full = v.Size === 'Full';
    const w = full ? BW : 169, h = full ? 112 : 88;
    root(c, 'V', w, { fill: s[0], stroke: 'text', r: RADIUS.md, px: full ? 24 : 16, gap: 4, justify: 'CENTER', clip: true });
    c.resize(w, h);
    c.primaryAxisSizingMode = 'FIXED';
    c.counterAxisSizingMode = 'FIXED';
    if (full) {
      decor(c, BOTTOM_RIGHT, w, 150, 148, { name: 'Arc', fill: s[1] });
      rings(c, TOP_RIGHT, w, 0, [82, 71, 60, 49, 38, 27, 16], s[3]);
    } else {
      decor(c, BOTTOM_RIGHT, w, 118, 116, { name: 'Arc', fill: s[1] });
      rings(c, TOP_RIGHT, w, 0, [64, 55, 46, 37, 28, 19], s[3]);
    }
    text(c, 'PHP 1,500', full ? 'cardValue' : 'cardValueSm', { c: s[2], name: 'Value' });
    text(c, 'Tranche per card', 'small', { c: s[2], name: 'Label' });
  });

  makeOne(P, 'Key value', 'One receipt or detail row. Amounts and IDs stay in Azeret Mono.', (c) => {
    root(c, 'H', 310, { gap: 12, justify: 'SPACE_BETWEEN', align: 'MIN' });
    text(c, 'Card', 'mono', { name: 'Key', hug: true });
    text(c, 'Juan D. …9C7E', 'mono', { name: 'Value', flex: true, ta: 'RIGHT' });
  });

  makeSet(P, 'List item', 'Tap target at least 56px. Meta and trailing parts can be hidden per instance.', { Trailing: ['Value', 'Chip', 'Chevron'] }, (c, v) => {
    root(c, 'H', 318, { py: 12, gap: 12, align: 'CENTER' });
    c.minHeight = 56;
    const col = box(c, { name: 'Text', flex: true, gap: 4 });
    text(col, 'Juan D. …9C7E', 'label', { name: 'Title' });
    text(col, '3f9c1a0b', 'caption', { name: 'Meta' });
    if (v.Trailing === 'Value') text(c, 'PHP 350.00', 'mono', { name: 'Value', hug: true });
    if (v.Trailing === 'Chip') place(CMP.Chip.Outline.createInstance(), c, { name: 'Chip' });
    if (v.Trailing === 'Chevron') icon(c, 'chevron');
    rule(c, 'b');
  });

  const TABS = [['Home', 'home'], ['Masterlist', 'list'], ['Enroll', 'idcard'], ['Station', 'pump'], ['Agents', 'pulse']];
  makeSet(P, 'Tab bar', 'One tab per documented route. The active tab has a raised Forest circle under a curved top line and a bold Forest label, so it is not colour alone.', { Active: TABS.map((t) => t[0]) }, (c, v) => {
    root(c, 'V', W, { fill: 'raised' });
    const items = row(c, { name: 'Tabs', h: 56, align: 'MIN' });
    TABS.forEach((t) => {
      const on = t[0] === v.Active;
      const item = box(items, { name: 'Tab/' + t[0], flex: true, stretch: true, align: 'CENTER', justify: 'CENTER', gap: 4, pt: 4 });
      const pill = row(item, { name: 'Pill', w: 52, h: 28, justify: 'CENTER' });
      if (on) {
        const disc = row(pill, { name: 'Active disc', w: 44, h: 44, fill: 'primary', r: 22, justify: 'CENTER' });
        disc.layoutPositioning = 'ABSOLUTE';
        disc.x = 4;
        disc.y = -13;
        disc.effects = BUTTON_SHADOW;
        pendingEffects.push([disc, buttonEffect]);
        icon(disc, t[1], 'surface').rescale(32 / 24);
      } else {
        icon(pill, t[1], 'muted');
      }
      text(item, t[0], on ? 'tabOn' : 'caption', { c: on ? 'primary' : 'muted', name: 'Label', hug: true, ta: 'CENTER' });
    });
    // The bar's top line as one path: flat, then an arc over the active circle, keeping a 3px gap from it.
    const cx = (TABS.findIndex((t) => t[0] === v.Active) + 0.5) * (W / 5);
    const RISE = 11;
    const pts = [[-27, 0], [-22, 0], [-20, -1.3], [-17.68, -3.68], [-12.99, -8.37], [-6.63, -11], [0, -11]];
    const P = (p, side) => (cx + side * p[0]).toFixed(2) + ' ' + (p[1] + RISE).toFixed(2);
    const curve = figma.createVector();
    curve.name = 'Top line';
    c.insertChild(0, curve);
    curve.layoutPositioning = 'ABSOLUTE';
    curve.vectorPaths = [{ windingRule: 'NONZERO', data: 'M 0 ' + RISE + ' L ' + P(pts[0], 1) + ' C ' + P(pts[1], 1) + ' ' + P(pts[2], 1) + ' ' + P(pts[3], 1) + ' C ' + P(pts[4], 1) + ' ' + P(pts[5], 1) + ' ' + P(pts[6], 1) + ' C ' + P(pts[5], -1) + ' ' + P(pts[4], -1) + ' ' + P(pts[3], -1) + ' C ' + P(pts[2], -1) + ' ' + P(pts[1], -1) + ' ' + P(pts[0], -1) + ' L ' + W + ' ' + RISE }];
    curve.fills = [paint('raised')];
    curve.strokes = [paint('text')];
    curve.strokeWeight = 1.5;
    curve.x = 0;
    curve.y = -RISE;
    const safe = row(c, { name: 'Safe area', h: 34, justify: 'CENTER' });
    const bar = figma.createRectangle();
    bar.name = 'Home indicator';
    bar.resize(134, 5);
    bar.cornerRadius = 3;
    bar.fills = [paint('text')];
    safe.appendChild(bar);
  });

  makeOne(P, 'Status bar', 'Top safe area, as in the kit mobile mockups.', (c) => {
    root(c, 'H', W, { px: PAD, align: 'CENTER' });
    c.resize(W, STATUS_H);
    c.counterAxisSizingMode = 'FIXED';
    bindNum(c, 'paddingTop', 16);
    text(c, '9:41', 'mono', { name: 'Time', hug: true });
  });

  makeSet(P, 'Top bar', 'Root: logo and context chip. Detail: 44px back target and title.', { Type: ['Root', 'Detail'] }, (c, v) => {
    root(c, 'H', W, { align: 'CENTER', gap: 4, justify: 'SPACE_BETWEEN', pl: v.Type === 'Root' ? PAD : 4, pr: PAD });
    c.resize(W, TOP_H);
    c.counterAxisSizingMode = 'FIXED';
    if (v.Type === 'Root') {
      const l = CMP['Logo/Small'].createInstance();
      c.appendChild(l);
    } else {
      const back = row(c, { name: 'Back', w: 44, h: 44, justify: 'CENTER' });
      icon(back, 'back');
      text(c, 'Title', 'h2', { name: 'Title', flex: true });
    }
    place(CMP.Chip.Outline.createInstance(), c, { name: 'Chip' });
  });

  const NOTICE = { Info: ['raised', 'text', 'text', 'info'], Frozen: ['frozen', 'text', 'text', 'pause'], Error: ['raised', 'text', 'text', 'alert'] };
  makeSet(P, 'Notice', 'Inline message with icon and written reason.', { Tone: Object.keys(NOTICE) }, (c, v) => {
    const s = NOTICE[v.Tone];
    root(c, 'H', BW, { fill: s[0], stroke: s[1], sw: v.Tone === 'Error' ? 2 : 1.5, r: RADIUS.md, p: 12, gap: 12, align: 'MIN' });
    icon(c, s[3], s[2]);
    const col = box(c, { name: 'Text', flex: true, gap: 4 });
    text(col, 'Title', 'label', { c: s[2], name: 'Title' });
    text(col, 'Body', 'small', { c: s[2], name: 'Body' });
  });

  makeSet(P, 'Toast', 'Short confirmation above the tab bar.', { Tone: ['Success', 'Info'] }, (c, v) => {
    const on = v.Tone === 'Success';
    root(c, 'H', BW, { fill: on ? 'primary' : 'text', r: RADIUS.md, p: 12, gap: 8, align: 'CENTER' });
    icon(c, on ? 'check' : 'info', 'surface');
    text(c, 'Message', 'label', { c: 'surface', name: 'Message', flex: true });
  });

  makeSet(P, 'Empty state', 'Icon, reason, and the next step when the backend offers one.', { Action: ['Yes', 'No'] }, (c, v) => {
    root(c, 'V', BW, { align: 'CENTER', gap: 12, py: 32 });
    const disc = row(c, { name: 'Disc', w: 72, h: 72, fill: 'sunken', r: 36, justify: 'CENTER' });
    icon(disc, 'list');
    text(c, 'Title', 'h2', { name: 'Title', ta: 'CENTER' });
    text(c, 'Body', 'small', { name: 'Body', ta: 'CENTER' });
    if (v.Action === 'Yes') place(CMP.Button['Primary|Default'].createInstance(), c, { name: 'Button' });
  });

  makeSet(P, 'Skeleton', 'Loading placeholders.', { Type: ['Line', 'Row', 'Card'] }, (c, v) => {
    root(c, 'V', BW, {});
    const h = { Line: 16, Row: 56, Card: 96 }[v.Type];
    const r = figma.createRectangle();
    r.name = 'Block';
    r.fills = [paint('sunken')];
    r.cornerRadius = RADIUS.sm;
    c.appendChild(r);
    r.resize(BW, h);
    r.layoutSizingHorizontal = 'FILL';
  });

  makeOne(P, 'Sheet header', 'Drag handle and title for every bottom sheet.', (c) => {
    root(c, 'V', W, { px: PAD, pt: 12, pb: 8, gap: 12 });
    const h = row(c, { name: 'Handle row', justify: 'CENTER' });
    const bar = figma.createRectangle();
    bar.name = 'Handle';
    bar.resize(40, 4);
    bar.cornerRadius = 2;
    bar.fills = [paint('text')];
    h.appendChild(bar);
    text(c, 'Title', 'h2', { name: 'Title' });
  });

  makeSet(P, 'Bottom sheet', 'Confirmation sheet for actions that move money or change a station.', { Actions: ['One', 'Two'] }, (c, v) => {
    root(c, 'V', W, { fill: 'surface', stroke: 'text', pb: 32, gap: 12 });
    c.topLeftRadius = RADIUS.lg; c.topRightRadius = RADIUS.lg;
    place(CMP['Sheet header'].createInstance(), c, { name: 'Header' });
    const content = box(c, { name: 'Content', px: PAD, gap: 12 });
    text(content, 'Body', 'small', { name: 'Body' });
    place(CMP.Button['Primary|Default'].createInstance(), content, { name: 'Primary' });
    if (v.Actions === 'Two') place(CMP.Button['Secondary|Default'].createInstance(), content, { name: 'Secondary' });
    pendingEffects.push([c, sheetEffect]);
  });

  makeSet(P, 'Receipt', 'Kit receipt. Refused and declined taps show the server message as is, and no balance, because the API returns null.', { Status: ['Paid', 'Declined'] }, (c, v) => {
    root(c, 'V', BW, {});
    const body = box(c, { name: 'Paper', fill: 'raised', stroke: 'text', p: 20, gap: 12 });
    body.strokeBottomWeight = 0;
    const head = row(body, { justify: 'SPACE_BETWEEN' });
    head.appendChild(CMP['Logo/Small'].createInstance());
    const hr = box(head, { hug: true, gap: 0, align: 'MAX' });
    text(hr, 'RECEIPT', 'mono', { hug: true, ta: 'RIGHT' });
    text(hr, 'Station A', 'mono', { name: 'Station', hug: true, ta: 'RIGHT' });
    divider(body, BW - 40, true);
    const top = row(body, { justify: 'SPACE_BETWEEN' });
    place(CMP.Chip[v.Status === 'Paid' ? 'Accent' : 'Danger'].createInstance(), top, { name: 'Status' });
    setT(find(top, 'Status'), { Label: v.Status === 'Paid' ? 'PAID' : 'DECLINED' });
    text(top, 'PHP 350.00', 'amountSm', { name: 'Amount', hug: true });
    const kv = (k) => place(CMP['Key value'].createInstance(), body, { name: k });
    kv('Card');
    if (v.Status === 'Paid') kv('Balance'); else kv('Reason');
    kv('Tx');
    divider(body, BW - 40, true);
    text(body, 'Receipt sent to the driver on Telegram.', 'mono', { name: 'Note' });
    const pts = [];
    const teeth = 25, step = BW / teeth;
    for (let i = 0; i <= teeth; i++) { pts.push([i * step, 0]); if (i < teeth) pts.push([(i + 0.5) * step, 7]); }
    const z = polyline(c, pts, 'text', 1.5, 'raised');
    z.name = 'Zigzag edge';
  });

  makeOne(P, 'Balance card', 'Kit fuel credit card, shown after a paid tap. Fixed at 350 by 220, as in the kit.', (c) => {
    root(c, 'V', BW, { fill: 'primary-deep', stroke: 'text', r: RADIUS.md, p: 24, justify: 'SPACE_BETWEEN', clip: true });
    c.resize(BW, 220);
    c.primaryAxisSizingMode = 'FIXED';
    c.counterAxisSizingMode = 'FIXED';
    rings(c, TOP_RIGHT, BW, 0, [90, 74, 58, 42, 26, 10], 'primary');
    rings(c, BOTTOM_LEFT, 146, 233, [70, 54, 38, 22], 'primary');
    decor(c, BOTTOM_RIGHT, BW, 263, 163, { name: 'Arc', fill: 'primary' });
    const eyebrow = text(c, 'TODA FUEL AID', 'caption', { c: 'surface', name: 'Eyebrow' });
    eyebrow.letterSpacing = { unit: 'PERCENT', value: 4 };
    const mid = box(c, { name: 'Credit', gap: 8 });
    text(mid, 'Fuel credit left', 'small', { c: 'surface', name: 'Credit label' });
    text(mid, 'PHP 1,150.00', 'amountMd', { c: 'surface', name: 'Balance' });
    const b = row(c, { name: 'Holder', justify: 'SPACE_BETWEEN' });
    text(b, 'Juan D.', 'label', { c: 'surface', name: 'Name', hug: true });
    text(b, '…9C7E', 'label', { c: 'surface', name: 'Last4', hug: true });
  });

  makeSet(P, 'Station row', 'Station strip as a small table: name and written status, reason when frozen, then ruled columns for spent, pending and held.', { Status: ['Active', 'Frozen'] }, (c, v) => {
    root(c, 'V', BW, { fill: 'raised', stroke: 'text', r: RADIUS.md, clip: true });
    const top = row(c, { name: 'Header', justify: 'SPACE_BETWEEN', gap: 8, px: 16, py: 12 });
    text(top, 'Petron San Roque', 'label', { name: 'Name', flex: true });
    place(CMP.Chip[v.Status === 'Active' ? 'Mint' : 'Frozen'].createInstance(), top, { name: 'Status' });
    setT(find(top, 'Status'), { Label: v.Status });
    rule(top, 'b', 16);
    if (v.Status === 'Frozen') {
      const why = box(c, { name: 'Reason row', px: 16, py: 8 });
      text(why, 'MIDAS 2.31 >= 1.78 (NEAR_CAP_STREAK)', 'mono', { name: 'Reason' });
      rule(why, 'b', 16);
    }
    const nums = row(c, { name: 'Figures', align: 'MIN', px: 4 }); // 4 + cell padding 12 lines the text up with the 16 inset above
    ['Spent', 'Pending', 'Held'].forEach((k, i) => {
      const col = box(nums, { name: k, flex: true, gap: 4, px: 12, py: 12 });
      text(col, k, 'caption');
      text(col, 'PHP 0.00', 'mono', { name: k + ' value' });
      if (i < 2) rule(col, 'r', 12);
    });
  });

  makeSet(P, 'Invariant', 'The dashboard cross-check from the PRD, as two ruled rows. OK or MISMATCH is written out.', { Status: ['OK', 'MISMATCH'] }, (c, v) => {
    root(c, 'V', BW, { fill: 'raised', stroke: 'text', sw: v.Status === 'OK' ? 1.5 : 2.5, r: RADIUS.md, clip: true });
    const top = row(c, { name: 'Escrow row', justify: 'SPACE_BETWEEN', gap: 8, px: 12, py: 8 });
    text(top, 'Escrow remaining', 'caption', { hug: true });
    text(top, 'PHP 3,190.00', 'mono', { name: 'Escrow', hug: true });
    rule(top, 'b', v.Status === 'OK' ? 1.5 : 2.5);
    const b = row(c, { name: 'Check row', gap: 8, px: 12, py: 8 });
    text(b, 'Funded = spent + held + pending + escrow + returned', 'caption', { name: 'Formula', flex: true });
    place(CMP.Chip[v.Status === 'OK' ? 'Mint' : 'Ink'].createInstance(), b, { name: 'Status' });
    setT(find(b, 'Status'), { Label: v.Status });
  });

  makeSet(P, 'Stepper', 'Enrollment progress, written and shown.', { Step: ['1', '2', '3'] }, (c, v) => {
    root(c, 'V', BW, { gap: 8 });
    text(c, 'Step ' + v.Step + ' of 3', 'caption', { name: 'Label' });
    const segs = row(c, { gap: 4 });
    [1, 2, 3].forEach((i) => box(segs, { name: 'Segment ' + i, flex: true, h: 6, r: 3, fill: i <= Number(v.Step) ? 'primary' : 'sunken' }));
  });
}

function layoutComponentsPage(page) {
  const LEFT = 80, CONTENT = 420, GAP = 120;
  let y = 80;
  const sets = page.children.filter((n) => (n.type === 'COMPONENT_SET' || n.type === 'COMPONENT') && n.getPluginData('tapat') === '1');
  const icons = sets.filter((n) => n.name.indexOf('Icon/') === 0);
  const rest = sets.filter((n) => n.name.indexOf('Icon/') !== 0);
  const title = (s) => {
    const t = text(page, s, 'h1', { name: 'Row label/' + s });
    t.textAutoResize = 'HEIGHT';
    t.resize(CONTENT - LEFT - 40, t.height);
    t.x = LEFT; t.y = y;
    t.setPluginData('tapat', '1');
  };
  title('Icon, line 1.5px');
  icons.forEach((n, i) => { n.x = CONTENT + i * 72; n.y = y; n.setPluginData('tapat', '1'); });
  y += 24 + GAP;
  rest.forEach((n) => {
    title(n.name);
    n.x = CONTENT; n.y = y;
    n.setPluginData('tapat', '1');
    y += n.height + GAP;
  });
}

// ---------- screen building blocks ----------

function btn(p, label, o) {
  o = o || {};
  const i = CMP.Button[(o.style || 'Primary') + '|' + (o.state || 'Default')].createInstance();
  place(i, p, { name: 'Button/' + label, to: o.to, flex: o.flex });
  setT(i, { Label: label });
  return i;
}
function chip(p, label, tone) {
  const i = CMP.Chip[tone || 'Outline'].createInstance();
  place(i, p, { name: 'Chip/' + label, hug: true });
  setT(i, { Label: label });
  return i;
}
function setChip(inst, layer, label, tone) {
  const n = find(inst, layer);
  n.swapComponent(CMP.Chip[tone || 'Outline']);
  setT(n, { Label: label });
}
/** Consecutive rows share one table. Inside a card the card is the frame; elsewhere the table draws its own. */
function kv(p, k, v) {
  const last = p.children[p.children.length - 1];
  const inCard = p.name === 'Card';
  const table = last && last.name === 'Table' ? last : box(p, Object.assign({ name: 'Table' }, inCard ? {} : { fill: 'raised', stroke: 'text', r: RADIUS.md, px: 16, py: 4 }));
  const first = table.children.length === 0;
  const i = place(CMP['Table row'].createInstance(), table, { name: 'Row/' + k });
  setT(i, { Key: k, Value: v });
  if (first) find(i, 'Rule').visible = false;
  return i;
}
function li(p, o) {
  const kind = o.chip ? 'Chip' : o.value !== undefined ? 'Value' : 'Chevron';
  const i = place(CMP['List item'][kind].createInstance(), p, { name: 'Item/' + o.title, to: o.to });
  setT(i, { Title: o.title, Meta: o.meta === undefined ? null : o.meta });
  if (o.value !== undefined) setT(i, { Value: o.value });
  if (o.chip) setChip(i, 'Chip', o.chip, o.tone);
  return i;
}
function listCard(p, heading, items) {
  const c = card(p, { name: 'List/' + (heading || 'Items'), py: 4, gap: 0 });
  if (heading) { const h = box(c, { name: 'Heading', pt: 8, pb: 4 }); text(h, heading, 'label'); }
  const rows = items.map((o) => li(c, o));
  if (rows.length) find(rows[rows.length - 1], 'Rule').visible = false; // no line under the last row
  return c;
}
function notice(p, tone, title, body) {
  const i = place(CMP.Notice[tone].createInstance(), p, { name: 'Notice/' + title });
  setT(i, { Title: title, Body: body === undefined ? null : body });
  return i;
}
function input(p, state, label, value, helper) {
  const i = place(CMP.Input[state || 'Default'].createInstance(), p, { name: 'Input/' + label });
  setT(i, { Label: label, Value: value, Helper: helper === undefined ? null : helper });
  return i;
}
function stat(p, tone, label, value, o) {
  const full = !!(o && o.flex === false);
  const i = place(CMP['Stat card'][tone + '|' + (full ? 'Full' : 'Half')].createInstance(), p, { name: 'Tile/' + label, flex: !full, h: full ? 112 : 88 });
  setT(i, { Label: label, Value: value });
  return i;
}
function stationRow(p, o) {
  const i = place(CMP['Station row'][o.frozen ? 'Frozen' : 'Active'].createInstance(), p, { name: 'Station/' + o.name, to: o.to });
  setT(i, { Name: o.name, 'Spent value': o.spent, 'Pending value': o.pending, 'Held value': o.held });
  return i;
}
const STATION_A = (to) => ({ name: 'Petron San Roque', spent: 'PHP 350.00', pending: 'PHP 0.00', held: 'PHP 0.00', to });
const STATION_B = (to) => ({ name: 'Rotonda Fuels', frozen: true, spent: 'PHP 0.00', pending: 'PHP 0.00', held: 'PHP 960.00', to });
const demoRate = (p) => chip(p, 'Testnet demo rate');
function sectionTitle(p, s) { return text(p, s, 'h2'); }
function skeleton(p, kinds) {
  kinds.forEach((k) => place(CMP.Skeleton[k].createInstance(), p, { name: 'Loading/' + k }));
}
function emptyState(p, o) {
  const i = place(CMP['Empty state'][o.action ? 'Yes' : 'No'].createInstance(), p, { name: 'Empty/' + o.title, to: o.to });
  setT(i, { Title: o.title, Body: o.body });
  if (o.action) setT(find(i, 'Button'), { Label: o.action });
  find(i, 'Disc').children.slice().forEach((c) => { if (o.icon && c.type === 'INSTANCE') c.swapComponent(CMP.Icon[o.icon]); });
  return i;
}
function imagePlaceholder(p, label) {
  const f = box(p, { name: 'Photo', h: 148, fill: 'sunken', stroke: 'text', r: RADIUS.md, align: 'CENTER', justify: 'CENTER', gap: 8 });
  icon(f, 'camera');
  text(f, label, 'mono', { ta: 'CENTER', hug: true });
  return f;
}

function priceChart(p, upto, fired) {
  const c = card(p, { name: 'Chart/Price', gap: 8 });
  const top = row(c, { justify: 'SPACE_BETWEEN', gap: 8 });
  text(top, 'Diesel price', 'label', { hug: true });
  chip(top, 'simulated DOE series');
  const pw = BW - 32, ph = 132;
  const plot = figma.createFrame();
  plot.name = 'Plot';
  plot.fills = [];
  c.appendChild(plot);
  plot.resize(pw, ph);
  const px = (i) => (i / 44) * pw;
  const py = (v) => ph - ((v - 56) / 18) * ph;
  const th = figma.createLine();
  th.name = 'Threshold PHP 65.00';
  plot.appendChild(th);
  th.resize(pw, 0);
  th.strokes = [paint('accent')];
  th.strokeWeight = 2;
  th.dashPattern = [6, 4];
  th.x = 0; th.y = py(65);
  polyline(plot, PRICES.slice(0, upto).map((v, i) => [px(i), py(v)]), 'primary', 2).name = 'Price line';
  if (fired) {
    const dot = figma.createEllipse();
    dot.name = 'Fired marker';
    dot.resize(10, 10);
    dot.fills = [paint('primary')];
    plot.appendChild(dot);
    dot.x = px(33) - 5; dot.y = py(PRICES[33]) - 5;
  }
  text(c, 'Threshold PHP 65.00 per litre. Point ' + upto + ' of 45.', 'caption', { name: 'Caption' });
  return c;
}

function edgeChart(p, upto, frozen) {
  const c = card(p, { name: 'Chart/Edges', gap: 8 });
  const top = row(c, { justify: 'SPACE_BETWEEN', gap: 8 });
  text(top, 'MIDAS score per tap', 'label', { hug: true });
  chip(top, 'simulated');
  const pw = BW - 32, ph = 132;
  const plot = figma.createFrame();
  plot.name = 'Plot';
  plot.fills = [];
  c.appendChild(plot);
  plot.resize(pw, ph);
  const py = (v) => ph - (v / 2.6) * ph;
  const th = figma.createLine();
  th.name = 'Threshold 1.78';
  plot.appendChild(th);
  th.resize(pw, 0);
  th.strokes = [paint('accent')];
  th.strokeWeight = 2;
  th.dashPattern = [6, 4];
  th.x = 0; th.y = py(MIDAS);
  EDGES.slice(0, upto).forEach((v, i) => {
    const over = v >= MIDAS;
    const d = figma.createEllipse();
    d.name = over ? 'Tap over threshold' : 'Tap';
    d.resize(over ? 12 : 8, over ? 12 : 8);
    d.fills = [paint(over ? 'text' : 'primary')];
    plot.appendChild(d);
    d.x = (i / (EDGES.length - 1)) * (pw - 12);
    d.y = py(v) - d.height / 2;
  });
  text(c, frozen ? 'Score 2.31 crossed the 1.78 line. Station B froze.' : 'Freeze line at 1.78. Taps are scored as they arrive.', 'caption', { name: 'Caption' });
  return c;
}

// ---------- screen frame ----------

let currentSection = null, currentSectionName = null;
let sectionRow = 0, sectionCol = 0, sectionRowTitle = null, sectionMaxX = 0, sectionMaxY = 0;
const TAB_ROOTS = { Home: 'Home/Dashboard/Default', Masterlist: 'Masterlist/Upload/Default', Enroll: 'Enroll/Pick/Default', Station: 'Station/Terminal/Default', Agents: 'Agents/Home/Default' };
const GAP_X = 48, GAP_Y = 120, SEC_PAD = 80;
const LABEL_W = 320; // row labels sit in a left gutter: above a frame they collide with Figma's frame names, which keep a fixed screen size at any zoom

function closeSection() {
  if (!currentSection) return;
  currentSection.resizeWithoutConstraints(sectionMaxX + SEC_PAD, sectionMaxY + SEC_PAD);
}

function slot(group, title) {
  if (currentSectionName !== group) {
    const prevBottom = currentSection ? currentSection.y + sectionMaxY + SEC_PAD + 120 : 0;
    closeSection();
    currentSection = figma.createSection();
    currentSection.name = group;
    currentSection.setPluginData('tapat', '1');
    currentSection.x = 0;
    currentSection.y = prevBottom;
    currentSectionName = group;
    sectionRow = -1; sectionRowTitle = null; sectionMaxX = 0; sectionMaxY = 0;
  }
  if (sectionRowTitle !== title) {
    sectionRow += 1;
    sectionCol = 0;
    sectionRowTitle = title;
    const y = SEC_PAD + sectionRow * (H + GAP_Y);
    const t = text(currentSection, title, 'h1', { name: 'Row label/' + title });
    t.textAutoResize = 'HEIGHT';
    t.resize(LABEL_W - 40, t.height);
    t.x = SEC_PAD;
    t.y = y;
  }
  const x = SEC_PAD + LABEL_W + sectionCol * (W + GAP_X);
  const y = SEC_PAD + sectionRow * (H + GAP_Y);
  sectionCol += 1;
  sectionMaxX = Math.max(sectionMaxX, x + W);
  sectionMaxY = Math.max(sectionMaxY, y + H);
  return { x, y };
}

/** A screen state is a function(body, frame), or { body, footer, top, sheet, toast }, or a shorthand for loading/error/empty. */
function def(group, title, opt, states) {
  Object.keys(states).forEach((state) => buildScreen(group, title, state, opt, states[state]));
}

function buildScreen(group, title, state, opt, spec) {
  if (typeof spec === 'function') spec = { body: spec };
  const name = group + '/' + title + '/' + state;
  if (FRAMES[name]) throw new Error('Duplicate screen ' + name);
  const pos = slot(group, title);
  const f = figma.createFrame();
  f.name = name;
  currentSection.appendChild(f);
  f.x = pos.x; f.y = pos.y;
  f.resize(W, H);
  f.fills = [paint('surface')];
  f.clipsContent = true;
  f.layoutMode = 'VERTICAL';
  f.primaryAxisSizingMode = 'FIXED';
  f.counterAxisSizingMode = 'FIXED';
  FRAMES[name] = f;
  report.screens += 1;

  place(CMP['Status bar'].createInstance(), f, { w: W, h: STATUS_H, name: 'Status bar' });
  const top = Object.assign({}, opt.top, spec.top || {});
  const bar = CMP['Top bar'][top.root ? 'Root' : 'Detail'].createInstance();
  place(bar, f, { w: W, h: TOP_H, name: 'Top bar' });
  if (!top.root) setT(bar, { Title: top.title });
  if (top.chip) setChip(bar, 'Chip', top.chip, top.tone); else find(bar, 'Chip').visible = false;

  const body = box(f, { name: 'Body', flex: true, px: PAD, pt: 8, pb: 24, gap: 16, clip: true });
  body.overflowDirection = 'VERTICAL';
  if (spec.loading) skeleton(body, spec.loading);
  if (spec.error) {
    notice(body, 'Error', spec.error[0], spec.error[1]);
    btn(body, 'Try again', { style: 'Secondary', to: spec.error[2] });
  }
  if (spec.empty) emptyState(body, spec.empty);
  if (spec.body) spec.body(body, f);

  let floating = 0;
  if (spec.footer && opt.solidFooter) {
    const foot = box(f, { name: 'Actions', px: PAD, pt: 4, pb: FLOAT_GAP, gap: 8 });
    spec.footer(foot);
    foot.findAll((n) => n.type === 'INSTANCE').forEach((n) => { n.effects = []; });
  } else if (spec.footer) {
    // Floating actions: no background band, and the content scrolls underneath them.
    const foot = figma.createFrame();
    foot.name = 'Actions';
    foot.fills = [];
    f.appendChild(foot);
    foot.layoutPositioning = 'ABSOLUTE';
    foot.layoutMode = 'VERTICAL';
    foot.resize(W, 100);
    foot.counterAxisSizingMode = 'FIXED';
    foot.primaryAxisSizingMode = 'AUTO';
    foot.clipsContent = false;
    bindNum(foot, 'itemSpacing', 8);
    bindNum(foot, 'paddingLeft', PAD);
    bindNum(foot, 'paddingRight', PAD);
    spec.footer(foot);
    foot.findAll((n) => n.type === 'INSTANCE' && n.name.indexOf('Button/') === 0 && n.fills.length > 0 && n.effects.length === 0).forEach((n) => {
      n.effects = FLOAT_SHADOW;
      pendingEffects.push([n, floatEffect]);
    });
    foot.x = 0;
    foot.y = H - TAB_H - FLOAT_GAP - foot.height;
    foot.constraints = { horizontal: 'MIN', vertical: 'MAX' };
    floating = foot.height + FLOAT_GAP;
    body.paddingBottom = floating + 24; // lets the last row scroll clear of the buttons
  }
  const tab = opt.tab || group;
  place(CMP['Tab bar'][tab].createInstance(), f, { w: W, name: 'Tab bar' });

  // Hotspots sit on the frame because prototype links on layers inside an instance are not reliable to set from a plugin.
  if (state === 'Default' || spec.nav) {
    Object.keys(TAB_ROOTS).forEach((t, i) => hotspot(f, 'Hotspot/Tab ' + t, i * (W / 5), H - TAB_H, W / 5, 56, TAB_ROOTS[t]));
  }
  if (!top.root) hotspot(f, 'Hotspot/Back', 0, STATUS_H + 6, 48, 44, 'BACK');
  if (spec.toast) {
    const t = CMP.Toast[spec.toast[0]].createInstance();
    t.name = 'Toast';
    f.appendChild(t);
    t.layoutPositioning = 'ABSOLUTE';
    setT(t, { Message: spec.toast[1] });
    t.x = PAD;
    t.y = H - TAB_H - 16 - t.height;
    t.constraints = { horizontal: 'MIN', vertical: 'MAX' };
  }
  if (spec.sheet) addSheet(f, spec.sheet[0], spec.sheet[1]);
  if (spec.confirm) addConfirm(f, spec.confirm);
  const content = body.children.reduce((sum, c) => sum + (c.visible === false ? 0 : c.height + 16), 0);
  if (content + floating > body.height + 1) report.overflow.push(name);
}

function hotspot(f, name, x, y, w, h, to) {
  const n = figma.createFrame();
  n.name = name;
  n.fills = [];
  f.appendChild(n);
  n.layoutPositioning = 'ABSOLUTE';
  n.resize(w, h);
  n.x = x; n.y = y;
  LINKS.push([n, to]);
}

function addScrim(f) {
  const scrim = figma.createFrame();
  scrim.name = 'Scrim';
  scrim.fills = [{ type: 'SOLID', color: hexRgb(COLORS.text), opacity: 0.4 }];
  f.appendChild(scrim);
  scrim.layoutPositioning = 'ABSOLUTE';
  scrim.resize(W, H);
  scrim.x = 0; scrim.y = 0;
  LINKS.push([scrim, 'BACK']);
}

function hotspotOver(f, node, to) {
  const a = node.absoluteTransform, b = f.absoluteTransform;
  hotspot(f, 'Hotspot/' + node.name, a[0][2] - b[0][2], a[1][2] - b[1][2], node.width, node.height, to);
}

function addConfirm(f, o) {
  addScrim(f);
  const s = CMP['Bottom sheet'].Two.createInstance();
  s.name = 'Sheet';
  f.appendChild(s);
  s.layoutPositioning = 'ABSOLUTE';
  setT(find(s, 'Header'), { Title: o.title });
  setT(s, { Body: o.body });
  const primary = find(s, 'Primary'), secondary = find(s, 'Secondary');
  setT(primary, { Label: o.primary[0] });
  setT(secondary, { Label: o.secondary[0] });
  s.x = 0;
  s.y = H - s.height;
  s.constraints = { horizontal: 'MIN', vertical: 'MAX' };
  hotspotOver(f, primary, o.primary[1]);
  hotspotOver(f, secondary, o.secondary[1]);
}

function addSheet(f, title, build) {
  addScrim(f);

  const s = figma.createFrame();
  s.name = 'Sheet';
  f.appendChild(s);
  s.layoutPositioning = 'ABSOLUTE';
  s.layoutMode = 'VERTICAL';
  s.resize(W, 200);
  s.counterAxisSizingMode = 'FIXED';
  s.primaryAxisSizingMode = 'AUTO';
  s.fills = [paint('surface')];
  setStroke(s, 'text');
  s.topLeftRadius = RADIUS.lg; s.topRightRadius = RADIUS.lg;
  bindNum(s, 'paddingBottom', 32);
  s.clipsContent = true;
  pendingEffects.push([s, sheetEffect]);
  const header = place(CMP['Sheet header'].createInstance(), s, { name: 'Header' });
  setT(header, { Title: title });
  const content = box(s, { name: 'Content', px: PAD, gap: 12 });
  build(content);
  s.x = 0;
  s.y = H - s.height;
  s.constraints = { horizontal: 'MIN', vertical: 'MAX' };
}

// ---------- screens ----------

function tiles(b, m) {
  stat(b, 'Forest', 'Funded', m.funded, { flex: false });
  const r1 = row(b, { gap: 12, align: 'MIN' });
  stat(r1, 'Cream', 'Spent', m.spent);
  stat(r1, 'Cream', 'Held', m.held);
  const r2 = row(b, { gap: 12, align: 'MIN' });
  stat(r2, 'Cream', 'Pending', m.pending);
  stat(r2, 'Cream', 'Returned', m.returned);
}

function programHeader(b, statusLabel, tone) {
  const h = row(b, { justify: 'SPACE_BETWEEN', gap: 8, align: 'MIN' });
  text(h, 'TODA Fuel Aid — San Roque', 'h2', { flex: true, name: 'Program name' });
  chip(h, statusLabel, tone || 'Mint');
}

const MONEY_LIVE = { funded: 'PHP 4,500', spent: 'PHP 350', held: 'PHP 960', pending: 'PHP 0', returned: 'PHP 0' };
const MONEY_ZERO = { funded: 'PHP 0', spent: 'PHP 0', held: 'PHP 0', pending: 'PHP 0', returned: 'PHP 0' };
const MONEY_END = { funded: 'PHP 4,500', spent: 'PHP 350', held: 'PHP 960', pending: 'PHP 0', returned: 'PHP 3,190' };

function invariant(b, status, escrow) {
  const i = place(CMP.Invariant[status].createInstance(), b, { name: 'Invariant' });
  setT(i, { Escrow: escrow });
}

function homeLinks(b) {
  listCard(b, null, [
    { title: 'Stations', meta: 'Rotonda Fuels is frozen', to: 'Home/Stations/Default' },
    { title: 'Cards', meta: '5 enrolled', to: 'Home/Cards/Default' },
    { title: 'Activity', meta: 'Taps and agent decisions', to: 'Home/Activity/Default' },
    { title: 'Export for COA', meta: 'Every money event with its tx hash', to: 'Home/Export/Default' },
    { title: 'System health', meta: 'RPC, Velo, Telegram, gas mode', to: 'Home/Health/Default' },
  ]);
}

function dash(b, o) {
  programHeader(b, o.status || 'Active', o.tone);
  listCard(b, null, [o.budget]);
  tiles(b, o.money);
  invariant(b, o.invariant || 'OK', o.escrow);
  demoRate(b);
  if (o.links !== false) homeLinks(b);
}
const BUDGET_VERIFIED = (to) => ({ title: 'PHP 10,000.00 budget', meta: 'PHP 5,500.00 left to fund', chip: 'Velo verified', tone: 'Accent', to });
const BUDGET_NONE = (to) => ({ title: 'No budget yet', meta: 'Fund it before a tranche can release', chip: 'Fund budget', tone: 'Accent', to });
const BUDGET_WAIT = (to) => ({ title: 'PHP 10,000.00 budget', meta: 'Open checkout to finish paying', chip: 'Waiting for Velo…', tone: 'Outline', to });
const dashLive = (b) => dash(b, { budget: BUDGET_VERIFIED('Home/Budget/Verified'), money: MONEY_LIVE, escrow: 'PHP 3,190.00' });
const dashWaiting = (b) => dash(b, { budget: BUDGET_WAIT('Home/Budget/Waiting'), money: MONEY_ZERO, escrow: 'PHP 0.00', links: false });
const dashZero = (b) => dash(b, { budget: BUDGET_NONE('Home/Budget/None'), money: MONEY_ZERO, escrow: 'PHP 0.00', links: false });

function buildHome() {
  const root = { top: { root: true } };
  def('Home', 'Dashboard', root, {
    Default: dashLive,
    'Before funding': { body: dashZero },
    'Budget sent': { body: dashWaiting, toast: ['Success', 'Payment sent — waiting for Velo verification'] },
    'Checkout cancelled': { body: dashZero, toast: ['Info', 'Checkout cancelled'] },
    Ended: { body: (b) => dash(b, { status: 'Ended', tone: 'Outline', budget: BUDGET_VERIFIED('Home/Budget/Verified'), money: MONEY_END, escrow: 'PHP 0.00' }), nav: true },
    Mismatch: (b) => dash(b, { budget: BUDGET_VERIFIED('Home/Budget/Verified'), money: MONEY_LIVE, escrow: 'PHP 3,000.00', invariant: 'MISMATCH' }),
    'No program': { empty: { icon: 'list', title: 'No active program', body: 'Create a program to set the cap, tranche and expiry.', action: 'Create program', to: 'Home/Create program/Default' } },
    Loading: { loading: ['Line', 'Row', 'Card', 'Card', 'Card', 'Row'] },
    Error: { error: ['Could not load the dashboard', 'Something went wrong on our side. Try again in a moment.', 'Home/Dashboard/Default'] },
  });

  const form = (b, o) => {
    o = o || {};
    if (o.notice) notice(b, 'Error', o.notice[0], o.notice[1]);
    input(b, 'Focused', 'Program name', 'TODA Fuel Aid — San Roque');
    input(b, 'Default', 'Per-tap cap', 'PHP 500.00', 'Enforced on-chain for every card');
    input(b, 'Default', 'Tranche per card', 'PHP 1,500.00');
    input(b, 'Default', 'Policy expiry', 'Nov 30, 2026 · 11:59 PM');
    input(b, 'Default', 'Price threshold per litre', 'PHP 65.00');
    input(b, o.alphaError ? 'Error' : 'Default', 'Max wrongful-denial rate α', o.alphaError ? '1.20' : '0.05', o.alphaError ? 'alpha must be between 0 and 1' : undefined);
    input(b, 'Default', 'Max ghost-admission rate β', '0.02');
  };
  const detail = (title, chip) => ({ top: { title, chip } });
  def('Home', 'Create program', detail('Create program'), {
    Default: { body: (b) => form(b), footer: (x) => btn(x, 'Create program', { to: 'Home/Dashboard/Before funding' }) },
    'Validation error': { body: (b) => form(b, { alphaError: true }), footer: (x) => btn(x, 'Create program') },
    'Program exists': { body: (b) => form(b, { notice: ['A program already exists', 'Only one program runs at a time. End it before creating another.'] }), footer: (x) => btn(x, 'Create program', { state: 'Disabled' }) },
    Submitting: { body: (b) => form(b), footer: (x) => btn(x, 'Creating', { state: 'Loading' }) },
  });

  const sheetTop = { top: { root: true } };
  def('Home', 'Budget', sheetTop, {
    None: {
      body: dashZero,
      sheet: ['Fund the budget', (s) => {
        input(s, 'Default', 'Budget amount', 'PHP 10,000.00', 'Paid once through Velo checkout, from the Budget Office wallet.');
        kv(s, 'Display rate', 'PHP 10 per XLM, demo rate');
        btn(s, 'Fund budget', { to: 'Home/Budget/Waiting' });
      }],
    },
    Waiting: {
      body: dashWaiting,
      sheet: ['Waiting for Velo', (s) => {
        notice(s, 'Info', 'Waiting for Velo…', 'A tranche can only be funded after the payment is verified on the ledger.');
        kv(s, 'Payment intent', 'pi_test_7f21');
        kv(s, 'Amount', 'PHP 10,000.00');
        btn(s, 'Open checkout', { to: 'Home/Dashboard/Budget sent' });
      }],
    },
    Verified: {
      body: dashLive,
      sheet: ['Budget', (s) => {
        chip(s, 'Velo verified', 'Outline');
        kv(s, 'Verified', 'PHP 10,000.00');
        kv(s, 'Funded', 'PHP 4,500.00');
        kv(s, 'Remaining', 'PHP 5,500.00');
        kv(s, 'Payment intent', 'pi_test_7f21');
      }],
    },
    'Checkout error': {
      body: dashZero,
      sheet: ['Fund the budget', (s) => {
        notice(s, 'Error', 'Could not open checkout', 'CHAIN_ERROR: VELO_CALL_FAILED. Nothing was charged.');
        input(s, 'Default', 'Budget amount', 'PHP 10,000.00');
        btn(s, 'Try again', { style: 'Secondary' });
      }],
    },
  });

  def('Home', 'Stations', detail('Stations'), {
    Default: (b) => {
      stationRow(b, STATION_A('Home/Station detail/Active'));
      stationRow(b, STATION_B('Home/Station detail/Frozen'));
      demoRate(b);
    },
    Loading: { loading: ['Card', 'Card'] },
    Error: { error: ['Could not load stations', 'Something went wrong on our side. Try again in a moment.', 'Home/Stations/Default'] },
  });

  const stationDetail = (frozen) => (b) => {
    if (frozen) notice(b, 'Frozen', 'Frozen by the Freeze Agent', 'New taps are refused before signing, and this station is not settled until you unfreeze it.');
    stationRow(b, frozen ? STATION_B() : STATION_A());
    const c = card(b, { gap: 8 });
    kv(c, 'Station ID', frozen ? 'B' : 'A');
    kv(c, 'Public key', frozen ? 'GBRF…4K2Q' : 'GCPS…9T1M');
    if (frozen) kv(c, 'Frozen at', 'Nov 5, 2026 · 10:40 AM');
    demoRate(b);
  };
  def('Home', 'Station detail', detail('Station'), {
    Active: { body: stationDetail(false), top: { title: 'Station A', chip: 'Active', tone: 'Mint' } },
    Frozen: { body: stationDetail(true), top: { title: 'Station B', chip: 'Frozen', tone: 'Frozen' }, footer: (x) => btn(x, 'Unfreeze station', { to: 'Home/Unfreeze/Confirm' }) },
  });
  def('Home', 'Unfreeze', detail('Station B'), {
    Confirm: {
      top: { title: 'Station B', chip: 'Frozen', tone: 'Frozen' },
      body: stationDetail(true),
      confirm: { title: 'Unfreeze station?', body: 'New taps are accepted again. The PHP 960.00 held stays in escrow until the next settlement run.', primary: ['Unfreeze Rotonda Fuels', 'Home/Stations/Default'], secondary: ['Keep frozen', 'BACK'] },
    },
    'Already active': {
      top: { title: 'Station B', chip: 'Active', tone: 'Mint' },
      body: (b) => {
        notice(b, 'Error', 'Station is already active', 'INVALID_STATE: there is nothing to unfreeze.');
        stationRow(b, { name: 'Rotonda Fuels', spent: 'PHP 0.00', pending: 'PHP 960.00', held: 'PHP 0.00' });
      },
    },
  });

  const CARDS = [
    { title: 'Juan D. …9C7E', meta: '3f9c1a0b · escrow PHP 1,150.00', chip: 'Active', tone: 'Mint' },
    { title: 'Pedro R. …3A54', meta: 'a71d4c22 · escrow PHP 540.00', chip: 'Active', tone: 'Mint' },
    { title: 'Ramon B. …77B0', meta: '5c02e8f6 · escrow PHP 0.00', chip: 'Expired' },
    { title: 'Ana V. …A1B2', meta: 'e4b81d90 · escrow PHP 0.00', chip: 'Active', tone: 'Mint' },
    { title: 'Lito G. …AL05', meta: '0d6a93c1 · virtual · escrow PHP 1,500.00', chip: 'Active', tone: 'Mint' },
  ];
  def('Home', 'Cards', detail('Cards'), {
    Default: (b) => { listCard(b, null, CARDS); demoRate(b); },
    'Other statuses': (b) => {
      listCard(b, 'Reference', [
        { title: 'Juan D. …9C7E', meta: 'Swept · returned PHP 1,150.00', chip: 'Swept' },
        { title: 'Ana V. …A1B2', meta: 'Waiting for the chain', chip: 'Pending' },
        { title: 'Pedro R. …3A54', meta: 'Enrollment failed on-chain. Retrying the same card resumes it.', chip: 'Failed', tone: 'Danger' },
        { title: 'Ramon B. …77B0', meta: 'Policy revoked', chip: 'Revoked' },
      ]);
    },
    Empty: { empty: { icon: 'idcard', title: 'No cards yet', body: 'Enrolled cards appear here, in enrollment order.', action: 'Enroll a driver', to: 'Enroll/Pick/Default' } },
    Loading: { loading: ['Row', 'Row', 'Row', 'Row', 'Row'] },
    Error: { error: ['Could not load cards', 'Something went wrong on our side. Try again in a moment.', 'Home/Cards/Default'] },
  });

  const FEED = [
    { title: 'Station B frozen', meta: 'Freeze Agent · MIDAS 2.31 >= 1.78', chip: 'Frozen', tone: 'Frozen', to: 'Home/Activity detail/Freeze' },
    { title: '…3A54 at Rotonda Fuels', meta: 'Paid · tx 9e2b…71d0', value: 'PHP 480.00' },
    { title: '…77B0 at Petron San Roque', meta: 'Declined · card expired', chip: 'Declined', tone: 'Danger', to: 'Home/Activity detail/Declined' },
    { title: '…9C7E at Petron San Roque', meta: 'Declined · over the ₱500.00 per-tap cap', chip: 'Declined', tone: 'Danger', to: 'Home/Activity detail/Declined' },
    { title: '…9C7E at Petron San Roque', meta: 'Paid · tx 7f3a…c21e', value: 'PHP 350.00', to: 'Home/Activity detail/Paid' },
    { title: 'Tranche released', meta: 'Tranche Agent · 3 cards funded, 1 skipped', value: 'PHP 4,500.00', to: 'Home/Activity detail/Tranche' },
  ];
  def('Home', 'Activity', detail('Activity'), {
    Default: (b) => { listCard(b, null, FEED); demoRate(b); },
    Empty: { empty: { icon: 'pulse', title: 'No activity yet', body: 'Taps and agent decisions appear here as they happen, newest first.' } },
    Loading: { loading: ['Row', 'Row', 'Row', 'Row', 'Row', 'Row'] },
    Error: { error: ['Could not load activity', 'Something went wrong on our side. Try again in a moment.', 'Home/Activity/Default'] },
  });

  const baseFeed = (b) => listCard(b, null, FEED);
  def('Home', 'Activity detail', detail('Activity'), {
    Paid: {
      body: baseFeed,
      sheet: ['Tap paid', (s) => {
        chip(s, 'Authorized', 'Mint');
        kv(s, 'Card', 'Juan D. …9C7E');
        kv(s, 'Station', 'Petron San Roque');
        kv(s, 'Amount', 'PHP 350.00');
        kv(s, 'MIDAS score', '0.12');
        kv(s, 'Tx', '7f3a…c21e');
        btn(s, 'View on Stellar Expert', { style: 'Secondary' });
      }],
    },
    Declined: {
      body: baseFeed,
      sheet: ['Tap declined', (s) => {
        chip(s, 'Declined', 'Danger');
        kv(s, 'Card', 'Juan D. …9C7E');
        kv(s, 'Amount', 'PHP 800.00');
        kv(s, 'Reason', 'over the ₱500.00 per-tap cap');
        kv(s, 'Tx', 'None submitted');
      }],
    },
    Tranche: {
      body: baseFeed,
      sheet: ['Tranche released', (s) => {
        chip(s, 'Tranche Agent · FUNDED', 'Mint');
        kv(s, 'Price', 'PHP 71.20');
        kv(s, 'Segment mean', 'PHP 70.90');
        kv(s, 'Threshold', 'PHP 65.00');
        kv(s, 'Changepoint probability', '0.94');
        kv(s, 'Run length', '5');
        kv(s, 'Funded', '3 cards');
        kv(s, 'Skipped', '…77B0 EXPIRED');
        chip(s, 'simulated DOE series');
      }],
    },
    Freeze: {
      body: baseFeed,
      sheet: ['Station frozen', (s) => {
        chip(s, 'Freeze Agent · FROZEN', 'Frozen');
        kv(s, 'Station', 'Rotonda Fuels');
        kv(s, 'Score', '2.31');
        kv(s, 'Threshold', '1.78');
        kv(s, 'Rule', 'NEAR_CAP_STREAK');
        chip(s, 'simulated burst');
      }],
    },
  });

  const exportSheet = (extra) => (s) => {
    if (extra) extra(s);
    kv(s, 'File', 'tapat-coa-prog_a1b2c3d4.csv');
    text(s, 'timestamp, event, card_hash_prefix, station, amount_php, amount_xlm, tx_hash, agent_decision_id', 'mono', { name: 'Columns' });
  };
  def('Home', 'Export', root, {
    Default: {
      body: dashLive,
      sheet: ['Export for COA', (s) => {
        exportSheet()(s);
        btn(s, 'Download CSV', { to: 'Home/Export/Downloading' });
      }],
    },
    Downloading: {
      body: dashLive,
      sheet: ['Export for COA', (s) => {
        exportSheet()(s);
        btn(s, 'Preparing file', { state: 'Loading', to: 'Home/Dashboard/Default' });
      }],
    },
    'No program': {
      empty: { icon: 'download', title: 'Nothing to export', body: 'A CSV is available once a program exists.', action: 'Create program', to: 'Home/Create program/Default' },
    },
  });

  const healthList = (rows) => (b) => {
    listCard(b, null, rows);
  };
  def('Home', 'Health', detail('System health'), {
    Default: healthList([
      { title: 'Stellar RPC', chip: 'OK', tone: 'Mint' },
      { title: 'Velo', chip: 'OK', tone: 'Mint' },
      { title: 'Telegram', chip: 'OK', tone: 'Mint' },
      { title: 'Gas mode', meta: 'Fees are sponsored through the Gas Station', value: 'velo' },
    ]),
    Degraded: (b) => {
      notice(b, 'Info', 'Running in degraded mode', 'Velo is down. Taps still reach the chain if gas fallback is on.');
      healthList([
        { title: 'Stellar RPC', chip: 'OK', tone: 'Mint' },
        { title: 'Velo', chip: 'Down', tone: 'Ink' },
        { title: 'Telegram', chip: 'OK', tone: 'Mint' },
        { title: 'Gas mode', meta: 'Submitting directly', value: 'direct' },
      ])(b);
    },
    Down: (b) => {
      notice(b, 'Error', 'Stellar RPC is down', 'Payments cannot be authorized until the RPC is back.');
      healthList([
        { title: 'Stellar RPC', chip: 'Down', tone: 'Ink' },
        { title: 'Velo', chip: 'OK', tone: 'Mint' },
        { title: 'Telegram', chip: 'OK', tone: 'Mint' },
      ])(b);
    },
    Loading: { loading: ['Row', 'Row', 'Row', 'Row'] },
  });
}

function buildMasterlist() {
  const root = { top: { root: true } };
  const detail = (title) => ({ top: { title } });
  const uploadBody = (o) => (b) => {
    o = o || {};
    sectionTitle(b, 'Upload the masterlist');
    if (o.notice) notice(b, 'Error', o.notice[0], o.notice[1]);
    const drop = card(b, { name: 'Upload area', align: 'CENTER', gap: 8, py: 24 });
    icon(drop, 'upload');
    text(drop, o.file || 'Choose a CSV or a scanned list', 'label', { ta: 'CENTER' });
    text(drop, 'CSV up to 1 MB. PNG or JPG up to 5 MB.', 'caption', { ta: 'CENTER' });
    const c = card(b, { gap: 8 });
    text(c, 'CSV columns, in this order', 'label');
    text(c, 'last_name, first_name, middle_name, suffix, birthdate, plate, toda, barangay', 'mono');
    text(c, 'Birthdate as YYYY-MM-DD. Middle name and suffix may be empty.', 'caption');
    li(b, { title: 'View beneficiaries', to: 'Masterlist/Beneficiaries/Default' });
  };
  def('Masterlist', 'Upload', root, {
    Default: { body: uploadBody(), footer: (x) => btn(x, 'Upload masterlist', { to: 'Masterlist/Results/Default' }) },
    Uploading: { body: uploadBody({ file: 'scanned-list.png' }), footer: (x) => btn(x, 'Checking 12 rows', { state: 'Loading', to: 'Masterlist/Results/Default' }) },
    'Bad CSV': { body: uploadBody({ notice: ['Check the CSV header', 'VALIDATION_ERROR: the first column must be last_name.'], file: 'masterlist.csv' }), footer: (x) => btn(x, 'Upload masterlist') },
    'OCR unavailable': { body: uploadBody({ notice: ['This image cannot be read', 'OCR model not bundled in demo build; upload CSV'], file: 'photo-of-list.jpg' }), footer: (x) => btn(x, 'Upload masterlist') },
    'No program': { empty: { icon: 'upload', title: 'No active program', body: 'Create a program before uploading a masterlist.', action: 'Create program', to: 'Home/Create program/Default' } },
  });

  const results = (o) => (b) => {
    o = o || {};
    sectionTitle(b, '12 rows checked');
    chip(b, 'precomputed OCR');
    if (o.infeasible) notice(b, 'Info', 'Calibration is not feasible', 'The two limits overlap on the grid, so the thresholds were clamped. Review results with care.');
    const r1 = row(b, { gap: 12, align: 'MIN' });
    stat(r1, 'Cream', 'Approved', '4');
    stat(r1, 'Cream', 'Already enrolled', '4');
    const r2 = row(b, { gap: 12, align: 'MIN' });
    stat(r2, 'Cream', 'Rejected', '2');
    stat(r2, 'Cream', 'Uncertain', '2');
    listCard(b, 'Rejected', [
      { title: 'Rodel Cruz', meta: 'Ghost, duplicate plate', chip: 'Rejected' },
      { title: 'Mark Salazar', meta: 'Underage', chip: 'Rejected' },
    ]);
    const c = card(b, { gap: 8 });
    text(c, 'Calibration', 'label');
    kv(c, 'Approve at or above λ', '0.81');
    kv(c, 'Reject below λ', '0.62');
    kv(c, 'Max wrongful denial α', '0.05');
    kv(c, 'Max ghost admission β', '0.02');
    kv(c, 'Measured wrongful denial', '0.041');
    kv(c, 'Measured ghost admission', '0.013');
    kv(c, 'Calibration set', '400');
  };
  const reviewBtn = (x) => btn(x, 'Review beneficiaries', { to: 'Masterlist/Beneficiaries/Default' });
  def('Masterlist', 'Results', detail('Intake results'), {
    Default: { body: results(), footer: reviewBtn },
    'Calibration not feasible': { body: results({ infeasible: true }), footer: reviewBtn },
    Loading: { loading: ['Line', 'Card', 'Card', 'Row', 'Row'] },
  });

  const filters = (b, selected) => {
    const f = row(b, { name: 'Filters', gap: 8, clip: true });
    f.primaryAxisSizingMode = 'FIXED';
    f.overflowDirection = 'HORIZONTAL';
    ['All', 'Approved', 'Uncertain', 'Evidence', 'Rejected', 'Enrolled'].forEach((k) => {
      const i = place(CMP['Filter chip'][k === selected ? 'Selected' : 'Default'].createInstance(), f, { name: 'Filter/' + k });
      setT(i, { Label: k });
    });
  };
  const PEOPLE = [
    { title: 'Maria Teresa C. Santos', meta: 'XYZ 7788 · Rotonda TODA · 0.71', chip: 'Uncertain', to: 'Masterlist/Beneficiary/Uncertain' },
    { title: 'Nestor D. Ramos', meta: 'TRK 3390 · San Roque TODA · 0.66', chip: 'Evidence requested', to: 'Masterlist/Beneficiary/Evidence requested' },
    { title: 'Ana R. Villanueva', meta: 'NAV 5512 · San Roque TODA · 0.97', chip: 'Approved', tone: 'Mint', to: 'Masterlist/Beneficiary/Approved' },
    { title: 'Mark L. Salazar', meta: 'WRE 2207 · Rotonda TODA · UNDERAGE', chip: 'Rejected', to: 'Masterlist/Beneficiary/Rejected' },
    { title: 'Juan S. Dela Cruz', meta: 'ABC 1234 · San Roque TODA · 1.00', chip: 'Enrolled', tone: 'Mint' },
  ];
  def('Masterlist', 'Beneficiaries', detail('Beneficiaries'), {
    Default: (b) => { filters(b, 'All'); listCard(b, null, PEOPLE); },
    'Empty filter': (b) => {
      filters(b, 'Evidence');
      emptyState(b, { icon: 'list', title: 'No one here', body: 'No beneficiary is waiting on evidence right now.' });
    },
    Empty: { empty: { icon: 'upload', title: 'No beneficiaries yet', body: 'Upload a masterlist to check every row.', action: 'Upload masterlist', to: 'Masterlist/Upload/Default' } },
    Loading: { loading: ['Row', 'Row', 'Row', 'Row', 'Row'] },
    Error: { error: ['Could not load beneficiaries', 'VALIDATION_ERROR: unknown status filter.', 'Masterlist/Beneficiaries/Default'] },
  });

  const person = (o) => (b) => {
    if (o.notice) notice(b, o.notice[0], o.notice[1], o.notice[2]);
    const h = row(b, { justify: 'SPACE_BETWEEN', gap: 8, align: 'MIN' });
    text(h, o.name, 'h2', { flex: true, name: 'Full name' });
    chip(h, o.status, o.tone);
    const c = card(b, { gap: 8 });
    kv(c, 'Birthdate', o.birth);
    kv(c, 'Plate', o.plate);
    kv(c, 'TODA', o.toda);
    kv(c, 'Barangay', o.brgy);
    kv(c, 'Source', 'precomputed OCR');
    const d = card(b, { gap: 8 });
    text(d, 'Decision', 'label');
    kv(d, 'Score', o.score);
    if (o.rule) kv(d, 'Rule', o.rule);
    kv(d, 'Reason', o.reason);
    kv(d, 'Telegram', o.linked ? 'Linked' : 'Not linked');
  };
  const MARIA = { name: 'Maria Teresa C. Santos', status: 'Uncertain', birth: '1979-07-19', plate: 'XYZ 7788', toda: 'Rotonda TODA', brgy: 'Rotonda', score: '0.71', reason: 'score 0.71 inside [0.62, 0.81)' };
  def('Masterlist', 'Beneficiary', detail('Beneficiary'), {
    Uncertain: { body: person(MARIA), footer: (x) => btn(x, 'Request evidence', { to: 'Masterlist/Beneficiary/Telegram link' }) },
    Rejected: {
      body: person({ name: 'Mark L. Salazar', status: 'Rejected', birth: '2011-02-14', plate: 'WRE 2207', toda: 'Rotonda TODA', brgy: 'Rotonda', score: '0.84', rule: 'UNDERAGE', reason: 'Hard rule: under 18 on the program date' }),
      footer: (x) => btn(x, 'Appeal with evidence', { to: 'Masterlist/Beneficiary/Evidence requested' }),
    },
    'Evidence requested': { body: person({ name: 'Nestor D. Ramos', status: 'Evidence requested', birth: '1975-09-30', plate: 'TRK 3390', toda: 'San Roque TODA', brgy: 'San Roque', score: '0.66', reason: 'score 0.66 inside [0.62, 0.81)', linked: true, notice: ['Info', 'Waiting on the driver', 'The OR/CR request went out on Telegram. A verified file moves this record to approved.'] }) },
    Approved: {
      body: person({ name: 'Ana R. Villanueva', status: 'Approved', tone: 'Mint', birth: '1991-11-04', plate: 'NAV 5512', toda: 'San Roque TODA', brgy: 'San Roque', score: '0.97', reason: 'genuine' }),
      footer: (x) => btn(x, 'Enroll this driver', { to: 'Enroll/Read card/Ready' }),
    },
    'Telegram link': {
      body: person(MARIA),
      sheet: ['Send the link by hand', (s) => {
        notice(s, 'Info', 'Telegram is not linked', 'The evidence request could not be delivered. Hand the phone over, or share this link with the driver.');
        text(s, 'https://t.me/tapat_demo_bot?start=p4wq8zr2', 'mono', { name: 'Deep link' });
        btn(s, 'Open in Telegram', { to: 'Masterlist/Beneficiary/Evidence requested' });
      }],
    },
    Conflict: { body: person(Object.assign({}, MARIA, { status: 'Evidence requested', notice: ['Error', 'Request already sent', 'INVALID_STATE: this record is already waiting on evidence.'] })) },
  });
}

function buildEnroll() {
  const topRoot = { top: { root: true } };
  const step = (b, n) => place(CMP.Stepper[String(n)].createInstance(), b, { name: 'Stepper' });
  const driver = (b) => {
    const c = card(b, { gap: 8 });
    kv(c, 'Driver', 'Ana V.');
    kv(c, 'Plate', 'NAV 5512');
    kv(c, 'TODA', 'San Roque TODA');
  };
  def('Enroll', 'Pick', topRoot, {
    Default: (b) => {
      step(b, 1);
      sectionTitle(b, 'Who are you enrolling?');
      listCard(b, null, [
        { title: 'Ana R. Villanueva', meta: 'NAV 5512 · San Roque TODA', to: 'Enroll/Read card/Ready' },
        { title: 'Carlos M. Ocampo', meta: 'DKT 6140 · Rotonda TODA' },
        { title: 'Rey A. Mendoza', meta: 'PLM 9023 · San Roque TODA' },
      ]);
    },
    Empty: { empty: { icon: 'idcard', title: 'No approved drivers', body: 'A driver can enroll once the masterlist check approves them.', action: 'Open masterlist', to: 'Masterlist/Upload/Default' } },
    Loading: { loading: ['Line', 'Line', 'Row', 'Row', 'Row'] },
    Error: { error: ['Could not load approved drivers', 'Something went wrong on our side. Try again in a moment.', 'Enroll/Pick/Default'] },
  });

  const panel = (b, title, body, ic) => {
    const p = card(b, { name: 'Card reader', align: 'CENTER', gap: 12, py: 32 });
    icon(p, ic || 'tap');
    text(p, title, 'h2', { ta: 'CENTER' });
    text(p, body, 'small', { ta: 'CENTER' });
  };
  const readBody = (title, body, o) => (b) => {
    o = o || {};
    step(b, 2);
    driver(b);
    if (o.notice) notice(b, 'Error', o.notice[0], o.notice[1]);
    panel(b, title, body, o.icon);
  };
  const nfcRetry = (x) => btn(x, 'Read card', { to: 'Enroll/Read card/Waiting' });
  const detail = { top: { title: 'Enroll driver' } };
  def('Enroll', 'Read card', detail, {
    Ready: { body: readBody('Read the blank card', 'Press Read card, then hold the card to the back of the phone.'), footer: nfcRetry, nav: true },
    Waiting: { body: readBody('Hold the card still', 'Listening for up to 15 seconds.'), footer: (x) => btn(x, 'Reading', { state: 'Loading', to: 'Enroll/Read card/Read' }) },
    Read: { body: readBody('Card …A1B2', 'Only the last four characters are ever shown.', { icon: 'check' }), footer: (x) => { btn(x, 'Continue', { to: 'Enroll/Photo/Sample' }); btn(x, 'Read again', { style: 'Secondary', to: 'Enroll/Read card/Waiting' }); } },
    Unsupported: { body: readBody('Read the blank card', 'Card reading needs Chrome on an Android phone.', { notice: ['This browser cannot read cards', 'NFC_UNSUPPORTED: open this page in Chrome on Android.'] }), footer: (x) => btn(x, 'Read card', { state: 'Disabled' }) },
    Permission: { body: readBody('Read the blank card', 'Turn on NFC, then allow it for this site.', { notice: ['NFC permission is off', 'NFC_PERMISSION: allow NFC for this site and try again.'] }), footer: nfcRetry },
    Timeout: { body: readBody('Read the blank card', 'Hold the card flat against the back of the phone.', { notice: ['No card found', 'NFC_TIMEOUT: nothing was read in 15 seconds.'] }), footer: nfcRetry },
    'Read error': { body: readBody('Read the blank card', 'Lift the card and try once more.', { notice: ['Could not read this card', 'NFC_READ_ERROR: the read did not finish.'] }), footer: nfcRetry },
  });

  const photoBody = (o) => (b) => {
    o = o || {};
    step(b, 3);
    if (o.notice) notice(b, 'Error', o.notice[0], o.notice[1]);
    imagePlaceholder(b, o.label || 'd4-photo.jpg');
    if (o.sample !== false) {
      chip(b, 'precomputed vision');
      const c = card(b, { gap: 8 });
      kv(c, 'Plate on photo', o.plate || 'NAV 5512');
      kv(c, 'TODA on photo', 'San Roque TODA');
      kv(c, 'Card', '…A1B2');
    } else {
      const c = card(b, { dir: 'H', align: 'CENTER', gap: 12 });
      const box2 = row(c, { name: 'Checkbox', w: 44, h: 44, justify: 'CENTER', fill: o.confirmed ? 'primary' : 'raised', stroke: o.confirmed ? 'primary' : 'text', r: RADIUS.sm });
      if (o.confirmed) icon(box2, 'check', 'surface');
      text(c, 'I checked that the plate and TODA on this photo match the record.', 'small', { flex: true });
    }
  };
  const enrollBtn = (x) => btn(x, 'Enroll', { to: 'Enroll/Result/Success' });
  def('Enroll', 'Photo', detail, {
    Sample: { body: photoBody(), footer: (x) => { enrollBtn(x); btn(x, 'Upload a photo instead', { style: 'Tertiary', to: 'Enroll/Photo/Upload' }); } },
    Upload: { body: photoBody({ sample: false, label: 'Photo from camera', confirmed: true }), footer: enrollBtn },
    'Confirmation required': { body: photoBody({ sample: false, label: 'Photo from camera', notice: ['Confirm the photo first', 'PHOTO_CONFIRMATION_REQUIRED: an uploaded photo needs your confirmation.'] }), footer: (x) => btn(x, 'Enroll') },
    Mismatch: { body: photoBody({ plate: 'ABC 1234', notice: ['Photo does not match', 'PHOTO_MISMATCH: plate on the photo differs from the record.'] }), footer: (x) => btn(x, 'Enroll', { state: 'Disabled' }) },
    Submitting: { body: photoBody(), footer: (x) => btn(x, 'Registering on-chain', { state: 'Loading', to: 'Enroll/Result/Success' }) },
  });

  def('Enroll', 'Result', detail, {
    Success: {
      top: { title: 'Enrolled', chip: 'Active', tone: 'Mint' },
      body: (b) => {
        const c = card(b, { gap: 8 });
        kv(c, 'Driver', 'Ana V.');
        kv(c, 'Card', '…A1B2');
        kv(c, 'Hash prefix', 'e4b81d90');
        kv(c, 'Per-tap cap', 'PHP 500.00');
        kv(c, 'Expires', 'Nov 30, 2026 · 11:59 PM');
        const p = card(b, { gap: 8 });
        text(p, 'Photo check', 'label');
        chip(p, 'precomputed vision · matched', 'Mint');
        kv(p, 'Plate', 'NAV 5512');
        kv(p, 'TODA', 'San Roque TODA');
        listCard(b, 'On-chain', [
          { title: 'Device registered', meta: 'tx 4c1d…0a9f', chip: 'Succeeded', tone: 'Mint' },
          { title: 'Policy registered', meta: 'tx b82e…77c3', chip: 'Succeeded', tone: 'Mint' },
        ]);
        demoRate(b);
      },
      footer: (x) => btn(x, 'Enroll next driver', { to: 'Enroll/Pick/Default' }),
      nav: true,
    },
    'Chain failed': {
      body: (b) => {
        notice(b, 'Error', 'Enrollment did not finish', 'CHAIN_ERROR: the policy was not registered. Retrying with the same card resumes where it stopped.');
        const c = card(b, { gap: 8 });
        kv(c, 'Driver', 'Ana V.');
        kv(c, 'Card', '…A1B2');
        chip(c, 'Failed', 'Danger');
      },
      footer: (x) => btn(x, 'Retry enrollment', { to: 'Enroll/Result/Success' }),
    },
    'Already enrolled': {
      body: (b) => {
        notice(b, 'Error', 'This card is already enrolled', 'CARD_ALREADY_ENROLLED: use a different card for this driver.');
      },
      footer: (x) => btn(x, 'Read another card', { to: 'Enroll/Read card/Ready' }),
    },
  });
}

function buildStation() {
  const switcher = (b, s) => {
    const r = row(b, { gap: 8, name: 'Station switch' });
    [['A', 'Station A'], ['B', 'Station B']].forEach((x) => {
      const on = x[0] === s;
      const i = place(CMP['Filter chip'][on ? 'Selected' : 'Default'].createInstance(), r, { name: 'Switch/' + x[1], flex: true, to: on ? undefined : (x[0] === 'B' ? 'Station/Terminal/Frozen' : 'Station/Terminal/Default') });
      setT(i, { Label: x[1] });
    });
  };
  const amount = (b, value) => {
    const i = place(CMP['Amount field'][value ? 'Filled' : 'Empty'].createInstance(), b, { name: 'Amount' });
    if (value) setT(i, { Value: value });
  };
  const selected = (b, title, meta, tone, chipLabel) => {
    const c = card(b, { dir: 'H', align: 'CENTER', gap: 12, name: 'Selected card' });
    const col = box(c, { name: 'Text', flex: true, gap: 4 });
    text(col, title, 'label');
    text(col, meta, 'caption');
    chip(c, chipLabel, tone);
  };
  const recent = (b, items) => listCard(b, 'Recent taps', items);
  const RECENT = [
    { title: '…9C7E PHP 350.00', chip: 'Paid', tone: 'Mint' },
    { title: '…9C7E PHP 800.00', chip: 'Over cap', tone: 'Danger' },
    { title: '…77B0 PHP 200.00', chip: 'Expired', tone: 'Danger' },
  ];
  const term = (o) => (b) => {
    switcher(b, o.station || 'A');
    if (o.notice) notice(b, o.notice[0], o.notice[1], o.notice[2]);
    amount(b, o.amount);
    if (o.card) selected(b, o.card[0], o.card[1], o.card[2], o.card[3]);
    if (o.recent !== false) recent(b, RECENT);
    demoRate(b);
  };
  const READ = ['Card …9C7E', 'Stays selected until you read another or clear', 'Accent', 'Card read'];
  const chargeWith = (to, state) => (x) => {
    btn(x, state === 'Loading' ? 'Charging' : 'Charge', { state, to });
    const r = row(x, { gap: 8, name: 'Card actions' });
    btn(r, 'Read card', { style: 'Secondary', flex: true, to: 'Station/Terminal/Waiting for card' });
    btn(r, 'Clear', { style: 'Secondary', flex: true, to: 'Station/Terminal/Ready' });
  };
  const rootTop = (s) => ({ top: { root: true, chip: 'Station ' + s } });
  def('Station', 'Terminal', rootTop('A'), {
    Default: { body: term({ amount: 'PHP 350.00', card: READ }), footer: chargeWith('Station/Terminal/Charging') },
    Ready: { body: term({ recent: false }), footer: (x) => { btn(x, 'Charge', { state: 'Disabled' }); btn(x, 'Enable NFC', { style: 'Secondary', to: 'Station/Terminal/Waiting for card' }); btn(x, 'Simulate tap', { style: 'Tertiary', to: 'Station/Simulate/Default' }); }, nav: true },
    'Waiting for card': { body: term({ amount: 'PHP 350.00', card: ['Hold the card to the phone', 'Listening for up to 15 seconds', 'Outline', 'Reading'] }), footer: (x) => { btn(x, 'Charge', { state: 'Disabled' }); btn(x, 'Reading', { style: 'Secondary', state: 'Loading', to: 'Station/Terminal/Default' }); } },
    Charging: { body: term({ amount: 'PHP 350.00', card: READ }), footer: chargeWith('Station/Receipt/Paid', 'Loading') },
    'Over cap amount': { body: term({ amount: 'PHP 800.00', card: READ }), footer: chargeWith('Station/Receipt/Over cap') },
    'Read error': {
      body: term({ amount: 'PHP 350.00', notice: ['Error', 'Could not read the card', 'NFC_READ_ERROR. Pick the card from the list instead.'], recent: false }),
      footer: (x) => { btn(x, 'Charge', { state: 'Disabled' }); btn(x, 'Simulate tap', { style: 'Secondary', to: 'Station/Simulate/Default' }); },
    },
    'Simulated card': {
      body: term({ amount: 'PHP 480.00', card: ['Pedro R. …3A54', 'Picked from the list, still a real on-chain payment', 'Outline', 'simulated'], station: 'B' }),
      top: { root: true, chip: 'Station B' },
      footer: chargeWith('Station/Receipt/Paid'),
    },
    Frozen: {
      top: { root: true, chip: 'Station B' },
      body: term({ station: 'B', amount: 'PHP 200.00', notice: ['Frozen', 'Station paused by the Freeze Agent', 'New taps are refused until the LGU unfreezes this station.'], recent: false }),
      footer: (x) => btn(x, 'Charge', { to: 'Station/Receipt/Station frozen' }),
    },
    'No taps yet': { body: (b) => { switcher(b, 'A'); amount(b); selected(b, 'Card …9C7E', 'Stays selected until you read another or clear', 'Accent', 'Card read'); emptyState(b, { icon: 'receipt', title: 'No taps yet', body: 'Charges at this station appear here.' }); }, footer: (x) => btn(x, 'Charge', { state: 'Disabled' }) },
    'No program': { empty: { icon: 'pump', title: 'No active program', body: 'This terminal can take payments once a program is running.', action: 'Create program', to: 'Home/Create program/Default' } },
    Loading: { loading: ['Row', 'Card', 'Row', 'Row', 'Row'] },
  });

  const simList = (s) => {
    listCard(s, null, [
      { title: 'Juan D. …9C7E', meta: '3f9c1a0b', to: 'Station/Terminal/Simulated card' },
      { title: 'Pedro R. …3A54', meta: 'a71d4c22', to: 'Station/Terminal/Simulated card' },
      { title: 'Ramon B. …77B0', meta: '5c02e8f6', chip: 'Expired', to: 'Station/Terminal/Simulated card' },
      { title: 'Lito G. …AL05', meta: '0d6a93c1 · virtual', to: 'Station/Terminal/Simulated card' },
    ]);
    text(s, 'Only the way the card is identified is simulated. The payment is still a real authorize on-chain.', 'caption');
  };
  def('Station', 'Simulate', rootTop('A'), {
    Default: { body: term({ amount: 'PHP 350.00', recent: false }), sheet: ['Simulate tap', simList] },
    'No active cards': { body: term({ amount: 'PHP 350.00', recent: false }), sheet: ['Simulate tap', (s) => emptyState(s, { icon: 'idcard', title: 'No active cards', body: 'Enroll a driver to tap at this station.' })] },
  });

  const paid = (o) => (b) => {
    const r = place(CMP.Receipt.Paid.createInstance(), b, { name: 'Receipt' });
    setT(r, { Station: o.station || 'Station A', Amount: o.amount || 'PHP 350.00' });
    setT(find(r, 'Card'), { Key: 'Card', Value: 'Juan D. …9C7E' });
    setT(find(r, 'Balance'), { Key: 'Balance', Value: 'PHP 1,150.00' });
    setT(find(r, 'Tx'), { Key: 'Tx', Value: '7f3a…c21e' });
    place(CMP['Balance card'].createInstance(), b, { name: 'Balance card', h: 220 });
    demoRate(b);
  };
  const declined = (o) => (b) => {
    const r = place(CMP.Receipt.Declined.createInstance(), b, { name: 'Receipt' });
    setT(r, { Station: o.station || 'Station A', Amount: o.amount, Note: o.message });
    setT(find(r, 'Status'), { Label: o.chip || 'DECLINED' });
    setT(find(r, 'Card'), { Key: 'Card', Value: o.card || 'Juan D. …9C7E' });
    setT(find(r, 'Reason'), { Key: 'Reason', Value: o.reason });
    setT(find(r, 'Tx'), { Key: 'Tx', Value: 'None submitted' });
    demoRate(b);
  };
  const clearBtn = (x) => btn(x, 'Clear', { style: 'Secondary', to: 'Station/Terminal/Ready' });
  const detail = { top: { root: true, chip: 'Station A' }, solidFooter: true };
  const MSG3 = 'rejected by the Noir contract (simulation of `authorize` returned Error #3); no tx submitted.';
  def('Station', 'Receipt', detail, {
    Paid: { body: paid({}), footer: (x) => btn(x, 'Next charge', { to: 'Station/Terminal/Over cap amount' }) },
    'Over cap': { body: declined({ amount: 'PHP 800.00', reason: 'over the ₱500.00 per-tap cap', message: 'Declined: ₱800.00 is over the ₱500.00 per-tap cap — ' + MSG3 }), footer: clearBtn },
    Expired: { body: declined({ amount: 'PHP 200.00', card: 'Ramon B. …77B0', reason: 'card expired', message: 'Declined: ₱200.00, card expired — ' + MSG3 }), footer: clearBtn },
    'Policy denied': { body: declined({ amount: 'PHP 200.00', reason: 'not permitted by the card policy', message: 'Declined: ₱200.00, not permitted by the card policy — ' + MSG3 }), footer: clearBtn },
    'No credit': { body: declined({ amount: 'PHP 200.00', card: 'Ana V. …A1B2', reason: 'no fuel credit left on the card', message: 'Declined: ₱200.00, no fuel credit left on the card — rejected by the Noir contract (simulation of `authorize` returned Error #2); no tx submitted.' }), footer: clearBtn },
    'Station frozen': { top: { root: true, chip: 'Station B' }, body: declined({ station: 'Station B', chip: 'REFUSED', amount: 'PHP 200.00', card: 'Not read', reason: 'station paused by the Freeze Agent', message: 'Refused before signing. No chain call was made.' }), footer: clearBtn },
    'Not enrolled': { body: declined({ chip: 'REFUSED', amount: 'PHP 200.00', card: '…D41F', reason: 'card not enrolled', message: 'Refused before signing. This card is not in the program.' }), footer: clearBtn },
    Failed: {
      body: (b) => {
        notice(b, 'Error', 'The payment did not go through', 'CHAIN_ERROR: CONTRACT_DuplicateAuth. No decision was made on this tap.');
        const c = card(b, { gap: 8 });
        kv(c, 'Card', 'Juan D. …9C7E');
        kv(c, 'Amount', 'PHP 350.00');
        demoRate(b);
      },
      footer: clearBtn,
    },
  });
}

function buildAgents() {
  const root = { top: { root: true } };
  const detail = (title) => ({ top: { title } });
  const stations = (b, frozen) => {
    stationRow(b, frozen ? { name: 'Petron San Roque', spent: 'PHP 350.00', pending: 'PHP 0.00', held: 'PHP 0.00' } : { name: 'Petron San Roque', spent: 'PHP 0.00', pending: 'PHP 0.00', held: 'PHP 0.00' });
    stationRow(b, frozen ? STATION_B() : { name: 'Rotonda Fuels', spent: 'PHP 0.00', pending: 'PHP 0.00', held: 'PHP 0.00' });
  };
  const actions = (b, o) => {
    o = o || {};
    const dis = (k) => (o.off || []).indexOf(k) >= 0;
    btn(b, 'Start price feed', { state: dis('feed') ? 'Disabled' : 'Default', to: 'Agents/Tranche/Idle' });
    btn(b, 'Run burst', { style: 'Secondary', state: dis('burst') ? 'Disabled' : 'Default', to: 'Agents/Freeze/Idle' });
    btn(b, 'Run settlement', { style: 'Secondary', state: dis('settle') ? 'Disabled' : 'Default', to: 'Agents/Settlement/Result' });
    btn(b, 'Unfreeze Station B', { style: 'Secondary', state: dis('unfreeze') ? 'Disabled' : 'Default', to: 'Home/Unfreeze/Confirm' });
    btn(b, 'End program', { style: 'Secondary', state: dis('end') ? 'Disabled' : 'Default', to: 'Agents/End program/Confirm' });
  };
  const home = (o) => (b) => {
    o = o || {};
    if (o.notice) notice(b, 'Error', o.notice[0], o.notice[1]);
    actions(b, o);
    sectionTitle(b, 'Stations');
    stations(b, o.frozen);
    demoRate(b);
  };
  def('Agents', 'Home', root, {
    Default: home({ off: ['unfreeze'] }),
    'After freeze': { body: home({ frozen: true, off: ['feed', 'burst'] }), nav: true },
    'No verified budget': { body: home({ notice: ['No verified budget', 'INVALID_STATE: no verified budget'], off: ['unfreeze'] }), nav: true },
    'Tranche already fired': { body: home({ notice: ['Tranche already fired', 'INVALID_STATE: tranche already fired'], off: ['feed', 'unfreeze'] }), nav: true },
    Ended: { body: home({ frozen: true, off: ['feed', 'burst', 'settle', 'unfreeze', 'end'] }), nav: true },
    'No program': { empty: { icon: 'pulse', title: 'No active program', body: 'Agents start working once a program is running.', action: 'Create program', to: 'Home/Create program/Default' } },
    Loading: { loading: ['Row', 'Row', 'Row', 'Row', 'Card', 'Card'] },
    Error: { error: ['Could not load agents', 'Something went wrong on our side. Try again in a moment.', 'Agents/Home/Default'] },
  });

  const decision = (b) => {
    const c = card(b, { gap: 8 });
    text(c, 'Tranche decision', 'label');
    kv(c, 'Price', 'PHP 70.85');
    kv(c, 'Segment mean', 'PHP 70.90');
    kv(c, 'Threshold', 'PHP 65.00');
    kv(c, 'Changepoint probability', '0.94');
    kv(c, 'Run length', '5');
    kv(c, 'Budget before', 'PHP 10,000.00');
    kv(c, 'Budget after', 'PHP 5,500.00');
  };
  const funds = (b) => listCard(b, 'Funding', [
    { title: 'Juan D. …9C7E', meta: 'tx a1c9…3e70', value: 'PHP 1,500.00' },
    { title: 'Pedro R. …3A54', meta: 'tx 6d42…b018', value: 'PHP 1,500.00' },
    { title: 'Ramon B. …77B0', meta: 'Skipped, EXPIRED', chip: 'Skipped' },
    { title: 'Lito G. …AL05', meta: 'tx 0ef7…94a2', value: 'PHP 1,500.00' },
  ]);
  def('Agents', 'Tranche', detail('Tranche Agent'), {
    Idle: {
      body: (b) => {
        priceChart(b, 1);
        notice(b, 'Info', 'Watching the price', 'Funds only when a shift is sustained, above the threshold, and inside verified budget.');
      },
      footer: (x) => btn(x, 'Start price feed', { to: 'Agents/Tranche/Spike ignored' }),
    },
    'Spike ignored': {
      body: (b) => {
        priceChart(b, 18);
        notice(b, 'Info', 'One-day spike ignored', 'Point 15 reached PHP 66.00 and fell back. One day is not a shift, so nothing was funded.');
      },
      footer: (x) => btn(x, 'Feed running', { state: 'Loading', to: 'Agents/Tranche/Funded' }),
    },
    Funded: { body: (b) => { priceChart(b, 45, true); decision(b); funds(b); demoRate(b); }, footer: (x) => btn(x, 'Back to agents', { style: 'Secondary', to: 'Agents/Home/Default' }) },
    'Budget exhausted': {
      body: (b) => {
        priceChart(b, 45, true);
        notice(b, 'Info', 'Budget ran out', 'BUDGET_EXHAUSTED: PHP 500.00 left is below one PHP 1,500.00 tranche, so funding stopped.');
        funds(b);
      },
    },
    Refused: { body: (b) => { priceChart(b, 1); notice(b, 'Error', 'Feed did not start', 'INVALID_STATE: no verified budget'); }, footer: (x) => btn(x, 'Fund the budget', { to: 'Home/Budget/None' }) },
    Loading: { loading: ['Card', 'Row', 'Row'] },
  });

  def('Agents', 'Freeze', detail('Freeze Agent'), {
    Idle: {
      body: (b) => {
        edgeChart(b, 4);
        stations(b, false);
      },
      footer: (x) => btn(x, 'Run burst', { to: 'Agents/Freeze/Running' }),
    },
    'Needs a tap first': { body: (b) => { notice(b, 'Error', 'Burst did not start', 'Tap D2 at Station B first'); edgeChart(b, 4); }, footer: (x) => btn(x, 'Go to Station B', { to: 'Station/Terminal/Simulated card' }) },
    Running: { body: (b) => { edgeChart(b, 9); stations(b, false); }, footer: (x) => btn(x, 'Burst running', { state: 'Loading', to: 'Agents/Freeze/Frozen' }) },
    Frozen: {
      body: (b) => {
        notice(b, 'Frozen', 'Rotonda Fuels frozen', 'MIDAS 2.31 >= 1.78 (NEAR_CAP_STREAK)');
        edgeChart(b, 12, true);
        stationRow(b, STATION_B());
      },
      footer: (x) => btn(x, 'Run settlement', { to: 'Agents/Settlement/Result' }),
    },
  });

  def('Agents', 'Settlement', detail('Settlement'), {
    Result: {
      body: (b) => {
        listCard(b, 'Last run', [
          { title: 'A — claimed PHP 350.00', meta: 'tx 2be4…f61a', chip: 'Claimed', tone: 'Mint' },
          { title: 'B — HELD PHP 960.00', meta: 'Station frozen, no tx', chip: 'Held', tone: 'Ink' },
        ]);
        notice(b, 'Info', 'Held money stays in escrow', 'It is released only when the LGU unfreezes Station B and settlement runs again.');
        demoRate(b);
      },
      footer: (x) => btn(x, 'Back to agents', { style: 'Secondary', to: 'Agents/Home/After freeze' }),
    },
    'Nothing pending': { body: (b) => listCard(b, 'Last run', [
      { title: 'A — nothing pending', meta: 'No claim needed', chip: 'None' },
      { title: 'B — nothing pending', meta: 'No claim needed', chip: 'None' },
    ]) },
    'Claim failed': {
      body: (b) => {
        notice(b, 'Error', 'A claim did not go through', 'CHAIN_ERROR at Station A. The other station still ran.');
        listCard(b, 'Last run', [
          { title: 'A — claim failed', meta: 'PHP 350.00 stays pending', chip: 'Failed', tone: 'Danger' },
          { title: 'B — HELD PHP 960.00', meta: 'Station frozen, no tx', chip: 'Held', tone: 'Ink' },
        ]);
      },
      footer: (x) => btn(x, 'Run settlement', { to: 'Agents/Settlement/Result' }),
    },
    Running: { loading: ['Row', 'Row'], footer: (x) => btn(x, 'Settling', { state: 'Loading', to: 'Agents/Settlement/Result' }) },
  });

  const SWEEP = [
    { title: 'Juan D. …9C7E', meta: 'Revoked, tx 8a01…cc42', value: 'PHP 1,150.00' },
    { title: 'Pedro R. …3A54', meta: 'Revoked, tx 3fd9…10be', value: 'PHP 540.00' },
    { title: 'Ramon B. …77B0', meta: 'Empty escrow, no sweep', value: 'PHP 0.00' },
    { title: 'Ana V. …A1B2', meta: 'Empty escrow, no sweep', value: 'PHP 0.00' },
    { title: 'Lito G. …AL05', meta: 'Revoked, tx e770…5b2d', value: 'PHP 1,500.00' },
  ];
  def('Agents', 'End program', detail('End program'), {
    Confirm: {
      top: { root: true },
      body: home({ frozen: true }),
      confirm: { title: 'End this program?', body: 'Every active card is revoked, and the PHP 3,190.00 unspent returns to the LGU wallet. This cannot be undone.', primary: ['End program', 'Agents/End program/Sweeping'], secondary: ['Keep running', 'BACK'] },
    },
    Sweeping: {
      body: (b) => {
        chip(b, 'Ending', 'Outline');
        listCard(b, 'Returning credit', [
          { title: 'Juan D. …9C7E', meta: 'Swept, tx 8a01…cc42', value: 'PHP 1,150.00' },
          { title: 'Pedro R. …3A54', meta: 'Sweeping…', chip: 'Pending' },
          { title: 'Ramon B. …77B0', meta: 'Waiting', chip: 'Pending' },
        ]);
      },
      footer: (x) => btn(x, 'Sweeping cards', { state: 'Loading', to: 'Agents/End program/Ended' }),
    },
    Ended: {
      body: (b) => {
        stat(b, 'Forest', 'Returned to the LGU wallet', 'PHP 3,190', { flex: false });
        listCard(b, 'Per card', SWEEP);
        demoRate(b);
      },
      footer: (x) => btn(x, 'View final totals', { to: 'Home/Dashboard/Ended' }),
    },
    'Partial failure': {
      body: (b) => {
        notice(b, 'Error', 'One sweep did not go through', 'The program still ended. This card stays unchanged, and re-running skips cards already swept.');
        listCard(b, 'Per card', [
          { title: 'Juan D. …9C7E', meta: 'Swept, tx 8a01…cc42', value: 'PHP 1,150.00' },
          { title: 'Pedro R. …3A54', meta: 'CHAIN_ERROR', chip: 'Failed', tone: 'Danger' },
        ]);
      },
      footer: (x) => btn(x, 'Run again', { style: 'Secondary', to: 'Agents/End program/Ended' }),
    },
    'Not started': { body: (b) => notice(b, 'Error', 'Program has not started', 'INVALID_STATE: a draft program cannot be ended.') },
  });
}

// ---------- cover, foundations, flows ----------

function buildCover(page, y) {
  const f = figma.createFrame();
  f.name = 'Cover';
  page.appendChild(f);
  f.setPluginData('tapat', '1');
  f.x = 0; f.y = y;
  f.resize(1600, 960);
  f.layoutMode = 'VERTICAL';
  f.primaryAxisSizingMode = 'FIXED';
  f.counterAxisSizingMode = 'FIXED';
  f.fills = [paint('primary')];
  bindNum(f, 'itemSpacing', 40);
  f.paddingLeft = 120; f.paddingRight = 120; f.paddingTop = 120; f.paddingBottom = 120;
  const plate = box(f, { name: 'Logo plate', hug: true, fill: 'surface', r: RADIUS.lg, p: 32 });
  plate.appendChild(CMP['Logo/Large'].createInstance());
  text(f, 'TAPat Mobile App', 'display', { c: 'surface' });
  text(f, 'Fund. Refuse. Return.', 'h1', { c: 'surface' });
  text(f, 'The ledger an LGU officer can defend: every money movement has a number and a tx hash.', 'body', { c: 'surface' });
  text(f, 'Generated from docs/api-and-data.md and the Clean Fintech kit. ' + report.screens + ' screen states. Testnet, demo rate.', 'mono', { c: 'surface' });
  return f.height;
}

function buildFoundations(page, y) {
  const f = figma.createFrame();
  f.name = 'Foundations';
  page.appendChild(f);
  f.setPluginData('tapat', '1');
  f.x = 0; f.y = y;
  f.layoutMode = 'VERTICAL';
  f.resize(1600, 200);
  f.counterAxisSizingMode = 'FIXED';
  f.primaryAxisSizingMode = 'AUTO';
  f.fills = [paint('surface')];
  bindNum(f, 'itemSpacing', 40);
  f.paddingLeft = 80; f.paddingRight = 80; f.paddingTop = 80; f.paddingBottom = 80;

  text(f, 'Color', 'h1');
  const SW = [
    ['surface', 'Cream', 'Background, 65%. From the kit.'], ['primary', 'Forest', 'Primary, 20%. From the kit.'], ['text', 'Ink', 'Text, 10%. From the kit.'],
    ['accent', 'Mustard', 'Accent, 5%. One per screen. From the kit.'], ['declined', 'Terracotta', 'Under 1%. Declined taps only. From the kit.'],
    ['raised', 'Raised', 'Cards and inputs. Sampled from the kit.'], ['sunken', 'Sunken', 'Skeletons, disabled, dividers. Sampled from the kit.'], ['mint', 'Mint', 'Positive chips, active tab. Sampled from the kit.'],
    ['pressed', 'Forest pressed', 'Pressed primary. Sampled from the kit.'], ['primary-deep', 'Forest deep', 'Forest card base; its arc is Forest. Sampled from the kit.'], ['ring-surface', 'Ring on cream', 'Rings on the cream card. Sampled from the kit.'], ['ring-accent', 'Ring on mustard', 'Rings on the mustard card. Sampled from the kit.'], ['muted', 'Muted', 'Inactive tab icons and labels. Added on request, not in the kit.'], ['frozen', 'Ice blue', 'Frozen stations. Added on request, not in the kit.'], ['danger', 'Red', 'Failed and declined. Added on request, not in the kit.'], ['declined-tint', 'Terracotta tint', 'Error input and declined notice. Sampled from the kit.'], ['accent-tint', 'Mustard tint', 'Arc on the mustard card. Sampled from the kit.'],
  ];
  const grid = box(f, { dir: 'H', name: 'Swatches', gap: 16 });
  grid.layoutWrap = 'WRAP';
  grid.counterAxisSpacing = 16;
  SW.forEach((s) => {
    const c = box(grid, { name: TOKEN_NAMES[s[0]], w: 248, fill: 'raised', stroke: 'text', r: RADIUS.md, gap: 8, p: 12 });
    const sw = box(c, { name: 'Sample', h: 88, fill: s[0], stroke: 'text', r: RADIUS.sm });
    sw.name = 'Sample';
    text(c, s[1] + '  #' + COLORS[s[0]], 'label');
    text(c, TOKEN_NAMES[s[0]], 'mono');
    text(c, s[2], 'caption');
  });

  text(f, 'Contrast checked for text', 'h1');
  const ct = card(f, { gap: 8 });
  [['Ink on Cream', '13.13:1'], ['Forest on Cream', '5.47:1'], ['Cream on Forest', '5.47:1'], ['Ink on Mustard', '8.15:1'], ['Forest on Sunken', '4.88:1'], ['Forest on Mint', '4.66:1'], ['Muted on Raised', '5.37:1'], ['Ink on Ice blue', '10.82:1'], ['Cream on Red', '4.99:1'], ['Cream on Forest deep', '6.21:1'], ['Terracotta on Cream (border and icon only, never text)', '4.02:1']].forEach((r) => {
    kv(ct, r[0], r[1]);
  });

  text(f, 'Typography', 'h1');
  const tp = box(f, { name: 'Type ramp', gap: 16 });
  Object.keys(TYPE).forEach((k) => {
    const t = TYPE[k];
    text(tp, t[4] + '  ' + t[0] + ' ' + t[1] + ' ' + t[2] + '/' + t[3], 'mono');
    text(tp, k.indexOf('amount') === 0 || k === 'mono' ? 'PHP 3,190.00' : 'Fund. Refuse. Return.', k);
  });

  text(f, 'Spacing and radius', 'h1');
  const sp = box(f, { dir: 'H', name: 'Spacing', gap: 16, align: 'MAX' });
  SPACE.forEach((n) => {
    const c = box(sp, { name: 'space/' + n, gap: 8, hug: true });
    box(c, { name: 'Block', w: n, h: n, fill: 'primary' });
    text(c, 'space/' + n, 'mono', { hug: true });
  });
  const rd = box(f, { dir: 'H', name: 'Radius', gap: 16 });
  Object.keys(RADIUS).forEach((k) => {
    const c = box(rd, { name: 'radius/' + k, w: 96, h: 96, r: RADIUS[k], fill: 'raised', stroke: 'text', justify: 'CENTER', align: 'CENTER' });
    text(c, 'radius/' + k, 'mono', { hug: true });
  });

  text(f, 'Logo', 'h1');
  const lg = row(f, { gap: 32, align: 'CENTER' });
  lg.appendChild(CMP['Logo/Large'].createInstance());
  lg.appendChild(CMP['Logo/Small'].createInstance());
  text(lg, 'Clear space equals the height of the T. Never under 48px wide, stretched or tilted. Full colour on cream; one colour on forest or ink.', 'small', { flex: true });

  text(f, 'Additions beyond the kit', 'h1');
  text(f, 'The kit does not specify these, so they are minimal and consistent with it: smaller type sizes for 390px screens (heading-1, body-sm, label, amount-sm, mono); card-value sizes measured from kit cards, with a smaller one for two-up cards; spacing and radius values estimated from kit mockups; shadow/sheet on bottom sheets; shadow/button on solid green buttons; shadow/float on other floating buttons; tab bar, top bar, notice, toast, skeleton, empty state, bottom sheet, station row, invariant and stepper components.', 'small');
  return f.height;
}

const FLOWS = [
  ['1. Set up the program', 'Home/Dashboard/No program', ['Home/Dashboard/No program', 'Home/Create program/Default', 'Home/Dashboard/Before funding', 'Home/Budget/None', 'Home/Budget/Waiting', 'Home/Dashboard/Budget sent']],
  ['2. Clean the masterlist', 'Masterlist/Upload/Default', ['Masterlist/Upload/Default', 'Masterlist/Results/Default', 'Masterlist/Beneficiaries/Default', 'Masterlist/Beneficiary/Uncertain', 'Masterlist/Beneficiary/Telegram link', 'Masterlist/Beneficiary/Evidence requested']],
  ['3. Enroll a driver', 'Enroll/Pick/Default', ['Enroll/Pick/Default', 'Enroll/Read card/Ready', 'Enroll/Read card/Waiting', 'Enroll/Read card/Read', 'Enroll/Photo/Sample', 'Enroll/Result/Success']],
  ['4. Tranche Agent funds', 'Agents/Tranche/Idle', ['Agents/Home/Default', 'Agents/Tranche/Idle', 'Agents/Tranche/Spike ignored', 'Agents/Tranche/Funded']],
  ['5. Tap to pay', 'Station/Terminal/Default', ['Station/Terminal/Default', 'Station/Terminal/Charging', 'Station/Receipt/Paid', 'Station/Terminal/Over cap amount', 'Station/Receipt/Over cap', 'Station/Terminal/Ready']],
  ['6. Freeze and settle', 'Agents/Freeze/Idle', ['Agents/Freeze/Idle', 'Agents/Freeze/Running', 'Agents/Freeze/Frozen', 'Agents/Settlement/Result', 'Agents/Home/After freeze', 'Home/Unfreeze/Confirm']],
  ['7. End the program', 'Agents/End program/Confirm', ['Agents/End program/Confirm', 'Agents/End program/Sweeping', 'Agents/End program/Ended', 'Home/Dashboard/Ended', 'Home/Export/Default']],
];

function buildFlows(page, y) {
  const f = figma.createFrame();
  f.name = 'Flows';
  page.appendChild(f);
  f.setPluginData('tapat', '1');
  f.x = 0; f.y = y;
  f.layoutMode = 'VERTICAL';
  f.resize(1760, 200);
  f.counterAxisSizingMode = 'FIXED';
  f.primaryAxisSizingMode = 'AUTO';
  f.fills = [paint('surface')];
  bindNum(f, 'itemSpacing', 32);
  f.paddingLeft = 80; f.paddingRight = 80; f.paddingTop = 80; f.paddingBottom = 80;
  text(f, 'Flows', 'display');
  text(f, 'Figma only links prototypes on one page, so the clickable flows live on the Screens page. Open it and press Present on a flow in the right panel. Each step below links to its screen.', 'body');
  FLOWS.forEach((flow) => {
    text(f, flow[0], 'h2');
    const r = row(f, { gap: 8, align: 'CENTER', name: 'Flow/' + flow[0] });
    flow[2].forEach((step, i) => {
      if (i) icon(r, 'chevron');
      const c = card(r, { name: 'Step', w: 232, gap: 4, p: 12 });
      const parts = step.split('/');
      const t = text(c, parts[1], 'label');
      const s = text(c, parts[2], 'caption');
      if (FRAMES[step]) {
        t.hyperlink = { type: 'NODE', value: FRAMES[step].id };
        s.hyperlink = { type: 'NODE', value: FRAMES[step].id };
      } else {
        report.linkErrors.push('Flow step missing: ' + step);
      }
    });
  });
  text(f, 'Telegram messages the driver receives', 'h2');
  text(f, 'The driver has no app screen. These exact texts are sent by the bot (docs/system-design.md §7).', 'small');
  const tg = box(f, { name: 'Telegram', gap: 8 });
  [
    'TAPat ⛽ Paid ₱350.00 at Petron San Roque\nBalance: ₱1,150.00\nTx: https://stellar.expert/explorer/testnet/tx/7f3a…c21e',
    'TAPat ⛽ Declined ₱800.00 at Petron San Roque: over the ₱500.00 per-tap cap',
    'Hi Maria! Para matapos ang verification mo sa TAPat fuel aid, i-send ang litrato ng OR/CR mo bilang FILE dito.',
    'Verified ✅ Pwede ka nang mag-enroll sa TODA.',
    'Natanggap namin. Ire-review ng LGU officer.',
  ].forEach((m) => { const c = card(tg, { name: 'Telegram message', p: 12 }); text(c, m, 'mono', { name: 'Message' }); });
  return f.height;
}

// ---------- pages ----------

async function setupPages(selection) {
  const names = ['Screens', 'Components', 'Foundations', 'Cover', 'Flows/Prototype']; // creation priority, in case a plan caps pages
  const pages = figma.root.children;
  for (const p of pages) await p.loadAsync();
  const map = {};
  names.forEach((n) => { const p = figma.root.children.find((x) => x.name === n); if (p) map[n] = p; });
  let limited = false;
  for (const n of names) {
    if (map[n]) continue;
    const blank = figma.root.children.find((x) => names.indexOf(x.name) < 0 && x.children.every((c) => selection.some((n) => n.id === c.id)));
    if (blank) { blank.name = n; map[n] = blank; continue; }
    try {
      const p = figma.createPage();
      p.name = n;
      map[n] = p;
    } catch (e) {
      limited = true;
    }
  }
  if (limited) warn('This Figma plan limits pages, so some sections share a page. Look for them lower down on the same page.');
  map.Components = map.Components || map.Screens;
  map.Foundations = map.Foundations || map.Components;
  map.Cover = map.Cover || map.Foundations;
  map['Flows/Prototype'] = map['Flows/Prototype'] || map.Foundations;
  ['Cover', 'Foundations', 'Components', 'Screens', 'Flows/Prototype'].forEach((n, i) => {
    const p = map[n];
    if (p.name === n && figma.root.children.findIndex((x) => x.id === p.id) !== i) figma.root.insertChild(Math.min(i, figma.root.children.length - 1), p);
  });
  return map;
}

function clearTagged(page) {
  page.children.slice().forEach((n) => { if (n.getPluginData('tapat') === '1') n.remove(); });
}

function bottomOf(page) {
  return page.children.reduce((m, n) => (n.getPluginData('tapat') === '1' ? Math.max(m, n.y + n.height + 160) : m), 0);
}

/** The logo is the pasted selection on the first run, then the saved source node on later runs. */
function resolveLogo(map, selection) {
  for (const key of Object.keys(map)) {
    const found = map[key].children.find((n) => n.getPluginData('tapat-logo') === '1');
    if (found) { logoSource = found; return; }
  }
  if (selection.length) {
    logoSource = selection[0];
    logoSource.name = 'Logo source (keep this, the plugin reuses it)';
    logoSource.setPluginData('tapat-logo', '1');
    map.Foundations.appendChild(logoSource);
    logoSource.x = -900;
    logoSource.y = 0;
    return;
  }
  warn('No logo selected, so a text placeholder stands in. Paste the kit logo, select it, and run again.');
}

async function linkAll(map) {
  await figma.setCurrentPageAsync(map.Screens);
  const transition = { type: 'DISSOLVE', easing: { type: 'EASE_OUT' }, duration: 0.2 };
  for (let i = 0; i < LINKS.length; i++) {
    const node = LINKS[i][0], to = LINKS[i][1];
    let action;
    if (to === 'BACK') action = { type: 'BACK' };
    else if (FRAMES[to]) action = { type: 'NODE', destinationId: FRAMES[to].id, navigation: 'NAVIGATE', transition, preserveScrollPosition: false };
    else { report.linkErrors.push('No screen named ' + to); continue; }
    try {
      await node.setReactionsAsync([{ trigger: { type: 'ON_CLICK' }, actions: [action] }]);
      report.links += 1;
    } catch (e) {
      report.linkErrors.push(node.name + ': ' + e.message);
    }
    if (i % 100 === 0) await tick();
  }
  const starts = FLOWS.filter((fl) => FRAMES[fl[1]]).map((fl) => ({ nodeId: FRAMES[fl[1]].id, name: fl[0] }));
  try {
    map.Screens.flowStartingPoints = starts;
  } catch (e) {
    report.linkErrors.push('Could not set flow starting points: ' + e.message);
  }
}

async function run() {
  const selection = figma.currentPage.selection.slice();
  log('Setting up pages…');
  const map = await setupPages(selection);
  await setupTokens();
  await setupType();
  Object.keys(map).forEach((k) => clearTagged(map[k]));
  resolveLogo(map, selection);

  log('Building components…');
  await figma.setCurrentPageAsync(map.Components);
  buildComponents(map.Components);
  await flushStyles();
  layoutComponentsPage(map.Components);
  await flushStyles();
  await tick();

  await figma.setCurrentPageAsync(map.Screens);
  const groups = [['Home', buildHome], ['Masterlist', buildMasterlist], ['Enroll', buildEnroll], ['Station', buildStation], ['Agents', buildAgents]];
  for (const g of groups) {
    log('Building ' + g[0] + ' screens…');
    g[1]();
    await flushStyles();
    await tick();
  }
  closeSection();

  log('Building foundations, cover and flows…');
  await figma.setCurrentPageAsync(map.Foundations);
  buildFoundations(map.Foundations, bottomOf(map.Foundations));
  if (map.Cover !== map.Foundations) await figma.setCurrentPageAsync(map.Cover);
  buildCover(map.Cover, bottomOf(map.Cover));
  await flushStyles();
  await figma.setCurrentPageAsync(map['Flows/Prototype']);
  buildFlows(map['Flows/Prototype'], bottomOf(map['Flows/Prototype']));
  await flushStyles();

  log('Linking the prototype…');
  await linkAll(map);
  if (map.Cover) await figma.setCurrentPageAsync(map.Cover);
  figma.ui.postMessage({ type: 'done', report });
}

figma.showUI(__html__, { width: 420, height: 520, title: 'TAPat UI Builder' });
const postSelection = () => {
  const s = figma.currentPage.selection;
  figma.ui.postMessage({ type: 'selection', name: s.length ? s[0].name : null });
};
figma.on('selectionchange', postSelection);
postSelection();
figma.ui.onmessage = (m) => {
  if (m.type === 'close') figma.closePlugin();
  if (m.type === 'build') {
    run().catch((e) => figma.ui.postMessage({ type: 'error', message: e.message, stack: String(e.stack || '') }));
  }
};

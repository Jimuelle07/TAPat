'use strict';
// Runs code.js against a strict stand-in for the Figma Plugin API, then checks the result.
// shortcut: the stub enforces only the API rules this plugin depends on, so real Figma can still differ; run the plugin to confirm.
// Usage: node smoke-test.js [preview.html]   (the optional file is a rough browser preview of every screen)
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let nextId = 1;
const loadedFonts = new Set();
const allNodes = new Map();

class StubNode {
  constructor(type) {
    this.type = type;
    this.id = '1:' + nextId++;
    this.name = type;
    this.children = [];
    this.parent = null;
    this.visible = true;
    this.width = 100;
    this.height = 100;
    this.x = 0;
    this.y = 0;
    this.fills = [];
    this.strokes = [];
    this.effects = [];
    this.layoutMode = 'NONE';
    this.primaryAxisSizingMode = 'AUTO';
    this.counterAxisSizingMode = 'AUTO';
    this._hz = 'FIXED';
    this._vt = 'FIXED';
    this.data = {};
    this.layoutPositioning = 'AUTO';
    this.inInstance = false;
    this.reactionList = [];
    allNodes.set(this.id, this);
  }
  appendChild(c) {
    if (this.inInstance || this.type === 'INSTANCE') throw new Error('Cannot add a child inside an instance: ' + this.name);
    if (c.type === 'COMPONENT' && ['COMPONENT', 'INSTANCE'].includes(this.type)) throw new Error('Cannot nest a component in a component');
    if (c.parent) c.parent.children.splice(c.parent.children.indexOf(c), 1);
    this.children.push(c);
    c.parent = this;
  }
  remove() {
    if (this.inInstance) throw new Error('Cannot remove a layer inside an instance');
    if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = null;
  }
  resize(w, h) {
    this.width = w;
    this.height = h;
    if (this.layoutMode !== 'NONE') { this.primaryAxisSizingMode = 'FIXED'; this.counterAxisSizingMode = 'FIXED'; }
    this._hz = 'FIXED';
    this._vt = 'FIXED';
  }
  insertChild(i, c) { this.appendChild(c); this.children.splice(this.children.indexOf(c), 1); this.children.splice(i, 0, c); }
  resizeWithoutConstraints(w, h) { this.width = w; this.height = h; }
  rescale(s) { this.width *= s; this.height *= s; }
  get layoutSizingHorizontal() { return this._hz; }
  set layoutSizingHorizontal(v) { this.setSizing('H', v); }
  get layoutSizingVertical() { return this._vt; }
  set layoutSizingVertical(v) { this.setSizing('V', v); }
  setSizing(axis, v) {
    const pm = this.parent ? this.parent.layoutMode : 'NONE';
    if (v === 'FILL' && (!pm || pm === 'NONE')) throw new Error('FILL needs an auto-layout parent: ' + this.name);
    if (v === 'FILL') {
      const parentHug = axis === 'H'
        ? (pm === 'VERTICAL' ? this.parent.counterAxisSizingMode : this.parent.primaryAxisSizingMode) === 'AUTO'
        : (pm === 'VERTICAL' ? this.parent.primaryAxisSizingMode : this.parent.counterAxisSizingMode) === 'AUTO';
      if (parentHug) throw new Error('FILL inside a HUG parent (' + this.parent.name + '): ' + this.name);
    }
    if (v === 'HUG' && this.layoutMode === 'NONE' && this.type !== 'TEXT' && this.type !== 'INSTANCE') throw new Error('HUG needs auto layout: ' + this.name);
    if (axis === 'H') this._hz = v; else this._vt = v;
    if (this.layoutMode !== 'NONE') {
      const mode = v === 'HUG' ? 'AUTO' : 'FIXED';
      const primary = (this.layoutMode === 'HORIZONTAL') === (axis === 'H');
      if (primary) this.primaryAxisSizingMode = mode; else this.counterAxisSizingMode = mode;
    }
  }
  setBoundVariable(key, v) { assert(v && v.name, 'binding needs a variable: ' + key); assert(key in this, 'unknown bound field ' + key); }
  setPluginData(k, v) { this.data[k] = v; }
  getPluginData(k) { return this.data[k] || ''; }
  get absoluteTransform() { return [[1, 0, this.x], [0, 1, this.y]]; }
  findAll(pred) {
    const out = [];
    const walk = (n) => n.children.forEach((c) => { if (!pred || pred(c)) out.push(c); walk(c); });
    walk(this);
    return out;
  }
  findOne(pred) { return this.findAll(pred)[0] || null; }
  async setReactionsAsync(list) {
    if (this.inInstance) throw new Error('Reaction on a layer inside an instance: ' + this.name);
    this.reactionList = list;
  }
  async setTextStyleIdAsync() {}
  async setEffectStyleIdAsync() {}
  set textStyleId(v) { throw new Error('dynamic-page: use setTextStyleIdAsync'); }
  set effectStyleId(v) { throw new Error('dynamic-page: use setEffectStyleIdAsync'); }
  get mainComponent() { throw new Error('dynamic-page: use getMainComponentAsync'); }
  clone() { return cloneTree(this, false); }
  createInstance() {
    assert.strictEqual(this.type, 'COMPONENT', 'createInstance on ' + this.type);
    const i = cloneTree(this, true);
    i.type = 'INSTANCE';
    i.inInstance = false;
    return i;
  }
  swapComponent(comp) {
    assert.strictEqual(this.type, 'INSTANCE');
    assert.strictEqual(comp.type, 'COMPONENT');
    const fresh = cloneTree(comp, true);
    this.children = fresh.children;
    this.children.forEach((c) => { c.parent = this; });
    this.fills = fresh.fills; this.strokes = fresh.strokes; this.strokeWeight = fresh.strokeWeight;
    this.width = fresh.width; this.height = fresh.height;
    this.layoutMode = fresh.layoutMode;
    this.svg = fresh.svg;
    ['paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom', 'itemSpacing', 'counterAxisAlignItems', 'primaryAxisAlignItems', 'topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius'].forEach((k) => { this[k] = fresh[k]; });
  }
}

class StubText extends StubNode {
  constructor() { super('TEXT'); this._chars = ''; this.textAutoResize = 'WIDTH_AND_HEIGHT'; }
  get fontName() { return this._font; }
  set fontName(f) { assert(loadedFonts.has(f.family + '/' + f.style), 'font not loaded: ' + f.family + ' ' + f.style); this._font = f; }
  get characters() { return this._chars; }
  set characters(v) { assert(this._font, 'set fontName before characters'); assert(typeof v === 'string'); this._chars = v; }
}

function cloneTree(n, asInstance) {
  const c = n.type === 'TEXT' ? new StubText() : new StubNode(n.type);
  const skip = new Set(['id', 'children', 'parent', 'data', 'reactionList']);
  Object.keys(n).forEach((k) => { if (!skip.has(k)) c[k] = n[k]; });
  c.data = {};
  c.reactionList = [];
  c.children = [];
  n.children.forEach((k) => {
    const kc = cloneTree(k, asInstance);
    kc.parent = c;
    c.children.push(kc);
    if (asInstance) kc.inInstance = true;
  });
  return c;
}

class StubPage extends StubNode {
  constructor(name) { super('PAGE'); this.name = name; this.loaded = false; this._kids = []; this.selection = []; }
  get children() { if (this.loaded === false) throw new Error('Page not loaded: call loadAsync'); return this._kids; }
  set children(v) { this._kids = v; }
  async loadAsync() { this.loaded = true; }
}

const collections = [], variables = [], textStyles = [], effectStyles = [];
const root = new StubNode('DOCUMENT');
const firstPage = new StubPage('Page 1');
root.children.push(firstPage);
firstPage.parent = root;
root.insertChild = (i, p) => { root.children.splice(root.children.indexOf(p), 1); root.children.splice(i, 0, p); };

let currentPage = firstPage;
const ui = { messages: [], postMessage(m) { this.messages.push(m); }, onmessage: null };
const add = (n) => { currentPage.children.push(n); n.parent = currentPage; return n; };

const figma = {
  root,
  ui,
  showUI() {},
  on() {},
  closePlugin() {},
  get currentPage() { return currentPage; },
  set currentPage(v) { throw new Error('dynamic-page: use setCurrentPageAsync'); },
  async setCurrentPageAsync(p) { await p.loadAsync(); currentPage = p; },
  createPage() { const p = new StubPage('New'); p.loaded = true; root.children.push(p); p.parent = root; return p; },
  createFrame() { const n = add(new StubNode('FRAME')); n.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }]; return n; },
  createComponent() { return add(new StubNode('COMPONENT')); },
  createRectangle() { return add(new StubNode('RECTANGLE')); },
  createEllipse() { return add(new StubNode('ELLIPSE')); },
  createLine() { return add(new StubNode('LINE')); },
  createVector() { return add(new StubNode('VECTOR')); },
  createText() { return add(new StubText()); },
  createSection() { return add(new StubNode('SECTION')); },
  createNodeFromSvg(svg) { const n = add(new StubNode('FRAME')); const v = new StubNode('VECTOR'); v.svgMarkup = svg; v.strokes = [{}]; n.appendChild(v); return n; },
  createTextStyle() { const s = { id: 'S:' + nextId++, name: '' }; textStyles.push(s); return s; },
  createEffectStyle() { const s = { id: 'E:' + nextId++, name: '' }; effectStyles.push(s); return s; },
  combineAsVariants(nodes, parent) {
    nodes.forEach((n) => { assert.strictEqual(n.type, 'COMPONENT'); assert(n.name.includes('='), 'variant name: ' + n.name); });
    const set = new StubNode('COMPONENT_SET');
    parent.appendChild(set);
    nodes.forEach((n) => set.appendChild(n));
    return set;
  },
  async listAvailableFontsAsync() {
    const styles = ['Regular', 'Medium', 'SemiBold'];
    return ['Outfit', 'Azeret Mono', 'Inter'].flatMap((family) => styles.map((style) => ({ fontName: { family, style } })));
  },
  async loadFontAsync(f) { loadedFonts.add(f.family + '/' + f.style); },
  async getLocalTextStylesAsync() { return textStyles; },
  async getLocalEffectStylesAsync() { return effectStyles; },
  variables: {
    async getLocalVariableCollectionsAsync() { return collections; },
    async getLocalVariablesAsync() { return variables; },
    createVariableCollection(name) { const c = { id: 'C:' + nextId++, name, modes: [{ modeId: 'm1' }] }; collections.push(c); return c; },
    createVariable(name, c, type) { const v = { id: 'V:' + nextId++, name, variableCollectionId: c.id, type, setValueForMode() {}, scopes: [] }; variables.push(v); return v; },
    setBoundVariableForPaint(p, key, v) { assert.strictEqual(key, 'color'); assert(!('a' in p.color), 'paint color has no alpha'); return Object.assign({}, p, { boundVariables: { color: { id: v.id } } }); },
  },
};

// ---------- checks ----------

const lum = (c) => {
  const f = (x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
};
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const sameColor = (c, hex) => Math.round(c.r * 255).toString(16).padStart(2, '0') + Math.round(c.g * 255).toString(16).padStart(2, '0') + Math.round(c.b * 255).toString(16).padStart(2, '0') === hex.toLowerCase();
const solid = (paints) => (paints || []).find((p) => p.type === 'SOLID' && p.opacity === undefined);

function walk(n, fn, bg) {
  if (n.visible === false) return;
  const own = n.type !== 'TEXT' && solid(n.fills);
  const here = own && n.type !== 'ELLIPSE' ? own.color : bg;
  fn(n, here);
  n.children.forEach((c) => walk(c, fn, here));
}

function check(frames) {
  const problems = [];
  frames.forEach((f) => {
    if (f.width !== 390 || f.height !== 844) problems.push(f.name + ': size ' + f.width + 'x' + f.height);
    if (f.name.split('/').length !== 3) problems.push(f.name + ': name is not Feature/Screen/State');
    let accents = 0;
    walk(f, (n, bg) => {
      const fill = solid(n.fills), stroke = solid(n.strokes);
      if ((fill && sameColor(fill.color, 'F7B93E')) || (stroke && stroke.color && sameColor(stroke.color, 'F7B93E'))) accents += 1;
      if (n.type === 'TEXT' && fill && bg) {
        const ratio = contrast(fill.color, bg);
        if (ratio < 4.5) problems.push(f.name + ': "' + n.characters.slice(0, 30) + '" contrast ' + ratio.toFixed(2));
      }
      if (n.name === 'Rule' && (n.effects.length > 0 || Math.min(n.width, n.height) !== 1.5 || !sameColor(fill.color, '1B2E28'))) problems.push(f.name + ': divider is not the flat 1.5px Ink line');
      if (n.type === 'TEXT' && /^(Failed|Declined|DECLINED)$/.test(n.characters) && !sameColor(bg, 'C0392B')) problems.push(f.name + ': ' + n.characters + ' is not full red');
      if (n.type === 'TEXT' && /^Frozen$/.test(n.characters) && !sameColor(bg, 'BFE6F7')) problems.push(f.name + ': Frozen is not ice blue');
      if (n.type === 'TEXT' && /lorem/i.test(n.characters)) problems.push(f.name + ': placeholder copy');
      if (stroke && stroke.color && sameColor(stroke.color, 'C8552F') && n.type !== 'TEXT') {
        const label = n.findOne((c) => c.type === 'TEXT');
        const ok = label && /declined|over cap|expired|refused/i.test(label.characters) || /Field/.test(n.name);
        if (!ok) problems.push(f.name + ': Terracotta on a non-declined element (' + n.name + ')');
      }
    });
    if (f.findOne((n) => n.name === 'Tab bar') && !f.findOne((n) => n.name === 'Active disc')) problems.push(f.name + ': active tab has no raised circle');
    f.findAll((n) => n.type === 'INSTANCE' && n.name.startsWith('Button/')).forEach((b) => {
      const label = b.findOne((n) => n.type === 'TEXT');
      const green = solid(b.fills) && sameColor(solid(b.fills).color, '2E6F55');
      const shadow = (b.effects || []).length > 0;
      if (f.name.startsWith('Station/Receipt/') ? shadow : green && !shadow) problems.push(f.name + ': shadow wrong on ' + label.characters);
    });
    const actions = f.findOne((n) => n.name === 'Actions');
    if (actions) {
      const receipt = f.name.startsWith('Station/Receipt/');
      if ((actions.layoutPositioning === 'ABSOLUTE') === receipt) problems.push(f.name + ': footer should ' + (receipt ? 'stay solid' : 'float'));
      if (!receipt && actions.fills.length) problems.push(f.name + ': floating buttons have a background');
    }
    f.findAll((n) => n.name.startsWith('List/')).forEach((list) => {
      const rows = list.children.filter((n) => n.name.startsWith('Item/'));
      const lastRule = rows.length && rows[rows.length - 1].findOne((n) => n.name === 'Rule');
      if (lastRule && lastRule.visible !== false) problems.push(f.name + ': line under the last row of ' + list.name);
    });
    if (accents > 1) problems.push(f.name + ': ' + accents + ' mustard elements, the kit allows one per screen');
  });
  return problems;
}

// ---------- rough browser preview (auto layout maps closely to flexbox) ----------

const css = (c) => 'rgb(' + [c.r, c.g, c.b].map((x) => Math.round(x * 255)).join(',') + ')';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function renderNode(n) {
  if (n.visible === false) return '';
  if (n.svgMarkup) {
    const tinted = solid(n.strokes);
    return n.svgMarkup.replace('width="24" height="24"', 'width="' + n.parent.width + '" height="' + n.parent.height + '"').replace('<svg ', '<svg style="position:absolute;left:0;top:0" ').replace('#1B2E28', tinted && tinted.color ? css(tinted.color) : '#1B2E28');
  }
  const s = ['box-sizing:border-box', 'flex:none'];
  const p = n.parent;
  const pm = p ? p.layoutMode : 'NONE';
  const abs = n.layoutPositioning === 'ABSOLUTE' || !pm || pm === 'NONE';
  if (abs) {
    s.push('position:absolute', 'left:' + n.x + 'px');
    if (n.name === 'Rule') s.push(...(n.constraints.vertical === 'STRETCH' ? ['right:0', 'top:0'] : [n.constraints.vertical === 'MAX' ? 'bottom:0' : 'top:0']));
    else if (n.name === 'Sheet') s.push('bottom:0'); else if (n.name === 'Actions') s.push('bottom:110px'); else if (n.name === 'Toast') s.push('bottom:106px'); else s.push('top:' + n.y + 'px');
  } else {
    s.push('position:relative');
  }
  const col = pm === 'VERTICAL';
  const hz = abs && n.layoutMode !== 'NONE' && n.counterAxisSizingMode === 'AUTO' ? 'HUG' : n._hz;
  const vt = n._vt;
  if (hz === 'FILL') s.push(col ? 'align-self:stretch' : 'flex:1 1 0', 'min-width:0');
  else if (n.type === 'TEXT') { /* text hugs its content unless set to FILL */ }
  else if (hz === 'FIXED' || n.layoutMode === 'NONE') s.push('width:' + n.width + 'px');
  else if (n.layoutMode !== 'NONE' && n.primaryAxisSizingMode === 'FIXED' && n.layoutMode === 'HORIZONTAL' && hz !== 'HUG') s.push('width:' + n.width + 'px');
  if (vt === 'FILL') s.push(col ? 'flex:1 1 0' : 'align-self:stretch', 'min-height:0');
  else if (n.type === 'LINE') s.push('height:0');
  else if (vt === 'FIXED' && n.type !== 'TEXT' && !(n.layoutMode !== 'NONE' && n.layoutMode === 'VERTICAL' && n.primaryAxisSizingMode === 'AUTO') && !(n.layoutMode === 'HORIZONTAL' && n.counterAxisSizingMode === 'AUTO')) s.push('height:' + n.height + 'px');
  if (n.type === 'SECTION') s.push('display:none');
  const fill = solid(n.fills) || (n.fills || []).find((x) => x.type === 'SOLID');
  if (fill && n.type !== 'TEXT' && n.type !== 'VECTOR') s.push('background:' + css(fill.color) + (fill.opacity !== undefined ? ';opacity:' + fill.opacity : ''));
  const r = n.topLeftRadius !== undefined ? [n.topLeftRadius, n.topRightRadius, n.bottomRightRadius, n.bottomLeftRadius].map((x) => (x || 0) + 'px').join(' ') : n.cornerRadius ? n.cornerRadius + 'px' : '';
  if (n.type === 'ELLIPSE') s.push('border-radius:50%'); else if (r) s.push('border-radius:' + r);
  const shadows = [];
  const stroke = solid(n.strokes);
  if (stroke && stroke.color && n.type !== 'VECTOR' && n.type !== 'LINE') {
    const c = css(stroke.color), w = n.strokeWeight === undefined ? 1 : n.strokeWeight;
    const sides = n.strokeBottomWeight !== undefined || n.strokeTopWeight !== undefined
      ? [[0, 'strokeTopWeight', 1], [0, 'strokeBottomWeight', -1], ['strokeLeftWeight', 0, 1], ['strokeRightWeight', 0, -1]].map((d) => {
        const key = d[0] || d[1];
        const weight = n[key] === undefined ? w : n[key];
        return weight ? 'inset ' + (d[0] ? d[2] * weight : 0) + 'px ' + (d[1] ? d[2] * weight : 0) + 'px 0 0 ' + c : '';
      }).filter(Boolean).join(',')
      : 'inset 0 0 0 ' + w + 'px ' + c;
    if (sides) shadows.push(sides);
  }
  (n.effects || []).forEach((e) => shadows.push(e.offset.x + 'px ' + e.offset.y + 'px ' + e.radius + 'px rgba(27,46,40,' + e.color.a + ')'));
  if (shadows.length) s.push('box-shadow:' + shadows.join(','));
  if (n.name === 'Rule') {
    const horizontal = n.constraints.horizontal === 'STRETCH';
    s.push(horizontal ? 'width:auto;left:' + n.x + 'px;right:' + n.x + 'px;height:' + n.height + 'px' : 'left:auto;width:' + n.width + 'px;height:auto;top:' + n.y + 'px;bottom:' + n.y + 'px');
  }
  if (n.clipsContent) s.push('overflow:hidden');
  if (n.reactionList.length) s.push('--link:1');
  const attrs = (n.reactionList.length ? ' data-link="' + esc(n.name) + '"' : '') + ' title="' + esc(n.name).replace(/"/g, '&quot;') + '"';

  if (n.type === 'TEXT') {
    const size = n.fontSize;
    const mono = n._font.family === 'Azeret Mono';
    s.push('font-family:' + (mono ? "'Azeret Mono'" : "'Outfit'"), 'font-size:' + size + 'px', 'line-height:' + n.lineHeight.value + '%', 'font-weight:' + { Regular: 400, Medium: 500, SemiBold: 600 }[n._font.style], 'color:' + css(fill.color), 'white-space:' + (n.textAutoResize === 'HEIGHT' ? 'pre-wrap' : 'pre'));
    if (n.textAlignHorizontal) s.push('text-align:' + n.textAlignHorizontal.toLowerCase());
    return '<div style="' + s.join(';') + '"' + attrs + '>' + esc(n.characters) + '</div>';
  }
  if (n.type === 'VECTOR') {
    const nums = n.vectorPaths[0].data.split(' ').filter((t) => !/[A-Z]/.test(t)).map(Number);
    const w = Math.max(...nums.filter((_, i) => i % 2 === 0)), h = Math.max(...nums.filter((_, i) => i % 2 === 1));
    const fillAttr = fill ? css(fill.color) : 'none';
    return '<svg width="' + w + '" height="' + h + '" style="overflow:visible;' + s.filter((x) => !x.startsWith('width') && !x.startsWith('height')).join(';') + '"><path d="' + n.vectorPaths[0].data + '" fill="' + fillAttr + '" stroke="' + css(stroke.color) + '" stroke-width="' + n.strokeWeight + '"/></svg>';
  }
  if (n.type === 'LINE') {
    const dash = n.dashPattern ? 'dashed' : 'solid';
    s.push('border-top:' + n.strokeWeight + 'px ' + dash + ' ' + css(stroke.color), 'width:' + n.width + 'px');
    return '<div style="' + s.join(';') + '"' + attrs + '></div>';
  }
  if (n.layoutMode !== 'NONE') {
    s.push('display:flex', 'flex-direction:' + (n.layoutMode === 'VERTICAL' ? 'column' : 'row'));
    if (n.itemSpacing) s.push('gap:' + n.itemSpacing + 'px');
    s.push('padding:' + [n.paddingTop, n.paddingRight, n.paddingBottom, n.paddingLeft].map((x) => (x || 0) + 'px').join(' '));
    const map = { MIN: 'flex-start', MAX: 'flex-end', CENTER: 'center', SPACE_BETWEEN: 'space-between', BASELINE: 'baseline' };
    s.push('align-items:' + (map[n.counterAxisAlignItems] || 'flex-start'));
    if (n.primaryAxisAlignItems) s.push('justify-content:' + map[n.primaryAxisAlignItems]);
    if (n.minHeight) s.push('min-height:' + n.minHeight + 'px');
  }
  return '<div style="' + s.join(';') + '"' + attrs + '>' + n.children.map(renderNode).join('') + '</div>';
}

function writePreview(frames, file, extras) {
  const groups = {};
  frames.forEach((f) => {
    const parts = f.name.split('/');
    groups[parts[0] + ' / ' + parts[1]] = groups[parts[0] + ' / ' + parts[1]] || [];
    groups[parts[0] + ' / ' + parts[1]].push(f);
  });
  const body = Object.keys(groups).map((g) => '<h2>' + esc(g) + '</h2><div class="row">' + groups[g].map((f) => '<figure data-screen="' + esc(f.name) + '"><figcaption>' + esc(f.name.split('/')[2]) + '</figcaption><div class="frame">' + renderNode(f).replace('position:absolute;left:' + f.x + 'px;top:' + f.y + 'px', 'position:relative') + '</div></figure>').join('') + '</div>').join('') + extras.map((x) => '<h2>' + esc(x.name) + '</h2>' + renderNode(x).replace(/position:absolute;left:[^;]*;top:[^;]*/, 'position:relative')).join('');
  const html = '<!doctype html><meta charset="utf-8"><title>TAPat preview</title><link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600&family=Azeret+Mono:wght@400;500&display=swap" rel="stylesheet"><style>body{margin:24px;background:#ddd;font:14px Outfit,sans-serif}h2{margin:32px 0 8px}.row{display:flex;gap:24px;flex-wrap:wrap}figure{margin:0}figcaption{margin-bottom:6px}.frame{width:390px;height:844px}</style>' + body;
  fs.writeFileSync(file, html);
}

// ---------- run ----------

async function build(code) {
  ui.messages = [];
  const context = vm.createContext({ figma, __html__: '', setTimeout, console, Promise, Math, JSON, Object, String, Number, Error });
  vm.runInContext(code, context);
  ui.onmessage({ type: 'build' });
  const finished = () => ui.messages.find((m) => m.type === 'done' || m.type === 'error');
  while (!finished()) await new Promise((r) => setTimeout(r, 10));
  const end = finished();
  if (end.type === 'error') { console.error(end.stack); throw new Error('Plugin failed: ' + end.message); }
  return end.report;
}

async function main() {
  const code = fs.readFileSync(path.join(__dirname, 'code.js'), 'utf8');
  assert(!/\?\.|\?\?/.test(code.replace(/'[^'\n]*'/g, "''")), 'avoid ?. and ?? so older plugin sandboxes can parse the file');
  // First run: the pasted logo is selected on the otherwise empty first page, next to nothing else.
  firstPage.loaded = true;
  const logo = add(new StubNode('FRAME'));
  logo.name = 'Pasted logo';
  logo.resize(300, 180);
  firstPage.selection = [logo];
  const r = await build(code);
  assert.strictEqual(r.linkErrors.join('; '), '', 'prototype links');
  assert.strictEqual(r.warnings.join('; '), '');
  const screensPage = root.children.find((p) => p.name === 'Screens');
  let frames = screensPage.children.flatMap((sec) => sec.children.filter((n) => n.type === 'FRAME'));
  assert.strictEqual(frames.length, r.screens);
  assert.deepStrictEqual(root.children.map((p) => p.name), ['Cover', 'Foundations', 'Components', 'Screens', 'Flows/Prototype']);
  screensPage.children.forEach((sec) => {
    const left = Math.min(...sec.children.filter((n) => n.type === 'FRAME').map((n) => n.x));
    sec.children.filter((n) => n.type === 'TEXT').forEach((l) => assert.ok(l.x + l.width <= left, 'row label overlaps a frame column: ' + l.name));
  });
  const componentsPage = root.children.find((p) => p.name === 'Components');
  const firstSet = Math.min(...componentsPage.children.filter((n) => n.type !== 'TEXT').map((n) => n.x));
  componentsPage.children.filter((n) => n.type === 'TEXT').forEach((l) => assert.ok(l.x + l.width <= firstSet, 'component title overlaps its set: ' + l.name));
  // The user signed off this receipt layout: keep its tab bar and its two dashed rules.
  frames.filter((f) => f.name.startsWith('Station/Receipt/')).forEach((f) => {
    assert.ok(f.findOne((n) => n.name === 'Tab bar'), 'receipt screen lost its tab bar: ' + f.name);
    const paper = f.findOne((n) => n.name === 'Paper');
    if (paper) assert.strictEqual(paper.children.filter((n) => n.name === 'Divider').length, 2, 'receipt dashed rules: ' + f.name);
    if (paper) assert.ok(!paper.findOne((n) => n.name === 'Rule'), 'engraved rules must stay out of receipts: ' + f.name);
  });
  const problems = check(frames);
  assert.deepStrictEqual(problems, []);

  // A user's own layer must survive, and a re-run must replace rather than pile up.
  const pageCounts = () => root.children.map((p) => p.children.length).join();
  const flows = root.children.find((p) => p.name === 'Flows/Prototype');
  const mine = new StubNode('FRAME');
  mine.name = 'My own notes';
  flows.appendChild(mine);
  const before = pageCounts();
  await figma.setCurrentPageAsync(screensPage);
  const r2 = await build(code);
  assert.strictEqual(pageCounts(), before, 're-run changed the node counts');
  assert.strictEqual(r2.screens, r.screens);
  assert.ok(flows.children.includes(mine), 're-run removed a layer the plugin did not build');
  const source = root.children.find((p) => p.name === 'Foundations').children.find((n) => n.getPluginData('tapat-logo') === '1');
  assert.ok(source && source.name.startsWith('Logo source'), 'logo source kept between runs');
  assert.ok(r2.warnings.length === 0, 're-run warnings: ' + r2.warnings.join('; '));
  console.log('OK: ' + r.screens + ' screen states, ' + r.sets + ' components, ' + r.variants + ' variants, ' + r.links + ' links, ' + r.warnings.length + ' warnings, re-run clean');
  frames = screensPage.children.flatMap((sec) => sec.children.filter((n) => n.type === 'FRAME'));
  if (process.argv[2]) { const extras = ['Cover', 'Foundations', 'Flows/Prototype'].flatMap((name) => root.children.find((p) => p.name === name).children.filter((n) => n.getPluginData('tapat') === '1'));
    writePreview(frames, process.argv[2], extras); console.log('Preview written to ' + process.argv[2]); }
}

main().catch((e) => { console.error(e.stack || e); process.exit(1); });

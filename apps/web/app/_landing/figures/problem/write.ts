/* The tiles' loops rewrite the same values most frames (a figure at rest, a part that is not moving). Each helper remembers what
   it last wrote to a node and skips the DOM write when the value repeats, so an idle part costs a map lookup and no style work. */
const written = new WeakMap<Element, Map<string, string>>();

function changed(node: Element, key: string, value: string) {
  let seen = written.get(node);
  if (!seen) written.set(node, (seen = new Map()));
  if (seen.get(key) === value) return false;
  seen.set(key, value);
  return true;
}

export function setAttr(node: Element | null | undefined, name: string, value: string) {
  if (node && changed(node, name, value)) node.setAttribute(name, value);
}

/** Inline opacity; an empty value clears it. */
export function setOpacity(node: HTMLElement | SVGElement | null | undefined, value: string) {
  if (node && changed(node, "style:opacity", value)) node.style.opacity = value;
}

export function setDisplay(node: HTMLElement | SVGElement | null | undefined, value: string) {
  if (node && changed(node, "style:display", value)) node.style.display = value;
}

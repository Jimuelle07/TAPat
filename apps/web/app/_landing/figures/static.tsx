import * as React from "react";

/*
 * Static figure art as one string. A server-rendered element tree reaches the page twice, as HTML and as RSC flight data, and the flight copy is
 * one JSON node per element. The same tree as a single string is one flight value. `staticG` walks the element tree of a figure's static art
 * (host elements, function components, fragments, arrays) and emits markup; the result is placed with dangerouslySetInnerHTML, so React
 * never owns those nodes and the live code finds and moves them through the DOM exactly as before.
 * Only for fully static art: no refs, no event handlers, no state. Every input is built by our own geometry code, never from user data.
 */

const KEEP = ["viewBox", "preserveAspectRatio"];
const escapeText = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const escapeAttr = (text: string) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const kebab = (name: string) => (KEEP.includes(name) ? name : name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`));

function attributes(props: Record<string, unknown>) {
  let out = "";
  for (const [name, value] of Object.entries(props)) {
    if (name === "children" || name === "key" || value === undefined || value === null || value === false) continue;
    if (name === "style" && typeof value === "object") {
      out += ` style="${escapeAttr(Object.entries(value).map(([key, item]) => `${key.startsWith("--") ? key : kebab(key)}:${item}`).join(";"))}"`;
      continue;
    }
    const attr = name === "className" ? "class" : name.startsWith("data-") || name.startsWith("aria-") ? name : kebab(name);
    out += value === true ? ` ${attr}=""` : ` ${attr}="${escapeAttr(String(value))}"`;
  }
  return out;
}

export function markupOf(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string") return escapeText(node);
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(markupOf).join("");
  const element = node as React.ReactElement<Record<string, unknown>>;
  const { type, props } = element;
  if (type === React.Fragment) return markupOf(props.children as React.ReactNode);
  if (typeof type === "function") return markupOf((type as (props: unknown) => React.ReactNode)(props));
  if (typeof type !== "string") throw new Error("static art can only hold host elements, function components and fragments");
  const children = markupOf(props.children as React.ReactNode);
  return children ? `<${type}${attributes(props)}>${children}</${type}>` : `<${type}${attributes(props)}/>`;
}

/** A group whose content is this static art, written as markup. Give `key` when it goes into a list. */
export const staticG = (node: React.ReactNode, key?: string | number) => <g key={key} dangerouslySetInnerHTML={{ __html: markupOf(node) }} />;

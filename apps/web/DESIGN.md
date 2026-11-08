---
name: TAPat
description: Fuel aid that can say no, set in the ruled paper, arcs and field colours of the TAPat Mobile App UI kit.
colors:
  primary: "#2e6f55"
  primary-deep: "#29664e"
  pressed: "#1f5540"
  accent: "#f7b93e"
  accent-tint: "#fbd88f"
  ring-accent: "#c98f1e"
  declined: "#c8552f"
  declined-tint: "#f6dfd3"
  danger: "#c0392b"
  frozen: "#bfe6f7"
  mint: "#d8e7df"
  text: "#1b2e28"
  muted: "#5c6b65"
  surface: "#fbf5e3"
  raised: "#fdfaf0"
  sunken: "#f2e8cc"
  ring-surface: "#e3d6b2"
typography:
  doc-body:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.55
  doc-h1:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(34px, 4.2vw, 54px)"
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: "-0.015em"
  doc-h2:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(24px, 2.4vw, 30px)"
    fontWeight: 600
    lineHeight: 1.2
  doc-h3:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 600
    lineHeight: 1.3
  doc-lead:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(18px, 1.5vw, 20px)"
    fontWeight: 400
    lineHeight: 1.5
  doc-small:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  doc-mono:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  doc-status:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.04em"
  h2:
    fontFamily: "Outfit, ui-sans-serif, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 500
    lineHeight: 1.35
  small:
    fontFamily: "Outfit, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Outfit, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.3
  caption:
    fontFamily: "Outfit, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4
  card-value:
    fontFamily: "Outfit, ui-sans-serif, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 500
    lineHeight: 1.2
  card-value-sm:
    fontFamily: "Outfit, ui-sans-serif, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 500
    lineHeight: 1.2
  amount-lg:
    fontFamily: "Azeret Mono, ui-monospace, monospace"
    fontSize: "40px"
    fontWeight: 500
    lineHeight: 1.15
  amount-md:
    fontFamily: "Azeret Mono, ui-monospace, monospace"
    fontSize: "36px"
    fontWeight: 500
    lineHeight: 1.15
  amount-sm:
    fontFamily: "Azeret Mono, ui-monospace, monospace"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: 1.3
  mono:
    fontFamily: "Azeret Mono, ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  sm: "8px"
  md: "12px"
  lg: "20px"
  doc: "2px"
spacing:
  stat-gap: "12px"
  stack: "16px"
  card: "16px"
  screen-gutter: "20px"
  section-y: "64px"
  section-y-lg: "80px"
  page-gutter: "clamp(20px, 4vw, 48px)"
  page-max: "1200px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "54px"
  button-primary-hover:
    backgroundColor: "{colors.pressed}"
    textColor: "{colors.surface}"
  button-secondary:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "54px"
  button-secondary-hover:
    backgroundColor: "{colors.mint}"
    textColor: "{colors.text}"
  button-tertiary:
    textColor: "{colors.primary}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "54px"
  button-disabled:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.text}"
  chip-outline:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  chip-mint:
    backgroundColor: "{colors.mint}"
    textColor: "{colors.text}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  chip-accent:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.text}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  chip-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.surface}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  chip-frozen:
    backgroundColor: "{colors.frozen}"
    textColor: "{colors.text}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  chip-ink:
    backgroundColor: "{colors.text}"
    textColor: "{colors.surface}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  doc-button:
    backgroundColor: "{colors.text}"
    textColor: "{colors.surface}"
    rounded: "{rounded.doc}"
    padding: "0 20px"
    height: "44px"
  doc-button-hover:
    backgroundColor: "{colors.pressed}"
    textColor: "{colors.surface}"
  doc-status-ok:
    textColor: "{colors.primary}"
    typography: "{typography.doc-status}"
    rounded: "{rounded.doc}"
    padding: "2px 6px"
  doc-status-refused:
    textColor: "{colors.danger}"
    typography: "{typography.doc-status}"
    rounded: "{rounded.doc}"
    padding: "2px 6px"
  doc-status-held:
    backgroundColor: "{colors.frozen}"
    textColor: "{colors.text}"
    typography: "{typography.doc-status}"
    rounded: "{rounded.doc}"
    padding: "2px 6px"
  doc-panel:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    padding: "40px"
  filter-chip-selected:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "44px"
  card:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "{spacing.card}"
  stat-card-forest:
    backgroundColor: "{colors.primary-deep}"
    textColor: "{colors.surface}"
    typography: "{typography.card-value}"
    rounded: "{rounded.md}"
    padding: "0 24px"
    height: "112px"
  stat-card-cream:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    typography: "{typography.card-value-sm}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "88px"
  field:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    typography: "{typography.amount-sm}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  field-error:
    backgroundColor: "{colors.declined-tint}"
    textColor: "{colors.text}"
  sheet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "12px 20px 32px"
  tab-bar:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.muted}"
    typography: "{typography.caption}"
    height: "56px"
  receipt:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    typography: "{typography.mono}"
    padding: "20px"
---

# Design System: TAPat

## Overview

**Creative North Star: "The Ruled Receipt"**

TAPat looks like a document that can be checked. Cream paper, ink rules at one weight, and amounts on ledger lines carry the system; in the app a large arc and a set of corner rings in a green, mustard, terracotta or ice blue field give it warmth. The identity comes from the TAPat Mobile App UI Figma file, generated by `design/figma-plugin` on the "TAPat Kit 2 - Clean Fintech" brandkit. The app remains its incumbent expression.

The app is dense and phone-sized: a 390px screen, 20px gutters, stacked ruled cards. The landing page is a separate civic ledger: a numbered program brief on the same Cream with 1px Ink rules, bilingual section headings (Filipino, then English), one cover photo, and no shadows, arcs or rings. Its type is IBM Plex, set by `doc-*` classes scoped to `.landing`.

Depth is mostly line, not shadow. Colour names a state before it decorates: a terracotta field means a refusal, an ice blue field means a freeze. On the landing page colour appears only in written status words.

**Key Characteristics:**
- Cream paper grounds with ink rules at a constant 1.5px.
- Field colours that keep their kit meaning at every scale.
- One recurring figure in the app: a large arc plus corner rings on stat cards.
- Outfit for words and headline figures, Azeret Mono for ledger lines and contract calls. The landing page uses IBM Plex Sans and Plex Mono instead.
- Square paper for receipts, gently rounded cards and controls.
- Status always written out, so colour is never the only signal.

## Colors

A warm cream and forest palette with three state fields (terracotta, ice blue, mustard) and a single near-black green ink.

### Primary
- **Forest** (#29664e): The dark field. Forest stat cards and the fuel credit card.
- **Field Green** (#2e6f55): Filled buttons, selected filter chips, the active tab disc, chart price line, focus ring, the arc on Forest, and the landing page's PAID and FUNDED status and text links.
- **Pressed Green** (#1f5540): Hover and active state of filled buttons, including the landing button, and the rings on green grounds.

### Secondary
- **Mustard** (#f7b93e): The "Velo verified" chip, the chart threshold line and the tap scene's card.
- **Pale Mustard** (#fbd88f): The tap scene's card and finished LED, and the chart's fire-score fill.
- **Ring Mustard** (#c98f1e): The tap scene's card chip and ripple, and the chart's fire-score line.

### Tertiary
- **Terracotta** (#c8552f): The border of a field in error and the tap scene's error LED.
- **Terracotta Tint** (#f6dfd3): The fill of a field in error.
- **Alarm Red** (#c0392b): The filled status chip for declined, refused and failed, and the landing page's DECLINED status. It carries Cream text in the app.
- **Ice Blue** (#bfe6f7): Frozen only: the frozen chip, the frozen notice, and the landing page's HELD status.
- **Mint** (#d8e7df): Healthy status chips, secondary and tertiary button hover.

### Neutral
- **Ink** (#1b2e28): All body text, all default rules and borders, the landing button's fill, and the landing page's text selection.
- **Muted Green-Grey** (#5c6b65): Inactive tab icons and labels, and input placeholders. Never body copy.
- **Cream** (#fbf5e3): The app screen, the sheet, the landing page's ground and header, and text on dark grounds.
- **Raised Paper** (#fdfaf0): Cards, list cards, receipts, secondary buttons, the tab bar, and the landing page's title panel and sample terminal.
- **Sunken Cream** (#f2e8cc): The page behind the app, disabled buttons, skeletons, the arc in cream cards, and the landing terminal's button hover.
- **Ring Cream** (#e3d6b2): Corner rings on cream grounds, and the landing page's rules between table and list rows.

### Named Rules
**The Kit Meaning Rule.** A colour field keeps its meaning at every scale. Terracotta Tint is a refusal, Ice Blue is a freeze.

**The Ground-and-Arc Rule.** App stat cards pair a ground with one fixed arc and ring colour: Forest with Field Green and Pressed Green, Cream with Sunken Cream and Ring Cream. Don't invent new pairs.

**The Colour-for-Status Rule.** On the landing page colour appears only in `Status` words: Field Green for PAID and FUNDED, Alarm Red for DECLINED, Ice Blue for HELD. The rest is Ink on Cream.

## Typography

**Display Font:** Outfit (with ui-sans-serif, system-ui, sans-serif)
**Body Font:** Outfit (with ui-sans-serif, system-ui, sans-serif)
**Label/Mono Font:** Azeret Mono (with ui-monospace, monospace)

**Character:** Outfit is round and friendly, and it keeps a serious subject approachable. Azeret Mono reads as a printed ledger, so anything set in it looks checkable.

**Landing page only:** IBM Plex Sans (400, 500, 600) sets words and IBM Plex Mono (400, 500) sets amounts, contract calls and ledger lines, on the same Cream ground. Both carry ₱, so the landing page writes ₱ where the app keeps the "PHP" label. The sample terminal's `TapScene` text is the app's own. The app keeps Outfit, Azeret Mono and the "PHP" label.

### Hierarchy
- **Landing:** see the Doc entries below, which set the landing page's type.
- **H2** (500, 22px, 1.35): App screen titles and section titles.
- **Small** (400, 15px, 1.45): App body copy.
- **Label** (500, 15px, 1.3): Buttons, list titles, navigation links.
- **Caption** (500, 13px, 1.4): Chips, list metadata, tab labels and field labels.
- **Card Value** (500, 28px, 1.2) and **Card Value Small** (500, 24px, 1.2): Stat card values, in Outfit.
- **Amount Large, Medium, Small** (500, 40px, 36px and 16px, in Azeret Mono): The station entry amount, the fuel credit balance, and receipt and field amounts.
- **Mono** (400, 13px, 1.4): Ledger rows in the app.
- **Doc Body** (400, 17px, 1.55, Plex Sans): Landing page body copy.
- **Doc H1** (600, clamp(34px, 4.2vw, 54px), 1.08, -0.015em, balanced): The landing page's one headline.
- **Doc H2** (600, clamp(24px, 2.4vw, 30px), 1.2, balanced): Section headings, both lines.
- **Doc H3** (600, 19px, 1.3): Step titles.
- **Doc Lead** (400, clamp(18px, 1.5vw, 20px), 1.5, pretty, at most 60ch): The paragraph under the headline.
- **Doc Small** (400, 14px, 1.45): Captions, table sources, footnotes.
- **Doc Mono** (Plex Mono 400, 14px, 1.5, tabular): Amounts, contract calls and ledger lines on the landing page.

### Named Rules
**The Word-and-Ledger Rule.** Outfit sets words, stat tiles and headline figures. Azeret Mono sets anything a reader might check: amounts on ruled lines, transaction references, thresholds and contract calls. The direction contract asked for Azeret on all amounts; the build, matching the Figma card-value style, keeps tiles and display figures in Outfit, and that is the system.

**The PHP Label Rule.** Azeret Mono has no ₱ glyph, so app amounts are spelled "PHP 1,500.00", the label the kit itself uses. The landing page is set in IBM Plex, which carries ₱ in its latin-ext range, so it writes "₱1,500.00".

## Layout

The app is one column, capped by the 430px sheet and tab bar and framed on desktop by the phone mockup from `md` up. Screens use 20px gutters, a 16px vertical stack, 16px card padding, and 12px between stat cards. Tap targets are at least 44px and primary buttons are 54px tall.

On the landing page, content sits in a container of at most 1200px with a fluid gutter of `clamp(20px, 4vw, 48px)`. Each numbered section is opened by a 1px Ink rule and uses 64px vertical padding, 80px from `lg`. From `lg` a section is a 12-column document grid: the heading takes 4 columns and the body takes 8. Below `lg` the heading stacks above the body.

The sticky header is 56px, and in-page links scroll with a 4.5rem offset so a heading stays visible below it. The title block is a 12-column grid: the panel takes 7 columns, and the photo caption and Contents list take 4 columns from column 9.

## Elevation & Depth

A hybrid that is mostly flat. Layers separate by 1.5px ink lines (1px on the landing page) and tonal paper steps (Sunken Cream, Cream, Raised Paper). Soft shadow appears only on filled app controls that invite a press and on the one surface that floats over the page. The app's phone frame is a raster overlay above the screen and is not a shadow.

### Shadow Vocabulary
- **Button** (`box-shadow: 0 2px 4px rgb(27 46 40 / 0.3)`): Filled app buttons and the active tab disc.
- **Sheet** (`box-shadow: 0 -4px 24px rgb(27 46 40 / 0.18)`): The bottom sheet, over a `rgb(27 46 40 / 0.45)` backdrop.

### Named Rules
**The Ink-Before-Shadow Rule.** Cards, receipts, chips and panels get a rule, not a shadow. If a surface needs separating, draw the line. The landing page follows the same rule with no exception: it has no shadows at all.

## Shapes

Three radii: chips and filter chips at 8px, cards, fields and buttons at 12px, and the sheet's top corners at 20px. Receipts are square, because they are paper rather than controls. Circles are structural: the arc, the rings and the active tab disc. The landing page is the exception: it uses 2px corners on its button, status words and sample terminal buttons, and square panels and tables.

Rules are 1.5px at rest, in Ink on paper and in the current text colour on dark grounds. Dashed 1.5px rules separate sections inside a receipt. Weight rises only for urgency: a 2px border on an error notice, 2.5px on a mismatched invariant and a focused field. Keyboard focus is a 2.5px Field Green outline at a 2px offset, switching to Cream on green grounds. The landing page draws its rules at 1px.

**The Arc and Rings.** On a stat card, an oversized filled circle runs off the right edge, with concentric 1.5px rings centred on the top-right corner, in 64 to 82px ring sets.

**The Tear Edge.** A receipt ends in an ink zigzag, with the paper fill running into each tooth, 7px tall.

## Components

### Buttons
Tactile and plain: a solid block with a clear press state.
- **Shape:** Gently curved (12px), 54px tall, full width in the app.
- **Primary:** Field Green with Cream label and the Button shadow.
- **Hover / Active:** Darkens to Pressed Green by colour transition, with no movement.
- **Secondary:** Raised Paper with a 1.5px Ink border, going to Mint on hover.
- **Tertiary:** Field Green label with no fill, going to Mint on hover.
- **Disabled:** Sunken Cream with Ink label. A loading button adds a spinning refresh icon.
- **Landing Button:** `doc-btn`: 44px tall, 20px side padding, 2px corners, Ink fill with Cream label, going to Pressed Green on hover by a 120ms colour transition. A second action on the landing page is an underlined Field Green text link.

### Chips
- **Style:** 8px corners, 1.5px Ink border, caption type, 4px by 8px padding. Always a written status, never colour alone.
- **Tones:** Outline on Raised Paper, Mint for healthy, Mustard for verified, Alarm Red for declined or failed, Ice Blue for frozen, Ink for a mismatch.
- **Filter Chip:** 44px tall in label type. Selected is Field Green, unselected is Raised Paper.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** Raised Paper.
- **Shadow Strategy:** None, per the Ink-Before-Shadow Rule.
- **Border:** 1.5px Ink.
- **Internal Padding:** 16px, with 1.5px Ink rules between rows.
- **Stat Card:** Value over caption, clipped, with the Arc and Rings. Cream tone on Raised Paper, Forest tone for the headline figure.

### Inputs / Fields
- **Style:** A bordered label wrapping a caption and an Azeret Mono value, on Raised Paper with 12px corners.
- **Focus:** The border thickens to 2.5px Field Green.
- **Error:** Terracotta border on Terracotta Tint, with a written note below.

### Navigation
- **Tab Bar:** 56px Raised Paper bar with a 1.5px Ink top rule. Inactive tabs are Muted line icons with caption labels. The active tab raises a 44px Field Green disc inside a curve in the bar's top line, with a semibold Field Green label.
- **Top Bar:** The cropped logo on root screens; a back target and H2 title on detail screens.
- **Landing Header:** Sticky, 56px, on Cream with a 1px Ink bottom rule. It holds the logo, a "Run the agent demo" link (hidden below `sm`) and the 44px "Open the app" button. It has no navigation links.

### Receipt
The system's core artefact. Square Raised Paper with a 1.5px Ink border, the cropped logo, a written status chip with its amount, ruled ledger rows, dashed separators and the Tear Edge. A declined receipt shows the reason and no balance.

### Landing Page
The public page at `/` is a numbered program brief, not an app screen. It is scoped to `.landing` and styled by the `doc-*` classes in `app/globals.css` and `app/_landing/kit.tsx`; the app's type scale and components do not appear on it, except the sample terminal's `TapScene`.

- **Section Heading:** Two lines in `doc-h2`: the Filipino line (`lang="fil"`, with the section number in Plex Mono ahead of it), then the English line at normal weight. The Contents list beside the title panel uses the same order, Filipino then English, with a ruled row per section.
- **Tables:** `doc-table` with a 1px Ink rule under the header row and Ring Cream rules between rows. Tables carry a caption or header row, and scroll sideways below 560px.
- **Status:** A 2px-cornered Plex Mono 12px word with a 1px border, always an uppercase word. PAID and FUNDED are Field Green, DECLINED is Alarm Red, HELD has an Ice Blue fill with Ink, and SAMPLE, SAMPLE DATA and RETURNED are Ink.
- **Cover:** One full-bleed documentary photo of a motorized tricycle, with no overlay, scrim or motion. The title sits on a solid Raised Paper panel with a 1px Ink border that overlaps the photo's bottom edge by 128px from `lg`; below `lg` it sits under the photo.
- **Sample Terminal:** A Raised Paper box with a 1px Ink border, the "Station A" header row with a SAMPLE status, the app's `TapScene`, three 44px tap buttons (pressed state fills Ink), and a ruled slip below. It is labelled "Fig. 1" and says its data is sample data.
- **Motion:** On first load the terminal plays the over-cap tap once: it starts after 600ms, reads for 700ms, then the slip fades in over 180ms (`doc-fade`). It never loops. Clicking a button cancels the autoplay and plays that tap. Under reduced motion the verdict is shown at once with no fade.

### Asset Sources
`public/phone-frame.png` and `public/tapat-app-icon-1024.png` are pre-existing project assets supplied by the team. The icon is the TAPat brand logo; the frame was added in commit 813b290. They were deliberately not re-stamped with embedded provenance, because both are shared with the app.

`app/_landing/cover-tricycle-negros.jpg` is Pexels photo 4330929, "Old Tricycle on Street in Philippines", by Denniz Futalan (Negros Island Region), used under the Pexels License. It is a stock photo, not a TAPat driver or station, and the page's caption and footer credit it.

## Do's and Don'ts

### Do:
- **Do** take every colour, radius and type size on app screens from the Figma-derived tokens in `app/globals.css`. The landing page takes colour and radius from the same tokens and sets its type with the `doc-*` classes, which are scoped to `.landing`.
- **Do** draw rules at 1.5px in the app and 1px on the landing page, in Ink on paper.
- **Do** spell amounts with the "PHP" label in the app wherever they are set in Azeret Mono. The landing page sets amounts in Plex Mono with ₱.
- **Do** write status out in a chip or sentence alongside any status colour. On the landing page that is the `Status` word: PAID, DECLINED, HELD.
- **Do** build the landing page's sample terminal from the app's real `TapScene` and say on the page that it uses sample data.
- **Do** place the logo on Cream or Raised Paper, cropped to the icon's middle band as the top bar does, since it blends with `mix-blend-mode: darken`.
- **Do** gate motion behind `prefers-reduced-motion: no-preference`. On the landing page the only motion is the sample terminal.
- **Do** credit the cover photo in its caption and the footer, and call it a stock photo.

### Don't:
- **Don't** use Ice Blue for anything but a freeze, or Terracotta and its tint for anything but refusal and invalid input.
- **Don't** set the ₱ glyph in Azeret Mono.
- **Don't** give cards, receipts, chips or the landing page's panels a shadow, and don't use hard offset shadows anywhere.
- **Don't** set Muted Green-Grey as body copy.
- **Don't** round receipts, or square off app cards and controls.
- **Don't** add scroll-driven or looping motion, gradient scrims or abstract art to the landing page.
- **Don't** place a small uppercase label above a headline. Uppercase belongs to printed artefacts and status: the receipt header, the fuel credit card's face, and status chips such as DECLINED.
- **Don't** replace the kit's 1.5px line icons with glyphs or emoji.

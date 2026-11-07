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
  landing-display:
    fontFamily: "Outfit, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(52px, 7vw, 96px)"
    fontWeight: 600
    lineHeight: 1.02
    letterSpacing: "-0.03em"
  landing-figure:
    fontFamily: "Outfit, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(48px, 6.4vw, 92px)"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.03em"
  landing-h2:
    fontFamily: "Outfit, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(38px, 4.8vw, 68px)"
    fontWeight: 600
    lineHeight: 1.06
    letterSpacing: "-0.025em"
  landing-lead:
    fontFamily: "Outfit, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(17px, 1.45vw, 20px)"
    fontWeight: 400
    lineHeight: 1.5
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
  landing-rule:
    fontFamily: "Azeret Mono, ui-monospace, monospace"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  sm: "8px"
  md: "12px"
  lg: "20px"
spacing:
  stat-gap: "12px"
  stack: "16px"
  card: "16px"
  screen-gutter: "20px"
  band-y: "64px"
  band-y-lg: "80px"
  section-y: "80px"
  section-y-lg: "112px"
  page-gutter: "clamp(20px, 5vw, 72px)"
  page-max: "1440px"
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
  cta-accent:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 24px"
    height: "54px"
  cta-accent-hover:
    backgroundColor: "{colors.accent-tint}"
    textColor: "{colors.text}"
  cta-compact:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
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

TAPat looks like a document that can be checked. Cream paper, ink rules at one weight, and amounts on ledger lines carry the system; a large arc and a set of corner rings in a green, mustard, terracotta or ice blue field give it warmth. The identity comes from the TAPat Mobile App UI Figma file, generated by `design/figma-plugin` on the "TAPat Kit 2 - Clean Fintech" brandkit. It pre-dates the landing page, and the app remains its incumbent expression.

The app is dense and phone-sized: a 390px screen, 20px gutters, stacked ruled cards. The landing page is the system's page-scale extension and adds no new materials. A stat card's ground, arc and rings become a full-bleed band, the receipt's paper and tear edge become a page section, and the receipt's ruled lines carry the limits and contract calls beside each claim. Page-scale values live in the landing tokens; the app's type scale and components stay unchanged and appear on the page as real components inside the phone mockup.

Depth is mostly line, not shadow. Colour names a state before it decorates: a terracotta field means a refusal, an ice blue field means a freeze. This page's composition, a pinned phone walking through the bands, belongs to its surface brief at `.impeccable/surfaces/app-page-tsx.md` and is not a system rule.

**Key Characteristics:**
- Cream paper grounds with ink rules at a constant 1.5px.
- Field colours that keep their kit meaning at every scale.
- One recurring figure: a large arc plus corner rings, from a 64px stat card to a 240px band corner.
- Outfit for words and headline figures, Azeret Mono for ledger lines and contract calls.
- Square paper for receipts and bands, gently rounded cards and controls.
- Status always written out, so colour is never the only signal.

## Colors

A warm cream and forest palette with three state fields (terracotta, ice blue, mustard) and a single near-black green ink.

### Primary
- **Forest** (#29664e): The dark field. Forest stat cards, the fuel credit card, and the first and closing landing bands.
- **Field Green** (#2e6f55): Filled buttons, selected filter chips, the active tab disc, chart price line, focus ring, and the arc on Forest. Also a landing band ground, with Forest as its arc.
- **Pressed Green** (#1f5540): Hover and active state of filled buttons, the rings on green grounds, and the arc on Ink.

### Secondary
- **Mustard** (#f7b93e): Return at page scale, the accent CTA on dark grounds, the "Velo verified" chip, the chart threshold line, and landing text selection.
- **Pale Mustard** (#fbd88f): Hover on the accent CTA, and the arc on a Mustard band.
- **Ring Mustard** (#c98f1e): Corner rings on a Mustard band only.

### Tertiary
- **Terracotta** (#c8552f): Refusal at page scale, as the arc and rings on a declined band, and the border of a field in error.
- **Terracotta Tint** (#f6dfd3): The declined band ground and the fill of a field in error.
- **Alarm Red** (#c0392b): The filled status chip for declined, refused and failed. It carries Cream text.
- **Ice Blue** (#bfe6f7): Frozen only: the frozen chip, the frozen notice, and the frozen band.
- **Mint** (#d8e7df): Healthy status chips, secondary and tertiary button hover, and a calm landing band ground.

### Neutral
- **Ink** (#1b2e28): All body text, all default rules and borders, and the stakes band ground.
- **Muted Green-Grey** (#5c6b65): Inactive tab icons and labels, and input placeholders. Never body copy.
- **Cream** (#fbf5e3): The app screen, the sheet, the landing header, a landing band ground, and text on dark grounds.
- **Raised Paper** (#fdfaf0): Cards, list cards, receipts, secondary buttons and the tab bar.
- **Sunken Cream** (#f2e8cc): The page behind the app, disabled buttons, skeletons, the arc in cream cards and bands, and the enforcement section ground.
- **Ring Cream** (#e3d6b2): Corner rings on cream grounds only.

### Named Rules
**The Kit Meaning Rule.** A colour field keeps its meaning at every scale. Terracotta Tint is a refusal, Ice Blue is a freeze, Mustard as a full field is money coming back. A new band picks its ground by what the section is about, never for variety.

**The Ground-and-Arc Rule.** Every field pairs a ground with one fixed arc and ring colour: Forest with Field Green and Pressed Green, Field Green with Forest and Pressed Green, Cream with Sunken Cream and Ring Cream, Mint and Ice Blue with Cream and Raised Paper, Terracotta Tint with Terracotta, Mustard with Pale Mustard and Ring Mustard, Ink with Pressed Green and Field Green. Don't invent new pairs.

## Typography

**Display Font:** Outfit (with ui-sans-serif, system-ui, sans-serif)
**Body Font:** Outfit (with ui-sans-serif, system-ui, sans-serif)
**Label/Mono Font:** Azeret Mono (with ui-monospace, monospace)

**Character:** Outfit is round and friendly, and it keeps a serious subject approachable. Azeret Mono reads as a printed ledger, so anything set in it looks checkable.

### Hierarchy
- **Landing Display** (600, clamp(52px, 7vw, 96px), 1.02, -0.03em): The landing page's one headline.
- **Landing Figure** (600, clamp(48px, 6.4vw, 92px), 1, -0.03em): Cited figures on the stakes band. A currency prefix sits in Azeret Mono at 0.3em.
- **Landing H2** (600, clamp(38px, 4.8vw, 68px), 1.06, -0.025em, balanced): Band and section headlines.
- **Landing Lead** (400, clamp(17px, 1.45vw, 20px), 1.5, pretty): Band body copy, held to the band's copy column or 56 to 62ch.
- **H2** (500, 22px, 1.35): App screen titles and section titles, and the decision names in the enforcement table.
- **Small** (400, 15px, 1.45): App body copy.
- **Label** (500, 15px, 1.3): Buttons, list titles, navigation links.
- **Caption** (500, 13px, 1.4): Chips, list metadata, tab labels and field labels.
- **Card Value** (500, 28px, 1.2) and **Card Value Small** (500, 24px, 1.2): Stat card values, in Outfit.
- **Amount Large, Medium, Small** (500, 40px, 36px and 16px, in Azeret Mono): The station entry amount, the fuel credit balance, and receipt and field amounts.
- **Mono** (400, 13px, 1.4): Ledger rows in the app. **Landing Rule** (400, 14px, 1.4, tabular) is the same line at page scale.

### Named Rules
**The Word-and-Ledger Rule.** Outfit sets words, stat tiles and headline figures. Azeret Mono sets anything a reader might check: amounts on ruled lines, transaction references, thresholds and contract calls. The direction contract asked for Azeret on all amounts; the build, matching the Figma card-value style, keeps tiles and display figures in Outfit, and that is the system.

**The PHP Label Rule.** Azeret Mono has no ₱ glyph, so amounts are spelled "PHP 1,500.00", the label the kit itself uses. Landing mockups rewrite any shared string that carries the symbol.

## Layout

The app is one column, capped by the 430px sheet and tab bar and framed on desktop by the phone mockup from `md` up. Screens use 20px gutters, a 16px vertical stack, 16px card padding, and 12px between stat cards. Tap targets are at least 44px and primary buttons are 54px tall.

At page scale, content sits in a container of at most 1440px with a fluid gutter. Bands are full-bleed and meet edge to edge, each opened by a 1.5px ink rule. From `lg` up a band is at least one viewport tall below the 64px header, centred vertically, with copy in the left 46% (at most 576px) and the arc on the right; below `lg` copy stacks above the band's own phone, and the arc drops to the band's bottom right. Sections without a phone use 80px vertical padding, 112px from `lg`.

Enforcement and stakes rows use ruled grids: 5:4:3 columns on the stakes band from `lg`, 1:1.2:3 on the enforcement table from `md`. Each collapses to a single column below that.

## Elevation & Depth

A hybrid that is mostly flat. Layers separate by 1.5px ink lines and tonal paper steps (Sunken Cream, Cream, Raised Paper). Soft shadow appears only on filled controls that invite a press and on the one surface that floats over the page. The app's phone frame is a raster overlay above the screen and is not a shadow.

### Shadow Vocabulary
- **Button** (`box-shadow: 0 2px 4px rgb(27 46 40 / 0.3)`): Filled buttons, the accent CTA, and the active tab disc.
- **Sheet** (`box-shadow: 0 -4px 24px rgb(27 46 40 / 0.18)`): The bottom sheet, over a `rgb(27 46 40 / 0.45)` backdrop.

### Named Rules
**The Ink-Before-Shadow Rule.** In the app, cards, receipts, chips and bands get a rule, not a shadow. If a surface needs separating, draw the line. The landing page is the one exception and has its own scale, below.

### Landing Depth Scale
The landing page is built from paper objects resting on surfaces, so it carries a layered scale in `app/_landing/depth.css`. Shadows are soft, stacked and tinted with Ink `rgb(27 46 40 / …)`; black appears only on Forest and Ink grounds. Objects the reader touches or reads sit higher than the grounds beneath them, and text gets no shadow.
- `depth-1`: chips, stamps and slips resting on paper, and raised buttons (with a top sheen).
- `depth-2`: cards, artifacts and panels, composed with `var(--depth-2)` in the owning stylesheet.
- `depth-3`: hero-object strength. The pinned receipt uses a `drop-shadow` filter at this strength so the shadow follows its torn edge.
- `depth-dark`: objects on Forest or Ink grounds, such as the tap terminal.
- Inset: pressed keys and the sample feed slot use `--depth-inset`. The price board and the printer slot use dark (black-alpha) insets, as recessed metal and LCD surfaces.

Hard offset shadows remain banned everywhere, and app screens keep the Ink-Before-Shadow Rule.

## Shapes

Three radii: chips and filter chips at 8px, cards, fields and buttons at 12px, and the sheet's top corners at 20px. Receipts, the enforcement paper and full-bleed bands are square, because they are paper rather than controls. Circles are structural: the arc, the rings and the active tab disc.

Rules are 1.5px at rest, in Ink on paper and in the current text colour on dark grounds. Dashed 1.5px rules separate sections inside a receipt or the enforcement paper. Weight rises only for urgency: a 2px border on an error notice, 2.5px on a mismatched invariant and a focused field. Keyboard focus is a 2.5px Field Green outline at a 2px offset, switching to Cream on green grounds.

**The Arc and Rings.** An oversized filled circle runs off the right edge, with concentric 1.5px rings centred on the top-right corner. Stat cards use 64 to 82px ring sets; bands use a 240px set of 8 rings at a 30px step, shown at half size below `lg`. The band arc is sized to stay clear of the copy column.

**The Tear Edge.** A receipt ends in an ink zigzag, with the paper fill running into each tooth, 7px tall in the app and 10px at page scale.

## Components

### Buttons
Tactile and plain: a solid block with a clear press state.
- **Shape:** Gently curved (12px), 54px tall, full width in the app.
- **Primary:** Field Green with Cream label and the Button shadow.
- **Hover / Active:** Darkens to Pressed Green by colour transition, with no movement.
- **Secondary:** Raised Paper with a 1.5px Ink border, going to Mint on hover.
- **Tertiary:** Field Green label with no fill, going to Mint on hover.
- **Disabled:** Sunken Cream with Ink label. A loading button adds a spinning refresh icon.
- **Landing CTA:** Auto width with 24px padding and a 1.5px border. Mustard with an Ink border on dark grounds; outlined in the current colour for the second action, filling Cream on hover. The header uses a 44px compact Field Green version.

### Chips
- **Style:** 8px corners, 1.5px Ink border, caption type, 4px by 8px padding. Always a written status, never colour alone.
- **Tones:** Outline on Raised Paper, Mint for healthy, Mustard for verified, Alarm Red for declined or failed, Ice Blue for frozen, Ink for a mismatch.
- **Filter Chip:** 44px tall in label type. Selected is Field Green, unselected is Raised Paper.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** Raised Paper.
- **Shadow Strategy:** None, per the Ink-Before-Shadow Rule. The landing page uses the Landing Depth Scale instead.
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
- **Landing Header:** Sticky, 64px, on Cream with a 1.5px Ink bottom rule. The contract asked for Raised Paper; the build uses Cream. Links underline on hover and hide below `md`, leaving the compact CTA.

### Receipt
The system's core artefact. Square Raised Paper with a 1.5px Ink border, the cropped logo, a written status chip with its amount, ruled ledger rows, dashed separators and the Tear Edge. A declined receipt shows the reason and no balance.

### Band
A stat card at page scale: a full-bleed ground, the band arc, a 240px ring set and a 1.5px Ink top rule. Beside the headline, ledger rows in Landing Rule type on current-colour rules state the limit or contract call behind the claim.

### Device Mockup
Remotion scenes (`app/_landing/screens.tsx`) at 390px, scaled and inert under `public/phone-frame.png`, built from the app's real components with frame-driven motion only, described by an accessible label. The phone has real depth: stacked body layers for its thickness, a detached floating shadow and a band of light that travels across the glass as it turns. The pinned phone plays the scene of the band at mid-viewport; under reduced motion each scene shows its finished frame. Each band also has its own abstract art in its kit colours (`app/_landing/art.tsx`): a tap ripple, a masterlist sieve, a fan of cards, a price step, a no-entry sign, ice facets, a sun of rays and a ring of coins, played by Remotion (`app/_landing/Motion.tsx`). Art grows in when its band arrives and keeps a slow idle motion while on screen; phone scenes loop with a hold on the finished screen. Off-screen players pause. On a device with a mouse the pinned phone swings to face the cursor on a spring with a slight overshoot, at most 22 degrees so its screen stays readable. On touch screens the phone moves with the scroll instead, nearly square-on when a band fills the screen and facing north, east, south and west in turn between bands (CSS scroll timelines, in both directions). On desktop each band's art is centred exactly behind the pinned phone; bands stack as rounded sheets, and landing cards, pills and the floating nav follow a double-bezel, nested-arrow language with no realistic imagery.

### Asset Sources
`public/phone-frame.png` and `public/tapat-app-icon-1024.png` are pre-existing project assets that pre-date the landing page, supplied by the team. The icon is the TAPat brand logo; the frame was added in commit 813b290. They were deliberately not re-stamped with embedded provenance, because both are shared with the app.

## Do's and Don'ts

### Do:
- **Do** take every colour, radius and type size from the Figma-derived tokens in `app/globals.css`, and add a page-scale token only where app sizes cannot reach.
- **Do** draw rules at 1.5px, in Ink on paper and the current text colour on dark grounds.
- **Do** spell amounts with the "PHP" label wherever they are set in Azeret Mono.
- **Do** write status out in a chip or sentence alongside any status colour.
- **Do** build mockups from the app's real components and say on the page that they use sample data.
- **Do** place the logo on Cream or Raised Paper, cropped to the icon's middle band as the top bar does, since it blends with `mix-blend-mode: darken`.
- **Do** gate motion behind `prefers-reduced-motion: no-preference`, and keep a band legible when the scroll-driven arc swell is unsupported.

### Don't:
- **Don't** use Ice Blue for anything but a freeze, or Terracotta and its tint for anything but refusal and invalid input.
- **Don't** set the ₱ glyph in Azeret Mono.
- **Don't** give cards, receipts, chips or bands a shadow in the app, and don't use hard offset shadows anywhere. The landing page's soft depth scale is the only exception.
- **Don't** set Muted Green-Grey as body copy.
- **Don't** round receipts or bands, or square off cards and controls.
- **Don't** place a small uppercase label above a headline. Uppercase belongs to printed artefacts and status: the receipt header, the fuel credit card's face, and status chips such as DECLINED.
- **Don't** replace the kit's 1.5px line icons with glyphs or emoji.

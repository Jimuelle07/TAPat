---
name: TAPat
description: Fuel aid that can say no, set in the ruled paper, arcs and field colours of the TAPat Mobile App UI kit.
colors:
  primary: "#2e6f55"
  primary-deep: "#29664e"
  pressed: "#1f5540"
  pass-forest: "#163d2f"
  pass-green: "#1f4d3c"
  pass-pressed: "#133427"
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
  auth-book:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    rounded: "16px"
    padding: "0 56px"
  officer-pass:
    backgroundColor: "{colors.pass-forest}"
    textColor: "{colors.surface}"
    typography: "{typography.mono}"
    rounded: "16px"
    padding: "44px 44px 40px 52px"
  auth-button:
    backgroundColor: "{colors.pass-green}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    height: "54px"
  auth-button-pressed:
    backgroundColor: "{colors.pass-pressed}"
---

# Design System: TAPat

## Overview

**Creative North Star: "The Ruled Receipt"**

TAPat looks like a document that can be checked. Cream paper, ink rules at one weight, and amounts on ledger lines carry the system; in the app a large arc and a set of corner rings in a green, mustard, terracotta or ice blue field give it warmth. The identity comes from the TAPat Mobile App UI Figma file, generated by `design/figma-plugin` on the "TAPat Kit 2 - Clean Fintech" brandkit. The app remains its incumbent expression.

The app is dense and phone-sized: a 390px screen, 20px gutters, stacked ruled cards. The landing page is a separate editorial ledger, evolved: the same Cream with 1px Ink rules and one cover photo, made bolder with an oversized kinetic headline, bento grids, one deep ink-green band for "How it works", subtle paper grain, staggered scroll reveals, refined button micro-interactions and a giant footer wordmark. It has no gradients as decoration, no glassmorphism and no shadows. Its type is IBM Plex, set by `doc-*` classes scoped to `.landing`.

Depth is mostly line, not shadow. Colour names a state before it decorates: a terracotta field means a refusal, an ice blue field means a freeze. On the landing page, apart from the cover photo, the Anatomy figures, the agent illustration cards and the deep ink-green band, colour appears only in text links.

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
- **Field Green** (#2e6f55): Filled buttons, selected filter chips, the active tab disc, chart price line, focus ring, the arc on Forest, and the landing page's text links.
- **Pressed Green** (#1f5540): Hover and active state of filled buttons, including the landing button, and the rings on green grounds.

### Secondary
- **Mustard** (#f7b93e): The "Velo verified" chip, the chart threshold line and the tap scene's card.
- **Pale Mustard** (#fbd88f): The tap scene's card and finished LED, and the chart's fire-score fill.
- **Ring Mustard** (#c98f1e): The tap scene's card chip and ripple, and the chart's fire-score line.

### Tertiary
- **Terracotta** (#c8552f): The border of a field in error and the tap scene's error LED.
- **Terracotta Tint** (#f6dfd3): The fill of a field in error.
- **Alarm Red** (#c0392b): The filled status chip for declined, refused and failed, and the landing page's DECLINED status. It carries Cream text in the app.
- **Ice Blue** (#bfe6f7): Frozen only: the frozen chip, the frozen notice.
- **Mint** (#d8e7df): Healthy status chips, secondary and tertiary button hover.

### Neutral
- **Ink** (#1b2e28): All body text, all default rules and borders, the landing button's fill, and the landing page's text selection.
- **Muted Green-Grey** (#5c6b65): Inactive tab icons and labels, and input placeholders. Never body copy.
- **Cream** (#fbf5e3): The app screen, the sheet, the landing page's ground and header, and text on dark grounds.
- **Raised Paper** (#fdfaf0): Cards, list cards, receipts, secondary buttons, the tab bar, and the landing page's title panel.
- **Sunken Cream** (#f2e8cc): The page behind the app, disabled buttons, skeletons and the arc in cream cards.
- **Ring Cream** (#e3d6b2): Corner rings on cream grounds, and the landing page's rules between table and list rows.

### Named Rules
**The Kit Meaning Rule.** A colour field keeps its meaning at every scale. Terracotta Tint is a refusal, Ice Blue is a freeze.

**The Ground-and-Arc Rule.** App stat cards pair a ground with one fixed arc and ring colour: Forest with Field Green and Pressed Green, Cream with Sunken Cream and Ring Cream. Don't invent new pairs.

**The Colour-for-Status Rule.** On the landing page colour appears only in text links (Field Green); there is no status component. The rest is Ink on Cream.

## Typography

**Display Font:** Outfit (with ui-sans-serif, system-ui, sans-serif)
**Body Font:** Outfit (with ui-sans-serif, system-ui, sans-serif)
**Label/Mono Font:** Azeret Mono (with ui-monospace, monospace)

**Character:** Outfit is round and friendly, and it keeps a serious subject approachable. Azeret Mono reads as a printed ledger, so anything set in it looks checkable.

**Landing page only:** IBM Plex Sans (400, 500, 600) sets words and IBM Plex Mono (400, 500) sets amounts, contract calls and ledger lines, on the same Cream ground. Both carry ₱, so the landing page writes ₱ where the app keeps the "PHP" label. `.landing` redefines `--font-sans` and `--font-mono`, so any shared drawing renders in Plex there. The app keeps Outfit, Azeret Mono and the "PHP" label.

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
- **Doc H1** (600, clamp(34px, 4.2vw, 54px), 1.08, -0.015em, balanced): The base headline style; the hero headline overrides it with the Kinetic Headline size (clamp(34px, 3.8vw, 56px), 1.02, -0.03em).
- **Doc H2** (600, clamp(24px, 2.4vw, 30px), 1.2, balanced): Section headings, both lines.
- **Doc H3** (600, 19px, 1.3): Subsection and agent titles.
- **Doc Lead** (400, clamp(18px, 1.5vw, 20px), 1.5, pretty, at most 60ch): The paragraph under the headline.
- **Doc Small** (400, 14px, 1.45): Captions, sources, footnotes, prototype notes and the footer.
- **Doc Mono** (Plex Mono 400, 14px, 1.5, tabular): Amounts, contract calls and ledger lines on the landing page.

### Named Rules
**The Word-and-Ledger Rule.** Outfit sets words, stat tiles and headline figures. Azeret Mono sets anything a reader might check: amounts on ruled lines, transaction references, thresholds and contract calls. The direction contract asked for Azeret on all amounts; the build, matching the Figma card-value style, keeps tiles and display figures in Outfit, and that is the system.

**The PHP Label Rule.** Azeret Mono has no ₱ glyph, so app amounts are spelled "PHP 1,500.00", the label the kit itself uses. The landing page is set in IBM Plex, which carries ₱ in its latin-ext range, so it writes "₱1,500.00".

## Layout

The app is one column, capped by the 430px sheet and tab bar and framed on desktop by the phone mockup from `md` up. Screens use 20px gutters, a 16px vertical stack, 16px card padding, and 12px between stat cards. Tap targets are at least 44px and primary buttons are 54px tall.

On the landing page, content sits in a container of at most 1200px with a fluid gutter of `clamp(20px, 4vw, 48px)`. Sections are separated by a 1px Ink rule or by the band's edge, with 64px vertical padding, 80px from `lg` (96px for the band and the simulation).

The header is a floating pill fixed 12px from the top, and in-page links scroll with a 6rem offset so a heading stays visible below it. The title block is a 12-column grid: the panel takes 7 columns and `HeroFilm` 5, both overlapping the photo; there is no Contents list and the cover carries no caption. "The problem", "How it works" and "Diesel simulation" are centred: a centred heading and lead above full-width content. "The problem" and "Prototype notes" are Cream with a 1px Ink rule above; "How it works" is a full-bleed ink-green band with 64px (96px from `lg`) vertical padding; "Diesel simulation" is plain Cream.

## Elevation & Depth

A hybrid that is mostly flat. Layers separate by 1.5px ink lines (1px on the landing page) and tonal paper steps (Sunken Cream, Cream, Raised Paper). Soft shadow appears only on filled app controls that invite a press and on the one surface that floats over the page. The app's phone frame is a raster overlay above the screen and is not a shadow.

### Shadow Vocabulary
- **Button** (`box-shadow: 0 2px 4px rgb(27 46 40 / 0.3)`): Filled app buttons and the active tab disc.
- **Sheet** (`box-shadow: 0 -4px 24px rgb(27 46 40 / 0.18)`): The bottom sheet, over a `rgb(27 46 40 / 0.45)` backdrop.
- **Book** (`box-shadow: 0 1px 1px rgb(20 40 32 / 0.08), 0 10px 20px -8px rgb(20 40 32 / 0.2), 0 34px 70px -28px rgb(20 40 32 / 0.42)`): Log in and sign up only: under the passbook's page block, and on the phone's pass strip and form card.
- **Auth Button** (`box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.14), 0 2px 3px rgb(19 52 39 / 0.25), 0 10px 18px -8px rgb(19 52 39 / 0.6)`): The submit button on log in and sign up.
- **Recess** (`box-shadow: inset 0 1.5px 2px rgb(27 46 40 / 0.09)`): The fields and the tab track on log in and sign up.

### Named Rules
**The Ink-Before-Shadow Rule.** Cards, receipts, chips and panels get a rule, not a shadow. If a surface needs separating, draw the line. The landing page follows the same rule with no exception: it has no shadows at all.

**The Passbook Exception.** Log in and sign up are the one place the app adds depth on top of its rules: the open passbook keeps every 1.5px Ink line and adds the Book, Auth Button and Recess shadows above, a shaded spine and light on the pass. All of them are soft and offset; none is a hard block shadow.

## Shapes

Three radii: chips and filter chips at 8px, cards, fields and buttons at 12px, and the sheet's top corners at 20px. Receipts are square, because they are paper rather than controls. Circles are structural: the arc, the rings and the active tab disc. The landing page is the exception: it uses 2px corners on its button and status words, square panels and tables, and fully rounded floating pills.

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
- **Landing Button:** `doc-btn`: 44px tall, 20px side padding, 2px corners, Ink fill with Cream label. On hover or keyboard focus Pressed Green sweeps in from the left behind the label (260ms, `ease-out`), and the optional → arrow nudges 3px right; the second action on the landing page is an underlined Field Green text link whose → nudges the same way. The Field Green focus ring is kept; the sweep and nudge are off under reduced motion.

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
- **Landing Header:** A floating pill, fixed and centred 12px from the top over the cover: Cream and a 1px Ink border, one row 56px tall with fully rounded ends at every size, clipping its contents to that outline. It holds the transparent logo at the left (the home link, `aria-label="TAPat"`, no blend mode; 44px tall below `lg`, 30px tall from `lg`, vertically centred like the links), then from `lg` three plain Ink section links (The problem, How it works, Diesel simulation; 44px tall, underlined on hover, no numbers), an "Agent demo" link (hidden below `sm`) and a fully rounded 44px "Open the app" button. The logo sits behind the links and button. The bottom nav was removed.

### Log In and Sign Up ("The Officer Pass")
`/login`, `/signup` and their `/desktop` twins share `AuthScreen` (`app/(app)/_components/AuthScreen.tsx`), styled by the `ql-auth`, `ql-book` and `ql-pass` rules in `app/quiet-livery.css`. The screen is an open passbook under the moving logo.

- **Scope:** `.ql-auth` sets its own tokens. Words are Outfit and checkable figures Azeret Mono (it overrides the app's Fraunces, Inter and Plex Mono). Primary is Pass Green (#1f4d3c) and pressed is Pass Pressed (#133427), on a Cream (#fbf5e3) ground. The rest of the app keeps its own greens.
- **Road:** the moving logo (the README banner's tricycle: it drives in, then rolls with spinning wheel hubs, a bob, a pitch, speed lines and dust) is 330px wide on a laptop and 240px on a phone, centred over a 1.5px Ink rule at its ground line. Under the rule a dashed strip in Ink at 30% rolls left at the logo's road speed (46px every 460ms), across the full width of the book. The logo's speed lines are Ink at 32% and its dust Ink at 12%; it has no cream outline.
- **Book (900px container and up):** one 1040px cover, 1.5px Ink and 16px corners, split into a 560:480 grid at least 620px tall. Two page edges peek out beneath it (Ring Cream 6px down, Sunken Cream 12px down, each inset a little more), the lower one carrying the Book shadow. The left page is Raised Paper with the form centred at up to 448px; it darkens toward the spine (Ink at 11% over 56px).
- **Form:** the Log in / Sign up control is a Sunken Cream track with a Recess, a 1.5px Ink inner line and 12px corners; the Ink indicator slides on the pop spring and carries a soft shadow. The heading is Outfit 500, 36px (28px on a phone), and the lead is 15px. Fields are 48px tall with 12px corners, a 1.5px Ink border at 60% and a Recess on #fffdf6. Email and password are set in Azeret Mono 16px; the full name and every placeholder are in Outfit. Focus turns the border Pass Green and thickens it by a 1px inset ring. The submit button has 12px corners and the Auth Button shadow. Errors keep the app's terracotta field and alert.
- **Officer Pass (right page):** Pass Forest (#163d2f), shaded toward the spine (black at 34% to nothing over 72px), lit softly from the top left, with a dashed Cream stitch 16px from the spine. Top row: "OFFICER PASS" in Azeret Mono with 0.16em tracking, and an outlined "Testnet" chip. Then the label ("Officer", or "Returning officer" on log in) and the name in Outfit 500 40px with a 1px dark emboss. On sign up the name is the privacy-scoped short form ("Maria S."); until one is typed, and always on log in, it shows "Your name" or "Your pass" at 45% Cream. Ruled Azeret rows follow (Email, Role "Officer", Network "Stellar Testnet", and Session: "Not logged in", "New account", or "Opening" while the request runs). At the foot, "Officers can" lists Upload the masterlist, Enroll drivers and Take payments at stations, each with a check icon. It has no arc and no rings. The pass only repeats what the form holds, so it is `aria-hidden`.
- **Phone (below 900px):** the book comes apart into a pass strip above a form card, both 1.5px Ink with 12px corners and the Book shadow. The strip shows the top row, the name at 26px and one Azeret line, the email followed by "· Officer".
- **Motion:** the book rises on the soft spring (700ms) and the heading re-rises (520ms) when the tab changes; the dashes roll and the logo drives in and rolls as before. All of it is off under reduced motion.

### Receipt
The system's core artefact. Square Raised Paper with a 1.5px Ink border, the cropped logo, a written status chip with its amount, ruled ledger rows, dashed separators and the Tear Edge. A declined receipt shows the reason and no balance.

### Landing Page
The public page at `/` is an unnumbered program brief, not an app screen. It is scoped to `.landing` and styled by the `doc-*` classes in `app/globals.css` and `app/_landing/kit.tsx`; the app's type scale and components do not appear on it.

- **Section Heading:** One English line in `doc-h2`, unnumbered. There is no Contents list; the floating pill carries the section links.
- **Structure:** Floating header pill, cover photo with the title panel and hero figure, The problem (Cream), How it works (ink-green band), Diesel simulation (Cream), an unnumbered Prototype notes bento and the footer with its wordmark. There is no tap demo, ledger, enforcement table, limits table or try-it section.
- **Paper Grain:** A fixed, pointer-transparent `.landing::before` tiles a 160px inline-SVG `feTurbulence` noise at 4.5% opacity over the whole page, so the Cream reads as paper. It never blocks input, sits below the header pill and has no motion.
- **Kinetic Headline:** The h1 keeps its exact text, set in four line spans (`.hl`: "Fuel aid for tricycle" / "drivers, paid by card" / "and held to limits" / "on-chain."). On load each line rises 105% out of its own overflow mask over 800ms (`ease-out`), staggered 70ms by `--i`, starting 80ms in. It is CSS only and gated on `prefers-reduced-motion: no-preference`, so the text is fully visible without JS and under reduced motion. Size is `clamp(34px, 3.8vw, 56px)`, 1.02 line height, -0.03em tracking: four lines at 1440 and 1024; on phones the lines wrap further.
- **Hero:** The cover photo (up to 440px tall) with a 12-column row over it: the title panel (Raised Paper, 1px Ink, `lg:col-span-7`) and `HeroFilm` (`lg:col-span-5`), both pulled 288px up onto the photo and aligned at their tops. Below `lg` the figure stacks under the panel. `HeroFilm` renders the dispenser figure (`app/_landing/figures/dispenser/`), **Fig 1, "TAPat in one breath"**: a roadside fuel-aid dispenser cabinet drawn open, whose motion is the TAPat story in four beats (`BEAT_NAME`): "Price rolls up" (a drum of number wheels rolls past the dashed ₱65.00 mark; a weighted lever climbs a notched quadrant one notch per day the price holds), "Gate lifts" (a latch lets go on the fourth day and three cards fill with ₱1,500 each), "Two taps" (a card reader with a mechanical stop at ₱500 accepts a ₱300 tap, PAID, and refuses an ₱800 tap, DECLINED, because the stop blocks its plunger) and "Funds return" (₱4,200, the ₱4,500 funded less ₱300 spent, empties into an LGU lockbox). Data: sample numbers only, from the demo program (₱65.00 trigger, ₱1,500 per card, ₱500 per-tap cap), the price path of the "staircase" scenario in `scenarios.json` (days 24–28), and the two invented taps; the plate caption reads "Illustration with sample numbers, on a simulated price path." Interaction: the figure is one focusable control. Hovering with a mouse engages it; a click, Enter, Space, → or ↓ jumps to the next beat, ← or ↑ to the previous, Home and End to the first and last, and touch advances a beat per tap; the plate's corner hint and readout and a polite live region carry the beat as text, and the full machine is described in the SVG's label. It loops while on screen and pauses off-screen (IntersectionObserver); under `prefers-reduced-motion: reduce` it stays a still resting frame and only steps when the visitor does. The photo has no credit chip; the actions are the Ink button (with a nudging → arrow) and the "Run the agent demo" text link.
- **Anatomy Figures:** The landing page's technical illustrations (hero, scenario player, diesel simulation, the four problem tiles, the build flow) are isometric "Anatomy" figures: an object whose parts move to mean something, drawn on a labelled plate (`Plate` from `app/_landing/iso/react/draw`: Fig number, title, corner hint and readout, optional key and caption). They are built with the vendored Anatomy kit in `app/_landing/iso/` (MIT, https://github.com/wheresryan22/anatomy, commit `1482e8469b0a9e0d8cc18ea2740a01423d29ae80`, recorded in `iso/README.md`; never edited locally, re-vendor instead), and each lives in `app/_landing/figures/<name>/` (`figure.tsx` the server plate, `model.ts` the pure truth the figure draws and prints, `live.tsx` the client animation), wrapped by the thin components `HeroFilm`, `ScenarioPlayer`, `DieselSim`, `ProblemFilm` and `BuildFlowFilm`. The theme is the kit's light theme on Cream (`data-theme="light"`); only the drivers tile (Fig 2.1) is dark, to sit on its Ink tile. Each figure is verified with the kit skill's line check (it must print `line ends: 0`) and its geometry audit (`audit.ts` beside the assembly, dispenser and mixer figures only; the recorder and problem figures were audited with throwaway scripts). Static art is rendered on the server and shipped as compact path strings (`figures/compact.ts`: relative commands, one decimal, lossless at 0.1), so the markup is real before JavaScript runs; the live component animates only the moving parts by writing attributes, with no React state per frame. Every figure reserves its plate's footprint, pauses off-screen and while the tab is hidden, shows a still resting frame under `prefers-reduced-motion: reduce`, and describes itself in an `aria-label` on the SVG. Money is formatted on the server with the site's helpers. Any new figure follows the same rule.
- **Bento Tiles:** `.tile`: Raised Paper, 1px Ink, 2px corners, 24px padding, no shadow; `.tile-ink` inverts it (Ink fill, Cream text) for the one lead tile. Grids use a 16px gap.
- **Scroll Reveals:** `Reveal` (`app/_landing/Reveal.tsx`) fades an element in with a 12px rise over 600ms, once, staggered by sibling `delay` (bento tiles in 70ms steps). It sets `data-reveal="pending"` on the DOM only when the element starts below the fold and `"in"` when an IntersectionObserver sees it; with no JS, under reduced motion, or already on screen, the content is simply visible. It uses no React state. Reveal Choreography: the problem matrix rows slide in from 28px left instead of rising; every section heading (`SectionHeading`, via `Reveal draw`, which uses `data-draw` instead) draws a 48px, 2px underline in its current colour left to right over 700ms after the heading is seen.
- **Ink-Green Band:** `.band`: a full-bleed #16261f ground with Cream (#fbf5e3) text, about 15:1 contrast. Content inside sits on Cream cards (`.band-card`, Ink text, 2px corners) or outlined tiles (`.band-outline`, 35% Cream border, Cream text). Links on the dark are Mint; inside a card they return to Field Green. Focus rings are Cream on the dark and Field Green on a card.
- **Remotion Rule:** Remotion (`remotion` and `@remotion/player`) is used only for the two agent scenes; every other landing figure is an Anatomy figure (see Anatomy Figures). The agent scenes go through one wrapper, `RemotionStage` (`app/_landing/remotion/Stage.tsx`), and Remotion is never in the page's initial JavaScript: it is loaded lazily when the agents section nears the viewport. The wrapper renders a box that reserves the composition's aspect ratio (so nothing shifts) with a ruled skeleton; an IntersectionObserver (`rootMargin` 150% vertical) loads `@remotion/player` and `AgentComposition` with a dynamic `import()` only when the box is within about 1.5 viewports of the screen, then caches the modules so remounts do not flash the empty box. Static values the page needs up front (sizes, fps, durations, still frames) live in `remotion/agentMeta.ts` so the page never imports `remotion` directly, and `AgentArt.tsx` uses a local colour blend instead of `interpolateColors`. It is never server-rendered because Remotion's `Thumbnail` reads `Date.now()` during render and the app prerenders with `cacheComponents`. The `Player` autoplays muted, with no controls, and loops. An IntersectionObserver and `visibilitychange` pause it when it is off-screen or the tab is hidden and resume it otherwise. Under `prefers-reduced-motion` it shows a `Thumbnail` of a chosen still frame instead and never mounts the Player. Compositions are deterministic functions of the frame (no `Math.random`, no `Date`). Physics motion stays hand-built: the nav tricycle (rAF, see Logo Brake-In). Scroll-triggered UI (count-up, reveals) uses IntersectionObserver with CSS or rAF and does no layout reads on mount.
- **The Problem:** A centred heading and one centred lead sentence, then a bento of the four cited figures (text, not computed): 723,000 is the large lead tile (Ink fill, Cream text, a figure up to 108px in Plex Mono) spanning two rows in a `1.25fr 1fr 1fr` grid, ₱2.7B and ₱709.88M sit beside it, and "In person" spans the two columns beneath. Each tile opens with an art area bleeding to its edges, ruled off from the text, that holds a small Anatomy figure through `ProblemFilm` (`app/_landing/figures/problem/`, one `kind` per tile, each with its own `model.ts`, `art.tsx`, `live.tsx`; plate title "illustration", the Fig number and a live readout in the plate corners), then the figure, one line of meaning and a small source line. The four figures are illustrations of the cited number, not data, and have no pointer or key interaction: **Fig 2.1** `drivers` (723,000; drawn dark on the Ink tile) is a peg board that fills one peg per 1,000 drivers, 723 pegs in rows of 31, holds, and fades to refill; **Fig 2.2** `leak` (₱2.7B) is a hopper whose coins fall past three drawers, the readout carries the cited ₱2.7B and a progress word (draining, then drained to ghost drawers), no invented number; **Fig 2.3** `unpaid` (₱709.88M) is a safe whose pusher plate shoves coins out through an outlet and down a chute into a box over 24 months, the unpaid amount returned after two years; **Fig 2.4** `queue` (In person) is a line of eight people under a sun lamp, the front person leaving and rejoining at the back, one step at a time, its readout words only (no numbers). Each is light on Cream except `drivers`, rests on a fixed still frame under reduced motion (and for the server render) and animates only while its tile is on screen. Tiles lift 2px and take a Field Green border on hover (160ms, motion-safe). The first three figures count up from 0 once, when scrolled into view (`CountUp`: 1.4s, width reserved so nothing shifts, the final text as the accessible label, shown at once under reduced motion); "In person" stays static text. Below the bento, "What goes wrong" and "What TAPat does" form a clean two-column list joined by → arrows (stacked, with inline labels, on mobile), ruled in Ring Cream; each row slides in from the left as it reveals. The `doc-table` class is gone.
- **How It Works:** The deep ink-green band (see Ink-Green Band): a centred heading and lead ("Watch the Tranche Agent decide. Each visit plays one of five diesel scenarios."), `ScenarioPlayer` on a Cream card (the recorder figure, which replays one of five precomputed diesel-rise scenarios per visit, from the output of the real agent code; see Scenario Player), then a centred "The agents" subheading with `Agents` on a Cream card (two illustration cards, the Tranche Agent and the Freeze Agent; see Agent Cards), then the Masterlist check and the Noir payment contract as two Cream cards with what each decides, its method, research (author, year, venue, link) and key settings. Last, a centred "How it's built": `BuildFlowFilm` (the assembly figure of the eight-step flow, see Build Flow) at full width on a Cream card, then the eight steps as a bento of Cream cards joined by a thin Cream line (vertical on mobile, horizontal where cards sit side by side), then the four layer lines as outlined tiles. Step and layer wording is unchanged, including that Velo verifies the budget checkout and sponsors network fees but not individual taps.
- **Agent Cards:** Each card is a 1px Ink, 2px-corner Raised Paper box holding an Anatomy plate (light theme, `app/_landing/figures/agents/`, **Fig 6** Tranche Agent and **Fig 7** Freeze Agent: Fig number, title, hint "Simulated · hover or tap" and a live readout in the corners), then the agent name and its one-line job. The plate is played by Remotion (`AgentComposition`, 640×350, 30 fps, through `RemotionStage`): the composition maps `useCurrentFrame()` to a pure model state and draws it with prebuilt kit strings. The static art is built once by `figures/agents/build.ts` (which also runs the kit audit and writes `tranche.gen.ts`, `freeze.gen.ts`, `remotion/agentMeta.gen.ts`); the client imports only those strings and per-frame math, never the geometry builders. The **Tranche** bench is a 12 s loop over days 20–37 of the precomputed "volatile" scenario: a cursor climbs a ₱ scale past the ₱65 line, a carriage on a rail follows the changepoint probability to the 0.9 stop, four plungers rise as the new level holds, a dial counts days, and when all three tests hold (day 36) three keys lift, a gate bar rises and three ₱1,500 tokens slide into three cards, then it resets. The **Freeze** bench is a 12 s loop replaying the committed honest history and burst fixtures through the real MIDAS-F code (2×1024 Count-Min Sketch, decay 0.6, threshold from `config/midas.json`): simulated taps ride a lane past a sensor, sketch columns rise and decay, a dial needle follows the score toward the threshold line, and when the burst crosses it a lamp lights and a shutter drops on the station, then it resets. The reduced-motion still is a `Thumbnail` at the `still` frame in `agentMeta.gen.ts`. On hover, keyboard focus or tap the explanation panel (method, research links, settings) fades and slides up over the lower part of the card in 200ms, the drawing shrinks into the strip above it and the Player pauses, so the machine stays visible; closing reverses it. The card does not change size. A real button carries `aria-expanded` and `aria-controls`; the hidden panel is `inert`. The scene pauses while the card is off-screen or the tab is hidden. Under `prefers-reduced-motion` nothing plays or transitions. The geometry lives in plain `app/_landing/agents.css` with `agent-` and `ag-` prefixed classes, because `next.config.ts` routes all CSS through the Tailwind loader as global CSS.
- **Scenario Player:** `ScenarioPlayer` renders the recorder figure (`app/_landing/figures/recorder/`), **Fig 3**, titled with the scenario's own name (Crude rally, Staircase, Volatile, Peso slide, Supply shock): a strip-chart recorder on a bench in which a pen on a carriage draws each day's simulated diesel price on a roll of ruled paper, above or below a taut ₱65.00/L wire; a ratchet wheel steps one tooth for each day the price closes at or above the wire and springs back on a dip, a dial shows the changepoint probability (reading "warm-up" over days 1–10) and number wheels count the day. On the scenario's `fireIdx` day a solenoid lifts the stop bar and the ₱1,500 tokens (one per card) slide down a chute into the card trays. Data: each visit plays one of the five precomputed scenarios from `app/_landing/scenarios.json`, whose release decisions came from the real Tranche Agent code (Bayesian Online Changepoint Detection); the recorder replays them and decides nothing. The scenario is chosen at random on the first client read and never the same as the previous pick in that browser tab (kept in `sessionStorage`); before the pick lands, an empty bordered box with the plate's aspect ratio holds the place, and the recorder's art loads as its own chunk (`dynamic`, no SSR). Plate: hint "Move across or use ← → to step days", a three-line key, and a caption giving "Scenario N of 5", that prices are simulated and the day and reason of the precomputed release. Interaction: it plays on its own; a mouse moving across the plate scrubs to the day under the pointer, touch drags the same way (pointer capture), ← → step days, Home and End jump, Space or Enter resume the tour; it pauses off-screen and shows a still near the end (release done, tokens in their trays) under reduced motion. The SVG's label and caption carry the scenario's story, the shift day, the release day and the agent's reason.
- **Diesel Simulation:** Back on Cream: a centred heading and lead sentence, then `DieselSim` at the full container width, which renders the price-mixing machine (`app/_landing/figures/mixer/`), **Fig 5, "A simulated year of diesel"**. The machine solves the pump-price formula with parts: a float lifts a lever for crude and the peso rate slides a carriage along it (the product), a balance arm adds the excise and margin weights (the sum), a rack and a 28-to-25 gear pair multiply by VAT, and the last shaft swings a pointer over a ₱/L scale; a counter copies the price only when the calendar cam lets it, on a Tuesday. Data: `lib/diesel-sim.ts` (`simulateDieselYear`, `pumpFromBenchmark`), so the figure cannot disagree with the simulator; one invented year per seed, seed 1, 2, 3 and on, advancing each pass. Plate: hint "Hover to hold · click or ← → to step", a four-line key, and a caption stating it is simulated, not DOE data, with the formula and the ₱65.00 demo trigger. Interaction: it plays a year by itself; hovering with a mouse holds it; click or ← → (Shift for four weeks) step weeks, Home and End jump, Space or Enter hold or play, Escape releases (`role="slider"`). It pauses off-screen and under reduced motion shows the resting still and moves only on the visitor's input. It is labelled simulated, not DOE data.
- **Build Flow:** `BuildFlowFilm` renders the assembly figure (`app/_landing/figures/assembly/`), **Fig 4, "How it's built"**: a conveyor with eight numbered stations (01 to 08), along which the ₱1,500 tranche rides as three ₱500 chips, with a dashed freeze signal running to the `claim()` latch. The motion is the flow of the eight steps. Data: the numbers and sentences come from `scenarios.json` (the precomputed "crude-rally" run of the real agent code) and the program defaults (₱500 per-tap cap), read on the server (`truth.ts`); the readout speaks each station. Plate: hint "Hover or ← → to step · F freezes the card", a three-line key, and a caption that agents decide and the Noir contract on Stellar Testnet has the last word, that Velo verifies the budget checkout and sponsors network fees but not individual taps, and that the price feed is simulated. Interaction: it tours by itself; hovering with a mouse or focus takes control, ← → step stations, Home and End jump, F (or a tap at the freeze station) shows a frozen card held at the latch, Space or Enter stop or resume the tour, Escape resumes. It pauses off-screen and shows the resting frame under reduced motion.
- **Prototype Notes:** A small heading and a compact bento of `.tile` notes (three columns from `lg`, the Testnet and demo-rate note spanning two) with the honesty labels: Testnet only, demo rate, simulated and precomputed data, what Velo does and does not verify, and the stock cover photo.
- **Footer:** `<footer id="footer">`, Cream under a 1px Ink rule, four columns that stack on mobile: logo and one line, On this page, App, Credits; then a `doc-small` copyright row. Every link is a 44px touch target. Under the copyright row sits the giant wordmark: "TAPat" in Plex Sans 600 at `clamp(96px, 18vw, 280px)`, tight tracking, Ink at 9% opacity, centred, `aria-hidden`, clipped flush to the footer's bottom edge (the real logo above it carries the name).
- **Cover:** One full-bleed documentary photo of a motorized tricycle, with no overlay, scrim or caption chip, in a band `clamp(200px, 34vw, 440px)` tall so it supports the page rather than dominating it. Under `prefers-reduced-motion: no-preference` it moves in two ways (`CoverMotion` in `Reveal.tsx`): a slow Ken Burns on the image (scale 1 to 1.08 with a slight pan, 24s, `ease-in-out`, alternating) and a gentle scroll parallax, where the image layer starts 40px above the band and drifts down by 12% of the scroll distance up to 40px, so the photo trails the page. A passive scroll listener writes one CSS variable (`--cover-y`) per animation frame; there is no state. Under reduced motion the photo is still. The photo credit lives in the footer ("Cover photo: Denniz Futalan / Pexels") and the Prototype notes say the cover is a stock photo. The title panel (Raised Paper, 1px Ink border) and the hero figure overlap the photo's bottom edge by 288px from `lg`; below `lg` they stack under the photo.
- **Motion:** Figure motion is Anatomy (see Anatomy Figures): the hero dispenser, `ScenarioPlayer`, `DieselSim`, the four problem figures and the build-flow figure, each paused off-screen and when the tab is hidden, reserving its footprint and showing a still resting frame under `prefers-reduced-motion: reduce`. The two agent scenes are the only Remotion (see Remotion Rule), with the same pause and a `Thumbnail` still. CSS covers the headline rise, the scroll reveals (see Reveal Choreography), the cover's Ken Burns and parallax, tile hover lifts, the button sweep and the agent drawing shrink. The nav logo also moves, by rAF physics rather than Remotion: one brake-in on load, and it drives off to the right when "Open the app" is clicked. The problem figures loop while on screen; only the three `CountUp` figures count up, once. Everything is off or static under reduced motion.
- **Logo Brake-In:** Once on load, 250ms after the page is interactive, the nav logo (`NavTricycle`) drives out from behind the pill's left edge (the pill clips it to its rounded outline) and brakes into its slot over about 1.1s. A small simulation drives it: constant braking over 92px, with the body on a damped spring that dips the nose about 4–5° (pivoting on the front tyre's ground contact, 86.5% across) and rocks back once (about 1°, pivoting on the rear tyre's, 18.8% across) before settling, about 2.2s in total. The ground shadow is a soft CSS contact shadow, not part of the image: an Ink radial-gradient ellipse under the wheelbase, on the ground line. It slides with the tricycle but never tilts; while the body pitches it draws in toward the wheel still on the ground (down to 85% width) and lightens (down to 70%). Under reduced motion there is no brake-in.
- **Logo Drive-Off:** A plain left click (or Enter) on the pill's "Open the app" button, at every breakpoint, is intercepted: the logo accelerates right from wherever it is at a constant 5000px/s² (speed clamp 1400px/s; pitch target −0.0018° per px/s² of acceleration, so −9°, nose up, so it squats noticeably), passes behind the button and leaves through the pill's clipped right edge. It is never mirrored (the lettering would flip) and keeps the non-rotating contact shadow. The page then navigates to `/login` with the router, as soon as the logo is out or after 900ms at most. Ctrl, Cmd, Shift, Alt and middle clicks keep normal link behaviour (new tab, new window). Under reduced motion it navigates at once. The hero's "Open the app" button is a plain link. The body model (pitch spring, pivots, shadow) and the drive-off model live in `app/_landing/tricycle-physics.ts`.

### Asset Sources
`public/phone-frame.png` and `public/tapat-app-icon-1024.png` are pre-existing project assets supplied by the team. The icon is the TAPat brand logo; the frame was added in commit 813b290. They were deliberately not re-stamped with embedded provenance, because both are shared with the app.

`app/_landing/cover-tricycle-negros.jpg` is Pexels photo 4330929, "Old Tricycle on Street in Philippines", by Denniz Futalan (Negros Island Region), used under the Pexels License. It is a stock photo, not a TAPat driver or station, and the footer credits it and the Prototype notes call it a stock photo.

`app/_landing/logo-tricycle.png` is one transparent cut-out of `public/tapat-app-icon-1024.png` for the landing nav only. The icon's flat cream ground is removed (flood-filled from the edges and from the pocket under the chassis, with anti-aliased edges), and so is the icon's hard ink ground stroke: below the ground line only the two tyres are kept, using circles fitted to each tyre's edges, so the tyre bottoms stay round. The image is trimmed and scaled to 176px tall. The cream inside the drawing (cab, hubs) is kept. The app keeps the original icon.

## Do's and Don'ts

### Do:
- **Do** take every colour, radius and type size on app screens from the Figma-derived tokens in `app/globals.css`. The landing page takes colour and radius from the same tokens and sets its type with the `doc-*` classes, which are scoped to `.landing`.
- **Do** draw rules at 1.5px in the app and 1px on the landing page, in Ink on paper.
- **Do** spell amounts with the "PHP" label in the app wherever they are set in Azeret Mono. The landing page sets amounts in Plex Mono with ₱.
- **Do** write status out in a chip or sentence alongside any status colour. On the landing page, status appears only in written words in the figures.
- **Do** label simulated data "simulated" and precomputed model output "precomputed" on the page.
- **Do** place the logo in the app's top bar and sidebar on Cream or Raised Paper, using the original `public/tapat-app-icon-1024.png` cropped to the icon's middle band, since it blends with `mix-blend-mode: darken`. The landing nav instead uses the transparent `app/_landing/logo-tricycle.png` with no crop or blend, and log in and sign up use the moving `public/tapat-logo.png` with spinning wheel hubs.
- **Do** gate motion behind `prefers-reduced-motion: no-preference`. On the landing page that is the headline rise, scroll reveals, heading underline draws, the cover's Ken Burns and parallax, tile hover lifts, the button sweep, the Anatomy figures (each paused off-screen and while the tab is hidden, a still resting frame under reduced motion), the two Remotion agent scenes (a still `Thumbnail` under reduced motion) and the nav logo (one brake-in on load, and the drive-off on "Open the app").
- **Do** credit the cover photo to Denniz Futalan / Pexels in the footer, and call it a stock photo in the Prototype notes. There is no caption chip on the cover.

### Don't:
- **Don't** use Ice Blue for anything but a freeze, or Terracotta and its tint for anything but refusal and invalid input.
- **Don't** set the ₱ glyph in Azeret Mono.
- **Don't** give cards, receipts, chips or the landing page's panels a shadow (the passbook on log in and sign up is the one exception), and don't use hard offset shadows anywhere.
- **Don't** set Muted Green-Grey as body copy.
- **Don't** round receipts, or square off app cards and controls.
- **Don't** add looping motion on the landing page outside the Anatomy figures (hero dispenser, recorder, price-mixing machine, the four problem figures, the build-flow figure), the two Remotion agent scenes, the cover's Ken Burns and the nav tricycle, and don't add gradient scrims or abstract art. Scroll motion is limited to count-up, the 12px reveal rise (and the matrix rows' slide from the left), the heading underline draw and the cover's parallax.
- **Don't** place a small uppercase label above a headline. Uppercase belongs to printed artefacts and status: the receipt header, the fuel credit card's face, and status chips such as DECLINED.
- **Don't** replace the kit's 1.5px line icons with glyphs or emoji.

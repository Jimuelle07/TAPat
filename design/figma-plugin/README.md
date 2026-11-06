# TAPat UI Builder (Figma plugin)

Generates the TAPat mobile UI in a Figma file: tokens, text styles, components, every screen state, and prototype links. Screen content comes from `docs/api-and-data.md` and `docs/PRD.md`. The look comes from the "TAPat Kit 2 - Clean Fintech" brandkit.

## Run it

Needs Figma desktop and edit access to the file.

1. Open the target file in Figma desktop.
2. Copy the primary logo from the brandkit, paste it into the target file, and leave it selected. Without a selected logo, a text placeholder stands in.
3. In the Figma menu, go to **Plugins → Development → Import plugin from manifest** and pick `manifest.json` from this folder. You only do this once.
4. Go to **Plugins → Development → TAPat UI Builder** and press **Build**. It can take a minute or two.
5. Read the report in the plugin window. To try the prototype, open the **Screens** page and press Present on a flow.

To apply a code change, run the plugin again. Each run replaces only what the plugin built, so hand edits to generated layers are lost, while your own separate layers stay. The saved logo is reused.

If the Figma plan limits pages, some sections share a page and the report says so.

## Check it without Figma

```bash
node smoke-test.js preview.html
```

This runs `code.js` against a strict stand-in for the Figma API. It checks prototype links, 390×844 frames, layer names, text contrast of at least 4.5:1, at most one mustard element per screen, Terracotta used only for declined taps, and that a re-run replaces its own output and leaves other layers alone. `preview.html` is an optional rough browser view of the screens, and it doesn't show the logo.

The stand-in only enforces the API rules this plugin relies on, so the real run in Figma is the final check.

Northern Pines Construction Services (NPCS) builds roofs, windows, doors, siding and gutters in central Indiana. The site should feel like the brand photo: pine forest, low fog, a wet grey morning. It's calm and dark, with cream type and one muted lichen-green accent for the action that matters. Use this system for the website, the Visualizer, Sketch & Spec and Estimate tools, social cards and estimates.

## Voice and content

- Plain, local and confident. Write like the owner talking to a homeowner in the driveway. Use "we" for NPCS and "you" for the homeowner.
- Lead with the outcome and the offer. Real lines from the brand: "Home improvement specialists in Roofing, Windows, Doors, Siding, and Gutters." "Get in touch for free Inspections and Estimates." "Windows winter can't touch." "Installed by our own crews."
- Use sentence case for headings, buttons and labels. Uppercase is only for the `eyebrow` style.
- Make buttons verb-first: "Get a free estimate", "Schedule inspection", "See our work".
- Write numbers and specifics as numerals: "2 days", "(765) 376-1197", "central Indiana".
- No emoji, exclamation stacks or invented stats. Use only real reviews, attributed with first name and town.

## Color

- The default theme is **Forest (dark)** (`data-theme="dark"`). **Fog (light)** (`data-theme="light"`) is for long reading pages, forms and printed estimates.
- Page ground is `surface-100`. Cards and panels use `surface-200`, inputs and hover states use `surface-300`, and the footer uses `surface-000`.
- Set all text in `ink`, and secondary text in `ink-muted`. Both hold at least 4.5:1 on every surface in both themes.
- `pine` is the brand green and stays the same in both themes. Use it for the header, the footer and dark bands in light layouts, with `on-pine` text on top.
- `lichen` is the only accent fill: one primary button per view, with text in `on-lichen`. Links, eyebrows and prices use `lichen-text`. Don't use lichen for large backgrounds.
- `mist` is fog and is only decorative: bands, placeholder media, illustration fills. Never use it for text.
- Status colors always come with a word. `status-success` is rain blue and `status-danger` is rust orange, so the two never depend on telling red from green.
- Any section on the fog-pines photo or on `pine` gets `data-theme="dark"`, so the accent and the focus ring resolve to their forest values even in the light theme.

## Type

- Set headlines in **Cinzel** (`display-xl`, `display-l`, `heading`). It's the closest open-licence match to the logo's carved-caps wordmark. Use it for headings only, never for paragraphs, buttons or form text.
- Everything else is in **Inter** (`title`, `body-l`, `body`, `small`, `button`, `eyebrow`). That's the typeface the Linktree uses.
- Scale on phones: `display-xl` goes to 40px and `display-l` to 28px. Body text never goes below 16px.
- Set eyebrows in `eyebrow`, uppercase and in `lichen-text`, above a Cinzel heading.

## Space, shape and depth

- Use the 4px steps `space-1` to `space-24`. Cards are padded `space-6` (`space-4` on phones), card grids have `space-6` gaps, and sections are padded `space-16` (`space-12` on phones).
- Corners: `radius-md` for buttons and tiles (the Linktree's rounded-large), `radius-lg` for cards and photo frames, `radius-sm` for inputs and badges, and `radius-full` for the round logo badge.
- Separate things with a `line` border, not a shadow. `shadow-lift` is only for things that float, such as menus, dialogs and a sticky estimate bar.
- Glass is the one effect: `glass` fill plus `blur-fog` backdrop blur, only on top of the photo (see LinkTile).
- Focus: a 2px solid `focus-ring` outline with a 2px offset on every interactive element. It holds at least 5.9:1 on every surface.
- Motion is slow and quiet: 160–240ms ease-out fades and color changes. No bouncing or parallax. Respect `prefers-reduced-motion`.

## Imagery

- The hero photo is the fog-pines photo (Photography group). Put it behind `.np-photo`, which adds `scrim-photo` so cream text stays legible. Keep the trees in the lower half and put text in the foggy top.
- Use real NPCS job photos for projects, before/afters and services. Prefer overcast light and natural color, with no heavy filters. Before/after pairs sit side by side, with a 2px `lichen` divider.
- Don't use stock photos of smiling contractors, or illustrations of tools.

## Logo

- The logo is the NPCS badge from the Logos group: pine peaks over three rooflines with "Northern Pines Construction Services" on black. Show it as a circle (`radius-full`) at 44px in the header and 88px or larger elsewhere, on `pine` or on the photo.
- Don't redraw, recolor or crop the wordmark. Don't place it on `surface-100` in the light theme, because the black square shows. Use it on `pine` there.
- When the badge is too small to read, set "Northern Pines" in Cinzel next to it.
- For wide spaces, use a ready-made banner from the Banners group: the logo, cut out of its black square, over pines, fog and light rain. Use the website crop for the site's top banner, the Facebook crop for the page cover, and the share crop for link previews.

## Iconography

- The brand has no icon set of its own. Use a single outline icon family (for example Lucide) at 20px with a 1.5px stroke, colored `ink` or `on-pine`. This is a stand-in until NPCS adopts icons of its own.
- Use social icons (Instagram, Facebook, WhatsApp, Email) as solid glyphs in `on-pine` on the photo, like the Linktree.

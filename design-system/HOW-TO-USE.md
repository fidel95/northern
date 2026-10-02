# Northern Pines design system: kit for your site

- `README.md`: the brand rules (voice, color, type, logo, imagery). Read this first.
- `tokens.css`: every color, font, spacing and radius as CSS variables, plus the two fonts. Dark ("Forest") is the default. Put `data-theme="light"` on `<html>` for the light "Fog" theme.
- `components.css`: ready-made classes (`np-btn`, `np-hero`, `np-card`, `np-tile`, `np-field`, `np-header`, `np-badge`).
- `components/<Name>/example.html`: working HTML for each piece. Open them in a browser. `README.md` beside each one has its usage rules.
- `fonts/`: Cinzel (headings) and Inter (text), both free to use (SIL Open Font License).
- `images/`: the logo (original, plus a transparent cut-out), the fog-pines photo, and the three banners.

Load order on every page: `tokens.css`, then `components.css`, then your own CSS.

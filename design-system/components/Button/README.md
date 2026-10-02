# Button

The action control: `.np-btn` plus one variant — `--primary`, `--outline`, `--quiet` or `--pine`.

- **Primary** (`lichen` fill, `on-lichen` text) at most once per view, for the thing the page is for: "Get a free estimate", "Schedule inspection".
- **Outline** for the second choice ("See our work"). On the photo, inside `.np-hero`, it switches to `on-pine` automatically.
- **Quiet** for inline, low-stakes actions such as "Call (765) 376-1197 →".
- **Pine** for actions on light surfaces where lichen would compete, such as a form's secondary submit.
- Sizes: default 44px tall (touch-safe), `--sm` 36px only in dense desktop UI, `--lg` 52px in heroes. `--block` for full width on mobile forms.

Consumer provides: an `<a>` or `<button>` element and a verb-first, sentence-case label. Use `disabled` or `aria-disabled="true"` for the busy state ("Sending…").

Don't: put two primaries side by side, use all caps, or put a lichen button on the photo without `data-theme="dark"` on its section.

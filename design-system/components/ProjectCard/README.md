# ProjectCard

A card for a finished job, a service or a before/after: `.np-card` with `__media`, `__body`, `__title`, `__meta` and `__link`.

- Media is 4:3. Use a real job photo; fall back to `mist` fill, never a stock image.
- One neutral badge on the media names the service.
- Meta line: place · duration · crew, separated by " · ".
- The whole card is the link; `__link` repeats the destination in words.

Consumer provides: href, photo URL (as `background-image` on `__media`), title, meta line, optional status badge.

Lay cards out in a grid with `space-6` gaps: three across on desktop, one on mobile.

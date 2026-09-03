# Environment maps

`kloofendal-clear-sky-1k.hdr` — "Kloofendal 43d Clear (Pure Sky)", 1k
equirectangular HDR from [Poly Haven](https://polyhaven.com/a/kloofendal_43d_clear_puresky),
released under **CC0** (public domain). Self-hosted rather than hot-linked so
the visualizer keeps no third-party runtime dependency.

It feeds `scene.environment` only — reflections in glass and door hardware.
The visible sky stays the procedural `Sky` in `js/visualizer/lighting.js`, so
nothing about the backdrop changes and this file only ever has to be good
enough to read in a window reflection. Its sun sits at roughly 43 degrees
elevation, close enough to the procedural sun's 44 that the reflected
highlight and the cast shadows agree.

Loading is best-effort and validated at runtime — see `loadHDRIEnvironment`
in `lighting.js`. If any part of it fails, the scene keeps the
direct-light-only look it had before this file existed.

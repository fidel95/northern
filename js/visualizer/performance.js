// Picks a render-quality tier once at init, before the renderer/lights/
// textures are created. There's no cheap, reliable way to directly
// benchmark a GPU synchronously in a browser (WEBGL_debug_renderer_info is
// increasingly masked/blocked for fingerprinting reasons across browsers),
// so this combines several coarse, widely-supported signals instead — the
// same general approach production 3D configurators use for automatic
// quality tiering. It only ever needs to be roughly right: worst case, a
// mid-range device renders at 'medium' instead of 'high' and nobody notices
// the difference, or a low-end device gets a smoother experience it
// otherwise wouldn't have.
export function detectPerformanceTier() {
  const isCoarsePointer = matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency || 4;
  // navigator.deviceMemory (GB) is Chromium/Android-only; undefined
  // elsewhere (Safari, Firefox) — treated as "unknown, assume mid-range"
  // rather than penalizing browsers that don't expose it.
  const mem = navigator.deviceMemory;
  const isSmallScreen = Math.min(window.innerWidth, window.innerHeight) < 500;
  // iOS Safari never exposes deviceMemory, so every iPhone/iPad fell into
  // the "unknown" mem branch below regardless of how capable the device
  // actually is — that alone was enough to keep current-generation iPhones
  // (better GPUs than most laptops) stuck in the 'low' tier. Give iOS its
  // own "known capable" branch instead of treating it as an unknown.
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  let score = 0;
  if (!isCoarsePointer) score += 2; // real mouse/trackpad strongly correlates with a real desktop GPU
  if (cores >= 8) score += 2; else if (cores >= 4) score += 1;
  if (mem != null) { if (mem >= 8) score += 2; else if (mem >= 4) score += 1; } else if (isIOS) { score += 2; } else { score += 1; }
  if (!isSmallScreen) score += 1;

  const tier = score >= 6 ? 'high' : score >= 3 ? 'medium' : 'low';

  const TIERS = {
    high: {
      antialias: true, shadows: true, shadowMapSize: 1024, pixelRatioCap: 2, textureSize: 512,
    },
    medium: {
      antialias: true, shadows: true, shadowMapSize: 512, pixelRatioCap: 1.5, textureSize: 512,
    },
    low: {
      antialias: false, shadows: false, shadowMapSize: 512, pixelRatioCap: 1, textureSize: 256,
    },
  };

  return { tier, ...TIERS[tier] };
}

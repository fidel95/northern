// An on-page diagnostic overlay, opt-in via ?debug=1, that surfaces exactly
// what a given device's WebGL implementation looks like plus any runtime
// errors — a way to get real data back from a device we can't remotely
// debug (a customer's phone) without walking them through Safari/Chrome
// remote inspector setup. Screenshot the overlay, send it over.

export function isDebugMode() {
  try {
    return new URLSearchParams(location.search).get('debug') === '1';
  } catch (e) {
    return false;
  }
}

export function createDiagnosticsPanel(container) {
  if (!isDebugMode()) return { log() {} };

  const el = document.createElement('pre');
  el.style.cssText = [
    'position:absolute', 'left:4px', 'bottom:4px', 'z-index:9999',
    'max-width:94%', 'max-height:70%', 'overflow:auto',
    'background:rgba(0,0,0,0.86)', 'color:#8f8', 'font:10px/1.45 monospace',
    'padding:8px 10px', 'margin:0', 'white-space:pre-wrap', 'border:1px solid #4a4',
  ].join(';');
  container.appendChild(el);

  const lines = [];
  function log(msg) {
    const line = `[${new Date().toISOString().slice(11, 19)}] ${msg}`;
    lines.push(line);
    el.textContent = lines.join('\n');
    // eslint-disable-next-line no-console
    console.log('[viz-debug]', msg);
  }

  window.addEventListener('error', (e) => log(`window error: ${e.message} @ ${e.filename}:${e.lineno}`));
  window.addEventListener('unhandledrejection', (e) => log(`unhandled rejection: ${e.reason && e.reason.message ? e.reason.message : e.reason}`));

  return { log, el };
}

export function collectRendererInfo(renderer) {
  try {
    const gl = renderer.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const precision = (() => {
      try {
        const p = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
        return p ? `range±${p.rangeMax} prec${p.precision}` : 'unavailable';
      } catch (e) { return `error: ${e.message}`; }
    })();
    return [
      `webgl2: ${renderer.capabilities.isWebGL2}`,
      `dpr: ${window.devicePixelRatio}`,
      `maxTextureSize: ${gl.getParameter(gl.MAX_TEXTURE_SIZE)}`,
      `maxCubeMapSize: ${gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE)}`,
      `vendor: ${dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR)}`,
      `renderer: ${dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)}`,
      `fragment highp: ${precision}`,
      `float render targets: ${!!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('WEBGL_color_buffer_float')}`,
      `half-float linear: ${!!gl.getExtension('OES_texture_half_float_linear')}`,
    ].join('\n');
  } catch (e) {
    return `collectRendererInfo failed: ${e.message}`;
  }
}

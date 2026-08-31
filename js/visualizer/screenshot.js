// Snapshot capture using nothing but canvas APIs — the renderer is created
// with preserveDrawingBuffer so the WebGL canvas can be read back directly
// with drawImage/toBlob, no server round-trip.

export function captureSnapshot(sourceCanvas, { brand = 'NORTHERN PINES', tag = 'HOME VISUALIZER' } = {}) {
  const out = document.createElement('canvas');
  out.width = sourceCanvas.width;
  out.height = sourceCanvas.height;
  const ctx = out.getContext('2d');
  ctx.drawImage(sourceCanvas, 0, 0);

  const gh = Math.round(out.height * 0.14);
  const grad = ctx.createLinearGradient(0, out.height - gh, 0, out.height);
  grad.addColorStop(0, 'rgba(9,9,9,0)');
  grad.addColorStop(1, 'rgba(9,9,9,0.6)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, out.height - gh, out.width, gh);

  const fontSize = Math.max(16, Math.round(out.width * 0.02));
  const baseY = out.height - out.height * 0.035;

  ctx.textBaseline = 'bottom';
  ctx.fillStyle = '#e9ee1b';
  ctx.font = `600 ${Math.round(fontSize * 0.5)}px 'Space Mono', monospace`;
  ctx.fillText(tag, out.width * 0.028, baseY - fontSize - 4);

  ctx.fillStyle = '#f4f4f2';
  ctx.font = `700 ${fontSize}px 'Space Grotesk', sans-serif`;
  ctx.fillText(brand, out.width * 0.028, baseY);

  return out;
}

// Saving a generated image reliably is genuinely inconsistent across
// browsers: the `download` attribute on an `<a>` — the desktop-standard
// approach — has a long history of iOS Safari either ignoring it (older
// versions) or just opening the image instead of a "save" prompt (some
// current ones), leaving the customer with nothing obvious to do. Where the
// Web Share API with file support is available (iOS Safari 15+, Android
// Chrome, Samsung Internet), it's used first — it hands the image straight
// to the OS's native share/save sheet, which every one of those platforms
// handles correctly by design. The anchor-download approach remains the
// fallback for browsers without file sharing (desktop Chrome/Edge/Firefox/
// Safari), where it already works fine.
export async function downloadCanvas(canvas, filename) {
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return false;

  if (navigator.canShare && navigator.share) {
    try {
      const file = new File([blob], filename, { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return true;
      }
    } catch (err) {
      // AbortError means the customer dismissed the native share sheet —
      // not a failure worth falling back from. Anything else, fall through
      // to the anchor-download path below.
      if (err && err.name === 'AbortError') return true;
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}

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

export function downloadCanvas(canvas, filename) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, 'image/png');
}

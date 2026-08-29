// "My Home" mode — unchanged in spirit from the original 2D tool: the
// customer uploads a straight-on photo of their own house, picks a zone
// (windows/siding/roofing/trim), and taps its four corners to fit a
// perspective-correct opening or recolor a region. This stays a flat
// <canvas> 2D tool by design — it draws on a real photo, so there's no 3D
// scene to build here. The architecture leaves room to improve the fit
// later (better perspective solving, on-device segmentation) without
// touching the 3D configurator at all.

import { optionById } from './config.js';

const lerp = (a, b, t) => a + (b - a) * t;
const bilinear = (p, u, v) => ({
  x: lerp(lerp(p[0].x, p[1].x, u), lerp(p[3].x, p[2].x, u), v),
  y: lerp(lerp(p[0].y, p[1].y, u), lerp(p[3].y, p[2].y, u), v),
});

function hexToHslLightness(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
}

export class PhotoMode {
  constructor(canvas, { getSelections, onStatus }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.getSelections = getSelections;
    this.onStatus = onStatus || (() => {});
    this.W = 960; this.H = 640;
    this.DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = this.W * this.DPR;
    canvas.height = this.H * this.DPR;
    this.ctx.scale(this.DPR, this.DPR);

    this.img = null;
    this.zone = 'windows';
    this.tracing = [];
    this.windows = [];
    this.zones = { siding: null, roofing: null, trim: null };

    canvas.addEventListener('click', (e) => this._onClick(e));
  }

  setZone(id) { this.zone = id; this.draw(); }

  loadFile(file) {
    const image = new Image();
    return new Promise((resolve) => {
      image.onload = () => {
        this.img = image;
        this.windows = [];
        this.zones = { siding: null, roofing: null, trim: null };
        this.tracing = [];
        this.onStatus('Photo loaded. Pick a zone on the right, then tap its four corners.');
        this.draw();
        resolve();
      };
      image.src = URL.createObjectURL(file);
    });
  }

  undoLast() {
    this.tracing = [];
    if (this.zone === 'windows') {
      this.windows.pop();
      this.onStatus('Last opening removed.');
    } else if (this.zones[this.zone]) {
      this.zones[this.zone] = null;
      this.onStatus('Area removed.');
    } else {
      this.onStatus('Nothing to undo for this zone.');
    }
    this.draw();
  }

  reset() {
    this.windows = [];
    this.zones = { siding: null, roofing: null, trim: null };
    this.tracing = [];
    this.onStatus('Reset.');
    this.draw();
  }

  _canvasPoint(e) {
    const box = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - box.left) * (this.W / box.width),
      y: (e.clientY - box.top) * (this.H / box.height),
    };
  }

  _onClick(e) {
    if (!this.img) return;
    const pt = this._canvasPoint(e);
    const next = this.tracing.concat([pt]);
    if (next.length === 4) {
      if (this.zone === 'windows') {
        const s = this.getSelections();
        this.windows.push({ points: next, ...s });
        this.onStatus('Opening added. Change the style on the right, or trace another opening.');
      } else {
        this.zones[this.zone] = { points: next };
        this.onStatus('Area marked. Pick a color on the right — it applies immediately.');
      }
      this.tracing = [];
    } else {
      this.tracing = next;
      this.onStatus(`Corner ${next.length} of 4 marked. Go clockwise from the top-left.`);
    }
    this.draw();
  }

  _pathFrom(points) {
    const p = new Path2D();
    points.forEach((pt, i) => (i ? p.lineTo(pt.x, pt.y) : p.moveTo(pt.x, pt.y)));
    p.closePath();
    return p;
  }

  _recolorZone(path, colorHex) {
    const ctx = this.ctx;
    ctx.save();
    ctx.clip(path);
    ctx.globalCompositeOperation = 'color';
    ctx.fillStyle = colorHex;
    ctx.fillRect(0, 0, this.W, this.H);

    const delta = hexToHslLightness(colorHex) - 0.5;
    if (delta < -0.05) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `rgba(0,0,0,${Math.min(0.75, -delta * 1.3).toFixed(2)})`;
      ctx.fillRect(0, 0, this.W, this.H);
    } else if (delta > 0.05) {
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.75, delta * 1.3).toFixed(2)})`;
      ctx.fillRect(0, 0, this.W, this.H);
    }
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.restore();
  }

  _drawWarpedWindow(win) {
    const ctx = this.ctx;
    const p = win.points;
    const frameHex = optionById('windowFrame', win.windowFrame).color;
    const glassOpt = optionById('windowGlass', win.windowGlass);
    const N = 10;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const a = bilinear(p, i / N, j / N);
        const b = bilinear(p, (i + 1) / N, j / N);
        const c = bilinear(p, (i + 1) / N, (j + 1) / N);
        const d = bilinear(p, i / N, (j + 1) / N);
        const shine = 0.2 * (1 - (i / N) * 0.7) * (1 - (j / N) * 0.5);
        ctx.fillStyle = glassOpt.tint;
        ctx.globalAlpha = 1 - glassOpt.opacity * 0.4;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y);
        ctx.closePath(); ctx.fill();
        ctx.globalAlpha = shine;
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    const poly = (pts) => {
      ctx.beginPath();
      pts.forEach((u, i) => {
        const m = bilinear(p, u[0], u[1]);
        i ? ctx.lineTo(m.x, m.y) : ctx.moveTo(m.x, m.y);
      });
      ctx.stroke();
    };
    ctx.strokeStyle = frameHex; ctx.lineWidth = 6;
    poly([[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]);
    ctx.lineWidth = 4;
    if (win.windowStyle === 'doublehung') poly([[0, 0.5], [1, 0.5]]);
    if (win.windowStyle === 'slider') poly([[0.5, 0], [0.5, 1]]);
    if (win.windowStyle === 'casement') poly([[0.32, 0], [0.32, 1]]);
    if (win.windowGrille === 'sixoversix') {
      ctx.lineWidth = 2.5;
      poly([[1 / 3, 0], [1 / 3, 1]]); poly([[2 / 3, 0], [2 / 3, 1]]);
      poly([[0, 1 / 3], [1, 1 / 3]]); poly([[0, 2 / 3], [1, 2 / 3]]);
    } else if (win.windowGrille === 'prairie') {
      ctx.lineWidth = 2.5;
      poly([[0, 0.28], [1, 0.28]]);
      poly([[1 / 3, 0], [1 / 3, 0.28]]); poly([[2 / 3, 0], [2 / 3, 0.28]]);
    }
  }

  draw() {
    const ctx = this.ctx, W = this.W, H = this.H;
    ctx.clearRect(0, 0, W, H);
    if (!this.img) {
      ctx.fillStyle = '#1c1c1e'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(234,234,232,0.2)'; ctx.lineWidth = 2; ctx.setLineDash([10, 8]);
      ctx.strokeRect(40, 40, W - 80, H - 80); ctx.setLineDash([]);
      ctx.fillStyle = '#8a8a90'; ctx.font = "500 22px 'Space Grotesk', sans-serif"; ctx.textAlign = 'center';
      ctx.fillText('Choose a photo of your home to begin', W / 2, H / 2 - 8);
      ctx.font = "400 13px 'Space Mono', monospace";
      ctx.fillText('A STRAIGHT-ON ELEVATION WORKS BEST', W / 2, H / 2 + 20);
      ctx.textAlign = 'left';
      return;
    }
    const scale = Math.min(W / this.img.width, H / this.img.height);
    const dw = this.img.width * scale, dh = this.img.height * scale;
    ctx.fillStyle = '#090909'; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(this.img, (W - dw) / 2, (H - dh) / 2, dw, dh);

    ['siding', 'roofing', 'trim'].forEach((kind) => {
      const zone = this.zones[kind];
      if (!zone) return;
      const sel = this.getSelections();
      const opt = optionById(kind, sel[kind]);
      this._recolorZone(this._pathFrom(zone.points), opt.color);
    });
    this.windows.forEach((w) => this._drawWarpedWindow(w));

    if (this.tracing.length) {
      ctx.strokeStyle = '#eaeae8'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
      ctx.beginPath();
      this.tracing.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke(); ctx.setLineDash([]);
      this.tracing.forEach((p) => {
        ctx.fillStyle = '#eaeae8';
        ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
      });
    }
  }
}

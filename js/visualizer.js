(function () {
  var root = document.querySelector('[data-visualizer]');
  if (!root) return;

  var SIDING = [
    { id: 'ivory', n: 'Ivory', c: '#F4F1E9' }, { id: 'sandstone', n: 'Sandstone', c: '#D9D4C6' },
    { id: 'stone', n: 'Stone Gray', c: '#9A9A93' }, { id: 'slate', n: 'Slate', c: '#5A5D57' },
    { id: 'charcoal', n: 'Charcoal', c: '#2B2C2A' }, { id: 'pine', n: 'Pine Green', c: '#3E4A44' },
    { id: 'clay', n: 'Clay', c: '#8A6F5C' }, { id: 'barn', n: 'Barn Red', c: '#6B3A32' },
    { id: 'harbor', n: 'Harbor Blue', c: '#3F4C5A' }, { id: 'black', n: 'Black', c: '#1E1E1E' }
  ];
  var FRAMES = [
    { id: 'white', n: 'White', c: '#FFFFFF' }, { id: 'black', n: 'Black', c: '#2B2C2A' },
    { id: 'bronze', n: 'Bronze', c: '#7A5C3E' }, { id: 'gray', n: 'Stone Gray', c: '#55555d' }
  ];
  var TRIMS = [
    { id: 'white', n: 'White', c: '#EAEAE8' }, { id: 'stone', n: 'Stone', c: '#C9C6BC' },
    { id: 'charcoal', n: 'Charcoal', c: '#2B2C2A' }, { id: 'black', n: 'Black', c: '#090909' }
  ];
  var ROOFS = [
    { id: 'charcoal', n: 'Charcoal', c: '#2B2C2A' }, { id: 'slate', n: 'Slate', c: '#4B4E4C' },
    { id: 'weathered', n: 'Weathered Wood', c: '#5C5348' }, { id: 'black', n: 'Onyx', c: '#141414' }
  ];
  var WSTYLES = [
    { id: 'doublehung', n: 'Double-Hung' }, { id: 'casement', n: 'Casement' },
    { id: 'awning', n: 'Awning' }, { id: 'sliding', n: 'Sliding' },
    { id: 'picture', n: 'Picture' }, { id: 'baybow', n: 'Bay & Bow' }
  ];
  var GRILLES = [{ id: 'none', n: 'None' }, { id: 'colonial', n: 'Colonial Grid' }, { id: 'craftsman', n: 'Craftsman' }];
  var GLASS = [
    { id: 'standard', n: 'Standard', c: '#2A3338' },
    { id: 'triple', n: 'Triple-Pane', c: '#31414B' },
    { id: 'tinted', n: 'Tinted / Privacy', c: '#1A2124' }
  ];
  var DSTYLES = [
    { id: 'single', n: 'Single Entry', glazed: false }, { id: 'double', n: 'Double Entry', glazed: false },
    { id: 'sidelights', n: 'Sidelights', glazed: false }, { id: 'sliding', n: 'Sliding Patio', glazed: true },
    { id: 'french', n: 'French Patio', glazed: true }, { id: 'multislide', n: 'Multi-Slide', glazed: true }
  ];
  var DOORCOLORS = [
    { id: 'black', n: 'Black', c: '#1B1C1E' }, { id: 'white', n: 'White', c: '#F2F1EC' },
    { id: 'bronze', n: 'Bronze', c: '#7A5C3E' }, { id: 'pine', n: 'Pine Green', c: '#3E4A44' },
    { id: 'barn', n: 'Barn Red', c: '#6B3A32' }, { id: 'slate', n: 'Slate', c: '#5A5D57' }
  ];
  var HOMES = [
    { id: 'ranch', name: 'Ranch',
      roof: [[40, 262], [480, 152], [920, 262], [920, 282], [40, 282]],
      body: { x: 78, y: 278, w: 804, h: 236 },
      trim: { x: 60, y: 258, w: 840, h: 16 },
      windows: [{ x: 150, y: 316, w: 130, h: 118 }, { x: 336, y: 316, w: 130, h: 118 }, { x: 690, y: 316, w: 150, h: 118 }],
      door: { x: 522, y: 348, w: 118, h: 166 } },
    { id: 'colonial', name: 'Colonial',
      roof: [[62, 196], [480, 96], [898, 196], [898, 214], [62, 214]],
      body: { x: 104, y: 210, w: 752, h: 304 },
      trim: { x: 86, y: 192, w: 788, h: 16 },
      windows: [
        { x: 148, y: 238, w: 104, h: 96 }, { x: 300, y: 238, w: 104, h: 96 },
        { x: 556, y: 238, w: 104, h: 96 }, { x: 708, y: 238, w: 104, h: 96 },
        { x: 148, y: 372, w: 104, h: 112 }, { x: 708, y: 372, w: 104, h: 112 }],
      door: { x: 408, y: 360, w: 144, h: 154 } },
    { id: 'craftsman', name: 'Craftsman',
      roof: [[30, 244], [480, 122], [930, 244], [930, 266], [30, 266]],
      body: { x: 92, y: 262, w: 776, h: 252 },
      trim: { x: 72, y: 242, w: 816, h: 18 },
      windows: [{ x: 142, y: 300, w: 158, h: 132 }, { x: 660, y: 300, w: 158, h: 132 }],
      door: { x: 400, y: 322, w: 160, h: 192 } }
  ];

  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var bilinear = function (p, u, v) {
    return { x: lerp(lerp(p[0].x, p[1].x, u), lerp(p[3].x, p[2].x, u), v), y: lerp(lerp(p[0].y, p[1].y, u), lerp(p[3].y, p[2].y, u), v) };
  };
  var byId = function (list, id) { return list.filter(function (x) { return x.id === id; })[0] || list[0]; };
  var paletteFor = function (kind) { return kind === 'siding' ? SIDING : kind === 'roof' ? ROOFS : TRIMS; };

  var state = {
    mode: 'demo', homeIdx: 0, sheetOpen: false,
    selected: 'windows',
    siding: 'sandstone', trim: 'white', roof: 'charcoal', doorColor: 'black',
    wstyle: 'doublehung', frame: 'white', grille: 'none', glass: 'standard', dstyle: 'single',
    userWindows: [], userZones: { siding: null, trim: null, roof: null }, tracing: [],
    status: 'Tap a part of the house, or use the list on the right.'
  };
  var img = null;

  var LOGICAL_W = 960, LOGICAL_H = 640;
  var canvas = root.querySelector('.viz-canvas');
  var ctx = canvas.getContext('2d');
  var DPR = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  canvas.width = LOGICAL_W * DPR;
  canvas.height = LOGICAL_H * DPR;
  ctx.scale(DPR, DPR);
  var groundTex = buildGroundTexture();
  var grainTex = buildGrainTexture();
  var els = {
    grid: root.querySelector('.viz-grid'),
    demoTab: root.querySelector('.viz-modetab[data-mode="demo"]'),
    uploadTab: root.querySelector('.viz-modetab[data-mode="upload"]'),
    homes: root.querySelector('.viz-homes'),
    status: root.querySelector('.viz-status'),
    resetBtn: root.querySelector('.viz-reset'),
    downloadBtn: root.querySelector('.viz-download'),
    estimateLink: root.querySelector('.viz-estimate-link'),
    estimateLink2: document.querySelector('.viz-estimate-link-cta'),
    uploadPanel: root.querySelector('.viz-upload-panel'),
    pickFileBtn: root.querySelector('.viz-pickfile'),
    undoBtn: root.querySelector('.viz-undo'),
    fileInput: root.querySelector('.viz-file'),
    panel: root.querySelector('.viz-panel'),
    panelTitle: root.querySelector('.viz-panel__head h2'),
    panelHint: root.querySelector('.viz-panel__hint'),
    closeBtn: root.querySelector('.viz-panel__close'),
    zoneGrid: root.querySelector('.viz-zonegrid'),
    controls: root.querySelector('.viz-controls'),
    sheetTrigger: root.querySelector('.viz-sheet-trigger'),
    desc: document.getElementById('description-visualizer')
  };

  function labelFor(id) { return { windows: 'Windows', door: 'Door', siding: 'Siding', roof: 'Roof', trim: 'Trim' }[id] || 'Windows'; }

  /* ---------- drawing ---------- */
  function draw() {
    var W = LOGICAL_W, H = LOGICAL_H;
    ctx.clearRect(0, 0, W, H);
    if (state.mode === 'upload') drawUpload(W, H); else drawDemo(W, H);
  }

  function buildGroundTexture() {
    var c = document.createElement('canvas');
    c.width = LOGICAL_W; c.height = 130;
    var g = c.getContext('2d');
    var grad = g.createLinearGradient(0, 0, 0, 130);
    grad.addColorStop(0, '#CBC8BE'); grad.addColorStop(1, '#B7B3A7');
    g.fillStyle = grad; g.fillRect(0, 0, LOGICAL_W, 130);
    g.strokeStyle = 'rgba(0,0,0,0.08)'; g.lineWidth = 1;
    for (var x = 0; x < LOGICAL_W; x += 92) {
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 130); g.stroke();
    }
    for (var i = 0; i < 900; i++) {
      var px = (i * 71) % LOGICAL_W, py = (i * 37) % 130;
      g.fillStyle = i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
      g.fillRect(px, py, 1, 1);
    }
    return c;
  }

  // A faint per-pixel noise layer, drawn over the finished scene with a
  // 'overlay' blend, so the flat vector fills read as photographed rather
  // than printed. Built once and reused — full-frame per-pixel noise is too
  // slow to regenerate every redraw.
  function buildGrainTexture() {
    var c = document.createElement('canvas');
    c.width = LOGICAL_W; c.height = LOGICAL_H;
    var g = c.getContext('2d');
    var id = g.createImageData(LOGICAL_W, LOGICAL_H);
    for (var i = 0; i < id.data.length; i += 4) {
      var v = 128 + (Math.random() * 40 - 20);
      id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
      id.data[i + 3] = 255;
    }
    g.putImageData(id, 0, 0);
    return c;
  }

  function drawShrub(cx, groundY, r, tone) {
    ctx.fillStyle = tone;
    [[-r * 0.55, 0.55], [0, 0.4], [r * 0.55, 0.55], [-r * 0.22, 0.75], [r * 0.22, 0.75]].forEach(function (o) {
      ctx.beginPath();
      ctx.ellipse(cx + o[0], groundY - r * o[1], r * 0.62, r * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawLandscaping(home, groundY) {
    var b = home.body;
    // walkway from the door threshold straight down to the bottom edge, widening for perspective
    var d = home.door;
    var wx = d.x + d.w / 2;
    ctx.fillStyle = 'rgba(178,174,163,0.9)';
    ctx.beginPath();
    ctx.moveTo(wx - 34, groundY);
    ctx.lineTo(wx + 34, groundY);
    ctx.lineTo(wx + 70, LOGICAL_H - 4);
    ctx.lineTo(wx - 70, LOGICAL_H - 4);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.06)'; ctx.lineWidth = 1;
    for (var seg = 1; seg < 5; seg++) {
      var t = seg / 5;
      var yy = groundY + (LOGICAL_H - 4 - groundY) * t;
      var half = 34 + (70 - 34) * t;
      ctx.beginPath(); ctx.moveTo(wx - half, yy); ctx.lineTo(wx + half, yy); ctx.stroke();
    }

    // foundation shrubs, spaced along the base of the house, skipping the doorway
    var count = Math.max(2, Math.round(b.w / 170));
    for (var i = 0; i < count; i++) {
      var x = b.x + (b.w / (count - 1 || 1)) * i;
      if (Math.abs(x - (d.x + d.w / 2)) < d.w * 0.9) continue;
      drawShrub(x, groundY, 22 + (i % 3) * 5, i % 2 ? 'rgba(61,79,58,0.88)' : 'rgba(74,94,66,0.88)');
    }
  }

  function drawDemo(W, H) {
    var home = HOMES[state.homeIdx];
    var sid = byId(SIDING, state.siding).c;
    var trim = byId(TRIMS, state.trim).c;
    var roof = byId(ROOFS, state.roof).c;
    var groundY = 514;

    var sky = ctx.createLinearGradient(0, 0, 0, groundY);
    sky.addColorStop(0, '#C9D1D4'); sky.addColorStop(0.55, '#E1DED6'); sky.addColorStop(1, '#F4F0E8');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, groundY);

    var sun = ctx.createRadialGradient(W * 0.84, 64, 0, W * 0.84, 64, 280);
    sun.addColorStop(0, 'rgba(255,248,224,0.5)'); sun.addColorStop(1, 'rgba(255,248,224,0)');
    ctx.fillStyle = sun; ctx.fillRect(0, 0, W, groundY);

    ctx.drawImage(groundTex, 0, groundY, W, H - groundY);
    drawLandscaping(home, groundY);

    ctx.fillStyle = 'rgba(60,66,62,0.5)';
    [70, 132, 838, 900].forEach(function (x, i) {
      var h = i % 2 ? 150 : 118;
      ctx.beginPath();
      ctx.moveTo(x, 300 - h); ctx.lineTo(x + 34, 300); ctx.lineTo(x - 34, 300);
      ctx.closePath(); ctx.fill();
    });

    var b = home.body;

    ctx.save();
    if (ctx.filter !== undefined) ctx.filter = 'blur(10px)';
    ctx.fillStyle = 'rgba(20,20,18,0.22)';
    ctx.beginPath();
    ctx.ellipse(b.x + b.w / 2, b.y + b.h + 14, b.w / 2 + 20, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = sid; ctx.fillRect(b.x, b.y, b.w, b.h);
    for (var y = b.y + 12, row = 0; y < b.y + b.h; y += 12, row++) {
      ctx.strokeStyle = row % 2 ? 'rgba(0,0,0,0.10)' : 'rgba(0,0,0,0.07)';
      ctx.beginPath(); ctx.moveTo(b.x, y); ctx.lineTo(b.x + b.w, y); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.beginPath(); ctx.moveTo(b.x, y + 1); ctx.lineTo(b.x + b.w, y + 1); ctx.stroke();
    }
    var shade = ctx.createLinearGradient(b.x, 0, b.x + b.w, 0);
    shade.addColorStop(0, 'rgba(0,0,0,0.12)'); shade.addColorStop(0.18, 'rgba(0,0,0,0)');
    shade.addColorStop(0.82, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(0,0,0,0.14)');
    ctx.fillStyle = shade; ctx.fillRect(b.x, b.y, b.w, b.h);
    var eaveShadow = ctx.createLinearGradient(0, b.y, 0, b.y + 24);
    eaveShadow.addColorStop(0, 'rgba(0,0,0,0.16)'); eaveShadow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = eaveShadow; ctx.fillRect(b.x, b.y, b.w, 24);

    ctx.fillStyle = roof; ctx.beginPath();
    home.roof.forEach(function (p, i) { i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
    ctx.closePath(); ctx.fill();

    ctx.save();
    ctx.beginPath();
    home.roof.forEach(function (p, i) { i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
    ctx.closePath(); ctx.clip();
    var rxs = home.roof.map(function (p) { return p[0]; });
    var rys = home.roof.map(function (p) { return p[1]; });
    var rx1 = Math.min.apply(null, rxs), rx2 = Math.max.apply(null, rxs);
    var ry1 = Math.min.apply(null, rys), ry2 = Math.max.apply(null, rys);
    var roofShade = ctx.createLinearGradient(0, ry1, 0, ry2);
    roofShade.addColorStop(0, 'rgba(255,255,255,0.10)'); roofShade.addColorStop(1, 'rgba(0,0,0,0.16)');
    ctx.fillStyle = roofShade; ctx.fillRect(rx1, ry1, rx2 - rx1, ry2 - ry1);
    ctx.strokeStyle = 'rgba(0,0,0,0.10)'; ctx.lineWidth = 1;
    for (var scY = ry1 + 6; scY < ry2; scY += 9) {
      ctx.beginPath(); ctx.moveTo(rx1, scY); ctx.lineTo(rx2, scY); ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.moveTo(home.roof[0][0], home.roof[0][1]); ctx.lineTo(home.roof[1][0], home.roof[1][1]);
    ctx.lineTo(home.roof[1][0], home.roof[1][1] + 30); ctx.closePath(); ctx.fill();

    ctx.fillStyle = trim; ctx.fillRect(home.trim.x, home.trim.y, home.trim.w, home.trim.h);
    ctx.fillRect(b.x - 8, b.y, 8, b.h); ctx.fillRect(b.x + b.w, b.y, 8, b.h);

    drawDoor(home.door, trim);
    home.windows.forEach(function (r) { drawWindow(r, trim); });

    var vignette = ctx.createRadialGradient(W / 2, H * 0.42, H * 0.25, W / 2, H * 0.42, H * 0.75);
    vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(0,0,0,0.10)');
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.globalCompositeOperation = 'overlay';
    ctx.drawImage(grainTex, 0, 0, W, H);
    ctx.restore();

    var sel = selectionRect(home);
    if (sel) {
      ctx.save();
      ctx.strokeStyle = '#090909'; ctx.lineWidth = 3; ctx.setLineDash([9, 6]);
      ctx.strokeRect(sel.x - 6, sel.y - 6, sel.w + 12, sel.h + 12);
      ctx.restore();
    }
  }

  function selectionRect(home) {
    var s = state.selected;
    if (s === 'door') return home.door;
    if (s === 'windows') {
      var rs = home.windows;
      var x1 = Math.min.apply(null, rs.map(function (r) { return r.x; }));
      var y1 = Math.min.apply(null, rs.map(function (r) { return r.y; }));
      var x2 = Math.max.apply(null, rs.map(function (r) { return r.x + r.w; }));
      var y2 = Math.max.apply(null, rs.map(function (r) { return r.y + r.h; }));
      return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
    }
    if (s === 'siding') return home.body;
    if (s === 'roof') { var p = home.roof; return { x: p[0][0], y: p[1][1], w: p[2][0] - p[0][0], h: p[0][1] - p[1][1] }; }
    if (s === 'trim') return home.trim;
    return null;
  }

  function drawWindow(r, trimColor) {
    var frame = byId(FRAMES, state.frame).c;
    var glass = byId(GLASS, state.glass).c;
    var style = state.wstyle;
    var casingW = 8;

    ctx.fillStyle = trimColor;
    ctx.fillRect(r.x - casingW, r.y - casingW, r.w + casingW * 2, r.h + casingW * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(r.x - casingW + 1, r.y + r.h + casingW - 1);
    ctx.lineTo(r.x - casingW + 1, r.y - casingW + 1);
    ctx.lineTo(r.x + r.w + casingW - 1, r.y - casingW + 1);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.16)';
    ctx.beginPath();
    ctx.moveTo(r.x + r.w + casingW - 1, r.y - casingW + 1);
    ctx.lineTo(r.x + r.w + casingW - 1, r.y + r.h + casingW - 1);
    ctx.lineTo(r.x - casingW + 1, r.y + r.h + casingW - 1);
    ctx.stroke();

    var panes = style === 'baybow'
      ? [{ x: r.x, y: r.y + 6, w: r.w * 0.26, h: r.h - 6 },
         { x: r.x + r.w * 0.28, y: r.y, w: r.w * 0.44, h: r.h },
         { x: r.x + r.w * 0.74, y: r.y + 6, w: r.w * 0.26, h: r.h - 6 }]
      : [r];

    panes.forEach(function (p) {
      ctx.fillStyle = glass; ctx.fillRect(p.x, p.y, p.w, p.h);

      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      var refl = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
      refl.addColorStop(0, 'rgba(201,209,212,0.5)');
      refl.addColorStop(0.5, 'rgba(120,130,132,0.08)');
      refl.addColorStop(1, 'rgba(20,24,26,0)');
      ctx.fillStyle = refl; ctx.fillRect(p.x, p.y, p.w, p.h);
      var streak = ctx.createLinearGradient(p.x, p.y + p.h, p.x + p.w, p.y);
      streak.addColorStop(0.30, 'rgba(255,255,255,0)');
      streak.addColorStop(0.42, 'rgba(255,255,255,0.22)');
      streak.addColorStop(0.50, 'rgba(255,255,255,0)');
      ctx.fillStyle = streak; ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.restore();

      if (state.glass === 'triple') { ctx.fillStyle = 'rgba(180,205,215,0.14)'; ctx.fillRect(p.x, p.y, p.w, p.h); }
      if (state.glass === 'tinted') { ctx.fillStyle = 'rgba(10,14,16,0.34)'; ctx.fillRect(p.x, p.y, p.w, p.h); }
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2;
      ctx.strokeRect(p.x + 1, p.y + 1, p.w - 2, p.h - 2);
      ctx.strokeStyle = frame; ctx.lineWidth = 7;
      ctx.strokeRect(p.x + 3.5, p.y + 3.5, p.w - 7, p.h - 7);
      drawSash(p, style, frame);
      drawGrille(p, frame);
    });

    if (style === 'baybow') {
      ctx.fillStyle = trimColor;
      ctx.fillRect(r.x - casingW - 6, r.y + r.h + casingW - 2, r.w + casingW * 2 + 12, 10);
    }
    ctx.fillStyle = trimColor;
    ctx.fillRect(r.x - casingW - 4, r.y + r.h + casingW, r.w + casingW * 2 + 8, 7);
  }

  function drawSash(p, style, frame) {
    ctx.strokeStyle = frame; ctx.lineWidth = 6;
    var midY = p.y + p.h / 2, midX = p.x + p.w / 2;
    if (style === 'doublehung') {
      ctx.beginPath(); ctx.moveTo(p.x + 3, midY); ctx.lineTo(p.x + p.w - 3, midY); ctx.stroke();
    } else if (style === 'sliding') {
      ctx.beginPath(); ctx.moveTo(midX, p.y + 3); ctx.lineTo(midX, p.y + p.h - 3); ctx.stroke();
    } else if (style === 'awning') {
      ctx.beginPath(); ctx.moveTo(p.x + 3, p.y + p.h * 0.34); ctx.lineTo(p.x + p.w - 3, p.y + p.h * 0.34); ctx.stroke();
    } else if (style === 'casement') {
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(p.x + 11, p.y + 11); ctx.lineTo(p.x + 11, p.y + p.h - 11); ctx.stroke();
      ctx.fillStyle = frame;
      ctx.fillRect(p.x + p.w - 20, midY - 9, 6, 18);
    } else if (style === 'baybow') {
      ctx.beginPath(); ctx.moveTo(p.x + 3, p.y + p.h * 0.72); ctx.lineTo(p.x + p.w - 3, p.y + p.h * 0.72); ctx.stroke();
    }
  }

  function drawGrille(p, frame) {
    var g = state.grille;
    if (g === 'none') return;
    ctx.strokeStyle = frame; ctx.lineWidth = 2.5;
    var ix = p.x + 7, iy = p.y + 7, iw = p.w - 14, ih = p.h - 14;
    if (g === 'colonial') {
      for (var c = 1; c < 3; c++) {
        var x = ix + (iw / 3) * c;
        ctx.beginPath(); ctx.moveTo(x, iy); ctx.lineTo(x, iy + ih); ctx.stroke();
      }
      for (var rr = 1; rr < 4; rr++) {
        var yy = iy + (ih / 4) * rr;
        ctx.beginPath(); ctx.moveTo(ix, yy); ctx.lineTo(ix + iw, yy); ctx.stroke();
      }
    } else {
      var yline = iy + ih * 0.28;
      ctx.beginPath(); ctx.moveTo(ix, yline); ctx.lineTo(ix + iw, yline); ctx.stroke();
      for (var c2 = 1; c2 < 3; c2++) {
        var x2 = ix + (iw / 3) * c2;
        ctx.beginPath(); ctx.moveTo(x2, iy); ctx.lineTo(x2, yline); ctx.stroke();
      }
    }
  }

  function drawDoor(r, trimColor) {
    var col = byId(DOORCOLORS, state.doorColor).c;
    var glass = byId(GLASS, state.glass).c;
    var frame = byId(FRAMES, state.frame).c;
    var d = byId(DSTYLES, state.dstyle);

    ctx.fillStyle = trimColor;
    ctx.fillRect(r.x - 9, r.y - 9, r.w + 18, r.h + 9);
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(r.x - 9 + 1, r.y + r.h); ctx.lineTo(r.x - 9 + 1, r.y - 9 + 1); ctx.lineTo(r.x + r.w + 9 - 1, r.y - 9 + 1);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.14)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(r.x + r.w + 9 - 1, r.y - 9 + 1); ctx.lineTo(r.x + r.w + 9 - 1, r.y + r.h);
    ctx.stroke();
    var thresholdShadow = ctx.createLinearGradient(0, r.y + r.h, 0, r.y + r.h + 9);
    thresholdShadow.addColorStop(0, 'rgba(0,0,0,0.22)'); thresholdShadow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = thresholdShadow; ctx.fillRect(r.x - 9, r.y + r.h, r.w + 18, 9);

    function leaf(x, y, w, h, lites) {
      ctx.fillStyle = col; ctx.fillRect(x, y, w, h);
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      for (var gx = x + 8; gx < x + w - 4; gx += 5) {
        var alpha = 0.03 + 0.025 * Math.abs(Math.sin(gx * 1.7));
        ctx.strokeStyle = 'rgba(255,255,255,' + alpha.toFixed(3) + ')'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(gx, y + 4); ctx.lineTo(gx, y + h - 4); ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle = 'rgba(0,0,0,0.14)'; ctx.fillRect(x, y, 5, h);
      if (lites) {
        ctx.fillStyle = glass;
        var gy = y + 12, gh = h - 24, gx = x + 10, gw = w - 20;
        ctx.fillRect(gx, gy, gw, gh);
        var rg = ctx.createLinearGradient(gx, gy, gx + gw, gy + gh);
        rg.addColorStop(0, 'rgba(255,255,255,0.18)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = rg; ctx.fillRect(gx, gy, gw, gh);
        ctx.strokeStyle = frame; ctx.lineWidth = 3;
        ctx.strokeRect(gx + 1.5, gy + 1.5, gw - 3, gh - 3);
        if (d.id === 'french') {
          ctx.lineWidth = 2;
          for (var i = 1; i < 4; i++) {
            var yy = gy + (gh / 4) * i;
            ctx.beginPath(); ctx.moveTo(gx, yy); ctx.lineTo(gx + gw, yy); ctx.stroke();
          }
          var mx = gx + gw / 2;
          ctx.beginPath(); ctx.moveTo(mx, gy); ctx.lineTo(mx, gy + gh); ctx.stroke();
        }
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 2;
        ctx.strokeRect(x + 14, y + 16, w - 28, h * 0.36);
        ctx.strokeRect(x + 14, y + h * 0.36 + 30, w - 28, h * 0.46);
      }
    }
    function knob(x) {
      var ky = r.y + r.h * 0.55;
      var kg = ctx.createRadialGradient(x - 1.5, ky - 1.5, 0.5, x, ky, 5);
      kg.addColorStop(0, '#f5f9a0'); kg.addColorStop(0.6, '#e9ee1b'); kg.addColorStop(1, '#b9bd12');
      ctx.fillStyle = kg; ctx.beginPath(); ctx.arc(x, ky, 5, 0, Math.PI * 2); ctx.fill();
    }

    if (d.id === 'double' || d.id === 'french') {
      leaf(r.x, r.y, r.w / 2 - 1, r.h, d.glazed);
      leaf(r.x + r.w / 2 + 1, r.y, r.w / 2 - 1, r.h, d.glazed);
      knob(r.x + r.w / 2 - 14); knob(r.x + r.w / 2 + 14);
    } else if (d.id === 'sidelights') {
      var sw = r.w * 0.2;
      ctx.fillStyle = glass; ctx.fillRect(r.x, r.y + 8, sw, r.h - 8);
      ctx.fillRect(r.x + r.w - sw, r.y + 8, sw, r.h - 8);
      ctx.strokeStyle = frame; ctx.lineWidth = 4;
      ctx.strokeRect(r.x + 2, r.y + 10, sw - 4, r.h - 12);
      ctx.strokeRect(r.x + r.w - sw + 2, r.y + 10, sw - 4, r.h - 12);
      leaf(r.x + sw + 6, r.y, r.w - sw * 2 - 12, r.h, false);
      knob(r.x + r.w - sw - 22);
    } else if (d.id === 'sliding' || d.id === 'multislide') {
      var n = d.id === 'multislide' ? 3 : 2;
      var pw = r.w / n;
      for (var i2 = 0; i2 < n; i2++) {
        ctx.fillStyle = glass; ctx.fillRect(r.x + i2 * pw, r.y, pw, r.h);
        var rg2 = ctx.createLinearGradient(r.x + i2 * pw, r.y, r.x + (i2 + 1) * pw, r.y + r.h);
        rg2.addColorStop(0, 'rgba(255,255,255,0.20)'); rg2.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = rg2; ctx.fillRect(r.x + i2 * pw, r.y, pw, r.h);
        ctx.strokeStyle = col; ctx.lineWidth = 8;
        ctx.strokeRect(r.x + i2 * pw + 4, r.y + 4, pw - 8, r.h - 8);
      }
      ctx.fillStyle = '#e9ee1b'; ctx.fillRect(r.x + pw - 5, r.y + r.h * 0.48, 4, 30);
    } else {
      leaf(r.x, r.y, r.w, r.h, false);
      knob(r.x + r.w - 20);
    }
  }

  function pathFromPoints(pts) {
    var p = new Path2D();
    pts.forEach(function (pt, i) { i ? p.lineTo(pt.x, pt.y) : p.moveTo(pt.x, pt.y); });
    p.closePath();
    return p;
  }

  function hexToHsl(hex) {
    var r = parseInt(hex.slice(1, 3), 16) / 255;
    var g = parseInt(hex.slice(3, 5), 16) / 255;
    var b = parseInt(hex.slice(5, 7), 16) / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    return { l: (max + min) / 2 };
  }

  // Recolors a traced zone on a real photo by shifting hue/saturation ('color'
  // blend) rather than overwriting pixels, so the photo's own shading, shadows
  // and reflections stay visible underneath the new color. A flat fill would
  // erase that texture and look pasted on. 'color' blend alone can't reach
  // near-white/near-black (those have no defined hue/sat), so an extra
  // multiply (darken) or screen (lighten) pass nudges luminance toward the
  // swatch's own lightness first.
  function recolorZone(path, color) {
    ctx.save();
    ctx.clip(path);
    ctx.globalCompositeOperation = 'color';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    var delta = hexToHsl(color).l - 0.5;
    if (delta < -0.05) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = 'rgba(0,0,0,' + Math.min(0.75, -delta * 1.3).toFixed(2) + ')';
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    } else if (delta > 0.05) {
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = 'rgba(255,255,255,' + Math.min(0.75, delta * 1.3).toFixed(2) + ')';
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    }
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.restore();
  }

  function drawUpload(W, H) {
    if (!img) {
      ctx.fillStyle = '#1c1c1e'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(20,20,20,0.2)'; ctx.lineWidth = 2; ctx.setLineDash([10, 8]);
      ctx.strokeRect(40, 40, W - 80, H - 80); ctx.setLineDash([]);
      ctx.fillStyle = '#7d7d84'; ctx.font = "500 22px 'Space Grotesk', sans-serif"; ctx.textAlign = 'center';
      ctx.fillText('Choose a photo of your home to begin', W / 2, H / 2 - 8);
      ctx.font = "400 14px 'Space Mono', monospace";
      ctx.fillText('A STRAIGHT-ON ELEVATION WORKS BEST', W / 2, H / 2 + 22);
      ctx.textAlign = 'left';
      return;
    }
    var scale = Math.min(W / img.width, H / img.height);
    var dw = img.width * scale, dh = img.height * scale;
    ctx.fillStyle = '#090909'; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    ['roof', 'siding', 'trim'].forEach(function (kind) {
      var zone = state.userZones[kind];
      if (zone) recolorZone(pathFromPoints(zone.points), byId(paletteFor(kind), state[kind]).c);
    });
    state.userWindows.forEach(function (w) { drawWarped(w); });
    var t = state.tracing;
    if (t.length) {
      ctx.strokeStyle = '#eaeae8'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
      ctx.beginPath();
      t.forEach(function (p, i) { i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); });
      ctx.stroke(); ctx.setLineDash([]);
      t.forEach(function (p) { ctx.fillStyle = '#eaeae8'; ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill(); });
    }
  }

  function drawWarped(win) {
    var p = win.points;
    var glass = byId(GLASS, win.glass).c;
    var frame = byId(FRAMES, win.frame).c;
    var N = 12;
    for (var i = 0; i < N; i++) {
      for (var j = 0; j < N; j++) {
        var a = bilinear(p, i / N, j / N), b = bilinear(p, (i + 1) / N, j / N);
        var c = bilinear(p, (i + 1) / N, (j + 1) / N), d = bilinear(p, i / N, (j + 1) / N);
        var shine = 0.22 * (1 - (i / N) * 0.7) * (1 - (j / N) * 0.5);
        ctx.fillStyle = glass;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,' + shine.toFixed(3) + ')'; ctx.fill();
      }
    }
    function poly(pts) {
      ctx.beginPath();
      pts.forEach(function (u, i) { var m = bilinear(p, u[0], u[1]); i ? ctx.lineTo(m.x, m.y) : ctx.moveTo(m.x, m.y); });
      ctx.stroke();
    }
    ctx.strokeStyle = frame; ctx.lineWidth = 6;
    poly([[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]);
    ctx.lineWidth = 5;
    if (win.style === 'doublehung' || win.style === 'awning') poly([[0, 0.5], [1, 0.5]]);
    if (win.style === 'sliding' || win.style === 'baybow') poly([[0.5, 0], [0.5, 1]]);
    if (win.grille === 'colonial') {
      ctx.lineWidth = 2.5;
      poly([[1 / 3, 0], [1 / 3, 1]]); poly([[2 / 3, 0], [2 / 3, 1]]);
      poly([[0, 0.25], [1, 0.25]]); poly([[0, 0.75], [1, 0.75]]);
    } else if (win.grille === 'craftsman') {
      ctx.lineWidth = 2.5;
      poly([[0, 0.28], [1, 0.28]]);
      poly([[1 / 3, 0], [1 / 3, 0.28]]); poly([[2 / 3, 0], [2 / 3, 0.28]]);
    }
  }

  /* ---------- interaction ---------- */
  function canvasPoint(e) {
    var box = canvas.getBoundingClientRect();
    return { x: (e.clientX - box.left) * (LOGICAL_W / box.width), y: (e.clientY - box.top) * (LOGICAL_H / box.height) };
  }

  function onClick(e) {
    var pt = canvasPoint(e), x = pt.x, y = pt.y;
    if (state.mode === 'upload') {
      if (!img) return;
      if (state.selected === 'door') {
        state.status = "Door tracing on your own photo isn't supported yet — try Windows, Siding, Roof, or Trim.";
        renderAll();
        return;
      }
      var t = state.tracing.concat([{ x: x, y: y }]);
      if (t.length === 4) {
        if (state.selected === 'windows') {
          state.userWindows.push({ points: t, style: state.wstyle, frame: state.frame, grille: state.grille, glass: state.glass });
          state.status = 'Opening added. Change the style on the right, or trace another opening.';
        } else {
          state.userZones[state.selected] = { points: t };
          state.status = labelFor(state.selected) + ' area marked. Pick a color on the right.';
        }
        state.tracing = [];
      } else {
        state.tracing = t;
        state.status = 'Corner ' + t.length + ' of 4 marked. Go clockwise from the top-left.';
      }
      renderAll();
      return;
    }
    var home = HOMES[state.homeIdx];
    var hit = function (r) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; };
    var pad = function (r) { return { x: r.x - 14, y: r.y - 14, w: r.w + 28, h: r.h + 28 }; };
    var sel = null;
    if (home.windows.some(function (r) { return hit(pad(r)); })) sel = 'windows';
    else if (hit(pad(home.door))) sel = 'door';
    else if (hit(home.trim)) sel = 'trim';
    else if (y < home.body.y) sel = 'roof';
    else if (hit(home.body)) sel = 'siding';
    if (sel) {
      state.selected = sel;
      state.status = labelFor(sel) + ' selected.';
      if (window.matchMedia('(max-width: 900px)').matches) state.sheetOpen = true;
      renderAll();
    }
  }

  /* ---------- control builders ---------- */
  function makeOptBtn(o, key, activeId, kind) {
    var btn = document.createElement('button');
    btn.type = 'button';
    var on = o.id === activeId;
    if (kind === 'swatch') {
      btn.className = 'viz-swatch-btn';
      btn.style.background = o.c;
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      var sr = document.createElement('span');
      sr.className = 'viz-sr-only'; sr.textContent = o.n;
      btn.appendChild(sr);
    } else {
      btn.className = 'viz-opt-btn';
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.title = o.n;
      if (o.c) {
        var sw = document.createElement('span');
        sw.className = 'viz-opt-btn__swatch'; sw.style.background = o.c;
        btn.appendChild(sw);
      }
      btn.appendChild(document.createTextNode(o.n));
    }
    btn.addEventListener('click', function () {
      state[key] = o.id;
      draw();
      renderAll();
    });
    return btn;
  }

  function ctrl(label, list, activeId, key, kind) {
    var fs = document.createElement('fieldset');
    fs.className = 'viz-control';
    var legend = document.createElement('legend');
    legend.textContent = label;
    fs.appendChild(legend);
    var grid = document.createElement('div');
    grid.className = 'viz-control-grid' + (kind === 'swatch' ? ' viz-control-grid--swatch' : '');
    list.forEach(function (o) { grid.appendChild(makeOptBtn(o, key, activeId, kind)); });
    fs.appendChild(grid);
    return fs;
  }

  function estimateHref() {
    var isDoor = state.selected === 'door';
    var note = 'From the ' + HOMES[state.homeIdx].name + ' visualizer — siding ' +
      byId(SIDING, state.siding).n + ', trim ' + byId(TRIMS, state.trim).n + ', roof ' + byId(ROOFS, state.roof).n + '.';
    var params;
    if (isDoor) {
      var isPatio = ['sliding', 'french', 'multislide'].indexOf(state.dstyle) > -1;
      var tab = isPatio ? 'patio' : 'entry';
      params = { tab: tab, style: state.dstyle, note: note };
      if (isPatio) { params.color = state.frame; params.glass = state.glass; }
    } else {
      params = { tab: 'windows', style: state.wstyle, color: state.frame, glass: state.glass, grille: state.grille, note: note };
    }
    return '/estimate/?' + new URLSearchParams(params).toString();
  }

  function prefillText() {
    return 'HOME VISUALIZER CONFIGURATION\nBase home: ' + HOMES[state.homeIdx].name +
      '\nWindows: ' + byId(WSTYLES, state.wstyle).n + ' · ' + byId(FRAMES, state.frame).n + ' frame · ' +
      byId(GRILLES, state.grille).n + ' grille · ' + byId(GLASS, state.glass).n + ' glass' +
      '\nDoor: ' + byId(DSTYLES, state.dstyle).n + ' · ' + byId(DOORCOLORS, state.doorColor).n +
      '\nSiding: ' + byId(SIDING, state.siding).n + ' · Trim: ' + byId(TRIMS, state.trim).n + ' · Roof: ' + byId(ROOFS, state.roof).n;
  }

  /* ---------- full render of the surrounding UI ---------- */
  function renderAll() {
    els.demoTab.setAttribute('aria-selected', state.mode === 'demo' ? 'true' : 'false');
    els.uploadTab.setAttribute('aria-selected', state.mode === 'upload' ? 'true' : 'false');
    els.homes.style.display = state.mode === 'demo' ? '' : 'none';
    els.uploadPanel.classList.toggle('is-active', state.mode === 'upload');
    els.status.textContent = state.status;

    els.homes.querySelectorAll('.viz-home-btn').forEach(function (btn, i) {
      btn.setAttribute('aria-selected', i === state.homeIdx ? 'true' : 'false');
    });

    els.panelTitle.textContent = labelFor(state.selected);
    els.panelHint.textContent = state.selected === 'windows'
      ? 'These four choices apply to every window on the elevation.'
      : state.selected === 'door' ? 'Entry and patio configurations swap the whole unit, not just its color.'
      : 'Pick a color. The change previews immediately on the canvas.';

    els.zoneGrid.querySelectorAll('.viz-zone-btn').forEach(function (btn) {
      btn.setAttribute('aria-pressed', btn.getAttribute('data-zone') === state.selected ? 'true' : 'false');
    });

    els.controls.innerHTML = '';
    if (state.selected === 'windows') {
      els.controls.appendChild(ctrl('Window style', WSTYLES, state.wstyle, 'wstyle'));
      els.controls.appendChild(ctrl('Frame color', FRAMES, state.frame, 'frame'));
      els.controls.appendChild(ctrl('Grille pattern', GRILLES, state.grille, 'grille'));
      els.controls.appendChild(ctrl('Glass', GLASS, state.glass, 'glass'));
    } else if (state.selected === 'door') {
      els.controls.appendChild(ctrl('Door style', DSTYLES, state.dstyle, 'dstyle'));
      els.controls.appendChild(ctrl('Slab color', DOORCOLORS, state.doorColor, 'doorColor', 'swatch'));
      els.controls.appendChild(ctrl('Glass', GLASS, state.glass, 'glass'));
    } else if (state.selected === 'siding') {
      els.controls.appendChild(ctrl('Siding color', SIDING, state.siding, 'siding', 'swatch'));
    } else if (state.selected === 'roof') {
      els.controls.appendChild(ctrl('Roof color', ROOFS, state.roof, 'roof', 'swatch'));
    } else {
      els.controls.appendChild(ctrl('Trim color', TRIMS, state.trim, 'trim', 'swatch'));
    }

    var narrow = window.matchMedia('(max-width: 900px)').matches;
    els.panel.classList.toggle('is-open', narrow && state.sheetOpen);
    els.sheetTrigger.classList.toggle('is-hidden', !(narrow && !state.sheetOpen));
    els.sheetTrigger.textContent = 'Change ' + labelFor(state.selected).toLowerCase();

    var href = estimateHref();
    if (els.estimateLink) els.estimateLink.setAttribute('href', href);
    if (els.estimateLink2) els.estimateLink2.setAttribute('href', href);
    if (els.desc) els.desc.value = prefillText();

    draw();
  }

  /* ---------- wire up static controls ---------- */
  els.demoTab.addEventListener('click', function () { state.mode = 'demo'; state.status = 'Tap a part of the house, or use the list on the right.'; renderAll(); });
  els.uploadTab.addEventListener('click', function () { state.mode = 'upload'; state.status = img ? 'Pick a zone on the right, then tap its four corners.' : 'Choose a photo to begin.'; renderAll(); });

  HOMES.forEach(function (h, i) {
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'viz-home-btn'; btn.setAttribute('role', 'tab');
    btn.textContent = h.name;
    btn.addEventListener('click', function () { state.homeIdx = i; state.status = h.name + ' selected.'; renderAll(); });
    els.homes.appendChild(btn);
  });

  ['windows', 'door', 'siding', 'trim', 'roof'].forEach(function (id) {
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'viz-zone-btn'; btn.setAttribute('data-zone', id);
    btn.textContent = labelFor(id);
    btn.addEventListener('click', function () {
      state.selected = id;
      state.status = state.mode === 'upload' && img && id !== 'door'
        ? 'Tap the four corners of the ' + labelFor(id).toLowerCase() + ' area.'
        : labelFor(id) + ' selected.';
      renderAll();
    });
    els.zoneGrid.appendChild(btn);
  });

  canvas.addEventListener('click', onClick);
  els.closeBtn.addEventListener('click', function () { state.sheetOpen = false; renderAll(); });
  els.sheetTrigger.addEventListener('click', function () { state.sheetOpen = true; renderAll(); });

  els.resetBtn.addEventListener('click', function () {
    Object.assign(state, {
      siding: 'sandstone', trim: 'white', roof: 'charcoal', doorColor: 'black',
      wstyle: 'doublehung', frame: 'white', grille: 'none', glass: 'standard', dstyle: 'single',
      userWindows: [], userZones: { siding: null, trim: null, roof: null }, tracing: [], status: 'Reset to the base home.'
    });
    renderAll();
  });

  els.downloadBtn.addEventListener('click', function () {
    var a = document.createElement('a');
    a.download = 'northern-pines-visualizer.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
  });

  els.pickFileBtn.addEventListener('click', function () { els.fileInput.click(); });
  els.fileInput.addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    var image = new Image();
    image.onload = function () {
      img = image;
      state.userWindows = []; state.userZones = { siding: null, trim: null, roof: null }; state.tracing = [];
      state.status = 'Photo loaded. Pick a zone on the right, then tap its four corners.';
      renderAll();
    };
    image.src = URL.createObjectURL(f);
  });
  els.undoBtn.addEventListener('click', function () {
    state.tracing = [];
    if (state.selected === 'windows') {
      state.userWindows = state.userWindows.slice(0, -1);
      state.status = 'Last opening removed.';
    } else if (state.userZones[state.selected]) {
      state.userZones[state.selected] = null;
      state.status = labelFor(state.selected) + ' area removed.';
    } else {
      state.status = 'Nothing to undo for this zone.';
    }
    renderAll();
  });

  window.matchMedia('(max-width: 900px)').addEventListener('change', renderAll);

  var params = new URLSearchParams(location.search);
  var s = params.get('style');
  if (s && WSTYLES.some(function (w) { return w.id === s; })) { state.wstyle = s; state.selected = 'windows'; }
  else if (s && DSTYLES.some(function (d) { return d.id === s; })) { state.dstyle = s; state.selected = 'door'; }

  renderAll();
})();

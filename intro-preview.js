/* Local preview only — not committed. A bar of buttons that plays each intro. */
(function () {
  var bar = document.createElement('div');
  bar.setAttribute('style', 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:999;display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center;padding:10px 12px;border-radius:999px;background:#111;color:#fff;font:600 14px/1.2 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.35);max-width:calc(100vw - 32px)');
  bar.innerHTML = '<span style="opacity:.7;padding:0 6px">Intro preview</span>';
  [['A · Headline', 'roll', 0], ['B · Tiles', 'tiles', 0], ['C · House', 'house', 1]].forEach(function (o) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = '▶ ' + o[0];
    b.setAttribute('style', 'all:unset;cursor:pointer;padding:8px 14px;border-radius:999px;background:#2b3a30;color:#fff');
    b.addEventListener('click', function () {
      var target = o[2] ? document.querySelector('.anatomy') : document.querySelector('.hero');
      target.scrollIntoView({ behavior: 'instant', block: o[2] ? 'center' : 'start' });
      setTimeout(function () { window.NPIntro[o[1]](); }, 150);
    });
    bar.appendChild(b);
  });
  document.body.appendChild(bar);
})();

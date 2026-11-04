/* Home page: a short introduction to the six services, run with Motion
   (js/vendor/motion/motion-mini.js). Three ways to do it, to choose from:

     roll   the headline names each service in turn, "Transform and protect
            your roof … windows … concrete … home", lighting the matching
            tile beside it as it goes
     tiles  the six service tiles slide in one after another
     house  on the "One contractor" band, each part of the drawn house
            lights up in turn with its label, then the whole outside at once

   Each runs once, is over in under five seconds and only fades or moves a
   few pixels. Without JavaScript, without Motion or with reduced motion
   the page shows exactly as written. */
(function () {
  if (!window.Motion) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var animate = Motion.animate, stagger = Motion.stagger;

  var SERVICES = [
    { word: 'roof', href: '/roofing/', part: 'roof' },
    { word: 'windows', href: '/windows/', part: 'window' },
    { word: 'gutters', href: '/gutters/', part: 'gutter' },
    { word: 'siding', href: '/siding/', part: 'siding' },
    { word: 'doors', href: '/doors/', part: 'door' },
    { word: 'concrete', href: '/concrete/', part: 'concrete' }
  ];

  function wait(ms) { return new Promise(function (done) { setTimeout(done, ms); }); }
  function each(list, step) {
    return list.reduce(function (p, item, i) { return p.then(function () { return step(item, i); }); }, Promise.resolve());
  }

  /* ---------- roll: the headline names each service ---------- */
  function roll() {
    var h = document.getElementById('hero-h');
    var links = document.querySelector('.hero__links');
    if (!h || !links) return Promise.resolve();
    var word = h.querySelector('.roll__word');
    if (!word) {
      // The visible word is hidden from screen readers, which keep reading
      // the headline as written.
      var last = h.lastChild;
      last.textContent = last.textContent.replace(/home\s*$/, '');
      var roller = document.createElement('span');
      roller.className = 'roll';
      roller.setAttribute('aria-hidden', 'true');
      roller.innerHTML = '<span class="roll__word">home</span>';
      var spoken = document.createElement('span');
      spoken.className = 'sr-only';
      spoken.textContent = 'home';
      h.appendChild(roller);
      h.appendChild(spoken);
      word = roller.firstChild;
    }
    var lit = null;
    function light(href) {
      if (lit) lit.classList.remove('is-lit');
      lit = href ? links.querySelector('.np-tile[href="' + href + '"]') : null;
      if (lit) lit.classList.add('is-lit');
    }
    function show(text, href) {
      return animate(word, { opacity: [1, 0], transform: ['translateY(0)', 'translateY(-0.12em)'] }, { duration: 0.14, ease: 'easeIn' })
        .then(function () {
          word.textContent = text;
          light(href);
          return animate(word, { opacity: [0, 1], transform: ['translateY(0.12em)', 'translateY(0)'] }, { duration: 0.2, ease: 'easeOut' });
        });
    }
    return wait(400)
      .then(function () {
        return each(SERVICES, function (s) { return show(s.word, s.href).then(function () { return wait(300); }); });
      })
      .then(function () { return show('home', null); });
  }

  /* ---------- tiles: the service tiles slide in one by one ---------- */
  function tiles() {
    var links = document.querySelector('.hero__links');
    if (!links) return Promise.resolve();
    var head = links.querySelector('.hero__links-h');
    var all = links.querySelectorAll('.np-tile');
    animate(head, { opacity: [0, 1] }, { duration: 0.24, ease: 'easeOut' });
    return animate(all, { opacity: [0, 1], transform: ['translateX(24px)', 'translateX(0)'] },
      { duration: 0.32, delay: stagger(0.08, { startDelay: 0.15 }), ease: 'easeOut' });
  }

  /* ---------- house: each part of the drawing lights up in turn ---------- */
  function house() {
    var fig = document.querySelector('.anatomy');
    if (!fig) return Promise.resolve();
    var tags = SERVICES.map(function (s) { return fig.querySelector('.anatomy__tag[data-part="' + s.part + '"]'); });
    if (tags.indexOf(null) !== -1) return Promise.resolve();
    tags.forEach(function (t) { t.style.opacity = 0; });
    return each(SERVICES, function (s, i) {
      var prev = SERVICES[i - 1];
      if (prev) { fig.style.removeProperty('--hl-' + prev.part); tags[i - 1].classList.remove('is-lit'); }
      fig.style.setProperty('--hl-' + s.part, 1);
      tags[i].classList.add('is-lit');
      animate(tags[i], { opacity: [0, 1], transform: ['translate(-50%, -30%)', 'translate(-50%, -50%)'] }, { duration: 0.24, ease: 'easeOut' });
      return wait(520);
    }).then(function () {
      // The whole outside at once: one contractor for all of it.
      tags[tags.length - 1].classList.remove('is-lit');
      SERVICES.forEach(function (s) { fig.style.setProperty('--hl-' + s.part, 1); });
      return wait(1000);
    }).then(function () {
      SERVICES.forEach(function (s) { fig.style.removeProperty('--hl-' + s.part); });
      tags.forEach(function (t) { t.style.removeProperty('opacity'); t.style.removeProperty('transform'); });
    });
  }

  window.NPIntro = { roll: roll, tiles: tiles, house: house };
})();

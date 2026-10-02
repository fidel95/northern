/* Northern Pines — shared page behaviour. Every block looks for its own
   markup and does nothing when the page doesn't carry it, so one file
   serves every page.

   Every page is built from /design-system/ and carries the same .site-head
   header. */
(function () {
  var desktop = window.matchMedia('(min-width: 941px)');

  /* ---------- Design-system header: Services menu ---------- */
  (function () {
    var toggle = document.querySelector('.site-nav__toggle');
    if (!toggle) return;
    var group = toggle.parentNode;
    var menu = document.getElementById(toggle.getAttribute('aria-controls'));
    var hoverTimer = null;

    function setOpen(open) {
      menu.hidden = !open;
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    var hoverOpenedAt = 0;
    toggle.addEventListener('click', function () {
      // A mouse reaches the button by hovering, which has already opened the
      // menu; that click should leave it open, not shut it again.
      if (!menu.hidden && Date.now() - hoverOpenedAt < 600) return;
      setOpen(menu.hidden);
    });
    group.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hidden) { setOpen(false); toggle.focus(); }
    });
    // Tabbing out of the menu closes it, rather than leaving it open over
    // whatever the keyboard has moved on to.
    group.addEventListener('focusout', function (e) {
      if (!group.contains(e.relatedTarget)) setOpen(false);
    });
    document.addEventListener('click', function (e) {
      if (!menu.hidden && !group.contains(e.target)) setOpen(false);
    });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });

    // With a mouse, open on hover as people expect; a short grace period
    // stops it snapping shut on the way from the button to the panel.
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      group.addEventListener('mouseenter', function () {
        clearTimeout(hoverTimer);
        if (menu.hidden) hoverOpenedAt = Date.now();
        setOpen(true);
      });
      group.addEventListener('mouseleave', function () {
        hoverTimer = setTimeout(function () { setOpen(false); }, 160);
      });
    }
  })();

  /* ---------- Design-system header: mobile drawer ---------- */
  (function () {
    var burger = document.querySelector('.site-head__burger');
    if (!burger) return;
    var drawer = document.getElementById(burger.getAttribute('aria-controls'));

    function setOpen(open) {
      drawer.hidden = !open;
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    burger.addEventListener('click', function () { setOpen(drawer.hidden); });
    drawer.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !drawer.hidden) { setOpen(false); burger.focus(); }
    });
    desktop.addEventListener('change', function (e) { if (e.matches) setOpen(false); });
  })();

  /* ---------- Atmosphere: fog and pines on the photo heroes ----------
     css/site.css holds the motion; this decides whether it runs. Not at all
     with reduced motion. Otherwise each hero gets its fog layers and a Pause
     button (the choice is remembered), and stops moving while off screen. */
  (function () {
    var heroes = Array.prototype.slice.call(document.querySelectorAll('.np-hero, .page-hero'));
    if (!heroes.length) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var root = document.documentElement;
    var KEY = 'np-motion-paused';
    var paused = false;
    try { paused = window.localStorage.getItem(KEY) === '1'; } catch (e) {}

    var SVG = 'http://www.w3.org/2000/svg';
    function icon(cls, d) {
      var s = document.createElementNS(SVG, 'svg');
      s.setAttribute('class', 'icon ' + cls); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
      var p = document.createElementNS(SVG, 'path'); p.setAttribute('d', d); s.appendChild(p);
      return s;
    }
    var toggles = [];
    function setPaused(v) {
      paused = v;
      root.classList.toggle('motion-paused', v);
      toggles.forEach(function (t) {
        t.setAttribute('aria-pressed', v ? 'true' : 'false');
        t.lastChild.textContent = v ? 'Play motion' : 'Pause motion';
      });
      try { window.localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) {}
    }

    var watch = [];
    heroes.forEach(function (hero) {
      var fog = document.createElement('div');
      fog.className = 'fog';
      fog.setAttribute('aria-hidden', 'true');
      ['low', 'mid', 'high'].forEach(function (k) {
        var l = document.createElement('div'); l.className = 'fog__layer fog__layer--' + k; fog.appendChild(l);
      });
      var veil = document.createElement('div'); veil.className = 'fog__veil'; fog.appendChild(veil);
      hero.insertBefore(fog, hero.firstChild);

      var t = document.createElement('button');
      t.type = 'button'; t.className = 'motion-toggle';
      t.appendChild(icon('icon-pause', 'M9 6v12M15 6v12'));
      t.appendChild(icon('icon-play', 'M8 5.5v13l10-6.5z'));
      t.appendChild(document.createElement('span'));
      t.addEventListener('click', function () { setPaused(!paused); });
      hero.appendChild(t);
      toggles.push(t);
      watch.push(hero);

      // The home hero's trees belong to the section after it.
      var next = hero.nextElementSibling;
      var line = next && next.querySelector(':scope > .treeline');
      if (line) { line.classList.add('treeline--sway'); watch.push(line); }
    });

    setPaused(paused);
    root.classList.add('motion-ok');

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { e.target.classList.toggle('is-idle', !e.isIntersecting); });
      });
      watch.forEach(function (el) { io.observe(el); });
    }
  })();

  /* ---------- Before / after comparison ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('.ba'), function (ba) {
    var range = ba.querySelector('.ba__range');
    if (!range) return;
    function update() {
      var v = Math.round(+range.value);
      ba.style.setProperty('--v', v / 100);
      range.setAttribute('aria-valuetext', v + '% before, ' + (100 - v) + '% after');
    }
    range.addEventListener('input', update);
    update();
  });

  /* ---------- Tabs (projects by service) ----------
     Without JavaScript every panel shows, each under its own heading, and
     the tab row stays hidden. */
  Array.prototype.forEach.call(document.querySelectorAll('[role="tablist"]'), function (list) {
    var tabs = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));
    var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute('aria-controls')); });
    if (!tabs.length || panels.indexOf(null) !== -1) return;

    function select(i, focus) {
      tabs.forEach(function (t, j) {
        var on = i === j;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        panels[j].hidden = !on;
      });
      if (focus) tabs[i].focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(i, false); });
    });
    list.addEventListener('keydown', function (e) {
      var i = tabs.indexOf(document.activeElement);
      if (i === -1) return;
      var next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (next === undefined) return;
      e.preventDefault();
      select((next + tabs.length) % tabs.length, true);
    });

    var start = tabs.findIndex(function (t) { return t.getAttribute('aria-selected') === 'true'; });
    select(start === -1 ? 0 : start, false);
    list.hidden = false;
    (list.closest('section') || list.parentNode).classList.add('has-tabs');
  });

  /* ---------- Estimate form ----------
     Web-to-Lead only keeps fields Salesforce knows, so the services ticked
     here travel inside the description, ahead of whatever was typed. */
  (function () {
    var form = document.querySelector('.estimate-form');
    if (!form) return;
    var desc = form.querySelector('[name="description"]');
    var boxes = Array.prototype.slice.call(form.querySelectorAll('.svc-pick input[type="checkbox"]'));
    // Which page sent the lead. Each page's form names itself in
    // data-source; the home page's form has none.
    var TAG = form.getAttribute('data-source') || 'Home page estimate request';

    function tick(name) {
      boxes.forEach(function (b) {
        if (b.value.toLowerCase() === String(name).toLowerCase()) b.checked = true;
      });
    }
    // "Get a free roofing estimate" and friends pre-tick their service, as
    // does a link from elsewhere ending in ?service=roofing#estimate.
    Array.prototype.forEach.call(document.querySelectorAll('a[data-service]'), function (a) {
      a.addEventListener('click', function () { tick(a.getAttribute('data-service')); });
    });
    var fromUrl = new URLSearchParams(window.location.search).get('service');
    if (fromUrl) tick(fromUrl);

    form.addEventListener('submit', function () {
      if (!desc) return;
      // Strip what an earlier submit added, in case someone comes back to
      // the page and sends it again.
      var typed = desc.value.replace(new RegExp('^' + TAG + '\\n(Projects: .*\\n)?\\n?'), '').trim();
      var picked = boxes.filter(function (b) { return b.checked; }).map(function (b) { return b.value; });
      var head = TAG + '\n' + (picked.length ? 'Projects: ' + picked.join(', ') + '\n' : '');
      desc.value = head + (typed ? '\n' + typed : '');
    });
  })();
})();

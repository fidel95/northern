/* Northern Pines — shared page behaviour. Every block looks for its own
   markup and does nothing when the page doesn't carry it, so one file
   serves every page.

   Two headers live side by side while the site moves to the design system:
   .site-header on pages still on css/base.css, and .site-head on pages
   built from /design-system/. */
(function () {
  var desktop = window.matchMedia('(min-width: 941px)');

  /* ---------- Legacy header drawer (pages not yet redesigned) ---------- */
  (function () {
    var header = document.querySelector('.site-header');
    if (!header) return;
    var burger = header.querySelector('.site-header__burger');
    var drawer = header.querySelector('.site-header__drawer');
    var mq = window.matchMedia('(max-width: 1080px)');
    var closeDrawer = function () {
      drawer.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
    };
    burger.addEventListener('click', function () {
      var open = drawer.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    mq.addEventListener('change', function (e) { if (!e.matches) closeDrawer(); });
  })();

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
    toggle.addEventListener('click', function () { setOpen(menu.hidden); });
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
      group.addEventListener('mouseenter', function () { clearTimeout(hoverTimer); setOpen(true); });
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
    var TAG = 'Home page estimate request';

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

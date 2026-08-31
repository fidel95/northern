(function () {
  var root = document.querySelector('[data-estimate]');
  if (!root) return;

  // Windows: flat Good/Better/Best tiers — the single source of truth for
  // window pricing site-wide. No per-style/per-option pricing anymore; every
  // operating style, frame color, glass package, and grille is available
  // within each tier (configured visually in the Visualizer), not priced
  // separately.
  var WINDOW_TIERS = [
    { id: 'good', name: 'Good', price: 850, features: ['Professional installation included', '10-year warranty'] },
    { id: 'better', name: 'Better', price: 1200, features: ['Professional installation included', '20-year warranty'], badge: 'Most Popular' },
    { id: 'best', name: 'Best', price: 1600, features: ['Professional installation included', 'Lifetime warranty'] }
  ];

  // Patio and entry doors keep their existing per-option pricing model —
  // out of scope for the window tier rework.
  var PRICING = {
    sizes: [
      { id: 'small', name: 'Small', sub: 'up to 3×4 ft', mult: 0.85 },
      { id: 'standard', name: 'Standard', sub: '~3×5 ft', mult: 1.0 },
      { id: 'large', name: 'Large', sub: 'up to 4×6 ft', mult: 1.25 },
      { id: 'xl', name: 'Extra Large', sub: '4×6 ft +', mult: 1.5 }
    ],
    frameColors: [
      { id: 'white', name: 'White', hex: '#FFFFFF', add: 0 },
      { id: 'black', name: 'Black', hex: '#1B1C1E', add: 45 },
      { id: 'bronze', name: 'Bronze', hex: '#7A5C3E', add: 65 },
      { id: 'gray', name: 'Stone Gray', hex: '#55555d', add: 45 }
    ],
    glass: [
      { id: 'standard', name: 'Standard Low-E', add: 0 },
      { id: 'triple', name: 'Triple-Pane Energy', add: 95 },
      { id: 'tinted', name: 'Tinted / Privacy', add: 60 }
    ],
    patioStyles: [
      { id: 'sliding', name: 'Sliding', price: 1450 },
      { id: 'french', name: 'Hinged / French', price: 2100 },
      { id: 'multislide', name: 'Multi-Slide', price: 3200 }
    ],
    entryStyles: [
      { id: 'single', name: 'Single Door', price: 1350 },
      { id: 'double', name: 'Double Door', price: 2600 },
      { id: 'sidelights', name: 'With Sidelights', price: 1900 }
    ],
    entryFinish: [
      { id: 'paint', name: 'Paint-Grade', add: 0 },
      { id: 'stain', name: 'Stain-Grade Wood Look', add: 220 },
      { id: 'fiberglass', name: 'Premium Fiberglass', add: 180 }
    ],
    entryHardware: [
      { id: 'standard', name: 'Standard', add: 0 },
      { id: 'designer', name: 'Designer Hardware', add: 85 }
    ]
  };

  var RANGE_SPREAD = 12;
  var initialNote = '';
  var money = function (n) { return '$' + Math.round(n).toLocaleString('en-US'); };
  var find = function (list, id) { return list.filter(function (x) { return x.id === id; })[0] || list[0]; };

  var state = {
    tab: 'windows',
    win: { tier: 'better' },
    winQty: 1,
    patio: { style: 'sliding', size: 'standard', color: 'white', glass: 'standard' },
    entry: { style: 'single', finish: 'paint', hardware: 'standard' },
    qty: 1,
    cart: []
  };

  var els = {
    tabs: root.querySelector('.est-tabs'),
    groups: root.querySelector('.est-groups'),
    qtyRow: root.querySelector('.est-qty-row'),
    qtyNum: root.querySelector('.est-qty-num'),
    unitLabel: root.querySelector('.est-unit-label'),
    unitPrice: root.querySelector('.est-unit-price'),
    addBtn: root.querySelector('.est-add-btn'),
    note: root.querySelector('.est-note'),
    dec: root.querySelector('.est-qty-dec'),
    inc: root.querySelector('.est-qty-inc'),
    cartHead: root.querySelector('.est-cart__head h2'),
    cartCount: root.querySelector('.est-cart__count'),
    cartBody: root.querySelector('.est-cart__body'),
    rangeBlock: root.querySelector('.est-cart__range'),
    rangeLabel: root.querySelector('.est-cart__range-label'),
    rangeText: root.querySelector('.est-cart__range-value'),
    rangeNote: root.querySelector('.est-cart__range-note'),
    desc: document.getElementById('description-estimate')
  };

  function unitPrice() {
    var t = state.tab;
    if (t === 'patio') {
      var p = state.patio;
      return find(PRICING.patioStyles, p.style).price * find(PRICING.sizes, p.size).mult
        + find(PRICING.frameColors, p.color).add + find(PRICING.glass, p.glass).add;
    }
    var e = state.entry;
    return find(PRICING.entryStyles, e.style).price
      + find(PRICING.entryFinish, e.finish).add + find(PRICING.entryHardware, e.hardware).add;
  }

  function noun() { return state.tab === 'patio' ? 'patio door' : 'entry door'; }

  function makeOptBtn(o, bucket, key, activeId, kind) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'est-opt';
    var selected = o.id === activeId;
    btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
    var nameWrap = document.createElement('span');
    nameWrap.className = 'est-opt__name';
    if (o.hex) {
      var sw = document.createElement('span');
      sw.className = 'est-opt__swatch';
      sw.style.background = o.hex;
      nameWrap.appendChild(sw);
    }
    nameWrap.appendChild(document.createTextNode(o.name));
    btn.appendChild(nameWrap);
    var priceEl = document.createElement('span');
    priceEl.className = 'est-opt__price';
    priceEl.textContent = kind === 'size' ? o.sub : (o.price !== undefined ? money(o.price) : (o.add > 0 ? '+' + money(o.add) : 'Included'));
    btn.appendChild(priceEl);
    btn.addEventListener('click', function () {
      state[bucket][key] = o.id;
      render();
    });
    return btn;
  }

  function group(label, list, activeId, bucket, key, kind) {
    var fieldset = document.createElement('fieldset');
    fieldset.className = 'est-group';
    var legend = document.createElement('legend');
    legend.textContent = label;
    fieldset.appendChild(legend);
    var grid = document.createElement('div');
    grid.className = 'est-options';
    list.forEach(function (o) { grid.appendChild(makeOptBtn(o, bucket, key, activeId, kind)); });
    fieldset.appendChild(grid);
    return fieldset;
  }

  function addToCart() {
    var unit = unitPrice();
    var title, meta;
    if (state.tab === 'patio') {
      var p = state.patio;
      title = find(PRICING.patioStyles, p.style).name + ' Patio Door';
      meta = [find(PRICING.sizes, p.size).name, find(PRICING.frameColors, p.color).name + ' frame',
        find(PRICING.glass, p.glass).name].join(' · ');
    } else {
      var e = state.entry;
      title = find(PRICING.entryStyles, e.style).name;
      meta = [find(PRICING.entryFinish, e.finish).name, find(PRICING.entryHardware, e.hardware).name + ' hardware'].join(' · ');
    }
    state.cart.push({ key: Date.now() + Math.random(), title: title, meta: meta, qty: state.qty, unit: unit, subtotal: unit * state.qty });
    state.qty = 1;
    render();
  }

  // --- Windows: Good/Better/Best tier comparison -----------------------

  function renderWindowsTiers() {
    var wrap = document.createElement('div');
    wrap.className = 'est-tiers';

    WINDOW_TIERS.forEach(function (t) {
      var selected = t.id === state.win.tier;
      var card = document.createElement('div');
      card.className = 'est-tier-card' + (selected ? ' is-selected' : '') + (t.badge ? ' est-tier-card--featured' : '');

      if (t.badge) {
        var badge = document.createElement('span');
        badge.className = 'est-tier-card__badge';
        badge.textContent = t.badge;
        card.appendChild(badge);
      }

      var name = document.createElement('span');
      name.className = 'est-tier-card__name';
      name.textContent = t.name;
      card.appendChild(name);

      var price = document.createElement('div');
      price.className = 'est-tier-card__price';
      price.innerHTML = money(t.price) + '<small>/window</small>';
      card.appendChild(price);

      var feats = document.createElement('ul');
      feats.className = 'est-tier-card__features';
      t.features.forEach(function (f) {
        var li = document.createElement('li');
        li.textContent = f;
        feats.appendChild(li);
      });
      card.appendChild(feats);

      var total = document.createElement('div');
      total.className = 'est-tier-card__total';
      total.innerHTML = money(t.price * state.winQty) + ' <span>total for ' + state.winQty + (state.winQty === 1 ? ' window' : ' windows') + '</span>';
      card.appendChild(total);

      var selectBtn = document.createElement('button');
      selectBtn.type = 'button';
      selectBtn.className = 'est-tier-card__select';
      selectBtn.setAttribute('aria-pressed', selected ? 'true' : 'false');
      selectBtn.textContent = selected ? 'Selected' : 'Select ' + t.name;
      selectBtn.addEventListener('click', function () {
        state.win.tier = t.id;
        render();
      });
      card.appendChild(selectBtn);

      wrap.appendChild(card);
    });

    els.groups.appendChild(wrap);

    var qtyRow = document.createElement('div');
    qtyRow.className = 'est-qty-row est-qty-row--tiers';
    qtyRow.innerHTML =
      '<div><span class="est-qty-label">Number of windows</span>' +
      '<div class="est-qty-controls">' +
      '<button type="button" class="est-qty-btn" data-win-dec aria-label="Decrease number of windows">−</button>' +
      '<span class="est-qty-num">' + state.winQty + '</span>' +
      '<button type="button" class="est-qty-btn" data-win-inc aria-label="Increase number of windows">+</button>' +
      '</div></div>';
    els.groups.appendChild(qtyRow);
    qtyRow.querySelector('[data-win-dec]').addEventListener('click', function () { state.winQty = Math.max(1, state.winQty - 1); render(); });
    qtyRow.querySelector('[data-win-inc]').addEventListener('click', function () { state.winQty = Math.min(60, state.winQty + 1); render(); });

    var disclaimer = document.createElement('p');
    disclaimer.className = 'est-note est-tier-disclaimer';
    disclaimer.textContent = 'Final pricing is confirmed after an on-site measurement.';
    els.groups.appendChild(disclaimer);
  }

  function renderWindowsAside() {
    var tier = find(WINDOW_TIERS, state.win.tier);
    var total = tier.price * state.winQty;

    els.cartHead.textContent = 'Your windows';
    els.cartCount.textContent = state.winQty + (state.winQty === 1 ? ' WINDOW' : ' WINDOWS');

    els.cartBody.innerHTML = '';
    var row = document.createElement('div');
    row.className = 'est-cart__item';
    row.innerHTML =
      '<div style="min-width:0"><strong class="est-cart__item-title">' + state.winQty + '&times; ' + tier.name + ' Tier Window' + (state.winQty === 1 ? '' : 's') + '</strong>' +
      '<span class="est-cart__item-meta">' + tier.features.join(' · ') + ' · ' + money(tier.price) + ' each</span></div>' +
      '<div class="est-cart__item-right"><span class="est-cart__item-sub">' + money(total) + '</span></div>';
    els.cartBody.appendChild(row);

    els.rangeBlock.style.display = '';
    els.rangeLabel.textContent = 'YOUR TOTAL, INSTALLED';
    els.rangeText.textContent = money(total);
    els.rangeNote.textContent = 'Final pricing is confirmed after an on-site measurement.';
  }

  function updateDescriptionForWindows() {
    if (!els.desc) return;
    var tier = find(WINDOW_TIERS, state.win.tier);
    var total = tier.price * state.winQty;
    els.desc.value = 'INSTANT ESTIMATE\n' +
      state.winQty + '× ' + tier.name + ' tier window' + (state.winQty === 1 ? '' : 's') + ' (' + money(tier.price) + '/window, ' + tier.features.join(' · ') + ')\n' +
      'Estimated total: ' + money(total) + '\n' +
      '(Final pricing is confirmed after an on-site measurement.)' +
      (initialNote ? '\n\n' + initialNote : '');
  }

  // --- Shared render ------------------------------------------------------

  function render() {
    els.tabs.querySelectorAll('.est-tab').forEach(function (btn) {
      var on = btn.getAttribute('data-tab') === state.tab;
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });

    els.groups.innerHTML = '';

    if (state.tab === 'windows') {
      renderWindowsTiers();
      els.qtyRow.style.display = 'none';
      els.addBtn.style.display = 'none';
      els.note.style.display = 'none';
      renderWindowsAside();
      updateDescriptionForWindows();
      return;
    }

    els.qtyRow.style.display = '';
    els.addBtn.style.display = '';
    els.note.style.display = '';
    els.note.textContent = 'PRICING NOTE — door figures are illustrative placeholders pending the real cost book. Replace PRICING in js/estimate.js before launch.';
    els.cartHead.textContent = 'Your project';
    els.rangeLabel.textContent = 'ESTIMATED RANGE, INSTALLED';

    if (state.tab === 'patio') {
      var p = state.patio;
      els.groups.appendChild(group('Door type', PRICING.patioStyles, p.style, 'patio', 'style'));
      els.groups.appendChild(group('Size class', PRICING.sizes, p.size, 'patio', 'size', 'size'));
      els.groups.appendChild(group('Frame color', PRICING.frameColors, p.color, 'patio', 'color'));
      els.groups.appendChild(group('Glass package', PRICING.glass, p.glass, 'patio', 'glass'));
    } else {
      var e = state.entry;
      els.groups.appendChild(group('Configuration', PRICING.entryStyles, e.style, 'entry', 'style'));
      els.groups.appendChild(group('Slab finish', PRICING.entryFinish, e.finish, 'entry', 'finish'));
      els.groups.appendChild(group('Hardware', PRICING.entryHardware, e.hardware, 'entry', 'hardware'));
    }

    els.qtyNum.textContent = state.qty;
    els.unitLabel.textContent = 'Approx. per ' + noun() + ', installed';
    els.unitPrice.textContent = money(unitPrice());
    els.addBtn.textContent = 'Add ' + state.qty + ' ' + noun() + (state.qty > 1 ? 's' : '') + ' to estimate';

    els.cartCount.textContent = state.cart.reduce(function (a, c) { return a + c.qty; }, 0) + ' UNITS';
    els.cartBody.innerHTML = '';
    if (!state.cart.length) {
      var empty = document.createElement('p');
      empty.className = 'est-cart__empty';
      empty.textContent = 'Nothing added yet. Configure an opening on the left and add it — you can mix patio and entry doors in one estimate.';
      els.cartBody.appendChild(empty);
    } else {
      state.cart.forEach(function (c) {
        var row = document.createElement('div');
        row.className = 'est-cart__item';
        row.innerHTML =
          '<div style="min-width:0"><strong class="est-cart__item-title">' + c.qty + '&times; ' + c.title + '</strong>' +
          '<span class="est-cart__item-meta">' + c.meta + ' · ' + money(c.unit) + ' each</span></div>' +
          '<div class="est-cart__item-right"><span class="est-cart__item-sub">' + money(c.subtotal) + '</span>' +
          '<button type="button" class="est-cart__remove">REMOVE</button></div>';
        row.querySelector('.est-cart__remove').addEventListener('click', function () {
          state.cart = state.cart.filter(function (x) { return x.key !== c.key; });
          render();
        });
        els.cartBody.appendChild(row);
      });
    }

    var total = state.cart.reduce(function (a, c) { return a + c.subtotal; }, 0);
    var itemCount = state.cart.reduce(function (a, c) { return a + c.qty; }, 0);
    var low = total * (1 - RANGE_SPREAD / 100), high = total * (1 + (RANGE_SPREAD + 3) / 100);

    if (state.cart.length) {
      els.rangeBlock.style.display = '';
      els.rangeText.textContent = money(low) + ' – ' + money(high);
      els.rangeNote.textContent = 'Includes tear-out, installation, disposal, and the lifetime glass and frame warranty. Final pricing follows the on-site measure.';
    } else {
      els.rangeBlock.style.display = 'none';
    }

    if (els.desc) {
      if (state.cart.length) {
        els.desc.value = 'INSTANT ESTIMATE CART\n' +
          state.cart.map(function (c) { return c.qty + '× ' + c.title + ' — ' + c.meta + ' — ' + money(c.subtotal); }).join('\n') +
          '\n\nEstimated installed range: ' + money(low) + ' – ' + money(high) +
          '\n(' + itemCount + (itemCount === 1 ? ' unit' : ' units') + ' configured on the website.)' +
          (initialNote ? '\n\n' + initialNote : '');
      } else {
        els.desc.value = initialNote || 'Estimate page inquiry — no cart configured yet.';
      }
    }
  }

  els.tabs.querySelectorAll('.est-tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      state.tab = btn.getAttribute('data-tab');
      state.qty = 1;
      render();
    });
  });
  els.dec.addEventListener('click', function () { state.qty = Math.max(1, state.qty - 1); render(); });
  els.inc.addEventListener('click', function () { state.qty = Math.min(30, state.qty + 1); render(); });
  els.addBtn.addEventListener('click', addToCart);

  var params = new URLSearchParams(location.search);
  var tab = params.get('tab');
  var style = params.get('style');
  var color = params.get('color');
  var glass = params.get('glass');
  initialNote = params.get('note') || '';

  if (tab === 'windows' || tab === 'patio' || tab === 'entry') state.tab = tab;
  if (style) {
    if (PRICING.patioStyles.some(function (s) { return s.id === style; })) { state.tab = 'patio'; state.patio.style = style; }
    else if (PRICING.entryStyles.some(function (s) { return s.id === style; })) { state.tab = 'entry'; state.entry.style = style; }
  }
  if (color && PRICING.frameColors.some(function (c) { return c.id === color; }) && state.tab === 'patio') {
    state.patio.color = color;
  }
  if (glass && PRICING.glass.some(function (g) { return g.id === glass; }) && state.tab === 'patio') {
    state.patio.glass = glass;
  }

  render();
})();

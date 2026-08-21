(function () {
  var root = document.querySelector('[data-estimate]');
  if (!root) return;

  var PRICING = {
    windowStyles: [
      { id: 'doublehung', name: 'Double-Hung', price: 525 },
      { id: 'casement', name: 'Casement', price: 560 },
      { id: 'awning', name: 'Awning', price: 540 },
      { id: 'sliding', name: 'Sliding', price: 580 },
      { id: 'picture', name: 'Picture', price: 495 },
      { id: 'baybow', name: 'Bay & Bow', price: 2100 }
    ],
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
    grilles: [
      { id: 'none', name: 'None', add: 0 },
      { id: 'colonial', name: 'Colonial Grid', add: 35 },
      { id: 'craftsman', name: 'Craftsman', add: 45 }
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
  var money = function (n) { return '$' + Math.round(n).toLocaleString('en-US'); };
  var find = function (list, id) { return list.filter(function (x) { return x.id === id; })[0] || list[0]; };

  var state = {
    tab: 'windows',
    win: { style: 'doublehung', size: 'standard', color: 'white', glass: 'standard', grille: 'none' },
    patio: { style: 'sliding', size: 'standard', color: 'white', glass: 'standard' },
    entry: { style: 'single', finish: 'paint', hardware: 'standard' },
    qty: 1,
    cart: []
  };

  var els = {
    tabs: root.querySelector('.est-tabs'),
    groups: root.querySelector('.est-groups'),
    qtyNum: root.querySelector('.est-qty-num'),
    unitLabel: root.querySelector('.est-unit-label'),
    unitPrice: root.querySelector('.est-unit-price'),
    addBtn: root.querySelector('.est-add-btn'),
    dec: root.querySelector('.est-qty-dec'),
    inc: root.querySelector('.est-qty-inc'),
    cartCount: root.querySelector('.est-cart__count'),
    cartBody: root.querySelector('.est-cart__body'),
    rangeBlock: root.querySelector('.est-cart__range'),
    rangeText: root.querySelector('.est-cart__range-value'),
    rangeNote: root.querySelector('.est-cart__range-note'),
    desc: document.getElementById('description-estimate')
  };

  function unitPrice() {
    var t = state.tab;
    if (t === 'windows') {
      var w = state.win;
      return find(PRICING.windowStyles, w.style).price * find(PRICING.sizes, w.size).mult
        + find(PRICING.frameColors, w.color).add + find(PRICING.glass, w.glass).add
        + find(PRICING.grilles, w.grille).add;
    }
    if (t === 'patio') {
      var p = state.patio;
      return find(PRICING.patioStyles, p.style).price * find(PRICING.sizes, p.size).mult
        + find(PRICING.frameColors, p.color).add + find(PRICING.glass, p.glass).add;
    }
    var e = state.entry;
    return find(PRICING.entryStyles, e.style).price
      + find(PRICING.entryFinish, e.finish).add + find(PRICING.entryHardware, e.hardware).add;
  }

  function noun() { return state.tab === 'windows' ? 'window' : state.tab === 'patio' ? 'patio door' : 'entry door'; }

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
    if (state.tab === 'windows') {
      var w = state.win;
      title = find(PRICING.windowStyles, w.style).name + ' Window';
      meta = [find(PRICING.sizes, w.size).name, find(PRICING.frameColors, w.color).name + ' frame',
        find(PRICING.glass, w.glass).name, find(PRICING.grilles, w.grille).name + ' grille'].join(' · ');
    } else if (state.tab === 'patio') {
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

  function render() {
    els.tabs.querySelectorAll('.est-tab').forEach(function (btn) {
      var on = btn.getAttribute('data-tab') === state.tab;
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });

    els.groups.innerHTML = '';
    if (state.tab === 'windows') {
      var w = state.win;
      els.groups.appendChild(group('Operating style', PRICING.windowStyles, w.style, 'win', 'style'));
      els.groups.appendChild(group('Size class', PRICING.sizes, w.size, 'win', 'size', 'size'));
      els.groups.appendChild(group('Frame color', PRICING.frameColors, w.color, 'win', 'color'));
      els.groups.appendChild(group('Glass package', PRICING.glass, w.glass, 'win', 'glass'));
      els.groups.appendChild(group('Grille pattern', PRICING.grilles, w.grille, 'win', 'grille'));
    } else if (state.tab === 'patio') {
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
      empty.textContent = 'Nothing added yet. Configure an opening on the left and add it — you can mix windows and doors in one estimate.';
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
          '\n(' + itemCount + (itemCount === 1 ? ' unit' : ' units') + ' configured on the website.)';
      } else {
        els.desc.value = 'Estimate page inquiry — no cart configured yet.';
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
  if (tab === 'windows' || tab === 'patio' || tab === 'entry') state.tab = tab;
  if (style) {
    if (PRICING.windowStyles.some(function (s) { return s.id === style; })) { state.tab = 'windows'; state.win.style = style; }
    else if (PRICING.patioStyles.some(function (s) { return s.id === style; })) { state.tab = 'patio'; state.patio.style = style; }
    else if (PRICING.entryStyles.some(function (s) { return s.id === style; })) { state.tab = 'entry'; state.entry.style = style; }
  }

  render();
})();

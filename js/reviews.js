(function () {
  var buttons = document.querySelectorAll('.filter-btn');
  var cards = document.querySelectorAll('.review-card');
  var countEl = document.querySelector('.review-count');
  if (!buttons.length) return;

  function apply(filter, label) {
    var shown = 0;
    cards.forEach(function (c) {
      var match = filter === 'all' || c.getAttribute('data-cat') === filter;
      c.style.display = match ? '' : 'none';
      if (match) shown++;
    });
    if (countEl) countEl.textContent = 'SHOWING ' + shown + ' OF 340 · ' + label.toUpperCase();
  }

  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      buttons.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
      btn.setAttribute('aria-pressed', 'true');
      apply(btn.getAttribute('data-filter'), btn.textContent);
    });
  });
})();

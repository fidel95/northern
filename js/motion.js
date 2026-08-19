/* Northern Pines — shared scroll motion: parallax layers + section reveals.
   Self-initializing, idempotent, reduced-motion aware. */
(function () {
  if (window.__npMotion) return;
  window.__npMotion = true;

  function init() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var layers = Array.prototype.filter.call(document.querySelectorAll('[data-px]'), function (el) {
      if (el.__npPx) return false; el.__npPx = true; return true;
    }).map(function (el) {
      return { el: el, speed: parseFloat(el.getAttribute('data-px')) || 0 };
    });
    if (layers.length) {
      var queued = false;
      var onScroll = function () {
        if (queued) return;
        queued = true;
        requestAnimationFrame(function () {
          queued = false;
          var vh = window.innerHeight;
          layers.forEach(function (l) {
            var r = l.el.getBoundingClientRect();
            if (r.bottom < -vh || r.top > vh * 2) return;
            var offset = (r.top + r.height / 2 - vh / 2) * l.speed;
            l.el.style.transform = 'translate3d(0,' + offset.toFixed(1) + 'px,0)';
          });
        });
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll);
      onScroll();
    }

    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.style.opacity = '1';
        e.target.style.transform = 'none';
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.05 });

    Array.prototype.forEach.call(document.querySelectorAll('[data-reveal]'), function (el) {
      if (el.__npReveal) return;
      el.__npReveal = true;
      if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return; // already in view on load
      el.style.opacity = '0';
      el.style.transform = 'translateY(18px)';
      el.style.transition = 'opacity 240ms cubic-bezier(.22,.61,.36,1), transform 240ms cubic-bezier(.22,.61,.36,1)';
      io.observe(el);
    });
  }

  function boot() { init(); setTimeout(init, 1200); }
  if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(boot, 0);
  else document.addEventListener('DOMContentLoaded', boot);
})();

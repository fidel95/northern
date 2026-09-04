/* Northern Pines — header drawer, ported from the Claude Design prototype's
   per-component state logic to plain DOM. */
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

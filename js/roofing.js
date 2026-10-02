/* Roofing page: start each roof drawing when it scrolls into view, and let
   the Replay button run it again. css/roofing.css holds the animation;
   without this script, or with reduced motion, the finished drawings show. */
(function () {
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var arts = document.querySelectorAll('.roof-art');
  if (!arts.length) return;
  document.documentElement.classList.add('roof-anim');

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-playing');
      io.unobserve(e.target);
    });
  }, { threshold: 0.4 });

  Array.prototype.forEach.call(arts, function (art) {
    io.observe(art);
    var replay = art.querySelector('.roof-art__replay');
    if (!replay) return;
    replay.addEventListener('click', function () {
      art.classList.remove('is-playing');
      void art.getBoundingClientRect(); // restart the CSS animations
      art.classList.add('is-playing');
    });
  });
})();

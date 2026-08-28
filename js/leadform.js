/* Loads the reCAPTCHA widget script only once a lead form is actually
   about to be used — on scroll-proximity or on focus — instead of on
   every page load. api.js auto-renders any .g-recaptcha element present
   in the DOM at the moment it loads, so injecting it late is safe. */
(function () {
  var targets = document.querySelectorAll('.g-recaptcha');
  if (!targets.length) return;

  var loaded = false;
  function loadRecaptcha() {
    if (loaded) return;
    loaded = true;
    var s = document.createElement('script');
    s.src = 'https://www.google.com/recaptcha/api.js';
    s.async = true;
    s.defer = true;
    document.head.appendChild(s);
  }

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { loadRecaptcha(); io.disconnect(); }
      });
    }, { rootMargin: '600px 0px' });
    targets.forEach(function (t) { io.observe(t); });
  } else {
    loadRecaptcha();
  }

  document.querySelectorAll('.lead-form input, .lead-form textarea').forEach(function (el) {
    el.addEventListener('focus', loadRecaptcha, { once: true });
  });
})();

/* Keeps the Salesforce Web-to-Lead captcha_settings timestamp fresh. */
window.__npcsTimestamp = window.__npcsTimestamp || setInterval(function () {
  var field = document.getElementsByName('captcha_settings')[0];
  if (!field) return;
  var response = document.getElementById('g-recaptcha-response');
  if (response == null || response.value.trim() == '') {
    try {
      var elems = JSON.parse(field.value);
      elems['ts'] = JSON.stringify(new Date().getTime());
      field.value = JSON.stringify(elems);
    } catch (e) {}
  }
}, 500);

/* Loads the reCAPTCHA widget for the lead forms.

   It is the heaviest thing on any page that carries one — about 766KB across
   its script, its stylesheet and the Roboto face it pulls in, which is more
   than everything else on the page put together, and most visitors never fill
   a form in. See the comment on the triggers below for why it loads when it
   does. api.js auto-renders whatever .g-recaptcha elements it finds when it
   arrives, so injecting it late is safe.

   The space it will occupy is reserved in CSS, and marked as loading, so it
   neither shifts the layout nor reads as broken while it is on its way. */
(function () {
  var forms = document.querySelectorAll('.lead-form');
  if (!forms.length) return;

  var loaded = false;
  function loadRecaptcha(form) {
    if (form) form.classList.add('is-verifying');
    if (loaded) return;
    loaded = true;
    var s = document.createElement('script');
    s.src = 'https://www.google.com/recaptcha/api.js';
    s.async = true;
    s.defer = true;
    document.head.appendChild(s);
  }

  // Two triggers, because neither alone is right.
  //
  // Loading on scroll-proximity meant reading to the bottom of a page bought
  // the whole 766KB for someone who never intended to fill anything in.
  // Waiting for the first keystroke fixed that but moved the download after
  // it, and on a throttled phone the widget then took about 2.4 seconds to
  // become usable — the customer sees an empty box at exactly the moment
  // they are trying to finish.
  //
  // Preconnecting first was tried and is not the answer: it saved about 70ms,
  // because the cost here is the bytes, not the handshake.
  //
  // So: dwell, or touch. Someone who scrolls the form into view and stays
  // there for a moment is considering it, and gets the download started while
  // they read. Someone who scrolls straight past pays nothing. And anyone who
  // reaches a field before the dwell fires triggers it immediately anyway.
  var DWELL_MS = 1200;

  Array.prototype.forEach.call(forms, function (form) {
    function now() { loadRecaptcha(form); }
    form.addEventListener('focusin', now, { once: true });
    form.addEventListener('pointerdown', now, { once: true, passive: true });

    if (!('IntersectionObserver' in window)) { now(); return; }

    var timer = null;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          if (timer === null) {
            timer = setTimeout(function () { io.disconnect(); now(); }, DWELL_MS);
          }
        } else if (timer !== null) {
          clearTimeout(timer);
          timer = null;
        }
      });
    }, { threshold: 0.25 });
    io.observe(form);
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

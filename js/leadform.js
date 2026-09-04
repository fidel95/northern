/* Loads the reCAPTCHA widget only once someone actually engages with a lead
   form.

   It is the heaviest thing on any page that carries one — about 763KB across
   its script, its stylesheet and the Roboto face it pulls in, which is more
   than everything else on the page put together. It used to load on
   scroll-proximity with a 600px margin, so simply reading to the bottom of a
   page bought the whole download for a visitor who never intended to fill
   anything in. Most visitors never do.

   Now it waits for intent: the first focus or pointer-down anywhere in the
   form. That still leaves plenty of time, since nobody submits without first
   filling six fields, and api.js auto-renders any .g-recaptcha element
   present when it loads, so injecting it late is safe.

   The space it will occupy is reserved in CSS, so arriving late does not
   shove the submit button down the page under someone's thumb. */
(function () {
  var forms = document.querySelectorAll('.lead-form');
  if (!forms.length) return;

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

  Array.prototype.forEach.call(forms, function (form) {
    // focusin covers keyboard and assistive technology; pointerdown covers
    // a tap or click that has not resolved into a focus yet.
    form.addEventListener('focusin', loadRecaptcha, { once: true });
    form.addEventListener('pointerdown', loadRecaptcha, { once: true, passive: true });
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

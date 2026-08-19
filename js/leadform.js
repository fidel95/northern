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

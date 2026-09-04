/* Cloudflare Web Analytics.
 *
 * Cookieless and privacy-preserving: no cookies are set, no cross-site
 * identifiers are stored, and nothing here needs a consent banner. That is
 * what /privacy-policy/ now says, so keep the two in step if this is ever
 * swapped for something that does set cookies.
 *
 * TO SWITCH IT ON: open the Cloudflare dashboard, go to Web Analytics, add
 * npconstructionservices.com, and copy the token out of the snippet it shows
 * you (the value of data-cf-beacon). Paste it into TOKEN below — this one
 * file is loaded by every page, so there is nothing else to edit. Until a
 * token is present this loads nothing at all.
 */
(function () {
  var TOKEN = ''; // e.g. '0123456789abcdef0123456789abcdef'

  if (!TOKEN) return;

  var s = document.createElement('script');
  s.defer = true;
  s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  s.setAttribute('data-cf-beacon', JSON.stringify({ token: TOKEN }));
  document.head.appendChild(s);
})();

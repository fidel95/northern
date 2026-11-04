/* Giveaway entry form: bilingual (EN/ES) and chunked uploads to /api/giveaway/*.
   Files go through our own Worker into a private R2 bucket, in 8 MB pieces so
   a 300 MB phone video never hits a single-request size limit. */
(function () {
  'use strict';

  var API = '/api/giveaway';
  var CHUNK = 8 * 1024 * 1024;
  var TURNSTILE_SITEKEY = '0x4AAAAAAFzUYVgSgu_BaRnt';
  var MAX = { ownership: 10, income: 100, video: 500 };
  var DOC_EXT = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'heic', 'heif', 'webp'];
  var VID_EXT = ['mp4', 'mov', 'm4v', 'webm', '3gp'];

  /* ---------- Spanish copy. English is whatever the HTML already says. ---------- */
  var ES = {
    eyebrow: 'Sorteo de ventanas &middot; Formulario de participación',
    h1: 'Participe en nuestro sorteo de <em>ventanas</em>.',
    lede: 'Cuéntenos un poco sobre su hogar, suba dos documentos y envíenos un video corto. Toma unos 10 minutos.',
    s1: 'Sobre usted', first: 'Nombre', last: 'Apellido', phone: 'Teléfono', email: 'Correo electrónico',
    s2: 'Verificación de elegibilidad',
    s2help: 'Marque cada casilla que se aplique a usted.',
    c1: 'Soy dueño(a) de esta casa y vivo en ella (se requiere comprobante de propiedad)',
    c2: 'La propiedad está ubicada en el condado de Montgomery',
    c3: 'Mi hogar cumple con las pautas locales de bajos ingresos (se requiere comprobante de ingresos)',
    c4: 'Estoy dispuesto(a) a firmar una autorización de uso de fotos y videos de la instalación de las ventanas',
    s3: '¿No está en el condado de Montgomery pero desea ser considerado(a)?',
    s3help: 'Si su propiedad está fuera del condado de Montgomery, indique su ubicación general (ciudad, zona o condado vecino) y qué tan cerca está del condado de Montgomery. Se da preferencia a los residentes del condado de Montgomery, pero se podrán revisar casas cercanas si hay cupos disponibles.',
    outside: 'Su ubicación y distancia', optional: '(opcional)',
    s4: 'Comprobante de propiedad',
    s4help: 'Suba un documento que confirme que usted es dueño(a) de esta casa. Se acepta: factura reciente de impuestos de la propiedad, estado de cuenta de la hipoteca, o escritura/título de propiedad. Una foto clara o copia escaneada es suficiente.',
    choose: 'Elegir un archivo', nofile: 'Ningún archivo elegido',
    hint10: '1 archivo: PDF, documento o foto. Máximo 10 MB.',
    s5: 'Comprobante de ingresos',
    s5help: 'Subirlo ahora es opcional, pero nos ayuda a procesar su solicitud mucho más rápido si usted es seleccionado(a) como finalista. Se acepta: talones de pago recientes (los últimos 2 a 3), declaración de impuestos reciente (W-2 / 1099 / Formulario 1040), o carta de beneficios del gobierno (SSI, SSDI, SNAP). Si es seleccionado(a) como finalista, se requerirá la verificación de ingresos antes de entregar oficialmente el premio.',
    hint100: '1 archivo: PDF, documento o foto. Máximo 100 MB.',
    s6: 'Envíe su video de participación',
    s6lead: '¡Este video es el factor principal que usamos para elegir al ganador!',
    s6help: 'Un video sencillo de 1 a 3 minutos grabado con su teléfono es perfecto. Por favor muéstrenos y cuéntenos:',
    v1: 'Una breve presentación suya y de su familia u hogar',
    v2: 'A qué se dedica, o sus pasiones personales si actualmente no tiene trabajo',
    v3: 'Un recorrido claro que muestre las ventanas que desea reemplazar',
    v4: 'Un acercamiento a grietas, corrientes de aire, daños en el marco, o cualquier arreglo casero de aislamiento que use ahora',
    choosevideo: 'Elegir su video',
    hintvideo: '1 video de su teléfono. Máximo 500 MB. En un teléfono también puede tocar «Grabar video».',
    submit: 'Enviar mi participación',
    fine: 'Por favor mantenga esta página abierta mientras se suben sus archivos. Sus documentos son privados: solo nuestro equipo los verá y los eliminamos después del sorteo. ¿Necesita ayuda? Llame al (765) 376-1197.',
    doneh: '¡Gracias! Recibimos su participación.',
    donep: 'Nos comunicaremos con usted por teléfono o correo electrónico. Si tiene preguntas, llámenos al (765) 376-1197.'
  };
  var MSG = {
    en: {
      required: 'Please fill in this field.', needFile: 'Please choose a file.', needVideo: 'Please choose your video.',
      tooBig: 'That file is too large. Please choose one under {n} MB.', badType: 'That file type is not accepted.',
      checking: 'Checking your entry…', uploading: 'Uploading {what}… {p}%. Please keep this page open.',
      sending: 'Sending your entry…', fail: 'Something went wrong. Please try again, or call (765) 376-1197.',
      fixForm: 'Please fix the items marked above.', video: 'your video', ownership: 'your proof of ownership', income: 'your proof of income',
      human: 'Please complete the check below.',
      slow: 'Too many attempts from this connection. Please wait a while and try again, or call (765) 376-1197.',
      duplicate: 'We already have an entry with this email or phone number. Each household can enter once. Questions? Call (765) 376-1197.',
      closed: 'Entries are now closed. Thank you for your interest!',
      full: 'We have reached the maximum number of entries. Please call (765) 376-1197.'
    },
    es: {
      required: 'Por favor llene este campo.', needFile: 'Por favor elija un archivo.', needVideo: 'Por favor elija su video.',
      tooBig: 'Ese archivo es demasiado grande. Elija uno de menos de {n} MB.', badType: 'Ese tipo de archivo no se acepta.',
      checking: 'Revisando su participación…', uploading: 'Subiendo {what}… {p}%. Por favor mantenga esta página abierta.',
      sending: 'Enviando su participación…', fail: 'Algo salió mal. Inténtelo de nuevo o llame al (765) 376-1197.',
      fixForm: 'Por favor corrija los puntos marcados arriba.', video: 'su video', ownership: 'su comprobante de propiedad', income: 'su comprobante de ingresos',
      human: 'Por favor complete la verificación de abajo.',
      slow: 'Demasiados intentos desde esta conexión. Espere un rato e inténtelo de nuevo, o llame al (765) 376-1197.',
      duplicate: 'Ya tenemos una participación con este correo o teléfono. Cada hogar puede participar una vez. ¿Preguntas? Llame al (765) 376-1197.',
      closed: 'La participación ya está cerrada. ¡Gracias por su interés!',
      full: 'Se alcanzó el número máximo de participaciones. Llame al (765) 376-1197.'
    }
  };

  var form = document.getElementById('gw-form');
  if (!form) return;
  var lang = 'en';
  var EN = {};
  var nodes = document.querySelectorAll('[data-i18n]');
  Array.prototype.forEach.call(nodes, function (n) { EN[n.getAttribute('data-i18n')] = n.innerHTML; });

  function t(k, vars) {
    var s = MSG[lang][k] || k;
    for (var v in (vars || {})) s = s.replace('{' + v + '}', vars[v]);
    return s;
  }
  function setLang(l) {
    lang = l;
    document.documentElement.lang = l;
    Array.prototype.forEach.call(nodes, function (n) {
      var k = n.getAttribute('data-i18n');
      n.innerHTML = l === 'es' && ES[k] ? ES[k] : EN[k];
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-empty]'), function (n) {
      if (!n.dataset.has) n.innerHTML = l === 'es' ? ES[n.dataset.empty] : 'No file chosen';
    });
    Array.prototype.forEach.call(document.querySelectorAll('.gw-lang__btn'), function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.lang === l));
    });
    try { localStorage.setItem('gw-lang', l); } catch (e) {}
  }
  Array.prototype.forEach.call(document.querySelectorAll('.gw-lang__btn'), function (b) {
    b.addEventListener('click', function () { setLang(b.dataset.lang); });
  });
  var saved = null;
  try { saved = localStorage.getItem('gw-lang'); } catch (e) {}
  if (!saved && /^es/i.test(navigator.language || '')) saved = 'es';
  if (saved === 'es') setLang('es');

  /* ---------- file pickers ---------- */
  var files = { ownership: null, income: null, video: null };
  function ext(name) { var m = /\.([^.]+)$/.exec(name || ''); return m ? m[1].toLowerCase() : ''; }
  function box(kind) { return form.querySelector('[data-file="' + kind + '"]'); }
  function showErr(kind, msg) { box(kind).querySelector('.gw-file__err').textContent = msg || ''; }

  Object.keys(files).forEach(function (kind) {
    var b = box(kind);
    var input = b.querySelector('.gw-file__input');
    var label = b.querySelector('.gw-file__name');
    input.addEventListener('change', function () {
      var f = input.files && input.files[0];
      files[kind] = null; showErr(kind, '');
      if (!f) { delete label.dataset.has; label.innerHTML = lang === 'es' ? ES.nofile : 'No file chosen'; return; }
      var okExt = (kind === 'video' ? VID_EXT : DOC_EXT).indexOf(ext(f.name)) >= 0 ||
        (kind === 'video' ? /^video\//.test(f.type) : /^image\//.test(f.type));
      if (!okExt) { showErr(kind, t('badType')); input.value = ''; return; }
      if (f.size > MAX[kind] * 1024 * 1024) { showErr(kind, t('tooBig', { n: MAX[kind] })); input.value = ''; return; }
      files[kind] = f;
      label.dataset.has = '1';
      label.textContent = f.name + ' (' + (f.size / 1048576).toFixed(1) + ' MB)';
    });
  });

  /* ---------- Turnstile (optional until a sitekey is configured) ---------- */
  var tsToken = '';
  if (TURNSTILE_SITEKEY) {
    var s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true; s.defer = true;
    s.onload = function () {
      window.turnstile.render('#gw-turnstile', { sitekey: TURNSTILE_SITEKEY, callback: function (tok) { tsToken = tok; } });
    };
    document.head.appendChild(s);
  }

  /* ---------- API helpers ---------- */
  function api(path, opts) {
    return fetch(API + path, opts).then(function (r) {
      if (r.ok) return r.json();
      return r.json().catch(function () { return {}; }).then(function (b) {
        var e = new Error('HTTP ' + r.status); e.status = r.status; e.code = b.error; throw e;
      });
    });
  }
  function put(url, body, onProgress) {
    return new Promise(function (resolve, reject) {
      var x = new XMLHttpRequest();
      x.open('PUT', url);
      x.upload.onprogress = function (e) { if (e.lengthComputable) onProgress(e.loaded); };
      x.onload = function () { x.status < 300 ? resolve(JSON.parse(x.responseText)) : reject(new Error('HTTP ' + x.status)); };
      x.onerror = function () { reject(new Error('network')); };
      x.send(body);
    });
  }
  function retry(fn, n) {
    return fn().catch(function (e) {
      if (n <= 0) throw e;
      return new Promise(function (r) { setTimeout(r, 1500); }).then(function () { return retry(fn, n - 1); });
    });
  }

  function uploadFile(session, kind, file, setPct) {
    var q = 'id=' + encodeURIComponent(session.id) + '&token=' + encodeURIComponent(session.token);
    return api('/upload/start?' + q + '&kind=' + kind + '&name=' + encodeURIComponent(file.name) +
        '&size=' + file.size + '&type=' + encodeURIComponent(file.type || ''), { method: 'POST' })
      .then(function (start) {
        var parts = [];
        var total = Math.max(1, Math.ceil(file.size / CHUNK));
        var i = 0;
        function next() {
          if (i >= total) return Promise.resolve();
          var n = i + 1;
          var blob = file.slice(i * CHUNK, Math.min(file.size, (i + 1) * CHUNK));
          var base = i * CHUNK;
          return retry(function () {
            return put(API + '/upload/part?' + q + '&key=' + encodeURIComponent(start.key) +
              '&uploadId=' + encodeURIComponent(start.uploadId) + '&n=' + n, blob,
              function (loaded) { setPct(Math.min(99, Math.round((base + loaded) / file.size * 100))); });
          }, 3).then(function (p) { parts.push(p); i++; return next(); });
        }
        return next().then(function () {
          return api('/upload/complete?' + q, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: start.key, uploadId: start.uploadId, parts: parts, kind: kind })
          });
        }).then(function (done) { setPct(100); return { kind: kind, key: start.key, name: file.name, size: file.size }; });
      });
  }

  /* ---------- submit ---------- */
  var statusEl = document.getElementById('gw-status');
  var btn = document.getElementById('gw-submit');
  function status(msg, isErr) { statusEl.textContent = msg || ''; statusEl.classList.toggle('is-error', !!isErr); }

  function validate() {
    var bad = null;
    ['gw-first', 'gw-last', 'gw-phone', 'gw-email'].forEach(function (id) {
      var el = document.getElementById(id);
      var ok = el.value.trim() && (id !== 'gw-email' || /^\S+@\S+\.\S+$/.test(el.value.trim()));
      el.setAttribute('aria-invalid', ok ? 'false' : 'true');
      if (!ok && !bad) bad = el;
    });
    if (!files.ownership) { showErr('ownership', t('needFile')); bad = bad || box('ownership').querySelector('.gw-file__pick'); }
    if (!files.video) { showErr('video', t('needVideo')); bad = bad || box('video').querySelector('.gw-file__pick'); }
    if (TURNSTILE_SITEKEY && !tsToken) { status(t('human'), true); return false; }
    if (bad) { status(t('fixForm'), true); bad.scrollIntoView({ block: 'center' }); if (bad.focus) bad.focus(); return false; }
    return true;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    status('');
    if (!validate()) return;
    btn.disabled = true;
    var window_ = function (e) { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', window_);
    status(t('checking'));

    var fields = {
      first_name: form.first_name.value.trim(), last_name: form.last_name.value.trim(),
      phone: form.phone.value.trim(), email: form.email.value.trim(),
      elig_owner: form.elig_owner.checked, elig_county: form.elig_county.checked,
      elig_income: form.elig_income.checked, elig_media: form.elig_media.checked,
      outside: form.outside.value.trim(), website: form.website.value, lang: lang
    };

    var session;
    var uploaded = [];
    api('/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ turnstile: tsToken }) })
      .then(function (s) {
        session = s;
        var order = ['ownership', 'income', 'video'].filter(function (k) { return files[k]; });
        var chain = Promise.resolve();
        order.forEach(function (kind) {
          chain = chain.then(function () {
            var bar = box(kind).querySelector('.gw-bar'); bar.hidden = false;
            var fill = bar.querySelector('.gw-bar__fill');
            return uploadFile(session, kind, files[kind], function (p) {
              fill.style.width = p + '%';
              status(t('uploading', { what: t(kind), p: p }));
            }).then(function (r) { uploaded.push(r); });
          });
        });
        return chain;
      })
      .then(function () {
        status(t('sending'));
        return api('/submit?id=' + encodeURIComponent(session.id) + '&token=' + encodeURIComponent(session.token), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields: fields, files: uploaded })
        });
      })
      .then(function () {
        window.removeEventListener('beforeunload', window_);
        form.hidden = true;
        var done = document.getElementById('gw-done');
        done.hidden = false; done.focus(); done.scrollIntoView({ block: 'start' });
      })
      .catch(function (err) {
        window.removeEventListener('beforeunload', window_);
        btn.disabled = false;
        var known = err && { closed: 1, full: 1, slow: 1, duplicate: 1 }[err.code];
        status(known ? t(err.code) : t('fail'), true);
      });
  });
})();

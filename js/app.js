/* הפנימיות של חנוכה — app (no dependencies) */
(function () {
  'use strict';

  var ORD = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שביעי', 'שמיני'];
  var LET = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ז׳', 'ח׳'];
  var NEW_NIGHT_HOUR = 16;
  var BLOCKED_SONGS = ['NoHp2Rq8sMI']; // too light for a memorial site
  var SIGNUP_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzfumjphlMHNMBXVnrXHPQhp0Pcbu9mTL4NlsWiePAmaKFsP8fvqjgW7tAejKOhfGg/exec';
  var BOOK_PDF = 'book/hanukkah-pnimiyut.pdf';
  var LS_PROFILE = 'hanukkah-signup';
  var LS_VISITOR = 'hanukkah-visitor';
  var LS_VISIT = 'hanukkah-visit-sent';
  var C = null;       // content
  var T = null;       // time state
  var $ = function (s, r) { return (r || document).querySelector(s); };

  /* ---------------- helpers ---------------- */
  function esc(s) {
    return typo(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function typo(s) {
    return String(s)
      .replace(/([\u05D0-\u05EA])"([\u05D0-\u05EA])/g, '$1\u05F4$2')
      .replace(/([\u05D0-\u05EA])'(?=[\u05D0-\u05EA]{2,})/g, '$1\u05F3')
      .replace(/(^|[\s(\[])([\u05D0-\u05EA]{1,2})'(?=[\s.,:;!?)\]]|$)/g, '$1$2\u05F3');
  }
  function paras(v) {
    if (v == null || v === '') return [];
    var arr = Array.isArray(v) ? v : [v];
    var out = [];
    arr.forEach(function (p) {
      if (p && typeof p === 'object') p = p.text || p.paragraph || '';
      String(p).split(/\n\s*\n/).forEach(function (x) { if (x.trim()) out.push(x.trim()); });
    });
    return out;
  }
  function P(v, cls) {
    return paras(v).map(function (p) {
      return '<p' + (cls ? ' class="' + cls + '"' : '') + '>' + esc(p).replace(/\n/g, '<br>') + '</p>';
    }).join('');
  }
  function txt(v) { return paras(v).join(' '); }

  /* ---------------- dates ---------------- */
  // date-only values are 'YYYY-MM-DD' strings handled in UTC to avoid DST issues
  function toUTC(s) { var a = s.split('-'); return Date.UTC(+a[0], +a[1] - 1, +a[2]); }
  function fromUTC(ms) { return new Date(ms).toISOString().slice(0, 10); }
  function addDays(s, n) { return fromUTC(toUTC(s) + n * 864e5); }
  function diffDays(a, b) { return Math.round((toUTC(a) - toUTC(b)) / 864e5); }
  function weekday(s) { return new Date(toUTC(s)).getUTCDay(); } // 0=Sun
  var fmtLong = new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  var fmtLongY = new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  function longDate(s, y) { return (y ? fmtLongY : fmtLong).format(new Date(toUTC(s))); }
  function shortDate(s) { var a = s.split('-'); return (+a[2]) + '.' + (+a[1]); }
  function nightNote(s) {
    var w = weekday(s);
    if (w === 5) return 'ערב שבת · מדליקים לפני כניסת השבת';
    if (w === 6) return 'מוצאי שבת · מדליקים אחרי צאת השבת';
    return '';
  }

  function nowJerusalem() {
    var q = new URLSearchParams(location.search);
    var d = q.get('date');
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      var t = q.get('time') || '20:00';
      return { date: d, hour: parseInt(t, 10) || 0, simulated: true };
    }
    var parts = {};
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date()).forEach(function (p) { parts[p.type] = p.value; });
    return { date: parts.year + '-' + parts.month + '-' + parts.day, hour: parseInt(parts.hour, 10) % 24 };
  }

  // compute evening of first candle (24 Kislev) for a Gregorian year, using Intl Hebrew calendar
  function computeFirstCandle(y) {
    try {
      var f = new Intl.DateTimeFormat('en-u-ca-hebrew', { day: 'numeric', month: 'long', timeZone: 'UTC' });
      for (var ms = Date.UTC(y, 10, 15); ms <= Date.UTC(y, 11, 31); ms += 864e5) {
        var parts = {};
        f.formatToParts(new Date(ms)).forEach(function (p) { parts[p.type] = p.value; });
        if (/^Kislev$/i.test(parts.month) && +parts.day === 24) return fromUTC(ms);
      }
    } catch (e) {}
    return null;
  }
  function firstCandle(y) {
    var t = (C && C.hanukkah_dates) || {};
    return t[String(y)] || computeFirstCandle(y);
  }

  function timeState() {
    var now = nowJerusalem();
    var eff = now.hour >= NEW_NIGHT_HOUR ? now.date : addDays(now.date, -1); // the night currently "on"
    var y = +now.date.slice(0, 4);
    var prev = firstCandle(y - 1), cur = firstCandle(y);
    var first = cur, phase, night = 0;
    if (prev && diffDays(eff, prev) >= 0 && diffDays(eff, prev) <= 7) first = prev;
    var k = diffDays(eff, first) + 1;
    if (k >= 1 && k <= 8) { phase = 'during'; night = k; }
    else if (k < 1) phase = 'before';
    else phase = 'after';
    var next = phase === 'after' ? firstCandle(y + 1) : null;
    return { now: now, first: first, phase: phase, night: night, daysTo: diffDays(first, now.date), next: next };
  }
  function nightDate(n) { return addDays(T.first, n - 1); }

  /* ---------------- menorah SVG ---------------- */
  var XS = [360, 320, 280, 240, 160, 120, 80, 40]; // night 1 on the right, adding leftwards
  var uid = 0;
  function flameSVG(x, top, big) {
    var s = big ? 1.12 : 1;
    var h = 24 * s, w = 6.2 * s;
    var y0 = top - 3;
    var outer = 'M' + x + ' ' + y0 + ' C' + (x + w) + ' ' + (y0 - h * .28) + ' ' + (x + w * .78) + ' ' + (y0 - h * .72) + ' ' + x + ' ' + (y0 - h) +
      ' C' + (x - w * .78) + ' ' + (y0 - h * .72) + ' ' + (x - w) + ' ' + (y0 - h * .28) + ' ' + x + ' ' + y0 + 'Z';
    var ih = h * .5, iw = w * .5;
    var inner = 'M' + x + ' ' + (y0 - 1) + ' C' + (x + iw) + ' ' + (y0 - ih * .3) + ' ' + (x + iw * .7) + ' ' + (y0 - ih * .8) + ' ' + x + ' ' + (y0 - ih) +
      ' C' + (x - iw * .7) + ' ' + (y0 - ih * .8) + ' ' + (x - iw) + ' ' + (y0 - ih * .3) + ' ' + x + ' ' + (y0 - 1) + 'Z';
    return '<g class="fl"><circle class="glow" cx="' + x + '" cy="' + (y0 - h * .45) + '" r="' + (30 * s) + '" fill="url(#glow' + uid + ')"/>' +
      '<g class="flame"><path d="' + outer + '" fill="url(#fo' + uid + ')"/><path d="' + inner + '" fill="#fff6dc" opacity=".9"/></g></g>';
  }
  function menorahSVG(lit, opts) {
    opts = opts || {};
    uid++;
    var id = uid;
    var cupY = 148, candleH = 42, shY = 94;
    var defs = '<defs>' +
      '<linearGradient id="gv' + id + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#f3e1a8"/><stop offset=".4" stop-color="#d4ae5d"/><stop offset="1" stop-color="#8a5e22"/>' +
      '</linearGradient>' +
      '<linearGradient id="gh' + id + '" x1="0" y1="0" x2="1" y2="0">' +
        '<stop offset="0" stop-color="#8f6528"/><stop offset=".22" stop-color="#e8cc86"/><stop offset=".48" stop-color="#f7e7b6"/><stop offset=".7" stop-color="#c9a24f"/><stop offset="1" stop-color="#6f4b18"/>' +
      '</linearGradient>' +
      '<linearGradient id="gbase' + id + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#e6cd92"/><stop offset=".55" stop-color="#c9a24f"/><stop offset="1" stop-color="#7c541c"/>' +
      '</linearGradient>' +
      '<linearGradient id="wax' + id + '" x1="0" y1="0" x2="1" y2="0">' +
        '<stop offset="0" stop-color="#d9ccb2"/><stop offset=".45" stop-color="#f8f0df"/><stop offset="1" stop-color="#cdbfa3"/>' +
      '</linearGradient>' +
      '<radialGradient id="glow' + id + '"><stop offset="0" stop-color="#ffcf7a" stop-opacity=".55"/><stop offset=".45" stop-color="#ffb347" stop-opacity=".16"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="fo' + id + '" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff8a2a"/><stop offset=".5" stop-color="#ffc35e"/><stop offset="1" stop-color="#ffe7a8"/></linearGradient>' +
      '<filter id="msoft' + id + '" x="-10%" y="-6%" width="120%" height="118%"><feDropShadow dx="0" dy="3" stdDeviation="2.4" flood-color="#000" flood-opacity=".38"/></filter>' +
      '<radialGradient id="gnd' + id + '" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#000" stop-opacity=".3"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>' +
      '</defs>';
    var gv = 'url(#gv' + id + ')', gh = 'url(#gh' + id + ')', gbase = 'url(#gbase' + id + ')', wax = 'url(#wax' + id + ')';
    var metal = '<ellipse cx="200" cy="336" rx="96" ry="8" fill="url(#gnd' + id + ')"/>';
    // curved branches sit behind the trunk so the shaft clearly holds them
    [40, 80, 120, 160].forEach(function (r) {
      var ry = r * 0.52;
      metal += '<path fill="none" stroke="' + gv + '" stroke-width="8" stroke-linecap="round" d="M' + (200 - r) + ' ' + cupY + ' A' + r + ' ' + ry + ' 0 0 0 ' + (200 + r) + ' ' + cupY + '"/>';
      metal += '<path fill="none" stroke="#f6e7b8" stroke-width="1.35" stroke-linecap="round" opacity=".42" d="M' + (200 - r + 1.2) + ' ' + (cupY - 1.7) + ' A' + (r - 1.2) + ' ' + (ry - 1.6) + ' 0 0 0 ' + (200 + r - 1.2) + ' ' + (cupY - 1.7) + '"/>';
    });
    // solid tapered trunk: shamash cup down to the base
    var trunkTop = shY + 5, trunkBot = 288;
    metal += '<path fill="' + gh + '" d="M193 ' + trunkTop + ' h14 l3.6 ' + (trunkBot - trunkTop) + ' h-21.2 z"/>';
    metal += '<path fill="#f6e7b8" opacity=".32" d="M198.1 ' + trunkTop + ' h2.5 l1.15 ' + (trunkBot - trunkTop) + ' h-3.4 z"/>';
    [174, 216, 258].forEach(function (ky) {
      metal += '<ellipse cx="200" cy="' + ky + '" rx="13.8" ry="5.3" fill="' + gbase + '"/>';
      metal += '<ellipse cx="200" cy="' + (ky - 2.1) + '" rx="12.2" ry="2.3" fill="#f3e1a8" opacity=".38"/>';
    });
    // stepped base, planted on the ground
    metal += '<path fill="' + gbase + '" d="M185 286 h30 l6 10 h-42 z"/>';
    metal += '<path fill="' + gh + '" d="M156 296 h88 l11 14 H145 z"/>';
    metal += '<rect x="145" y="308" width="110" height="3.2" rx="1" fill="#f3e1a8" opacity=".28"/>';
    metal += '<path fill="' + gbase + '" d="M118 310 h164 l13 14 H105 z"/>';
    metal += '<rect x="105" y="322" width="190" height="5.5" rx="2.6" fill="' + gh + '"/>';
    metal += '<rect x="114" y="325.4" width="172" height="1.5" rx=".7" fill="#f6e7b8" opacity=".32"/>';
    // cups
    XS.concat([200]).forEach(function (x) {
      var y = x === 200 ? shY : cupY;
      var w = x === 200 ? 12 : 10.5;
      metal += '<path fill="' + gbase + '" d="M' + (x - w) + ' ' + (y - 6) + ' h' + (w * 2) + ' l-3.2 8 h' + (-w * 2 + 6.4) + 'z"/>';
      metal += '<rect x="' + (x - w + 1) + '" y="' + (y - 6.6) + '" width="' + (w * 2 - 2) + '" height="1.5" rx=".6" fill="#f6e7b8" opacity=".42"/>';
    });
    var g = '<g filter="url(#msoft' + id + ')">' + metal + '</g>';
    var candles = '';
    XS.forEach(function (x, i) {
      var n = i + 1, top = cupY - 6 - candleH, isLit = n <= lit;
      candles += '<g class="slot' + (isLit ? ' lit' : '') + (opts.selected === n ? ' sel' : '') + '" data-night="' + n + '"' +
        (opts.interactive ? ' role="link" tabindex="0" aria-label="נר ' + ORD[i] + (C && C.nights[i] ? ': ' + esc(C.nights[i].title) : '') + '"' : '') + '>' +
        '<rect class="candle" x="' + (x - 4.5) + '" y="' + top + '" width="9" height="' + candleH + '" rx="1.5" fill="' + wax + '"/>' +
        '<line class="wick" x1="' + x + '" y1="' + top + '" x2="' + x + '" y2="' + (top - 4) + '"/>' +
        flameSVG(x, top, false) +
        '<circle class="mark" cx="' + x + '" cy="' + (cupY + 16) + '" r="2.2"/>' +
        (opts.interactive ? '<rect class="ring" x="' + (x - 16) + '" y="' + (top - 34) + '" width="32" height="' + (candleH + 44) + '" rx="16"/><rect class="hit" x="' + (x - 20) + '" y="' + (top - 36) + '" width="40" height="' + (candleH + 60) + '"/>' : '') +
        '</g>';
    });
    var shTop = shY - 6 - candleH - 4;
    candles += '<g class="slot' + (lit > 0 || opts.shamash ? ' lit' : '') + '" aria-hidden="true"><rect class="candle" x="195" y="' + shTop + '" width="10" height="' + (candleH + 4) + '" rx="1.5" fill="' + wax + '"/>' +
      '<line class="wick" x1="200" y1="' + shTop + '" x2="200" y2="' + (shTop - 4) + '"/>' + flameSVG(200, shTop, true) + '</g>';
    var label = opts.label || (lit ? 'חנוכייה ובה ' + (lit === 1 ? 'נר אחד דולק' : lit + ' נרות דולקים') + ' ושמש' : 'חנוכייה');
    return '<svg class="menorah" viewBox="0 0 400 348" role="img" aria-label="' + esc(label) + '">' + defs + g + candles + '</svg>';
  }

  function bindMenorah(root) {
    root.querySelectorAll('.slot[data-night][tabindex]').forEach(function (el) {
      var go = function () { location.hash = '#night-' + el.getAttribute('data-night'); };
      el.addEventListener('click', go);
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
    // stagger flicker so flames don't move in unison
    root.querySelectorAll('.flame').forEach(function (f, i) { f.style.animationDelay = (-i * 0.73) + 's'; f.style.animationDuration = (2.6 + (i % 4) * 0.45) + 's'; });
    root.querySelectorAll('.glow').forEach(function (f, i) { f.style.animationDelay = (-i * 1.1) + 's'; });
  }


  /* ---------------- signup, visits, personalization ---------------- */
  function silentTelemetry() {
    try { return new URLSearchParams(location.search).has('nosignal'); } catch (e) { return false; }
  }
  function getVisitorId() {
    try {
      var id = localStorage.getItem(LS_VISITOR);
      if (id) return id;
      id = 'v' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      localStorage.setItem(LS_VISITOR, id);
      return id;
    } catch (e) { return 'v-anon'; }
  }
  function getProfile() {
    try {
      var raw = localStorage.getItem(LS_PROFILE);
      if (!raw) return null;
      var p = JSON.parse(raw);
      return p && p.name ? p : null;
    } catch (e) { return null; }
  }
  function saveProfile(p) {
    try { localStorage.setItem(LS_PROFILE, JSON.stringify(p)); } catch (e) {}
  }
  function utmParams() {
    var q = new URLSearchParams(location.search), o = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (k) {
      var v = q.get(k); if (v) o[k] = v;
    });
    return o;
  }
  function eventPayload(type, extra) {
    var p = {
      type: type,
      name: '',
      phone: '',
      email: '',
      occupation: '',
      light: '',
      consent: false,
      night: (T && T.night) ? T.night : '',
      visitor: getVisitorId(),
      page: location.href,
      ref: document.referrer || '',
      utm: utmParams(),
      ua: navigator.userAgent
    };
    if (extra) Object.keys(extra).forEach(function (k) { p[k] = extra[k]; });
    return p;
  }
  function postEvent(payload) {
    if (silentTelemetry()) { console.log('[hanukkah event, nosignal]', payload); return; }
    if (!SIGNUP_ENDPOINT) { console.log('[hanukkah event]', payload); return; }
    try {
      fetch(SIGNUP_ENDPOINT, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      }).catch(function () {});
    } catch (e) {}
  }
  function trackVisit() {
    try {
      if (localStorage.getItem(LS_VISIT)) return;
      localStorage.setItem(LS_VISIT, '1');
    } catch (e) {}
    postEvent(eventPayload('visit'));
  }
  function greetingHTML() {
    var p = getProfile();
    if (!p) return '';
    var html = '<p class="nhead__hello">שלום ' + esc(p.name) + ', הנר של הערב בשבילך</p>';
    if (p.light && String(p.light).trim()) {
      html += '<p class="nhead__light">' + esc(p.name) + ', האור שלך – ' + esc(String(p.light).trim()) + ' – הוא חלק מהנר של הערב</p>';
    }
    return html;
  }
  function occupationNote() {
    var p = getProfile();
    if (!p || !p.occupation || !String(p.occupation).trim()) return '';
    return '<p class="work__personal">איך האור הזה יכול להאיר גם בעשייה שלך — ' + esc(String(p.occupation).trim()) + '?</p>';
  }
  function teaserParas(body) {
    var all = paras(body), out = [], n = 0;
    for (var i = 0; i < all.length && (out.length < 2 || (n < 220 && out.length < 3)); i++) {
      out.push(all[i]); n += all[i].length;
    }
    if (!out.length && all.length) out = all.slice(0, 1);
    return { teaser: out, rest: all.slice(out.length) };
  }
  function validPhone(s) { return String(s || '').replace(/\D/g, '').length >= 9; }
  function validEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim()); }

  function gateHTML() {
    return '<div class="gate" id="gate">' +
      '<div class="gate__fade" aria-hidden="true"></div>' +
      '<button class="btn btn--flame" type="button" id="gateOpen">להמשך הלימוד</button>' +
      '<form class="gate-card" id="gateForm" hidden novalidate>' +
        '<h2>נשמח להכיר, ונמשיך יחד</h2>' +
        '<p class="gate-card__lead">כתבו את השם שלכם, ונפתח את המשך הלימוד.</p>' +
        '<label class="field">שם פרטי <span class="req">*</span>' +
          '<input name="name" type="text" required autocomplete="given-name" maxlength="80">' +
        '</label>' +
        '<div class="field-row">' +
          '<label class="field">טלפון' +
            '<input name="phone" type="tel" autocomplete="tel" inputmode="tel" maxlength="20">' +
          '</label>' +
          '<label class="field">דוא״ל' +
            '<input name="email" type="email" autocomplete="email" maxlength="120" dir="ltr">' +
          '</label>' +
        '</div>' +
        '<p class="gate-card__hint">מספיק טלפון או דוא״ל — אחד מהשניים.</p>' +
        '<label class="field">מה העיסוק שלך? <span class="opt">(רשות)</span>' +
          '<input name="occupation" type="text" maxlength="120" autocomplete="organization-title">' +
        '</label>' +
        '<label class="field">איזה אור אתם מפיצים בעולם, סביבכם? <span class="opt">(רשות)</span>' +
          '<input name="light" type="text" maxlength="160">' +
        '</label>' +
        '<label class="check"><input name="consent" type="checkbox"><span>אשמח לקבל עדכונים, לימודים ותכנים נוספים</span></label>' +
        '<p class="gate-card__legal">הפרטים נשמרים אצלנו רק לצורך הלימוד והתכנים שביקשתם לקבל, ואינם מועברים הלאה.</p>' +
        '<p class="gate-card__err" id="gateErr" hidden></p>' +
        '<button class="btn btn--flame" type="submit">להמשך הלימוד</button>' +
      '</form>' +
    '</div>';
  }

  function unlockNight(animate) {
    var gate = $('#gate'), rest = $('#nightRest');
    if (gate) {
      gate.classList.add('gate--done');
      gate.hidden = true;
    }
    if (rest) {
      rest.hidden = false;
      if (animate) {
        rest.classList.add('night-rest--reveal');
        try { rest.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (e) {}
      }
    }
    var nhead = document.querySelector('.nhead__in');
    if (nhead) {
      var h1 = nhead.querySelector('h1');
      var prevH = $('.nhead__hello', nhead);
      var prevL = $('.nhead__light', nhead);
      if (prevL) prevL.remove();
      if (prevH) prevH.remove();
      if (h1) h1.insertAdjacentHTML('beforebegin', greetingHTML());
    }
    var work = document.querySelector('.work');
    if (work && !$('.work__personal', work)) {
      var note = occupationNote();
      if (note) work.insertAdjacentHTML('beforeend', note);
    }
  }

  function bindGate(n) {
    if (getProfile()) { unlockNight(false); return; }
    var open = $('#gateOpen'), form = $('#gateForm'), err = $('#gateErr');
    if (!open || !form) return;
    open.addEventListener('click', function () {
      form.hidden = false;
      open.hidden = true;
      var gate = $('#gate'); if (gate) gate.classList.add('gate--open');
      var name = form.querySelector('[name="name"]');
      if (name) setTimeout(function () { name.focus(); }, 40);
      try { form.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (e) {}
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.name.value.trim();
      var phone = form.phone.value.trim();
      var email = form.email.value.trim();
      var occupation = form.occupation.value.trim();
      var light = form.light.value.trim();
      var consent = !!form.consent.checked;
      var msg = '';
      if (!name) msg = 'כתבו את השם הפרטי, כדי שנוכל לפנות אליכם.';
      else if (!phone && !email) msg = 'השאירו טלפון או דוא״ל, אחד מהשניים.';
      else if (phone && !validPhone(phone)) msg = 'בדקו את מספר הטלפון, ונסו שוב.';
      else if (email && !validEmail(email)) msg = 'בדקו את כתובת הדוא״ל, ונסו שוב.';
      if (msg) {
        err.hidden = false; err.textContent = msg; return;
      }
      err.hidden = true;
      var profile = { name: name, phone: phone, email: email, occupation: occupation, light: light, consent: consent, ts: new Date().toISOString() };
      saveProfile(profile);
      try {
        postEvent(eventPayload('signup', {
          name: name, phone: phone, email: email, occupation: occupation, light: light, consent: consent, night: n
        }));
      } catch (err2) {}
      unlockNight(true);
    });
  }

  /* ---------------- in-page book reader ---------------- */
  var pdfDoc = null, pdfPageNum = 1, pdfRendering = false, pdfPending = null, seferKeyHandler = null, seferResize = null;

  function unbindSefer() {
    if (seferKeyHandler) { document.removeEventListener('keydown', seferKeyHandler); seferKeyHandler = null; }
    if (seferResize) { window.removeEventListener('resize', seferResize); seferResize = null; }
  }

  function loadPdfJs(cb, fail) {
    if (window.pdfjsLib) { cb(); return; }
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = function () {
      try { pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; } catch (e) {}
      cb();
    };
    s.onerror = function () { if (fail) fail(); };
    document.head.appendChild(s);
  }

  function seferView() {
    return '<section class="nhead dark sefer-head" aria-labelledby="sefer-title"><div class="wrap sefer-head__in">' +
      '<p class="overline">מתוך הספר</p>' +
      '<h1 id="sefer-title" tabindex="-1">החוברת המלאה</h1>' +
      '<p class="sefer-head__meta">הפנימיות של חנוכה · הרב אליהו עובדיה ונעמה\u00A0ניימן</p>' +
      '<div class="nactions nactions--head">' +
        '<a class="btn btn--flame" href="' + BOOK_PDF + '" download="הפנימיות-של-חנוכה.pdf">הורדת החוברת המלאה (PDF)</a>' +
        '<a class="btn btn--ghost" href="' + BOOK_PDF + '" target="_blank" rel="noopener">פתיחה בחלון חדש</a>' +
      '</div>' +
    '</div></section>' +
    '<section class="sefer paper"><div class="wrap">' +
      '<div class="reader" id="reader">' +
        '<div class="reader__bar">' +
          '<button class="reader__nav" type="button" id="readerPrev" aria-label="העמוד הקודם"><span aria-hidden="true">→</span> הקודם</button>' +
          '<p class="reader__page" id="readerPage">—</p>' +
          '<button class="reader__nav" type="button" id="readerNext" aria-label="העמוד הבא">הבא <span aria-hidden="true">←</span></button>' +
        '</div>' +
        '<div class="reader__stage" id="readerStage">' +
          '<canvas id="pdfCanvas"></canvas>' +
        '</div>' +
        '<p class="reader__status" id="readerStatus">טוען את החוברת…</p>' +
        '<p class="reader__fallback" id="readerFallback" hidden>אם העמוד לא נטען, <a href="' + BOOK_PDF + '" target="_blank" rel="noopener">פתחו את ה-PDF</a> או <a href="' + BOOK_PDF + '" download="הפנימיות-של-חנוכה.pdf">הורידו אותו</a>.</p>' +
      '</div>' +
    '</div></section>';
  }

  function bindReader() {
    var stage = $('#readerStage'), canvas = $('#pdfCanvas'), label = $('#readerPage'), status = $('#readerStatus');
    if (!stage || !canvas) return;
    function setStatus(t) { if (status) status.textContent = t || ''; }

    function render(num) {
      if (!pdfDoc) return;
      if (pdfRendering) { pdfPending = num; return; }
      pdfRendering = true;
      pdfPageNum = num;
      pdfDoc.getPage(num).then(function (page) {
        var unscaled = page.getViewport({ scale: 1 });
        var w = Math.max(280, stage.clientWidth || 360);
        var dpr = window.devicePixelRatio || 1;
        var viewport = page.getViewport({ scale: (w / unscaled.width) * dpr });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = w + 'px';
        canvas.style.height = (w * unscaled.height / unscaled.width) + 'px';
        return page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise;
      }).then(function () {
        pdfRendering = false;
        if (label) label.textContent = pdfPageNum + ' מתוך ' + pdfDoc.numPages;
        var prev = $('#readerPrev'), next = $('#readerNext');
        if (prev) prev.disabled = pdfPageNum <= 1;
        if (next) next.disabled = pdfPageNum >= pdfDoc.numPages;
        setStatus('');
        if (pdfPending != null) { var p = pdfPending; pdfPending = null; render(p); }
      }).catch(function () {
        pdfRendering = false;
        setStatus('');
        var fb = $('#readerFallback'); if (fb) fb.hidden = false;
      });
    }
    function go(d) {
      if (!pdfDoc) return;
      var n = pdfPageNum + d;
      if (n < 1 || n > pdfDoc.numPages) return;
      render(n);
    }
    $('#readerPrev').addEventListener('click', function () { go(-1); });
    $('#readerNext').addEventListener('click', function () { go(1); });
    var x0 = null;
    stage.addEventListener('touchstart', function (e) { x0 = e.changedTouches[0].clientX; }, { passive: true });
    stage.addEventListener('touchend', function (e) {
      if (x0 == null) return;
      var dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) < 48) return;
      if (dx > 0) go(1); else go(-1);
    }, { passive: true });
    seferKeyHandler = function (e) {
      if (location.hash.replace(/^#/, '') !== 'sefer') return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(-1); }
    };
    document.addEventListener('keydown', seferKeyHandler);
    var resizeTimer;
    seferResize = function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(function () { if (pdfDoc) render(pdfPageNum); }, 180); };
    window.addEventListener('resize', seferResize);
    loadPdfJs(function () {
      pdfjsLib.getDocument({ url: BOOK_PDF, verbosity: 0 }).promise.then(function (doc) {
        pdfDoc = doc;
        render(1);
      }).catch(function () {
        setStatus('');
        var fb = $('#readerFallback'); if (fb) fb.hidden = false;
      });
    }, function () {
      setStatus('');
      var fb = $('#readerFallback'); if (fb) fb.hidden = false;
    });
  }

  /* ---------------- views ---------------- */
  var flameIcon = '<svg viewBox="0 0 20 28" aria-hidden="true"><path d="M10 1C14 7 17 11 17 17a7 7 0 0 1-14 0c0-4 2-6 3-8 1 3 2 4 3 4 0-4 0-8 1-12z" fill="currentColor"/></svg>';
  var arrowL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>';

  function statusHTML() {
    var f = T.first;
    if (T.phase === 'during') {
      var d = nightDate(T.night), note = nightNote(d);
      var day = T.now.hour < NEW_NIGHT_HOUR && !T.now.simulatedEvening;
      var head = day ? 'ימי חנוכה · <b>נר ' + ORD[T.night - 1] + '</b>' : 'הלילה מדליקים <b>נר ' + ORD[T.night - 1] + '</b>';
      var meta = esc(longDate(d)) + (note ? ' · ' + esc(note) : '');
      if (day) {
        var tn = nightDate(T.night + 1), tnote = nightNote(tn);
        meta = T.night < 8 ? 'הערב מדליקים נר ' + ORD[T.night] + ' · ' + esc(longDate(tn)) + (tnote ? ' · ' + esc(tnote) : '') : 'היום האחרון של חנוכה';
      }
      return '<p class="status__big">' + head + '</p>' +
        '<p class="status__meta">' + meta + '</p>' +
        '<div class="status__actions"><a class="btn btn--flame" href="#night-' + T.night + '">ללימוד של הלילה ' + arrowL + '</a>' +
        '<a class="btn btn--ghost" href="#nights">כל שמונת הנרות</a></div>';
    }
    if (T.phase === 'before') {
      var big = T.daysTo === 0 ? 'הערב מדליקים את <b>הנר הראשון</b>' :
        T.daysTo === 1 ? 'מחר בערב מדליקים את <b>הנר הראשון</b>' :
        'עוד <b>' + T.daysTo + ' ימים</b> לנר הראשון';
      var n1 = nightNote(f);
      return '<p class="status__big">' + big + '</p>' +
        '<p class="status__meta">נר ראשון: ' + esc(longDate(f, true)) + ' בערב' + (n1 ? '<br>' + esc(n1) : '') + '</p>' +
        '<div class="status__actions"><a class="btn btn--flame" href="#night-1">לימוד הנר הראשון ' + arrowL + '</a>' +
        '<a class="btn btn--ghost" href="#nights">כל שמונת הנרות</a></div>';
    }
    return '<p class="status__big">שמונת הנרות כבר דלקו השנה</p>' +
      '<p class="status__meta">הלימוד של כל הלילות פתוח לקריאה' + (T.next ? '. חנוכה הבא: ' + esc(longDate(T.next, true)) + ' בערב' : '') + '</p>' +
      '<div class="status__actions"><a class="btn btn--flame" href="#night-1">מהנר הראשון ' + arrowL + '</a></div>';
  }

  function poemHTML(p, inline) {
    if (!p) return '';
    var stanzas = String(Array.isArray(p.lines) ? p.lines.join('\n') : p.lines || '').split(/\n\s*\n/);
    return '<article class="poem' + (inline ? ' poem--inline' : '') + '">' +
      '<h3>' + esc(p.title) + '</h3>' + (p.note ? '<p class="poem__note">' + esc(p.note) + '</p>' : '') +
      stanzas.map(function (s) { return '<p class="poem__stanza">' + esc(s.trim()).replace(/\n/g, '<br>') + '</p>'; }).join('') +
      '</article>';
  }
  function findPoem(title) {
    var strip = function (s) { return String(s || '').replace(/[\u0591-\u05C7]/g, '').trim(); };
    return (C.book_songs_lyrics || []).filter(function (p) { return strip(p.title) === strip(title); })[0];
  }

  function openingHTML() {
    var raw = C && C.opening;
    if (!raw) return '';
    var lines = Array.isArray(raw) ? raw.slice() : String(raw).split(/\n/);
    lines = lines.map(function (l) { return String(l).trim(); }).filter(Boolean);
    if (!lines.length) return '';
    var last = lines[lines.length - 1];
    var body = lines.slice(0, -1).map(function (ln) { return esc(ln); }).join('<br>');
    return '<blockquote class="hero__opening"><p>' + body + '</p><p class="hero__opening-end">' + esc(last) + '</p></blockquote>';
  }

  function homeView() {
    var lit = T.phase === 'during' ? T.night : T.phase === 'after' ? 8 : 0;
    var ded = C.dedication || {};
    var rows = C.nights.map(function (n, i) {
      var num = i + 1, d = nightDate(num), note = nightNote(d);
      var tag = (T.phase === 'during' && T.night === num) ? '<span class="tag">הלילה</span>' : '';
      var w = weekday(d);
      var noteTag = w === 5 ? '<span class="tag tag--soft">ערב שבת</span>' : w === 6 ? '<span class="tag tag--soft">מוצאי שבת</span>' : '';
      return '<li><a class="night-row" href="#night-' + num + '" aria-label="נר ' + ORD[i] + ': ' + esc(n.title) + '">' +
        '<span class="night-row__num" aria-hidden="true">' + LET[i] + '</span>' +
        '<span class="night-row__date">נר ' + ORD[i] + ' · ' + esc(longDate(d)) + ' ' + tag + noteTag + '</span>' +
        '<span class="night-row__title">' + esc(n.title) + '</span>' +
        '<span class="night-row__theme">' + esc(txt(n.candle_theme)) + '</span></a></li>';
    }).join('');
    var poems = (C.book_songs_lyrics || []).map(function (p) {
      var lines = String(Array.isArray(p.lines) ? p.lines.join('\n') : p.lines || '').split(/\n\s*\n/)[0].split('\n').slice(0, 4);
      return '<a class="poem-card" href="#shirim"><h3>' + esc(p.title) + '</h3><p>' + lines.map(esc).join('<br>') + '</p><span class="poem-card__more">להמשך השיר</span></a>';
    }).join('');

    return '' +
      '<section class="hero dark" aria-labelledby="h-title"><div class="wrap hero__in">' +
        '<div class="hero__text">' +
          '<p class="overline">לימוד לכל ערב בשמונת ימי החנוכה</p>' +
          '<h1 id="h-title" tabindex="-1">הפנימיות של חנוכה</h1>' +
          '<p class="hero__authors">' + esc((C.credits && C.credits.authors || ['הרב אליהו עובדיה', 'נעמה ניימן']).join(' · ')) + '</p>' +
          '<p class="hero__ded"><a href="#aviad">' + esc(ded.title || '') + '<small>' + esc(stripIdf(ded.idf_fallen)) + '</small></a></p>' +
          openingHTML() +
        '</div>' +
        '<div class="hero__art">' + menorahSVG(lit, { interactive: true, shamash: true }) +
          '<p class="hero__cap">לחצו על נר כדי לפתוח את הלימוד שלו</p></div>' +
        '<div class="status">' + statusHTML() + '</div>' +
      '</div></section>' +

      '<section class="section paper intro" aria-labelledby="h-intro"><div class="wrap split">' +
        '<div class="split__side"><p class="overline">על הלימוד</p><h2 id="h-intro" class="sr">על הלימוד</h2></div>' +
        '<div class="prose measure">' + P(C.intro) + '</div>' +
      '</div></section>' +

      '<section class="section paper" id="nights" aria-labelledby="h-nights" style="padding-top:0"><div class="wrap split">' +
        '<div class="split__side"><p class="overline">שמונה לילות</p><h2 id="h-nights">נר לכל לילה</h2></div>' +
        '<div><ol class="nights">' + rows + '</ol></div>' +
      '</div></section>' +

      '<section class="section dark ded-teaser" aria-labelledby="h-ded"><div class="wrap ded-teaser__in">' +
        '<img class="portrait" src="img/aviad.jpg" width="132" height="132" alt="שלמה אביעד ניימן הי״ד">' +
        '<div><p class="overline">לעילוי נשמת</p><h2 id="h-ded">שלמה אביעד ניימן הי״ד</h2>' +
        '<p>' + esc(ded.subtitle || '') + '</p>' +
        '<a class="btn btn--ghost" href="#aviad">' + esc((C.aviad_will && C.aviad_will.title) || 'הדרך שבה אביעד חי') + ' ' + arrowL + '</a></div>' +
      '</div></section>' +

      '<section class="section paper" id="shirim-home" aria-labelledby="h-poems"><div class="wrap split">' +
        '<div class="split__side"><p class="overline">מתוך החוברת</p><h2 id="h-poems">שירים</h2></div>' +
        '<div class="poem-cards">' + poems + '</div>' +
      '</div></section>' +

      hakdashotHTML();
  }
  function stripIdf(s) { return String(s || '').split(/[.,]/)[0].replace(/^ו/, '') || ''; }

  function hakdashotHTML() {
    var blocks = (C.closing_dedications || []).map(function (b) {
      return '<div class="hakd__block">' + (b.verse ? '<p class="hakd__verse">״' + esc(b.verse) + '״</p>' : '') +
        '<h3>' + esc(b.heading) + '</h3><ul>' + (b.names || []).map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul></div>';
    }).join('');
    if (!blocks) return '';
    return '<section class="section paper" id="hakdashot" aria-labelledby="h-hakd" style="background:var(--paper-2)"><div class="wrap">' +
      '<h2 id="h-hakd">הקדשות</h2><div class="hakd">' + blocks + '</div></div></section>';
  }

  function nightView(n) {
    var night = C.nights[n - 1], d = nightDate(n), note = nightNote(d);
    var isTonight = T.phase === 'during' && T.night === n;
    var unlocked = !!getProfile();
    var parts = teaserParas(night.body);
    var story = night.story && (night.story.text || night.story.title) ?
      '<aside class="story" aria-labelledby="st-' + n + '"><p class="story__label">סיפור</p><h2 id="st-' + n + '">' + esc(night.story.title || '') + '</h2>' + P(night.story.text) + '</aside>' : '';
    var poem = night.poem_ref ? poemHTML(findPoem(night.poem_ref), true) : '';
    var relax = night.guided_relaxation ?
      '<details class="relax"><summary>' + esc(night.guided_relaxation.title || 'הרפיה') + '</summary><div class="prose">' + P(night.guided_relaxation.paragraphs || night.guided_relaxation.text) + '</div></details>' : '';
    var prev = n > 1 ? '<a href="#night-' + (n - 1) + '"><small>→ נר ' + ORD[n - 2] + '</small><b>' + esc(C.nights[n - 2].title) + '</b></a>' : '<a href="#"><small>→ חזרה</small><b>לעמוד הראשי</b></a>';
    var next = n < 8 ? '<a class="next" href="#night-' + (n + 1) + '"><small>נר ' + ORD[n] + ' ←</small><b>' + esc(C.nights[n].title) + '</b></a>' : '<a class="next" href="#aviad"><small>לעילוי נשמת ←</small><b>הדרך שבה אביעד חי</b></a>';
    var restBody = parts.rest.length ? '<div class="prose">' + P(parts.rest) + '</div>' : '';
    var fullRest = restBody + story + poem +
      (night.quote ? '<figure class="quote"><svg class="quote__orn" viewBox="0 0 46 14" aria-hidden="true"><path d="M0 7h17M29 7h17" stroke="currentColor" stroke-width="1"/><path d="M23 1c2.5 3 4 4.5 4 7a4 4 0 0 1-8 0c0-2.5 1.5-4 4-7z" fill="currentColor"/></svg><blockquote>' + esc(txt(night.quote)) + '</blockquote><figcaption>מתוך החוברת</figcaption></figure>' : '') +
      (night.inner_work ? '<section class="work" aria-labelledby="w-' + n + '"><h2 id="w-' + n + '">' + flameIcon + 'עבודה פנימית להלילה</h2>' + P(night.inner_work) + (unlocked ? occupationNote() : '') + '</section>' : '') +
      relax +
      (night.source_chapter ? '<p class="source">מקורות בחוברת: ' + esc(txt(night.source_chapter)) + '</p>' : '');
    var pdfBtn = n === 8 ? '<a class="btn btn--line" href="' + BOOK_PDF + '" download="הפנימיות-של-חנוכה.pdf">הורדת החוברת המלאה (PDF)</a>' +
      '<a class="btn btn--line" href="#sefer">קריאה באתר</a>' : '';

    return '' +
      '<section class="nhead dark" aria-labelledby="n-title"><div class="wrap nhead__in">' +
        '<div class="nhead__art">' + menorahSVG(n, { interactive: true, selected: n }) + '</div>' +
        '<p class="nhead__crumbs"><a href="#nights">שמונת הנרות</a> / נר ' + ORD[n - 1] + '</p>' +
        '<p class="nhead__count">' + (isTonight ? 'הלילה · ' : '') + 'נר ' + ORD[n - 1] + '</p>' +
        (unlocked ? greetingHTML() : '') +
        '<h1 id="n-title" tabindex="-1">' + esc(night.title) + '</h1>' +
        '<p class="nhead__date"><span>' + esc(longDate(d, true)) + ' בערב</span>' + (note ? '<span class="note">' + esc(note) + '</span>' : '') + '</p>' +
        '<p class="nhead__theme">' + esc(txt(night.candle_theme)) + '</p>' +
      '</div></section>' +
      '<article class="nbody paper"><div class="wrap"><div class="col">' +
        '<div class="teaser' + (unlocked ? '' : ' teaser--locked') + '"><div class="prose">' + P(parts.teaser) + '</div>' +
        (unlocked ? '' : gateHTML()) + '</div>' +
        '<div class="night-rest" id="nightRest"' + (unlocked ? '' : ' hidden') + '>' + fullRest + '</div>' +
        '<div class="nactions"><button class="btn btn--line" type="button" data-share="' + n + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>שיתוף הלימוד</button>' +
        pdfBtn +
        '<div class="share-pop" id="sharePop"><a class="btn btn--line" target="_blank" rel="noopener" data-wa>וואטסאפ</a><button class="btn btn--line" type="button" data-copy>העתקת קישור</button></div></div>' +
        '<nav class="pager" aria-label="ניווט בין הנרות">' + prev + next + '</nav>' +
      '</div></div></article>';
  }

  function aviadView() {
    var ded = C.dedication || {}, will = C.aviad_will || {};
    var pts = (will.points || []).map(function (p, i) {
      return '<li><span class="will__n" aria-hidden="true">' + (p.n || i + 1) + '</span><h3>' + esc(p.heading || '') + '</h3><p>' + esc(txt(p.text)) + '</p></li>';
    }).join('');
    return '' +
      '<section class="dhead dark" aria-labelledby="d-title"><div class="wrap">' +
        '<img class="portrait portrait--lg" src="img/aviad.jpg" width="150" height="150" alt="שלמה אביעד ניימן הי״ד">' +
        '<p class="dhead__pre">לעילוי נשמת הגיבור</p>' +
        '<h1 id="d-title" tabindex="-1">שלמה אביעד ניימן הי״ד</h1>' +
        '<p class="dhead__sub">' + esc(ded.subtitle || '') + '</p>' +
      '</div></section>' +
      '<article class="section paper"><div class="wrap"><div class="measure" style="margin-inline:auto">' +
        '<div class="prose lede">' + P(ded.body) + '</div>' +
        '<h2 style="margin-top:3rem">' + esc(will.title || 'הדרך שבה אביעד חי') + '</h2>' +
        (will.intro ? '<p style="color:var(--muted);margin:0">' + esc(txt(will.intro)) + '</p>' : '') +
        '<ol class="will">' + pts + '</ol>' +
        (ded.idf_fallen ? '<p class="idf">' + esc(txt(ded.idf_fallen)) + '</p>' : '') +
        '<div class="nactions"><a class="btn btn--line" href="#night-1">ללימוד הנר הראשון ' + arrowL + '</a></div>' +
      '</div></div></article>';
  }

  function dedupe(t, h) {
    if (!h) return t;
    var hs = String(h).trim();
    var t2 = t.trim();
    if (t2.indexOf(hs) === 0) { var rest = t2.slice(hs.length).replace(/^[\s.:\-–]+/, ''); return rest || t2; }
    return t2;
  }
  function poemsView() {
    return '<section class="nhead dark" aria-labelledby="p-title"><div class="wrap" style="padding:3rem 0 2.6rem">' +
      '<p class="overline">מתוך החוברת</p><h1 id="p-title" tabindex="-1" style="font-family:var(--serif);font-weight:900;font-size:clamp(2.4rem,9vw,4rem);margin:0;color:#f9f1e2">שירי החוברת</h1></div></section>' +
      '<section class="section paper"><div class="wrap"><div class="poems" style="margin-top:0">' +
      (C.book_songs_lyrics || []).map(function (p) { return poemHTML(p); }).join('') + '</div></div></section>';
  }

  function footerHTML() {
    var cr = C.credits || {};
    var col = cr.college;
    return '<div class="wrap"><div><p class="site-foot__book">' + esc(cr.book || 'הפנימיות של חנוכה') + '</p>' +
      '<p>' + esc(cr.line || '') + '</p>' +
      '<p>' + esc((C.dedication && C.dedication.title) || '') + ' ' + esc(stripIdf(C.dedication && C.dedication.idf_fallen) ? '· ' + stripIdf(C.dedication.idf_fallen) : '') + '</p></div>' +
      (col ? '<div class="site-foot__fine"><p>' + esc(col.name) + (col.phone ? ' · <a href="tel:' + esc(col.phone) + '">' + esc(col.phone.replace(/^(\d{3})(\d{7})$/, '$1-$2')) + '</a>' : '') +
        (col.url ? ' · <a href="' + esc(col.url) + '" target="_blank" rel="noopener">' + esc(col.url.replace(/^https?:\/\/(www\.)?/, '')) + '</a>' : '') + '</p></div>' : '') +
      '</div>';
  }

  /* ---------------- router ---------------- */
  var lastRoute = null;
  function route() {
    var h = location.hash.replace(/^#/, '');
    var view = $('#view'), m, scrollTo = null, key;
    if ((m = /^night-([1-8])$/.exec(h))) { key = 'n' + m[1]; }
    else if (h === 'aviad') key = 'aviad';
    else if (h === 'shirim') key = 'shirim';
    else if (h === 'sefer') key = 'sefer';
    else { key = 'home'; if (h) scrollTo = h; }

    if (key !== lastRoute) {
      unbindSefer();
      view.style.animation = 'none'; void view.offsetWidth; view.style.animation = '';
      if (key === 'home') { view.innerHTML = homeView(); document.title = 'הפנימיות של חנוכה · לימוד לשמונת הנרות'; }
      else if (key === 'aviad') { view.innerHTML = aviadView(); document.title = 'לעילוי נשמת שלמה אביעד ניימן הי״ד · הפנימיות של חנוכה'; }
      else if (key === 'shirim') { view.innerHTML = poemsView(); document.title = 'שירי החוברת · הפנימיות של חנוכה'; }
      else if (key === 'sefer') { view.innerHTML = seferView(); document.title = 'החוברת המלאה · הפנימיות של חנוכה'; bindReader(); }
      else { var n = +key.slice(1); view.innerHTML = nightView(n); document.title = 'נר ' + ORD[n - 1] + ': ' + C.nights[n - 1].title + ' · הפנימיות של חנוכה'; bindShare(n); bindGate(n); }
      bindMenorah(view);
      if (!scrollTo) {
        window.scrollTo(0, 0);
        var h1 = view.querySelector('h1');
        if (h1 && lastRoute !== null) h1.focus({ preventScroll: true });
      }
      lastRoute = key;
    }
    if (scrollTo) {
      var el = document.getElementById(scrollTo);
      if (el) setTimeout(function () { el.scrollIntoView({ block: 'start' }); }, 30);
    }
    document.querySelectorAll('.nav a').forEach(function (a) {
      var t = a.getAttribute('href').slice(1);
      if ((t === 'aviad' && key === 'aviad') || (t === 'shirim' && key === 'shirim') || (t === 'sefer' && key === 'sefer') || (t === 'nights' && key[0] === 'n' && key !== 'home')) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    closeMenu();
  }

  /* ---------------- share ---------------- */
  function baseURL() { return location.href.split('#')[0].split('?')[0]; }
  function bindShare(n) {
    var btn = $('[data-share]'), pop = $('#sharePop');
    if (!btn) return;
    var url = baseURL() + '#night-' + n;
    var title = 'נר ' + ORD[n - 1] + ': ' + C.nights[n - 1].title;
    var text = title + ' · לימוד לחנוכה מתוך "הפנימיות של חנוכה"';
    $('[data-wa]', pop).href = 'https://wa.me/?text=' + encodeURIComponent(text + '\n' + url);
    btn.addEventListener('click', function () {
      if (navigator.share) {
        navigator.share({ title: title, text: text, url: url }).catch(function () {});
      } else {
        pop.classList.toggle('open');
      }
    });
    $('[data-copy]', pop).addEventListener('click', function () {
      var done = function () { toast('הקישור הועתק'); };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(url).then(done, function () { legacyCopy(url); done(); });
      else { legacyCopy(url); done(); }
    });
  }
  function legacyCopy(s) {
    var t = document.createElement('textarea'); t.value = s; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (e) {} document.body.removeChild(t);
  }
  var toastTimer;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  /* ---------------- menu ---------------- */
  function closeMenu() { var b = $('#menuBtn'); b.setAttribute('aria-expanded', 'false'); $('#nav').classList.remove('open'); }
  $('#menuBtn').addEventListener('click', function () {
    var open = this.getAttribute('aria-expanded') !== 'true';
    this.setAttribute('aria-expanded', String(open)); $('#nav').classList.toggle('open', open);
  });
  $('#nav').addEventListener('click', function (e) {
    var a = e.target.closest('a'); if (!a) return;
    if (a.getAttribute('href') === location.hash) { route(); var el = document.getElementById(location.hash.slice(1)); if (el) el.scrollIntoView(); }
    closeMenu();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeMenu(); closeDrawer(); } });

  /* ---------------- music player (YouTube IFrame API) ---------------- */
  var songs = [], cur = 0, curId = null, yt = null, ytReady = false, ytLoading = false, wantPlay = false, playing = false;
  var player = $('#player'), drawer = $('#drawer');

  function buildPlaylist() {
    songs = (C.songs || []).filter(function (s) { return s && s.youtube_id && BLOCKED_SONGS.indexOf(s.youtube_id) < 0 && !/six13/i.test(s.artist || ''); });
    var first = -1;
    songs.forEach(function (s, i) { if (first < 0 && /ארבע\s*בבות/.test(s.title)) first = i; });
    if (first > 0) songs.unshift(songs.splice(first, 1)[0]);
    curId = songs[0] && songs[0].youtube_id;
    var list = $('#tracks');
    list.innerHTML = songs.map(function (s, i) {
      var alts = (s.alternates || []).filter(function (a) { return a.youtube_id; });
      return '<li><button class="track" type="button" data-i="' + i + '" data-id="' + esc(s.youtube_id) + '">' +
        '<span class="track__n"><span class="track__num">' + (i + 1) + '</span><span class="eq" aria-hidden="true"><i></i><i></i><i></i></span></span>' +
        '<span><span class="track__t">' + esc(s.title) + '</span><span class="track__a">' + esc(s.artist || '') + '</span></span></button>' +
        (alts.length ? '<div class="alts" aria-label="ביצועים נוספים">' + alts.map(function (a) {
          return '<button class="alt" type="button" data-i="' + i + '" data-id="' + esc(a.youtube_id) + '" data-artist="' + esc(a.artist) + '">' + esc(a.artist) + '</button>';
        }).join('') + '</div>' : '') + '</li>';
    }).join('');
    list.addEventListener('click', function (e) {
      var b = e.target.closest('[data-id]'); if (!b) return;
      select(+b.getAttribute('data-i'), b.getAttribute('data-id'), b.getAttribute('data-artist'), true);
    });
    updateUI();
  }
  function updateUI(artistOverride) {
    var s = songs[cur]; if (!s) return;
    $('#barTrack').textContent = s.title.replace(/\s*\(.*\)\s*$/, '') + ' · ' + (artistOverride || s.artist || '');
    $('#barLabel').textContent = playing ? 'מתנגן עכשיו' : 'שירים לחנוכה';
    document.querySelectorAll('#tracks .track').forEach(function (b) { b.setAttribute('aria-current', String(+b.getAttribute('data-i') === cur)); });
    document.querySelectorAll('#tracks .alt').forEach(function (b) { b.setAttribute('aria-current', String(b.getAttribute('data-id') === curId)); });
    player.classList.toggle('playing', playing);
    $('#playBtn').setAttribute('aria-label', playing ? 'השהיה' : 'ניגון');
  }
  function loadYT() {
    if (ytLoading) return; ytLoading = true;
    var prevCb = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = function () {
      if (prevCb) try { prevCb(); } catch (e) {}
      yt = new YT.Player('ytHost', {
        width: '100%', height: '100%', videoId: curId,
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1, hl: 'he', origin: location.protocol.indexOf('http') === 0 ? location.origin : undefined },
        events: {
          onReady: function () { ytReady = true; player.classList.add('ready'); player.classList.remove('loading'); if (wantPlay) yt.playVideo(); },
          onStateChange: function (e) {
            if (e.data === 1) { playing = true; player.classList.remove('loading'); }
            else if (e.data === 2 || e.data === -1 || e.data === 5) playing = false;
            else if (e.data === 0) { playing = false; next(true); return; }
            updateUI(currentAltArtist);
          },
          onError: function () { next(true); }
        }
      });
    };
    var s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.async = true;
    s.onerror = function () { ytLoading = false; player.classList.remove('loading'); toast('לא ניתן לטעון את הנגן כרגע'); };
    document.head.appendChild(s);
  }
  var currentAltArtist = null;
  function select(i, id, altArtist, play) {
    cur = (i + songs.length) % songs.length;
    curId = id || songs[cur].youtube_id;
    currentAltArtist = altArtist || null;
    updateUI(currentAltArtist);
    if (play) startPlay();
    else if (ytReady) yt.cueVideoById(curId);
  }
  function startPlay() {
    wantPlay = true;
    if (ytReady) {
      var vd = yt.getVideoData && yt.getVideoData();
      if (vd && vd.video_id === curId) yt.playVideo(); else yt.loadVideoById(curId);
    } else { player.classList.add('loading'); loadYT(); }
  }
  function next(play) { select(cur + 1, null, null, play !== false ? (play || playing) : false); }
  function prev() { select(cur - 1, null, null, playing); }
  $('#playBtn').addEventListener('click', function () {
    if (playing && yt) { wantPlay = false; yt.pauseVideo(); } else startPlay();
  });
  $('#nextBtn').addEventListener('click', function () { next(playing || wantPlay); });
  $('#prevBtn').addEventListener('click', prev);
  function openDrawer() { drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false'); $('#listBtn').setAttribute('aria-expanded', 'true'); $('#barInfo').setAttribute('aria-expanded', 'true'); if (!ytLoading) loadYT(); }
  function closeDrawer() { drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); $('#listBtn').setAttribute('aria-expanded', 'false'); $('#barInfo').setAttribute('aria-expanded', 'false'); }
  function toggleDrawer() { drawer.classList.contains('open') ? closeDrawer() : openDrawer(); }
  $('#listBtn').addEventListener('click', toggleDrawer);
  $('#barInfo').addEventListener('click', toggleDrawer);
  $('#drawerClose').addEventListener('click', closeDrawer);
  document.addEventListener('click', function (e) { if (drawer.classList.contains('open') && !player.contains(e.target)) closeDrawer(); });

  /* ---------------- boot ---------------- */
  function start(content) {
    C = content;
    if (!C || !C.nights || !C.nights.length) { $('#loading').textContent = 'שגיאה בטעינת התוכן'; return; }
    T = timeState();
    $('#loading').remove();
    var foot = $('#siteFoot'); foot.innerHTML = footerHTML(); foot.hidden = false;
    buildPlaylist();
    trackVisit();
    window.addEventListener('hashchange', route);
    route();
    // warm the YouTube API when idle so the first tap on play starts instantly (mobile gesture rules)
    var warm = function () { if (!ytLoading) loadYT(); };
    if ('requestIdleCallback' in window) requestIdleCallback(function () { setTimeout(warm, 2500); }); else setTimeout(warm, 4000);
  }
  function fallback() {
    if (window.CONTENT) return start(window.CONTENT);
    var s = document.createElement('script'); s.src = 'content.js';
    s.onload = function () { start(window.CONTENT); };
    s.onerror = function () { $('#loading').textContent = 'שגיאה בטעינת התוכן'; };
    document.head.appendChild(s);
  }
  if (location.protocol === 'file:' || !window.fetch) fallback();
  else fetch('content.json', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(start).catch(fallback);

  // expose for testing
  window.__hanukkah = { timeState: function () { return T; }, computeFirstCandle: computeFirstCandle, getProfile: getProfile, saveProfile: saveProfile, eventPayload: eventPayload };
})();

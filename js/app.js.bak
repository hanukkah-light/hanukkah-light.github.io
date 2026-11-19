/* הפנימיות של חנוכה — app (no dependencies) */
(function () {
  'use strict';

  var ORD = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שביעי', 'שמיני'];
  var LET = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ז׳', 'ח׳'];
  var NEW_NIGHT_HOUR = 16;
  var BLOCKED_SONGS = ['NoHp2Rq8sMI']; // too light for a memorial site
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
    var cupY = 150, candleH = 40, shY = 108;
    var defs = '<defs>' +
      '<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ecd49a"/><stop offset=".45" stop-color="#c9a24f"/><stop offset="1" stop-color="#8f6a2a"/></linearGradient>' +
      '<linearGradient id="wax" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d9ccb2"/><stop offset=".45" stop-color="#f8f0df"/><stop offset="1" stop-color="#cdbfa3"/></linearGradient>' +
      '<radialGradient id="glow' + uid + '"><stop offset="0" stop-color="#ffcf7a" stop-opacity=".55"/><stop offset=".45" stop-color="#ffb347" stop-opacity=".16"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="fo' + uid + '" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff8a2a"/><stop offset=".5" stop-color="#ffc35e"/><stop offset="1" stop-color="#ffe7a8"/></linearGradient>' +
      '</defs>';
    var g = '';
    // arms (nested half-ellipses)
    [40, 80, 120, 160].forEach(function (r) {
      g += '<path class="metal" d="M' + (200 - r) + ' ' + cupY + ' A' + r + ' ' + (r * .52) + ' 0 0 0 ' + (200 + r) + ' ' + cupY + '"/>';
      g += '<ellipse class="metal-fill" cx="200" cy="' + (cupY + r * .52) + '" rx="4.6" ry="3.2"/>';
    });
    // stem + base
    g += '<path class="metal" d="M200 ' + (shY + 6) + ' V262"/>';
    g += '<path class="metal-fill" d="M186 262 h28 l20 22 h-68z"/>';
    g += '<rect class="metal-fill" x="150" y="284" width="100" height="5" rx="2.5"/>';
    // cups
    XS.concat([200]).forEach(function (x) {
      var y = x === 200 ? shY : cupY;
      g += '<path class="metal-fill" d="M' + (x - 10) + ' ' + (y - 6) + ' h20 l-3 7 h-14z"/>';
    });
    // candles + flames
    var candles = '';
    XS.forEach(function (x, i) {
      var n = i + 1, top = cupY - 6 - candleH, isLit = n <= lit;
      candles += '<g class="slot' + (isLit ? ' lit' : '') + (opts.selected === n ? ' sel' : '') + '" data-night="' + n + '"' +
        (opts.interactive ? ' role="link" tabindex="0" aria-label="נר ' + ORD[i] + (C && C.nights[i] ? ': ' + esc(C.nights[i].title) : '') + '"' : '') + '>' +
        '<rect class="candle" x="' + (x - 4.5) + '" y="' + top + '" width="9" height="' + candleH + '" rx="1.5"/>' +
        '<line class="wick" x1="' + x + '" y1="' + top + '" x2="' + x + '" y2="' + (top - 4) + '"/>' +
        flameSVG(x, top, false) +
        '<circle class="mark" cx="' + x + '" cy="' + (cupY + 14) + '" r="2.2"/>' +
        (opts.interactive ? '<rect class="ring" x="' + (x - 16) + '" y="' + (top - 34) + '" width="32" height="' + (candleH + 44) + '" rx="16"/><rect class="hit" x="' + (x - 20) + '" y="' + (top - 36) + '" width="40" height="' + (candleH + 60) + '"/>' : '') +
        '</g>';
    });
    var shTop = shY - 6 - candleH - 4;
    candles += '<g class="slot' + (lit > 0 || opts.shamash ? ' lit' : '') + '" aria-hidden="true"><rect class="candle" x="195" y="' + shTop + '" width="10" height="' + (candleH + 4) + '" rx="1.5"/>' +
      '<line class="wick" x1="200" y1="' + shTop + '" x2="200" y2="' + (shTop - 4) + '"/>' + flameSVG(200, shTop, true) + '</g>';
    var label = opts.label || (lit ? 'חנוכייה ובה ' + (lit === 1 ? 'נר אחד דולק' : lit + ' נרות דולקים') + ' ושמש' : 'חנוכייה');
    return '<svg class="menorah" viewBox="0 20 400 280" role="img" aria-label="' + esc(label) + '">' + defs + g + candles + '</svg>';
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
    var story = night.story && (night.story.text || night.story.title) ?
      '<aside class="story" aria-labelledby="st-' + n + '"><p class="story__label">סיפור</p><h2 id="st-' + n + '">' + esc(night.story.title || '') + '</h2>' + P(night.story.text) + '</aside>' : '';
    var poem = night.poem_ref ? poemHTML(findPoem(night.poem_ref), true) : '';
    var relax = night.guided_relaxation ?
      '<details class="relax"><summary>' + esc(night.guided_relaxation.title || 'הרפיה') + '</summary><div class="prose">' + P(night.guided_relaxation.paragraphs || night.guided_relaxation.text) + '</div></details>' : '';
    var prev = n > 1 ? '<a href="#night-' + (n - 1) + '"><small>→ נר ' + ORD[n - 2] + '</small><b>' + esc(C.nights[n - 2].title) + '</b></a>' : '<a href="#"><small>→ חזרה</small><b>לעמוד הראשי</b></a>';
    var next = n < 8 ? '<a class="next" href="#night-' + (n + 1) + '"><small>נר ' + ORD[n] + ' ←</small><b>' + esc(C.nights[n].title) + '</b></a>' : '<a class="next" href="#aviad"><small>לעילוי נשמת ←</small><b>הדרך שבה אביעד חי</b></a>';

    return '' +
      '<section class="nhead dark" aria-labelledby="n-title"><div class="wrap nhead__in">' +
        '<div class="nhead__art">' + menorahSVG(n, { interactive: true, selected: n }) + '</div>' +
        '<p class="nhead__crumbs"><a href="#nights">שמונת הנרות</a> / נר ' + ORD[n - 1] + '</p>' +
        '<p class="nhead__count">' + (isTonight ? 'הלילה · ' : '') + 'נר ' + ORD[n - 1] + '</p>' +
        '<h1 id="n-title" tabindex="-1">' + esc(night.title) + '</h1>' +
        '<p class="nhead__date"><span>' + esc(longDate(d, true)) + ' בערב</span>' + (note ? '<span class="note">' + esc(note) + '</span>' : '') + '</p>' +
        '<p class="nhead__theme">' + esc(txt(night.candle_theme)) + '</p>' +
      '</div></section>' +
      '<article class="nbody paper"><div class="wrap"><div class="col">' +
        '<div class="prose">' + P(night.body) + '</div>' +
        story + poem +
        (night.quote ? '<figure class="quote"><svg class="quote__orn" viewBox="0 0 46 14" aria-hidden="true"><path d="M0 7h17M29 7h17" stroke="currentColor" stroke-width="1"/><path d="M23 1c2.5 3 4 4.5 4 7a4 4 0 0 1-8 0c0-2.5 1.5-4 4-7z" fill="currentColor"/></svg><blockquote>' + esc(txt(night.quote)) + '</blockquote><figcaption>מתוך החוברת</figcaption></figure>' : '') +
        (night.inner_work ? '<section class="work" aria-labelledby="w-' + n + '"><h2 id="w-' + n + '">' + flameIcon + 'עבודה פנימית להלילה</h2>' + P(night.inner_work) + '</section>' : '') +
        relax +
        '<div class="nactions"><button class="btn btn--line" type="button" data-share="' + n + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>שיתוף הלימוד</button>' +
        '<div class="share-pop" id="sharePop"><a class="btn btn--line" target="_blank" rel="noopener" data-wa>וואטסאפ</a><button class="btn btn--line" type="button" data-copy>העתקת קישור</button></div></div>' +
        (night.source_chapter ? '<p class="source">מקורות בחוברת: ' + esc(txt(night.source_chapter)) + '</p>' : '') +
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
    else { key = 'home'; if (h) scrollTo = h; }

    if (key !== lastRoute) {
      view.style.animation = 'none'; void view.offsetWidth; view.style.animation = '';
      if (key === 'home') { view.innerHTML = homeView(); document.title = 'הפנימיות של חנוכה · לימוד לשמונת הנרות'; }
      else if (key === 'aviad') { view.innerHTML = aviadView(); document.title = 'לעילוי נשמת שלמה אביעד ניימן הי״ד · הפנימיות של חנוכה'; }
      else if (key === 'shirim') { view.innerHTML = poemsView(); document.title = 'שירי החוברת · הפנימיות של חנוכה'; }
      else { var n = +key.slice(1); view.innerHTML = nightView(n); document.title = 'נר ' + ORD[n - 1] + ': ' + C.nights[n - 1].title + ' · הפנימיות של חנוכה'; bindShare(n); }
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
      if ((t === 'aviad' && key === 'aviad') || (t === 'shirim' && key === 'shirim') || (t === 'nights' && key[0] === 'n' && key !== 'home')) a.setAttribute('aria-current', 'page');
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
  window.__hanukkah = { timeState: function () { return T; }, computeFirstCandle: computeFirstCandle };
})();

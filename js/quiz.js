/* Quiz gate: "איזה נר אתה?" */
(function (w) {
  var SITE_ORIGIN = 'https://hanukkah-light.github.io';
  var ORD = ['הראשון', 'השני', 'השלישי', 'הרביעי', 'החמישי', 'השישי', 'השביעי', 'השמיני'];
  var deps = null;
  var state = {
    step: 'intro', /* intro | q | form | result */
    qi: 0,
    answers: [],
    gender: '',
    birth: '',
    candle: 0,
    composed: null
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function Q() { return (deps.content && deps.content.quiz) || {}; }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function questions() { return Q().questions || []; }

  function fnv(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function pick(arr, seed, salt) {
    if (!arr || !arr.length) return '';
    var x = fnv(String(seed) + '|' + salt);
    return arr[x % arr.length];
  }
  function you(gender, male, female) {
    return gender === 'female' ? female : male;
  }

  function optionByIndex(q, idx) {
    return (q && q.options && q.options[idx]) || null;
  }

  function scoreAnswers(answers, birth) {
    var qz = questions();
    var s = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    qz.forEach(function (q, i) {
      if (q.birth) return;
      var opt = optionByIndex(q, answers[i]);
      if (!opt || !opt.scores) return;
      opt.scores.forEach(function (pair) { s[pair[0]] += pair[1]; });
    });
    var weights = (Q().birth_weights || {})[birth] || [];
    weights.forEach(function (pair) { s[pair[0]] += pair[1]; });
    var max = 0, n;
    for (n = 1; n <= 8; n++) if (s[n] > max) max = s[n];
    var cands = [];
    for (n = 1; n <= 8; n++) if (s[n] === max) cands.push(n);
    if (cands.length === 1) return cands[0];
    /* soft preferred candles from birth among ties */
    var pref = {};
    weights.forEach(function (pair) { pref[pair[0]] = pair[1]; });
    cands.sort(function (a, b) { return (pref[b] || 0) - (pref[a] || 0); });
    if ((pref[cands[0]] || 0) > (pref[cands[1]] || 0)) return cands[0];
    var seed = answers.join(',') + '|' + (birth || '');
    return cands[fnv(seed) % cands.length];
  }

  function resultSeed(name, answers, birth, gender) {
    return [name || '', answers.join(','), birth || '', gender || ''].join('|');
  }

  function compose(profile, answers, candle, gender, birth) {
    var quiz = Q();
    var night = (deps.content.nights || [])[candle - 1] || {};
    var pack = (quiz.results || {})[candle] || { openings: [], light: [] };
    var seed = resultSeed(profile && profile.name, answers, birth, gender);
    var name = (profile && profile.name) || '';
    var ata = you(gender, 'אתה', 'את');
    var ord = (quiz.ordinals || ORD)[candle - 1] || String(candle);
    var titleLine = name
      ? (name + ', ' + ata + ' הנר ' + ord + ' – ' + (night.title || ''))
      : (ata + ' הנר ' + ord + ' – ' + (night.title || ''));

    var opening = pick(pack.openings, seed, 'open');
    var light = pick(pack.light, seed, 'light');

    /* insert from a distinctive non-birth answer */
    var insert = '';
    var qz = questions();
    var prefer = ['strength', 'giving', 'down', 'friends', 'home'];
    var ids = [];
    qz.forEach(function (q, i) {
      if (q.birth) return;
      var opt = optionByIndex(q, answers[i]);
      if (opt) ids.push(opt.id);
    });
    var inserts = quiz.inserts || {};
    prefer.forEach(function (qid) {
      if (insert) return;
      var qi = -1;
      qz.forEach(function (q, i) { if (q.id === qid) qi = i; });
      if (qi < 0) return;
      var opt = optionByIndex(qz[qi], answers[qi]);
      if (opt && inserts[opt.id]) insert = inserts[opt.id];
    });
    if (!insert) {
      for (var i = 0; i < ids.length; i++) {
        if (inserts[ids[i]]) { insert = inserts[ids[i]]; break; }
      }
    }
    /* vary insert pick if several exist: already first-preferred, ok */

    var birthLine = pick((quiz.birth_lines || {})[birth] || [], seed, 'birth');
    var around = pick(quiz.around || [], seed, 'around');

    var extra = [];
    var occ = profile && String(profile.occupation || '').trim();
    var lt = profile && String(profile.light || '').trim();
    if (occ) extra.push(pick(quiz.weave_occupation || [], seed, 'occ').replace(/\{occupation\}/g, occ));
    if (lt) extra.push(pick(quiz.weave_light || [], seed, 'lt').replace(/\{light\}/g, lt));

    var parts = [opening, light, insert, birthLine, around].concat(extra).filter(Boolean);
    return {
      candle: candle,
      title: night.title || '',
      ordinal: ord,
      headline: titleLine,
      parts: parts,
      gender: gender,
      birth: birth
    };
  }

  function progressHTML(qi, total) {
    var dots = '';
    for (var i = 0; i < total; i++) {
      dots += '<i class="' + (i < qi ? 'is-done' : i === qi ? 'is-now' : '') + '"></i>';
    }
    return '<div class="quiz-prog" aria-hidden="true">' + dots + '</div>' +
      '<p class="quiz-prog__n">' + (qi + 1) + ' מתוך ' + total + '</p>';
  }

  function markSVG() {
    return '<svg class="quiz-mark" viewBox="0 0 36 28" aria-hidden="true"><path d="M12 5C15 10 17 13 17 17.5a5.2 5.2 0 1 1-10.4 0c0-3.2 1.5-5 2.3-6.6.7 2.2 1.5 3.1 2.3 3.1 0-3 0-6.2.8-9z" fill="currentColor" opacity=".5"/><path d="M26 1C30 7 33 11 33 17a7 7 0 0 1-14 0c0-4 2-6 3-8 1 3 2 4 3 4 0-4 0-8 1-12z" fill="currentColor"/></svg>';
  }

  function introHTML() {
    var q = Q();
    var g = state.gender;
    return '<section class="quiz quiz--intro" aria-labelledby="quiz-h">' +
      '<div class="quiz__in">' +
        '<p class="quiz__brand">' + markSVG() + esc(q.intro_kicker || 'הפנימיות של חנוכה') + '</p>' +
        '<h1 id="quiz-h">' + esc(q.intro_title || 'בכל אחד דולק נר אחר.') + '</h1>' +
        '<p class="quiz__lead">' + esc(q.intro_line || 'גלו איזה נר אתם.') + '</p>' +
        (q.intro_sub ? '<p class="quiz__sub">' + esc(q.intro_sub) + '</p>' : '') +
        '<div class="quiz-gender">' +
          '<p class="quiz-gender__lab">' + esc(q.gender_label || 'לפנות אליך בלשון:') + '</p>' +
          '<div class="quiz-gender__row" role="group">' +
            '<button type="button" class="quiz-chip' + (g === 'male' ? ' is-on' : '') + '" data-gender="male">' + esc(q.gender_male || 'זכר') + '</button>' +
            '<button type="button" class="quiz-chip' + (g === 'female' ? ' is-on' : '') + '" data-gender="female">' + esc(q.gender_female || 'נקבה') + '</button>' +
          '</div>' +
        '</div>' +
        '<button class="btn btn--flame" type="button" id="quizStart"' + (g ? '' : ' disabled') + '>' + esc(q.start || 'התחלה') + '</button>' +
      '</div></section>';
  }

  function questionHTML() {
    var qz = questions();
    var q = qz[state.qi];
    if (!q) return '';
    var opts = (q.options || []).map(function (o, i) {
      return '<button type="button" class="quiz-opt" data-opt="' + i + '"><span>' + esc(o.label) + '</span></button>';
    }).join('');
    return '<section class="quiz quiz--q" aria-labelledby="quiz-qh">' +
      '<div class="quiz__in">' +
        progressHTML(state.qi, qz.length) +
        '<h1 id="quiz-qh">' + esc(q.text) + '</h1>' +
        '<div class="quiz-opts">' + opts + '</div>' +
      '</div></section>';
  }

  function formHTML() {
    var q = Q();
    return '<section class="quiz quiz--form" aria-labelledby="quiz-ready">' +
      '<div class="quiz__in">' +
        '<p class="quiz__brand">' + markSVG() + '</p>' +
        '<h1 id="quiz-ready">' + esc(q.ready || 'התוצאה שלך מוכנה ✦') + '</h1>' +
        '<p class="quiz__sub">' + esc(q.ready_sub || '') + '</p>' +
        '<form class="welcome__form quiz-form" id="welcomeForm" novalidate>' +
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
          '<p class="gate-card__err" id="welcomeErr" hidden></p>' +
          '<button class="btn btn--flame" type="submit">' + esc(q.form_btn || 'לגילוי הנר') + '</button>' +
        '</form>' +
      '</div></section>';
  }

  function resultBodyHTML(composed) {
    var paras = (composed.parts || []).map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('');
    return '<p class="quiz-result__kicker">הנר ' + esc(composed.ordinal) + '</p>' +
      '<h1 class="quiz-result__h">' + esc(composed.headline) + '</h1>' +
      '<div class="quiz-result__body">' + paras + '</div>';
  }

  function resultHTML(composed) {
    var q = Q();
    return '<section class="quiz quiz--result" aria-labelledby="quiz-rh">' +
      '<div class="quiz__in quiz__in--result">' +
        '<div class="quiz-result" id="quiz-rh">' + resultBodyHTML(composed) + '</div>' +
        '<div class="quiz-actions">' +
          '<a class="btn btn--flame" id="quizToCandle" href="#night-' + composed.candle + '">' + esc(q.to_candle || 'ללימוד של הנר הזה') + '</a>' +
          '<a class="btn btn--ghost" id="quizToSite" href="#">' + esc(q.to_site || 'לכל שמונת הנרות') + '</a>' +
          '<button class="btn btn--line" type="button" id="quizShare">' + esc(q.share || 'שיתוף התוצאה') + '</button>' +
          '<button class="btn btn--line" type="button" id="quizCard">' + esc(q.download_card || 'הורדת כרטיס') + '</button>' +
        '</div>' +
        '<canvas id="quizShareCanvas" width="1080" height="1080" hidden></canvas>' +
      '</div></section>';
  }

  function validPhone(s) { return String(s || '').replace(/\D/g, '').length >= 9; }
  function validEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim()); }

  function paint() {
    var el = deps.root;
    if (!el) return;
    el.hidden = false;
    document.body.classList.add('is-locked');
    if (state.step === 'intro') el.innerHTML = introHTML();
    else if (state.step === 'q') el.innerHTML = questionHTML();
    else if (state.step === 'form') el.innerHTML = formHTML();
    else if (state.step === 'result') el.innerHTML = resultHTML(state.composed);
    bind();
  }

  function bind() {
    var el = deps.root;
    if (state.step === 'intro') {
      el.querySelectorAll('[data-gender]').forEach(function (b) {
        b.addEventListener('click', function () {
          state.gender = b.getAttribute('data-gender');
          paint();
        });
      });
      var st = $('#quizStart', el);
      if (st) st.addEventListener('click', function () {
        if (!state.gender) return;
        state.step = 'q';
        state.qi = 0;
        state.answers = [];
        paint();
      });
    }
    if (state.step === 'q') {
      el.querySelectorAll('[data-opt]').forEach(function (b) {
        b.addEventListener('click', function () {
          var idx = +b.getAttribute('data-opt');
          b.classList.add('is-picked');
          el.querySelectorAll('[data-opt]').forEach(function (x) { x.disabled = true; });
          var q = questions()[state.qi];
          state.answers[state.qi] = idx;
          if (q && q.birth && q.options[idx]) state.birth = q.options[idx].order || q.options[idx].id;
          setTimeout(function () {
            if (state.qi < questions().length - 1) {
              state.qi += 1;
              paint();
            } else {
              state.candle = scoreAnswers(state.answers, state.birth);
              var existing = deps.getProfile && deps.getProfile();
              if (existing && existing.name && (existing.phone || existing.email)) {
                finishWithProfile(existing, false);
              } else {
                state.step = 'form';
                paint();
              }
            }
          }, 180);
        });
      });
    }
    if (state.step === 'form') {
      var form = $('#welcomeForm', el), err = $('#welcomeErr', el);
      if (!form) return;
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var nm = form.name.value.trim();
        var phone = form.phone.value.trim();
        var email = form.email.value.trim();
        var occupation = form.occupation.value.trim();
        var light = form.light.value.trim();
        var consent = !!form.consent.checked;
        var msg = '';
        if (!nm) msg = 'כתבו את השם הפרטי, כדי שנוכל לפנות אליכם.';
        else if (!phone && !email) msg = 'השאירו טלפון או דוא״ל, אחד מהשניים.';
        else if (phone && !validPhone(phone)) msg = 'בדקו את מספר הטלפון, ונסו שוב.';
        else if (email && !validEmail(email)) msg = 'בדקו את כתובת הדוא״ל, ונסו שוב.';
        if (msg) { err.hidden = false; err.textContent = msg; return; }
        var profile = {
          name: nm, phone: phone, email: email, occupation: occupation, light: light,
          consent: consent, ts: new Date().toISOString(),
          gender: state.gender, birth_order: state.birth,
          answers: state.answers.slice(), candle: state.candle
        };
        finishWithProfile(profile, true);
      });
    }
    if (state.step === 'result') {
      var go = function (hash) {
        if (deps.enterSite) deps.enterSite();
        if (hash) location.hash = hash;
      };
      var a1 = $('#quizToCandle', el);
      var a2 = $('#quizToSite', el);
      if (a1) a1.addEventListener('click', function (e) { e.preventDefault(); go('#night-' + state.candle); });
      if (a2) a2.addEventListener('click', function (e) { e.preventDefault(); go('#'); });
      var sh = $('#quizShare', el);
      if (sh) sh.addEventListener('click', function () { shareResult(state.composed, false); });
      var dl = $('#quizCard', el);
      if (dl) dl.addEventListener('click', function () { shareResult(state.composed, true); });
    }
  }

  function compactAnswers() {
    /* compact array of option indexes, in question order */
    return state.answers.slice();
  }

  function finishWithProfile(profile, isNewSignup) {
    profile.gender = profile.gender || state.gender;
    profile.birth_order = profile.birth_order || state.birth;
    profile.answers = (profile.answers && profile.answers.length) ? profile.answers : compactAnswers();
    profile.candle = state.candle;
    if (deps.saveProfile) deps.saveProfile(profile);
    if (isNewSignup && deps.postEvent && deps.eventPayload) {
      try {
        deps.postEvent(deps.eventPayload('signup', {
          name: profile.name,
          phone: profile.phone || '',
          email: profile.email || '',
          occupation: profile.occupation || '',
          light: profile.light || '',
          consent: !!profile.consent,
          candle: profile.candle,
          answers: profile.answers,
          birth_order: profile.birth_order || '',
          gender: profile.gender || ''
        }));
      } catch (e) {}
    }
    state.composed = compose(profile, profile.answers, profile.candle, profile.gender, profile.birth_order);
    state.step = 'result';
    paint();
  }

  function publicShareURL() {
    return SITE_ORIGIN + '/?utm_source=share';
  }
  function shareText(composed) {
    return 'יצא לי הנר ' + composed.ordinal + ' – ' + composed.title + '. גלו איזה נר אתם:';
  }

  function wrapLines(ctx, text, maxWidth, maxLines) {
    var words = String(text || '').split(/\s+/), lines = [], line = '';
    words.forEach(function (w) {
      var t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width <= maxWidth) line = t;
      else { if (line) lines.push(line); line = w; }
    });
    if (line) lines.push(line);
    if (maxLines && lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      var last = lines[maxLines - 1];
      while (ctx.measureText(last + '…').width > maxWidth && last.length) last = last.slice(0, -1);
      lines[maxLines - 1] = last + '…';
    }
    return lines;
  }

  function drawShareCard(composed, cb) {
    var canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1080;
    var ctx = canvas.getContext('2d');
    var paintCard = function () {
      ctx.fillStyle = '#070910';
      ctx.fillRect(0, 0, 1080, 1080);
      var g = ctx.createRadialGradient(540, 280, 20, 540, 420, 640);
      g.addColorStop(0, 'rgba(196,160,86,0.22)');
      g.addColorStop(0.45, 'rgba(196,160,86,0.06)');
      g.addColorStop(1, 'rgba(7,9,16,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1080, 1080);
      ctx.strokeStyle = 'rgba(196,160,86,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(48, 48, 984, 984);

      ctx.fillStyle = '#e4cc8e';
      ctx.font = '500 36px Assistant, sans-serif';
      ctx.textAlign = 'center';
      ctx.direction = 'rtl';
      ctx.fillText('הפנימיות של חנוכה', 540, 160);

      /* eight ticks, one lit */
      var i, x0 = 540 + 7 * 22;
      for (i = 0; i < 8; i++) {
        var x = x0 - i * 44;
        var lit = (i + 1) === composed.candle;
        ctx.fillStyle = lit ? '#ffc163' : 'rgba(228,204,142,0.28)';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x - 5, 210, 10, lit ? 52 : 36, 2) : ctx.fillRect(x - 5, 210, 10, lit ? 52 : 36);
        ctx.fill();
        if (lit) {
          ctx.beginPath();
          ctx.ellipse(x, 200, 7, 12, 0, 0, Math.PI * 2);
          ctx.fillStyle = '#ffc163';
          ctx.fill();
        }
      }

      ctx.fillStyle = '#f9f1e2';
      ctx.font = '700 64px "Frank Ruhl Libre", "Noto Serif Hebrew", serif';
      var hl = composed.headline || '';
      var namePart = hl;
      var lines = wrapLines(ctx, namePart, 860, 3);
      var y = 360;
      lines.forEach(function (ln) { ctx.fillText(ln, 540, y); y += 78; });

      ctx.fillStyle = '#e4cc8e';
      ctx.font = '500 36px "Frank Ruhl Libre", serif';
      var snippet = (composed.parts && composed.parts[0]) || '';
      wrapLines(ctx, snippet, 800, 4).forEach(function (ln) { ctx.fillText(ln, 540, y); y += 52; });

      ctx.fillStyle = 'rgba(243,234,220,0.65)';
      ctx.font = '400 28px Assistant, sans-serif';
      ctx.fillText('hanukkah-light.github.io', 540, 980);
      if (cb) cb(canvas);
    };
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(paintCard, paintCard);
    } else paintCard();
    return canvas;
  }

  function canvasToBlob(canvas, cb) {
    if (canvas.toBlob) canvas.toBlob(cb, 'image/png');
    else {
      var data = canvas.toDataURL('image/png');
      var arr = data.split(','), b = atob(arr[1]), u = new Uint8Array(b.length);
      for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
      cb(new Blob([u], { type: 'image/png' }));
    }
  }

  function shareResult(composed, downloadOnly) {
    var text = shareText(composed);
    var url = publicShareURL();
    drawShareCard(composed, function (canvas) {
      canvasToBlob(canvas, function (blob) {
        if (!blob) return;
        var file = new File([blob], 'ner-' + composed.candle + '.png', { type: 'image/png' });
        if (downloadOnly) {
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = file.name;
          a.click();
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
          return;
        }
        var payload = { title: composed.headline, text: text, url: url };
        var withFile = { title: payload.title, text: payload.text, url: payload.url, files: [file] };
        if (navigator.share && navigator.canShare && navigator.canShare(withFile)) {
          navigator.share(withFile).catch(function () { fallbackShare(text, url); });
        } else if (navigator.share) {
          navigator.share(payload).catch(function () { fallbackShare(text, url); });
        } else {
          fallbackShare(text, url);
        }
      });
    });
  }
  function fallbackShare(text, url) {
    var wa = 'https://wa.me/?text=' + encodeURIComponent(text + ' ' + url);
    w.open(wa, '_blank', 'noopener');
  }

  function setDeps(options) { if (options) deps = options; }

  function startGate(options) {
    deps = options || deps;
    state.step = 'intro';
    state.qi = 0;
    state.answers = [];
    state.gender = '';
    state.birth = '';
    state.candle = 0;
    state.composed = null;
    paint();
  }

  function retake() {
    if (!deps) return;
    startGate(deps);
  }

  function homeCardHTML(profile) {
    if (!profile || !profile.candle) return '';
    var quiz = Q();
    var composed = compose(profile, profile.answers || [], profile.candle, profile.gender, profile.birth_order);
    var ata = you(profile.gender, 'אתה', 'את');
    return '<aside class="home-ner" aria-label="הנר שלך">' +
      '<div class="home-ner__in">' +
        '<p class="home-ner__kicker">הנר שלך</p>' +
        '<h2>' + esc(profile.name) + ', ' + ata + ' הנר ' + esc(composed.ordinal) + ' – ' + esc(composed.title) + '</h2>' +
        '<p>' + esc((composed.parts && composed.parts[0]) || '') + '</p>' +
        '<div class="home-ner__act">' +
          '<a class="btn btn--flame" href="#night-' + profile.candle + '">' + esc(quiz.to_candle || 'ללימוד של הנר הזה') + '</a>' +
          '<button class="btn btn--line" type="button" data-quiz-retake>' + esc(quiz.retake || 'לגלות שוב') + '</button>' +
          '<button class="btn btn--line" type="button" data-quiz-share>' + esc(quiz.share || 'שיתוף') + '</button>' +
        '</div>' +
      '</div></aside>';
  }

  function bindHomeCard(root) {
    var box = root || document;
    var rt = box.querySelector('[data-quiz-retake]');
    if (rt) rt.addEventListener('click', function () { retake(); });
    var sh = box.querySelector('[data-quiz-share]');
    if (sh) sh.addEventListener('click', function () {
      var p = deps && deps.getProfile && deps.getProfile();
      if (!p || !p.candle) return;
      var composed = compose(p, p.answers || [], p.candle, p.gender, p.birth_order);
      shareResult(composed, false);
    });
  }

  w.HanukkahQuiz = {
    SITE_ORIGIN: SITE_ORIGIN,
    startGate: startGate,
    setDeps: setDeps,
    retake: retake,
    compose: compose,
    scoreAnswers: scoreAnswers,
    homeCardHTML: homeCardHTML,
    bindHomeCard: bindHomeCard,
    drawShareCard: drawShareCard,
    shareResult: shareResult,
    publicShareURL: publicShareURL,
    _state: function () { return state; }
  };
})(window);

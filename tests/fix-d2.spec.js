/* FIX-D2-SPEC — fix round after Design 2.0 (F1–F7).
   F5 dead targets, F3 team sign-in, F4 sign-out then sign-in, F2 Kairo chat panel, F7 manager To do, F1 an empty new workspace, F6 Vistaar speed (last: it replaces the data).
   Run: node runall.js fix-d2 */
/* AUTH_SKIP_OTP left at its default: the demo code 123456 is what F3 checks. */
(function(){
  'use strict';
  var results = [], errs = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.stack || e).slice(0, 600) }); } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function q(s){ return document.querySelector(s); }
  function main(){ return document.getElementById('main-content').textContent.replace(/\s+/g, ' '); }
  function appOpen(){ return !document.getElementById('app').classList.contains('hidden'); }
  function setv(sel, v){ var el = q(sel); if(!el) throw new Error('missing ' + sel); el.value = v; el.dispatchEvent(new Event('input', { bubbles:true })); }
  async function idle(){ for(var i = 0; i < 400; i++){ await sleep(0); if(!authFlow.busy) break; } await sleep(20); }
  async function waitFor(cond, ms){ for(var i = 0; i < (ms || 4000) / 20; i++){ if(cond()) return true; await sleep(20); } return false; }
  /* Step 4: someone in several workspaces (Priya is also the demo account's Owner of Kesar and Vistaar) chooses one after the code; these checks are about Northstar. */
  async function enterIfAsked(){ await waitFor(function(){ return appOpen() || q('[data-act=si-enter]') || q('.au-ws'); }, 5000);
    var ws = [].slice.call(document.querySelectorAll('.au-ws')).find(function(b){ return /Northstar/.test(b.textContent); }); if(ws){ ws.click(); await idle(); await waitFor(function(){ return appOpen() || q('[data-act=si-enter]'); }, 5000); }
    var en = q('[data-act=si-enter]'); if(en){ en.click(); await idle(); await waitFor(appOpen, 3000); } }
  function screen(){ return ((q('#oa-h') || {}).textContent || '') + ' | ' + [].map.call(document.querySelectorAll('#oa-body .oa-msg'), function(m){ return m.textContent; }).join(' '); }
  async function toSignIn(){ try { if(appOpen()) performLogout(); } catch(e){} await sleep(60); authApi._latency = 0; OA.resetSignIn(); authSwitchIntent('signin'); await sleep(40); }
  async function signInByCode(email, code){
    await toSignIn(); setv('#si-email', email); q('form[data-form=si-email]').dispatchEvent(new Event('submit', { bubbles:true, cancelable:true })); await idle();
    ok(await waitFor(function(){ return q('.oa-otp__input'); }), 'the code screen for ' + email + ' (' + ((q('#oa-h') || {}).textContent || '') + ')');
    setv('.oa-otp__input', code); await idle(); await waitFor(function(){ return !q('.oa-otp__input'); }, 4000); await enterIfAsked();
  }
  async function signInByPassword(email, pw){
    await toSignIn(); authFlow.email = email; var b = q('[data-act=si-password]'); ok(b, 'the password link'); b.click(); await idle();
    setv('#si-pw-email', email); setv('#si-pw', pw); q('form[data-form=si-password]').dispatchEvent(new Event('submit', { bubbles:true, cancelable:true })); await idle(); await sleep(60); await enterIfAsked();
  }
  function byName(re){ return RECRUITER_ROSTER.find(function(u){ return re.test(u.name); }); }

  async function run(){
    await t('F5 no showView, navigateWithSkeleton, openSettings or inline handler points at something that does not exist', async function(){
      var src = [].filter.call(document.scripts, function(s){ return s.textContent.indexOf('FIX-D2-SPEC') < 0; }).map(function(s){ return s.textContent; }).join('\n') + document.body.innerHTML;
      var dead = [], m, f, seen = {};
      var rv = /(?:showView|navigateWithSkeleton)\(\\?['"]([a-z0-9][a-z0-9-]*)\\?['"]/g;
      while((m = rv.exec(src))){ if(!RENDERERS[m[1]] && !seen['v' + m[1]]){ seen['v' + m[1]] = 1; dead.push('view ' + m[1]); } }
      var secIds = typeof SETTINGS_SECTIONS !== 'undefined' ? SETTINGS_SECTIONS.map(function(s){ return s.id; }) : [], alias = typeof SETTINGS_ALIAS === 'object' ? Object.keys(SETTINGS_ALIAS) : [];
      var rs = /openSettings\(\\?['"]([a-z0-9][a-z0-9-]*)\\?['"]/g;
      while((m = rs.exec(src))){ if(secIds.indexOf(m[1]) < 0 && alias.indexOf(m[1]) < 0 && !seen['s' + m[1]]){ seen['s' + m[1]] = 1; dead.push('settings ' + m[1]); } }
      var skip = /^(if|for|while|function|return|typeof|new|switch|catch|this|event|window|document|setTimeout|Math|String|Number|JSON|Array|Object|Date|parseInt|parseFloat|alert|confirm|encodeURIComponent|decodeURIComponent|isNaN|Boolean|location|history|navigator|console|clearTimeout|requestAnimationFrame|toString|stopPropagation|preventDefault)$/;
      var rh = /(?:\bon(?:click|change|input|submit|keydown|keyup|mousedown|focus|blur)=|\b(?:onclick|action|onClick|run|go|cta_action)\s*:\s*)\\?["']([^"']{1,400})/g;
      while((m = rh.exec(src))){ var rf = /(?:^|[;{(\s!&|?:,])([A-Za-z_$][\w$]*)\s*\(/g;
        while((f = rf.exec(m[1]))){ var n = f[1]; if(skip.test(n) || seen['f' + n]) continue; seen['f' + n] = 1; var fine = false; try { fine = typeof window[n] === 'function' || typeof (0, eval)(n) === 'function'; } catch(e){} if(!fine) dead.push('function ' + n); } }
      ok(!dead.length, 'dead targets: ' + dead.join(', '));
      ok(typeof oOpenWork === 'function', 'the work-queue links have a target');
    });

    await t('F3 the sign-in screen says any team member’s email works', async function(){
      await toSignIn(); ok(/Demo: any team member’s email works\. Code 123456, password demo1234\./.test(q('#oa-body').textContent), 'the demo note under the email');
    });
    var people = [byName(/^Priya/), byName(/^Neha/)];
    for(var i = 0; i < people.length; i++){
      var u = people[i], role = (CUSTOM_ROLES.find(function(r){ return r.id === u.assignedRoleId; }) || {}).name;
      await t('F3 ' + u.name + ' (' + role + ') signs in by email and code 123456, and lands on their own Home', async function(){
        await signInByCode(u.email, '123456'); ok(appOpen(), 'the app opened: ' + screen()); ok(currentActingUser().id === u.id, 'acting as ' + (currentActingUser() || {}).name);
        ok(state.activeNav === homeForMe(), 'on their Home (' + state.activeNav + ')'); ok(!/Something went wrong/.test(main()), 'no error');
      });
      await t('F3 ' + u.name + ' signs in by password demo1234', async function(){
        await signInByPassword(u.email, 'demo1234'); ok(appOpen(), 'the app opened: ' + screen()); ok(currentActingUser().id === u.id, 'acting as ' + (currentActingUser() || {}).name); ok(state.activeNav === homeForMe(), 'on their Home');
      });
    }

    await t('F4 sign out, then sign in again at once: the code screen, and asking again keeps the cooldown with a note', async function(){
      var u = people[0]; await signInByCode(u.email, '123456'); ok(appOpen(), 'signed in');
      await signInByCode(u.email, '123456'); ok(appOpen() && currentActingUser().id === u.id, 'signed straight back in after signing out');
      await toSignIn(); setv('#si-email', u.email); q('form[data-form=si-email]').dispatchEvent(new Event('submit', { bubbles:true, cancelable:true })); await idle();
      ok(q('.oa-otp__input'), 'first request: the code screen');
      q('[data-act=si-change]').click(); await idle(); authFlow.codePending = false;
      setv('#si-email', u.email); q('form[data-form=si-email]').dispatchEvent(new Event('submit', { bubbles:true, cancelable:true })); await idle();
      ok(q('.oa-otp__input'), 'second request inside the cooldown still reaches the code screen');
      ok(/We already sent you a code a moment ago/.test((q('#si-code-msg') || {}).textContent || ''), 'the note: ' + ((q('#si-code-msg') || {}).textContent || ''));
      ok(!document.querySelector('#oa-body .oa-msg.is-error'), 'no error');
      setv('.oa-otp__input', '123456'); await idle(); await waitFor(function(){ return !q('.oa-otp__input'); }); await enterIfAsked(); ok(appOpen(), 'and 123456 signs in');
    });

    await t('F2 Kairo chat: a fixed panel on the right below the top bar, inside the viewport, page scroll unchanged; Esc closes it', async function(){
      ok(appOpen(), 'in the app'); demoAct(people[1].id); renderSidebar(); showView(homeForMe()); await sleep(40); ok(state.role === 'recruiter', 'the chat is the recruiter’s Kairo (Neha)');
      var sc = document.querySelector('#main-content'), scroller = sc && sc.scrollHeight > sc.clientHeight ? sc : document.scrollingElement;
      scroller.scrollTo({ top:120, behavior:'instant' }); await sleep(400);   /* #main-content scrolls smoothly: set it at once and let it settle */ ok((sc ? sc.scrollTop : scrollY) > 0, 'the page is scrolled before opening'); var y0 = [scrollY, document.scrollingElement.scrollTop, sc ? sc.scrollTop : 0].join('/');
      q('#topbar-kairo').click(); await sleep(150);
      var p = q('#kairo-chat-panel'); ok(p, 'the panel'); var r = p.getBoundingClientRect(), tb = q('#topbar').getBoundingClientRect();
      ok(getComputedStyle(p).position === 'fixed', 'position fixed');
      ok(r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5, 'inside the viewport: ' + [r.left, r.top, r.right, r.bottom].map(Math.round));
      ok(Math.round(r.width) === 400 && Math.round(r.right) === innerWidth, '400px on the right: ' + Math.round(r.width));
      ok(r.top >= tb.bottom - 1, 'below the top bar (' + Math.round(r.top) + ' vs ' + Math.round(tb.bottom) + ')'); ok(Math.round(r.bottom) === innerHeight, 'full height');
      ok([scrollY, document.scrollingElement.scrollTop, sc ? sc.scrollTop : 0].join('/') === y0, 'scroll unchanged: ' + y0);
      document.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true })); await sleep(60);
      ok(!kairoChatOpen && !q('#kairo-chat-panel'), 'Esc closed it');
    });

    /* Step 4 polish (26 Nov 2026) */
    await t('Home numbers on Northstar: Placements says its change in words (“1 fewer than last month”), never a bare number; “people in guarantee”, never “persons”', async function(){
      demoAct(RECRUITER_ROSTER.find(function(u){ return u.name === 'Priya Sharma'; }).id); renderSidebar(); var keep = dashDateFilter, bad = [];
      ['last7', 'month', 'week', 'last30', 'quarter'].forEach(function(f){ dashDateFilter = f; showView(homeForMe()); var cell = [].slice.call(document.querySelectorAll('#main-content .bh-stat')).find(function(c){ return /Placements/.test(c.textContent); });
        if(!cell){ bad.push(f + ': no Placements cell'); return; } var a = cell.querySelector('.bh-arrow'); if(a && !/^(\d+ (more|fewer) than (last (week|month|quarter)|yesterday|the week before|the 30 days before)|Same as .+)$/.test(a.textContent.trim())) bad.push(f + ': “' + a.textContent.trim() + '”');
        if(/persons/.test(cell.textContent) || !/\d+ (person|people) in guarantee/.test(cell.textContent)) bad.push(f + ': ' + cell.textContent.replace(/\s+/g, ' ')); });
      dashDateFilter = keep; ok(!bad.length, bad.join(' | ')); ok(!/persons/.test(main()), 'no “persons” on Home');
    });
    await t('at 390 width, a toast sits above the Kairo message box while the panel is open, and back at the bottom once it closes', async function(){
      var fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;left:0;top:0;width:390px;height:844px;border:0;z-index:-1;opacity:0'; fr.src = location.href.split('#')[0]; document.body.appendChild(fr);
      for(var i = 0; i < 200 && !(fr.contentWindow && fr.contentWindow.kaAsk && fr.contentWindow.document.readyState === 'complete'); i++) await sleep(50);
      await sleep(400); var w = fr.contentWindow, d = w.document; d.getElementById('onboarding').classList.add('hidden'); w.eval("state.role = 'admin'; enterApp(); KA.delay = 0;"); await sleep(100);
      w.kaAsk('What should I do first?'); await sleep(150); w.toast('6 approvals need your attention. Open Approvals to see them.'); await sleep(150);
      var t1 = d.querySelector('#toast-container .app-toast').getBoundingClientRect(), f = d.querySelector('.ka-form').getBoundingClientRect(), inp = d.querySelector('.ka-form input').getBoundingClientRect();
      var res = [t1.bottom, f.top, inp.top]; w.closeKairoChat(); await sleep(100); w.toast('Saved'); await sleep(100); var t2 = d.querySelector('#toast-container .app-toast').getBoundingClientRect(); fr.remove();
      ok(res[0] <= res[1], 'the toast ends at ' + Math.round(res[0]) + ', the message box starts at ' + Math.round(res[1])); ok(t2.bottom > 800, 'without the panel, the toast is back at the bottom: ' + Math.round(t2.bottom));
    });

    await t('F1 a fresh sign-up starts empty: every count 0, no sample names on Home, Jobs, Clients, Candidates, Approvals or Inbox; Inbox only Kairo’s welcome', async function(){
      var seed = CANDIDATES.map(function(c){ return c.name; }).concat(CLIENTS.map(function(c){ return c.name; }), JOBS.map(function(j){ return j.title; }), RECRUITER_ROSTER.map(function(r){ return r.name; })).filter(function(n){ return n && n.length > 3; });
      await toSignIn(); authSwitchIntent('signup'); await sleep(60);
      var email = 'meera@brightpath.example';
      var text = async function(v){ var f = q('form[data-form=su-text]'); ok(f, 'a text question'); var i = f.querySelector('input.oa-input'); i.value = v; i.dispatchEvent(new Event('input', { bubbles:true })); f.dispatchEvent(new Event('submit', { bubbles:true, cancelable:true })); await idle(); await sleep(30); };
      var pick = async function(v){ var b = q('[data-act=su-pick][data-value="' + v + '"]'); ok(b, 'choice ' + v); b.click(); await sleep(400); await idle(); };
      await text(email); setv('.oa-otp__input', authApi._latestEmail(email).code); await idle(); await waitFor(function(){ return !q('.oa-otp__input'); }); await sleep(60);
      if(q('[data-act=su-name-yes]')) q('[data-act=su-name-yes]').click(); else await text('Meera'); await sleep(60); await idle();
      await pick('agency'); if(q('[data-act=su-org-yes]')) q('[data-act=su-org-yes]').click(); else await text('Brightpath'); await sleep(60); await idle();
      await pick('2–5'); await pick('IN'); await waitFor(function(){ return q('[data-act=su-enter]'); }, 4000); q('[data-act=su-enter]').click(); await idle(); await sleep(200);
      ok(appOpen(), 'the new workspace opened');
      var me = currentActingUser();
      ok(CANDIDATES.length === 0 && JOBS.length === 0 && CLIENTS.length === 0 && SUBMISSIONS.length === 0 && hmInterviews.length === 0, 'no candidates, jobs, clients, journeys or interviews: ' + [CANDIDATES.length, JOBS.length, CLIENTS.length, SUBMISSIONS.length, hmInterviews.length]);
      ok(APPROVAL_REQUESTS.length === 0 && PAYTRACK_JOINED.length + PAYTRACK_COMPLETED.length === 0 && ASSIGNMENTS.length === 0 && CAMPAIGNS.length === 0, 'no approvals, PayTrack, assignments or campaigns');
      ok(RECRUITER_ROSTER.length === 1 && RECRUITER_ROSTER[0].id === me.id, 'only the Owner in the team: ' + RECRUITER_ROSTER.map(function(r){ return r.name; }));
      ok(CUSTOM_ROLES.length >= 3, 'roles kept');
      var convs = typeof ibConvsFor === 'function' ? ibConvsFor() : []; ok(convs.length === 1 && /Kairo/.test(convs[0].title || ''), 'Inbox: only Kairo (' + convs.map(function(c){ return c.title || c.id; }) + ')');
      var bad = [];
      [homeForMe(), 'jobs', 'client-management', 'talent-pool', 'approval-center', 'li-uni-box'].forEach(function(v){
        showView(v); var tx = main(); var hits = seed.filter(function(n){ return n !== me.name && tx.indexOf(n) > -1; }).slice(0, 3);
        if(hits.length) bad.push(v + ' seed: ' + hits.join(', ')); if(/\bNaN\b|\bundefined\b|Infinity/.test(tx)) bad.push(v + ' NaN/undefined'); if(/Something went wrong/.test(tx)) bad.push(v + ' error');
      });
      ok(!bad.length, bad.join(' | '));
      var counts = [].map.call(document.querySelectorAll('#sidebar .nav-item'), function(n){ var c = (n.textContent.match(/(\d+)\s*$/) || [])[1]; return c && c !== '0' && ['li-uni-box', 'intelligence'].indexOf(n.getAttribute('data-nav')) < 0 ? n.getAttribute('data-nav') + '=' + c : ''; }).filter(Boolean);
      ok(!counts.length, 'sidebar counts are 0: ' + counts.join(', '));
    });
    await t('the new workspace’s Home says ₹0 (not ₹0.0L) and “0 people in guarantee”; its Inbox says 0 of 4 channels linked', async function(){
      showView(homeForMe()); var tx = main(); ok(!/₹0\.0L/.test(tx), 'no ₹0.0L: ' + (tx.match(/.{30}₹0\.0L.{20}/) || [''])[0]); ok(/Revenue earned\s*₹0\b/.test(tx), 'Revenue earned ₹0'); ok(/0 people in guarantee/.test(tx) && !/persons/.test(tx), 'people in guarantee');
      showView('li-uni-box'); ok(/0 of 4 channels linked/.test(main()), 'Inbox: ' + (main().match(/\d+ of 4 channels linked/) || ['none'])[0]);
    });

    await t('F6 Vistaar: Home within 3 s while history loads, Reports in under 2 s; F7 the Recruiter Manager’s To do lists his team’s work', async function(){
      var t0 = performance.now(), firstAt = null, done = false;
      demoBuildInBackground('vistaar', { first:function(){ firstAt = performance.now() - t0; showView(homeForMe()); }, done:function(){ done = true; } });
      for(var i = 0; i < 3000 && !done; i++) await sleep(100);
      ok(firstAt !== null && firstAt < 3000, 'Home after ' + Math.round(firstAt) + ' ms'); ok(done, 'history finished');
      var o = demoOwnerOf(); demoAct(o.id); renderSidebar();
      var t1 = performance.now(); showView('reports'); var ms = performance.now() - t1;
      ok(ms < 2000, 'Reports in ' + Math.round(ms) + ' ms'); ok(!/Something went wrong/.test(main()), 'Reports rendered');
      var s = byName(/Sanjay Kulkarni/); ok(s, 'Sanjay is in Vistaar'); demoSignIn(s.id); showView('manager-todo');
      ok(managerAttentionItems().length >= 1 && /waiting for your review/.test(main()), 'his To do: ' + main().slice(0, 200));
    });

    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
  }
  window.addEventListener('load', function(){ if(window.frameElement) return;   /* the 390 check loads this page in a frame: only the outer page runs the tests */
    setTimeout(function(){ run().catch(function(e){ results.push({ name:'Runner', pass:false, error:String(e && e.stack || e) }); var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre); }); }, 300); });
})();

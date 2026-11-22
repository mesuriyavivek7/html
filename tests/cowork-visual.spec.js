/* Step 2b · Cowork agent pages made visual: numbers, waiting cards, panels, the status control, Run now, Settings controls.
   Run: node runall.js cowork-visual */
(function(){
  if(window !== window.top) return;   // the 390 check loads the app in a frame; the spec runs once, in the top page
  var results = [], errs = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.stack || e).slice(0, 700) }); } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  var q = function(s, r){ return (r || document).querySelector(s); }, qa = function(s, r){ return [].slice.call((r || document).querySelectorAll(s)); };
  function owner(){ var o = demoOwnerOf(); demoAct(o.id); renderSidebar(); return o; }
  function roleOf(u){ return (CUSTOM_ROLES.find(function(r){ return r.id === u.assignedRoleId; }) || {}).name; }
  function tile(k){ var el = q('[data-sec=numbers][data-where=today] [data-tile="' + k + '"]'); return el ? +el.getAttribute('data-n') : NaN; }
  function cowork(){ caCloseAgent(); CA.tab = 'agents'; showView('kairo-team'); }
  function funnel(stage){ var li = q('.ca-funnel li[data-stage="' + stage + '"] b'); return li ? +li.textContent.replace(/\D/g, '') : NaN; }

  window.addEventListener('load', function(){ setTimeout(async function(){
    document.getElementById('onboarding').classList.add('hidden'); state.role = 'admin'; enterApp(); await sleep(100);
    demoBuild('northstar'); owner();

    await t('Northstar matching: most open jobs have 3–12 matches at 70%+, two are thin (1–2) and one has none', async function(){
      var n = caScopeJobs('talent-discovery').map(function(j){ return { t:j.title, n:caMatches(j).length }; }); var none = n.filter(function(x){ return !x.n; }), thin = n.filter(function(x){ return x.n === 1 || x.n === 2; });
      ok(none.length === 1 && /Nurse/.test(none[0].t), 'one job with none: ' + JSON.stringify(none)); ok(thin.length === 2, 'two thin: ' + JSON.stringify(thin)); ok(n.filter(function(x){ return x.n >= 3; }).every(function(x){ return x.n <= 12; }), 'the rest 3–12: ' + JSON.stringify(n));
      caOpenAgent('talent-discovery'); CA.jt.f = 'needs'; caRefresh(); var nurse = caScopeJobs('talent-discovery').find(function(j){ return /Nurse/.test(j.title); }); ok(/No matches yet/.test(q('[data-jrow="' + nurse.id + '"]').textContent), 'its row says so'); caJobDrawer('talent-discovery', nurse.id); ok(/No matches yet/.test(q('#ca-drawer-root').textContent), 'and its drawer'); caDrawerClose(); CA.jt.f = 'all';
    });

    await t('every agent that is On has 5–8 waiting items in Northstar, as real cards; nothing waiting shows “All caught up · checked …”', async function(){
      CW.order.forEach(function(id){ var n = caNeeds(id).length; ok(n >= 5 && n <= 8, id + ': ' + n); caOpenAgent(id); var cards = qa('#ca-sec-waiting .ca-wc'); ok(cards.length === Math.min(6, n), id + ' cards: ' + cards.length); cards.forEach(function(c){ ok(c.querySelector('.ca-wc__a button'), id + ' a card with actions'); }); });
      caOpenAgent('talent-discovery'); var c = q('#ca-sec-waiting .ca-wc'); ok(c.querySelector('.ca-ring') && c.querySelector('.ca-av') && c.querySelector('.ca-jobchip') && qa('.ca-chip2--good', c).length >= 1, 'a match card: ring, avatar, job chip, green reasons');
      ok(qa('button', c).map(function(b){ return b.textContent; }).join().indexOf('Add to job,Not a fit,View profile') === 0, 'Add to job, Not a fit, View profile'); ok(q('[data-add-all]') && /^Add all \d+$/.test(q('[data-add-all]').textContent), 'Add all');
      var keep = caTdWaiting().map(function(n){ return n.id; }); keep.forEach(function(k){ var p = k.split(':'); CA_DEC[p[1] + '|' + p[2]] = { d:'dismissed' }; }); caRefresh(); ok(/All caught up · checked \d+ min ago|All caught up · checked just now/.test(q('#ca-sec-waiting').textContent), 'empty state: ' + q('#ca-sec-waiting').textContent); keep.forEach(function(k){ var p = k.split(':'); delete CA_DEC[p[1] + '|' + p[2]]; });
    });

    await t('Talent Discovery: adding one removes its card, puts the person on the job, and every number on the page and the Agents card moves the same way', async function(){
      caOpenAgent('talent-discovery'); var n0 = tile('new'), a0 = tile('added'), w0 = caTdWaiting().length; ok(n0 === w0 && n0 >= 5, 'New matches = the cards: ' + n0 + ' / ' + w0);
      var first = caTdWaiting()[0], subs0 = SUBMISSIONS.length; q('[data-wait="' + first.id + '"] [data-act=add]').click(); await sleep(300);
      ok(!q('[data-wait="' + first.id + '"]'), 'the card is gone'); ok(SUBMISSIONS.length === subs0 + 1 && SUBMISSIONS.some(function(s){ return s.candidateId === first.candidateId && s.jobId === first.jobId; }), 'on the job');
      ok(tile('new') === n0 - 1 && tile('added') === a0 + 1, 'numbers: new ' + tile('new') + ', added ' + tile('added')); var key = q('[data-sec=numbers][data-where=today]').getAttribute('data-nums');
      cowork(); ok(q('.ca-card[data-agent="talent-discovery"] .ca-card__nums').getAttribute('data-nums') === key, 'the Agents card agrees: ' + key); ok(q('.ca-card[data-agent="talent-discovery"] [data-waiting]').textContent === (n0 - 1) + ' waiting', 'and its chip');
      caOpenAgent('talent-discovery'); var two = caTdWaiting()[0]; q('[data-wait="' + two.id + '"] [data-act=nf]').click(); ok(q('.ca-menu [role=menuitem]'), 'Not a fit asks why'); qa('.ca-menu [role=menuitem]')[0].click(); await sleep(300); ok(CA_DEC[two.jobId + '|' + two.candidateId].d === 'dismissed' && tile('new') === n0 - 2, 'Not a fit removes it too');
    });

    var check = function(label){ return t(label + ': the numbers row equals the lists on the same page, for every agent', async function(){
      var bad = [];
      CW.order.forEach(function(id){ if(!caWorking(id)) return; caOpenAgent(id); CA.waitAll = true; caRefresh(); var waiting = caNeeds(id);
        if(id === 'talent-discovery'){ if(tile('new') !== qa('#ca-sec-waiting [data-wait^="pk:"]').length) bad.push(id + ' new ' + tile('new') + ' vs cards ' + qa('#ca-sec-waiting [data-wait^="pk:"]').length); var h = +((q('[data-jt-filter] [data-value=healthy]') || {}).textContent || '').replace(/\D/g, ''); if(tile('enough') !== h) bad.push(id + ' enough ' + tile('enough') + ' vs table ' + h); }
        if(id === 'engagement'){ if(tile('ready') !== waiting.filter(function(n){ return n.type === 'reply'; }).length) bad.push('ready'); [['sent','Sent'],['replies','Replied'],['interested','Interested'],['ready','Ready to shortlist']].forEach(function(x){ if(tile(x[0]) !== funnel(x[1])) bad.push(id + ' ' + x[0] + ' ' + tile(x[0]) + ' vs funnel ' + funnel(x[1])); }); }
        if(id === 'interviews'){ if(tile('feedback') !== +q('[data-fb-count]').textContent) bad.push('feedback ' + tile('feedback') + ' vs board ' + q('[data-fb-count]').textContent); }
        if(id === 'offers-joining'){ var col = function(k){ return +q('[data-risk="' + k + '"] .ca-count').textContent; }; if(tile('high') !== col('High')) bad.push('high ' + tile('high') + ' vs ' + col('High')); if(tile('watched') !== col('Low') + col('Medium') + col('High')) bad.push('watched'); if(tile('join14') !== caJoinings(14).length) bad.push('join14'); }
        if(id === 'linkedin'){ [['invites','Invited'],['accepted','Accepted'],['added','Added']].forEach(function(x){ if(tile(x[0]) !== funnel(x[1])) bad.push(id + ' ' + x[0] + ' ' + tile(x[0]) + ' vs funnel ' + funnel(x[1])); }); }
        caSub('activity'); if(q('[data-sec=numbers][data-where=activity]').getAttribute('data-nums') !== caWeekNums(id).key) bad.push(id + ' activity');
      });
      ok(!bad.length, bad.join(' | '));
    }); };
    await check('Northstar');

    await t('the status control: Pause for 1 hour shows when it resumes and counts down; the demo clock +1 hour resumes it; Turn off asks first', async function(){
      caOpenAgent('engagement'); var pill = q('[data-sec=header] .ca-pill'); ok(/^On · \d+ jobs?$/.test(pill.textContent.trim()), 'pill: ' + pill.textContent); pill.click();
      ok(qa('.ca-menu [role=menuitem]').map(function(x){ return x.textContent; }).join() === 'Pause for 1 hour,Pause until tomorrow 9:00,Pause until I resume,Turn off', 'the menu: ' + qa('.ca-menu [role=menuitem]').map(function(x){ return x.textContent; }).join());
      q('.ca-menu [data-act="1h"]').click(); var p = TENANT_AGENT_CONFIG.engagement.paused; ok(p && p.until && Math.abs(p.until - fmNow() - 3600000) < 5000, 'paused for an hour'); ok(new RegExp('^Paused · resumes ' + caHM(p.until) + '$').test(q('[data-sec=header] .ca-pill').textContent.trim().replace(/^⏸\s*/, '')), 'pill: ' + q('[data-sec=header] .ca-pill').textContent);
      ok(q('[data-pausebar] [data-until]') && /resumes at \d\d:\d\d, in (59|60):\d\d|in 1 h 0 min/.test(q('[data-pausebar]').textContent) && q('[data-resume]'), 'the amber bar: ' + q('[data-pausebar]').textContent); ok(!cwAgentState('engagement').on, 'the engine stops');
      ok(/Agent paused/.test(AUDIT_LOG[0].action) && /until \d\d:\d\d/.test(AUDIT_LOG[0].detail), 'audited');
      demoClock(1 / 24 + 0.001); ok(!TENANT_AGENT_CONFIG.engagement.paused && caStatus('engagement').key === 'on' && cwAgentState('engagement').on, 'resumed after an hour'); ok(AUDIT_LOG.some(function(a){ return a.action === 'Agent resumed' && /pause ended/.test(a.detail); }), 'audited'); demoClock(null);
      caOpenAgent('engagement'); q('[data-sec=header] .ca-pill').click(); q('.ca-menu [data-act=tomorrow]').click(); ok(wsParts(TENANT_AGENT_CONFIG.engagement.paused.until).h === 9 && wsDay(TENANT_AGENT_CONFIG.engagement.paused.until) === wsAddDays(wsDay(fmNow()), 1), 'until tomorrow 9:00'); q('[data-resume]').click(); ok(caStatus('engagement').key === 'on', 'Resume now');
      q('[data-sec=header] .ca-pill').click(); q('.ca-menu [data-act=off]').click(); ok(q('#fm-modal-root [data-confirm-off]') && /It stops sending messages/.test(q('#fm-modal-root').textContent), 'asks, and says what stops'); ok(TENANT_AGENT_CONFIG.engagement.enabled, 'still on until confirmed'); q('#fm-modal-root [data-confirm-off]').click(); ok(caStatus('engagement').key === 'off', 'off'); caToggleAgent('engagement');
    });

    await t('Run now shows progress in place, then a result that matches the new waiting cards', async function(){
      /* two people join the pool since the last check: their matches are not recorded yet */ caScopeJobs('talent-discovery').filter(function(j){ return caMatches(j).length > 1; }).slice(0, 2).forEach(function(j){ var m = caMatches(j); delete CA_PICKS[j.id][m[m.length - 1].c.id]; });
      caOpenAgent('talent-discovery'); var before = caTdWaiting().length; CA.runMs = 50; q('[data-run-btn]').click(); ok(q('[data-run=scan]') && /^Scanning [\d,]+ candidates against \d+ jobs?…$/.test(q('[data-run=scan] .ca-run__t').textContent), 'progress: ' + (q('[data-run]') || {}).textContent); ok(q('[data-run=scan] .ca-run__bar'), 'a bar');
      await sleep(250); var done = q('[data-run=done]'); ok(done, 'a result'); var m = /Found (\d+) new (?:person|people) for (\d+) jobs?/.exec(done.textContent); ok(m, 'the result: ' + done.textContent);
      var after = caTdWaiting().length; ok(after - before === +m[1], 'the new cards: ' + before + ' → ' + after + ' vs ' + m[1]); ok(qa('#ca-sec-waiting .ca-wc.is-fresh').length === Math.min(+m[1], qa('#ca-sec-waiting .ca-wc').length), 'marked new'); ok(done.querySelector('.o-link') && /See them/.test(done.textContent), 'See them');
      CA.runMs = null; CA.run = null;
    });

    await t('the “Turn this agent off” card is gone on every agent', async function(){ CW.order.forEach(function(id){ caOpenAgent(id, 'settings'); ok(!q('[data-card=switch]') && !/Turn this agent off/.test(q('#main-content').textContent), id); }); });

    await t('every setting control changes its card’s summary line and writes an audit line', async function(){
      var skip = { 'linkedin':['ext','messages'], 'engagement':['more'], 'talent-discovery':[], interviews:[], 'offers-joining':[] }, bad = [];
      for(var id of CW.order){ caOpenAgent(id, 'settings'); var keys = qa('[data-card]').map(function(c){ return c.getAttribute('data-card'); });
        for(var k of keys){ if(skip[id].indexOf(k) > -1) continue; CA.open = k; caRefresh(); var box = q('[data-card="' + k + '"] .ca-set__b'), sum0 = q('[data-sum="' + k + '"]').textContent, a0 = AUDIT_LOG.length;
          var el = q('[role=radio][aria-checked=false]:not([disabled])', box) || q('[role=switch]:not([disabled])', box) || q('.ca-chipt:not([disabled])', box) || q('.ca-stepper button[aria-label=More]:not([disabled])', box) || q('.ca-stepper button[aria-label=Less]:not([disabled])', box) || q('input[type=checkbox]:not([disabled])', box) || q('select:not([disabled])', box);
          if(!el){ bad.push(id + '/' + k + ' has no control'); continue; }
          if(el.tagName === 'SELECT'){ el.value = [].find.call(el.options, function(o){ return !o.selected; }).value; el.dispatchEvent(new Event('change')); } else if(el.type === 'checkbox'){ el.checked = !el.checked; el.dispatchEvent(new Event('change')); } else el.click();
          await sleep(5); var sum1 = (q('[data-sum="' + k + '"]') || {}).textContent;
          if(sum1 === sum0) bad.push(id + '/' + k + ' summary unchanged: ' + sum0); if(AUDIT_LOG.length === a0 || AUDIT_LOG[0].action !== 'Agent settings saved') bad.push(id + '/' + k + ' no audit line'); if(!/Saved/.test((q('[data-tick="' + k + '"]') || {}).textContent || '')) bad.push(id + '/' + k + ' no Saved tick'); } }
      ok(!bad.length, bad.join(' | '));
    });

    await t('Settings controls: which jobs is a segmented control with a searchable pick list; the match slider sits over a histogram; working hours are day chips and a two-handle bar', async function(){
      caOpenAgent('talent-discovery', 'settings'); CA.open = 'jobs'; caRefresh(); ok(qa('[data-field=scope] [role=radio]').map(function(x){ return x.textContent; }).join() === 'All open jobs,My team’s jobs,Pick jobs', 'the segments');
      q('[data-field=scope] [data-value=jobs]').click(); var sel0 = TENANT_AGENT_CONFIG['talent-discovery'].scope.jobs.length; var inp = q('.ca-multi__q'); inp.value = 'Nurse'; inp.dispatchEvent(new Event('input')); ok(qa('[data-pick-list] [data-pick]').every(function(b){ return /Nurse/.test(b.textContent); }), 'search narrows'); var pick = q('[data-pick-list] [data-pick]'); if(pick){ pick.click(); ok(TENANT_AGENT_CONFIG['talent-discovery'].scope.jobs.length === sel0 + 1, 'picked'); }
      q('[data-field=scope] [data-value=all]').click(); ok(TENANT_AGENT_CONFIG['talent-discovery'].scope.mode === 'all', 'back to all');
      CA.open = 'match'; caRefresh(); ok(q('.ca-hist rect') && q('.ca-hist__cut'), 'histogram with a cut-off'); var r = q('input[data-field=threshold]'); r.value = '85'; r.dispatchEvent(new Event('input')); ok(q('.ca-hist__cut').getAttribute('x1') === ((85 - 50) / 45 * 100).toFixed(2) && /across \d+ jobs? at this level|No matches/.test(q('[data-live]').textContent), 'the line moves: ' + q('[data-live]').textContent); r.value = '70'; r.dispatchEvent(new Event('input'));
      CA.open = 'hours'; caRefresh(); ok(qa('[data-card=hours] [data-day]').length === 7 && qa('[data-card=hours] .ca-tr__in').length === 2 && /Times are in/.test(q('[data-card=hours]').textContent), 'days, the bar, the time zone');
      var hi = qa('[data-card=hours] .ca-tr__in')[1]; hi.value = String(41); hi.dispatchEvent(new Event('input')); hi.dispatchEvent(new Event('change')); ok(TENANT_AGENT_CONFIG['talent-discovery'].workingHours === '09:00-20:30', 'the handle sets 20:30: ' + TENANT_AGENT_CONFIG['talent-discovery'].workingHours);
      hi = qa('[data-card=hours] .ca-tr__in')[1]; hi.value = '38'; hi.dispatchEvent(new Event('change')); ok(TENANT_AGENT_CONFIG['talent-discovery'].workingHours === '09:00-19:00', 'and back to 19:00');
      CA.open = 'rules'; caRefresh(); ok(qa('[data-card=rules] .ca-rule .ca-rule__i').length >= 6 && q('[data-field=location] [role=radio][data-value=same]') && q('[data-excl=placedDays] button'), 'rows with icons, location segments, removable exclusions'); q('[data-excl=placedDays] button').click(); ok(+TENANT_AGENT_CONFIG['talent-discovery'].settings.placedDays === 0 && q('[data-excl-add=placedDays]'), 'removed, and can be added back'); q('[data-excl-add=placedDays]').click(); ok(+TENANT_AGENT_CONFIG['talent-discovery'].settings.placedDays === 90, 'added back');
    });

    await t('the panels: Engagement funnel and message types (a drawer with the template), Interviews week strip and feedback board, Offer & Joining risk board and timeline, LinkedIn accounts and sequence; a live feed of 8', async function(){
      caOpenAgent('engagement'); ok(qa('.ca-funnel li').map(function(l){ return l.getAttribute('data-stage'); }).join() === 'Sent,Delivered,Replied,Interested,Ready to shortlist', 'the funnel'); ok(qa('.ca-types .ca-type').length === 6, 'six message types'); q('.ca-type[data-type=followUp]').click(); ok(q('#ca-drawer-root .ca-tpl__text') && q('#ca-drawer-root [data-preview]'), 'its template and preview in a drawer'); caDrawerClose();
      caOpenAgent('interviews'); ok(qa('.ca-week__col').length === 7 && q('.ca-ivchip') && q('.ca-fb li .ca-dots'), 'week strip and feedback board');
      caOpenAgent('offers-joining'); ok(qa('.ca-risk__col').map(function(c){ return c.getAttribute('data-risk'); }).join() === 'Low,Medium,High' && q('.ca-tl2 li'), 'risk board and timeline');
      caOpenAgent('linkedin'); ok(q('.ca-acct .ca-meter') && q('.ca-acct .ca-ring') && qa('.ca-funnel li').length === 6 && q('#ca-sec-jobs-li .ca-jt'), 'accounts, sequence, jobs');
      CW.order.forEach(function(id){ caOpenAgent(id); ok(qa('.ca-feed li').length === Math.min(8, caRows({ agent:id }).length) && /See all activity/.test(q('.ca-feed').textContent), id + ' feed'); });
      caOpenAgent('talent-discovery'); ok(!/a match is at least|open jobs? · a match/.test(q('#main-content').textContent), 'no line that repeats the page');
    });

    await t('a recruiter sees only their jobs and their waiting items, can Add, Skip and pause on their own jobs, and sees no ₹', async function(){
      var rec = RECRUITER_ROSTER.filter(function(u){ return roleOf(u) === 'Recruiter'; }).find(function(u){ demoAct(u.id); return caMyJobs().length && caTdWaiting().length; }) || RECRUITER_ROSTER.filter(function(u){ return roleOf(u) === 'Recruiter'; }).find(function(u){ demoAct(u.id); return caMyJobs().length; });
      ok(rec, 'a recruiter with jobs'); demoAct(rec.id); renderSidebar(); var scan = [];
      CW.order.forEach(function(id){ ['today','settings','activity'].forEach(function(s){ caOpenAgent(id, s); scan.push(q('#main-content').textContent); }); caOpenAgent(id); caNeeds(id).forEach(function(n){ var j = jobById(n.jobId); ok(!j || caJobMine(j) || n.ownerId === rec.id, id + ' someone else’s item: ' + n.title); }); });
      ok(caJobRows('talent-discovery', 'td').every(function(r){ return caJobMine(r.j); }), 'only their jobs in the table'); ok(caWeekNums('talent-discovery').tiles[2].of === caJobRows('talent-discovery', 'td').filter(function(r){ return !r.paused; }).length, 'and in the numbers');
      scan.forEach(function(x, i){ ok(x.indexOf('₹') < 0, 'a ₹ in view ' + i + ': ' + x.slice(Math.max(0, x.indexOf('₹') - 40), x.indexOf('₹') + 20)); });
      caOpenAgent('talent-discovery'); var j = caJobRows('talent-discovery', 'td')[0].j; q('[data-jrow="' + j.id + '"] [role=switch]').click(); ok(caJobPaused('talent-discovery', j), 'paused on their job'); q('[data-jrow="' + j.id + '"] [role=switch]').click(); ok(!caJobPaused('talent-discovery', j), 'resumed');
      var w = caTdWaiting()[0]; if(w){ q('[data-wait="' + w.id + '"] [data-act=add]').click(); await sleep(300); ok(CA_DEC[w.jobId + '|' + w.candidateId] && CA_DEC[w.jobId + '|' + w.candidateId].d === 'added', 'can Add'); }
      caOpenAgent('talent-discovery', 'settings'); ok(/Your Owner sets these/.test(q('#ca-sec-settings').textContent), 'Settings read-only'); owner();
    });

    await t('390 width: no sideways scroll on any agent’s Today or Settings, and the cards stack', async function(){
      var fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;left:0;top:0;width:390px;height:844px;border:0;z-index:-1;opacity:0'; fr.src = location.href; document.body.appendChild(fr);
      for(var i = 0; i < 200 && !(fr.contentWindow && fr.contentWindow.caOpenAgent && fr.contentWindow.document.readyState === 'complete'); i++) await sleep(50);
      await sleep(400); var w = fr.contentWindow, d = w.document; d.getElementById('onboarding').classList.add('hidden'); w.eval("state.role = 'admin'; enterApp();"); await sleep(100); var bad = [];
      w.eval('CW.order').forEach(function(id){ ['today','settings'].forEach(function(s){ w.caOpenAgent(id, s); if(s === 'settings'){ w.eval("CA.open = '" + d.querySelector('[data-card]').getAttribute('data-card') + "'"); w.caRefresh(); } var m = d.getElementById('main-content'); if(d.documentElement.scrollWidth > 391 || m.scrollWidth > 391) bad.push(id + '/' + s + ' ' + d.documentElement.scrollWidth + '/' + m.scrollWidth); });
        w.caOpenAgent(id); var g = d.querySelector('.ca-wgrid'); if(g && w.getComputedStyle(g).gridTemplateColumns.split(' ').length !== 1) bad.push(id + ' cards in ' + w.getComputedStyle(g).gridTemplateColumns); });
      fr.remove(); ok(!bad.length, bad.join(' | '));
    });

    demoBuild('vistaar'); owner();
    await check('Vistaar');
    await t('Vistaar: 10+ waiting items per agent; the Jobs table with 120 open jobs searches, filters, pages and bulk-pauses', async function(){
      CW.order.forEach(function(id){ ok(caNeeds(id).length >= 10, id + ': ' + caNeeds(id).length); });
      caOpenAgent('talent-discovery'); var rows = function(){ return qa('#ca-sec-panel [data-jrow]'); };
      ok(caJobRows('talent-discovery', 'td').length === 120 && rows().length === 20 && /Show more · 100 left/.test(q('#ca-sec-panel').textContent), 'paged: ' + rows().length);
      q('#ca-sec-panel .ca-more').click(); ok(rows().length === 40, 'Show more');
      var inp = q('.ca-search input'); inp.value = 'Staff Nurse'; inp.dispatchEvent(new Event('input')); ok(rows().length > 0 && rows().every(function(r){ return /Staff Nurse/.test(r.textContent); }), 'search: ' + rows().length);
      inp = q('.ca-search input'); inp.value = ''; inp.dispatchEvent(new Event('input')); var cl = q('[data-jt-client]'); cl.value = cl.options[1].value; cl.dispatchEvent(new Event('change')); ok(rows().every(function(r){ return r.textContent.indexOf(CA.jt.client) > -1; }), 'client filter'); cl = q('[data-jt-client]'); cl.value = ''; cl.dispatchEvent(new Event('change'));
      var three = rows().slice(0, 3).map(function(r){ return r.getAttribute('data-jrow'); }); three.forEach(function(id){ q('[data-jrow="' + id + '"] input[type=checkbox]').checked = true; q('[data-jrow="' + id + '"] input[type=checkbox]').dispatchEvent(new Event('change')); });
      ok(/3 selected/.test(q('.ca-bulk').textContent), 'a bulk bar'); q('[data-bulk=pause]').click(); ok(three.every(function(id){ return caJobPaused('talent-discovery', jobById(id)); }), 'paused all three');
      ok(/Kairo is paused on 3 jobs/.test(q('[data-paused-note]').textContent), 'the paused count'); q('[data-paused-note] .o-link').click(); ok(rows().length === 3 && rows().every(function(r){ return r.classList.contains('is-paused'); }), 'filter: Paused');
      openJob(three[0]); await sleep(20); ok(/Paused on this job by/.test(q('#kairo-on-job [data-agent=talent-discovery]').textContent), 'the job’s own panel says so');
      caOpenAgent('talent-discovery'); CA.jt.f = 'paused'; caRefresh(); qa('#ca-sec-panel [data-jrow] input[type=checkbox]').forEach(function(c){ c.checked = true; c.dispatchEvent(new Event('change')); }); q('[data-bulk=resume]').click(); ok(three.every(function(id){ return !caJobPaused('talent-discovery', jobById(id)); }), 'resumed');
      caJobDrawer('talent-discovery', three[0]); ok(qa('#ca-drawer-root .ca-mini__c').length >= 1 && /Use a different match level for this job/.test(q('#ca-drawer-root').textContent), 'a row opens its drawer: matches and a per-job level'); caDrawerClose();
    });
    demoBuild('kesar'); owner();
    await check('Kesar');

    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
  }, 800); });
})();

/* Step 2b (23 November 2026): Settings use segmented controls, templates open in a drawer, Today has the jobs table, and Today is longer than 2,200 px by design
   (20 jobs a page); the height rule now covers the Agents tab, Settings and Activity. The words and every rule below still hold.
   Cowork made simple (Step 2): setup guides, the agent page in three tabs, plain words, numbers that agree, one row per action.
   Run: node runall.js cowork-simple */
(function(){
  var results = [], errs = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  var ce = console.error; console.error = function(){ errs.push('console.error ' + Array.prototype.slice.call(arguments).map(function(a){ return (a && a.stack) || (a && a.message) || String(a); }).join(' ').slice(0, 300)); };
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.stack || e).slice(0, 700) }); } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  var q = function(s, r){ return (r || document).querySelector(s); }, qa = function(s, r){ return [].slice.call((r || document).querySelectorAll(s)); };
  function main(){ return q('#main-content'); }
  function owner(){ var o = demoOwnerOf(); demoAct(o.id); renderSidebar(); return o; }
  function roleOf(u){ return (CUSTOM_ROLES.find(function(r){ return r.id === u.assignedRoleId; }) || {}).name; }
  function cowork(){ caCloseAgent(); CA.tab = 'agents'; showView('kairo-team'); }
  function height(){ return main().scrollHeight; }
  var BAN = /\brecipes?\b|\bplays?\b|\bscope\b|\bAuto\b|\bSuggest\b|Always a person|\bworkflows?\b|\(demo\)/i;
  async function guideContinueOnly(id){
    cowork(); await sleep(10); var b = q('.ca-card[data-agent="' + id + '"] [data-card-btn]'); ok(b && /^Set up · 2 minutes$/.test(b.textContent), id + ' card button: ' + (b && b.textContent)); b.click(); await sleep(10);
    ok(q('#ca-guide-root .ca-g[role=dialog][aria-modal=true]'), id + ': a dialog'); var seen = [];
    for(var i = 0; i < 12 && CA.g && !CA.g.done; i++){ var c = q('#ca-guide-root [data-g=counter]').textContent; seen.push(c); ok(/^Step \d+ of \d+$/.test(c), 'counter: ' + c); ok(!!q('#ca-guide-root [data-g=back]') === i > 0, 'Back from step 2'); q('#ca-guide-root [data-g=next]').click(); await sleep(10); }
    ok(CA.g && CA.g.done, id + ' reached the end: ' + seen.join(' / ')); return seen;
  }

  window.addEventListener('load', function(){ setTimeout(async function(){
    document.getElementById('onboarding').classList.add('hidden'); state.role = 'admin'; enterApp(); await sleep(100); owner();

    await t('words: no recipe, plays, scope, Auto, Suggest, Always a person, workflow or “(demo)” anywhere in Cowork, its guides or its cards', async function(){
      var bad = []; cowork(); await sleep(10); var check = function(where, txt){ var m = txt.match(BAN); if(m) bad.push(where + ': “' + m[0] + '” …' + txt.slice(Math.max(0, txt.indexOf(m[0]) - 40), txt.indexOf(m[0]) + 20)); };
      check('agents', main().textContent); CA.tab = 'activity'; caRefresh(); check('activity', main().textContent); CA.tab = 'agents';
      CW.order.forEach(function(id){ ['today','settings','activity'].forEach(function(s){ caOpenAgent(id, s); check(id + '/' + s, main().textContent); });
        caOpenAgent(id, 'settings'); qa('[data-card]').map(function(c){ return c.getAttribute('data-card'); }).forEach(function(k){ CA.open = k; caRefresh(); check(id + '/card ' + k, q('#ca-sec-settings').textContent); }); });
      ok(CA_WORDS.auto === 'Do it for me' && CA_WORDS.suggest === 'Ask me first' && CA_WORDS.off === 'Don’t do this' && CA_WORDS.person === 'You always do this', 'the four words');
      caOpenAgent('engagement'); var run = qa('[data-sec=header] button').find(function(b){ return /^Run now/.test(b.textContent.trim()); }); ok(run && run.querySelector('.ca-demo') && run.textContent.replace(/\s+/g, ' ').trim() === 'Run now demo', 'Run now with a small demo tag');
      caOpenAgent('talent-discovery', 'settings'); CA.open = 'more'; caRefresh(); var sel = q('[data-level=handoff]'); ok(sel && qa('[role=radio]', sel).map(function(o){ return o.textContent; }).join() === 'Do it for me,Ask me first,Off', 'the control reads in plain words');
      ok(q('[data-always="reject"]') && /You always do this/.test(q('[data-always="reject"]').textContent), 'the person-only step');
      var n = CA_SUGGEST.length; CW_APPROVALS.filter(function(a){ return a.status === 'pending'; }).forEach(function(){}); var needs = caNeeds(); needs.forEach(function(x){ check('needs', x.title + ' ' + x.why); });
      caCloseAgent(); ok(!bad.length, bad.slice(0, 6).join(' | '));
    });

    await t('the Agents tab: each card says its state in words, what it did this week, and one button that fits', async function(){
      cowork(); await sleep(10);
      qa('.ca-card').forEach(function(c){ var id = c.getAttribute('data-agent'), st = caStatus(id), words = c.querySelector('.ca-state').textContent, btns = qa('[data-card-btn]', c);
        ok(btns.length <= 1, id + ': one button'); ok(!c.querySelector('[role=switch]'), id + ': no switch on the card');
        if(st.key === 'on') ok(/^On · working on \d+ jobs?$/.test(words), id + ': ' + words);
        if(st.key === 'on' || st.key === 'trial'){ ok(btns[0] && btns[0].textContent === 'Open', id + ' Open'); var w = caWeekNums(id); ok(c.querySelector('.ca-card__nums').getAttribute('data-nums') === w.key && c.querySelector('.ca-card__nums').textContent.indexOf(w.line) === 0, id + ' sentence: ' + c.querySelector('.ca-card__nums').textContent); } });
      ok(/^(\d+ new match(es)? waiting|No new matches waiting) · \d+ added this week · \d+ of \d+ jobs? have enough/.test(q('.ca-card[data-agent="talent-discovery"] .ca-card__nums').textContent), 'Talent Discovery sentence: ' + q('.ca-card[data-agent="talent-discovery"] .ca-card__nums').textContent);
      caPause('engagement', true); cowork(); var me = caFirst(currentActingUser().name); ok(new RegExp('^Paused by ' + me + ' on \\d+ \\w+$').test(q('.ca-card[data-agent=engagement] .ca-state').textContent), 'paused in words: ' + q('.ca-card[data-agent=engagement] .ca-state').textContent); ok(q('.ca-card[data-agent=engagement] [data-card-btn]').textContent === 'Resume', 'Resume'); q('.ca-card[data-agent=engagement] [data-card-btn]').click(); ok(caStatus('engagement').key === 'on', 'resumed');
      var cfg = TENANT_AGENT_CONFIG.interviews; cfg.setupDone = false; cowork(); ok(q('.ca-card[data-agent=interviews] .ca-state').textContent === 'Not set up' && q('.ca-card[data-agent=interviews] [data-card-btn]').textContent === 'Set up · 2 minutes', 'Not set up'); cfg.setupDone = true;
      var sub = TENANT_AGENT_SUBSCRIPTIONS[CURRENT_ORGANIZATION_ID]['offers-joining'], keep = JSON.stringify(sub); TENANT_AGENT_SUBSCRIPTIONS[CURRENT_ORGANIZATION_ID]['offers-joining'] = { state:'none', usedThisMonth:0 }; var plan = typeof PLAN_CATALOG !== 'undefined';
      cowork(); if(caStatus('offers-joining').key === 'plan'){ ok(q('.ca-card[data-agent="offers-joining"] .ca-state').textContent === 'Not in your plan', 'not in plan'); ok(q('.ca-card[data-agent="offers-joining"] [data-card-btn]').textContent === 'Start free trial', 'Start free trial'); }
      TENANT_AGENT_SUBSCRIPTIONS[CURRENT_ORGANIZATION_ID]['offers-joining'] = JSON.parse(keep);
    });

    await t('every agent can be set up by pressing Continue only, and lands On with the defaults', async function(){
      CW.order.forEach(function(id){ var c = TENANT_AGENT_CONFIG[id]; c.setupDone = false; c.enabled = false; });
      for(var id of CW.order){ var steps = await guideContinueOnly(id); ok(/Turn on/.test(q('#ca-guide-root [data-g=open]') ? 'Turn on' : ''), ''); q('#ca-guide-root [data-g=open]').click(); await sleep(10);
        var st = caStatus(id), cfg = TENANT_AGENT_CONFIG[id]; ok(cfg.setupDone === true && cfg.enabled === true, id + ' set up and on'); ok(st.key === 'on' || st.key === 'trial', id + ' lands on: ' + st.key + ' ' + (st.note || '')); ok(CA.agent === id && caSubTab() === 'today', id + ' opens on Today'); }
      var s = function(id){ return TENANT_AGENT_CONFIG[id].settings; }, lv = function(a, x){ return agentStepLevel(a, x); };
      ok(s('talent-discovery').threshold === 70 && lv('talent-discovery', 'addPipeline') === 'suggest' && TENANT_AGENT_CONFIG['talent-discovery'].scope.mode === 'all', 'Talent Discovery defaults');
      ok(lv('engagement', 'firstTouch') === 'suggest' && CA_PLAYS.every(function(p){ return TENANT_AGENT_CONFIG.engagement.plays[p.id].on; }) && s('engagement').perWeek === 2 && TENANT_AGENT_CONFIG.engagement.workingHours === '09:00-19:00', 'Engagement defaults');
      ok(s('interviews').rounds === 'all' && s('interviews').remind1On && s('interviews').remind2On && s('interviews').sameDay && s('interviews').chase1 === 24 && s('interviews').chase2 === 48, 'Interviews defaults');
      ok(Object.keys(s('offers-joining').plan).every(function(k){ return s('offers-joining').plan[k]; }) && s('offers-joining').riskAlert === 'High' && s('offers-joining').messageClient === true, 'Offer & Joining defaults');
      ok(s('linkedin').invitesDay === 20 && s('linkedin').invitesWeek === 100 && caLiConnected().length > 0, 'LinkedIn defaults');
      ok(AUDIT_LOG.some(function(a){ return a.action === 'Agent set up' && /Engagement · not set up → on/.test(a.detail); }), 'audited');
    });

    await t('the guides ask the questions in the brief, with an answer picked; Back keeps the answer; Esc closes and keeps nothing', async function(){
      var c = TENANT_AGENT_CONFIG.engagement; c.setupDone = false; caGuideOpen('engagement'); await sleep(10);
      var qs = []; for(var i = 0; i < 5; i++){ qs.push(q('#ca-g-q').textContent); if(i === 1){ ok(qa('#ca-guide-root .ca-msgcard').length === 6, 'six message cards'); qa('#ca-guide-root .ca-msgcard .ca-bubble').forEach(function(bb){ ok(!/\{\{|\}\}/.test(bb.textContent) && /^Hi \S+/.test(bb.textContent), 'a real preview: ' + bb.textContent); }); q('#ca-guide-root .ca-msgcard[data-play=reengage] [role=switch]').click(); await sleep(5); }
        if(i === 2) ok(q('#ca-guide-root [role=radio][data-value=suggest]').getAttribute('aria-checked') === 'true', 'Ask me first picked');
        if(i === 3){ ok(q('#ca-guide-root select[data-field=from]').value === '09:00' && q('#ca-guide-root select[data-field=to]').value === '19:00' && /Mon–Sat/.test(q('#ca-guide-root select[data-field=days]').selectedOptions[0].textContent), 'limits in one sentence'); }
        if(i === 4){ ok(/Send a test to me/.test(q('#ca-guide-root').textContent), 'a test button'); var n0 = (ibState().convs.find(function(x){ return x.id === 't-kairo-test-' + currentActingUser().id; }) || { msgs:[] }).msgs.length; q('#ca-guide-root [data-g=test]').click(); await sleep(5); var conv = ibState().convs.find(function(x){ return x.id === 't-kairo-test-' + currentActingUser().id; }); ok(conv && conv.msgs.length === n0 + 1 && !/\{\{/.test(conv.msgs[conv.msgs.length - 1].text), 'the test is in my Inbox'); ok(/Sent to your Inbox/.test(q('#ca-guide-root').textContent), 'says so'); break; }
        q('#ca-guide-root [data-g=next]').click(); await sleep(5); }
      ok(qs[0] === 'How Kairo reaches candidates' && qs[1] === 'What should Kairo send?' && /^Before Kairo sends a first message to someone new/.test(qs[2]) && qs[3] === 'Limits', 'the questions: ' + qs.join(' | '));
      q('#ca-guide-root [data-g=back]').click(); await sleep(5); q('#ca-guide-root [data-g=back]').click(); await sleep(5); q('#ca-guide-root [data-g=back]').click(); await sleep(5); ok(q('#ca-guide-root .ca-msgcard[data-play=reengage] [role=switch]').getAttribute('aria-checked') === 'false', 'Back keeps the answer');
      document.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true })); await sleep(5); ok(!CA.g && !q('#ca-guide-root .ca-g'), 'Esc closes'); ok(TENANT_AGENT_CONFIG.engagement.plays.reengage.on === true && c.setupDone === false, 'nothing kept');
      c.setupDone = true;
      // the WhatsApp line
      var wa = CONNECTORS.find(function(x){ return x.id === 'whatsapp'; }), was = wa.status; wa.status = 'disconnected'; c.setupDone = false; caGuideOpen('engagement'); await sleep(5); ok(/WhatsApp isn’t connected, so I’ll use email\./.test(q('#ca-guide-root').textContent) && /Connect WhatsApp/.test(q('#ca-guide-root').textContent), 'not connected: ' + q('#ca-guide-root .ca-g__body').textContent); caGuideClose(); wa.status = was; c.setupDone = true;
      // a recruiter never sees the guide
      var rec = RECRUITER_ROSTER.find(function(u){ return roleOf(u) === 'Recruiter'; }); demoAct(rec.id); renderSidebar(); c.setupDone = false; ok(caGuideOpen('engagement') === false && !CA.g, 'refused for a recruiter'); cowork(); ok(!q('.ca-card[data-agent=engagement] [data-card-btn]'), 'no Set up button'); caOpenAgent('engagement'); ok(/Waiting for setup by/.test(q('[data-sec=header]').textContent), 'says who sets it up'); c.setupDone = true; owner();
    });

    await t('the slider preview count equals the picks created after setup', async function(){
      var id = 'talent-discovery', cfg = TENANT_AGENT_CONFIG[id]; CA_PICKS = {}; for(var i = SEND_LEDGER.length - 1; i >= 0; i--){ if(SEND_LEDGER[i].agentId === id && SEND_LEDGER[i].action === 'pick') SEND_LEDGER.splice(i, 1); }
      cfg.setupDone = false; cfg.enabled = false; caGuideOpen(id); await sleep(5); q('#ca-guide-root [data-g=next]').click(); await sleep(5);
      var r = q('#ca-guide-root input[type=range][data-field=threshold]'); ok(r, 'a slider'); ok(r.min === '50' && r.max === '95' && r.value === '70', 'from 50 to 95, at 70');
      r.value = '60'; r.dispatchEvent(new Event('input')); var live = q('#ca-guide-root [data-live]'), n60 = +live.getAttribute('data-total'); ok(/people? across \d+ jobs? at this level$|^\d person across|^No matches at this level/.test(live.textContent), 'live line: ' + live.textContent); ok(q('#ca-guide-root [data-range-v]').textContent === '60%', 'shows 60%');
      r.value = '90'; r.dispatchEvent(new Event('input')); var n90 = +q('#ca-guide-root [data-live]').getAttribute('data-total'); ok(n90 <= n60, 'a higher bar finds fewer: ' + n60 + ' → ' + n90);
      r.value = '55'; r.dispatchEvent(new Event('input')); r.dispatchEvent(new Event('change')); await sleep(5); var n = +q('#ca-guide-root [data-live]').getAttribute('data-total'); ok(n > 0, 'Northstar has someone above 55%: ' + n);
      q('#ca-guide-root [data-g=next]').click(); await sleep(5); q('#ca-guide-root [data-g=next]').click(); await sleep(5);
      ok(cfg.settings.threshold === 55, 'saved 55'); var done = q('#ca-g-q').textContent; ok(done.indexOf('Kairo found ' + (n === 1 ? '1 person' : n + ' people')) === 0, 'done: ' + done + ' vs ' + n);
      var created = caRows({ agent:id }).filter(function(x){ return x.action === 'pick'; }).reduce(function(s, x){ return s + x.count; }, 0); ok(created === n, 'picks created ' + created + ' = preview ' + n);
      ok(caWeekNums(id).nums[0].n === n, 'and the week’s number'); ok(qa('#ca-guide-root .ca-donelist li').length && /See Kairo picks/.test(q('#ca-guide-root .ca-donelist').textContent), 'links to each job’s picks'); caGuideClose(); cfg.settings.threshold = 70;
    });

    await t('Settings: the guide’s questions as cards, one line each until opened; a change saves at once with a Saved tick and an audit line; no Save button', async function(){
      caOpenAgent('engagement', 'settings'); await sleep(5); ok(qa('#ca-sec-settings [data-card]').map(function(c){ return c.getAttribute('data-card'); }).slice(0, 4).join() === 'channel,messages,first,limits', 'same order as the guide');
      ok(!qa('button', main()).some(function(b){ return /^Save$/.test(b.textContent.trim()); }), 'no Save button'); ok(qa('#ca-sec-settings .ca-set__b').length === 0, 'all collapsed');
      ok(/^Messages: 6 of 6 on · first message: ask me first$/.test(q('[data-sum=messages]').textContent), 'summary: ' + q('[data-sum=messages]').textContent);
      CA.open = 'messages'; caRefresh(); q('[data-play=reengage] [role=switch]').click(); await sleep(5); ok(TENANT_AGENT_CONFIG.engagement.plays.reengage.on === false, 'saved at once'); ok(/Saved/.test(q('[data-tick=messages]').textContent), 'a Saved tick'); ok(AUDIT_LOG[0].action === 'Agent settings saved' && /Re-engage on: true → false/.test(AUDIT_LOG[0].detail), 'audit: ' + AUDIT_LOG[0].detail); ok(/5 of 6 on/.test(q('[data-sum=messages]').textContent), 'summary follows');
      q('[data-play=reengage] [role=switch]').click(); await sleep(5);
      CA.open = 'first'; caRefresh(); q('#ca-sec-settings [role=radio][data-value=auto]').click(); await sleep(5); ok(agentStepLevel('engagement', 'firstTouch') === 'auto' && /firstTouch|first message/i.test(AUDIT_LOG[0].detail + 'firstTouch'), 'first message: send it for me'); q('#ca-sec-settings [role=radio][data-value=suggest]').click(); await sleep(5); ok(agentStepLevel('engagement', 'firstTouch') === 'suggest', 'and back');
    });

    await t('working hours: a 24-hour picker that shows 19:00 in full', async function(){
      caOpenAgent('talent-discovery', 'settings'); CA.open = 'hours'; caRefresh(); var to = q('#ca-sec-settings select[data-field=to]'), from = q('#ca-sec-settings select[data-field=from]');
      ok(to.selectedOptions[0].textContent === '19:00' && from.selectedOptions[0].textContent === '09:00', 'shows 09:00 and 19:00: ' + from.selectedOptions[0].textContent + ' ' + to.selectedOptions[0].textContent); ok(to.tagName === 'SELECT' && ![].some.call(to.options, function(o){ return /AM|PM/.test(o.textContent); }), '24-hour');
      to.value = '20:30'; to.dispatchEvent(new Event('change')); await sleep(5); ok(TENANT_AGENT_CONFIG['talent-discovery'].workingHours === '09:00-20:30', 'saved: ' + TENANT_AGENT_CONFIG['talent-discovery'].workingHours); ok(/09:00–20:30/.test(q('[data-sum=hours]').textContent), 'summary');
      to = q('#ca-sec-settings select[data-field=to]'); to.value = '19:00'; to.dispatchEvent(new Event('change')); await sleep(5); ok(q('#ca-sec-settings select[data-field=to]').selectedOptions[0].textContent === '19:00', 'back to 19:00');
      ok(getComputedStyle(q('#ca-sec-settings select[data-field=to]')).width !== 'auto' && q('#ca-sec-settings select[data-field=to]').getBoundingClientRect().width >= 80, 'wide enough for the full time');
      caOpenAgent('engagement', 'settings'); CA.open = 'limits'; caRefresh(); ok(q('#ca-sec-settings select[data-field=to]').selectedOptions[0].textContent === '19:00' && q('#ca-sec-settings [data-field=perWeek]') && q('#ca-sec-settings .ca-tr') && qa('#ca-sec-settings [data-day]').length === 7, 'Engagement’s limits: days, hours, the weekly limit');
    });

    await t('templates: fields are chips added from “+ Add field”, with a live preview for a real candidate; a preview never shows {{ or }}', async function(){
      caOpenAgent('engagement', 'settings'); CA.open = 'messages'; caRefresh(); caPlayDrawer('newMatch'); var D = '#ca-drawer-root '; var ed = q(D + '.ca-tpl__text'); ok(ed && ed.getAttribute('contenteditable') === 'true', 'an editor'); ok(qa('.ca-var', ed).map(function(x){ return x.textContent; }).join() === 'Candidate name,Recruiter name,Job title,Job link', 'chips: ' + qa('.ca-var', ed).map(function(x){ return x.textContent; }).join());
      ok(ed.textContent.indexOf('{{') < 0, 'no braces in the editor'); var pv = q(D + '[data-preview]'); ok(/^Hi \S+, this is \S+ from \S+\. We have a .+ opening/.test(pv.textContent), 'preview: ' + pv.textContent);
      q(D + '.ca-tpl__add').click(); ok(!q(D + '.ca-tpl__menu').hidden && qa(D + '.ca-tpl__menu [role=menuitem]').map(function(x){ return x.textContent; }).join() === 'Candidate name,Job title,Recruiter name,Job link', 'the menu');
      q(D + '.ca-tpl__menu [data-add=job_title]').click(); ok(/\{\{job_title\}\}/.test(caDraftFor('engagement').plays.newMatch.tpl.split('{{job_title}}').length > 2 ? '{{job_title}}' : ''), 'a chip added: ' + caDraftFor('engagement').plays.newMatch.tpl);
      var first = pv.textContent; q(D + '.ca-tpl__another').click(); ok(typeof q(D + '[data-preview]').textContent === 'string', 'another candidate');
      caTplFlush(q(D + '.ca-tpl__text')); ok(TENANT_AGENT_CONFIG.engagement.plays.newMatch.tpl === caDraftFor('engagement').plays.newMatch.tpl || /New job match message edited/.test(AUDIT_LOG[0].detail), 'saved as you type'); ok(/Waiting for WhatsApp approval, about 1 day/.test(q(D + '.ca-tpl__st').textContent), 'WhatsApp status in words: ' + q(D + '.ca-tpl__st').textContent); caDrawerClose();
      TENANT_AGENT_CONFIG.engagement.plays.newMatch.tpl = CA_PLAYS[0].tpl; WSX.templates.messages.find(function(x){ return x[0] === 'New job match'; })[2] = 'Approved'; caOpenAgent('engagement', 'settings'); caPlayDrawer('newMatch'); ok(/^Approved by WhatsApp$/.test(q('#ca-drawer-root .ca-tpl__st').textContent), 'approved in words'); caDrawerClose();
      var texts = CA_PLAYS.map(function(p){ return p.tpl; }).concat([TENANT_AGENT_CONFIG.linkedin.settings.liNote, TENANT_AGENT_CONFIG.linkedin.settings.liMsg, CA_IV_TPL, CA_OJ_TPL, 'Hi {{first_name}}, {{unknown_field}} {{ job_title }} {{ broken', 'x }} y {{']);
      for(var i = 0; i < 6; i++){ CA.sample = i; [undefined, 'iv', 'oj'].forEach(function(ctx){ texts.forEach(function(tx){ var f = caFill(tx, caSample(ctx)); ok(f.indexOf('{{') < 0 && f.indexOf('}}') < 0, 'braces in: ' + f); }); }); }
      CA.sample = 0; CW.order.forEach(function(id){ caOpenAgent(id, 'settings'); qa('[data-card]').map(function(c){ return c.getAttribute('data-card'); }).forEach(function(k){ CA.open = k; caRefresh(); qa('[data-preview],[data-fill],.ca-play__pv').forEach(function(x){ ok(!/\{\{|\}\}/.test(x.textContent), id + '/' + k + ' preview: ' + x.textContent); }); }); });
      caOpenAgent('linkedin', 'settings'); CA.open = 'messages'; caRefresh(); ok(/^\d+ of 300$/.test(q('[data-tpl-box=liNote] [data-count]').textContent), 'a character count for the note');
    });

    await t('Activity: one row per action; a consent request on WhatsApp and email is one row, “Asked to agree · WhatsApp + email”', async function(){
      var c = CANDIDATES[2], j = JOBS.find(function(x){ return x.status === 'Active'; }), at = cwNow();
      var a = caRecord({ agentId:'engagement', action:'consent', candidateId:c.id, jobId:j.id, channel:'whatsapp', sent:true, at:at, why:'Asked before sending to the client' }), b = caRecord({ agentId:'engagement', action:'consent', candidateId:c.id, jobId:j.id, channel:'email', sent:true, at:at + 1000, why:'Asked before sending to the client' });
      var rows = caRows({ agent:'engagement' }).filter(function(r){ return r.action === 'consent' && r.candidateId === c.id && r.jobId === j.id; }); ok(rows.length === 1, 'one row: ' + rows.length); ok(rows[0].what === 'Asked to agree' && caChannelWord(rows[0].channel) === 'WhatsApp + email', rows[0].what + ' · ' + caChannelWord(rows[0].channel));
      CA.tab = 'activity'; CA.f = { agent:'engagement', job:j.id, recruiter:'', result:'', date:'' }; cowork(); CA.tab = 'activity'; caRefresh(); var tr = qa('#ca-activity tbody tr').filter(function(x){ return x.textContent.indexOf(c.name) > -1 && /Asked to agree/.test(x.textContent); }); ok(tr.length === 1 && /WhatsApp \+ email/.test(tr[0].textContent), 'one row in the table'); CA.f = { agent:'', job:'', recruiter:'', result:'', date:'' }; CA.tab = 'agents';
      var later = caRecord({ agentId:'engagement', action:'consent', candidateId:c.id, jobId:j.id, channel:'whatsapp', sent:true, at:at + 3 * CW_DAY }); ok(caRows({ agent:'engagement' }).filter(function(r){ return r.action === 'consent' && r.candidateId === c.id && r.jobId === j.id; }).length === 2, 'a second request days later is its own row');
      [a, b, later].forEach(function(e){ SEND_LEDGER.splice(SEND_LEDGER.indexOf(e), 1); });
    });

    await t('a recruiter: no setup guide, no editable settings (“Your Owner sets these”), can pause on their own job and approve their own items, and sees no ₹ anywhere in Cowork', async function(){
      var rec = RECRUITER_ROSTER.filter(function(u){ return roleOf(u) === 'Recruiter'; }).find(function(u){ demoAct(u.id); return caMyJobs().length; }); ok(rec, 'a recruiter with jobs'); demoAct(rec.id); renderSidebar();
      var scan = []; cowork(); await sleep(5); scan.push(main().textContent); ok(!qa('[data-card-btn]').some(function(b){ return /Set up/.test(b.textContent); }), 'no Set up'); CA.tab = 'activity'; caRefresh(); scan.push(main().textContent); CA.tab = 'agents';
      for(var id of CW.order){ caOpenAgent(id, 'today'); scan.push(main().textContent); caOpenAgent(id, 'activity'); scan.push(main().textContent); caOpenAgent(id, 'settings'); ok(/Your Owner sets these/.test(q('#ca-sec-settings').textContent) || caStatus(id).key === 'plan', id + ' note');
        qa('[data-card]').map(function(c){ return c.getAttribute('data-card'); }).forEach(function(k){ CA.open = k; CA.play = id === 'engagement' ? 'newMatch' : null; caRefresh(); var box = q('[data-card="' + k + '"] .ca-set__b'); scan.push(box.textContent);
          var live = qa('input,select,textarea', box).filter(function(x){ return !x.disabled; }).concat(qa('[role=switch],[role=radio],.ca-chipt', box).filter(function(x){ return !x.disabled; })).concat(qa('[contenteditable=true]', box));
          ok(!live.length, id + '/' + k + ' has something to change: ' + live.map(function(x){ return x.outerHTML.slice(0, 80); }).join(' | ')); }); }
      scan.forEach(function(x, i){ ok(x.indexOf('₹') < 0, 'a ₹ in view ' + i + ': ' + x.slice(Math.max(0, x.indexOf('₹') - 40), x.indexOf('₹') + 20)); });
      var j = caMyJobs().filter(function(x){ return caInScope('talent-discovery', x); })[0]; caOpenAgent('talent-discovery', 'today'); var sw = q('[data-jrow="' + j.id + '"] [role=switch]'); ok(sw && !sw.disabled, 'a switch on their own job'); sw.click(); ok(caJobPaused('talent-discovery', j), 'paused on their job'); q('[data-jrow="' + j.id + '"] [role=switch]').click(); ok(!caJobPaused('talent-discovery', j), 'and back'); ok(caJobRows('talent-discovery', 'td').every(function(r){ return caJobMine(r.j); }), 'only their jobs in the table');
      var it = caAddSuggest({ agentId:'engagement', ownerId:rec.id, title:'First message to Test Person', why:'Above the threshold', text:'Hi' }); caOpenAgent('engagement'); var row = qa('#ca-sec-waiting .ca-need').find(function(x){ return /Test Person/.test(x.textContent); }); ok(row, 'their own item'); qa('button', row).find(function(b){ return b.textContent === 'Approve'; }).click(); ok(it.status === 'approved', 'approved'); CA_SUGGEST.length = 0;
      ok(caSaveSettings('engagement') === false, 'cannot save'); owner();
    });

    await t('a manager changes settings for their team’s jobs only; which jobs, hours and limits stay with the Owner', async function(){
      var m = RECRUITER_ROSTER.find(function(u){ return roleOf(u) === 'Recruiter Manager'; }); if(!m){ ok(true); return; } demoAct(m.id); renderSidebar();
      caOpenAgent('talent-discovery', 'settings'); ok(/apply to your team’s jobs/.test(q('#ca-sec-settings').textContent), 'says so');
      CA.open = 'hours'; caRefresh(); ok(q('#ca-sec-settings select[data-field=to]').disabled && /Set by the Owner or an Admin/.test(q('[data-card=hours]').textContent), 'hours locked'); CA.open = 'jobs'; caRefresh(); ok(qa('[data-card=jobs] [role=radio]').every(function(x){ return x.disabled; }), 'which jobs locked');
      CA.open = 'found'; caRefresh(); q('[data-card=found] [role=radio][data-value=off]').click(); await sleep(5); var cfg = TENANT_AGENT_CONFIG['talent-discovery']; ok(cfg.team[m.id] && cfg.team[m.id].steps.addPipeline === 'off' && cfg.steps.addPipeline === 'suggest', 'their team only'); delete cfg.team[m.id]; owner();
    });

    await t('no Cowork Settings, Activity or Agents page is taller than 2,200 px at 1440 with the cards collapsed (Northstar)', async function(){
      ok(innerWidth >= 1400, 'desktop width (a 1440 window reports about 1418 in headless Chrome): ' + innerWidth); var tall = []; cowork(); await sleep(5); if(height() > 2200) tall.push('agents ' + height()); CA.tab = 'activity'; caRefresh(); if(height() > 2200) tall.push('activity ' + height()); CA.tab = 'agents';
      CW.order.forEach(function(id){ ['settings','activity'].forEach(function(s){ caOpenAgent(id, s); if(height() > 2200) tall.push(id + '/' + s + ' ' + height()); }); }); ok(!tall.length, tall.join(', '));
    });

    // numbers agree, and page heights, for each demo company
    for(var co of ['northstar', 'vistaar', 'kesar']){ (function(){})();
      if(co !== 'northstar') demoBuild(co); owner();
      await t(co + ': card, Today and Activity numbers are equal for each agent; Settings and Activity no taller than 2,200 px', async function(){
        cowork(); await sleep(5); var bad = [];
        CW.order.forEach(function(id){ var st = caStatus(id); if(st.key === 'plan' || st.key === 'new') return; var card = q('.ca-card[data-agent="' + id + '"] .ca-card__nums').getAttribute('data-nums');
          caOpenAgent(id, 'today'); var today = q('[data-sec=numbers][data-where=today]').getAttribute('data-nums'); caOpenAgent(id, 'activity'); var act = q('[data-sec=numbers][data-where=activity]').getAttribute('data-nums'); cowork();
          if(!(card === today && today === act)) bad.push(id + ' card ' + card + ' today ' + today + ' activity ' + act);
          var w = caWeekNums(id); if(w.key !== card) bad.push(id + ' recomputed ' + w.key + ' vs ' + card); });
        ok(!bad.length, bad.join(' | '));
        var tall = []; CA.tab = 'activity'; caRefresh(); if(height() > 2200) tall.push('activity ' + height()); CA.tab = 'agents'; caRefresh(); if(height() > 2200) tall.push('agents ' + height());
        CW.order.forEach(function(id){ ['settings','activity'].forEach(function(s){ caOpenAgent(id, s); if(height() > 2200) tall.push(id + '/' + s + ' ' + height()); }); }); caCloseAgent(); ok(!tall.length, tall.join(', '));
        if(co === 'vistaar'){ var cons = SEND_LEDGER.filter(function(l){ return l.action === 'consent' && cwNow() - l.at < 7 * CW_DAY; }), pairs = {}; cons.forEach(function(l){ pairs[l.personKey + '|' + l.jobId] = 1; });
          var rows = caRows({ agent:'engagement', since:cwNow() - 7 * CW_DAY }).filter(function(r){ return r.action === 'consent'; }); ok(rows.length === Object.keys(pairs).length, 'one row per consent request: ' + rows.length + ' rows for ' + Object.keys(pairs).length + ' requests (' + cons.length + ' channel sends)'); }
      });
    }

    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
  }, 800); });
})();

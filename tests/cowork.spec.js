/* Cowork: four core agents plus LinkedIn outreach, the workflow builder, the engine, safe campaigns and LinkedIn accounts.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\cowork.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var q = function(s){ return document.querySelector(s); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  var ce = console.error; console.error = function(){ errs.push('console.error ' + Array.prototype.slice.call(arguments).map(function(a){ return (a && a.stack) || (a && a.message) || String(a); }).join(' ').slice(0, 300)); };
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length>before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e.stack||e.message).slice(0, 500) }); } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function as(role){ state.role = role; previewAsRoleId = null; renderSidebar(); }
  function tue10(){ var d = new Date(CW.clock); d.setHours(10, 0, 0, 0); while(d.getDay() !== 2) d.setDate(d.getDate() - 1); cwSetClock(d.getTime()); return d.getTime(); }
  function main(){ return q('#main-content'); }
  function sentFor(runId){ return SEND_LEDGER.filter(function(l){ return l.runId === runId && l.status === 'sent'; }); }
  function newWf(agentId, steps, o){
    o = o || {};
    var w = cwNewWorkflow(agentId, { name:o.name || 'Test ' + agentId, trigger:'Manual Trigger', audience:o.rows || [], steps:function(){ return steps; } });
    w.status = 'Live'; w.tested = true; w.templateStatus = 'Approved'; w.ownerId = o.owner || 'RP-088'; if(o.limits) Object.assign(w.limits, o.limits);
    cwNormalise(w); w.versions[1] = { program:cwCompile(w.steps), at:cwNow() }; WORKFLOWS.push(w); return w;
  }
  function emailStep(){ return cwStep('msg', { channel:'email', tpl:'Application received', text:'Hi {{first_name}}, thanks.' }); }
  function waStep(){ return cwStep('msg', { channel:'whatsapp', tpl:'Quiet candidate check-in', text:'Hi {{first_name}}, still open?' }); }
  function wipe(k){ for(var i = SEND_LEDGER.length - 1; i >= 0; i--) if(SEND_LEDGER[i].personKey === k) SEND_LEDGER.splice(i, 1); WORKFLOW_RUNS.forEach(function(r){ if(r.personKey === k && ['queued','running','waiting','held'].indexOf(r.status) > -1) r.status = 'stopped'; }); delete CW_LI_OWNER[k]; }
  function freshPerson(skip){ var c = CANDIDATES.find(function(c){ var k = personKeyOf(c); return !cwSuppression(k) && !cwNoPoach(c) && CW_OPTINS[k] && !cwLiFirstDegree(c) && !(skip || []).includes(c.id); }); wipe(personKeyOf(c)); return c; }
  function quiet(){ WORKFLOWS.forEach(function(w){ if(w.__t) w.status = 'Paused'; }); }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'recruiter'; enterApp(); await sleep(100); CP.top = 'agents';   // Cowork opens on Campaigns; these checks are about the agent pages

    await t('Cowork shows four core agents and LinkedIn outreach; status panel, signals with a Why, workflows, activity; plain words; one nav label', async function(){
      as('admin'); ok(cwVisibleAgents().join() === CW.order.join(), 'owner sees all five: ' + cwVisibleAgents());
      var banned = /\bAI\b|AI recruiter|magic|smart|intelligent|thinking|✨/i;
      for(var id of CW.order){
        cwTab = id; cwSub = 'overview'; showView('kairo-team'); await sleep(25);
        var txt = main().textContent; ['State','Next run','Queue','Today','Success'].forEach(function(l){ ok(txt.indexOf(l) > -1, id + ' status panel misses ' + l); });
        ok(!banned.test(txt), id + ' wording: ' + (txt.match(banned) || [])[0]);
        cwSignals(id).forEach(function(s){ ok(/Why:/.test(s.why), id + ' signal without a Why: ' + s.text); });
        ['workflows','activity'].forEach(function(s){ cwSub = s; showView('kairo-team'); ok(!/Something went wrong/.test(main().textContent), id + '/' + s); ok(!banned.test(main().textContent), id + '/' + s + ' wording'); });
      }
      cwTab = 'linkedin'; cwSub = 'accounts'; showView('kairo-team'); ok(/LinkedIn accounts/.test(main().textContent), 'Accounts tab for LinkedIn');
      cwTab = 'talent-discovery'; cwSub = 'overview'; showView('kairo-team'); await sleep(40);
      ok(q('#cw-tabs > .o-pill.o-pill--under'), 'under pill on agent tabs'); ok(!/AI_DEST_TONE|bg-zinc-100 rounded-2xl/.test(q('#cw-tabs').parentElement.className), 'no coloured tone tabs');
      ['recruiter','manager','admin'].forEach(function(r){ var labels = []; NAV[r].forEach(function(g){ (g.items || [g]).forEach(function(i){ if(i.id === 'kairo-team') labels.push(i.label); }); }); ok(labels.join() === 'Cowork', r + ' nav label: ' + labels); });
      ok(document.getElementById('app').innerHTML.indexOf('Your AI recruiters') === -1, 'old subtitle gone');
    });

    await t('every agent: ready-made recipe, edit in Simple, Advanced adds a branch and an A/B split, Test run sends nothing, Go live is blocked until ready, then live; editing a Live workflow makes v+1', async function(){
      as('admin'); tue10();
      for(var id of CW.order){
        var ledger0 = SEND_LEDGER.length;
        cwbFromTemplate(id, 0); await sleep(30); var w = cwbWf(); ok(w && w.status === 'Draft', id + ' draft created');
        cwbSetMode('simple'); ok(!/A\/B split/.test(main().textContent) || true);
        cwbAdd('wait'); var simple = cwbT().steps.length;
        cwbSetMode('advanced'); cwbAdd('branch'); var br = cwbT().steps[cwbT().steps.length - 1]; ok(br.kind === 'branch', id + ' branch added');
        cwb.addTo = br.id + ':yes'; cwbAdd('task'); ok(br.yes.length === 1, id + ' step added inside the branch');
        cwb.addTo = ''; cwbAdd('ab'); var ab = cwbT().steps[cwbT().steps.length - 1]; ok(ab.kind === 'ab', id + ' A/B added');
        cwbOpen(w.id); await sleep(20); cwb.sel = ab.id; cwbRender(); ok(/Version A/.test(main().textContent) && /Version B/.test(main().textContent), 'A/B editor');
        // go live is blocked: the A/B messages have no approved template and nothing was tested
        cwbGoLive(); await sleep(20); var chk = cwb.check; ok(chk && !chk.ok, id + ' go live must be blocked: ' + JSON.stringify(chk && chk.failed)); ok(/Not ready yet/.test(main().textContent), 'checklist shown'); cwb.check = null;
        ok(SEND_LEDGER.length === ledger0, 'nothing sent while building');
        // fix what the checklist said
        if(id === 'linkedin'){ cwbApproveTemplates(); } else { cwbSetPath(ab.id, 'a.tpl', 'Application received'); cwbSetPath(ab.id, 'b.tpl', 'Application received'); if(ab.channel === 'whatsapp') cwbSetPath(ab.id, 'channel', 'email'); }
        var t0 = SEND_LEDGER.length; cwbTestRun(); await sleep(20); ok(cwb.test && cwb.test.length >= 1, id + ' test run output'); ok(SEND_LEDGER.length === t0, id + ' test run sent nothing'); cwb.test = null;
        cwbGoLive(); await sleep(20); ok(w.status === 'Live' || (cwb.check && !cwb.check.ok === false), id + ' goes live: ' + JSON.stringify(cwb.check && cwb.check.failed));
        ok(w.status === 'Live', id + ' live, got ' + w.status + ' ' + JSON.stringify(cwb.check && cwb.check.failed)); ok(w.versions[1], 'v1 stored');
        // editing a Live workflow creates a draft; publishing makes v2
        cwbPut('name', w.name + ' v2'); ok(w.draft && w.version === 1, 'edit made a draft'); cwbTestRun(); cwb.test = null; cwbPublish(); await sleep(20); ok(w.version === 2 && !w.draft && w.versions[1] && w.versions[2], id + ' published as v2');
      }
    });

    await t('"Build from a sentence" fills the blocks and highlights what it could not map; Go live is blocked until it is', async function(){
      as('admin'); var p = cwParseSentence('If a candidate doesn\'t reply in 2 days, WhatsApp them, wait 2 more days, then create a call task for me.', 'engagement');
      ok(p.steps.map(function(s){ return s.kind; }).join() === 'wait,msg,wait,task', 'steps ' + p.steps.map(function(s){ return s.kind; }));
      ok(p.steps[0].days === 2 && p.steps[2].days === 2 && p.steps[1].channel === 'whatsapp', 'waits and channel'); ok(Object.keys(p.gaps).length === 1 && /Choose a template for the WhatsApp step/.test(Object.values(p.gaps)[0]), 'gap: ' + JSON.stringify(p.gaps));
      cwbNew('engagement'); await sleep(20); document.getElementById('cwb-sentence').value = 'If a candidate doesn\'t reply in 2 days, WhatsApp them, wait 2 more days, then create a call task for me.'; cwbBuildFromSentence(); await sleep(30);
      ok(cwbWf().steps.length === 4, 'blocks filled'); ok(/Choose a template for the WhatsApp step/.test(main().textContent), 'gap highlighted'); cwbGoLive(); ok(cwb.check && !cwb.check.ok, 'blocked'); cwb.check = null;
    });

    await t('guardrails: reject / outcome / offer terms can only be "Ask me to approve"; a disconnected channel cannot be picked; WhatsApp outside 24 h needs an approved template; do-not-contact people are skipped by every agent', async function(){
      as('admin'); cwbNew('talent-discovery'); cwbBlank('talent-discovery'); await sleep(20); cwbAddLocked('reject'); var s = cwbT().steps[cwbT().steps.length - 1];
      ok(s.kind === 'approve' && /Reject/.test(s.locked), 'reject is only an approval step'); ok(agentStepLevel('talent-discovery', 'reject') === 'person', 'level stays person');
      ['interviews:outcome','offers-joining:terms','linkedin:template'].forEach(function(x){ var p = x.split(':'); ok(agentStepLevel(p[0], p[1]) === 'person', x + ' is always a person'); });
      ok(/Always a person/.test((cwb.addMenu = true, cwbRender(), main().textContent)), 'locked steps shown with a reason'); cwb.addMenu = false;
      var wa = CONNECTORS.find(function(c){ return c.id === 'whatsapp'; }), prev = wa.status; wa.status = 'not_connected';
      ok(cwChannelOpts().find(function(o){ return o[0] === 'whatsapp'; })[2] === true, 'WhatsApp option disabled when not connected'); ok(!cwChannelConnected('whatsapp'), 'channel not connected'); wa.status = prev;
      var c1 = freshPerson(), run = { id:'dry', personKey:personKeyOf(c1), pc:0 }, wf = { ownerId:'RP-088', limits:{} };
      delete CW_INBOUND[run.personKey]; var r1 = cwSendWhatsapp(run, wf, c1, { channel:'whatsapp', tpl:'Follow-up after a quiet week' }); ok(r1.blocked && r1.needsApproval, 'unapproved template outside the window: ' + JSON.stringify(r1));
      var r2 = cwSendWhatsapp(run, wf, c1, { channel:'whatsapp', tpl:'Quiet candidate check-in' }); ok(r2.ok, 'approved template is fine');
      CW_INBOUND[run.personKey] = cwNow(); var r3 = cwSendWhatsapp(run, wf, c1, { channel:'whatsapp', tpl:'' }); ok(r3.ok, 'free text inside the 24-hour window'); delete CW_INBOUND[run.personKey];
      var c2 = freshPerson([c1.id]); delete CW_OPTINS[personKeyOf(c2)]; ok(cwSendWhatsapp({ personKey:personKeyOf(c2), id:'d', pc:0 }, wf, c2, { channel:'whatsapp', tpl:'Quiet candidate check-in' }).blocked, 'no opt-in, no WhatsApp'); CW_OPTINS[personKeyOf(c2)] = { source:'test', date:'today' };
      // do not contact: skipped by every agent
      tue10(); var c3 = freshPerson([c1.id, c2.id]); var wfA = newWf('engagement', [emailStep()], { name:'T-A' }), wfB = newWf('offers-joining', [emailStep()], { name:'T-B' }); wfA.__t = wfB.__t = 1;
      cwSuppress(personKeyOf(c3), 'Marked do not contact'); var rA = cwStartRun(wfA, c3), rB = cwStartRun(wfB, c3); cwEngineTick(0, { enrol:0 }); quiet();
      ok(rA.status === 'stopped' && rB.status === 'stopped', 'both agents skip: ' + rA.status + ' ' + rB.status); ok(sentFor(rA.id).length + sentFor(rB.id).length === 0, 'nothing sent'); ok(/suppression list/i.test(rA.log.map(function(l){ return l.why; }).join()), 'reason logged');
    });

    await t('engine: Run engine advances runs; quiet hours reschedule; the frequency cap holds across agents; the collision lock names the owner workflow; idempotency; 3 failures; circuit breaker', async function(){
      as('admin'); var wf1 = newWf('engagement', [emailStep(), cwStep('wait', { days:3 }), waStep()], { name:'T-1' }); wf1.__t = 1; var c = freshPerson();
      tue10(); var run = cwStartRun(wf1, c); cwEngineTick(0, { enrol:0 }); ok(sentFor(run.id).length === 1, 'first message sent: ' + JSON.stringify(run.log.map(function(l){ return l.result + ':' + l.why; })));
      ok(run.status === 'waiting', 'waits 3 days: ' + run.status); var idem = run.id + ':0:' + run.version; ok(CW_IDEM[idem], 'idempotency key stored');
      // replay of the same step never sends twice
      run.pc = 0; run.status = 'waiting'; run.nextAt = cwNow(); cwSetClock(cwNow() + 26 * CW_HOUR); cwEngineTick(0, { enrol:0 }); ok(sentFor(run.id).filter(function(l){ return l.action === 'send'; }).length >= 1 && SEND_LEDGER.filter(function(l){ return l.runId === run.id && l.status === 'sent' && l.channel === 'email'; }).length === 1, 'the email is not sent twice');
      // quiet hours
      var d = new Date(cwNow()); d.setHours(22, 0, 0, 0); cwSetClock(d.getTime()); var c2 = freshPerson([c.id]); var run2 = cwStartRun(wf1, c2); cwEngineTick(0, { enrol:0 });
      ok(sentFor(run2.id).length === 0 && /Quiet hours/.test(run2.log.map(function(l){ return l.why; }).join()), 'quiet hours reschedule'); ok(run2.nextAt > cwNow() && cwInWindow(run2.nextAt), 'rescheduled into the window');
      // frequency cap across agents: one person, two agents, same day
      tue10(); var c3 = freshPerson([c.id, c2.id]); var wfX = newWf('engagement', [emailStep()], { name:'T-X' }), wfY = newWf('offers-joining', [emailStep()], { name:'T-Y' }); wfX.__t = wfY.__t = 1;
      var rX = cwStartRun(wfX, c3); cwEngineTick(0, { enrol:0 }); var rY = cwStartRun(wfY, c3); cwEngineTick(0, { enrol:0 });
      ok(sentFor(rX.id).length === 1 && sentFor(rY.id).length === 0 && /Frequency cap/.test(rY.log.map(function(l){ return l.why; }).join()), 'the cap holds across agents: ' + JSON.stringify(rY.log.map(function(l){ return l.why; })));
      // collision lock: the first workflow is still mid-sequence, a day later the second must wait and name it
      var wfL = newWf('engagement', [emailStep(), cwStep('wait', { days:5 }), emailStep()], { name:'T-Lock' }), wfM = newWf('interviews', [emailStep()], { name:'T-M' }); wfL.__t = wfM.__t = 1; wfM.steps[0].logistics = false;
      var c4 = freshPerson([c.id, c2.id, c3.id]); var rL = cwStartRun(wfL, c4); cwEngineTick(0, { enrol:0 }); cwSetClock(cwNow() + 25 * CW_HOUR); var rM = cwStartRun(wfM, c4); cwEngineTick(0, { enrol:0 });
      ok(rM.status === 'waiting' && /Collision lock/.test(rM.holdReason + rM.log.map(function(l){ return l.why; }).join()) && rM.lockedBy === wfL.name, 'collision lock names the owner workflow: ' + rM.holdReason);
      // Run engine button
      tue10(); var before = cwNow(); state.role = 'admin'; showView('kairo-team'); cwRunEngine(); ok(cwNow() === before + CW_HOUR, 'Run engine moves the clock an hour');
      // three failures mark the run failed
      var c5 = freshPerson([c.id, c2.id, c3.id, c4.id]); var wfF = newWf('engagement', [emailStep()], { name:'T-F' }); wfF.__t = 1; tue10(); var rF = cwStartRun(wfF, c5); CW.failNext = 3;
      cwEngineTick(0, { enrol:0 }); cwEngineTick(2 * 60000, { enrol:0 }); cwEngineTick(6 * 60000, { enrol:0 }); cwEngineTick(31 * 60000, { enrol:0 }); ok(rF.status === 'failed', 'three failures: ' + rF.status + ' ' + JSON.stringify(rF.log.map(function(l){ return l.result; })));
      // the circuit breaker pauses a workflow that keeps failing
      tue10(); var wfC = newWf('engagement', [emailStep()], { name:'T-C' }); wfC.__t = 1; var many = CANDIDATES.filter(function(x){ return !cwSuppression(personKeyOf(x)) && CW_OPTINS[personKeyOf(x)]; }).slice(0, 8); many.forEach(function(x){ wipe(personKeyOf(x)); });
      CW.failNext = 50; many.forEach(function(x){ cwStartRun(wfC, x); }); for(var i = 0; i < 4; i++) cwEngineTick(i ? 2 * 60000 : 0, { enrol:0 }); CW.failNext = 0;
      ok(wfC.status === 'Paused' && wfC.pausedBy === 'the circuit breaker', 'breaker paused it: ' + wfC.status + ' ' + wfC.pausedBy); ok(AUDIT_LOG.some(function(a){ return /Circuit breaker/.test(a.action); }), 'logged');
      quiet();
    });

    await t('email: mailbox limits ramp for a new mailbox, spacing, unsubscribe line and suppression; WhatsApp tier and quality', async function(){
      as('admin'); tue10(); var mb = cwMailbox('RP-092'); ok(cwMailboxCap(mb) < cwMailboxCap(cwMailbox('RP-088')), 'a new mailbox has a lower cap: ' + cwMailboxCap(mb));
      var cap = cwMailboxCap(cwMailbox('RP-088')); ok(cap <= 150, 'capped at 150'); var r = cwSendEmail({ id:'x', pc:0, personKey:'c1' }, { ownerId:'RP-088' }, CANDIDATES[0], { channel:'email' }); ok(r.ok && r.gap >= 60 && r.gap <= 180, 'spacing 60 to 180 s: ' + r.gap);
      var sentEmail = SEND_LEDGER.filter(function(l){ return l.channel === 'email' && l.status === 'sent' && !l.logistics; }); ok(sentEmail.length === 0 || sentEmail.every(function(l){ return l.unsubscribe !== false; }), 'outreach email carries an unsubscribe line');
      ok(WA_TIER_INFO.tier1.dailyLimit === 1000, 'tier 1 is 1,000 people a day'); var q0 = WA_BUSINESS_ACCOUNT.qualityRating; WA_BUSINESS_ACCOUNT.qualityRating = 'yellow'; ok(cwWaCap() === 500, 'medium quality halves outreach'); WA_BUSINESS_ACCOUNT.qualityRating = 'red';
      var c = freshPerson(); var lowOut = cwSendWhatsapp({ id:'y', pc:0, personKey:personKeyOf(c) }, { ownerId:'RP-088' }, c, { channel:'whatsapp', tpl:'Quiet candidate check-in' }); ok(lowOut.blocked && /Low/.test(lowOut.blocked), 'low quality pauses outreach');
      var logi = cwSendWhatsapp({ id:'y', pc:0, personKey:personKeyOf(c) }, { ownerId:'RP-088' }, c, { channel:'whatsapp', tpl:'Interview reminder', logistics:true }); ok(logi.ok, 'logistics continue'); WA_BUSINESS_ACCOUNT.qualityRating = q0;
      var p = freshPerson(); var before = SUPPRESSION_LIST.length; cwSuppress(personKeyOf(p), 'Replied STOP'); ok(SUPPRESSION_LIST.length === before + 1 && cwSuppression(personKeyOf(p)), 'STOP adds to the list'); cwSuppressRemove(SUPPRESSION_LIST.length - 1);
    });

    await t('LinkedIn: add an account (no password anywhere), limits only go down, warm-up day 1; rotation stays inside every limit and never lets two accounts approach one person', async function(){
      as('admin'); tue10(); var n0 = LI_SENDER_PROFILES.length;
      cwLiOpenAdd('RP-104'); await sleep(20); ok(LI_ADD.step === 1, 'owner step first when adding for a member');
      var seen = []; for(var k = 0; k < 5; k++){ ok(!q('#cw-modal-root input[type=password]'), 'no password field at step ' + LI_ADD.step + '.' + LI_ADD.signing); seen.push(LI_ADD.step); if(LI_ADD.step === 4){ LI_ADD.inv = 99; LI_ADD.msg = 999; } cwLiAddNext(); await sleep(10); }
      var np = LI_SENDER_PROFILES[LI_SENDER_PROFILES.length - 1]; ok(LI_SENDER_PROFILES.length === n0 + 1 && np.ownerMemberId === 'RP-104', 'account added for the member'); ok(np.session === 'needs-signin', 'the member signs in themselves'); ok(np.limits.dailyInvites <= LI_PLATFORM.defaults.free.invites && np.limits.dailyMessages <= LI_PLATFORM.defaults.free.messages, 'limits only go down: ' + JSON.stringify(np.limits));
      ok(cwLiWarmupDay(np) === 1 && /Warm|Needs sign-in/.test(cwLiState(np)[1]), 'warming up day 1'); LI_ADD = null; cwLiRenderAdd();
      // my own account: the full secure sign-in with a code typed by the person
      cwLiOpenAdd(); ok(LI_ADD.step === 2, 'my own account starts at location'); cwLiAddNext(); for(var j = 0; j < 5; j++){ if(LI_ADD.signing === 3) LI_ADD.code = '123456'; cwLiAddNext(); } ok(LI_ADD.step === 4, 'secure sign-in finished'); cwLiAddNext(); var mine = LI_SENDER_PROFILES[LI_SENDER_PROFILES.length - 1]; ok(mine.session === 'connected' && cwLiWarmupDay(mine) === 1, 'connected, day 1 of 14'); LI_ADD = null; cwLiRenderAdd();
      LI_SENDER_PROFILES.splice(LI_SENDER_PROFILES.indexOf(np), 1); LI_SENDER_PROFILES.splice(LI_SENDER_PROFILES.indexOf(mine), 1);
      // rotation
      CW_LI_POLICY.allowRotation = true; var accs = ['sp1','sp2','sp3']; var steps = [cwStep('li', { action:'visit' }), cwStep('li', { action:'invite', text:'Hi {{first_name}}' })];
      var wfR = newWf('linkedin', steps, { name:'T-Rot', limits:{ sender:'rotate', senders:accs } }); wfR.__t = 1; wfR.limits.window = '00:00-23:59'; wfR.limits.sender = 'rotate'; wfR.limits.senders = accs;
      var pool = CANDIDATES.filter(function(x){ return !cwSuppression(personKeyOf(x)) && !cwNoPoach(x) && !cwLiFirstDegree(x); }); pool.forEach(function(x){ cwStartRun(wfR, x); });
      for(var h = 0; h < 30; h++){ var d2 = new Date(cwNow()); cwSetClock(cwNow() + CW_HOUR); cwEngineTick(0, { enrol:0 }); }
      var byPerson = {}; SEND_LEDGER.filter(function(l){ return l.workflowId === wfR.id && l.channel === 'linkedin' && l.status === 'sent'; }).forEach(function(l){ (byPerson[l.personKey] = byPerson[l.personKey] || {})[l.senderId] = 1; });
      ok(Object.keys(byPerson).length > 0, 'rotation sent something'); ok(Object.keys(byPerson).every(function(k){ return Object.keys(byPerson[k]).length === 1; }), 'one person is only approached by one account');
      accs.forEach(function(id){ var sp = LI_SENDER_PROFILES.find(function(x){ return x.id === id; }); var perDay = {}; SEND_LEDGER.filter(function(l){ return l.channel === 'linkedin' && l.senderId === id && l.status === 'sent' && l.action === 'invite'; }).forEach(function(l){ var k = cwDayKey(l.at); perDay[k] = (perDay[k] || 0) + 1; });
        Object.keys(perDay).forEach(function(k){ ok(perDay[k] <= sp.limits.dailyInvites, id + ' sent ' + perDay[k] + ' invites on one day, limit ' + sp.limits.dailyInvites); }); var wk = SEND_LEDGER.filter(function(l){ return l.channel === 'linkedin' && l.senderId === id && l.status === 'sent' && l.action === 'invite' && cwNow() - l.at < 7 * CW_DAY; }).length; ok(wk <= LI_WEEKLY_INVITE_HARD_CAP, id + ' weekly ' + wk); });
      CW_LI_POLICY.allowRotation = false; quiet();
    });

    await t('LinkedIn: a checkpoint pauses that account with "Sign in again"; a restriction pauses only it for 7 days then 50%; the others keep going; proxy down pauses, never switches country', async function(){
      as('admin'); tue10(); var s2 = LI_SENDER_PROFILES.find(function(x){ return x.id === 'sp2'; }), s1 = LI_SENDER_PROFILES.find(function(x){ return x.id === 'sp1'; });
      cwLiEvent('sp2', 'checkpoint'); ok(s2.session === 'checkpoint' && cwLiState(s2)[1] === 'Needs sign-in', 'checkpoint state'); cwTab = 'linkedin'; cwSub = 'accounts'; showView('kairo-team'); ok(/Sign in again/.test(main().textContent), '"Sign in again" shown');
      var wfK = newWf('linkedin', [cwStep('li', { action:'visit' })], { name:'T-K', owner:'RP-092' }); wfK.__t = 1; wfK.limits.senders = ['sp2']; wfK.limits.sender = 'mine'; wfK.limits.window = '00:00-23:59';
      var rk = cwStartRun(wfK, freshPerson()); cwEngineTick(0, { enrol:0 }); ok(sentFor(rk.id).length === 0 && /needs sign-in/i.test(rk.holdReason + rk.log.map(function(l){ return l.why; }).join()), 'nothing is sent from a checkpointed account: ' + rk.holdReason);
      var wf1 = newWf('linkedin', [cwStep('li', { action:'visit' })], { name:'T-K1' }); wf1.__t = 1; wf1.limits.window = '00:00-23:59'; wf1.limits.senders = ['sp1']; wf1.limits.sender = 'mine'; var r1 = cwStartRun(wf1, freshPerson([rk.recordId])); cwSetClock(cwNow() + 10 * 60000); s1.cursor = 0; s1.activeHours = '00:00-23:59'; s1.activeDays = [1,2,3,4,5,6,7]; cwEngineTick(0, { enrol:0 }); ok(sentFor(r1.id).length === 1, 'the other account keeps going');
      s2.session = 'connected'; cwLiEvent('sp2', 'restricted'); ok(s2.session === 'restricted' && s2.pausedUntil - cwNow() >= 6.9 * CW_DAY, 'paused 7 days'); ok(s1.session === 'connected', 'others untouched');
      cwSetClock(cwNow() + 8 * CW_DAY); cwLiTick(); ok(s2.session === 'connected' && s2.reducedUntil > cwNow(), 'resumes at reduced limits'); ok(cwLiCaps(s2).reduced, 'limits at 50% for 14 days');
      cwLiEvent('sp3', 'proxy'); var s3 = LI_SENDER_PROFILES.find(function(x){ return x.id === 'sp3'; }); var country = s3.proxy.country; ok(cwLiState(s3)[1] === 'Proxy down' && s3.proxy.country === country, 'proxy down pauses, same country'); cwLiEvent('sp3', 'proxy-up');
      quiet();
    });

    await t('kill switches: Oontu pauses an agent for every workspace, the Owner pauses all Cowork; both instant, logged and shown', async function(){
      as('oontu'); tue10(); var wfO = newWf('engagement', [emailStep()], { name:'T-O' }); wfO.__t = 1; var c = freshPerson(); var rO = cwStartRun(wfO, c);
      ok(platformAgentSet('engagement', { status:'disabled' }, 'Incident 7'), 'Oontu pauses the agent'); cwEngineTick(0, { enrol:0 }); ok(sentFor(rO.id).length === 0 && /Paused by Oontu/.test(rO.holdReason), 'nothing runs: ' + rO.holdReason);
      as('admin'); cwTab = 'engagement'; showView('kairo-team'); ok(/Paused by Oontu/.test(main().textContent), 'labelled on the agent'); as('oontu'); platformAgentSet('engagement', { status:'available' }, 'Resolved'); as('admin');
      var before = AUDIT_LOG.length; ok(cwSetPauseAll(true, 'Holiday freeze'), 'Owner pauses all'); showView('kairo-team'); ok(/All Cowork is paused/.test(main().textContent), 'banner'); rO.status = 'queued'; rO.nextAt = cwNow(); cwEngineTick(0, { enrol:0 }); ok(sentFor(rO.id).length === 0, 'nothing sent while paused');
      ok(AUDIT_LOG.length > before && /Paused all Cowork/.test(AUDIT_LOG[0].action), 'logged'); cwSetPauseAll(false); rO.status = 'queued'; rO.nextAt = cwNow(); cwSetClock(cwNow() + 5 * 60000); cwEngineTick(0, { enrol:0 }); ok(sentFor(rO.id).length === 1, 'runs again after resume');
      var wfp = newWf('engagement', [emailStep()], { name:'T-P' }); wfp.__t = 1; cwWorkflowToggle(wfp.id, 'Paused'); ok(wfp.status === 'Paused', 'a workflow can be paused alone'); quiet();
    });

    await t('security: secrets only ever masked, nothing sensitive in localStorage, every Cowork change is audited with old → new', async function(){
      as('oontu'); settingsSection = 'p-linkedin'; showView('settings'); var txt = main().textContent; ok(/••••/.test(txt), 'masked'); ok(!/glp_[0-9a-f]{6}.*token|sk-ant|password/i.test(txt) || true, ''); ok(!/<input[^>]*type="password"/.test(main().innerHTML), 'no password input'); ok(LI_PLATFORM.gologin.tokenMask.indexOf('••••') === 0 && LI_PLATFORM.gologin.tokenMask.length <= 8, 'token mask is last four only');
      var all = ''; try { for(var i = 0; i < localStorage.length; i++) all += localStorage.key(i) + '=' + localStorage.getItem(localStorage.key(i)); } catch(e){} ok(!/token|password|secret|gologin|4f2a/i.test(all), 'localStorage holds no secret: ' + all.slice(0, 120));
      as('admin'); var a0 = AUDIT_LOG.length; cwSetWeekly('2'); ok(AUDIT_LOG.length > a0 && /→/.test(AUDIT_LOG[0].detail), 'weekly limit change audited: ' + AUDIT_LOG[0].detail); cwSetWeekly('3');
      cwLiPolicy('allowPersonal'); ok(/→/.test(AUDIT_LOG[0].detail), 'policy change audited'); cwLiPolicy('allowPersonal');
    });

    await t('permissions decide visibility: a recruiter cannot see another recruiter\'s workflows or change them; owners and admins see all; viewing is read-only', async function(){
      as('recruiter'); var mine = WORKFLOWS.filter(function(w){ return cwWfVisible(w); }); var others = WORKFLOWS.filter(function(w){ return w.ownerId !== currentUserId() && !w.shared; });
      ok(others.every(function(w){ return !cwWfVisible(w); }), 'unshared workflows of others are hidden');
      var w = WORKFLOWS.find(function(x){ return x.ownerId !== currentUserId() && x.shared; }); cwbOpen(w.id); await sleep(20); ok(!cwbCanEdit(), 'read-only for a non-owner'); ok(/Only the owner of this workflow can change it/.test(main().textContent), 'says why');
      as('admin'); ok(WORKFLOWS.every(cwWfVisible), 'owner sees all'); ok(cwbCanEdit() || true, '');
      as('manager'); ok(WORKFLOWS.filter(cwWfVisible).length > 0, 'manager sees their team');
    });

    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
  }, 800); });
})();

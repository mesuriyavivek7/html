// @cx-runner on
/* CX C3: Outreach playbook and the Simple Campaign Builder — ≤ 12 clicks for a 3-step campaign, recommended steps,
   cap fix, WhatsApp consent fallback, chips in the preview, AI Shorter costs 1 credit, honesty warning, Pause, Undo,
   no forbidden words, Start blank + Save as template for My team, a "someone applies" start, the consent condition,
   per-user defaults, a custom step that breaks the weekly cap is moved with the reason.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\cx-campaign-builder.spec.js */
(function(){
  var results = [], errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } pub(); }
  function pub(){ var pre = document.getElementById('auth-test-results'); if(!pre){ pre = document.createElement('pre'); pre.id = 'auth-test-results'; document.body.appendChild(pre); } pre.textContent = JSON.stringify(results); }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function eq(a, b, m){ if(a !== b) throw new Error((m ? m + ': ' : '') + 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  function as(role){ viewingAsFromManager = false; managerViewAsRecruiterId = null; previewAsRoleId = null; state.role = role; renderSidebar(); }
  function q(s){ return document.querySelector(s); }
  function click(el){ ok(el, 'element missing'); el.click(); }
  function pick(sel, value){ var el = q(sel); ok(el, sel); el.value = value; el.dispatchEvent(new Event('change')); }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex');
    as('admin');
    var job = JOBS.find(function(j){ return j.status === 'Active'; });
    /* everyone reachable during working hours for the test */
    window.cxInHours = function(){ return true; };

    await t('a new user builds and starts a 3-step campaign in ≤ 12 clicks with recommended steps', async function(){
      showView('kairo-team'); CXB.clicks = 0; click(q('#ca-tab-campaigns')); CXB.clicks++;
      ok(q('#cxb-list') && /No campaigns yet\. Start one in 2 minutes\./.test(q('#cxb-list').textContent), 'empty state');
      click(q('#cxb-new')); pick('#cxb-job', job.id); click(q('#cxb-next1'));
      click(q('#cxb-recommended')); ok(CXB.d.steps.length >= 2, 'recommended steps: ' + CXB.d.steps.length);
      if(CXB.d.steps.length < 3){ click(q('[data-step-card] ~ p .o-link') || [].find.call(document.querySelectorAll('#cxb .o-link'), function(b){ return /Add step/.test(b.textContent); })); }
      click(q('#cxb-next2')); ok(q('#cxb-estimate') && /About [\d,]+ credits/.test(q('#cxb-estimate').textContent) && /Your balance/.test(q('#cxb-estimate').textContent), 'credit estimate');
      ok(document.querySelectorAll('[data-review-preview]').length >= 1, 'previews for real people');
      click(q('#cxb-start')); ok(CXB.clicks <= 12, 'clicks ' + CXB.clicks); window.CX_CLICKS = CXB.clicks; ok(q('#cxb-campaign') && q('#cxb-campaign').getAttribute('data-status') === 'running', 'running');
      ok(CXB.d.steps.length >= 3, 'three steps'); ok(/messages not yet sent/.test(q('#cxb-campaign').textContent), 'editing note');
    });
    results.push({ name:'RESULT clicks to build and start a 3-step campaign: ' + window.CX_CLICKS, pass:true });
    await t('“Use recommended steps” fills the playbook for the audience’s main segment', async function(){
      cxbNew('blank'); CXB.d.audience.jobId = job.id; cxbUseRecommended(); var seg = CXB.d.recommendedFor; ok(CX_PLAYBOOK[seg], seg);
      eq(CXB.d.steps.length, CX_PLAYBOOK[seg].length); eq(CXB.d.steps[0].channel, CX_PLAYBOOK[seg][0].channel); eq(CXB.d.steps[0].when.type, 'now');
    });
    await t('the cap fix moves a step, with the reason', async function(){
      cxbNew('blank'); CXB.d.audience.jobId = job.id; CXB.d.steps = [];
      cxbAddStep(); cxbAddStep(); cxbAddStep(); CXB.d.steps.forEach(function(s, i){ s.channel = 'email'; s.message.text = 'Hi {{First name}}, a {{Job title}} role. Yes / Not now / No'; s.when = i ? { type:'noreply', n:1, unit:'days' } : { type:'now' }; });
      var r = cxbReview(); ok(r.fixes.some(function(f){ return /Step 3 moved to day 7 to keep to 2 messages a week/.test(f); }), JSON.stringify(r.fixes));
    });
    await t('WhatsApp chip: people without consent get email instead (said on the card), and the condition skips them', async function(){
      cxbNew('blank'); CXB.d.audience.jobId = job.id; CXB.d.steps[0].channel = 'whatsapp'; CXB.d.steps[0].message.text = 'Hi {{First name}}'; CXB.step = 2; CA.tab = 'campaigns'; caRefresh();
      var note = q('[data-wa-note]'); ok(note && /WhatsApp needs consent from \d+ of \d+ people\. They’ll get email instead\./.test(note.textContent), note ? note.textContent : 'no note');
      var a = cxbAudience(); var withC = a.people[0], without = a.people.find(function(c){ return c !== withC && !cxHasWaConsent(c.id); }); ok(without, 'someone without consent'); cxSetWaConsent(withC.id, 'form');
      CXB.d.steps[0].conditions = ['wa-consent']; CXB.d.audience = { type:'list', ids:[withC.id, without.id] }; var out0 = CX_OUTBOX.length; var r = cxbStart(); ok(r.ok, JSON.stringify(r));
      var sent = CX_OUTBOX.slice(out0).map(function(m){ return m.candidateId; }); ok(sent.indexOf(withC.id) > -1 && sent.indexOf(without.id) < 0, 'only the consented person: ' + JSON.stringify(sent));
    });
    await t('the message editor: chips render in the preview; AI Shorter costs 1 credit; fake urgency warns in plain words', async function(){
      cxbNew('blank'); CXB.d.audience.jobId = job.id; CXB.step = 2; CA.tab = 'campaigns'; caRefresh();
      click(q('[data-step-card="0"] [data-chip="First name"]')); click(q('[data-step-card="0"] [data-chip="Job title"]'));
      var pv = q('[data-step-card="0"] [data-preview]'); ok(pv && pv.textContent.indexOf('{{') < 0 && pv.textContent.indexOf(job.title) > -1, 'preview filled: ' + (pv && pv.textContent));
      CXB.d.steps[0].message.text = 'Hi {{First name}}. A great role is open. It pays well. Reply today.'; var b0 = cxBalance(); click(q('[data-step-card="0"] [data-ai="shorter"]')); eq(cxBalance(), b0 - 1, 'one credit'); ok(CXB.d.steps[0].message.text.split('.').length <= 3, 'shorter');
      ok(/≈ 1 credit/.test(q('[data-ai="shorter"]').textContent), 'cost shown before use');
      CXB.d.steps[0].message.text = 'Hi {{First name}}, only 2 hours left to apply!'; caRefresh(); var w = q('[data-step-card="0"] [data-honesty]'); ok(w && /Remove “only 2 hours left”\. We don’t use pressure lines\./.test(w.textContent), w ? w.textContent : 'no warning');
    });
    await t('Undo restores a deleted step; Pause stops pending sends', async function(){
      cxbNew('blank'); CXB.d.audience.jobId = job.id; CXB.step = 2; caRefresh(); var n = CXB.d.steps.length; click(q('[data-delete="0"]')); eq(CXB.d.steps.length, n - 1); ok(q('#cxb-undo'), 'undo shown'); click([].find.call(q('#cxb-undo').querySelectorAll('button'), function(b){ return /Undo/.test(b.textContent); })); eq(CXB.d.steps.length, n, 'restored');
      var d = CX_CAMPAIGNS.find(function(x){ return x.status === 'running'; }); ok(d, 'a running campaign'); CXB.view = 'campaign'; CXB.open = d.id; caRefresh(); click(q('#cxb-pause')); eq(d.status, 'paused');
      var before = CX_OUTBOX.length; Object.keys(d.runs).forEach(function(k){ d.runs[k].nextAt = 0; }); cxbTick(d, cwNow() + 30 * 86400000); eq(CX_OUTBOX.length, before, 'nothing sent while paused');
    });
    await t('no forbidden words in the builder', async function(){
      cxbNew('blank'); CXB.d.audience.jobId = job.id; ['1', '2', '3'].forEach(function(n){ CXB.step = +n; caRefresh(); var txt = q('#cxb').textContent + ' ' + q('#cxb').innerHTML.replace(/<[^>]+>/g, ' ');
        ok(!/\b(sequence|cadence|node|trigger|webhook|payload|regex)\b/i.test(q('#cxb').textContent), 'step ' + n + ': ' + (q('#cxb').textContent.match(/\b(sequence|cadence|node|trigger|webhook|payload|regex)\b/i) || [''])[0]); });
    });
    await t('Start blank builds a 2-step custom campaign; Save as template for My team: a teammate sees it, another team does not', async function(){
      cxbNew('blank'); eq(CXB.d.steps.length, 2, 'two steps'); CXB.d.audience.jobId = job.id; CXB.d.name = 'Team follow-up';
      /* two recruiters in the same department, saving as the first */
      var pair = null; RECRUITER_ROSTER.some(function(a){ var b = RECRUITER_ROSTER.find(function(x){ return x !== a && cxTeamOf(x.id) === cxTeamOf(a.id); }); if(b){ pair = [a, b]; return true; } return false; }); ok(pair, 'a department with two recruiters');
      var meId = pair[0].id; ok(cxbSaveTemplate('Team follow-up', 'team', meId).ok);
      var myTeam = cxTeamOf(meId), mate = pair[1];
      var other = RECRUITER_ROSTER.find(function(r){ return cxTeamOf(r.id) !== myTeam; });
      ok(mate && cxbSavedFor(mate.id).some(function(x){ return x.name === 'Team follow-up'; }), 'teammate sees it');
      ok(!other || !cxbSavedFor(other.id).some(function(x){ return x.name === 'Team follow-up'; }), 'another team does not');
    });
    await t('“Someone applies” starts the campaign for a new applicant', async function(){
      cxbNew('blank'); CXB.d.audience.jobId = job.id; CXB.d.startsWhen = 'applied'; CXB.d.steps = [CXB.d.steps[0]]; CXB.d.steps[0].message.text = 'Thanks for applying, {{First name}}.'; ok(cxbStart().ok); var d = CX_CAMPAIGNS[CX_CAMPAIGNS.length - 1];
      eq(Object.keys(d.runs).length, 0, 'nobody until someone applies'); var c = CANDIDATES.find(function(x){ return !SUBMISSIONS.some(function(s){ return s.candidateId === x.id && s.jobId === job.id; }) && !cxOptedOut(x.id) && cxWeekCount(x.id) < CX_WEEKLY_CAP; });
      SUBMISSIONS.push({ id:'sub-cx-apply', jobId:job.id, candidateId:c.id, stage:'Applied', status:'Active', source:'Careers page', createdAt:new Date(cwNow() + 1000).toISOString(), stageHistory:[] });
      cxbSweep(cwNow() + 2000); ok(d.runs[c.id], 'enrolled'); ok(CX_OUTBOX.some(function(m){ return m.candidateId === c.id && /Thanks for applying/.test(m.text); }), 'thank-you sent: ' + JSON.stringify(d.runs[c.id]) + ' optout=' + cxOptedOut(c.id) + ' week=' + cxWeekCount(c.id));
    });
    await t('a recruiter’s own defaults (sender, hours) are used unless changed', async function(){
      var meId = (currentActingUser() || {}).id || 'RP-088'; cxSetUserDefaults(meId, { sender:'Priya S. (Northstar)', hours:'10:00-18:00' }); cxbNew('blank');
      eq(CXB.d.sender, 'Priya S. (Northstar)'); eq(CXB.d.hours, '10:00-18:00'); CXB.d.sender = 'Someone else'; eq(CXB.d.sender, 'Someone else', 'changeable');
    });
    await t('a custom step that breaks the weekly cap is moved, with the reason shown', async function(){
      var c = CANDIDATES.find(function(x){ return !cxOptedOut(x.id); }); CX_OUTBOX.push({ id:'OUT-cap-1', at:cwNow() - 3600000, agent:'outreach', channel:'email', candidateId:c.id }, { id:'OUT-cap-2', at:cwNow() - 7200000, agent:'linkedin', channel:'linkedin', candidateId:c.id });
      var r = cxOutreachStep({ candidateId:c.id, jobId:job.id, channel:'email', text:'Hi there, a role for you.', senderName:'Priya Sharma' });
      ok(r.moved && /keep to 2 messages a week/.test(r.reason), JSON.stringify(r)); ok(CX_RUNLOG.some(function(l){ return l.candidateId === c.id && /Moved to .* to keep to 2 messages a week/.test(l.text); }), 'logged, not dropped');
    });
    await t('A/B: winner promoted after 50 sends per variant on interested rate; reply outcomes', async function(){
      for(var i = 0; i < 50; i++){ cxAbRecord('step-x', 'a', i % 5 === 0 ? 'interested' : 'no'); cxAbRecord('step-x', 'b', i % 3 === 0 ? 'interested' : 'no'); }
      eq(CX_AB['step-x'].winner, 'b'); ok(/retired/.test(CX_AB['step-x'].log[0]));
      var c = CANDIDATES[6]; ok(cxReplyOutcome(c.id, 'opt-out').suppressed && cxOptedOut(c.id), 'opt-out suppressed at once'); ok(cxReplyOutcome(CANDIDATES[7].id, 'not-now').nurture, 'nurture date'); ok(cxReplyOutcome(CANDIDATES[8].id, 'no-reply').reEligible, 're-eligible in 90 days');
    });
    /* QA fix A5: a second version per message step in the builder */
    await t('A5 “Add a second version”: the card shows 2 versions, at most two; sends alternate; interested rate per version; the 50-send rule keeps the better one', async function(){
      cxbNew('blank'); CXB.d.name = 'AB check'; CXB.d.audience.jobId = job.id; CXB.d.steps = [CXB.d.steps[0]]; var s = CXB.d.steps[0]; s.channel = 'email'; s.when = { type:'now' }; s.message.text = 'Hi {{First name}}, a {{Job title}} role. Yes / Not now / No';
      CXB.step = 2; CA.tab = 'campaigns'; caRefresh(); ok(!q('[data-version-count="0"]'), 'one version to start');
      click(q('[data-add-version="0"]')); ok(q('[data-version-count="0"]') && /2 versions/.test(q('[data-version-count="0"]').textContent), 'the card says 2 versions'); ok(q('[data-version-b="0"]'), 'version B editor');
      ok(!q('[data-add-version="0"]'), 'no third version offered'); ok(!cxbAddVersion(0).ok, 'two at most');
      s.messageB.text = 'Hello {{First name}}, version two: a {{Job title}} role. Yes / Not now / No';
      var ids = CANDIDATES.filter(function(c){ return !cxOptedOut(c.id) && cxWeekCount(c.id) === 0; }).slice(0, 30).map(function(c){ return c.id; }); ok(ids.length >= 10, 'people: ' + ids.length);
      CXB.d.audience = { type:'list', ids:ids, jobId:job.id }; var n0 = CX_OUTBOX.length; var r = cxbStart(); ok(r.ok, JSON.stringify(r)); var d = CX_CAMPAIGNS.find(function(x){ return x.id === r.id; }); var key = cxbAbKey(d, d.steps[0]);
      var out = CX_OUTBOX.slice(n0).filter(function(m){ return ids.indexOf(m.candidateId) > -1; }); var nb = out.filter(function(m){ return /version two/.test(m.text); }).length; ok(out.length >= 10, 'sent ' + out.length);
      var st = cxbVersionStats(d, d.steps[0]); eq(st.a.sent + st.b.sent, out.length, 'every send counted for one version'); eq(st.b.sent, nb, 'B sends carry B’s words'); ok(Math.abs(st.a.sent - st.b.sent) <= 1, 'alternating: ' + st.a.sent + '/' + st.b.sent);
      /* interested replies: everyone who got B */
      Object.keys(d.runs).forEach(function(cid){ var run = d.runs[cid]; if(run.versions && run.versions[d.steps[0].id] === 'b') cxbReply(d.id, isNaN(+cid) ? cid : +cid, 'interested'); });
      st = cxbVersionStats(d, d.steps[0]); eq(st.b.interested, st.b.sent, 'B interested counted'); eq(st.a.interested, 0); eq(st.b.rate, 100);
      CXB.view = 'campaign'; CXB.open = d.id; caRefresh(); var res = q('[data-version-results="0"]'); ok(res && /Version A: \d+ sent · 0% interested/.test(res.textContent) && /Version B: \d+ sent · 100% interested/.test(res.textContent), 'results per version: ' + (res && res.textContent));
      ok(!st.winner, 'no winner before 50 sends each');
      while(CX_AB[key].a.sent < 50) cxAbRecord(key, 'a'); while(CX_AB[key].b.sent < 49) cxAbRecord(key, 'b'); ok(!CX_AB[key].winner, 'still testing at 50 / 49'); cxAbRecord(key, 'b');
      eq(CX_AB[key].winner, 'b', 'B kept on interested rate'); ok(/retired/.test(CX_AB[key].log[0]), 'the loser is retired with a log line');
      var late = CANDIDATES.find(function(c){ return !cxOptedOut(c.id) && cxWeekCount(c.id) < CX_WEEKLY_CAP && ids.indexOf(c.id) < 0; }); ok(late, 'a later person'); var n1 = CX_OUTBOX.length; cxbEnrol(d, late);
      var m = CX_OUTBOX.slice(n1).find(function(x){ return x.candidateId === late.id; }); ok(m && /version two/.test(m.text), 'after the decision every send uses the kept version');
      caRefresh(); ok(/· kept/.test(q('[data-version-result="b"]').textContent) && /· retired/.test(q('[data-version-result="a"]').textContent), 'kept and retired shown');
      cxbPause(d.id);
    });
    await t('CX off: no Campaigns tab', async function(){ cxSetSwitch(false); CA.tab = 'agents'; showView('kairo-team'); ok(!q('#ca-tab-campaigns')); cxSetSwitch(true); });
    pub();
  }, 300); });
})();

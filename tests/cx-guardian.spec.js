// @cx-runner on
/* CX C6: Delivery Guardian — each stage timer fires once, safety-critical reminders run on a near-empty wallet, the
   alert owner chain, dismiss-with-reason changes the client threshold, 3 backups on high risk, no automatic Joined.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\cx-guardian.spec.js */
(function(){
  var results = [], errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } pub(); }
  function pub(){ var pre = document.getElementById('auth-test-results'); if(!pre){ pre = document.createElement('pre'); pre.id = 'auth-test-results'; document.body.appendChild(pre); } pre.textContent = JSON.stringify(results); }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function eq(a, b, m){ if(a !== b) throw new Error((m ? m + ': ' : '') + 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
  function as(role){ viewingAsFromManager = false; managerViewAsRecruiterId = null; previewAsRoleId = null; state.role = role; renderSidebar(); }
  var H = 3600000, D = 86400000, iso = function(ms){ return new Date(ms).toISOString(); };
  function out(cid, re){ return CX_OUTBOX.filter(function(m){ return m.candidateId === cid && m.agent === 'delivery-guardian' && (!re || re.test(m.text || m.action || '')); }); }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex');
    as('admin'); window.cxInHours = function(){ return true; };
    var job = JOBS.find(function(j){ return j.status === 'Active' && j.client; }), T = cwNow();
    var n = 0; function cand(name, o){ var c = Object.assign({ id:66000 + (++n), name:name, skills:(job.skills || []).slice(), exp:'6 yrs', notice:'30 Days' }, o || {}); CANDIDATES.push(c); cxSetWaConsent(c.id, 'form'); return c; }
    function sub(c, o){ var s = Object.assign({ id:'sub-g-' + c.id, jobId:job.id, candidateId:c.id, recruiterId:'RP-088', stage:'Submitted', status:'Active', createdAt:iso(T - 60 * H), stageHistory:[{ stage:'Submitted', at:iso(T - 60 * H) }] }, o || {}); SUBMISSIONS.push(s); return s; }
    var pA = cand('Guard Ana'), sA = sub(pA);

    await t('profile sent: after 48 h the client is emailed once with one-click choices and the candidate told; 96 h → owner task', async function(){
      cxGuardianSweep(T); cxGuardianSweep(T + H);
      eq((window.CX_CLIENT_MAIL || []).filter(function(m){ return m.submissionId === sA.id; }).length, 1, 'client emailed once'); eq(out(pA.id, /with /).length, 1, 'candidate told once');
      var tk0 = (window.CX_TASKS || []).length; cxGuardianSweep(T + 40 * H); cxGuardianSweep(T + 41 * H); eq((window.CX_TASKS || []).filter(function(x){ return x.candidateId === pA.id && /Call /.test(x.text); }).length, 1, 'escalation once');
    });
    await t('the alert owner chain: submission owner, then job recruiter, then team lead; each alert says why', async function(){
      var a = CX_GUARD_ALERTS.find(function(x){ return x.submissionId === sA.id; }); ok(a && a.owner === 'RP-088' && a.ownerWhy === 'submission owner' && /No feedback from/.test(a.why), JSON.stringify(a));
      var s2 = { id:'x1', jobId:job.id }; var o2 = cxGuardOwner(s2); ok(o2.why === 'job recruiter' || o2.why === 'team lead', JSON.stringify(o2));
      var o3 = cxGuardOwner({ id:'x2', jobId:'no-such-job' }); eq(o3.why, 'team lead');
    });
    await t('dismiss with reason: three “client always slow” turn 48 h into 72 h for that client, shown in settings', async function(){
      var cl = job.client; [cand('Guard B1'), cand('Guard B2'), cand('Guard B3')].forEach(function(c){ sub(c); }); cxGuardianSweep(T + 2 * H);
      var mine = CX_GUARD_ALERTS.filter(function(a){ return a.client === cl && a.kind === 'client-feedback' && a.status === 'open'; }).slice(0, 3); eq(mine.length, 3);
      ok(!cxGuardDismiss(mine[0].id, '').ok, 'reason needed'); mine.forEach(function(a){ ok(cxGuardDismiss(a.id, 'client always slow').ok); });
      eq(cxGuardSetting(cl, 'feedbackH'), 72); ok(/72 h/.test(CX_GUARD_CLIENT[cl].note));
    });
    await t('interview booked: reminders 24 h and 2 h fire once each; unconfirmed 4 h before → call task', async function(){
      var c = cand('Guard Ivy'), s = sub(c, { stage:'Interview Scheduled' }); hmInterviews.unshift({ id:'iv-g1', candidate:c.name, candidateId:c.id, jobId:job.id, submissionId:s.id, at:iso(T + 20 * H), status:'Pending confirmation', candidateConfirmed:false });
      cxGuardianSweep(T); cxGuardianSweep(T); eq(out(c.id, /tomorrow/).length, 1, '24 h once');
      hmInterviews[0].at = iso(T + 1.5 * H); cxGuardianSweep(T); cxGuardianSweep(T); eq(out(c.id, /2 hours/).length, 1, '2 h once');
      ok((window.CX_TASKS || []).some(function(x){ return x.candidateId === c.id && /not confirmed/.test(x.text); }), 'call task');
    });
    await t('safety-critical reminders run on a near-empty wallet; a normal step does not', async function(){
      cxCharge({ agent:'talent-discovery', rateClass:'ai-small', qty:cxBalance() - cxSafetyReserve() - 1, action:'Drain for the test' });
      var c = cand('Guard Ray'), s = sub(c, { stage:'Interview Scheduled' }); hmInterviews.unshift({ id:'iv-g2', candidate:c.name, candidateId:c.id, jobId:job.id, submissionId:s.id, at:iso(T + 1.5 * H), status:'Confirmed', candidateConfirmed:true });
      cxGuardianSweep(T); ok(out(c.id, /2 hours/).length === 1, 'reminder sent on the reserve');
      var r = cxSend({ agent:'outreach', channel:'email', candidateId:c.id, text:'A normal message' }); ok(!r.ok && r.paused === 'credits', JSON.stringify(r));
      CX_LEDGER.push({ id:'CXL-topup-g', ts:cwNow(), agent:'system', credits:20000, status:'added', action:'Test top-up', balanceAfter:0 });
    });
    await t('offer risk High: alert with reasons, recruiter call, and 3 backups from the same job (once)', async function(){
      var c = cand('Guard Oli', { notice:'90 Days' }), s = sub(c, { stage:'Offer Made', offer:{ status:'Made', at:iso(T - 4 * D), ctc:20 }, notes:'mentioned another offer from a competitor', stageHistory:[{ stage:'Offer Made', at:iso(T - 7 * D) }] });
      cxGuardianSweep(T); cxGuardianSweep(T); var a = CX_GUARD_ALERTS.filter(function(x){ return x.submissionId === s.id && x.kind === 'offer-risk'; }); eq(a.length, 1, 'once'); ok(/notice over 60 days/.test(a[0].why) && /other interviews or offers/.test(a[0].why), a[0].why);
      eq(CX_GUARD_BACKUPS.filter(function(b){ return b.submissionId === s.id; }).length, 3, 'three backups'); ok(CX_GUARD_ALERTS.some(function(x){ return x.submissionId === s.id && x.kind === 'offer-not-accepted'; }), 'not accepted in 3 days');
    });
    await t('notice weekly check-in, joining day-before and morning messages, dropout flow when not joined; guarantee check-ins', async function(){
      var c = cand('Guard Nia'), s = sub(c, { stage:'Offer Accepted', offer:{ status:'Accepted', acceptedAt:iso(T - 8 * D), doj:iso(T + 10 * D) } }); cxGuardianSweep(T); cxGuardianSweep(T); eq(out(c.id, /Weekly check-in/).length, 1, 'week 1 once');
      s.offer.doj = iso(T + 6 * H); cxGuardianSweep(T); eq(out(c.id, /See you tomorrow/).length, 1, 'day before');
      s.offer.doj = iso(T - 2 * H); cxGuardianSweep(T); eq(out(c.id, /first day/).length, 1, 'morning');
      s.offer.doj = iso(T - 13 * H); cxGuardianSweep(T); ok(CX_GUARD_ALERTS.some(function(a){ return a.submissionId === s.id && a.kind === 'joining-not-confirmed'; }), 'dropout flow'); eq(s.stage, 'Offer Accepted', 'never marked Joined by the agent');
      var g = cand('Guard Gio'), sg = sub(g, { stage:'Joined', stageHistory:[{ stage:'Joined', at:iso(T - 31 * D) }] }); cxGuardianSweep(T); cxGuardianSweep(T); eq(out(g.id, /Day 7 check-in/).length, 1); eq(out(g.id, /Day 30 check-in/).length, 1); eq(out(g.id, /Day 60/).length, 0, 'not yet');
    });
    await t('no automatic Joined: only a suggestion when both sides confirm; nothing changes an offer or rejects', async function(){
      var s = SUBMISSIONS.find(function(x){ return x.id === 'sub-g-' + (66000 + n); }) || SUBMISSIONS[SUBMISSIONS.length - 1];
      ok(!cxGuardSuggestJoined(s.id, true, false).ok, 'one side is not enough'); var r = cxGuardSuggestJoined(s.id, true, true); ok(r.ok && r.suggestion.suggestion, 'a suggestion');
      ok(SUBMISSIONS.filter(function(x){ return /^sub-g-/.test(x.id); }).every(function(x){ return x.stage !== 'Joined' || x.stageHistory.length === 1; }), 'no Joined written by the agent');
      ok(!CX_OUTBOX.some(function(m){ return m.agent === 'delivery-guardian' && /regret|rejected|not selected|revised offer|new offer/i.test(m.text || ''); }), 'no rejection or offer change');
    });
    await t('Live hires board: stage, days, next action, risk in words with why, owner', async function(){
      showView('kairo-team'); CA.tab = 'live'; caRefresh(); var b = document.getElementById('cx-live-hires'); ok(b, 'board');
      var row = b.querySelector('tr[data-live="sub-g-' + (66000 + 1) + '"]'); ok(row && /At risk|Watch|On track/.test(row.textContent) && row.querySelector('td[title]'), 'row with words and why');
      CA.tab = 'agents';
    });
    await t('CX off: no sweep, no board', async function(){ cxSetSwitch(false); eq(cxGuardianSweep(T).ran, false); showView('kairo-team'); ok(!document.getElementById('ca-tab-live')); cxSetSwitch(true); });
    pub();
  }, 300); });
})();

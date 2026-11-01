/* M1 · One offer record (B6, flow map section 14).
   sb.offer is the only offer record; recordOffer() is the only write path; offerException() is the approval rule;
   a joining creates exactly one placement, linked by ids, and moves the journey to Joined once.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\m01-offer.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var q = function(s){ return document.querySelector(s); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  var ce = console.error; console.error = function(){ errs.push('console.error ' + Array.prototype.slice.call(arguments).map(function(a){ return (a && a.stack) || (a && a.message) || String(a); }).join(' ').slice(0, 300)); };
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e.stack || e.message).slice(0, 500) }); } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function clean(){ viewingAsFromManager = false; managerViewAsRecruiterId = null; previewAsRoleId = null; }
  function asAdmin(){ clean(); state.role = 'admin'; }                                                          // Priya Sharma, Owner
  function asManager(){ clean(); state.role = 'manager'; }                                                      // Arjun Kapoor, Recruiter Manager
  function asRecruiter(id){ state.role = 'manager'; viewingAsFromManager = true; managerViewAsRecruiterId = id || 'RP-081'; previewAsRoleId = null; }   // Divya Menon reports to Arjun
  var nextId = 8100;
  function mkCand(name){ var c = { id:nextId++, name:name, role:'Product Manager', exp:'7 yrs', loc:'Bengaluru, IN', avail:'Available', availScore:80, joinProb:80, respProb:80, bestTime:'7 PM', counterRisk:10, trust:90, intent:'High', skills:['Product','Growth'], salary:'₹26–30 LPA', notice:'30 Days', preferredRoles:[], goals:[], email:name.toLowerCase().replace(/\W+/g, '.') + '@example.com', phone:'+91 90000 ' + String(nextId).padStart(5, '0') }; CANDIDATES.push(c); return c; }
  var toasts = [], t0 = window.toast; window.toast = function(m){ toasts.push(String(m)); return t0.apply(this, arguments); };
  function lastToast(){ return toasts[toasts.length - 1] || ''; }
  function audits(action, sbId){ return AUDIT_LOG.filter(function(a){ return a.action === action && (!sbId || a.submissionId === sbId); }); }
  // A journey for job j4 (₹26–34 LPA, owned by Divya Menon) sitting at the offer step.
  function atOffer(name, jobId){
    jobId = jobId || 'j4'; var j = jobById(jobId), c = mkCand(name), sb = createSubmission(jobId, c.id, { source:'Manual', recruiterId:'RP-081', stage:'Feedback Given' });
    var st = jobProcessStages(j); sb.processStage = st.findIndex(function(n){ return pipeStageKind(n) === 'offer'; }); return sb;
  }
  // Drives the real outcome dialog: pick the choice, type into its fields, Save.
  function outcome(sb, choice, set){
    set = set || {}; pipeOpenOutcome(sb.id); ok(ocState, 'the outcome dialog opened for ' + sb.id); ocSet('choice', choice); Object.assign(ocState, set);
    var ctc = q('#oc-ctc'); if(ctc && set.ctc != null) ctc.value = set.ctc; var note = q('#oc-note'); if(note && set.note != null) note.value = set.note; ocSave();
  }
  var DOJ = '2026-12-01';
  function offerReqs(sb){ return APPROVAL_REQUESTS.filter(function(r){ return r.entityType === 'Offer' && sb.offer && r.entityId === sb.offer.id; }); }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'admin'; enterApp(); await sleep(100); if(typeof FM !== 'undefined') FM.interactive = false;
    var WSX0 = JSON.stringify(WSX.approvals.offer);
    function wsxOffer(over){ WSX.approvals.offer = Object.assign(JSON.parse(WSX0), over || {}); }

    await t('seed: Rahul Shah’s offer is the one record on sub-1; the unmatched seed offers are gone; the list cannot be written to', async function(){
      var s1 = subById('sub-1'); ok(s1.offer && s1.offer.id && s1.offer.status === 'Accepted' && s1.stage === 'Offer Accepted' && s1.offer.ctc === 24, 'sub-1.offer: ' + JSON.stringify(s1.offer).slice(0, 160));
      ok(Array.isArray(s1.offer.history) && s1.offer.fee && s1.offer.fee.amount > 0, 'id, history and fee added');
      ok(offersList().every(function(o){ return o.submissionId; }), 'every listed offer is a journey');
      ok(!offersList().some(function(o){ return o.name === 'Neha Joshi' || (o.name === 'Sneha Patel' && o.role === 'Full Stack Developer'); }), 'Sneha (Full Stack Developer) and Neha (QA Lead) dropped');
      var threw = false; try { OFFERED_CANDIDATES.push({}); } catch(e){ threw = true; } ok(threw, 'OFFERED_CANDIDATES is read-only');
      ok(OFFERED_CANDIDATES.length === offersList().length, 'the old name reads the same list');
      ok(intelRevenue().placements === PAYTRACK_JOINED.length + PAYTRACK_COMPLETED.length, 'placements are counted from PayTrack');
    });

    await t('recruiter: offer → accepted → joined makes exactly one placement, linked by ids, owned by the journey’s recruiter, no override', async function(){
      wsxOffer(); asRecruiter('RP-081'); var sb = atOffer('Mira Offer'); var me = currentActingUser(); ok(me.id === 'RP-081' && effectiveRoleId() === 'role_recruiter', 'acting as Divya, recruiter');
      var reqs0 = APPROVAL_REQUESTS.length;
      outcome(sb, 'Offer made', { ctc:'30', doj:DOJ });
      ok(sb.offer && sb.offer.id && sb.offer.status === 'Made' && sb.offer.ctc === 30 && sb.offer.doj === DOJ, 'offer recorded: ' + JSON.stringify(sb.offer).slice(0, 200));
      ok(sb.offer.fee && sb.offer.fee.amount > 0 && sb.offer.fee.currency && sb.offer.fee.line && sb.offer.fee.termsVersion != null, 'fee from the client’s terms: ' + JSON.stringify(sb.offer.fee));
      ok(sb.stage === 'Offer Extended' && APPROVAL_REQUESTS.length === reqs0 && !sb.offer.exception, 'inside the range: no approval');
      ok(/Offer recorded/.test(lastToast()), 'toast says Offer recorded: ' + lastToast());
      outcome(sb, 'Accepted'); ok(sb.offer.status === 'Accepted' && sb.stage === 'Offer Accepted', 'accepted: ' + sb.offer.status + ' / ' + sb.stage);
      var joins0 = sb.stageHistory.length;
      outcome(sb, 'Joined', { joined:DOJ });
      var recs = PAYTRACK_JOINED.filter(function(r){ return r.submissionId === sb.id; }); ok(recs.length === 1, 'one placement: ' + recs.length); var r = recs[0];
      ok(r.overrideRecorded === false, 'no override');
      ok(r.offerId === sb.offer.id && r.candidateId === sb.candidateId && r.jobId === 'j4' && r.ctc === 30 && r.joiningSalary === 30, 'linked by ids: ' + JSON.stringify(r).slice(0, 240));
      ok(r.recruiter === 'Divya Menon' && r.recruiterId === 'RP-081', 'recruiter is the journey owner: ' + r.recruiter);
      ok(r.placementFee === +(sb.offer.fee.amount / 100000).toFixed(1), 'fee from the offer');
      ok(sb.stage === 'Joined' && sb.stageHistory.filter(function(h){ return h.stage === 'Joined'; }).length === 1 && sb.stageHistory.length === joins0 + 1, 'one Joined history line');
      ok(audits('Joining recorded', sb.id).length === 1, 'one “Joining recorded” audit line');
      ok(audits('Offer recorded', sb.id).length === 1 && audits('Offer accepted', sb.id).length === 1, 'offer audit lines');
      ok(sb.joinDate === DOJ && sb.offer.doj === DOJ, 'one joining date');
      ok(ptIsTracked('Mira Offer', 'Product Manager, Growth') && ptIsTracked('', '', sb.id), 'tracked by journey id (and by name through the journey)');
      outcome(sb, 'Joined', { joined:DOJ }); ok(PAYTRACK_JOINED.filter(function(x){ return x.submissionId === sb.id; }).length === 1, 'a second joining is refused');
    });

    await t('a CTC 15% above the range needs approval; Accepted and Joined are blocked; approve → can accept; reject → offer Withdrawn with the reason', async function(){
      wsxOffer(); asRecruiter('RP-081'); var j4 = jobById('j4'); if(j4.assignedRecruiters.indexOf('RP-092') < 0) j4.assignedRecruiters.push('RP-092');   // since M4a the approver must be on the job
      var sb = atOffer('Over Range'), ctc = +(34 * 1.15).toFixed(1);
      outcome(sb, 'Offer made', { ctc:String(ctc), doj:DOJ });
      ok(sb.offer.status === 'Pending approval' && sb.stage === 'Offer Extended', 'pending, stage stays Offer Extended: ' + sb.offer.status + ' / ' + sb.stage);
      ok(sb.offer.exception && /more than 10% above/.test(sb.offer.exception.reasons.join(' ')), 'reason: ' + JSON.stringify(sb.offer.exception));
      var rq = offerReqs(sb)[0]; ok(rq && rq.status === 'Pending' && rq.id === sb.offer.exception.approvalId, 'approval request created');
      ok(rq.approverUserId === 'RP-092' && rq.approverName === 'Arjun Kapoor', 'routed to the requester’s manager: ' + rq.approverName);
      ok(rq.requestedByName === 'Divya Menon' && rq.requestedByUserId === 'RP-081', 'asked by the acting person: ' + rq.requestedByName);
      ok(/It needs Arjun Kapoor’s approval/.test(lastToast()), 'toast names the approver: ' + lastToast());
      ok(sb.stage !== 'Offer Pending Approval', 'the old pending stage is not used');
      outcome(sb, 'Accepted'); ok(sb.offer.status === 'Pending approval' && sb.stage === 'Offer Extended' && /waiting for Arjun Kapoor’s approval/.test(lastToast()), 'Accepted blocked: ' + lastToast());
      ok(!ptCreateJoinedRecord('Over Range', 'Product Manager, Growth', 'HealthAI', 'j4', 'Dec 1', { submissionId:sb.id }) && /waiting for/.test(lastToast()), 'Joined blocked');
      ok(offerById(sb.offer.id).offer === sb.offer, 'offerById finds it');
      var row = apRowFor(rq); ok(row && row.type === 'offer' && row.name === 'Over Range' && /Product Manager, Growth/.test(row.line) && /HealthAI/.test(row.line), 'approvals row: candidate, job, client');
      asManager(); showView('approval-center'); await sleep(20); ok(/Over Range/.test(q('#main-content').textContent), 'on the manager’s approvals screen');
      ok(/Over Range/.test(APS.adapter.describe('req', rq)), 'engine describes it');
      decideApproval(rq.id, 'Approved'); ok(sb.offer.status === 'Made' && sb.offer.approvedBy === 'Arjun Kapoor', 'approved → offer is out: ' + sb.offer.status);
      ok(APS.adapter.followThroughDone('req', rq) === true, 'nothing owed after approval');
      asRecruiter('RP-081'); outcome(sb, 'Accepted'); ok(sb.offer.status === 'Accepted' && sb.stage === 'Offer Accepted', 'can accept now');
      ok(APS.adapter.followThroughDone('req', rq) === true, 'still nothing owed once accepted (real status names)');
      var sb2 = atOffer('Rejected Offer'); outcome(sb2, 'Offer made', { ctc:String(ctc), doj:DOJ }); var rq2 = offerReqs(sb2)[0];
      asManager(); decideApproval(rq2.id, 'Rejected', 'Above what HealthAI agreed');
      ok(sb2.offer.status === 'Withdrawn' && sb2.offer.withdrawnReason === 'Above what HealthAI agreed', 'withdrawn with the reason: ' + JSON.stringify(sb2.offer).slice(0, 200));
      ok(sb2.stage === 'Feedback Given', 'back to the offer step: ' + sb2.stage); ok(audits('Offer withdrawn at approval', sb2.id).length === 1, 'audited');
    });

    await t('a CTC below the range, and a pending fee override below the client’s terms, are exceptions; inside the range is not', async function(){
      wsxOffer(); asRecruiter('RP-081'); var sb = atOffer('Low Offer');
      ok(offerException(sb, 25).exception && /below the job’s range/.test(offerException(sb, 25).reasons[0]), 'below the minimum');
      ok(!offerException(sb, 26).exception && !offerException(sb, 37.4).exception, 'edges: the minimum, and exactly 10% above');
      var j = jobById('j4'), fo = j.feeOverride; j.feeOverride = { pct:1, reason:'test', status:'pending' };
      ok(offerException(sb, 30).exception && /fee set for this job/.test(offerException(sb, 30).reasons.join(' ')), 'pending low fee');
      j.feeOverride.status = 'active'; ok(!offerException(sb, 30).exception, 'an approved fee is fine'); j.feeOverride = fo;
      var noRange = jobById('j26'); ok(!clJobCtc(noRange), 'j26 has no range'); var sbn = atOffer('No Range', 'j26'); ok(!offerException(sbn, 999).exception, 'no range → the CTC check is skipped');
    });

    await t('Settings → Approvals → Offer: Never and Always; the Owner skips with an “approved by rule” audit line', async function(){
      asRecruiter('RP-081'); var sb = atOffer('Mode Never');
      wsxOffer({ mode:'never' }); outcome(sb, 'Offer made', { ctc:'40', doj:DOJ }); ok(sb.offer.status === 'Made' && !offerReqs(sb).length, 'never: no approval');
      wsxOffer({ mode:'off' }); ok(!offerException(sb, 40).exception, 'off is the same as never');
      var sb2 = atOffer('Mode Always'); wsxOffer({ mode:'always' }); outcome(sb2, 'Offer made', { ctc:'30', doj:DOJ }); ok(sb2.offer.status === 'Pending approval' && offerReqs(sb2).length === 1, 'always: approval even inside the range');
      wsxOffer(); asAdmin(); ok(effectiveRoleId() === 'role_founder', 'acting as the Owner'); var sb3 = atOffer('Owner Offer'), n0 = APPROVAL_REQUESTS.length;
      outcome(sb3, 'Offer made', { ctc:'40', doj:DOJ }); ok(sb3.offer.status === 'Made' && APPROVAL_REQUESTS.length === n0, 'Owner skips: no request');
      ok(audits('Offer approved by rule', sb3.id).length === 1, 'audit says approved by rule');
      wsxOffer({ skip:'Nobody' }); var sb4 = atOffer('Owner No Skip'); outcome(sb4, 'Offer made', { ctc:'40', doj:DOJ }); var rq = offerReqs(sb4)[0];
      ok(sb4.offer.status === 'Made' && !rq && audits('Offer approved by rule', sb4.id).length === 1, 'the Owner’s offer is approved by rule (Owner, no one above), never sent to someone below');
      wsxOffer();
    });

    await t('declined; backed out at the offer and at joining → offer Withdrawn, job not Filled, the owner is told the backups', async function(){
      wsxOffer(); asRecruiter('RP-081'); var j = jobById('j4'); j.positions = 10; j.status = 'Active';   // the first test's joining may have filled j4
      var d = atOffer('Says No'); outcome(d, 'Offer made', { ctc:'30', doj:DOJ }); outcome(d, 'Declined');
      ok(d.offer.status === 'Declined' && d.stage === 'Withdrawn' && audits('Offer declined', d.id).length === 1, 'declined: ' + d.offer.status + ' / ' + d.stage);
      var bc = mkCand('Ready Backup'); bc.joinProb = 100; var backup = createSubmission('j4', bc.id, { source:'Manual', recruiterId:'RP-081', stage:'Shortlisted' }); backup.processStage = 1;
      var b = atOffer('Walks Away'); outcome(b, 'Offer made', { ctc:'30', doj:DOJ }); var n0 = FM.notices.length;
      outcome(b, 'Backed out', { reason:DROP_REASONS[0] });
      ok(b.offer.status === 'Withdrawn' && b.stage === 'Withdrawn', 'at the offer: ' + b.offer.status + ' / ' + b.stage); ok(audits('Backed out after the offer').some(function(a){ return /Walks Away/.test(a.detail); }), 'through pjBackedOut');
      ok(FM.notices.slice(n0).some(function(n){ return n.to === 'RP-081' && /Walks Away backed out/.test(n.text) && /Next in line: Ready Backup/.test(n.text); }), 'the owner is told who is next');
      ok(!FM.pj[b.id], 'no pre-joining tracker for an offer that was never accepted');
      var a = atOffer('Late Backout'); outcome(a, 'Offer made', { ctc:'30', doj:DOJ }); outcome(a, 'Accepted'); pjTick(); ok(FM.pj[a.id], 'accepted → tracker');
      outcome(a, 'Backed out', { reason:DROP_REASONS[0] }); ok(a.offer.status === 'Withdrawn' && a.stage === 'Withdrawn' && FM.pj[a.id].status === 'backed_out', 'at joining: ' + a.offer.status + ' / ' + FM.pj[a.id].status);
      ok(audits('Backed out before joining').some(function(x){ return /Late Backout/.test(x.detail); }), 'audited');
      ok(j.status !== 'Filled' && !PAYTRACK_JOINED.some(function(r){ return r.submissionId === a.id || r.submissionId === b.id; }), 'job not Filled, no placement: ' + j.status);
      var p = atOffer('Pending Backout'); outcome(p, 'Offer made', { ctc:'45', doj:DOJ }); var rq = offerReqs(p)[0]; outcome(p, 'Backed out', { reason:DROP_REASONS[0] });
      ok(p.offer.status === 'Withdrawn' && rq.status === 'Cancelled', 'a pending offer backed out closes its approval: ' + rq.status);
    });

    await t('campaign: cpMakeOffer writes sb.offer; accepting and joining in the campaign creates one placement', async function(){
      wsxOffer(); asAdmin(); var c = CAMPAIGNS.find(function(x){ return x.jobId === 'j1'; });
      var p = cpPeopleOf(c).find(function(x){ return cpSub(c, x) && ['ready','submitted','interview','offerDecision'].indexOf(x.state) > -1; }); ok(p, 'a campaign person with a journey');
      var sb = cpSub(c, p); p.state = 'offerDecision';
      ok(cpMakeOffer(p.id, 28, CP_ISO(CP_NOW() + 30 * CP_DAY)), 'offer released');
      ok(sb.offer && sb.offer.id && sb.offer.status === 'Made' && sb.offer.ctc === 28 && p.offer.offerId === sb.offer.id, 'one record, on the journey: ' + JSON.stringify(sb.offer).slice(0, 160));
      ok(sb.stage === 'Offer Extended', 'journey at Offer Extended: ' + sb.stage);
      cpAcceptUI(p.id); ok(p.state === 'accepted' && sb.offer.status === 'Accepted', 'accepted in the campaign and on the journey');
      cpJoinedUI(p.id); var recs = PAYTRACK_JOINED.filter(function(r){ return r.submissionId === sb.id; });
      ok(p.state === 'joined' && recs.length === 1 && recs[0].offerId === sb.offer.id && recs[0].overrideRecorded === false, 'one placement: ' + recs.length);
      ok(sb.stage === 'Joined' && sb.stageHistory.filter(function(h){ return h.stage === 'Joined'; }).length === 1, 'Joined once');
      var p2 = cpPeopleOf(c).find(function(x){ return x !== p && cpSub(c, x) && !cpSub(c, x).offer && ['ready','submitted','interview','offerDecision'].indexOf(x.state) > -1; });
      ok(p2, 'a second campaign person with a journey'); { asRecruiter('RP-081'); var sb2 = cpSub(c, p2); p2.state = 'offerDecision'; ok(cpMakeOffer(p2.id, 40, CP_ISO(CP_NOW() + 30 * CP_DAY)) && sb2.offer.status === 'Pending approval', 'a campaign offer above the range waits for approval');
        cpAcceptUI(p2.id); ok(p2.state === 'offer' && sb2.offer.status === 'Pending approval', 'and can’t be accepted yet'); asAdmin(); }
    });

    await t('a revised (counter) offer keeps one record, moves the old values to history, and re-runs the approval rule', async function(){
      wsxOffer(); asRecruiter('RP-081'); var sb = atOffer('Counter Offer');
      outcome(sb, 'Offer made', { ctc:'30', doj:DOJ }); var id = sb.offer.id;
      pipeOpenOutcome(sb.id); ok(ocOptions().some(function(o){ return o[0] === 'Revised offer'; }), 'Revised offer is a choice'); ocSet('choice', 'Revised offer'); ok(ocState.ctc === '30' && ocState.doj === DOJ, 'prefilled from the offer'); ocClose();
      outcome(sb, 'Revised offer', { ctc:'32', doj:'2026-12-08' });
      ok(sb.offer.id === id && sb.offer.ctc === 32 && sb.offer.doj === '2026-12-08' && sb.offer.status === 'Made', 'same record, new terms');
      ok(sb.offer.history.length === 1 && sb.offer.history[0].ctc === 30 && sb.offer.history[0].doj === DOJ, 'old values in history');
      ok(SUBMISSIONS.filter(function(x){ return x.offer && x.offer.id === id; }).length === 1 && sb.joinDate === '2026-12-08', 'one record, one joining date');
      outcome(sb, 'Revised offer', { ctc:'40', doj:'2026-12-08' }); var rq1 = offerReqs(sb)[0]; ok(sb.offer.status === 'Pending approval' && rq1, 'revised above the range → approval');
      pipeOpenOutcome(sb.id); ok(ocOptions().some(function(o){ return o[0] === 'Revised offer'; }), 'revisable while pending'); ocClose();
      outcome(sb, 'Revised offer', { ctc:'33', doj:'2026-12-08' }); ok(sb.offer.status === 'Made' && rq1.status === 'Cancelled' && sb.offer.history.length === 3, 'revised back into the range: approval closed, ' + sb.offer.history.length + ' versions kept');
      ok(audits('Offer revised', sb.id).length === 2 && audits('Revised offer sent for approval', sb.id).length === 1, 'audited');
    });

    await t('screens: lineup action, the outcome dialog wording, approvals and dashboards still render', async function(){
      wsxOffer(); asRecruiter('RP-081'); var sb = atOffer('Wording Check');
      var acts = candidateNextBestActions(byId(sb.candidateId)); var a = acts.find(function(x){ return /pipeOpenOutcome/.test(x.onclick || ''); });
      ok(a && a.actionLabel === 'Record the client’s offer', 'lineup action: ' + JSON.stringify(acts.map(function(x){ return x.actionLabel; })));
      pipeOpenOutcome(sb.id); var root = q('#oc-root'); ok(/Record the client’s offer/.test(root.textContent), 'dialog title'); ocSet('choice', 'Offer made');
      ok(/Notes · feedback from the client/.test(q('#oc-root').textContent) && !/optional — feedback/.test(q('#oc-root').textContent), 'notes label'); ocClose();
      ok(typeof openOfferModal === 'undefined' && typeof confirmExtendOffer === 'undefined', 'the old dialog is gone');
      ['recruiter','manager','admin'].forEach(function(r){ clean(); state.role = r; showView(DEFAULT_VIEW[r]); ok(!/Something went wrong/.test(q('#main-content').textContent), r + ' home'); });
      asAdmin(); showView('approval-center'); ok(!/Something went wrong/.test(q('#main-content').textContent), 'approvals'); showView('paytrack'); ok(!/Something went wrong/.test(q('#main-content').textContent), 'paytrack');
      ok(computeNotifications().filter(function(n){ return n.category === 'Offers'; }).length === offersList().length, 'notifications list each offer');
    });

    asAdmin(); WSX.approvals.offer = JSON.parse(WSX0);
    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
    document.title = 'M01-OFFER ' + results.filter(function(r){ return r.pass; }).length + '/' + results.length;
  }, 800); });
})();

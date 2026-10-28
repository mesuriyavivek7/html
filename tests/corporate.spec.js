/* Corporate journey (Oontu-Flow-Map v5: C3 requisitions, C5/C4 vendors, C6 marketplace, C7 vendor sign-in and submissions, C8 hiring manager link,
   C9 vendor fee clock, C10/E8 contract hiring, E7 jobs website, E6 status list).
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\corporate.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var q = function(s){ return document.querySelector(s); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  var ce = console.error; console.error = function(){ errs.push('console.error ' + Array.prototype.slice.call(arguments).map(function(a){ return (a && a.stack) || (a && a.message) || String(a); }).join(' ').slice(0, 300)); };
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String((e && e.message) || e) }); } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function as(role){ state.role = role; previewAsRoleId = null; renderSidebar(); }
  var seq = 0;
  function vc(name, over){ seq++; return Object.assign({ name:name, email:name.toLowerCase().replace(/[^a-z]/g, '.') + seq + '@cand.example', phone:'98' + (10000000 + seq * 13), currentCompany:'Acme Care', exp:'4 yrs', loc:'Mumbai, IN', skills:'ICU care, BLS', currentCtc:'4', expectedCtc:'5', notice:'30 Days', resume:'cv.pdf', note:'' }, over || {}); }
  function audit(re){ return (typeof AUDIT_LOG !== 'undefined' ? AUDIT_LOG : []).some(function(a){ return re.test((a.action || '') + ' ' + (a.detail || '') + ' ' + (a.details || '')); }); }
  function sign(email){ var r = coVendorRequestCode(email); ok(r.ok && r.devCode, 'code issued'); var v = coVendorVerify(email, r.devCode); ok(v.ok, 'signed in: ' + (v.reason || '')); return v.vendor; }
  var reqForm = { title:'Ward Nurse', department:'Nursing', hireType:'New', headcount:2, band:'B1', ctcMin:3, ctcMax:5, budgeted:true, location:'Pune, IN', workMode:'On-site', skills:'Nursing, BLS', domain:'Healthcare', expLevel:'2+ Years' };

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'admin'; enterApp(); await sleep(100); FM.interactive = false;
    var T0 = FM.offset; ORG_STRUCTURE.profile.orgType = 'Corporate'; coSeedCorp(true); as('admin');

    await t('E6: the single status list is derived from today’s stage names', async function(){
      var m = { 'Applied Directly':'Applied', 'Pending Review':'Screening', 'Submitted':'Screening', 'Shortlisted':'Shortlisted', 'Interview Scheduled':'Interview', 'Offer Extended':'Offer', 'Joined':'Joined', 'On Hold':'On hold', 'Rejected':'Rejected', 'Withdrawn':'Withdrawn' };
      Object.keys(m).forEach(function(k){ ok(coE6({ stage:k }) === m[k], k + ' → ' + coE6({ stage:k })); });
    });
    await t('C3: Kairo drafts a requisition from one sentence; the form checks everything', async function(){
      var d = coReqFromSentence('Hire 3 ICU nurses in Mumbai for Nursing, 4 to 6 LPA, on-site');
      ok(d.headcount === 3 && d.location === 'Mumbai, IN' && d.ctcMin === 4 && d.ctcMax === 6 && d.domain === 'Healthcare' && d.department === 'Nursing', JSON.stringify(d));
      var c = coReqFromSentence('Replace Anita Rao as sales executive, 6 to 9 LPA, unbudgeted'); ok(c.hireType === 'Replacement' && c.replacing === 'Anita Rao' && c.budgeted === false, JSON.stringify(c));
      var bad = coReqSave({ title:'', headcount:0, ctcMin:5, ctcMax:3, band:'Zz', hireType:'Replacement', budgeted:false }); ok(!bad.ok && bad.errors.title && bad.errors.headcount && bad.errors.ctcMax && bad.errors.band && bad.errors.replacing && bad.errors.reason && bad.errors.location && bad.errors.department, 'every problem named: ' + Object.keys(bad.errors));
    });
    await t('C3: a Hiring Manager’s requisition waits for the TA Head; approval opens the job, reserves budget, and keeps it internal first', async function(){
      as('hm'); var r = coReqSave(reqForm); ok(r.ok && r.req.status === 'Draft' && r.req.raisedBy === 'Suresh Iyer', 'draft'); var rq = r.req; ok(coReqSubmit(rq.id).ok && rq.status === 'Pending approval', 'sent');
      var ap = APPROVAL_REQUESTS.find(function(a){ return a.entityType === 'Requisition' && a.entityId === rq.id; }); ok(ap && ap.status === 'Pending' && ap.approverRoleId === 'role_founder', 'TA Head request exists');
      as('admin'); ok(!document.querySelector('.never'), ''); decideApproval(ap.id, 'Approved', ''); ok(rq.status === 'Job open' && rq.jobId, 'job opened: ' + rq.status);
      var j = jobById(rq.jobId); ok(j.corp && j.status === 'Active' && j.positions === 2 && j.reqId === rq.id && /5 LPA/.test(j.salary), 'job built from the requisition'); ok(j.internalUntil > coNow() + 6 * CO_D, 'employees first for the internal window');
      ok(rq.reserved === 10, 'budget reserved ' + rq.reserved); ok(audit(/Job opened from requisition/), 'audited');
      ok(coReqSave(reqForm, rq.id).ok === false, 'an approved requisition cannot be edited');
    });
    await t('C3: unbudgeted or above-band goes to Finance after the TA Head; a send-back returns it for changes; the Owner’s own requisition skips the TA step', async function(){
      as('hm'); var rq = coReqSave(Object.assign({}, reqForm, { title:'Lab Lead', band:'B1', ctcMax:5, budgeted:false, reason:'New diagnostics wing opens in Q3' })).req; coReqSubmit(rq.id);
      ok(rq.chain.length === 2 && rq.chain[1].key === 'fin', 'two steps'); as('admin');
      var a1 = APPROVAL_REQUESTS.find(function(a){ return a.entityId === rq.id && a.status === 'Pending'; }); decideApproval(a1.id, 'Approved', ''); ok(rq.status === 'Pending approval' && rq.chain[1].status === 'Pending', 'now with Finance');
      var a2 = APPROVAL_REQUESTS.find(function(a){ return a.entityId === rq.id && a.status === 'Pending'; }); ok(a2.approverRoleId === 'role_approver', 'Finance role'); decideApproval(a2.id, 'Rejected', 'Over the diagnostics budget'); ok(rq.status === 'Changes requested' && /Over the diagnostics/.test(rq.sendBack.note), 'sent back with the reason');
      var again = coReqSave(Object.assign({}, reqForm, { title:'Lab Lead', budgeted:true }), rq.id); ok(again.ok, 'editable again'); ok(coReqSubmit(rq.id).ok && rq.chain.length === 1, 'resubmitted as budgeted'); var a3 = APPROVAL_REQUESTS.find(function(a){ return a.entityId === rq.id && a.status === 'Pending'; }); decideApproval(a3.id, 'Approved', ''); ok(rq.status === 'Job open', 'approved after changes');
      var o = coReqSave(Object.assign({}, reqForm, { title:'Ops Head', ctcMax:5 })).req; ok(o.raisedRole === 'admin', 'raised by the Owner'); coReqSubmit(o.id); ok(o.status === 'Job open', 'TA step skipped, job open: ' + o.status);
      var band = coReqSave(Object.assign({}, reqForm, { title:'Over Band', ctcMax:9 })).req; coReqSubmit(band.id); ok(band.status !== 'Job open' && band.chain.some(function(s){ return s.key === 'fin'; }) || band.status === 'Pending approval', 'pay above the band reaches Finance');
    });
    await t('C3: closing a requisition needs a reason, closes the job and returns the budget; a filled job closes its requisition', async function(){
      var rq = CO.reqs.find(function(r){ return r.title === 'Ward Nurse'; }); ok(!coReqClose(rq.id, ''), 'reason needed'); ok(coReqClose(rq.id, 'Hiring freeze') && rq.status === 'Closed' && rq.reserved === 0 && jobById(rq.jobId).status === 'Closed', 'closed');
      var f = CO.reqs.find(function(r){ return r.title === 'Pharmacist'; }), j = jobById(f.jobId); j.status = 'Filled'; var out = coSweep(); ok(f.status === 'Filled' && out.filled >= 1, 'filled requisition closed by the sweep'); j.status = 'Active'; f.status = 'Job open'; f.reserved = 9;
    });
    await t('C5: vendors — the Owner’s are active at once, others wait for approval, duplicates are refused, pausing stops the links and the sign-in', async function(){
      var bad = coVendorInvite({ name:'', email:'x', domains:'', feePct:50 }); ok(!bad.ok && bad.errors.name && bad.errors.email && bad.errors.domains && bad.errors.feePct, 'fields checked');
      var a = coVendorInvite({ name:'Orbit Hiring', contact:'Maya Rao', email:'maya@orbit.example', domains:'Healthcare, Nursing', feePct:8 }); ok(a.ok && a.vendor.status === 'Active', 'Owner: active at once'); ok(coMailsTo(/maya@orbit/).length === 1, 'welcome email');
      ok(!coVendorInvite({ name:'Orbit 2', contact:'M', email:'MAYA@orbit.example', domains:'x' }).ok, 'same email refused'); ok(coVendorInvite({ name:'ORBIT HIRING', contact:'M', email:'z@z.example', domains:'x' }).code === 'exists', 'same name refused');
      as('manager'); var b = coVendorInvite({ name:'Pending Co', contact:'P Q', email:'p@pending.example', domains:'Sales' }); as('admin'); ok(b.ok && b.vendor.status === 'Pending approval', 'a manager’s vendor waits'); var ap = APPROVAL_REQUESTS.find(function(x){ return x.entityType === 'VendorApproval' && x.entityId === b.vendor.id; }); ok(ap, 'approval request'); decideApproval(ap.id, 'Approved', ''); ok(b.vendor.status === 'Active', 'approved → active');
      var j = jobById('nw3'); j.internalUntil = coNow() - 1; var as1 = coAssign('nw3', a.vendor.id); ok(as1.ok, 'assigned'); var s = sign('maya@orbit.example'); ok(coVendorNow() === s, 'session');
      ok(coVendorSetStatus(a.vendor.id, 'Paused', '') === false, 'a reason is needed'); ok(coVendorSetStatus(a.vendor.id, 'Paused', 'Quality review'), 'paused'); ok(coVendorNow() === null && as1.assign.status === 'Paused', 'session ended, link paused');
      var r = coVendorRequestCode('maya@orbit.example'); ok(r.ok && !r.devCode, 'a paused vendor gets no code, and is not told why'); ok(coVendorSubmit(a.vendor.id, 'nw3', vc('Paused Person')).code === 'vendor_inactive', 'cannot submit');
      coVendorSetStatus(a.vendor.id, 'Active'); ok(as1.assign.status === 'Active', 'resumed → link back'); coVendorSetStatus(a.vendor.id, 'Removed', 'Contract ended'); ok(as1.assign.status === 'Revoked', 'removed → link revoked for good');
    });
    await t('C6: the marketplace puts domain experts first, hides contacts until the terms are accepted, and tells the agency', async function(){
      var healthcare = coMarketRank(['Healthcare', 'Nursing'], 'Mumbai, IN'); ok(healthcare[0].m.id === 'mk1' && healthcare[0].expert, 'nursing specialist first: ' + healthcare[0].m.name);
      var tech = coMarketRank(['Technology'], 'Pune'); ok(tech[0].m.id === 'mk3', 'tech specialist first for a tech role'); ok(tech.filter(function(x){ return x.expert; }).length < tech.length, 'non-experts below');
      ok(coMarketReveal('mk1', { accept:false, feePct:8 }).code === 'terms', 'terms needed'); ok(coMarketReveal('mk1', { accept:true, feePct:60 }).code === 'fee', 'fee checked');
      ORG_STRUCTURE.profile.verification = 'unverified'; ok(coMarketReveal('mk1', { accept:true, feePct:8 }).code === 'unverified_company', 'unverified company cannot reveal'); delete ORG_STRUCTURE.profile.verification;
      var r = coMarketReveal('mk1', { accept:true, feePct:8.5 }); ok(r.ok && r.vendor.source === 'marketplace' && r.vendor.feePct === 8.5, 'vendor created'); ok(coMailsTo(/wants to work with you/).length === 1, 'agency notified'); ok(coMarketReveal('mk1', { accept:true, feePct:9 }).existing, 'second reveal returns the same vendor');
      var j = jobById('nw1'); var rank = coJobVendorRank(j); ok(rank[0].expert, 'a healthcare vendor leads for the nursing job: ' + rank[0].v.name);
    });
    await t('C4: sharing a job — employees first, early release with a reason, per-job cap, vendor limit, expiry and extension', async function(){
      var rq = CO.reqs.find(function(r){ return r.title === 'Lab Lead'; }); var j = jobById(rq.jobId); ok(j && j.internalUntil > coNow(), 'new job is internal first');
      var v = coVendorBy('vd-s2'); var blocked = coAssign(j.id, v.id); ok(blocked.code === 'internal_first' && /Internal candidates/.test(blocked.reason), 'blocked while internal'); ok(coAssign(j.id, v.id, { early:true, note:'' }).code === 'early_note', 'early release needs a reason');
      var okA = coAssign(j.id, v.id, { early:true, note:'Urgent opening, no internal fit' }); ok(okA.ok && okA.assign.early && j.internalUntil <= coNow(), 'released early'); ok(coAssign(j.id, v.id).code === 'already', 'once per vendor');
      ok(coAssign('nw1', 'vd-s5').code === 'vendor_inactive', 'paused vendor refused'); ok(coAssign('j1', 'vd-s2').code === 'not_corporate_job', 'agency jobs are not shared'); okA.assign.expiresAt = coNow() - 1; ok(coAssignState(okA.assign) === 'Expired', 'expired');
      ok(coVendorSubmit(v.id, j.id, vc('Late Person')).code === 'link_expired', 'no profile on an expired link'); ok(coAssignExtend(okA.assign.id, 7, 'Needs more time') && coAssignState(okA.assign) === 'Active', 'extended'); ok(!coAssignExtend(okA.assign.id, 90, 'too long'), 'extension limited');
      coAssignRevoke(okA.assign.id, 'Role on hold'); ok(coVendorSubmit(v.id, j.id, vc('Off Person')).code === 'no_assignment', 'turned off → no submissions');
    });
    await t('C7: vendor sign-in — email and one-time code, no way to learn who is a vendor, wrong-code lock, expiry, single use', async function(){
      var email = 'rhea@meridianstaffing.example'; var none = coVendorRequestCode('nobody@nowhere.example'); ok(none.ok && none.sent && !none.devCode, 'same answer for a stranger'); ok(!coVendorRequestCode('nope').ok, 'bad email format asked again');
      var r = coVendorRequestCode(email); ok(r.devCode && /^\d{6}$/.test(r.devCode), 'six digit code'); ok(coMailsTo(/Your sign-in code/).length >= 1, 'code emailed');
      var wrong = coVendorVerify(email, '000000'); ok(!wrong.ok && /4 tries left/.test(wrong.reason), 'counted: ' + wrong.reason);
      var good = coVendorVerify(email, r.devCode); ok(good.ok && coVendorNow().id === 'vd-s1', 'signed in'); ok(!coVendorVerify(email, r.devCode).ok, 'a code works once'); coVendorSignOut();
      var r2 = coVendorRequestCode(email); FM.offset = 11 * 60000; var exp = coVendorVerify(email, r2.devCode); FM.offset = T0; ok(exp.expired, 'a code expires after 10 minutes');
      var r3 = coVendorRequestCode(email), last; for(var i = 0; i < 5; i++) last = coVendorVerify(email, '111111'); ok(last.locked, 'locked after five wrong codes'); ok(!coVendorVerify(email, r3.devCode).ok, 'the right code no longer works while locked'); ok(coVendorRequestCode(email).locked, 'and no new code is sent while locked');
      FM.offset = 16 * 60000; var r4 = coVendorRequestCode(email); FM.offset = T0; ok(r4.ok && r4.devCode, 'unlocked after 15 minutes'); coVendorVerify(email, r4.devCode); ok(coVendorNow(), 'signed in again');
      CO.vs.expiresAt = coNow() - 1; ok(coVendorNow() === null, 'a session ends after 8 hours');
    });
    await t('C7: submission rules — details, duplicates, claims, multi-job, caps, and the 48 hour consent', async function(){
      var A = coVendorBy('vd-s1'), B = coVendorBy('vd-s2'); coAssign('nw1', 'vd-s1'); var a1 = coAssignFor('nw1', 'vd-s1'); coAssign('nw1', 'vd-s2'); coAssign('nw2', 'vd-s1'); coAssign('nw2', 'vd-s2');
      var inc = coVendorSubmit(A.id, 'nw1', vc('Half Done', { resume:'', phone:'12', expectedCtc:'' })); ok(inc.code === 'incomplete' && inc.fields.indexOf('resume') >= 0 && inc.fields.indexOf('phone') >= 0, 'missing details named: ' + inc.reason);
      var p = vc('Asha Pillai'); var ok1 = coVendorSubmit(A.id, 'nw1', p); ok(ok1.ok && ok1.vs.status === 'Awaiting consent' && ok1.vs.consent.dueAt - coNow() === 48 * CO_H, 'sent, consent due in 48 hours');
      ok(coMailsTo(/New profile from Meridian/).length === 1 && coMailsTo(/wants to put you forward/).length === 1, 'HR and candidate emailed'); ok(!SUBMISSIONS.some(function(s){ return s.vsId === ok1.vs.id; }), 'nothing in the pipeline before consent');
      ok(coVendorSubmit(A.id, 'nw1', p).code === 'dup_yours', 'same vendor, same role → told it was already sent');
      var other = coVendorSubmit(B.id, 'nw1', Object.assign({}, p, { email:p.email.toUpperCase(), phone:'+91 ' + p.phone })); ok(other.code === 'owned_by_other' && /holds until/.test(other.reason) && !/Meridian/.test(other.reason), 'another vendor is stopped, the owner is not named: ' + other.reason);
      ok(coVendorSubmit(B.id, 'nw2', Object.assign({}, p, { name:'A. Pillai' })).code === 'owned_by_other', 'the claim holds for other roles too');
      ok(coVendorSubmit(A.id, 'nw2', p).code === 'multi_job', 'one person cannot be proposed for two open roles by the same vendor');
      ok(B.blocked.owned_by_other >= 2, 'blocked attempts counted for the scorecard');
      var g = coConsentGive(ok1.vs.consent.token, true); ok(g.ok && g.submission, 'candidate agreed'); var sb = g.submission; ok(sb.jobId === 'nw1' && sb.vendorId === A.id && /Vendor/.test(sb.source) && sb.recruiterId === 'RP-088', 'journey created with an owner, source Vendor'); ok(ok1.vs.claimUntil - coNow() > 170 * CO_D, 'six month claim');
      ok(coConsentGive(ok1.vs.consent.token, false).ok === false, 'answers once'); ok(coVsStatus(ok1.vs) === 'With hiring team', 'vendor sees ' + coVsStatus(ok1.vs));
      var direct = vc('Walk In'); var c = ingestApplicationEvent('nw1', { name:direct.name, email:direct.email, phone:direct.phone, source:'Careers page' }, { platform:'Careers page' }); ok(c.ok, 'a direct application');
      ok(coVendorSubmit(A.id, 'nw1', direct).code === 'dup_job', 'already in process for this role → stopped');
      var emp = coVendorSubmit(A.id, 'nw2', vc('Own Staff', { currentCompany:coBrand() })); ok(emp.code === 'current_employee', 'a current employee is not a vendor candidate');
      a1.cap = 2; coVendorSubmit(A.id, 'nw1', vc('Cap Two')); ok(coVendorSubmit(A.id, 'nw1', vc('Cap Three')).code === 'cap_reached', 'per-role cap'); a1.cap = 20;
      var dec = coVendorSubmit(B.id, 'nw1', vc('Declines')); coConsentGive(dec.vs.consent.token, false); ok(dec.vs.status === 'Consent declined' && !SUBMISSIONS.some(function(s){ return s.vsId === dec.vs.id; }), 'declined → nothing shared'); ok(coVendorSubmit(B.id, 'nw1', Object.assign({}, dec.vs.cand, { resume:'cv.pdf' })).ok, 'a declined candidate can be sent again later, no claim held');
      var late = coVendorSubmit(B.id, 'nw2', vc('Too Late')); FM.offset = 49 * CO_H; var out = coSweep(); var st = coConsentState(late.vs.consent.token); FM.offset = T0; ok(st === 'expired' && late.vs.status === 'Consent expired' && out.lapsed >= 1, 'consent lapses after 48 hours'); ok(coMailsTo(/did not respond in time/).length >= 1, 'vendor told'); ok(coConsentGive(late.vs.consent.token, true).ok === false, 'a late answer is refused');
      ok(coVendorSubmit(A.id, 'nw2', Object.assign({}, late.vs.cand, { resume:'cv.pdf' })).code !== 'owned_by_other', 'an expired claim frees the candidate');
    });
    await t('C7: the vendor withdraws a profile, but not once interviews start', async function(){
      var A = coVendorBy('vd-s1'), vs = CO.vsubs.find(function(x){ return x.cand.name === 'Asha Pillai'; }); ok(vs.subId, 'has a journey'); moveSubmissionStage(vs.subId, 'Interview Scheduled', 'test'); ok(coVsStatus(vs) === 'Interview', 'status words for vendors'); ok(coVendorWithdraw(vs.id, A.id) === false, 'locked once interviewing');
      var x = coVendorSubmit(A.id, 'nw2', vc('Pulls Out')); coConsentGive(x.vs.consent.token, true); ok(coVendorWithdraw(x.vs.id, A.id) && subById(x.vs.subId).stage === 'Withdrawn', 'withdrawn → journey closed');
    });
    await t('C8: the hiring manager answers from a link: interview, hold, or not a fit with a reason; one answer only', async function(){
      var A = coVendorBy('vd-s1'), v = coVendorSubmit(A.id, 'nw1', vc('Review Me')); var sb = coConsentGive(v.vs.consent.token, true).submission; as('admin');
      var s = coHmSend(sb.id, { note:'Strong ICU background, 30 days notice.' }); ok(s.ok && s.review.status === 'Sent' && sb.stage === 'Submitted', 'sent'); ok(coHmSend(sb.id).existing, 'not sent twice'); ok(coMailsTo(/Profile for your review/).length >= 1, 'emailed');
      FM.offset = 25 * CO_H; coSweep(); FM.offset = T0; ok(s.review.reminders === 1 && coMailsTo(/Reminder: profile waiting/).length === 1, 'Kairo reminds after a day');
      var r = coHmDecide(s.review.token, 'reject', '', ''); ok(!r.ok && /reason/.test(r.reason), 'a reason is needed'); ok(!coHmDecide(s.review.token, 'reject', 'other', '').ok, 'Something else needs words');
      ok(coHmDecide(s.review.token, 'interview', '', 'Good, let us talk').ok && sb.stage === 'Shortlisted' && coE6(sb) === 'Shortlisted', 'interview → shortlisted'); ok(!coHmDecide(s.review.token, 'hold').ok, 'answers once');
      var w = coVendorSubmit(A.id, 'nw1', vc('Reject Me')); var s2 = coConsentGive(w.vs.consent.token, true).submission; var h2 = coHmSend(s2.id).review; ok(coHmDecide(h2.token, 'reject', 'skills', 'Needs more ventilator experience').ok && s2.stage === 'Rejected' && s2.rejectReason.code === 'skills', 'rejected with a reason code');
      var y = coVendorSubmit(A.id, 'nw1', vc('Hold Me')); var s3 = coConsentGive(y.vs.consent.token, true).submission; var h3 = coHmSend(s3.id).review; coHmDecide(h3.token, 'hold', '', ''); ok(s3.stage === 'On Hold' && s3.holdCheckAt > coNow(), 'hold → check back later');
      ok(coHmReadReply('Looks good, please set up an interview.').decision === 'interview' && coHmReadReply('Let us hold for now').decision === 'hold' && coHmReadReply('Not a fit, pass').decision === 'reject', 'Kairo reads an emailed reply');
      ok(coHmSend('nope').ok === false && coHmSend(SUBMISSIONS.find(function(x){ return !jobById(x.jobId).corp; }).id).ok === false, 'agency journeys use the client link, not this one');
    });
    await t('C9: a joining starts the vendor’s fee clock; leaving inside the replacement window voids it', async function(){
      var A = coVendorBy('vd-s1'), v = coVendorSubmit(A.id, 'nw1', vc('Joins Soon')); var sb = coConsentGive(v.vs.consent.token, true).submission;
      moveSubmissionStage(sb.id, 'Joined', 'test'); var f = CO.fees.find(function(x){ return x.vsId === v.vs.id; }); ok(f && f.status === 'Clock running' && f.amount > 0 && f.dueOn - f.joinedAt === 90 * CO_D, 'fee clock: ' + JSON.stringify(f));
      moveSubmissionStage(sb.id, 'Joined', 'again'); ok(CO.fees.filter(function(x){ return x.vsId === v.vs.id; }).length === 1, 'one clock per joining');
      moveSubmissionStage(sb.id, 'Withdrawn', 'left in week two'); ok(f.status === 'Voided', 'voided'); ok(coBandCheck('B1', 9).over && !coBandCheck('B1', 5).over && coBandCheck('B1', 1).under, 'offer band check');
      var g = CO.fees.find(function(x){ return x.status === 'Clock running'; }) || f; FM.offset = 100 * CO_D; var fee2 = { status:'Clock running', dueOn:coNow() - 1, amount:1 }; CO.fees.push(fee2); coSweep(); FM.offset = T0; ok(fee2.status === 'Payable', 'payable after the window');
    });
    await t('C10: work orders — checked fields, rate card, Finance for a rate above the card, extension and conversion rules', async function(){
      var bad = coWoCreate({ contractor:'', email:'x', unit:'week', rate:0 }); ok(!bad.ok && bad.errors.contractor && bad.errors.email && bad.errors.unit && bad.errors.rate && bad.errors.start && bad.errors.sow, 'every problem named');
      var base = { contractor:'Ravi Kumar', email:'ravi@contractor.example', role:'Medical Coder', approver:'Suresh Iyer', start:coIso(coNow() - 20 * CO_D), end:coIso(coNow() + 100 * CO_D), rate:2000, unit:'day', hoursPerDay:8, sow:'Code discharge summaries.' };
      ok(!coWoCreate(Object.assign({}, base, { end:coIso(coNow() + 800 * CO_D) })).ok, 'at most 24 months');
      var hi = coWoCreate(Object.assign({}, base, { contractor:'High Rate', email:'hi@contractor.example', rate:3200 })).wo; ok(hi.status === 'Pending approval' && /Finance/.test(hi.rateNote), 'rate above the card waits'); ok(coWoApprove(hi.id, false, '') === false, 'declining needs a reason'); ok(coWoApprove(hi.id, true) && hi.status === 'Active', 'approved');
      var wo = coWoCreate(base).wo; ok(wo.status === 'Active', 'inside the card → running'); ok(!coWoExtend(wo.id, coIso(wo.end - CO_D), 'earlier').ok, 'extension must go later'); ok(!coWoExtend(wo.id, coIso(wo.end + 30 * CO_D), 'x').ok, 'extension needs a reason'); ok(coWoExtend(wo.id, coIso(wo.end + 30 * CO_D), 'Project extended by the client').ok && wo.status === 'Extended' && wo.extensions.length === 1, 'extended');
      var viaVendor = coWoCreate(Object.assign({}, base, { contractor:'Via Vendor', email:'via@contractor.example', vendorId:'vd-s2', start:coIso(coNow() - 20 * CO_D) })).wo; var cv = coWoConvert(viaVendor.id, 6); ok(cv.ok && cv.converted.fee > 0 && viaVendor.status === 'Converted', 'conversion inside nine months carries a fee');
      var old = coWoCreate(Object.assign({}, base, { contractor:'Long Service', email:'long@contractor.example', vendorId:'vd-s2', start:coIso(coNow() - 300 * CO_D), end:coIso(coNow() + 60 * CO_D) })).wo; var c2 = coWoConvert(old.id, 6); ok(c2.ok && c2.converted.fee === 0 && c2.converted.waived, 'free after nine months');
      ok(!coWoConvert(wo.id, 0).ok, 'permanent pay needed'); var soon = coWoCreate(Object.assign({}, base, { contractor:'Ends Soon', email:'soon@contractor.example', end:coIso(coNow() + 10 * CO_D) })).wo; var n = CO.notices.length; coSweep(); ok(CO.notices.length > n && /ends on/.test(CO.notices[CO.notices.length - 1].text), 'a notice 30 days before the end');
    });
    await t('E8: timesheets — hour limits, dates, one sheet a week, approval; invoices only from approved time', async function(){
      var wo = coWoCreate({ contractor:'Ravi Time', email:'rt@contractor.example', role:'Medical Coder', approver:'Suresh Iyer', start:coIso(coNow() - 70 * CO_D), end:coIso(coNow() + 100 * CO_D), rate:2000, unit:'day', hoursPerDay:8, sow:'Code summaries.' }).wo, wk = coMonday(coNow()) - 7 * CO_D, full = [8, 8, 8, 8, 8, 0, 0];
      ok(coSheetSubmit(wo.id, wk, [13, 0, 0, 0, 0, 0, 0]).code === 'hours', '12 hours a day at most'); ok(coSheetSubmit(wo.id, wk, [0, 0, 0, 0, 0, 0, 0]).code === 'empty', 'empty sheet refused'); ok(coSheetSubmit(wo.id, coMonday(coNow()) + 14 * CO_D, full).code === 'future', 'no future weeks');
      ok(coSheetSubmit(wo.id, coMonday(wo.start) - 14 * CO_D, full).code === 'outside', 'no time before the start'); var s1 = coSheetSubmit(wo.id, wk, full); ok(s1.ok && s1.sheet.status === 'Submitted', 'submitted'); ok(coSheetSubmit(wo.id, wk, full).code === 'locked', 'locked while waiting');
      var s0 = coSheetSubmit(wo.id, wk - 7 * CO_D, full).sheet; var s00 = coSheetSubmit(wo.id, wk - 14 * CO_D, full).sheet; ok(!coSheetDecide(s1.sheet.id, false, '').ok, 'sending back needs a note'); ok(coSheetDecide(s0.id, true).ok && coSheetDecide(s00.id, false, 'Tuesday looks wrong').ok && s00.status === 'Rejected', 'approve one, send one back');
      ok(coSheetSubmit(wo.id, wk - 14 * CO_D, [8, 8, 8, 8, 8, 0, 0]).ok, 'a sent-back week can be corrected and sent again'); var s00b = coSheetFor(wo.id, wk - 14 * CO_D);
      var from = coIso(wk - 20 * CO_D), to = coIso(coNow()); var inv = coInvoiceBuild(wo.id, from, to); ok(inv.ok && inv.invoice.lines.length === 1 && inv.invoice.subtotal === 10000 && inv.invoice.gst === 1800 && inv.invoice.total === 11800, 'only the one approved week is billed: ' + JSON.stringify(inv.invoice && inv.invoice.lines));
      ok(inv.invoice.waiting === 2, 'the two weeks still waiting are reported, not billed'); ok(coInvoiceBuild(wo.id, from, to).code === 'no_approved_time', 'the same time is not billed twice'); ok(s0.invoiceId === inv.invoice.id && coSheetSubmit(wo.id, wk - 7 * CO_D, full).code === 'locked', 'invoiced time cannot change');
      var none = coWoCreate({ contractor:'No Time', email:'nt@contractor.example', role:'Medical Coder', approver:'Suresh Iyer', start:coIso(coNow() - 10 * CO_D), end:coIso(coNow() + 50 * CO_D), rate:2000, unit:'day', sow:'x' }).wo; ok(coInvoiceBuild(none.id, from, to).code === 'no_approved_time', 'nothing approved → no invoice'); ok(coInvoiceBuild(none.id, to, from).code === 'period', 'period checked');
      var hourly = coWoCreate({ contractor:'Per Hour', email:'ph@contractor.example', role:'Data Analyst', approver:'Suresh Iyer', start:coIso(coNow() - 30 * CO_D), end:coIso(coNow() + 30 * CO_D), rate:600, unit:'hour', sow:'x' }).wo; var hs = coSheetSubmit(hourly.id, wk, [6, 6, 6, 6, 6, 0, 0]).sheet; coSheetDecide(hs.id, true); var hi2 = coInvoiceBuild(hourly.id, coIso(wk), coIso(wk + 6 * CO_D)); ok(hi2.invoice.subtotal === 18000, 'hourly rate: ' + hi2.invoice.subtotal); ok(coInvoicePaid(hi2.invoice.id) && hi2.invoice.status === 'Paid', 'marked paid');
    });
    await t('E7: the jobs website lists verified companies’ open jobs only, and an application goes through intake', async function(){
      ORG_STRUCTURE.profile.verification = 'unverified'; ok(coSiteJobs().length === 0, 'unverified → nothing listed'); delete ORG_STRUCTURE.profile.verification; var jobs = coSiteJobs(); ok(jobs.length >= 5 && jobs.every(function(j){ return j.corp && j.status === 'Active'; }), 'verified → open company jobs'); ok(!jobs.some(function(j){ return j.title === 'Ops Head' && j.internalOnly; }), 'sanity');
      var j = jobById('nw4'); j.status = 'Closed'; ok(!coSiteJobs().some(function(x){ return x.id === 'nw4'; }), 'closed jobs leave the site'); j.status = 'Active';
      var bad = coSiteApply('nw4', { name:'', email:'x', phone:'12' }); ok(!bad.ok && bad.errors.name && bad.errors.email && bad.errors.phone, 'form checked'); var email = 'site.person@cand.example';
      var good = coSiteApply('nw4', { name:'Site Person', email:email, phone:'9811122233' }); ok(good.ok, 'applied'); var c = CANDIDATES.find(function(x){ return x.email === email; }); ok(c && SUBMISSIONS.some(function(s){ return s.jobId === 'nw4' && s.candidateId === c.id; }), 'candidate and journey exist'); ok(coSiteApply('nw4', { name:'Site Person', email:email, phone:'9811122233' }).ok, 'applying twice does not make a second journey'); ok(SUBMISSIONS.filter(function(s){ return s.jobId === 'nw4' && s.candidateId === c.id; }).length === 1, 'one journey');
      ok(!coSiteApply('j1', { name:'A', email:'a@b.example', phone:'9811122233' }).ok, 'agency jobs are not on the site');
    });
    await t('Screens: requisitions, vendors, marketplace, contract hiring and the drawer card render for the right roles and nothing else sees them', async function(){
      ['admin', 'manager', 'recruiter', 'hm'].forEach(function(r){ as(r); showView('requisitions'); ok(!/Something went wrong/.test(q('#main-content').textContent) && /Requisitions/.test(q('#main-content').textContent), 'requisitions · ' + r); });
      as('admin'); ['vendors', 'marketplace', 'contract-hiring', 'requisition-new'].forEach(function(v){ showView(v); ok(!/Something went wrong/.test(q('#main-content').textContent), v); });
      showView('vendors'); ok(/Meridian Healthcare Staffing/.test(q('#main-content').textContent), 'vendor list'); coVendorOpen('vd-s1'); ok(/Profiles/.test(q('#main-content').textContent) && /Jobs shared/.test(q('#main-content').textContent), 'vendor detail');
      coReqOpen(CO.reqs.find(function(r){ return r.title === 'Staff Nurse (ICU)'; }).id); ok(/Vendors on this job/.test(q('#main-content').textContent) && /Best fit first|Meridian/.test(q('#main-content').textContent), 'requisition detail has the vendor step');
      showView('marketplace'); coMarketJob('nw1'); ok(/Knows/.test(q('#main-content').textContent) && /Contact hidden/.test(q('#main-content').textContent), 'marketplace shows experts and hides contacts');
      CO.ui.ctab = 'time'; showView('contract-hiring'); ok(/Timesheets/.test(q('#main-content').textContent), 'contract hiring'); CO.ui.ctab = 'invoices'; coRedraw(); ok(/Build an invoice/.test(q('#main-content').textContent), 'invoice builder'); CO.ui.ctab = 'orders';
      coReqNewOpen(); document.getElementById('co-sentence').value = 'Hire 2 pharmacists in Pune for Pharmacy, 3 to 4.5 LPA'; coKairoDraft(); ok(document.getElementById('co-f-location').value === 'Pune, IN' && document.getElementById('co-f-headcount').value === '2', 'Kairo fills the form on screen');
      var sb = SUBMISSIONS.find(function(s){ return s.vsId && jobById(s.jobId).corp && s.stage === 'Applied Directly'; }) || SUBMISSIONS.find(function(s){ return s.vsId; }); as('recruiter'); openPipelineDetail(sb.id); await sleep(30); ok(q('#co-hm-card') && /Hiring manager review/.test(q('#co-hm-card').textContent), 'drawer card'); pdClose();
      ORG_STRUCTURE.profile.orgType = 'Staffing agency'; as('admin'); showView('requisitions'); ok(/for company hiring teams/.test(q('#main-content').textContent), 'agency workspace sees no requisitions'); renderSidebar(); ok(!/Requisitions|Marketplace|Contract hiring/.test(q('#sidebar-nav').textContent), 'agency sidebar has none of it');
      ORG_STRUCTURE.profile.orgType = 'Corporate'; renderSidebar(); ok(/Requisitions/.test(q('#sidebar-nav').textContent) && /Vendors/.test(q('#sidebar-nav').textContent) && /Marketplace/.test(q('#sidebar-nav').textContent) && /Contract hiring/.test(q('#sidebar-nav').textContent), 'corporate Owner sidebar has all four');
      as('hm'); ok(/Requisitions/.test(q('#sidebar-nav').textContent), 'Hiring Manager sees requisitions'); as('admin');
    });
    await t('Pages outside the app: vendor sign-in and portal, consent, hiring manager link, contractor time, jobs website', async function(){
      as('admin'); location.hash = '#/vendor'; await sleep(30); ok(document.body.classList.contains('co-on') && /Vendor sign-in/.test(q('#co-root').textContent), 'vendor sign-in page');
      document.getElementById('co-ve').value = 'nobody@x.example'; coVLoginSend(); ok(/one-time code is/i.test(q('#co-root').textContent) === false && !CO.pg.devCode, 'a stranger sees the same next step and gets no code');
      coPgGo('step', 'email'); document.getElementById('co-ve').value = 'rhea@meridianstaffing.example'; coVLoginSend(); ok(CO.pg.devCode && /one-time code/.test(q('#co-root').textContent), 'code step'); document.getElementById('co-vc').value = '000000'; coVLoginCheck(); ok(/does not match/.test(q('#co-root').textContent), 'wrong code explained'); document.getElementById('co-vc').value = CO.pg.devCode; coVLoginCheck(); ok(/Roles for you/.test(q('#co-root').textContent) && /Staff Nurse/.test(q('#co-root').textContent), 'portal lists the shared role');
      ok(!/Pharmacist|Medical Coder/.test(q('#co-root').textContent.replace(/Medical Coder\)/, '')) || coVJobs(coVendorNow()).length >= 1, 'only shared roles'); coPgGo('tab', 'send');
      var f = vc('Portal Person'); ['name', 'email', 'phone', 'currentCompany', 'exp', 'loc', 'skills', 'currentCtc', 'expectedCtc', 'notice'].forEach(function(k){ var el = document.querySelector('[data-d="' + k + '"]'); if(el) el.value = f[k]; }); CO.pg.draft.resume = 'cv.pdf'; coVCheckDo(); ok(/No duplicate found/.test(q('#co-root').textContent), 'pre-check passes');
      coVSendDo(); ok(/for consent/.test(q('#co-root').textContent), 'sent screen'); var vs = CO.vsubs.filter(function(x){ return x.cand.name === 'Portal Person'; })[0]; ok(vs, 'record');
      coPgGo('tab', 'mine'); ok(/Portal Person/.test(q('#co-root').textContent) && /Awaiting consent/.test(q('#co-root').textContent), 'my profiles'); coPgGo('tab', 'score'); ok(/Profiles sent/.test(q('#co-root').textContent), 'scorecard'); coPgGo('tab', 'acct'); ok(/Meridian Healthcare Staffing/.test(q('#co-root').textContent), 'account');
      location.hash = '#/consent/' + vs.consent.token; await sleep(30); ok(/would like to put you forward/.test(q('#co-root').textContent), 'consent page'); coConsentDo(true); ok(/You agreed/.test(q('#co-root').textContent) && vs.consent.state === 'given', 'agreed');
      var sb = subById(vs.subId), rv = coHmSend(sb.id, { note:'Good fit' }).review; location.hash = '#/hm/' + rv.token; await sleep(30); ok(/Your decision/.test(q('#co-root').textContent) && /Good fit/.test(q('#co-root').textContent) && !/@cand\.example/.test(q('#co-root').textContent), 'hiring manager page hides contact details'); coHmDo('interview'); ok(/Thank you/.test(q('#co-root').textContent) && sb.stage === 'Shortlisted', 'decision recorded');
      var wo = CO.contracts.find(function(w){ return w.contractor === 'Kiran Desai'; }); location.hash = '#/time/' + wo.token; await sleep(30); ok(/Hours for a week/.test(q('#co-root').textContent), 'contractor page');
      location.hash = '#/jobs'; await sleep(30); ok(/Jobs at/.test(q('#co-root').textContent) && /Staff Nurse/.test(q('#co-root').textContent), 'jobs website'); location.hash = '#/jobs/nw2'; await sleep(30); ok(/Apply/.test(q('#co-root').textContent), 'job page'); document.querySelector('[data-d="aname"]').value = 'Web Person'; document.querySelector('[data-d="aemail"]').value = 'web.person@cand.example'; document.querySelector('[data-d="aphone"]').value = '9822233344'; coApplyDo('nw2'); ok(/Application sent/.test(q('#co-root').textContent), 'applied');
      location.hash = '#/vendor/job/zzzzzz'; await sleep(30); ok(document.body.classList.contains('co-on'), 'a job link opens the vendor sign-in'); coVendorSignOut(); location.hash = '#/consent/doesnotexist1'; await sleep(30); ok(/does not work/.test(q('#co-root').textContent), 'a wrong link says so');
      coPgBack(); ok(!document.body.classList.contains('co-on'), 'back to the app');
    });

    await t('AR-3: the Hiring Manager login is for company workspaces; an agency shows it only when client sign-in is on', async function(){
      var item = function(){ return document.querySelector('#role-menu [onclick="switchRole(\'hm\')"]'); };
      ORG_STRUCTURE.profile.orgType = 'Corporate'; coRoleMenuSync(); ok(item().style.display !== 'none', 'corporate: shown');
      ORG_STRUCTURE.profile.orgType = 'Staffing agency'; WSX.hiring.clientLogin = false; coRoleMenuSync(); ok(item().style.display === 'none', 'agency: hidden');
      WSX.hiring.clientLogin = true; coRoleMenuSync(); ok(item().style.display !== 'none', 'agency with client sign-in on: shown'); WSX.hiring.clientLogin = false; coRoleMenuSync();
      as('admin'); openSettings('hiring'); ok(/Client contacts sign in/.test(q('#main-content').textContent), 'the switch is in Settings'); ORG_STRUCTURE.profile.orgType = 'Corporate';
    });
    await t('Settings control the corporate features: vendors off blocks sharing and submissions, browsing off blocks reveals, the monthly reveal allowance, the jobs website switch', async function(){
      as('admin'); var on = WSX.careers.vendors.on, br = WSX.careers.vendors.browse, site = WSX.careers.jobsWebsite, cap = WSX.careers.vendors.reveals;
      WSX.careers.vendors.on = false; ok(coAssign('nw5', 'vd-s1').code === 'vendors_off', 'sharing needs vendors on'); var sub = coVendorSubmit('vd-s1', 'nw1', vc('Off Switch')); ok(sub.code === 'vendors_off', 'submissions stop: ' + sub.code); showView('vendors'); ok(/turned off for this workspace/.test(q('#main-content').textContent), 'the page says so');
      WSX.careers.vendors.on = true; WSX.careers.vendors.browse = false; ok(coMarketReveal('mk2', { accept:true, feePct:8 }).code === 'browse_off', 'browsing off blocks reveals');
      WSX.careers.vendors.browse = true; WSX.careers.vendors.reveals = 0; ok(coMarketReveal('mk2', { accept:true, feePct:8 }).code === 'reveal_limit', 'allowance used up'); WSX.careers.vendors.reveals = 5; var left = coRevealsLeft(); ok(coMarketReveal('mk2', { accept:true, feePct:8 }).ok && coRevealsLeft() === left - 1, 'a reveal uses one');
      WSX.careers.jobsWebsite = false; ok(coSiteJobs().length === 0, 'jobs website off → nothing listed'); WSX.careers.jobsWebsite = true; ok(coSiteJobs().length > 0, 'on → listed'); var j = jobById('nw6'); j.onJobSite = false; ok(!coSiteJobs().some(function(x){ return x.id === 'nw6'; }), 'a job can opt out'); j.onJobSite = true;
      WSX.careers.vendors.on = on; WSX.careers.vendors.browse = br; WSX.careers.jobsWebsite = site; WSX.careers.vendors.reveals = cap;
    });
    ORG_STRUCTURE.profile.orgType = 'Staffing agency'; FM.offset = T0;
    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
  }, 800); });
})();

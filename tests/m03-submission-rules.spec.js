/* M3 · Submission rules, review and sending (B2, B3; flow map 05, 06, 09, 12).
   jobSubmissionRules(job) is the one reader: the job's saved rules, else Settings › Hiring rules (a job with no saved rules
   has no required fields). Review follows the job; required fields block before any write; the send dialog honours the
   job's contacts rule and profiles per send; an agency Recruiter can send a Ready profile.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\m03-submission-rules.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  var ce = console.error; console.error = function(){ errs.push('console.error ' + Array.prototype.slice.call(arguments).map(function(a){ return (a && a.stack) || (a && a.message) || String(a); }).join(' ').slice(0, 300)); };
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e.stack || e.message).slice(0, 500) }); } finally { csClose(); } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function clean(){ viewingAsFromManager = false; managerViewAsRecruiterId = null; previewAsRoleId = null; }
  function asAdmin(){ clean(); state.role = 'admin'; }
  function asManager(){ clean(); state.role = 'manager'; }                                                                            // Arjun Kapoor, Divya's manager
  function asRecruiter(){ state.role = 'manager'; viewingAsFromManager = true; managerViewAsRecruiterId = 'RP-081'; previewAsRoleId = null; }   // Divya Menon, Recruiter
  var toasts = [], t0 = window.toast; window.toast = function(m){ toasts.push(String(m)); return t0.apply(this, arguments); };
  var seq = 0;
  function rules(over){ return Object.assign({ approvalBeforeClient:false, hideContacts:true, maxProfiles:5, required:[] }, over || {}); }
  function mkJob(r, over){
    seq++; var j = Object.assign({ id:'m3j' + seq, title:'Rules Role ' + seq, client:'Fintech Corp', clientId:'c1', loc:'Pune, IN', locations:['Pune, IN'], status:'Active', priority:'Medium', recruiter:'Arjun Kapoor', recruiterId:'RP-092',
      assignedRecruiters:['RP-081','RP-092'], skills:['Java'], positions:3, submitted:0, candidateIds:[], interested:[], recs:[], publishChannels:[], organizationId:CURRENT_ORGANIZATION_ID, workMode:'Hybrid' }, over || {});
    if(r !== null) j.submissionRules = r; JOBS.push(j); return j;
  }
  function mkCand(over){
    seq++; var c = Object.assign({ id:96000 + seq, name:'Rules Candidate ' + seq, role:'Engineer', exp:'6 yrs', loc:'Pune, IN', avail:'Available', skills:['Java'], email:'r' + seq + '.m3@example.com', phone:'+91 93000 ' + String(10000 + seq),
      salary:'₹20–24 LPA', notice:'30 Days', linkedin:'linkedin.com/in/r' + seq, comp:{ currency:'INR', current:1800000, expected:2200000 }, organizationId:CURRENT_ORGANIZATION_ID }, over || {});
    CANDIDATES.push(c); return c;
  }
  function reviewOf(sb){ return APPROVAL_REQUESTS.find(function(r){ return r.entityType === 'SubmissionReview' && r.entityId === sb.id; }) || null; }
  // The candidate agrees through the real consent functions (M7): Yes on the link that was sent, or a recorded call.
  function agree(ids){ ids.forEach(function(id){ var x = subById(id); if(x.consent && x.consent.state === 'pending') consentAnswer(x.consent.token, true); else recordConsentCall(x, 'Called the candidate, agreed to be put forward'); }); }
  function send(ids, mutate){ openSendToClient(ids); ok(csState, 'the send dialog opened'); agree(csState.subIds); if(mutate) mutate(csState); csSend(); }
  function wsx(over){ var was = JSON.stringify(WSX.hiring); Object.assign(WSX.hiring, over); return function(){ WSX.hiring = JSON.parse(was); }; }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'admin'; enterApp(); await sleep(100); if(typeof FM !== 'undefined') FM.interactive = false;

    await t('review off: a recruiter submits → Ready to Send → the recruiter sends; no approval request', async function(){
      var j = mkJob(rules({ approvalBeforeClient:false })), c = mkCand(); asRecruiter(); ok(canI('candidates', 'Send to Client') && canSendToClient(j), 'the agency Recruiter can send');
      var n0 = APPROVAL_REQUESTS.length, r = submitOneToJob(j, c, 'Test');
      ok(r.ok && r.sub.stage === 'Ready to Send' && r.category === 'created', 'ready: ' + JSON.stringify([r.code, r.sub && r.sub.stage]));
      ok(APPROVAL_REQUESTS.length === n0 && !reviewOf(r.sub), 'no approval request');
      send([r.sub.id]); ok(r.sub.stage === 'Submitted' && r.sub.sent && r.sub.sent.by === 'Divya Menon', 'sent by the recruiter: ' + r.sub.stage);
    });

    await t('review on: Pending Review → the reviewer approves → Ready → the recruiter sends; the follow-through owner is the recruiter', async function(){
      var j = mkJob(rules({ approvalBeforeClient:true })), c = mkCand(); asRecruiter();
      var r = submitOneToJob(j, c, 'Test'), rq = reviewOf(r.sub); ok(r.ok && r.sub.stage === 'Pending Review' && rq && rq.approverUserId === 'RP-092', 'with Arjun for review: ' + (r.sub && r.sub.stage));
      asManager(); decideApproval(rq.id, 'Approved'); ok(r.sub.stage === 'Ready to Send', 'approved → ready: ' + r.sub.stage);
      APS.tick(); var v = APS.view('req:' + rq.id); ok(v.phase === 'followThrough' && v.phaseLabel === 'Send to client' && v.owner && v.owner.name === 'Divya Menon', 'owed by the recruiter: ' + JSON.stringify([v.phase, v.phaseLabel, v.state, v.owner && v.owner.name]));
      asRecruiter(); send([r.sub.id]); ok(r.sub.stage === 'Submitted', 'the recruiter sends'); APS.tick(); ok(APS.view('req:' + rq.id).state === 'closed', 'sending closes the follow-through');
    });

    await t('a requester whose role can’t send hands the follow-through to the reviewer', async function(){
      var role = CUSTOM_ROLES.find(function(x){ return x.id === 'role_recruiter'; }), list = role.permissions.candidates, i = list.indexOf('Send to Client'); list.splice(i, 1);
      try {
        var j = mkJob(rules({ approvalBeforeClient:true })), c = mkCand(); asRecruiter(); var r = submitOneToJob(j, c, 'Test'), rq = reviewOf(r.sub);
        asManager(); decideApproval(rq.id, 'Approved'); APS.tick(); var v = APS.view('req:' + rq.id); ok(v.owner && v.owner.name === 'Arjun Kapoor', 'the reviewer owes it: ' + JSON.stringify(v.owner));
      } finally { list.push('Send to Client'); }
    });

    await t('the reviewer’s “Approve & send to client” still works', async function(){
      var j = mkJob(rules({ approvalBeforeClient:true })), c = mkCand(); asRecruiter(); var r = submitOneToJob(j, c, 'Test'), rq = reviewOf(r.sub);
      asManager(); apprSubmission(rq.id, 'send'); ok(r.sub.stage === 'Ready to Send' && csState && csState.subIds[0] === r.sub.id, 'approved and the send dialog is open');
      agree(csState.subIds); csSend(); ok(r.sub.stage === 'Submitted' && r.sub.sent.by === 'Arjun Kapoor', 'sent by the reviewer');
    });

    await t('two jobs for the same client, one with review on and one off, behave differently', async function(){
      var on = mkJob(rules({ approvalBeforeClient:true })), off = mkJob(rules({ approvalBeforeClient:false })), c1 = mkCand(), c2 = mkCand(); asRecruiter();
      ok(on.client === off.client, 'same client'); var a = submitOneToJob(on, c1, 'Test'), b = submitOneToJob(off, c2, 'Test');
      ok(a.sub.stage === 'Pending Review' && b.sub.stage === 'Ready to Send', a.sub.stage + ' / ' + b.sub.stage);
    });

    await t('required fields: missing → blocked with the message and nothing written; filled → allowed; fields with no candidate field are returned, not blocked', async function(){
      var j = mkJob(rules({ required:['Notice period','Expected CTC','Current CTC'] })), c = mkCand({ notice:'—', salary:'', comp:{ currency:'INR', current:1800000, expected:null } }); asRecruiter();
      var subs0 = SUBMISSIONS.length, ap0 = APPROVAL_REQUESTS.length, au0 = AUDIT_LOG.length, ids0 = (j.candidateIds || []).length;
      var r = submitOneToJob(j, c, 'Test');
      ok(!r.ok && r.code === 'required_missing' && r.reason === 'Add notice period and expected CTC first.', 'blocked: ' + JSON.stringify([r.code, r.reason]));
      ok(JSON.stringify(r.missing) === JSON.stringify(['Notice period','Expected CTC']), 'missing named: ' + JSON.stringify(r.missing));
      ok(SUBMISSIONS.length === subs0 && APPROVAL_REQUESTS.length === ap0 && AUDIT_LOG.length === au0 && (j.candidateIds || []).length === ids0, 'nothing written');
      ok(submitOneToJob(j, c, 'Test', { dryRun:true }).code === 'required_missing', 'a dry run says the same');
      c.notice = '30 Days'; c.comp.expected = 2200000; var r2 = submitOneToJob(j, c, 'Test'); ok(r2.ok && r2.sub, 'filled → allowed');
      var k = mkJob(rules({ required:['Reason for change','Notice period'] })), d = mkCand(), r3 = submitOneToJob(k, d, 'Test');
      ok(r3.ok && JSON.stringify(r3.uncheckedRequired) === JSON.stringify(['Reason for change']), 'not blocked, returned as unchecked: ' + JSON.stringify(r3.uncheckedRequired));
      ok(requiredMissingText(['LinkedIn profile']) === 'Add LinkedIn profile first.' && requiredMissingText(['Current CTC','Notice period','Resume']) === 'Add current CTC, notice period and resume first.', 'plain wording');
      var e = mkCand({ salary:'₹20–24 LPA', comp:{ currency:'INR', current:1800000, expected:null } }); ok(candidateRequiredCheck(mkJob(rules({ required:['Expected CTC'] })), e).missing.length === 0, 'Expected CTC accepts the profile’s expected pay');
    });

    await t('hide contacts: the mask is forced on and the send is masked; share contacts: the mask starts off and can be turned on', async function(){
      var hide = mkJob(rules({ hideContacts:true })), c = mkCand(); asRecruiter(); var r = submitOneToJob(hide, c, 'Test');
      openSendToClient([r.sub.id]); ok(csState.mask === true, 'on'); csToggle('mask'); ok(csState.mask === true, 'can’t be turned off');
      var root = document.getElementById('cs-root'); ok(/Hidden for this job/.test(root.textContent) && root.querySelector('input[disabled]'), 'note and a locked tick box');
      csState.mask = false; agree(csState.subIds); csSend(); ok(r.sub.sent && r.sub.sent.masked === true, 'sent masked even if the state was tampered with');
      var share = mkJob(rules({ hideContacts:false })), d = mkCand(), s2 = submitOneToJob(share, d, 'Test');
      openSendToClient([s2.sub.id]); ok(csState.mask === false && !/Hidden for this job/.test(document.getElementById('cs-root').textContent), 'starts off'); csToggle('mask'); ok(csState.mask === true, 'the sender may still hide them');
      csToggle('mask'); agree(csState.subIds); csSend(); ok(s2.sub.sent.masked === false, 'sent with contacts');
    });

    await t('max profiles per send: over the limit is blocked in the dialog and in csSend itself', async function(){
      var j = mkJob(rules({ maxProfiles:2 })); asRecruiter(); var subs = [mkCand(), mkCand(), mkCand()].map(function(c){ return submitOneToJob(j, c, 'Test').sub; }), ids = subs.map(function(s){ return s.id; });
      openSendToClient(ids); agree(ids); csRender(); var lim = document.getElementById('cs-limit');
      ok(lim && lim.textContent === 'This job allows 2 profiles per send. Remove 1.', 'message: ' + (lim && lim.textContent)); ok(document.getElementById('cs-send').getAttribute('aria-disabled') === 'true', 'Send is off');
      csSend(); ok(subs.every(function(s){ return s.stage === 'Ready to Send'; }) && /allows 2 profiles per send/.test(toasts[toasts.length - 1]), 'csSend blocks it');
      csClose(); csState = { subIds:ids, jobId:j.id, channel:'Other', to:{}, subject:'x', pitch:{}, mask:true, resume:false, ref:'' }; csSend();
      ok(subs.every(function(s){ return s.stage === 'Ready to Send'; }), 'blocked even when the dialog is bypassed');
      openSendToClient(ids); csRemove(ids[2]); ok(!document.getElementById('cs-limit'), 'removing one clears it'); csSend(); ok(subs[0].stage === 'Submitted' && subs[1].stage === 'Submitted', 'two sent');
    });

    await t('defaults: a seeded job uses the workspace defaults with no required fields; a new job starts from Settings; changing Settings doesn’t change an existing job', async function(){
      var s = jobById('j1'); ok(!s.submissionRules, 'seeded job has no saved rules'); var rs = jobSubmissionRules(s);
      ok(rs.approvalBeforeClient === WSX.hiring.preApproval && rs.hideContacts === WSX.hiring.maskContacts && rs.maxProfiles === WSX.hiring.maxProfiles && rs.required.length === 0, 'defaults: ' + JSON.stringify(rs));
      ok(JSON.stringify(requiredFromSetting('Notice period, current CTC, expected CTC')) === JSON.stringify(['Notice period','Current CTC','Expected CTC']), 'the mandatory line maps to the list');
      var restore = wsx({ preApproval:false, maskContacts:false, maxProfiles:3, mandatory:'Expected CTC, LinkedIn profile, nonsense', replacementDays:60 });
      try {
        var d = jobCreateDefaults(); ok(JSON.stringify(d.rules) === JSON.stringify({ approvalBeforeClient:false, hideContacts:false, maxProfiles:3, required:['Expected CTC','LinkedIn profile'] }) && d.replacementDays === 60, 'new job from Settings: ' + JSON.stringify(d.rules));
        var saved = mkJob(jobStoredFieldsFromDraft(d).submissionRules); ok(saved.submissionRules.maxProfiles === 3, 'saved with the job');
        WSX.hiring.maxProfiles = 9; WSX.hiring.preApproval = true; ok(jobSubmissionRules(saved).maxProfiles === 3 && jobSubmissionRules(saved).approvalBeforeClient === false, 'an existing job keeps its own rules');
        ok(jobSubmissionRules(s).maxProfiles === 9, 'a job with no saved rules follows Settings');
      } finally { restore(); }
    });

    await t('roles: the agency Recruiter can send; the corporate templates are unchanged', async function(){
      var corp = roleTemplatesForOrgType('Corporate').find(function(r){ return r.id === 'role_recruiter'; }), agency = roleTemplatesForOrgType('Agency').find(function(r){ return r.id === 'role_recruiter'; });
      ok(JSON.stringify(corp.permissions.candidates) === JSON.stringify(['View','Edit','Download Resume']), 'corporate recruiter unchanged: ' + JSON.stringify(corp.permissions.candidates));
      ok(agency.permissions.candidates.indexOf('Send to Client') > -1, 'agency template');
      ok(!roleTemplatesForOrgType('Corporate').some(function(r){ return (r.permissions.candidates || []).indexOf('Send to Client') > -1 && r.id !== 'role_founder' && r.id !== 'role_recmgr'; }), 'no other corporate role gains it');
      var was = ORG_STRUCTURE.profile.orgType; ORG_STRUCTURE.profile.orgType = 'Corporate';
      try { var r = { id:'role_recruiter', name:'Recruiter', permissions:{ candidates:['View'] } }; migrateRole(r); ok(r.permissions.candidates.indexOf('Send to Client') < 0, 'migrating a corporate recruiter adds nothing'); }
      finally { ORG_STRUCTURE.profile.orgType = was; }
      var a = { id:'role_recruiter', name:'Recruiter', permissions:{ candidates:['View'] } }; migrateRole(a); ok(a.permissions.candidates.indexOf('Send to Client') > -1, 'an existing agency recruiter role gains it');
      ok(typeof SUBMISSION_POLICY === 'undefined', 'the old policy flag is gone');
    });

    asAdmin();
    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
    document.title = 'M03-RULES ' + results.filter(function(r){ return r.pass; }).length + '/' + results.length;
  }, 800); });
})();

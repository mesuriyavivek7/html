/* Task 02 tests: internal candidate sourcing and submission through one canonical operation.
   Run with:  powershell -ExecutionPolicy Bypass -File tests\run-auth-tests.ps1 -Spec tests\submission-flow.spec.js

   What these prove: every internal entry point ends in submitOneToJob(), each candidate is judged alone,
   duplicates and blocked cases are reported truthfully, and the screens say what actually happened.
   What they do NOT prove: server-side enforcement, database uniqueness, durability, or real concurrency
   (one JavaScript thread). See docs/SUBMISSION.md, "Limitations". */
(function(){
  'use strict';
  const results = [];
  function assert(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function eq(a, b, m){ if(a!==b) throw new Error((m ? m+': ' : '')+'expected '+JSON.stringify(b)+', got '+JSON.stringify(a)); }
  const base = { jobs:JOBS.length, cands:CANDIDATES.length, subs:SUBMISSIONS.length, appr:APPROVAL_REQUESTS.length, roles:CUSTOM_ROLES.length };
  const realOne = submitOneToJob, realCreate = createSubmission, realReview = requestSubmissionReview, realToast = toast;
  let toasts = [], seq = 0;

  function reset(){
    JOBS.length = base.jobs; CANDIDATES.length = base.cands; SUBMISSIONS.length = base.subs; APPROVAL_REQUESTS.length = base.appr; CUSTOM_ROLES.length = base.roles;
    window.submitOneToJob = realOne; window.createSubmission = realCreate; window.requestSubmissionReview = realReview;
    toasts = []; window.toast = function(m){ toasts.push(String(m)); };
    viewingAsFromManager = false; managerViewAsRecruiterId = null; previewAsRoleId = null; state.role = 'admin';
    SUBMISSION_POLICY.recruiterSubmissionsNeedReview = true;
    ['cx','oc','iv','cf','cs'].forEach(function(k){ const r = document.getElementById(k+'-root'); if(r) r.innerHTML = ''; }); pdSubId = null;
    prospectSelection.clear(); prospectPickerJobIds = new Set(); ts.apply = null; selectedJobIds = []; assigningCandidateId = null;
    ['submission-results-modal','intake-review-modal'].forEach(function(id){ const m = document.getElementById(id); if(m) m.remove(); });
    const sp = document.getElementById('sp-modal'); if(sp) sp.remove(); spState = null;
    document.getElementById('onboarding').classList.add('hidden');
  }
  const asAdmin = function(){ viewingAsFromManager = false; managerViewAsRecruiterId = null; previewAsRoleId = null; state.role = 'admin'; };
  const asManager = function(){ viewingAsFromManager = false; managerViewAsRecruiterId = null; previewAsRoleId = null; state.role = 'manager'; };
  const asRecruiter = function(id){ state.role = 'manager'; viewingAsFromManager = true; managerViewAsRecruiterId = id || 'RP-081'; previewAsRoleId = null; };   // Divya Menon, Recruiter role
  function mkJob(over){
    seq++;
    const j = Object.assign({ id:'sj'+seq, title:'Sub Role '+seq, client:'Fintech Corp', loc:'Pune, IN', locations:['Pune, IN'], status:'Active', priority:'Medium', recruiter:'Arjun Kapoor', recruiterId:'RP-092',
      assignedRecruiters:['RP-081','RP-092','RP-088'], skills:['Java','AWS'], expMin:4, expMax:8, positions:1, submitted:0, candidateIds:[], interested:[], recs:[], publishChannels:[], organizationId:CURRENT_ORGANIZATION_ID, workMode:'Hybrid' }, over || {});
    JOBS.push(j); return j;
  }
  function mkCand(over){
    seq++;
    const c = Object.assign({ id:nextCandidateId(), name:'Test Candidate '+seq, role:'Engineer', exp:'6 yrs', loc:'Pune', avail:'Available', availScore:70, joinProb:60, respProb:60, skills:['Java','AWS'],
      email:'c'+seq+'@example.com', phone:'+91 98765 '+String(20000+seq), salary:'18 LPA', notice:'30 days', organizationId:CURRENT_ORGANIZATION_ID }, over || {});
    CANDIDATES.push(c); return c;
  }
  const journeys = function(j, c){ return SUBMISSIONS.filter(function(s){ return s.jobId===j.id && s.candidateId===c.id; }); };
  const auditCount = function(text, since){ return AUDIT_LOG.slice(0, AUDIT_LOG.length-since).filter(function(a){ return (a.action||'').indexOf(text)>-1; }).length; };
  async function test(name, fn){
    reset();
    try { await fn(); results.push({ name:name, pass:true }); }
    catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); }
    finally { window.submitOneToJob = realOne; window.createSubmission = realCreate; window.requestSubmissionReview = realReview; window.toast = realToast; }
  }

  async function run(){
    if(typeof submitCandidatesToJob!=='function'){ results.push({ name:'Page loads with the canonical submission operation', pass:false, error:'submitCandidatesToJob is missing' }); return; }

    /* ---- A. one canonical operation ---- */
    await test('A1 Every entry point reaches the one canonical write, and nothing else creates a submission', async function(){
      asManager();
      const j = mkJob({}), calls = [];
      window.submitOneToJob = function(job, c, source, opts){ if(!(opts && opts.dryRun)) calls.push(source || '(none)'); return realOne.apply(null, arguments); };
      window.createSubmission = function(){ assert(SUBMISSION_WRITE_DEPTH>0, 'createSubmission was reached outside the canonical operation'); return realCreate.apply(null, arguments); };
      const entries = [
        ['job page picker', function(c){ openSubmitPicker(j.id); spState.picked = [c.id]; spSubmit(); }],
        ['talent search', function(c){ tsApplyOpen([c.id]); tsApplySet('jobId', j.id); tsApplySubmit(); }],
        ['directory selection', function(c){ prospectSelection.add(c.id); openAddToProspectPicker(); prospectPickerJobIds.add(j.id); submitAddToProspect(); }],
        ['profile modal', function(c){ openSubmitModal(c.id, j.id); document.getElementById('submit-email').value = 'a@b.example'; document.getElementById('submit-phone').value = '9876543210'; confirmSubmitCandidate(); }],
        ['kairo match', function(c){ addLineupMatchToJob(c.id, j.id); }],
        ['lineup add job drawer', function(c){ assigningCandidateId = c.id; selectedJobIds = [j.id]; submitAssignJobs(); }]
      ];
      entries.forEach(function(e){
        const c = mkCand({}), before = calls.length;
        e[1](c);
        assert(calls.length===before+1, e[0]+': expected one canonical call, saw '+(calls.length-before));
        eq(journeys(j, c).length, 1, e[0]+': one journey');
        ['sp-modal'].forEach(function(id){ const m = document.getElementById(id); if(m) m.remove(); });
        closeProspectPicker(); tsApplyClose(); closeSubmitModal(); closeDuplicateModal(); closeAddJobDrawerUI(); closeIntakeModal('submission-results-modal');
        const so = document.getElementById('send-modal'); if(so) so.remove();
      });
      eq(calls.length, entries.length);
      assert(!calls.some(function(s){ return s==='(none)'; }), 'every entry names its source');
    });

    await test('A2 The page source: only allowed code calls createSubmission, and no submit path writes manualLineupIds', async function(){
      const src = Array.from(document.scripts).map(function(s){ return s.textContent; }).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');   // code only, block comments removed
      const fnAt = function(idx){ const re = /\bfunction\s+([A-Za-z0-9_]+)\s*\(/g; let m, last = ''; while((m = re.exec(src)) && m.index<idx) last = m[1]; return last; };
      const owners = [], re2 = /\bcreateSubmission\(/g; let m;
      while((m = re2.exec(src))) owners.push(fnAt(m.index));
      const allowed = ['createSubmission','submitOneToJob','intakeAttach','ptCreateJoinedRecord','seedMultiJobDemo','cpLink'];   // the write itself; the canonical operation; inbound applications (Task 01); the PayTrack joining backfill (not a recruiter submission); the multi-job demo seed data
      const stray = owners.filter(function(o){ return allowed.indexOf(o)<0; });
      assert(!stray.length, 'unexpected createSubmission callers: '+stray.join(', '));
      const writers = [], re3 = /manualLineupIds\.push\(/g;
      while((m = re3.exec(src))) writers.push(fnAt(m.index));
      assert(writers.indexOf('submitAssignJobs')<0 && writers.indexOf('submitOneToJob')<0 && writers.indexOf('createProspectForCandidate')<0, 'a submission path still writes manualLineupIds: '+writers.join(', '));
    });

    /* ---- B/C/D. identity and journeys ---- */
    await test('B One candidate can be submitted to two jobs, each with its own journey', async function(){
      asManager();
      const j1 = mkJob({}), j2 = mkJob({}), c = mkCand({});
      const a = submitOneToJob(j1, c, 'Test'), b = submitOneToJob(j2, c, 'Test');
      eq(a.ok, true); eq(b.ok, true); assert(a.sub.id!==b.sub.id, 'different journeys');
      eq(submissionsForCandidate(c.id).filter(function(s){ return s.jobId===j1.id || s.jobId===j2.id; }).length, 2);
      eq(a.sub.jobId, j1.id); eq(b.sub.jobId, j2.id);
    });

    await test('C Repeating the same candidate and job never creates a second journey', async function(){
      asManager();
      const j = mkJob({}), c = mkCand({});
      eq(submitOneToJob(j, c, 'Test').ok, true);
      for(let i=0;i<5;i++){ const r = submitOneToJob(j, c, 'Test'); eq(r.ok, false); eq(r.code, 'journey_exists'); eq(r.category, 'existing'); }
      eq(journeys(j, c).length, 1);
      const bulk = submitCandidatesToJob(j.id, [c.id, c.id, c.id], {});
      eq(bulk.results.length, 1, 'the same candidate listed three times is judged once'); eq(journeys(j, c).length, 1);
      const par = await Promise.all(Array.from({ length:20 }, function(){ return Promise.resolve().then(function(){ return submitOneToJob(mkJobOnce(j), c, 'Test'); }); }));
      function mkJobOnce(x){ return x; }
      eq(par.filter(function(r){ return r.ok; }).length, 0); eq(journeys(j, c).length, 1);
      const c2 = mkCand({}), race = await Promise.all(Array.from({ length:20 }, function(){ return Promise.resolve().then(function(){ return submitOneToJob(j, c2, 'Test'); }); }));
      eq(race.filter(function(r){ return r.ok; }).length, 1, 'exactly one of 20 simultaneous attempts wrote'); eq(journeys(j, c2).length, 1);
    });

    await test('D An existing journey keeps its identity, owner, status and history, and shows who has it', async function(){
      asManager();
      const j = mkJob({}), c = mkCand({}), first = submitOneToJob(j, c, 'Test');
      const sub = first.sub; sub.stage = 'Interview Scheduled'; sub.status = 'active'; sub.recruiterId = 'RP-081';
      const snapshot = JSON.stringify({ id:sub.id, owner:sub.recruiterId, status:sub.status, stage:sub.stage, hist:sub.stageHistory.length, created:sub.createdAt });
      const r = submitOneToJob(j, c, 'Test');
      eq(r.code, 'journey_exists'); eq(r.sub, sub, 'the same object, not a copy'); assert(/Divya Menon/.test(r.reason), 'owner shown when allowed: '+r.reason);
      eq(JSON.stringify({ id:sub.id, owner:sub.recruiterId, status:sub.status, stage:sub.stage, hist:sub.stageHistory.length, created:sub.createdAt }), snapshot, 'nothing changed');
      eq(r.conflict.visible, true);
      assert(!(sub.ownerHistory || []).length, 'owner not touched');
    });

    await test('D2 A closed journey owned by someone else is not taken over by an ordinary recruiter; a manager may, with the history kept', async function(){
      asManager();
      const j = mkJob({}), c = mkCand({}), s = submitOneToJob(j, c, 'Test').sub;
      s.recruiterId = 'RP-081'; moveSubmissionStage(s.id, 'Rejected', 'Not a fit');
      asRecruiter('RP-104');   // Akash Shah, another recruiter on the job
      j.assignedRecruiters.push('RP-104');
      const blocked = submitOneToJob(j, c, 'Test');
      eq(blocked.ok, false); eq(blocked.code, 'closed_journey_owned'); eq(s.recruiterId, 'RP-081', 'owner unchanged'); eq(s.status, 'rejected');
      asManager();
      const r = submitOneToJob(j, c, 'Test');
      eq(r.ok, true); eq(r.reopened, true); eq(r.sub.id, s.id, 'same journey reopened, not replaced');
      assert((s.cycles||[]).length===1 && s.stageHistory.some(function(h){ return h.stage==='Rejected'; }), 'earlier attempt kept');
      assert(r.ownerChanged && r.ownerChanged.from==='RP-081', 'the owner change is reported, not silent'); assert((s.ownerHistory||[]).length===1);
    });

    await test('D3 More than one open journey for the same pair is refused and reported, not guessed at', async function(){
      asManager();
      const j = mkJob({}), c = mkCand({}), a = submitOneToJob(j, c, 'Test').sub;
      SUBMISSIONS.push(Object.assign({}, a, { id:'sub-dup-test' }));
      const r = submitOneToJob(j, c, 'Test');
      eq(r.code, 'journey_integrity'); eq(r.category, 'blocked');
    });

    /* ---- E/F. permission, tenant, job status ---- */
    await test('E Unauthorised, out-of-scope and not-on-the-job attempts are rejected with distinct reasons', async function(){
      const j = mkJob({}), c = mkCand({});
      CUSTOM_ROLES.push({ id:'role_t_view', name:'Viewer', permissions:{ jobs:['View'], talentpool:['View'] } });
      asAdmin(); previewAsRoleId = 'role_t_view';
      let r = submitOneToJob(j, c, 'Test'); eq(r.code, 'no_permission'); eq(r.category, 'blocked'); previewAsRoleId = null;
      asAdmin();
      const foreignJob = mkJob({ organizationId:'org-other' }); r = submitOneToJob(foreignJob, c, 'Test');
      eq(r.code, 'out_of_scope', 'another organisation’s job');
      const foreignCand = mkCand({ organizationId:'org-other' }); r = submitOneToJob(j, foreignCand, 'Test');
      eq(r.code, 'out_of_scope', 'another organisation’s candidate');
      assert(AUDIT_LOG.some(function(a){ return a.action==='Cross-scope access denied'; }), 'the consequential denial is audited');
      asRecruiter('RP-081'); const unmapped = mkJob({ recruiterId:'RP-081', assignedRecruiters:['RP-092'] }), otherTeam = mkJob({ assignedRecruiters:['RP-092'] });
      r = submitOneToJob(unmapped, c, 'Test'); eq(r.code, 'not_on_job', 'same team, not mapped'); eq(submitOneToJob(otherTeam, c, 'Test').code, 'out_of_scope', 'another team');
      eq(submitOneToJob(null, c, 'T').code, 'job_not_found'); eq(submitOneToJob(j, null, 'T').code, 'candidate_not_found');
      eq(SUBMISSIONS.filter(function(s){ return s.candidateId===c.id || s.candidateId===foreignCand.id; }).length, 0, 'nothing was written by any of them');
      // a batch with a cross-tenant candidate: the rest still go through
      asManager(); const out = submitCandidatesToJob(j.id, [c.id, foreignCand.id], {});
      eq(out.results[0].ok, true); eq(out.results[1].code, 'out_of_scope');
    });

    await test('F Closed, paused, not-live and declined jobs refuse with a clear reason; an active job accepts', async function(){
      asManager(); const c = mkCand({});
      const want = { 'Closed':'job_closed', 'Declined':'job_closed', 'On Hold':'job_paused', 'Pending Approval':'job_not_live', 'Draft':'job_not_live' };
      Object.keys(want).forEach(function(st){
        const j = mkJob({ status:st }), r = submitOneToJob(j, c, 'Test');
        eq(r.code, want[st], st); eq(r.category, 'blocked'); assert(r.reason && r.reason.length>10, st+' has a plain reason');
        eq(journeys(j, c).length, 0, st+' wrote nothing');
      });
      eq(submitOneToJob(mkJob({}), c, 'Test').ok, true);
    });

    /* ---- G/H. review policy and match score ---- */
    await test('G The review policy decides the state: recruiters go to review, direct roles do not, and it cannot be skipped', async function(){
      const j = mkJob({}), c1 = mkCand({}), c2 = mkCand({});
      asRecruiter('RP-081');
      const out = submitCandidatesToJob(j.id, [c1.id, c2.id], {});
      out.results.forEach(function(r){ eq(r.ok, true); eq(r.category, 'review_required'); eq(r.sub.stage, 'Pending Review'); eq(r.sub.status, 'in_review'); assert(r.review, 'a reviewer is named'); });
      eq(APPROVAL_REQUESTS.filter(function(a){ return a.entityType==='SubmissionReview' && a.status==='Pending' && (a.entityId===out.results[0].sub.id || a.entityId===out.results[1].sub.id); }).length, 2, 'one pending request each');
      eq(out.summary.review_required, 2);
      asManager(); const c3 = mkCand({}), m = submitOneToJob(j, c3, 'Test');
      eq(m.category, 'created'); eq(m.sub.stage, 'Ready to Send'); eq(APPROVAL_REQUESTS.filter(function(a){ return a.entityId===m.sub.id; }).length, 0, 'no review for a role that submits directly');
    });

    await test('G2 A failure while creating the review request undoes the journey, and a retry works', async function(){
      const j = mkJob({}), c = mkCand({});
      asRecruiter('RP-081');
      window.requestSubmissionReview = function(){ throw new Error('review store down'); };
      const r = submitOneToJob(j, c, 'Test');
      eq(r.ok, false); eq(r.code, 'write_failed'); eq(r.category, 'failed'); eq(journeys(j, c).length, 0, 'no half-written journey'); eq(j.candidateIds.indexOf(c.id), -1);
      window.requestSubmissionReview = realReview;
      const again = submitOneToJob(j, c, 'Test'); eq(again.ok, true); eq(journeys(j, c).length, 1);
    });

    await test('H A low match score never blocks a submission; the advice shows what is missing', async function(){
      asManager();
      const j = mkJob({ skills:['Rust','Kafka','Go'] }), c = mkCand({ skills:['Excel'], exp:'1 yrs', loc:'Chennai' });
      const ev = submissionEvidence(j, c);
      eq(ev.pct, 0); eq(ev.matching.length, 0); eq(ev.missing.join(), 'Rust,Kafka,Go');
      assert(ev.differences.some(function(d){ return /Chennai/.test(d); }), 'location difference is stated from the data');
      assert(ev.differences.some(function(d){ return /1 years/.test(d) && /4/.test(d); }), 'experience difference is stated from the data');
      const r = submitOneToJob(j, c, 'Test'); eq(r.ok, true, 'a 0% match can still be submitted');
      const full = submissionEvidence(mkJob({ skills:['Java'] }), mkCand({ skills:['java'] })); eq(full.pct, 100); eq(full.missing.length, 0);
      const incomplete = mkCand({ incomplete:true, missingFields:['Email'] });
      eq(submitOneToJob(j, incomplete, 'Test').code, 'candidate_incomplete', 'the one explicit hard rule still applies');
    });

    /* ---- I. bulk ---- */
    await test('I Bulk submission reports each candidate alone and valid ones succeed', async function(){
      asManager();
      const j = mkJob({}), good1 = mkCand({}), good2 = mkCand({}), already = mkCand({}), bad = mkCand({ incomplete:true, missingFields:['Phone'] }), foreign = mkCand({ organizationId:'org-other' });
      submitOneToJob(j, already, 'Earlier');
      const writes = SUBMISSIONS.length;
      const out = submitCandidatesToJob(j.id, [good1.id, already.id, bad.id, foreign.id, 999999, good2.id], { source:'Test' });
      eq(out.results.map(function(r){ return r.category; }).join(), 'created,existing,blocked,blocked,blocked,created');
      eq(out.results.map(function(r){ return r.code; }).join(), 'created,journey_exists,candidate_incomplete,out_of_scope,candidate_not_found,created');
      eq(out.summary.created, 2); eq(out.summary.existing, 1); eq(out.summary.blocked, 3); eq(out.summary.failed, 0);
      eq(SUBMISSIONS.length, writes+2, 'only the two valid candidates were written');
      eq(submissionRemaining(out.results).length, 3, 'blocked ones stay selected; created and existing do not');
      // a failure for one does not stop the rest
      const c1 = mkCand({}), c2 = mkCand({}), c3 = mkCand({});
      let n = 0; window.createSubmission = function(jid, cid, o){ if(++n===2) throw new Error('disk full'); return realCreate.call(null, jid, cid, o); };
      const o2 = submitCandidatesToJob(j.id, [c1.id, c2.id, c3.id], {});
      eq(o2.results.map(function(r){ return r.category; }).join(), 'created,failed,created'); eq(journeys(j, c2).length, 0);
      window.createSubmission = realCreate;
      const o3 = submitCandidatesToJob(j.id, [c1.id, c2.id, c3.id], {});
      eq(o3.results.map(function(r){ return r.category; }).join(), 'existing,created,existing', 'a retry only does what is missing');
      eq(auditCount('Bulk submission', 0)>=2, true, 'one batch audit entry per batch');
    });

    await test('I2 One audit entry per logical write, not one per screen layer', async function(){
      const j = mkJob({}), c = mkCand({});
      asRecruiter('RP-081');
      const since = AUDIT_LOG.length;
      openSubmitPicker(j.id); spState.picked = [c.id]; spSubmit();
      eq(auditCount('Candidate submitted', since), 1); eq(auditCount('Submission sent for review', since), 1);
      eq(auditCount('Bulk submission', since), 0, 'a single submission has no batch entry');
    });

    /* ---- K. screens tell the truth ---- */
    await test('K Messages and dialogs match what actually happened', async function(){
      asManager();
      const j = mkJob({}), ok = mkCand({}), dup = mkCand({}), inc = mkCand({ incomplete:true, missingFields:['Email'] });
      submitOneToJob(j, dup, 'Earlier');
      // job page picker, mixed batch: dialog with a status for each, blocked stays selected, nothing overstated
      openSubmitPicker(j.id); spState.picked = [ok.id, dup.id, inc.id]; spSubmit();
      const dlg = document.getElementById('submission-results-modal');
      assert(dlg, 'results dialog shown'); assert(/Ready to send/.test(dlg.textContent) && /Already in this job/.test(dlg.textContent) && /Blocked/.test(dlg.textContent) && /Profile incomplete/.test(dlg.textContent));
      assert(!/skipped \(already submitted\)/.test(dlg.textContent), 'no wrong "already submitted" for a blocked candidate');
      eq(spState.picked.join(), String(inc.id), 'only the blocked candidate is still selected'); assert(document.getElementById('sp-modal'), 'the picker stays open to fix it');
      assert(/Open journey/.test(dlg.textContent), 'an existing journey offers Open journey, not Submit');
      closeIntakeModal('submission-results-modal');
      // single success is a toast naming the true state
      toasts = []; const one = mkCand({}); openSubmitPicker(j.id); spState.picked = [one.id]; spSubmit();
      assert(toasts.some(function(t){ return /ready to send to Fintech Corp/.test(t); }), 'success toast: '+toasts.join(' | '));
      // recruiter: success says review, not sent
      asRecruiter('RP-081'); toasts = []; const rc = mkCand({}); openSubmitPicker(j.id); spState.picked = [rc.id]; spSubmit();
      assert(toasts.some(function(t){ return /sent to .* for review/.test(t) && !/ready to send/.test(t); }), 'review toast: '+toasts.join(' | '));
      // profile modal: no job chosen means no write and no success message
      asManager(); toasts = []; const n0 = SUBMISSIONS.length, free = mkCand({});
      openSubmitModal(free.id, ''); const sel = document.getElementById('submit-job-select');
      eq(sel.value, '', 'no job is silently preselected'); assert(/Choose a job/.test(sel.options[0].textContent));
      document.getElementById('submit-email').value = 'a@b.example'; document.getElementById('submit-phone').value = '9876543210'; confirmSubmitCandidate();
      eq(SUBMISSIONS.length, n0, 'nothing written'); assert(toasts.some(function(t){ return /Choose the job/.test(t); }), 'asks for a job'); assert(!toasts.some(function(t){ return /submitted/i.test(t); }), 'no false success');
      assert(document.getElementById('submit-modal'), 'dialog stays open');
      // choosing a job shows the evidence and the route before anything is confirmed
      sel.value = j.id; submitModalJobChanged();
      assert(/Match score \d+%/.test(document.getElementById('submit-evidence').textContent) && /does not stop you/.test(document.getElementById('submit-evidence').textContent), 'evidence shown before submitting');
      closeSubmitModal();
      // existing journey from the profile modal opens the ownership dialog, not a success
      openSubmitModal(dup.id, j.id); document.getElementById('submit-email').value = 'a@b.example'; document.getElementById('submit-phone').value = '9876543210'; toasts = []; confirmSubmitCandidate();
      assert(document.getElementById('duplicate-modal-root').textContent.indexOf('Open journey')>-1, 'existing journey offers Open journey');
      assert(!toasts.some(function(t){ return /submitted|ready to send/i.test(t); }), 'no success message for a duplicate'); closeDuplicateModal();
    });

    await test('K2 Talent search and the directory picker keep failed candidates selected and report each result', async function(){
      asManager();
      const j = mkJob({}), a = mkCand({}), bad = mkCand({ incomplete:true, missingFields:['Phone'] });
      prospectSelection.add(a.id); prospectSelection.add(bad.id);
      tsApplyOpen([a.id, bad.id]); tsApplySet('jobId', j.id); tsApplySubmit();
      eq(Array.from(prospectSelection).join(), String(bad.id), 'only the blocked candidate stays selected');
      assert(document.getElementById('submission-results-modal'), 'results shown'); assert(ts.apply && ts.apply.ids.join()===String(bad.id), 'the apply dialog keeps the blocked candidate');
      closeIntakeModal('submission-results-modal'); tsApplyClose();
      // two jobs, one paused: the other still goes through
      const open = mkJob({}), paused = mkJob({ status:'On Hold' }), c = mkCand({});
      prospectSelection.clear(); prospectSelection.add(c.id); openAddToProspectPicker();
      prospectPickerJobIds.add(open.id); prospectPickerJobIds.add(paused.id); submitAddToProspect();
      eq(journeys(open, c).length, 1); eq(journeys(paused, c).length, 0);
      const d = document.getElementById('submission-results-modal'); assert(d && /on hold/i.test(d.textContent), 'the paused job is explained');
      eq(Array.from(prospectSelection).join(), String(c.id), 'selection kept so the cause can be fixed');
    });

    await test('K3 The picker shows job context, per-candidate status and advice before anything is written', async function(){
      asManager();
      const j = mkJob({ skills:['Rust','Go'] }), strong = mkCand({ skills:['Rust','Go'] }), weak = mkCand({ skills:['Excel'] }), dup = mkCand({});
      submitOneToJob(j, dup, 'Earlier');
      prospectSelection.add(strong.id); prospectSelection.add(weak.id); prospectSelection.add(dup.id);
      openAddToProspectPicker(); prospectPickerJobIds.add(j.id);
      const html = prospectPickerSubmitBarHTML();
      assert(html.indexOf(j.title)>-1 && html.indexOf(j.client)>-1, 'the job is named'); assert(/Already in/.test(html), 'existing journey marked');
      assert(/Missing Rust, Go/.test(html), 'missing must-haves shown'); assert(/advice only/i.test(html), 'score called advice');
      assert(/Submit 2 to /.test(html), 'only the two eligible candidates are counted');
      assert(!SUBMISSIONS.some(function(s){ return s.candidateId===strong.id; }), 'previews write nothing');
      const audits = AUDIT_LOG.length; prospectPickerSubmitBarHTML(); eq(AUDIT_LOG.length, audits, 'repainting a preview logs nothing');
    });

    await test('K4 The older dialogs close with Escape, keep focus inside, and are named', async function(){
      asManager();
      const j = mkJob({}), c = mkCand({});
      const opener = document.createElement('button'); document.body.appendChild(opener); opener.focus();
      const key = function(el, k, shift){ el.dispatchEvent(new KeyboardEvent('keydown', { key:k, shiftKey:!!shift, bubbles:true, cancelable:true })); };
      openSubmitModal(c.id, j.id);
      let m = document.getElementById('submit-modal'); assert(m.contains(document.activeElement), 'focus moved in');
      eq(m.getAttribute('role'), 'dialog'); assert(m.querySelector('label[for="submit-job-select"]'), 'job select is labelled');
      const items = Array.from(m.querySelectorAll(INTAKE_FOCUSABLE)); items[items.length-1].focus(); key(items[items.length-1], 'Tab'); eq(document.activeElement, items[0], 'Tab wraps');
      const escTarget = document.activeElement; let seen = 0; m.addEventListener('keydown', function(e){ if(e.key==='Escape') seen++; });
      key(escTarget, 'Escape');
      eq(document.getElementById('submit-modal-root').innerHTML, '', 'Escape closes the submit dialog (target '+escTarget.tagName+', inside modal '+m.contains(escTarget)+', overlay saw '+seen+')');
      prospectSelection.add(c.id); openAddToProspectPicker();
      assert(document.getElementById('prospect-picker-root').contains(document.activeElement), 'picker takes focus');
      key(document.activeElement, 'Escape'); eq(document.getElementById('prospect-picker-root').innerHTML, '', 'Escape closes the picker');
      tsApplyOpen([c.id]); assert(document.getElementById('ts-apply'), 'search dialog open'); key(document.getElementById('ts-apply-q'), 'Escape'); assert(!document.getElementById('ts-apply'), 'Escape closes it');
      opener.remove();
    });

    /* ---- L. nothing else broke ---- */
    await test('L The existing screens still render and the old picker and filters still work', async function(){
      asManager();
      const j = mkJob({ skills:['Java'] }); mkCand({ skills:['Java'], name:'Findable Person' }); mkCand({ skills:['Cobol'], name:'Other Person' });
      openSubmitPicker(j.id);
      const rows = spRows(); assert(rows.length>=2, 'candidate list renders'); eq(rows[0].sc.pct>=rows[rows.length-1].sc.pct, true, 'sorted by match');
      spSet('q', 'Findable'); eq(spRows().length, 1, 'search filter still works'); spSet('q', ''); spState.mustAll = true;
      assert(spRows().every(function(r){ return r.sc.miss.length===0; }), 'must-have filter still works'); spState.mustAll = false;
      assert(typeof spShellHTML()==='string' && spPreviewHTML().length>0 && spFootHTML().length>0, 'picker parts render');
      closeSubmitPicker();
      document.getElementById('app').classList.remove('hidden');
      openJob(j.id); assert(document.getElementById('main-content').innerHTML.length>1000, 'job detail renders');
      assert(typeof jobWsApplicantsHTML(j)==='string'); assert(typeof submitModalHTML==='function');
      showView('talent-pool'); assert(document.getElementById('main-content').innerHTML.length>500, 'talent pool renders');
      document.getElementById('app').classList.add('hidden');
    });
  }

  window.addEventListener('load', function(){
    setTimeout(function(){
      run().catch(function(e){ results.push({ name:'Runner', pass:false, error:String(e && e.stack || e) }); }).then(function(){
        const failed = results.filter(function(r){ return !r.pass; }).length;
        const pre = document.createElement('pre');
        pre.id = 'auth-test-results';
        pre.textContent = JSON.stringify(results);
        document.body.appendChild(pre);
        document.title = 'SUBMISSION-TESTS '+(results.length-failed)+'/'+results.length;
      });
    }, 50);
  });
})();

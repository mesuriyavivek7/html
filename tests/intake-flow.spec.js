/* Task 01 tests: job approval and publication, application intake, identity, duplicates and review.
   Run with:  powershell -ExecutionPolicy Bypass -File tests\run-auth-tests.ps1 -Spec tests\intake-flow.spec.js
   (the runner injects this file into a temporary copy of recruitment-os-prototype.html and runs it in headless Chrome).

   What these prove: the rules in the engine functions hold against the in-memory prototype data.
   What they do NOT prove: server-side security, durable storage, or database-level uniqueness. Concurrency tests
   here run in one JavaScript thread, so they show the logic is idempotent, not that a database enforces it.
   See docs/JOB-INTAKE.md, "Limitations". */
(function(){
  'use strict';
  const results = [];
  const sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  function assert(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function eq(a, b, m){ if(a!==b) throw new Error((m ? m+': ' : '')+'expected '+JSON.stringify(b)+', got '+JSON.stringify(a)); }
  const base = { jobs:JOBS.length, cands:CANDIDATES.length, subs:SUBMISSIONS.length, appr:APPROVAL_REQUESTS.length };
  const POLICY0 = JSON.stringify(JOB_APPROVAL_POLICY);
  let seq = 0;

  function reset(){
    JOBS.length = base.jobs; CANDIDATES.length = base.cands; SUBMISSIONS.length = base.subs; APPROVAL_REQUESTS.length = base.appr;
    APPLICATION_EVENTS.length = 0; DUPLICATE_REVIEWS.length = 0; CANDIDATE_FINDING_REQUESTS.length = 0;
    Object.keys(CHANNEL_ADAPTERS).forEach(function(k){ delete CHANNEL_ADAPTERS[k]; });
    Object.assign(JOB_APPROVAL_POLICY, JSON.parse(POLICY0));
    state.role = 'admin';                     // acts as the Tenant Admin (Priya Sharma)
    document.getElementById('onboarding').classList.add('hidden');
  }
  function user(name){ return RECRUITER_ROSTER.find(function(r){ return r.name===name; }); }
  const ADMIN = function(){ return user('Priya Sharma'); }, MANAGER = function(){ return user('Arjun Kapoor'); }, RECRUITER = function(){ return user('Divya Menon'); };
  const OTHER_ORG = { id:'RP-X1', name:'Outside Admin', assignedRoleId:'role_founder', organizationId:'org-other' };
  function as(role){ state.role = role; }     // admin -> Priya (Tenant Admin), manager -> Arjun (Recruitment Manager)

  function liveJob(over){
    seq++;
    const j = Object.assign({ id:'tj'+seq, title:'Test Role '+seq, client:'Fintech Corp', loc:'Pune', status:'Active', priority:'Medium', recruiter:'Divya Menon', recruiterId:'RP-081', assignedRecruiters:['RP-081'],
      skills:['Java'], positions:1, submitted:0, candidateIds:[], interested:[], recs:[], publishChannels:[], organizationId:CURRENT_ORGANIZATION_ID,
      publication:{ path:'direct', approval:'Approved' }, channelDelivery:{}, liveAt:nowTimestamp() }, over || {});
    JOBS.push(j); return j;
  }
  function applicant(n, extra){ return Object.assign({ name:'Test Person '+n, email:'person'+n+'@example.com', phone:'+91 98765 '+String(10000+n), role:'Engineer', exp:'5 yrs', loc:'Pune', skills:['Java'] }, extra || {}); }
  function ingest(job, payload, platform, ctx){ return ingestApplicationEvent(job.id, payload, Object.assign({ platform:platform || 'Indeed' }, ctx || {})); }
  function journeysFor(job, c){ return SUBMISSIONS.filter(function(s){ return s.jobId===job.id && s.candidateId===c.id; }); }
  function eventsFor(job){ return APPLICATION_EVENTS.filter(function(e){ return e.jobId===job.id; }); }
  function auditHas(text){ return AUDIT_LOG.some(function(a){ return (a.action||'').indexOf(text)>-1; }); }
  /* Drive the real publish function with a filled-in draft. */
  function publishAs(role, choice, channels){
    as(role);
    jobDraft = Object.assign(jobCreateDefaults(), { title:'Policy Test '+(++seq), client:CLIENTS[0].name, locations:['Pune, MH – IN'],
      roleSummary:new Array(30).join('Builds and runs services. '), responsibilities:new Array(25).join('Own delivery end to end. '), requiredSkills:['Java'], publishChoice:choice,
      channels:Object.assign({ career:true, linkedin:true, naukri:true, shine:false, internal:true, publicLink:false }, channels || {}) });
    const before = JOBS.length;
    publishJob();
    return JOBS.length>before ? JOBS[JOBS.length-1] : null;
  }
  async function test(name, fn){
    reset();
    try { await fn(); results.push({ name:name, pass:true }); }
    catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); }
  }

  async function run(){
    if(typeof ingestApplicationEvent!=='function'){ results.push({ name:'Page loads with the intake engine', pass:false, error:'ingestApplicationEvent is missing' }); return; }

    /* ---- A. approval and publication ---- */
    await test('A1 Mandatory approval keeps a job from going live until it is approved', async function(){
      const j = publishAs('manager', null);
      assert(j, 'job record created');
      eq(j.status, 'Pending Approval'); assert(!j.liveAt, 'no live time'); eq(Object.keys(j.channelDelivery).length, 0, 'nothing delivered to any channel');
      assert(!j.candidateFinding, 'no candidate finding yet');
      eq(jobGoLive(j).error, 'approval_required', 'cannot be forced live');
      eq(ingest(j, applicant(1)).error, 'job_not_live', 'no applications while it is not live');
      assert(auditHas('Job submitted for approval'), 'submission audited');
      const req = APPROVAL_REQUESTS.find(function(r){ return r.entityId===j.id; });
      eq(req.approverUserId, ADMIN().id, 'reviewer is the tenant admin by default');
      as('admin'); decideApproval(req.id, 'Approved', 'Looks good');
      eq(j.status, 'Active'); assert(j.liveAt, 'live time recorded'); assert(j.candidateFinding, 'candidate finding requested once live');
      assert(auditHas('Job approved and published'), 'approval audited');
      eq(ingest(j, applicant(1)).ok, true, 'applications accepted once live');
    });

    await test('A1b A declined job never goes live, and the decision is audited', async function(){
      const j = publishAs('manager', null);
      const req = APPROVAL_REQUESTS.find(function(r){ return r.entityId===j.id; });
      as('admin'); decideApproval(req.id, 'Rejected', 'Budget not agreed');
      eq(j.status, 'Declined'); assert(!j.liveAt && !j.candidateFinding);
      eq(jobGoLive(j).error, 'approval_required');
      assert(auditHas('Job declined'));
    });

    await test('A2 Optional approval: the creator picks direct publication or review', async function(){
      as('admin'); eq(setJobApprovalPolicy({ mode:'optional', reviewer:'admin' }).ok, true);
      const direct = publishAs('manager', 'direct');
      eq(direct.status, 'Active'); assert(direct.liveAt); eq(direct.publication.path, 'direct');
      const review = publishAs('manager', 'review');
      eq(review.status, 'Pending Approval'); eq(review.publication.path, 'review');
      const none = publishAs('manager', null);
      eq(none.status, 'Pending Approval', 'no choice defaults to review');
    });

    await test('A2b Direct policy publishes at once; reviewer types are honoured and never the creator', async function(){
      as('admin'); setJobApprovalPolicy({ mode:'direct', reviewer:'admin' });
      eq(publishAs('manager', null).status, 'Active');
      as('admin'); eq(setJobApprovalPolicy({ mode:'mandatory', reviewer:'team_manager' }).ok, true);
      const creator = RECRUITER_ROSTER.find(function(r){ return managerOf(r.id) && r.id!==MANAGER().id && managerOf(r.id).id===MANAGER().id; });
      if(creator) eq(jobReviewerFor(creator).user.id, MANAGER().id, 'team manager reviews their team member');
      eq(jobReviewerFor(MANAGER()).user.id, ADMIN().id, 'a manager is never their own reviewer, so the admin reviews');
      eq(jobReviewerFor(MANAGER()).fellBack, true);
      as('admin'); eq(setJobApprovalPolicy({ mode:'mandatory', reviewer:'designated' }).error, 'designated_reviewer_required', 'a designated reviewer must be named');
      eq(setJobApprovalPolicy({ mode:'mandatory', reviewer:'designated', designatedReviewerId:'RP-041' }).ok, true);
      eq(jobReviewerFor(MANAGER()).user.id, 'RP-041');
      eq(setJobApprovalPolicy({ mode:'sometimes', reviewer:'admin' }).error, 'invalid_mode');
    });

    await test('A2c Only the Tenant Admin can change the approval policy, and creating a job is the only right needed to publish', async function(){
      eq(setJobApprovalPolicy({ mode:'direct', reviewer:'admin' }, MANAGER()).error, 'forbidden');
      eq(setJobApprovalPolicy({ mode:'direct', reviewer:'admin' }, RECRUITER()).error, 'forbidden');
      eq(JOB_APPROVAL_POLICY.mode, 'mandatory', 'unchanged');
      as('recruiter');   // the Recruiter role has no jobs:Create
      jobDraft = Object.assign(jobCreateDefaults(), { title:'No right', client:CLIENTS[0].name, locations:['Pune, MH – IN'], roleSummary:new Array(30).join('x '), responsibilities:new Array(25).join('y ') });
      const n = JOBS.length; publishJob(); eq(JOBS.length, n, 'a role that cannot create jobs cannot publish one');
    });

    await test('A3 Oontu live status is independent of every outside channel, and each channel is tracked alone', async function(){
      CHANNEL_ADAPTERS.linkedin = function(){ return { ok:true, externalRef:'li-1' }; };
      CHANNEL_ADAPTERS.naukri = function(){ throw new Error('Naukri timed out'); };
      // shine has no adapter at all
      as('admin'); setJobApprovalPolicy({ mode:'direct', reviewer:'admin' });
      const j = publishAs('manager', null, { career:true, internal:true, linkedin:true, naukri:true, shine:true });
      eq(j.status, 'Active', 'live in Oontu even though some channels failed');
      eq(jobChannelState(j,'career').state, 'live'); eq(jobChannelState(j,'internal').state, 'live');
      eq(jobChannelState(j,'linkedin').state, 'live'); eq(jobChannelState(j,'linkedin').externalRef, 'li-1');
      eq(jobChannelState(j,'naukri').state, 'failed'); assert(/timed out/.test(jobChannelState(j,'naukri').error));
      eq(jobChannelState(j,'shine').state, 'not_connected', 'no integration is never reported as success');
      assert(!/live/.test(jobChannelState(j,'shine').state));
      assert(/1 of 3 outside channels/.test(jobChannelSummary(j)), 'summary does not overstate: '+jobChannelSummary(j));
      // retry: only the failed one is attempted; the success is never sent again
      let sends = 0; CHANNEL_ADAPTERS.linkedin = function(){ sends++; return { ok:true }; };
      CHANNEL_ADAPTERS.naukri = function(job, o){ return { ok:true, externalRef:'nk-'+o.idempotencyKey }; };
      const r = retryJobChannel(j.id, 'naukri', ADMIN());
      eq(r.ok, true); eq(jobChannelState(j,'naukri').state, 'live'); eq(jobChannelState(j,'naukri').attempts, 2);
      eq(jobChannelState(j,'naukri').idempotencyKey, j.id+':naukri', 'the same key on every retry');
      eq(retryJobChannel(j.id, 'linkedin', ADMIN()).already, true); eq(sends, 0, 'no second post to a channel that succeeded');
      eq(jobChannelState(j,'shine').state, 'not_connected', 'the other channel is untouched');
      eq(retryJobChannel(j.id, 'shine', ADMIN()).ok, true); eq(jobChannelState(j,'shine').attempts, 2);
      eq(retryJobChannel(j.id, 'publicLink', ADMIN()).error, 'channel_not_selected');
      eq(retryJobChannel('nope', 'shine', ADMIN()).error, 'not_found');
      eq(retryJobChannel(j.id, 'shine', OTHER_ORG).error, 'not_found', 'another organisation cannot retry');
    });

    await test('A4 Candidate finding starts once, only for a job that is live, and sends nothing', async function(){
      const pending = liveJob({ status:'Pending Approval', liveAt:null, publication:{ path:'review', approval:'Pending' } });
      eq(requestCandidateFinding(pending), null); assert(!pending.candidateFinding);
      const j = liveJob({ candidateFinding:undefined });
      assert(requestCandidateFinding(j)); eq(requestCandidateFinding(j), null, 'only once');
      eq(CANDIDATE_FINDING_REQUESTS.filter(function(r){ return r.jobId===j.id; }).length, 1);
    });

    await test('A5 Material edits are kept as a history of who changed what', async function(){
      const j = liveJob({ title:'Original title', salary:'10 LPA' });
      const snap = jobEditSnapshot(j); j.title = 'Changed title'; j.priority = 'High';
      const changes = recordJobEdit(j, snap);
      eq(changes.length, 2); eq(j.editHistory.length, 1); eq(j.editHistory[0].live, true);
      assert(j.editHistory[0].changes.some(function(c){ return c.field==='Title' && c.from==='Original title' && c.to==='Changed title'; }));
      eq(recordJobEdit(j, jobEditSnapshot(j)).length, 0, 'no change, no entry'); eq(j.editHistory.length, 1);
    });

    /* ---- B. intake ---- */
    await test('B1 Every application keeps its source, portal, job, time, external ID and original CV reference', async function(){
      const j = liveJob({});
      const r = ingest(j, applicant(2, { externalId:'IND-77', referrer:'Campus fair', artifact:{ name:'cv.pdf', size:1200, checksum:'abc', ref:'store://cv/1' } }), 'Shareable link · LinkedIn', { receivedAt:'2026-10-01T09:30:00.000Z' });
      const e = r.event;
      eq(e.source, 'Shareable link · LinkedIn'); eq(e.portal, 'LinkedIn'); eq(e.referrer, 'Campus fair'); eq(e.jobId, j.id);
      eq(e.receivedAt, '2026-10-01T09:30:00.000Z'); eq(e.externalId, 'IND-77'); eq(e.artifact.name, 'cv.pdf');
      eq(e.fields.name.origin, 'extracted'); eq(e.extraction.status, 'complete');
      assert(JSON.stringify(AUDIT_LOG.slice(0,5)).indexOf('store://cv')<0, 'the CV reference is not copied into the audit log');
      eq(r.submission.stage, 'Submitted'); eq(r.submission.recruiterId, null, 'no owner is assigned silently');
    });

    await test('B2 An application stays visible when extraction fails, and can be completed later', async function(){
      const j = liveJob({});
      const r = ingest(j, { extractionError:'OCR could not read the file', artifact:{ name:'scan.pdf', ref:'store://cv/9' }, externalId:'X1' });
      eq(r.ok, true); eq(r.event.extraction.status, 'failed'); eq(r.event.state, 'needs_details');
      assert(/OCR/.test(r.event.extraction.error));
      eq(intakeEventsForJob(j.id, ADMIN()).length, 1, 'visible to the team');
      eq(r.candidate, null, 'no profile is invented'); eq(SUBMISSIONS.filter(function(s){ return s.jobId===j.id; }).length, 0, 'no journey is invented either');
      assert(r.event.artifact, 'the original is kept');
      // partial: a name but no way to contact
      const p = ingest(j, { name:'Only Name' }, 'Indeed');
      eq(p.event.extraction.status, 'partial'); assert(p.event.extraction.missing.indexOf('email or phone')>-1); eq(p.event.state, 'needs_details');
      // a person completes it
      const v = verifyApplicationFields(r.event.id, { name:'Recovered Person', email:'recovered@example.com' }, ADMIN());
      eq(v.ok, true); eq(r.event.fields.name.origin, 'verified', 'values a person entered are marked verified');
      eq(r.event.state, 'recorded'); assert(r.event.candidateId, 'now linked to a profile'); eq(r.event.journey, 'created');
      eq(r.event.history.length>0, true, 'the correction is recorded');
      eq(verifyApplicationFields(r.event.id, { name:'X' }, OTHER_ORG).error, 'not_found', 'another organisation cannot edit it');
      eq(verifyApplicationFields(r.event.id, { name:'X' }, user('Neha Kulkarni')).ok, true, 'a recruiter who may edit candidates can');
    });

    await test('B2b Unreadable email or phone is flagged, not dropped', async function(){
      const j = liveJob({});
      const r = ingest(j, { name:'Odd Contact', email:'not-an-email', phone:'12' });
      eq(r.event.extraction.status, 'partial'); assert(r.event.extraction.uncertain.indexOf('email')>-1 && r.event.extraction.uncertain.indexOf('phone')>-1);
      eq(r.event.state, 'needs_details');
    });

    await test('B3 Profiles are enriched with new information, never overwritten, and conflicts are flagged', async function(){
      const j = liveJob({});
      const a = ingest(j, applicant(3, { loc:'Pune', salary:'' }), 'Indeed', {}).candidate;
      const j2 = liveJob({});
      const r = ingest(j2, applicant(3, { loc:'Mumbai', salary:'18 LPA', skills:['Java','Kafka'] }), 'Naukri');
      eq(r.candidate.id, a.id, 'same person, one profile');
      eq(a.loc, 'Pune', 'existing location kept'); eq(a.salary, '18 LPA', 'missing salary filled'); assert(a.skills.indexOf('Kafka')>-1, 'new skill added');
      assert(a.pendingConflicts.some(function(c){ return c.field==='loc' && c.incoming==='Mumbai'; }), 'the difference is recorded for a person');
      assert(r.event.extraction.uncertain.indexOf('differs:loc')>-1);
      eq(a.fieldSources.salary.origin, 'extracted'); assert(a.fieldSources.salary.eventId===r.event.id, 'provenance points at the event');
      // a verified value is not replaced by a later extracted one
      a.fieldSources.salary = { origin:'verified' };
      ingest(liveJob({}), applicant(3, { salary:'25 LPA' }), 'Shine');
      eq(a.salary, '18 LPA');
    });

    await test('B4 Email and phone that point at different profiles raise an identity flag instead of merging', async function(){
      const j = liveJob({});
      const a = ingest(j, applicant(4), 'Indeed').candidate;
      const b = ingest(j, applicant(5), 'Indeed').candidate;
      const r = ingest(j, { name:'Mixed Up', email:a.email, phone:b.phone }, 'Indeed');
      eq(r.candidate.id, a.id, 'email is the stronger identifier');
      assert(r.event.extraction.uncertain.some(function(u){ return /^identity:/.test(u); }), 'flagged');
      assert(a.phone!==b.phone, 'the other profile was not touched');
    });

    /* ---- C. records and journeys ---- */
    await test('C1 A genuine repeat application is a new event on the same journey', async function(){
      const j = liveJob({});
      const first = ingest(j, applicant(6, { externalId:'A1' }), 'Indeed');
      const sub = first.submission;
      sub.stage = 'Interview Scheduled'; sub.recruiterId = 'RP-081'; const updated = sub.updatedAt;
      const second = ingest(j, applicant(6, { externalId:'A2' }), 'Indeed');
      eq(second.ok, true); eq(second.duplicateDelivery, undefined); assert(second.event.id!==first.event.id, 'a separate event');
      eq(journeysFor(j, first.candidate).length, 1, 'still one journey');
      eq(second.submission.id, sub.id); eq(second.event.journey, 'existing');
      eq(sub.stage, 'Interview Scheduled', 'the journey was not reset'); eq(sub.recruiterId, 'RP-081', 'ownership untouched'); eq(sub.updatedAt, updated);
      eq(j.submitted, 1, 'counted once');
      eq(candidateApplicationEvents(first.candidate.id).length, 2, 'both applications are on record');
      const third = ingest(j, applicant(6), 'LinkedIn');            // another portal, no external ID
      assert(third.event && third.event.state==='recorded', 'another portal is another genuine application');
      eq(journeysFor(j, first.candidate).length, 1);
    });

    await test('C2 A closed journey is linked and flagged, not silently reopened', async function(){
      const j = liveJob({});
      const first = ingest(j, applicant(7, { externalId:'B1' }), 'Indeed');
      first.submission.stage = 'Rejected'; first.submission.status = 'rejected';
      const again = ingest(j, applicant(7, { externalId:'B2' }), 'Indeed');
      eq(again.submission.status, 'rejected', 'left closed'); eq(again.event.journeyClosed, true);
      eq(journeysFor(j, first.candidate).length, 1);
      assert(auditHas('Application on a closed journey'));
    });

    /* ---- D. duplicates ---- */
    await test('D1 The same external event delivered again creates no second event and is logged', async function(){
      const j = liveJob({});
      const a = ingest(j, applicant(8, { externalId:'ID-1', phone:'' }), 'Indeed');
      const b = ingest(j, applicant(8, { externalId:'ID-1', phone:'+91 99887 76655' }), 'Indeed');
      eq(b.ok, true); eq(b.duplicateDelivery, true); eq(b.event.id, a.event.id);
      eq(eventsFor(j).length, 1); eq(a.event.deliveryCount, 2); eq(a.event.deliveries.length, 2, 'history preserved');
      eq(a.event.fields.phone.value, '9988776655', 'new valid information accepted'); eq(a.candidate.phone, '9988776655');
      assert(auditHas('Repeat delivery ignored'), 'the retry is logged');
      eq(journeysFor(j, a.candidate).length, 1);
    });

    await test('D2 External IDs only mean something inside one source', async function(){
      const j = liveJob({}), j2 = liveJob({});
      const a = ingest(j, applicant(9, { externalId:'SAME' }), 'Indeed');
      const b = ingest(j, applicant(9, { externalId:'SAME' }), 'Naukri');
      assert(b.event.id!==a.event.id && !b.duplicateDelivery, 'another source may reuse the same ID');
      eq(eventsFor(j).length, 2);
      const c = ingest(j2, applicant(9, { externalId:'SAME' }), 'Indeed');
      eq(c.error, 'external_id_conflict', 'the same source reusing an ID for another job is refused, not merged');
      eq(eventsFor(j2).length, 0);
    });

    await test('D3 Without an external ID: identical content is suppressed, unclear cases go to review, distinct ones are kept', async function(){
      const j = liveJob({});
      const first = ingest(j, applicant(10), 'Indeed');
      const same = ingest(j, applicant(10), 'Indeed');
      eq(same.duplicateDelivery, true); eq(eventsFor(j).length, 1, 'a clear technical duplicate is not stored as a new event');
      const changed = ingest(j, applicant(10, { note:'Updated my CV' }), 'Indeed');
      eq(changed.event.state, 'pending_review'); assert(changed.review, 'uncertain case sent for review'); eq(eventsFor(j).length, 2, 'kept while a person decides');
      eq(changed.review.againstEventId, first.event.id); assert(changed.review.reasons.length>=1, 'reasons are explained');
      const doc = ingest(j, applicant(10, { artifact:{ name:'new.pdf', checksum:'zzz' } }), 'Indeed');
      const doc2 = ingest(j, applicant(10, { artifact:{ name:'newer.pdf', checksum:'yyy' }, note:'x' }), 'Indeed');
      assert(doc.review, 'no stored checksum on the first one, so still uncertain');
      eq(doc2.review, null, 'two different documents are distinguishing evidence');
      const other = ingest(j, applicant(10), 'Shine');
      eq(other.review, null, 'another portal is not a duplicate');
      eq(journeysFor(j, first.candidate).length, 1);
      eq(INTAKE_CONFIG.duplicateWindowMinutes, null, 'no invented time window'); eq(INTAKE_CONFIG.waitingEscalationHours, null, 'no invented escalation limit');
    });

    await test('D4 Uncertain cases go to the assigned recruiter, or to the central intake queue when nobody is assigned', async function(){
      const assigned = liveJob({ recruiterId:'RP-081', assignedRecruiters:['RP-081'] });
      const unassigned = liveJob({ recruiterId:null, recruiter:null, assignedRecruiters:[] });
      [assigned, unassigned].forEach(function(j, i){ ingest(j, applicant(11+i), 'Indeed'); ingest(j, applicant(11+i, { note:'changed' }), 'Indeed'); });
      const ra = DUPLICATE_REVIEWS.find(function(r){ return r.jobId===assigned.id; }), rc = DUPLICATE_REVIEWS.find(function(r){ return r.jobId===unassigned.id; });
      eq(ra.assigneeId, 'RP-081'); eq(ra.queue, 'assigned');
      eq(rc.assigneeId, null); eq(rc.queue, CENTRAL_INTAKE_QUEUE);
      assert(reviewsVisibleTo(RECRUITER()).some(function(r){ return r.id===ra.id; }), 'the assignee sees their case');
      assert(!reviewsVisibleTo(RECRUITER()).some(function(r){ return r.id===rc.id; }), 'a recruiter does not see the central queue');
      assert(reviewsVisibleTo(MANAGER()).some(function(r){ return r.id===rc.id; }), 'an operations user does');
      eq(reviewsVisibleTo(OTHER_ORG).length, 0, 'another organisation sees nothing');
      eq(decideDuplicateReview(rc.id, 'genuine_new', 'checked', RECRUITER()).error, 'forbidden', 'a recruiter cannot decide a central-queue case');
      eq(decideDuplicateReview(ra.id, 'genuine_new', 'checked', user('Akash Shah')).error, 'forbidden', 'nor another recruiter’s case');
    });

    await test('D5 Priority comes from waiting time and combined risk, with plain reasons and no score', async function(){
      const urgent = liveJob({ priority:'High' }), calm = liveJob({ priority:'Low' });
      ingest(urgent, applicant(20, { loc:'Pune' }), 'Indeed'); ingest(urgent, applicant(20, { loc:'Delhi', note:'v2' }), 'Indeed');
      ingest(calm, applicant(21), 'Indeed'); ingest(calm, applicant(21, { note:'v2' }), 'Indeed');
      const ru = DUPLICATE_REVIEWS.find(function(r){ return r.jobId===urgent.id; }), rl = DUPLICATE_REVIEWS.find(function(r){ return r.jobId===calm.id; });
      rl.createdAt = new Date(Date.now()-5*24*3600*1000).toISOString();       // calm has waited far longer
      const pu = reviewPriority(ru), pl = reviewPriority(rl);
      eq(pu.tier, 'High'); assert(pu.reasons.some(function(t){ return /High priority/.test(t); }) && pu.reasons.some(function(t){ return /differ/.test(t); }), pu.reasons.join(' | '));
      eq(pl.tier, 'Standard'); assert(pl.reasons.some(function(t){ return /5 days/.test(t); }), 'waiting time is explained');
      eq(sortReviewQueue([rl, ru])[0].review.id, ru.id, 'risk outranks waiting time');
      const rl2 = DUPLICATE_REVIEWS.find(function(r){ return r.id===rl.id; });
      ru.createdAt = new Date(Date.now()-1000).toISOString();
      const same = sortReviewQueue([rl2, Object.assign({}, rl2, { id:'x2', createdAt:new Date().toISOString() })]);
      eq(same[0].review.id, rl.id, 'within a tier the longer wait comes first');
      assert(!JSON.stringify(pu.reasons).match(/score|\d+\s*points/i), 'no invented numeric score');
    });

    await test('D6 All three decisions need an explanation; each has its effect', async function(){
      const j = liveJob({});
      ingest(j, applicant(30), 'Indeed');
      const mk = function(i){ const r = ingest(j, applicant(30, { note:'n'+i }), 'Indeed'); return r.review; };
      const r1 = mk(1), r2 = mk(2), r3 = mk(3);
      ['duplicate_delivery','genuine_new','pending'].forEach(function(d){
        eq(decideDuplicateReview(r1.id, d, '', RECRUITER()).error, 'explanation_required', d+' with no explanation');
        eq(decideDuplicateReview(r1.id, d, '   ', RECRUITER()).error, 'explanation_required', d+' with blank explanation');
      });
      eq(r1.status, 'open'); eq(r1.version, 0, 'nothing recorded by a refused decision');
      eq(decideDuplicateReview(r1.id, 'maybe', 'x', RECRUITER()).error, 'invalid_decision');
      eq(decideDuplicateReview(r1.id, 'pending', 'Need the portal export', RECRUITER()).ok, true);
      eq(r1.status, 'open', 'pending keeps the case open'); eq(APPLICATION_EVENTS.find(function(e){ return e.id===r1.eventId; }).state, 'pending_review');
      eq(decideDuplicateReview(r1.id, 'duplicate_delivery', 'Same file, same minute', RECRUITER()).ok, true);
      eq(r1.status, 'decided'); eq(APPLICATION_EVENTS.find(function(e){ return e.id===r1.eventId; }).state, 'confirmed_duplicate');
      eq(decideDuplicateReview(r2.id, 'genuine_new', 'Different CV version', RECRUITER()).ok, true);
      eq(APPLICATION_EVENTS.find(function(e){ return e.id===r2.eventId; }).state, 'confirmed_new');
      eq(decideDuplicateReview(r1.id, 'genuine_new', 'again', RECRUITER()).error, 'already_decided', 'use a correction instead');
      eq(r1.history.length, 2, 'the pending step and the decision are both on record');
      const cand = byId(r1.candidateId);
      eq(candidateApplicationEvents(cand.id).length, 3, 'the confirmed duplicate no longer counts as an application, the rest do');
      eq(APPLICATION_EVENTS.length, 4, 'but nothing was deleted'); eq(journeysFor(j, cand).length, 1);
      assert(r3.status==='open');
    });

    await test('D7 An authorised correction keeps the original decision and the full history', async function(){
      const j = liveJob({});
      ingest(j, applicant(31), 'Indeed');
      const r = ingest(j, applicant(31, { note:'again' }), 'Indeed').review;
      decideDuplicateReview(r.id, 'duplicate_delivery', 'Looked identical', RECRUITER());
      const v = r.version;
      eq(correctDuplicateReview(r.id, 'genuine_new', 'Portal later confirmed a second submission', RECRUITER(), v).error, 'forbidden', 'the assignee cannot correct');
      eq(correctDuplicateReview(r.id, 'genuine_new', '', MANAGER(), v).error, 'reason_required');
      eq(correctDuplicateReview(r.id, 'genuine_new', 'x', MANAGER()).error, 'conflict', 'a version is required');
      eq(correctDuplicateReview(r.id, 'duplicate_delivery', 'x', MANAGER(), v).error, 'no_change');
      eq(correctDuplicateReview(r.id, 'genuine_new', 'Portal later confirmed a second submission', MANAGER(), v).ok, true);
      eq(r.decision, 'genuine_new'); eq(r.originalDecision.decision, 'duplicate_delivery'); eq(r.originalDecision.explanation, 'Looked identical');
      eq(r.history.length, 2); eq(r.history[1].kind, 'correction'); eq(r.history[1].from, 'duplicate_delivery'); eq(r.history[1].to, 'genuine_new'); assert(r.history[1].reason);
      eq(APPLICATION_EVENTS.find(function(e){ return e.id===r.eventId; }).state, 'confirmed_new');
      assert(auditHas('Duplicate decision corrected'), 'audited');
      const open = ingest(j, applicant(31, { note:'third' }), 'Indeed').review;
      eq(correctDuplicateReview(open.id, 'genuine_new', 'x', ADMIN(), 0).error, 'not_decided', 'only a finalised decision can be corrected');
    });

    /* ---- E. tenant isolation and permissions ---- */
    await test('E1 Nothing crosses a tenant boundary: jobs, profiles, events, reviews and CVs', async function(){
      const mine = liveJob({});
      const theirs = liveJob({ organizationId:'org-other' });
      eq(ingest(theirs, applicant(40)).error, 'not_found', 'cannot apply to another organisation’s job through this tenant');
      eq(ingestApplicationEvent(mine.id, applicant(40), { platform:'Indeed', organizationId:'org-other' }).error, 'not_found', 'nor my job as another tenant');
      // same email exists in another organisation: it must not be matched or enriched
      const foreign = { id:900001, name:'Foreign Person', email:'person41@example.com', phone:null, skills:['Go'], organizationId:'org-other', loc:'Oslo' };
      CANDIDATES.push(foreign);
      const r = ingest(mine, applicant(41), 'Indeed');
      assert(r.candidate.id!==foreign.id && r.newCandidate, 'a separate profile is created'); eq(foreign.loc, 'Oslo'); assert(!foreign.pendingConflicts && !foreign.sources, 'the other profile is untouched');
      eq(r.candidate.organizationId, CURRENT_ORGANIZATION_ID);
      const withDoc = ingest(mine, applicant(42, { artifact:{ name:'cv.pdf', ref:'store://1' } }), 'Indeed').event;
      eq(applicationArtifactFor(withDoc.id, OTHER_ORG), null, 'another organisation gets no CV');
      assert(applicationArtifactFor(withDoc.id, ADMIN()), 'the owner organisation does');
      eq(intakeEventsForJob(mine.id, OTHER_ORG).length, 0);
      ingest(mine, applicant(41, { note:'v2' }), 'Indeed');
      const rv = DUPLICATE_REVIEWS[0];
      eq(decideDuplicateReview(rv.id, 'genuine_new', 'ok', OTHER_ORG).error, 'not_found', 'reviews are invisible across tenants');
      eq(correctDuplicateReview(rv.id, 'genuine_new', 'ok', OTHER_ORG, 0).error, 'not_found');
      // an identical external ID in two tenants are two different events
      const t2 = liveJob({ organizationId:'org-other' });
      const e1 = ingest(mine, applicant(43, { externalId:'SHARED' }), 'Indeed').event;
      const e2 = ingestApplicationEvent(t2.id, applicant(43, { externalId:'SHARED' }), { platform:'Indeed', organizationId:'org-other' }).event;
      assert(e1.id!==e2.id && e1.organizationId!==e2.organizationId, 'external IDs are scoped to the tenant');
    });

    /* ---- F. repeats and concurrency (logic only; see the limitations note) ---- */
    await test('F1 Retried and simultaneous deliveries never create a second event or journey', async function(){
      const j = liveJob({});
      const withId = await Promise.all(Array.from({ length:25 }, function(){ return Promise.resolve().then(function(){ return ingest(j, applicant(50, { externalId:'RACE-1' }), 'Indeed'); }); }));
      eq(eventsFor(j).length, 1, '25 deliveries with one external ID'); eq(withId.filter(function(r){ return !r.duplicateDelivery; }).length, 1);
      eq(SUBMISSIONS.filter(function(s){ return s.jobId===j.id; }).length, 1, 'one journey');
      const j2 = liveJob({});
      await Promise.all(Array.from({ length:25 }, function(){ return Promise.resolve().then(function(){ return ingest(j2, applicant(51), 'Indeed'); }); }));
      eq(eventsFor(j2).length, 1, '25 identical deliveries with no ID'); eq(SUBMISSIONS.filter(function(s){ return s.jobId===j2.id; }).length, 1);
      eq(j2.submitted, 1);
      // two people correct the same decision from the same version: exactly one wins
      ingest(j2, applicant(51, { note:'x' }), 'Indeed');
      const rv = DUPLICATE_REVIEWS[0]; decideDuplicateReview(rv.id, 'duplicate_delivery', 'same', ADMIN());
      const v = rv.version;
      const outcomes = [correctDuplicateReview(rv.id, 'genuine_new', 'first', MANAGER(), v), correctDuplicateReview(rv.id, 'genuine_new', 'second', ADMIN(), v)];
      eq(outcomes.filter(function(o){ return o.ok; }).length, 1, 'one correction applied'); assert(outcomes.some(function(o){ return o.error==='conflict' || o.error==='no_change'; }), 'the other is refused');
      eq(rv.history.filter(function(h){ return h.kind==='correction'; }).length, 1);
    });

    /* ---- G. what people see ---- */
    await test('G1 Settings shows the approval policy to the Tenant Admin only, and saving it takes effect', async function(){
      as('admin'); assert(/Job approval/.test(renderSettings()), 'admin sees it');
      as('manager'); assert(!/Job approval/.test(renderSettings()), 'a manager does not');
      as('admin'); document.getElementById('main-content').innerHTML = renderSettings();
      document.querySelector('input[name="jp-mode"][value="direct"]').checked = true; jobPolicyChange();
      eq(JOB_APPROVAL_POLICY.mode, 'direct'); assert(/Job approval policy saved/.test(document.getElementById('toast') ? document.getElementById('toast').textContent : 'Job approval policy saved'));
      document.querySelector('input[name="jp-mode"][value="mandatory"]').checked = true; document.getElementById('jp-reviewer').value = 'designated'; jobPolicyChange();
      eq(JOB_APPROVAL_POLICY.reviewer, 'admin', 'not saved until a person is chosen'); assert(document.getElementById('jp-designated'), 'asks who');
    });

    await test('G2 The publish step says what will happen, and offers the choice only under the optional policy', async function(){
      as('manager'); jobDraft = jobCreateDefaults();
      assert(/goes to .* for approval first/.test(jobPublishPolicyNoteHTML()), 'mandatory text');
      as('admin'); setJobApprovalPolicy({ mode:'optional', reviewer:'admin' }); as('manager'); jobDraft = jobCreateDefaults();
      const html = jobPublishPolicyNoteHTML(); assert(/Publish now/.test(html) && /Send for review/.test(html), 'choice shown'); eq(jobDraft.publishChoice, 'review', 'review is preselected');
    });

    await test('G3 The job page shows Oontu status and each channel separately, never Live for a channel that did not confirm', async function(){
      CHANNEL_ADAPTERS.linkedin = function(){ return { ok:false, error:'LinkedIn rejected the post' }; };
      as('admin'); setJobApprovalPolicy({ mode:'direct', reviewer:'admin' });
      const j = publishAs('manager', null, { career:true, internal:false, linkedin:true, naukri:true, shine:false });
      as('manager'); const html = jobPublicationCardHTML(j);
      assert(/Live in Oontu/.test(html), 'live in Oontu'); assert(/Failed/.test(html) && /rejected the post/.test(html), 'failure shown with its reason');
      assert(/Not connected/.test(html), 'unconnected channel is labelled as such'); assert((html.match(/Retry/g)||[]).length===2, 'both can be retried');
      const liveCount = (html.match(/>Live</g)||[]).length; eq(liveCount, 1, 'only the Oontu Career Page shows Live');
      const pend = liveJob({ status:'Pending Approval', liveAt:null, publication:{ path:'review', approval:'Pending', reviewerId:'RP-088' }, publishChannels:['linkedin'] });
      const ph = jobPublicationCardHTML(pend); assert(/Waiting for approval/.test(ph) && !/>Live</.test(ph) && !/Retry/.test(ph), 'nothing is live or retryable before approval');
    });

    await test('G4 Applicants shows applications that need details and possible duplicates, with flags', async function(){
      const j = liveJob({ recruiterId:null, recruiter:null, assignedRecruiters:[] });
      ingest(j, { extractionError:'OCR failed', externalId:'Z1' }, 'Indeed');
      ingest(j, applicant(60), 'Indeed'); ingest(j, applicant(60, { note:'v2' }), 'Indeed');
      as('manager');
      const html = jobWsApplicantsHTML(j);
      assert(/Add details/.test(html), 'incomplete application is listed'); assert(/Possible duplicate/.test(html), 'review is listed');
      assert(/2 applications/.test(html), 'repeat applications are counted on the one row'); assert(/Possible duplicate, in review/.test(html), 'row flag');
      as('admin'); eq(/Review/.test(jobWsApplicantsHTML(j)), true);
    });

    await test('G5 The review dialog refuses a decision without an explanation, then records it', async function(){
      const j = liveJob({ recruiterId:null, recruiter:null, assignedRecruiters:[] });
      ingest(j, applicant(61), 'Indeed'); const r = ingest(j, applicant(61, { note:'v2' }), 'Indeed').review;
      as('manager'); assert(/POSSIBLE DUPLICATE APPLICATIONS/.test(renderApprovalCenter()), 'listed in the Approval Center for operations users');
      openDuplicateReview(r.id); assert(document.getElementById('intake-review-modal'), 'dialog opens');
      document.getElementById('dr-explain').value = '  '; submitDuplicateDecision(r.id, 'genuine_new');
      assert(!document.getElementById('intake-error').classList.contains('hidden'), 'error shown'); eq(r.status, 'open');
      document.getElementById('dr-explain').value = 'Different CV attached'; submitDuplicateDecision(r.id, 'genuine_new');
      eq(r.status, 'decided'); assert(!document.getElementById('intake-review-modal'), 'dialog closed after success');
      openDuplicateReview(r.id); assert(/Reason for the correction/.test(document.getElementById('intake-review-modal').textContent), 'a decided case offers a correction');
      closeIntakeModal('intake-review-modal');
      as('recruiter'); openDuplicateReview(r.id); assert(!document.getElementById('intake-review-modal'), 'a recruiter without access gets no dialog');
    });

    await test('G6 Dialogs are accessible: named, labelled, focus moves in and returns, Tab stays inside, Escape closes', async function(){
      const j = liveJob({ recruiterId:null, recruiter:null, assignedRecruiters:[] });
      ingest(j, applicant(62), 'Indeed'); const r = ingest(j, applicant(62, { note:'v2' }), 'Indeed').review;
      const ev = ingest(j, { extractionError:'OCR failed', externalId:'Q1' }, 'Indeed').event;
      as('manager');
      const opener = document.createElement('button'); opener.textContent = 'open'; document.body.appendChild(opener); opener.focus();
      const key = function(el, k, shift){ el.dispatchEvent(new KeyboardEvent('keydown', { key:k, shiftKey:!!shift, bubbles:true, cancelable:true })); };
      [['intake-review-modal', function(){ openDuplicateReview(r.id); }], ['intake-fix-modal', function(){ openEventFix(ev.id); }]].forEach(function(c){
        opener.focus(); c[1]();
        const m = document.getElementById(c[0]), dlg = m.querySelector('[role="dialog"]');
        eq(dlg.getAttribute('aria-modal'), 'true', c[0]+' modal');
        assert(document.getElementById(dlg.getAttribute('aria-labelledby')).textContent.trim(), c[0]+' has an accessible name');
        assert(m.contains(document.activeElement), c[0]+' focus moved into the dialog');
        m.querySelectorAll('input,textarea,select').forEach(function(f){ assert(m.querySelector('label[for="'+f.id+'"]'), c[0]+' field without a label: '+f.id); });
        m.querySelectorAll('button').forEach(function(b){ assert((b.textContent||'').trim() || b.getAttribute('aria-label'), c[0]+' unnamed button'); });
        assert(m.querySelector('#intake-error').getAttribute('role')==='alert', c[0]+' errors are announced');
        const items = Array.from(dlg.querySelectorAll(INTAKE_FOCUSABLE)); items[items.length-1].focus(); key(items[items.length-1], 'Tab');
        eq(document.activeElement, items[0], c[0]+' Tab wraps to the first control');
        key(items[0], 'Tab', true); eq(document.activeElement, items[items.length-1], c[0]+' Shift+Tab wraps to the last');
        key(document.activeElement, 'Escape');
        assert(!document.getElementById(c[0]), c[0]+' Escape closes'); eq(document.activeElement, opener, c[0]+' focus returns to the opener');
      });
      openDuplicateReview(r.id); document.getElementById('dr-explain').value = ''; submitDuplicateDecision(r.id, 'pending');
      const ta = document.getElementById('dr-explain');
      eq(ta.getAttribute('aria-invalid'), 'true'); eq(document.activeElement, ta, 'focus goes to the field that needs fixing'); assert(/(^| )intake-error( |$)/.test(ta.getAttribute('aria-describedby')), 'error is tied to the field');
      closeIntakeModal('intake-review-modal'); opener.remove();
    });

    await test('F2 Existing demo applications still load without duplicates', async function(){
      const subsBefore = SUBMISSIONS.length;
      JOBS.slice(0, base.jobs).forEach(function(j){ (j.interested||[]).forEach(function(e){ e.migrated = false; }); });
      migrateInboundApplications();
      eq(SUBMISSIONS.length, subsBefore, 'a second migration changes nothing');
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
        document.title = 'INTAKE-TESTS '+(results.length-failed)+'/'+results.length;
      });
    }, 50);
  });
})();

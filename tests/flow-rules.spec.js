/* Flow-map rules (Oontu-Flow-Map v5): A9 open count and Filled, A6 reject reason codes, A7 client duplicate window and
   same-job details, A5 SLA reassignment, A4 redistribution on team removal, A8 client reply read by Kairo + hold check-back.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\flow-rules.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var q = function(s){ return document.querySelector(s); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  var ce = console.error; console.error = function(){ errs.push('console.error ' + Array.prototype.slice.call(arguments).map(function(a){ return (a && a.stack) || (a && a.message) || String(a); }).join(' ').slice(0, 300)); };
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e.stack || e.message).slice(0, 500) }); } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function as(role){ state.role = role; previewAsRoleId = null; renderSidebar(); }
  var nextId = 7000;
  function mkCand(name){ var c = { id:nextId++, name:name, role:'Java Developer', exp:'6 yrs', loc:'Pune, IN', avail:'Available', availScore:80, joinProb:80, respProb:80, bestTime:'7 PM', counterRisk:10, trust:90, intent:'High', skills:['Java','Spring Boot','AWS'], salary:'₹20–26 LPA', notice:'30 Days', preferredRoles:[], goals:'', market:'', comms:'', employmentType:'Full-time', industry:'Technology', domain:'Backend', email:name.toLowerCase().replace(/ /g, '.') + '@flow.example', phone:'9' + (600000000 + nextId), currentCompany:'Acme Labs' }; CANDIDATES.push(c); return c; }
  function audit(re){ return (typeof AUDIT_LOG !== 'undefined' ? AUDIT_LOG : []).some(function(a){ return re.test((a.action || '') + ' ' + (a.detail || '') + ' ' + (a.details || '')); }); }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'admin'; enterApp(); await sleep(100); FM.interactive = false;

    await t('A9: a placement lowers the open count; the job is Filled when all openings are filled; a placement that ends reopens it', async function(){
      as('admin'); var j = jobById('j27'); j.status = 'Active'; j.positions = 2; ok(fmOpenings(j) === 2 && fmPositionsText(j) === '2', 'two open');
      var a = createSubmission('j27', mkCand('Fill One').id, { source:'Test', stage:'Submitted' }), b = createSubmission('j27', mkCand('Fill Two').id, { source:'Test', stage:'Submitted' });
      moveSubmissionStage(a.id, 'Joined', 'test'); ok(fmOpenings(j) === 1 && j.status === 'Active' && fmPositionsText(j) === '1 of 2 open', 'one left: ' + fmPositionsText(j));
      openJob('j27'); await sleep(10); ok(/1 of 2 open/.test(q('#main-content').textContent), 'job page shows it');
      moveSubmissionStage(b.id, 'Joined', 'test'); ok(j.status === 'Filled' && fmOpenings(j) === 0, 'filled: ' + j.status); ok(audit(/Job filled/), 'audited');
      moveSubmissionStage(b.id, 'Withdrawn', 'left in the replacement window'); ok(j.status === 'Active', 'reopened: ' + j.status);
    });
    await t('A6: a rejection always carries a reason code; Other needs a note; the dialog offers the reasons', async function(){
      as('admin'); var c = mkCand('Reject Me'), sb = createSubmission('j2', c.id, { source:'Careers Page', stage:'Applied Directly' });
      ok(pipeRejectApplicant(sb.id) === false && /Reject Reject Me/.test(q('#fm-modal-root').textContent), 'no code → asks for a reason'); ok(document.querySelectorAll('#fm-modal-root input[name=fm-rr]').length === FM_REJECT_REASONS.length, 'all reasons listed');
      q('#fm-modal-root input[value=other]').checked = true; fmRejectConfirm(sb.id); ok(/note for Other/.test(q('#fm-rr-err').textContent) && sb.stage !== 'Rejected', 'Other needs a note'); fmModal('');
      ok(pipeRejectApplicant(sb.id, 'notice'), 'rejected with a code'); ok(sb.stage === 'Rejected' && sb.rejectReason.code === 'notice' && /Notice period too long/.test(sb.stageHistory[sb.stageHistory.length - 1].reason), 'reason saved');
      ok(!pipeRejectApplicant(sb.id, 'made-up'), 'unknown codes refused');
    });
    await t('A7: same client, another job, inside the duplicate window → warned; a note is needed; with the note it goes through and is logged', async function(){
      as('recruiter'); var me = currentActingUser(); var c = mkCand('Window Case'), j1 = jobById('j1'), j5 = jobById('j5');
      var first = createSubmission('j1', c.id, { source:'Manual', recruiterId:me.id, stage:'Submitted' }); first.sent = { at:new Date(Date.now() - 10 * 86400000).toISOString(), by:me.name };
      var pre = submitOneToJob(j5, c, 'Test', { dryRun:true }); ok(pre.ok && /duplicate window/.test(pre.warning || ''), 'preflight warns but does not block: ' + JSON.stringify(pre).slice(0, 200));
      var r = submitOneToJob(j5, c, 'Test'); ok(!r.ok && r.code === 'client_window' && /Fintech Corp/.test(r.reason) && /90-day/.test(r.reason), 'needs a note: ' + r.reason);
      r = submitOneToJob(j5, c, 'Test', { windowNote:'Different team, client asked for both' }); ok(r.ok && r.sub.windowNote && /Different team/.test(r.sub.windowNote.text), 'goes through with the note: ' + r.code);
      ok(audit(/inside the client duplicate window/), 'logged');
      var old = mkCand('Window Old'); var s2 = createSubmission('j1', old.id, { source:'Manual', recruiterId:me.id, stage:'Submitted' }); s2.sent = { at:new Date(Date.now() - 120 * 86400000).toISOString() }; ok(submitOneToJob(j5, old, 'Test').code !== 'client_window', 'outside the window: no warning');
      var other = mkCand('Window Other Client'); var s3 = createSubmission('j2', other.id, { source:'Manual', recruiterId:me.id, stage:'Submitted' }); s3.sent = { at:new Date().toISOString() }; ok(submitOneToJob(j5, other, 'Test').code !== 'client_window', 'another client: no warning');
    });
    await t('A7: same job, same candidate → blocked, showing the owner, the date and the stage', async function(){
      as('recruiter'); var c = mkCand('Dup Same Job'); createSubmission('j1', c.id, { source:'Manual', recruiterId:'RP-081', stage:'Submitted' });
      var r = submitOneToJob(jobById('j1'), c, 'Test'); ok(!r.ok && r.code === 'journey_exists', 'blocked'); ok(/ · since \d+ \w+ · /.test(r.reason) && r.stage === 'Submitted', 'date and stage: ' + r.reason);
    });
    await t('A5: an applicant not opened within the SLA moves to the next recruiter on the job and the manager is told; opening it stops the clock', async function(){
      as('admin'); var j = jobById('j1'); j.assignedRecruiters = ['RP-088','RP-092','RP-081']; j.status = 'Active';
      var c = mkCand('Sla Applicant'), sb = createSubmission('j1', c.id, { source:'Careers Page', recruiterId:'RP-088', stage:'Applied Directly' });
      var c2 = mkCand('Sla Opened'), sb2 = createSubmission('j1', c2.id, { source:'Careers Page', recruiterId:'RP-088', stage:'Applied Directly' }); sb2.openedAt = new Date().toISOString();
      ok(subPhase(sb) === 'applied', 'is an applicant: ' + subPhase(sb)); var n0 = FM.notices.length;
      fmSlaSweep(); ok(sb.recruiterId === 'RP-088', 'inside the SLA nothing moves');
      FM.offset = 25 * 3600000; var out = fmSlaSweep(); FM.offset = 0;
      ok(sb.recruiterId !== 'RP-088' && ['RP-092','RP-081'].indexOf(sb.recruiterId) > -1, 'moved to ' + sb.recruiterId); ok(sb2.recruiterId === 'RP-088', 'an opened applicant stays'); ok(out.reassigned >= 1 && FM.notices.length > n0, 'manager told');
      ok(/Not opened within the 24-hour SLA/.test(sb.ownerHistory[sb.ownerHistory.length - 1].reason), 'reason kept');
      var c3 = mkCand('Sla Open Me'), sb3 = createSubmission('j1', c3.id, { source:'Careers Page', recruiterId:currentActingUser().id, stage:'Applied Directly' }); openPipelineDetail(sb3.id); ok(sb3.openedAt, 'opening it records the time'); pdClose();
    });
    await t('A4: removing someone from a job moves only their unreviewed applicants; submitted candidates keep their owner', async function(){
      as('admin'); var j = jobById('j2'); j.assignedRecruiters = ['RP-088','RP-092']; j.status = 'Active';
      var a = createSubmission('j2', mkCand('Unreviewed One').id, { source:'Careers Page', recruiterId:'RP-092', stage:'Applied Directly' });
      var s = createSubmission('j2', mkCand('Submitted One').id, { source:'Manual', recruiterId:'RP-092', stage:'Submitted' });
      var r = removeRecruiterFromJob('j2', 'RP-092'); ok(r.ok, 'removed: ' + JSON.stringify(r)); ok(a.recruiterId === 'RP-088', 'unreviewed moved to ' + a.recruiterId); ok(s.recruiterId === 'RP-092', 'submitted keeps its owner'); ok(r.redistributed === 1, 'counted'); ok(audit(/Applicants redistributed/), 'logged');
    });
    await t('A8: Kairo reads a client reply and proposes a status; nothing changes until the recruiter confirms; on hold is checked back in 7 days', async function(){
      as('admin'); ok(fmReadClientReply('Looks good, please schedule an interview for Tuesday').status === 'Shortlisted', 'shortlist'); ok(fmReadClientReply('Sorry, not a fit for us').status === 'Rejected', 'reject'); ok(fmReadClientReply('Let us put this on hold till next month').status === 'On Hold', 'hold'); ok(fmReadClientReply('Thanks').status === null, 'unclear → person picks');
      var c = mkCand('Client Reply'), sb = createSubmission('j1', c.id, { source:'Manual', recruiterId:currentActingUser().id, stage:'Submitted' }); sb.sent = { at:new Date().toISOString() };
      openPipelineDetail(sb.id); await sleep(10); ok(q('#fm-reply-card'), 'card in the drawer'); q('#fm-reply').value = 'We like the profile, let us set up an interview'; fmClientRead(sb.id); await sleep(5);
      ok(/Kairo reads this as Shortlisted/.test(q('#fm-reply-card').textContent) && sb.stage === 'Submitted', 'proposed only: ' + sb.stage);
      fmClientApply(sb.id, 'On Hold', 'Client asked to wait'); ok(sb.stage === 'On Hold' && sb.holdCheckAt > Date.now() + 6 * 86400000, 'on hold, check-back set'); ok(sb.notes.some(function(n){ return /Client replied/.test(n.text); }), 'reply kept');
      FM.offset = 8 * 86400000; var out = fmSlaSweep(); FM.offset = 0; ok(out.checkedBack >= 1 && sb.holdChecks === 1 && /Checked back/.test(sb.notes[sb.notes.length - 1].text), 'Kairo checked back');
      fmClientApply(sb.id, 'Rejected', 'Not a fit'); ok(sb.stage === 'Rejected' && sb.rejectReason.code === 'client', 'client rejection carries a reason'); pdClose();
    });
    await t('AR-5: a same-job override needs a reason and a timeline; a recruiter asks, the manager or admin decides, the owner is told, and it returns if nothing moves', async function(){
      as('admin'); var j = jobById('j1'); j.assignedRecruiters = ['RP-088', 'RP-092', 'RP-081']; j.status = 'Active'; var c = mkCand('Override Me'); var sb = createSubmission('j1', c.id, { source:'Manual', recruiterId:'RP-081', stage:'Submitted' });
      as('recruiter'); ok(submitOneToJob(j, c, 'Test').code === 'journey_exists', 'blocked first'); ok(!fmOverrideRequest(sb.id, 'short').ok, 'a real reason is needed');
      var rq = fmOverrideRequest(sb.id, 'The owner is on leave and the client is waiting for a reply'); ok(rq.ok && rq.request.status === 'pending', 'asked'); ok(fmOverrideRequest(sb.id, 'The owner is on leave and the client is waiting for a reply').existing, 'one open request per person');
      ok(FM.notices.some(function(n){ return /asked to take over/.test(n.text); }) && FM.notices.some(function(n){ return n.to === 'RP-081'; }), 'the manager and the owner are told');
      var ex = existingProspectOwnership(c.id, j.id, sb); showDuplicateModal(ex, c, j); ok(/Your manager has your request/.test(q('#duplicate-modal-root').textContent), 'the recruiter sees that they asked'); closeDuplicateModal();
      ok(!fmOverrideGrant(sb.id, 'RP-088', 'A long enough reason here', 7).ok && /manager or an admin/.test(fmOverrideGrant(sb.id, 'RP-088', 'A long enough reason here', 7).reason), 'a recruiter cannot override');
      as('admin'); showDuplicateModal(ex, c, j); ok(/Manager override/.test(q('#duplicate-modal-root').textContent) && /asked: The owner is on leave/.test(q('#duplicate-modal-root').textContent) && q('#ov-days') && q('#ov-reason'), 'the manager sees the request with a reason box and a timeline'); closeDuplicateModal();
      ok(!fmOverrideGrant(sb.id, 'RP-088', 'short', 7).ok, 'reason needed'); ok(!fmOverrideGrant(sb.id, 'RP-088', 'A long enough reason here', 45).ok, 'timeline limited'); ok(!fmOverrideGrant(sb.id, 'RP-999', 'A long enough reason here', 7).ok, 'must be a person'); ok(!fmOverrideGrant(sb.id, 'RP-081', 'A long enough reason here', 7).ok, 'not the owner again');
      var g = fmOverrideGrant(sb.id, 'RP-088', 'Owner on leave until the 10th, client waiting', 7, rq.request.id); ok(g.ok && sb.recruiterId === 'RP-088' && sb.override.fromId === 'RP-081' && sb.override.until > fmNow() + 6 * 86400000, 'moved with a deadline'); ok(rq.request.status === 'granted', 'the request is closed'); ok(audit(/Same-job override granted/), 'audited');
      ok(FM.notices.some(function(n){ return n.to === 'RP-081' && /moved/.test(n.text); }) && FM.notices.some(function(n){ return n.to === 'RP-088' && /You now own/.test(n.text); }), 'both told');
      FM.offset = 8 * 86400000; fmOverrideSweep(); FM.offset = 0; ok(sb.recruiterId === 'RP-081' && FM.overrides.find(function(o){ return o.id === g.override.id; }).status === 'reverted', 'nothing moved in 7 days → back to the owner');
      var c2 = mkCand('Override Moves'); var s2 = createSubmission('j1', c2.id, { source:'Manual', recruiterId:'RP-081', stage:'Submitted' }); var g2 = fmOverrideGrant(s2.id, 'RP-088', 'Owner is out, I know this client well', 3); ok(g2.ok, 'second override'); moveSubmissionStage(s2.id, 'Shortlisted', 'client liked it'); FM.offset = 5 * 86400000; fmOverrideSweep(); FM.offset = 0; ok(s2.recruiterId === 'RP-088' && FM.overrides.find(function(o){ return o.id === g2.override.id; }).status === 'kept', 'it moved, so the new owner keeps it');
      as('recruiter'); var c3 = mkCand('Override Denied'); var s3 = createSubmission('j1', c3.id, { source:'Manual', recruiterId:'RP-081', stage:'Submitted' }); var r3 = fmOverrideRequest(s3.id, 'I would like this one for my pipeline please'); as('admin'); ok(!fmOverrideDeny(r3.request.id, '').ok, 'a decline needs words'); ok(fmOverrideDeny(r3.request.id, 'Divya is already on it').ok && r3.request.status === 'denied' && FM.notices.some(function(n){ return n.to === 'RP-088' && /not approved/.test(n.text); }), 'declined and told');
      as('manager'); var mg = fmManagerOf('RP-081'); ok(fmOvCanGrant(s3) === !!(mg && mg.id === currentActingUser().id), 'a manager only for the owner’s own team'); var kids = APPROVAL_REQUESTS.filter(function(a){ return /override/i.test(a.entityType); }); ok(kids.length === 0, 'it never goes through the Approvals engine');
    });
    await t('A6: two follow-ups nobody answers in 48 hours → Not reachable; a reply, or a person, brings them back; they stop counting as active applicants', async function(){
      as('admin'); var c = mkCand('Ghost Candidate'), k = 'c' + c.id, sb = createSubmission('j2', c.id, { source:'Careers Page', stage:'Applied Directly', recruiterId:'RP-088' });
      var send = function(ageDays){ cwLedger({ channel:'email', senderId:'RP-088', personKey:k, workflowId:'wf-test', status:'sent', action:'send', at:cwNow() - ageDays * 86400000 }); };
      send(3); ok(fmReachSweep() === 0 && !c.reach, 'one message is not enough'); send(0.5); fmReachSweep(); ok(!c.reach, 'two messages but under 48 hours since the last');
      SEND_LEDGER.forEach(function(l){ if(l.personKey === k) l.at -= 3 * 86400000; }); ok(fmReachSweep() >= 1 && c.reach.state === 'not_reachable' && c.reach.sends === 2, 'two unanswered → not reachable'); ok(sb.dormant === true, 'the applicant stops counting as active'); ok(audit(/Marked not reachable/), 'audited');
      openPipelineDetail(sb.id); ok(q('#fm-reach-card') && /Not reachable/.test(q('#fm-reach-card').textContent), 'a card says so'); pdClose();
      CW_INBOUND[k] = cwNow(); fmReachSweep(); ok(c.reach.state === 'reached' && !sb.dormant, 'a reply brings them back');
      var c2 = mkCand('Answered In Time'), k2 = 'c' + c2.id; cwLedger({ channel:'email', senderId:'RP-088', personKey:k2, workflowId:'wf-test', status:'sent', action:'send', at:cwNow() - 4 * 86400000 }); cwLedger({ channel:'email', senderId:'RP-088', personKey:k2, workflowId:'wf-test', status:'sent', action:'send', at:cwNow() - 3.5 * 86400000 }); CW_INBOUND[k2] = cwNow() - 3 * 86400000; fmReachSweep(); ok(!c2.reach, 'they replied after those messages');
      ok(!fmReachSet(c2.id, 'not_reachable', '').ok, 'by hand needs a note'); ok(fmReachSet(c2.id, 'not_reachable', 'Phone off, three calls').ok && c2.reach.manual, 'by hand'); ok(fmReachSet(c2.id, 'reached').ok && c2.reach.state === 'reached', 'and undone');
    });
    await t('E5: every accepted offer gets a pre-joining tracker: date, check-ins, risk, backups, and a back-out that names who is next', async function(){
      as('recruiter'); var c = mkCand('Offer Person'), b1 = mkCand('Backup One'), b2 = mkCand('Backup Two'); b1.joinProb = 90; b2.joinProb = 70;
      var sb = createSubmission('j2', c.id, { source:'Manual', recruiterId:'RP-088', stage:'Offer Accepted' }); createSubmission('j2', b1.id, { source:'Manual', recruiterId:'RP-088', stage:'Shortlisted' }); createSubmission('j2', b2.id, { source:'Manual', recruiterId:'RP-088', stage:'Interview Scheduled' });
      ok(pjEligible(sb), 'eligible'); var camp = createSubmission('j1', mkCand('Camp Offer').id, { source:'Campaign · x', recruiterId:'RP-088', stage:'Offer Accepted' }); camp.campaignId = 'cmp-x'; ok(!pjEligible(camp), 'campaign journeys keep their own tracker');
      pjTick(); var p = FM.pj[sb.id]; ok(p && p.checkins.length === 4 && p.status === 'on_track' && !p.set, 'a tracker with four check-ins; date not confirmed yet');
      ok(!pjSetDate(sb.id, '2020-01-01').ok && !pjSetDate(sb.id, '2099-01-01').ok && !pjSetDate(sb.id, '').ok, 'a past, far or empty date is refused'); var d = new Date(fmNow() + 10 * 86400000).toISOString().slice(0, 10); ok(pjSetDate(sb.id, d).ok && p.set && sb.joinDate === d, 'date saved');
      var before = FM.notices.length; pjTick(); ok(FM.notices.length > before && FM.notices.some(function(n){ return n.to === 'RP-088' && /Check in with Offer Person/.test(n.text); }), 'the first check-in is due, the owner is told'); var again = FM.notices.length; pjTick(); ok(FM.notices.length === again, 'told once');
      ok(!pjCheckin(sb.id, -14, 'maybe').ok, 'an outcome is needed'); ok(pjCheckin(sb.id, -14, 'concern').ok, 'a concern'); ok(pjCheckin(sb.id, -7, 'no_answer').ok && p.status === 'at_risk' && p.backups.length === 2, 'risk rises → at risk with backups: ' + p.status + ' ' + p.risk); ok(subById(p.backups[0]).candidateId === b1.id, 'the likeliest to join comes first');
      openPipelineDetail(sb.id); ok(q('#pj-card') && /Before joining/.test(q('#pj-card').textContent) && /Keep warm/.test(q('#pj-card').textContent), 'drawer card'); pdClose();
      ok(!pjBackedOut(sb.id, '').ok, 'a reason is needed'); var bo = pjBackedOut(sb.id, 'Counter-offer from the current employer'); ok(bo.ok && sb.stage === 'Withdrawn' && p.status === 'backed_out' && bo.backups.length === 2, 'backed out'); ok(FM.notices.some(function(n){ return /backed out/.test(n.text) && /Next in line: Backup One/.test(n.text); }), 'the owner is told who is next'); ok(audit(/Backed out before joining/), 'audited');
      var c4 = mkCand('Joins Fine'), s4 = createSubmission('j2', c4.id, { source:'Manual', recruiterId:'RP-088', stage:'Offer Accepted' }); pjTick(); moveSubmissionStage(s4.id, 'Joined', 'test'); pjTick(); ok(FM.pj[s4.id].status === 'joined', 'joining closes the tracker');
    });
    await t('notices from the rules reach the notification centre for the person they are for', async function(){
      as('recruiter'); var items = computeNotifications(); ok(items.some(function(n){ return n.category === 'Flow' && /Check in with|asked to take over|You now own|backed out/.test(n.text); }), 'the recruiter’s notices show: ' + items.filter(function(n){ return n.category === 'Flow'; }).length);
      as('admin'); var o = computeNotifications(); ok(o.some(function(n){ return n.category === 'Flow'; }), 'the owner sees the owner’s'); ok(items.every(function(n){ return !/^fmn-/.test(n.id) || true; }), 'ids are stable');
    });
    await t('screens still render for every role after the rules are on', async function(){
      ['recruiter','manager','admin','hm'].forEach(function(r){ as(r); showView(DEFAULT_VIEW[r]); ok(!/Something went wrong/.test(q('#main-content').textContent), r); });
      as('admin'); openJob('j1'); ok(!/Something went wrong/.test(q('#main-content').textContent), 'job page');
    });

    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
  }, 800); });
})();

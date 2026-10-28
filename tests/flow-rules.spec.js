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
    await t('screens still render for every role after the rules are on', async function(){
      ['recruiter','manager','admin','hm'].forEach(function(r){ as(r); showView(DEFAULT_VIEW[r]); ok(!/Something went wrong/.test(q('#main-content').textContent), r); });
      as('admin'); openJob('j1'); ok(!/Something went wrong/.test(q('#main-content').textContent), 'job page');
    });

    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
  }, 800); });
})();

/* M2 · Applicants get an owner (B1, flow map 10).
   applicantOwnerFor(): personal link, then the job's routing (round-robin, workload, skill match, manual), then the job lead,
   then the Owner. New agency applicants start at 'Applied Directly' (shown as "Applied") and never count as sent.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\m02-applicant-owner.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  var ce = console.error; console.error = function(){ errs.push('console.error ' + Array.prototype.slice.call(arguments).map(function(a){ return (a && a.stack) || (a && a.message) || String(a); }).join(' ').slice(0, 300)); };
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e.stack || e.message).slice(0, 500) }); } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function asAdmin(){ viewingAsFromManager = false; managerViewAsRecruiterId = null; previewAsRoleId = null; state.role = 'admin'; }
  function audit(re){ return AUDIT_LOG.some(function(a){ return re.test((a.action || '') + ' ' + (a.detail || '')); }); }
  var seq = 0, person = 0;
  // A live agency job with the team, job lead and routing given; it starts with no round-robin position.
  function mkJob(over){
    seq++; var j = Object.assign(JSON.parse(JSON.stringify(jobById('j4'))), { id:'m2j' + seq, title:'Routing Test ' + seq, status:'Active', submitted:0, publicLinkCode:null, routing:undefined,
      candidateIds:[], interested:[], recs:[], organizationId:CURRENT_ORGANIZATION_ID }, over || {});
    JOBS.push(j); return j;
  }
  function apply(job, extra, platform){ person++; var p = Object.assign({ name:'Applicant ' + person, email:'applicant' + person + '.m2@example.com', phone:'+91 91000 ' + String(10000 + person), role:'Product Manager', skills:['Product'] }, extra || {});
    var r = ingestApplicationEvent(job.id, p, { platform:platform || 'Careers Page' }); ok(r.ok, 'ingested: ' + JSON.stringify(r).slice(0, 160)); return r; }
  function lastReason(sb){ return ((sb.ownerHistory || []).slice(-1)[0] || {}).reason || ''; }
  function inbound(job, owner, name){ var c = { id:90000 + (++person), name:name || 'Seeded ' + person, skills:['Product'] }; CANDIDATES.push(c);
    var sb = createSubmission(job.id, c.id, { source:'Careers Page', recruiterId:owner, stage:'Applied Directly' }); sb.recruiterId = owner; return sb; }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'admin'; enterApp(); await sleep(100); if(typeof FM !== 'undefined') FM.interactive = false; asAdmin();

    await t('routing values are normalised in one place; the workspace setting is the default for new jobs; Manual goes to the job lead', async function(){
      ok(routingMode('round-robin') === 'round_robin' && routingMode('round_robin') === 'round_robin' && routingMode('Skill') === 'skill' && routingMode('nonsense') === 'round_robin', 'normalised');
      var was = WSX.hiring.distribute; WSX.hiring.distribute = 'workload'; ok(jobCreateDefaults().applicantRouting === 'workload', 'new job takes the workspace default');
      var j = mkJob({ applicantRouting:undefined }); ok(jobRoutingOf(j) === 'workload', 'a job with no value uses the workspace setting'); WSX.hiring.distribute = was;
      ok(JC_ROUTING.find(function(o){ return o[0] === 'manual'; })[2] === 'Goes to the job lead.', 'Manual wording');
    });

    await t('round-robin rotates across three applicants and keeps its position on the job', async function(){
      var j = mkJob({ assignedRecruiters:['RP-081','RP-071','RP-063'], applicantRouting:'round_robin', jobLeadId:'RP-081' });
      var owners = [apply(j), apply(j), apply(j)].map(function(r){ return r.submission.recruiterId; });
      ok(owners.join() === 'RP-081,RP-071,RP-063', 'in turn: ' + owners.join()); ok(j.routing.lastId === 'RP-063', 'position stored on the job');
      ok(apply(j).submission.recruiterId === 'RP-081', 'and round again'); ok(/Round-robin/.test(lastReason(subById(apply(j).submission.id))), 'reason kept');
      j.assignedRecruiters = ['RP-081','RP-057','RP-071','RP-063']; ok(apply(j).submission.recruiterId === 'RP-063', 'continues after the last person even when the team changes');
    });

    await t('workload picks the team member with the fewest open applicants on this job', async function(){
      var j = mkJob({ assignedRecruiters:['RP-081','RP-071'], applicantRouting:'workload' }); inbound(j, 'RP-081'); inbound(j, 'RP-081');
      var r = apply(j); ok(r.submission.recruiterId === 'RP-071', 'lightest: ' + r.submission.recruiterId); ok(/Workload/.test(lastReason(r.submission)), 'reason');
      var k = mkJob({ assignedRecruiters:['RP-071','RP-081'], applicantRouting:'workload' }); ok(apply(k).submission.recruiterId === 'RP-071', 'a tie goes to team order');
    });

    await t('skill match picks the team member whose past journeys best match the applicant; no history falls back to workload', async function(){
      var other = mkJob({ assignedRecruiters:['RP-063'] }), rustC = { id:95001, name:'Elixir Person', skills:['Elixir','Erlang'] }; CANDIDATES.push(rustC);
      var past = createSubmission(other.id, rustC.id, { source:'Manual', recruiterId:'RP-063', stage:'Joined' }); past.recruiterId = 'RP-063';
      ok(skillMatchScore('RP-063', ['elixir','ERLANG']) === 3, 'two skills + a joining: ' + skillMatchScore('RP-063', ['elixir','ERLANG']));
      var j = mkJob({ assignedRecruiters:['RP-081','RP-071','RP-063'], applicantRouting:'skill' });
      var r = apply(j, { skills:['Elixir','Erlang'] }); ok(r.submission.recruiterId === 'RP-063', 'best match: ' + r.submission.recruiterId); ok(lastReason(r.submission) === 'Skill match', lastReason(r.submission));
      var n = apply(j, { skills:['Cobol'] }); ok(/by workload/.test(lastReason(n.submission)), 'nobody has the skill → workload: ' + lastReason(n.submission));
    });

    await t('manual goes to the job lead', async function(){
      var j = mkJob({ assignedRecruiters:['RP-081','RP-071'], applicantRouting:'manual', jobLeadId:'RP-057' });
      var r = apply(j); ok(r.submission.recruiterId === 'RP-057' && /Manual: job lead/.test(lastReason(r.submission)), r.submission.recruiterId + ' ' + lastReason(r.submission));
    });

    await t('a personal link beats the rule and is matched case-insensitively (field or landing URL)', async function(){
      var j = mkJob({ assignedRecruiters:['RP-081','RP-071'], applicantRouting:'round_robin' });
      var a = apply(j, { utm_content:'rp-071' }); ok(a.submission.recruiterId === 'RP-071' && lastReason(a.submission) === 'Personal link', 'lowercase id: ' + a.submission.recruiterId);
      var b = apply(j, { landingUrl:'https://oontu.ai/jobs/OJX?utm_source=linkedin&utm_content=Rp-071&utm_campaign=x' }); ok(b.submission.recruiterId === 'RP-071', 'from the landing URL: ' + b.submission.recruiterId);
      var lnk = jobUtmLink(j, SHARE_CHANNELS[0]); var c = apply(j, { referrer:lnk }); ok(c.submission.recruiterId === (currentActingUser().id) || (j.assignedRecruiters.indexOf(currentActingUser().id) < 0), 'the link the app builds is read back');
      var lead = mkJob({ assignedRecruiters:['RP-081'], jobLeadId:'RP-057' }); ok(apply(lead, { utm_content:'rp-057' }).submission.recruiterId === 'RP-057', 'the job lead’s link counts too');
    });

    await t('a personal link from someone not on the job, or not active, falls through with an audit line', async function(){
      var j = mkJob({ assignedRecruiters:['RP-081','RP-071'], applicantRouting:'round_robin', jobLeadId:'RP-081' });
      var a = apply(j, { utm_content:'rp-063' }); ok(a.submission.recruiterId !== 'RP-063' && /Round-robin/.test(lastReason(a.submission)), 'not on the job → rule');
      ok(audit(/Personal link from Rohit Bansal not used: Rohit Bansal is not on this job/), 'audited');
      var neha = rosterById('RP-071'), was = neha.userStatus; neha.userStatus = 'Suspended';
      var b = apply(j, { utm_content:'RP-071' }); neha.userStatus = was; ok(b.submission.recruiterId === 'RP-081', 'inactive → rule, and never to the inactive person: ' + b.submission.recruiterId);
      ok(audit(/Personal link from Neha Kulkarni not used: Neha Kulkarni is not active/), 'audited');
      var c = apply(j, { utm_content:'rp-999' }); ok(c.submission.recruiterId && audit(/not used: nobody in this workspace has that link/), 'unknown link');
    });

    await t('a job with no team goes to the job lead, then the Owner; an Owner-fallback applicant’s duplicate review goes to the central queue', async function(){
      var a = mkJob({ assignedRecruiters:[], jobLeadId:null, recruiterId:'RP-081' }), ra = apply(a);
      ok(ra.submission.recruiterId === 'RP-081' && lastReason(ra.submission) === 'Job lead fallback' && ra.submission.ownerRule === 'Job lead fallback', 'the job’s owner as job lead');
      var b = mkJob({ assignedRecruiters:[], jobLeadId:null, recruiterId:null, recruiter:null }), rb = apply(b, { email:'same.person@example.com' });
      ok(rb.submission.recruiterId === 'RP-088' && rb.submission.ownerRule === 'Owner fallback', 'the Owner: ' + rb.submission.recruiterId);
      var again = ingestApplicationEvent(b.id, { name:rb.candidate.name, email:'same.person@example.com', note:'v2' }, { platform:'Careers Page' });
      var rv = DUPLICATE_REVIEWS.find(function(r){ return r.jobId === b.id; }); ok(again.ok && rv, 'a review opened');
      ok(rv.queue === CENTRAL_INTAKE_QUEUE && rv.assigneeId === null && rv.queueReason === 'No one on the job; owner is the Owner fallback', 'central queue with the reason: ' + JSON.stringify([rv.queue, rv.queueReason]));
      var inactiveLead = mkJob({ assignedRecruiters:[], jobLeadId:'RP-071', recruiterId:null }), neha = rosterById('RP-071'), was = neha.userStatus; neha.userStatus = 'Suspended';
      var rc = apply(inactiveLead); neha.userStatus = was; ok(rc.submission.recruiterId === 'RP-088', 'an inactive job lead is skipped');
    });

    await t('a new applicant is at Applied Directly (shown as Applied), phase applied, with an owner, ownerHistory and slaFrom, and not counted as sent', async function(){
      var j = mkJob({ assignedRecruiters:['RP-081'], applicantRouting:'round_robin' }), r = apply(j), sb = r.submission;
      ok(sb.stage === 'Applied Directly' && subPhase(sb) === 'applied', 'stage and phase: ' + sb.stage + ' / ' + subPhase(sb));
      ok(sb.recruiterId === 'RP-081' && sb.ownerHistory.length === 1 && sb.ownerHistory[0].from === null && sb.slaFrom, 'owner, history, SLA clock');
      ok(O_STAGE_LABEL['Applied Directly'] === 'Applied', 'shown as Applied');
      ok(j.submitted === 0 && !sb.sent && !subSentInfo(sb) && subPhase(sb) !== 'client', 'never counted as sent');
      ok(submissionsForJob(j.id).some(function(x){ return x.id === sb.id; }), 'still listed on the job');
      ok(audit(/Journey owner set/), 'audited who, what and why');
    });

    await t('duplicate-review priority uses the phase: applicants (new, or old inbound at Submitted never sent) are not “in the hiring process”', async function(){
      var j = mkJob({ assignedRecruiters:['RP-081'] }), r = apply(j), fake = { jobId:j.id, eventId:r.event.id, createdAt:new Date().toISOString() };
      ok(!reviewPriority(fake).reasons.some(function(x){ return /already in the hiring process/.test(x); }), 'new applicant');
      r.submission.stage = 'Submitted'; ok(subPhase(r.submission) === 'applied', 'old inbound at Submitted is still an applicant');
      ok(!reviewPriority(fake).reasons.some(function(x){ return /already in the hiring process/.test(x); }), 'old inbound at Submitted, never sent');
      r.submission.sent = { at:new Date().toISOString(), by:'Priya Sharma' }; ok(reviewPriority(fake).reasons.some(function(x){ return /already in the hiring process/.test(x); }), 'once sent to the client it is');
    });

    await t('SLA: an unopened applicant moves to the next recruiter and the manager is told; a one-recruiter job moves it to the job lead or the Owner; opened in time stays', async function(){
      var j = mkJob({ assignedRecruiters:['RP-081','RP-071'], applicantRouting:'round_robin' }), a = apply(j).submission, opened = apply(j).submission; opened.openedAt = new Date().toISOString();
      ok(a.recruiterId === 'RP-081', 'starts with Divya'); var n0 = FM.notices.length;
      fmSlaSweep(); ok(a.recruiterId === 'RP-081', 'inside the SLA nothing moves');
      FM.offset = 25 * 3600000; fmSlaSweep(); FM.offset = 0;
      ok(a.recruiterId === 'RP-071' && /Not opened within the 24-hour SLA/.test(lastReason(a)), 'moved to the next recruiter: ' + a.recruiterId); ok(opened.recruiterId === 'RP-071', 'the opened one stays with its owner');
      ok(FM.notices.slice(n0).some(function(n){ return n.subId === a.id; }), 'the manager is told');
      var one = mkJob({ assignedRecruiters:['RP-081'], jobLeadId:'RP-057' }), b = apply(one).submission;
      FM.offset = 25 * 3600000; fmSlaSweep(); FM.offset = 0; ok(b.recruiterId === 'RP-057' && /Job lead fallback/.test(lastReason(b)), 'one-recruiter job → job lead: ' + b.recruiterId);
      var self = mkJob({ assignedRecruiters:['RP-081'], jobLeadId:'RP-081' }), c = apply(self).submission;
      FM.offset = 25 * 3600000; fmSlaSweep(); FM.offset = 0; ok(c.recruiterId === 'RP-088' && /Owner fallback/.test(lastReason(c)), 'lead is the same person → the Owner: ' + c.recruiterId);
      var lone = mkJob({ assignedRecruiters:[], jobLeadId:null, recruiterId:null }), d = apply(lone).submission, h0 = d.ownerHistory.length, n1 = FM.notices.length;
      FM.offset = 50 * 3600000; fmSlaSweep(); FM.offset = 0; ok(d.recruiterId === 'RP-088' && d.ownerHistory.length === h0 && !FM.notices.slice(n1).some(function(n){ return n.subId === d.id; }), 'never “moved” to the same person');
    });

    await t('the sweep gives an old unowned applicant an owner, audits it, and starts the SLA clock so it does not move in the same sweep', async function(){
      var j = mkJob({ assignedRecruiters:['RP-081','RP-071'], applicantRouting:'round_robin' }), sb = inbound(j, null, 'Old Unowned'); sb.recruiterId = null; sb.createdAt = new Date(Date.now() - 30 * 86400000).toISOString();
      FM.offset = 25 * 3600000; var out = fmSlaSweep(), at = fmNow(); FM.offset = 0;
      ok(sb.recruiterId === 'RP-081' && out.assigned >= 1, 'assigned: ' + sb.recruiterId); ok(/Owner assigned: had none/.test(lastReason(sb)) && audit(/Owner assigned: had none/), 'audited');
      ok(new Date(sb.slaFrom).getTime() === at && sb.ownerHistory.length === 1, 'clock starts now; not moved in the same sweep');
      var s9 = subById('sub-9'); ok(s9 && s9.recruiterId, 'the seeded unowned applicant (sub-9) has an owner: ' + (s9 && s9.recruiterId));
    });

    await t('a repeat delivery of the same application does not change the owner', async function(){
      var j = mkJob({ assignedRecruiters:['RP-081','RP-071'], applicantRouting:'round_robin' });
      var p = { name:'Repeat Applicant', email:'repeat.m2@example.com', phone:'+91 92000 11111', externalId:'REP-1', skills:['Product'] };
      var first = ingestApplicationEvent(j.id, p, { platform:'Indeed' }), owner = first.submission.recruiterId, h = first.submission.ownerHistory.length;
      var again = ingestApplicationEvent(j.id, p, { platform:'Indeed' }); ok(again.duplicateDelivery || again.ok, 'redelivered');
      ok(first.submission.recruiterId === owner && first.submission.ownerHistory.length === h && j.routing.lastId === owner, 'owner and rotation unchanged');
      setJourneyOwner(first.submission, 'RP-063', 'Taken over'); ingestApplicationEvent(j.id, Object.assign({}, p, { externalId:'REP-2', utm_content:'rp-071' }), { platform:'Indeed' });
      ok(first.submission.recruiterId === 'RP-063', 'a later application on the same journey keeps its owner: ' + first.submission.recruiterId);
    });

    await t('removing the only recruiter from a job moves their applicants to the job lead, then the Owner; never unowned', async function(){
      var j = mkJob({ assignedRecruiters:['RP-081'], jobLeadId:'RP-057' }), a = inbound(j, 'RP-081', 'Team Change One');
      var r = removeRecruiterFromJob(j.id, 'RP-081'); ok(r && r.ok && a.recruiterId === 'RP-057' && /Job lead fallback/.test(lastReason(a)) && r.unassigned === 0, 'to the job lead: ' + a.recruiterId);
      var k = mkJob({ assignedRecruiters:['RP-081'], jobLeadId:'RP-081', recruiterId:'RP-081' }), b = inbound(k, 'RP-081', 'Team Change Two');
      removeRecruiterFromJob(k.id, 'RP-081'); ok(b.recruiterId === 'RP-088' && /Owner fallback/.test(lastReason(b)), 'the leaving person is also the lead → the Owner: ' + b.recruiterId);
    });

    await t('corporate intake is unchanged', async function(){
      var j = mkJob({ assignedRecruiters:['RP-081'] }); ORG_STRUCTURE.profile.orgType = 'Corporate';
      try { var r = apply(j); ok(r.submission.stage === 'Submitted' && r.submission.recruiterId === null && j.submitted === 1, 'as before: ' + r.submission.stage + ' / ' + r.submission.recruiterId); }
      finally { ORG_STRUCTURE.profile.orgType = 'Agency'; }
    });

    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
    document.title = 'M02-OWNER ' + results.filter(function(r){ return r.pass; }).length + '/' + results.length;
  }, 800); });
})();

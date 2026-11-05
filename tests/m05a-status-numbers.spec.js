/* M5a · One status list, part 1 (B14, B20 · flow map 18, 20): the numbers.
   One status per candidate on a job (journeyStatus), sent counted only from the send record (journeySent), portal applicants
   never sent, funnel and recruiter numbers from sends, placement states only in PayTrack, revenue from the client's terms
   (workspace default labelled), job sent counts computed, 'Offer Pending Approval' gone, seed stage/status mismatches corrected.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\m05a-status-numbers.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  var ce = console.error; console.error = function(){ errs.push('console.error ' + Array.prototype.slice.call(arguments).map(function(a){ return (a && a.stack) || (a && a.message) || String(a); }).join(' ').slice(0, 300)); };
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e.stack || e.message).slice(0, 500) }); } finally { state.role = 'admin'; viewingAsFromManager = false; managerViewAsRecruiterId = null; if(typeof csClose === 'function') csClose(); } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  var seq = 0;
  function mkCand(name){ seq++; var c = { id:98900 + seq, name:name || ('Status Candidate ' + seq), role:'Engineer', exp:'5 yrs', loc:'Pune, IN', skills:['Java'], email:'m5c' + seq + '@example.com', phone:'+91 97100 ' + String(10000 + seq), salary:'₹14–16 LPA', notice:'30 Days', organizationId:CURRENT_ORGANIZATION_ID }; CANDIDATES.push(c); return c; }
  function mkSub(job, c, patch){ seq++; var at = new Date().toISOString(); var sb = Object.assign({ id:'m5-sub-' + seq, candidateId:c.id, jobId:job.id, recruiterId:'RP-081', stage:'Recommended', status:submissionStatusFor('Recommended'), source:'Sourced', createdAt:at, updatedAt:at, stageHistory:[{ stage:'Recommended', at:at, reason:'test' }], ownerHistory:[] }, patch || {}); SUBMISSIONS.push(sb); return sb; }
  function st(sb){ return journeyStatus(sb); }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var signInRendered = !!document.getElementById('oontu-auth'), bootErrors = (window.__bootErrors || []).slice();
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'admin'; enterApp(); await sleep(100);

    await t('the page loads with no errors except the known insertBefore one, and the sign-in screen renders', async function(){
      var other = bootErrors.filter(function(m){ return !/insertBefore/.test(m); });
      ok(!other.length, 'load errors: ' + other.join(' | '));
      ok(signInRendered, 'sign-in screen rendered on open (authBoot ran)');
    });
    var j1 = jobById('j1');

    await t('the five seed stage/status mismatches are corrected through moveSubmissionStage, and audited', async function(){
      ok(SUBMISSIONS.every(function(s){ return s.status === submissionStatusFor(s.stage); }), 'no journey left with a status that disagrees with its stage');
      ['sub-ap-2', 'sub-ap-8'].forEach(function(id){ var s = SUBMISSIONS.find(function(x){ return x.id === id; }); ok(s.stage === 'Pending Review' && s.status === 'in_review' && st(s).key === 'in_review' && !journeySent(s), id + ' back in review (never sent, review waiting)'); });
      ['sub-iv-1', 'sub-iv-2', 'sub-iv-3'].forEach(function(id){ var s = SUBMISSIONS.find(function(x){ return x.id === id; }); ok(s.stage === 'Submitted' && s.status === 'submitted' && st(s).key === 'with_client', id + ' with client'); });
      ok(AUDIT_LOG.filter(function(a){ return /Status corrected/.test(a.detail || ''); }).length === 5, 'five audit entries');
    });

    await t('no journey has history at Shortlisted, Interview, Offer or Joined unless it was sent', async function(){
      var bad = SUBMISSIONS.filter(function(s){ return !journeySent(s) && (s.stageHistory || []).some(function(h){ return /^(Shortlisted|Interview|Feedback|Offer|Joined|Selected)/.test(h.stage); }); });
      ok(!bad.length, bad.map(function(s){ return s.id; }).join());
    });

    await t('statuses before sending: Applied, Sourced, Screening once opened, Ready once the candidate agreed (M7), Not reachable', async function(){
      var a = mkSub(j1, mkCand(), { source:'Candidate Portal', stage:'Applied Directly', status:submissionStatusFor('Applied Directly') });
      ok(st(a).key === 'applied' && st(a).label === 'Applied', 'portal applicant, unopened: Applied — ' + st(a).label);
      var s = mkSub(j1, mkCand()); ok(st(s).key === 'sourced', 'sourced, unopened: Sourced — ' + st(s).label);
      a.openedAt = new Date().toISOString(); s.openedAt = a.openedAt;
      ok(st(a).key === 'screening' && st(s).key === 'screening' && st(s).label === 'Screening', 'opened by the owner: Screening');
      var cr = mkCand(); cr.reach = { state:'not_reachable' }; var nr = mkSub(j1, cr); ok(st(nr).key === 'not_reachable', 'not reachable');
      var cmp = CAMPAIGNS.find(function(c){ return c.jobId === 'j1'; }); ok(cmp, 'a campaign on j1');
      var cc = mkCand(); CAMPAIGN_PEOPLE.push({ id:'m5-cp-' + seq, campaignId:cmp.id, candidateId:cc.id, state:'ready' }); var rd = mkSub(j1, cc);
      ok(st(rd).key !== 'ready', 'a campaign pre-screen alone is not Ready (M7): ' + st(rd).label); recordConsentCall(rd, 'Called the candidate, agreed'); ok(st(rd).key === 'ready' && st(rd).label === 'Ready', 'agreed and required fields complete: Ready — ' + st(rd).label);
    });

    await t('statuses after: In review, Ready to send, With client, Interviewing · round, Rejected at round, Offer made (waiting for approval), Offer accepted, Joined, Backed out, On hold', async function(){
      var base = function(stage, patch){ return mkSub(j1, mkCand(), Object.assign({ stage:stage, status:submissionStatusFor(stage) }, patch || {})); };
      ok(st(base('Pending Review')).key === 'in_review', 'in review');
      ok(st(base('Ready to Send')).key === 'ready_to_send', 'ready to send');
      var sent = { at:new Date().toISOString(), by:'Priya Sharma', to:['Client'] };
      ok(st(base('Submitted', { sent:sent })).label === 'With client', 'with client');
      var iv = base('Interview Scheduled', { sent:sent, processStage:1 }); ok(st(iv).key === 'interviewing' && /^Interviewing · /.test(st(iv).label), 'interviewing with the round: ' + st(iv).label);
      var rj = base('Rejected', { sent:sent, rejectedBy:'Client', steps:{ 1:{ outcome:'Not cleared' } } }); var round = jobProcessStages(j1)[1];
      ok(st(rj).key === 'rejected_round' && st(rj).label === 'Rejected at ' + round, 'rejected at the round: ' + st(rj).label);
      ok(st(base('Rejected', { sent:sent, rejectedBy:'Client' })).key === 'rejected_client', 'rejected by client');
      ok(st(base('Offer Extended', { sent:sent, offer:{ status:'Pending approval' } })).label === 'Offer made · waiting for approval', 'offer waiting for approval');
      ok(st(base('Offer Extended', { sent:sent, offer:{ status:'Made' } })).label === 'Offer made', 'offer made');
      ok(st(base('Offer Accepted', { sent:sent, offer:{ status:'Accepted' } })).key === 'offer_accepted', 'offer accepted');
      ok(st(base('Joined', { sent:sent })).key === 'joined', 'joined');
      ok(st(base('Withdrawn', { sent:sent, droppedBy:'Candidate' })).key === 'backed_out', 'backed out');
      ok(st(base('Withdrawn', { sent:sent, offer:{ status:'Declined' } })).key === 'offer_declined', 'offer declined');
      ok(st(base('Submitted', { sent:sent, hold:{ reason:'Client paused' } })).key === 'on_hold', 'on hold');
    });

    await t('portal applicants never count as sent; the only history-only send is the older sourced journey on j5', async function(){
      var a = mkSub(j1, mkCand(), { source:'Naukri', stage:'Submitted', status:submissionStatusFor('Submitted'), stageHistory:[{ stage:'Submitted', at:new Date().toISOString(), reason:'applied' }] });
      ok(!journeySent(a) && flowReachedAt(a, 'sent') === null, 'an applicant at Submitted with no send record is not sent');
      var legacy = SUBMISSIONS.filter(function(s){ return !s.sent && journeySent(s) && !/^m5-/.test(s.id); });
      ok(legacy.length === 1 && legacy[0].jobId === 'j5' && !isInboundSource(legacy[0].source), 'one legacy send on j5: ' + legacy.map(function(s){ return s.id + ' ' + s.jobId; }).join());
    });

    await t('funnel, recruiter score and quality funnel count sends from the send record', async function(){
      var subs = SUBMISSIONS.filter(function(s){ return !/^m5-/.test(s.id); });
      var f = flowFunnel(subs), sentRow = f.find(function(r){ return /Sent/.test(r.label); });
      ok(sentRow && sentRow.n === subs.filter(journeySent).length, 'Sent to client = journeys with a send: ' + (sentRow && sentRow.n));
      var priya = RECRUITER_ROSTER.find(function(r){ return r.name === 'Priya Sharma'; }), mine = subs.filter(function(s){ return s.recruiterId === priya.id; });
      ok(computeRecruiterQualityFunnel('Priya Sharma').submissions === SUBMISSIONS.filter(function(s){ return s.recruiterId === priya.id && journeySent(s); }).length, 'dashboard "Submitted" counts sends, not every journey owned (' + mine.length + ' owned)');
      ['Priya Sharma', 'Divya Menon'].forEach(function(n){ var r = RECRUITER_ROSTER.find(function(x){ return x.name === n; }), own = SUBMISSIONS.filter(function(s){ return journeySent(s) && (s.recruiterId === r.id || (s.sent && s.sent.by === n)); }).length;
        ok(computeRecruiterScore(n).outreachVolume === Math.min(100, own * 10), n + ': outreach from their own sends (' + own + ')'); });
      ok(computeRecruiterScore('Priya Sharma').sentCount === SUBMISSIONS.filter(function(s){ return s.recruiterId === priya.id && journeySent(s); }).length, 'score sentCount from sends');
    });

    await t('placement states live in PayTrack, not in the journey stage; the candidate page still shows them', async function(){
      ok(PIPELINE_STAGE_ORDER.indexOf('Lock-in Completed') < 0 && PIPELINE_STAGE_ORDER.indexOf('Revenue at Risk') < 0, 'not in the stage order');
      ok(!SUBMISSIONS.some(function(s){ return ['Lock-in Completed', 'Revenue at Risk', 'Offer Pending Approval'].indexOf(s.stage) > -1; }), 'no journey stored at a placement state');
      var p = PAYTRACK_COMPLETED[0]; ok(p, 'a completed placement'); var c = mkCand(p.name);
      var e = candidatePipelineEntries(c).find(function(x){ return x.job === p.role && x.company === p.client; });
      ok(e && e.stage === 'Joined' && e.placement === 'Lock-in Completed' && e.nextAction === 'Placement complete — billing eligible', 'completed placement: Joined, Lock-in Completed from PayTrack ' + JSON.stringify(e && { stage:e.stage, placement:e.placement }));
      var r = PAYTRACK_AT_RISK[0]; if(r){ var c2 = mkCand(r.name); var e2 = candidatePipelineEntries(c2).find(function(x){ return x.job === r.role && x.company === r.client; });
        ok(e2 && e2.stage === 'Joined' && e2.placement === 'Revenue at Risk' && e2.nextAction === 'Review in PayTrack immediately', 'at-risk placement from PayTrack'); }
    });

    await t('revenue comes from the client terms; with no terms, the workspace default is labelled', async function(){
      var hj = JOBS.find(function(j){ var c = clientForJob(j); return c && c.name === 'HealthAI'; }), f = revenueFeeFor(hj, 32);
      ok(f.basis === 'terms' && f.amount === 384000 && /12%/.test(f.line), 'HealthAI 12% of ₹32L: ' + JSON.stringify(f));
      var d = revenueFeeFor({ id:'none', title:'No client', client:'Nobody Ltd' }, 10);
      ok(d.basis === 'default' && d.line === 'Workspace default 8.33%' && d.amount === 83300, 'default labelled: ' + JSON.stringify(d));
      var expect = offersList().filter(function(o){ return o.status === 'Offer Accepted' || o.status === 'Joined'; }).reduce(function(s, o){ return s + offerRevenue(o).amount; }, 0);
      ok(computeRevenue() === expect, 'computeRevenue sums the terms');
      var cmp = CAMPAIGNS.find(function(c){ return c.jobId === 'j1'; }), fee = clJobExpected(jobById(cmp.jobId));
      ok(fee && fee.client && fee.line && !/middle of the pay range/.test(fee.client + '’s terms: ' + fee.line), 'campaign fee per hire describes the client terms: ' + (fee && fee.client + '’s terms: ' + fee.line));
    });

    await t('job sent counts are computed from sends; the stored job.submitted is not read', async function(){
      var j4 = jobById('j4'), was = j4.submitted;
      ok(jobSentCount(j4) === submissionsForJob('j4').filter(journeySent).length, 'computed');
      var need = jobNeedsAttention(j4); j4.submitted = 99; ok(jobNeedsAttention(j4) === need, 'job.submitted no longer changes the answer'); j4.submitted = was;
      var expect = { j1:6, j2:5, j3:1, j4:6, j5:3, j6:1, j7:2, j8:2, j9:1 };
      Object.keys(expect).forEach(function(id){ var n = submissionsForJob(id).filter(function(s){ return !/^m5-/.test(s.id) && journeySent(s); }).length; ok(n === expect[id], id + ' sent ' + n + ', expected ' + expect[id]); });
    });

    await t('"Offer Pending Approval" is gone from filters and labels; screens read the status (M5b); the briefing counts offers', async function(){
      ok(!('Offer Pending Approval' in LINEUP_STAGE_LABELS) && !('Offer Pending Approval' in O_STAGE_LABEL) && !('Offer Pending Approval' in STAGE_NEXT_ACTION), 'no label');
      var rs = SUBMISSIONS.find(function(x){ return x.stage === 'Ready to Send'; }); ok(rs && /^(Ready to send|Waiting for .+’s yes|No answer · call them|Not asked yet)$/.test(pipeLabel(rs).text) && pipeLabel(rs).text === journeyStatus(rs).label, 'labels from the status (M5b): ' + pipeLabel(rs).text);
      var waiting = SUBMISSIONS.filter(function(x){ return x.offer && x.offer.status === 'Pending approval'; }).length;
      var line = computeTodaysBriefing().critical.find(function(c){ return /waiting on approval/.test(c.text); });
      ok(waiting ? (line && line.text.indexOf(waiting + ' offer') === 0 && /approval-center/.test(line.onclick)) : !line, 'briefing: ' + waiting + ' offers waiting');
      ok(MATCH_MODEL === 'skills', 'MATCH_MODEL stays skills');
    });

    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
    document.title = 'M05A ' + results.filter(function(r){ return r.pass; }).length + '/' + results.length;
  }, 800); });
})();

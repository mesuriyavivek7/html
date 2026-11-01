/* M5b · One status list, part 2 (B14 · flow map 18): every list, filter and label reads journeyStatus.
   Who ended a journey (client, candidate, agency), job chips with today's detail, Talent Pool "In review" tab, the six-step
   Lineup progress, filters and board columns by status (no drag), candidate entries and next actions, the candidate's own
   view, job page counts, and the two interviews cancelled for journeys never sent.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\m05b-status-everywhere.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  var ce = console.error; console.error = function(){ errs.push('console.error ' + Array.prototype.slice.call(arguments).map(function(a){ return (a && a.stack) || (a && a.message) || String(a); }).join(' ').slice(0, 300)); };
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e.stack || e.message).slice(0, 500) }); } finally { state.role = 'admin'; viewingAsFromManager = false; managerViewAsRecruiterId = null; ORG_STRUCTURE.profile.orgType = 'Agency'; } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  var seq = 0, STORED = /Pending Review|Interview Scheduled|Applied Directly|Ready to Send|Offer Extended|Feedback Given/;
  function mkCand(){ seq++; var c = { id:99100 + seq, name:'Status Five ' + seq, role:'Engineer', exp:'5 yrs', loc:'Pune, IN', skills:['Java'], email:'m5b' + seq + '@example.com', phone:'+91 97200 ' + String(10000 + seq), salary:'₹14–16 LPA', notice:'30 Days', organizationId:CURRENT_ORGANIZATION_ID }; CANDIDATES.push(c); return c; }
  function mkSub(stage, patch){ seq++; var at = new Date().toISOString(); var c = mkCand(); var sb = Object.assign({ id:'m5b-sub-' + seq, candidateId:c.id, jobId:'j1', recruiterId:'RP-081', stage:stage, status:submissionStatusFor(stage), source:'Sourced', createdAt:at, updatedAt:at, stageHistory:[{ stage:stage, at:at, reason:'test' }], ownerHistory:[] }, patch || {}); SUBMISSIONS.push(sb); return sb; }
  var sent = function(){ return { at:new Date(Date.now() - 86400000).toISOString(), by:'Priya Sharma', to:['Client'] }; };
  function hist(stage, reason){ return [{ stage:stage, at:new Date().toISOString(), reason:reason }]; }
  function html(h){ var d = document.createElement('div'); d.innerHTML = h; return d; }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'admin'; enterApp(); await sleep(100);

    await t('who ended it: the client, the candidate or the agency', async function(){
      var k = function(sb){ return journeyStatus(sb).key; };
      ok(k(mkSub('Rejected', { sent:sent(), rejectedBy:'Client' })) === 'rejected_client', 'rejectedBy Client');
      ok(k(mkSub('Rejected', { sent:sent(), rejectReason:{ code:'client', label:'Client rejected' } })) === 'rejected_client', 'reason code client');
      ok(k(mkSub('Rejected', { sent:sent(), clientFeedback:{ decision:'Rejected' } })) === 'rejected_client', 'client feedback');
      ok(k(mkSub('Rejected', { sent:sent(), stageHistory:hist('Rejected', 'Hiring manager decision via link'), rejectReason:{ code:'skills', by:'Hiring manager' } })) === 'rejected_client', 'company workspace: the hiring manager');
      var r = mkSub('Rejected', { sent:sent(), rejectedBy:'Client', steps:{ 1:{ outcome:'Not cleared' } } }); ok(journeyStatus(r).label === 'Rejected at ' + jobProcessStages(jobById('j1'))[1], 'a round: ' + journeyStatus(r).label);
      ok(k(mkSub('Rejected', { rejectReason:{ code:'not_interested' } })) === 'not_interested', 'candidate, before sending: Not interested');
      ok(k(mkSub('Withdrawn', { sent:sent(), droppedBy:'Candidate' })) === 'backed_out', 'candidate, after sending: Backed out');
      ok(k(mkSub('Rejected', { rejectReason:{ code:'skills', label:'Skills do not match' } })) === 'not_suitable', 'agency: Not suitable');
      ok(k(mkSub('Rejected', { rejectReason:{ code:'not_reachable' } })) === 'not_reachable', 'agency: Not reachable');
      var sbk = mkSub('Withdrawn', { stageHistory:hist('Withdrawn', 'Sent back by Arjun Kapoor: fit') }); ok(pipeLabel(sbk).text === 'Not suitable · sent back in review', pipeLabel(sbk).text);
      ok(k(mkSub('Withdrawn', { sent:sent(), stageHistory:hist('Withdrawn', 'Withdrawn by recruiter') })) === 'withdrawn', 'agency withdrew');
    });

    await t('every journey chip starts with its status; today\'s detail follows', async function(){
      SUBMISSIONS.forEach(function(sb){ ok(pipeLabel(sb).text.indexOf(journeyStatus(sb).label) === 0, sb.id + ': ' + pipeLabel(sb).text + ' / ' + journeyStatus(sb).label); ok(!STORED.test(pipeLabel(sb).text), 'no stored stage name: ' + pipeLabel(sb).text); });
      var chase = SUBMISSIONS.find(function(sb){ return /no feedback \d+d$/.test(pipeLabel(sb).text); }); ok(chase && /^With client · no feedback \d+d$/.test(pipeLabel(chase).text), 'no feedback detail: ' + (chase && pipeLabel(chase).text));
      var iv = SUBMISSIONS.find(function(sb){ return / · (Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/.test(pipeLabel(sb).text); }); ok(iv && /^Interviewing · .+ · \w{3}$/.test(pipeLabel(iv).text), 'interview day detail');
    });

    await t('Talent Pool: the "In review" tab, buckets from the status', async function(){
      ok(TP_STAGES.map(function(x){ return x[1]; }).join() === 'All active,In review,With client,Interviewing,Offer,Joining,Closed', TP_STAGES.map(function(x){ return x[1]; }).join());
      var expect = { in_review:'submitted', ready_to_send:'submitted', with_client:'client', shortlisted:'client', interviewing:'interview', offer_made:'offer', offer_accepted:'joining', joined:'joining', not_suitable:'closed', rejected_client:'closed', applied:'applied' };
      SUBMISSIONS.forEach(function(sb){ var key = journeyStatus(sb, { underHold:true }).key; if(expect[key]) ok(tpPipeBucket(sb) === expect[key], sb.id + ' ' + key + ' → ' + tpPipeBucket(sb)); });
    });

    await t('Lineup: six steps, filters and board columns are statuses, no drag', async function(){
      ok(LINEUP_CANON_STAGES.join() === 'Applied,In review,With client,Interview,Offer,Joined', LINEUP_CANON_STAGES.join());
      var opts = lineupStageOptions(); ok(opts[0] === 'All' && opts.slice(1).every(function(o){ return Object.keys(JOURNEY_STATUS_LABEL).some(function(k){ return JOURNEY_STATUS_LABEL[k] === o; }); }), 'filters are status labels: ' + opts.join());
      lineupViewMode = 'board'; var b = html(lineupTableHTML()); lineupViewMode = 'list';
      ok(!b.querySelector('[draggable]') && !b.querySelector('[ondrop]'), 'no drag');
      ok(!STORED.test(b.textContent), 'no stored stage names on the board');
      ok(!STORED.test(html(lineupTableHTML()).textContent), 'no stored stage names in the list');
    });

    await t('candidate entries show the status and the next action by status; Ready → "Submit to the job"', async function(){
      var n = 0;
      CANDIDATES.forEach(function(c){ candidatePipelineEntries(c).forEach(function(e){ var sb = e.jobId ? findSubmission(e.jobId, c.id) : null; if(!sb || e.placement) return; n++;
        var js = journeyStatus(sb); ok(e.label === js.label && e.nextAction === journeyNextAction(js), c.name + ': ' + e.label + ' / ' + e.nextAction); }); });
      ok(n > 20, n + ' entries checked');
      ok(JOURNEY_NEXT_ACTION.ready === 'Submit to the job', 'Ready next action');
      var ready = mkSub('Recommended'); recordConsentCall(ready, 'Called the candidate, agreed'); var e = candidatePipelineEntries(byId(ready.candidateId)).find(function(x){ return x.jobId === ready.jobId; });
      ok(e.label === 'Ready' && e.nextAction === 'Submit to the job', 'a Ready candidate: ' + e.label + ' / ' + e.nextAction);
    });

    await t('the candidate sees their own view: no internal steps, no who said no', async function(){
      var lab = function(sb){ return html(oStageBadge(sb)).textContent.trim(); };
      ok(lab(mkSub('Submitted', { sent:sent() })) === 'Shared with the employer', 'with client');
      ok(lab(mkSub('Ready to Send')) === 'In review', 'ready to send');
      ok(lab(mkSub('Recommended')) === 'Applied', 'sourced');
      ok(lab(mkSub('Rejected', { sent:sent(), rejectedBy:'Client' })) === 'Not selected' && lab(mkSub('Rejected', { rejectReason:{ code:'skills' } })) === 'Not selected', 'every rejection: Not selected');
      SUBMISSIONS.forEach(function(sb){ ok(!/Sourced|Screening|Ready to send|Not suitable|Rejected by|Rejected at/.test(lab(sb)), sb.id + ': ' + lab(sb)); });
    });

    await t('job page counts are the six status groups; closed journeys are not counted', async function(){
      var j = jobById('j1'), d = html(jobPipelineHealthStripHTML(j)), labels = Array.from(d.querySelectorAll('button p:last-child')).map(function(p){ return p.textContent; });
      ok(labels.join() === JOURNEY_GROUPS.join(), labels.join());
      var counts = jobStatusGroupCounts(jobJourneysInScope(j)), open = jobJourneysInScope(j).filter(function(sb){ return journeyGroup(sb) > -1; }).length;
      ok(Object.keys(counts).reduce(function(a, k){ return a + counts[k]; }, 0) === open, 'sum = open journeys');
    });

    await t('the two interviews for journeys never sent are cancelled and audited', async function(){
      ['sub-ap-2', 'sub-ap-8'].forEach(function(id){ var ivs = hmInterviews.filter(function(i){ return i.submissionId === id; });
        ok(ivs.length && ivs.every(function(i){ return i.status === 'Cancelled' && i.cancelReason === 'Candidate not yet sent to the client'; }), id + ' interviews cancelled'); });
      ok(AUDIT_LOG.filter(function(a){ return a.action === 'Interview cancelled: candidate not yet sent to the client'; }).length === 2, 'two audit lines');
    });

    await t('the Oontu jobs website is an inbound channel in an agency workspace only', async function(){
      ok(isInboundSource('Oontu jobs website'), 'agency: inbound');
      var a = mkSub('Applied Directly', { source:'Oontu jobs website' }); ok(!journeySent(a) && journeyStatus(a).label === 'Applied', 'agency applicant: Applied, not sent');
      ORG_STRUCTURE.profile.orgType = 'Corporate'; ok(!isInboundSource('Oontu jobs website'), 'company workspace: unchanged (corporate pass)');
    });

    await t('a company workspace keeps its pre-M5b words (option b); agency gets flow 18', async function(){
      var agency = SUBMISSIONS.map(function(sb){ return pipeLabel(sb).text; });
      ORG_STRUCTURE.profile.orgType = 'Corporate';
      SUBMISSIONS.forEach(function(sb){ ok(pipeLabel(sb).text === pipeLabelCorp(sb).text && journeyStatus(sb).label === pipeLabelCorp(sb).text, sb.id + ': ' + pipeLabel(sb).text); });
      ok(SUBMISSIONS.some(function(sb, i){ return pipeLabel(sb).text !== agency[i]; }), 'differs from agency where flow 18 changed the words');
      ok(lineupStageOptions().indexOf('Pending Review') > -1 || lineupStageOptions().indexOf('Interview Scheduled') > -1, 'corporate Lineup filters are the stored stages, as before');
      ok(html(tpPipeFiltersHTML()).querySelector('[role=tab]:nth-child(2)').textContent.indexOf('Submitted') === 0, 'Talent Pool tab still "Submitted"');
      ok(html(jobPipelineHealthStripHTML(jobById('j1'))).textContent.indexOf('Feedback') > -1, 'job page counts as before');
    });

    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
    document.title = 'M05B ' + results.filter(function(r){ return r.pass; }).length + '/' + results.length;
  }, 800); });
})();

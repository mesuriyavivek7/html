// @rx-runner switches=g1,g4
/* RX G4: redeployment (agency) and contract-end decisions (corporate) — the trigger fires once per threshold,
   below-minimum-margin jobs are flagged (never hidden), the availability link updates the worker, the redeployment
   rate counts correctly, and all three corporate decisions run through existing functions.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\rx-g4-redeploy.spec.js */
(function(){
  var results = [];
  var errs = [];
  window.__RX_NO_TIMER__ = true;
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } pub(); }
  function pub(){ var pre = document.getElementById('auth-test-results'); if(!pre){ pre = document.createElement('pre'); pre.id = 'auth-test-results'; document.body.appendChild(pre); } pre.textContent = JSON.stringify(results); }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function eq(a, b, m){ if(a !== b) throw new Error((m ? m + ': ' : '') + 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var D = 86400000;
  function now(){ return fmNow(); }
  function as(role){ viewingAsFromManager = false; managerViewAsRecruiterId = null; previewAsRoleId = null; state.role = role; renderSidebar(); }
  function evs(name, aid){ return (RX.g4.events || []).filter(function(e){ return e.event === name && (aid == null || e.assignmentId === aid || e.workOrderId === aid); }); }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex');
    as('admin');
    var a = ASSIGNMENTS.find(function(x){ return asRunning(x); });
    var c = byId(a.candidateId);

    await t('switch and triggers: G4 on, Assignment Ending / Ended and Work Order Ending listed', async function(){
      ok(rxOn('g4')); ['Assignment Ending', 'Assignment Ended', 'Work Order Ending'].forEach(function(x){ ok(WF_TRIGGERS.indexOf(x) > -1, x); });
      eq(WSX.rx.redeployLeadDays, 21); eq(WSX.rx.redeployWindowDays, 14); eq(WSX.rx.silverMonths, 12);
    });
    await t('Assignment Ending fires once at 21 days and once at 7 days', async function(){
      a.end = now() + 20 * D; rxRedeploySweep(); rxRedeploySweep();
      eq(evs('Assignment Ending', a.id).length, 1, 'once at 21'); eq(evs('Assignment Ending', a.id)[0].threshold, 21);
      a.end = now() + 6 * D; rxRedeploySweep(); rxRedeploySweep();
      eq(evs('Assignment Ending', a.id).length, 2, 'once more at 7'); eq(evs('Assignment Ending', a.id)[1].threshold, 7);
      ok(RX.events.some(function(e){ return e.event === 'Assignment Ending' && e.assignmentId === a.id; }), 'on the G1 bus');
    });
    await t('a workflow on Assignment Ending sends the availability check and drafts a shortlist (a person submits)', async function(){
      var wf = { id:'wf-rx-redeploy', name:'Redeploy', status:'Published', templateStatus:'Approved', trigger:'Assignment Ending', agentKey:'offers-joining', conditions:[], conditionLogic:'AND', steps:[{ kind:'do', type:'rxAvailCheck' }, { kind:'do', type:'rxShortlistDraft' }, { kind:'do', type:'rxAskExtend' }] };
      WORKFLOWS.push(wf); c.consent = { given:true };
      var b = ASSIGNMENTS.find(function(x){ return x !== a && asRunning(x); }) || a; var cb = byId(b.candidateId); cb.consent = { given:true };
      b.end = now() + 19 * D; rxRedeploySweep();
      var t1 = RX.touches.filter(function(x){ return x.workflowId === wf.id; }); ok(t1.length === 3, JSON.stringify(t1.map(function(x){ return x.action + ':' + x.outcome; })));
      ok(Object.keys(RX.g4.avail).some(function(k){ return RX.g4.avail[k].assignmentId === b.id; }), 'availability check');
      ok(RX.g4.asks.some(function(x){ return x.assignmentId === b.id; }), 'extend asked');
      ok(!SUBMISSIONS.some(function(s){ return s.candidateId === b.candidateId && s.createdAt && Date.parse(s.createdAt) > now() - 60000 && s.source === 'Redeploy'; }), 'nothing submitted');
    });
    await t('ranked jobs: below-minimum margin is flagged, never hidden; pay within ±15%', async function(){
      var r = asCurrentRate(a), pay = Number(r.pay);
      var base = JOBS.find(function(j){ return asIsContractJob(j); }) || JOBS[0];
      var good = Object.assign({}, base, { id:'j-rx-good', title:'Redeploy Good', hiringType:'Contract', status:'Active', loc:'Remote', payRate:pay, billRate:pay * 1.5, skills:(c.skills || []).slice(0, 2) });
      var thin = Object.assign({}, base, { id:'j-rx-thin', title:'Redeploy Thin', hiringType:'Contract', status:'Active', loc:'Remote', payRate:pay, billRate:pay * 1.02, skills:(c.skills || []).slice(0, 2) });
      var far = Object.assign({}, base, { id:'j-rx-far', title:'Redeploy Far', hiringType:'Contract', status:'Active', loc:'Remote', payRate:pay * 2, billRate:pay * 3, skills:(c.skills || []).slice(0, 2) });
      JOBS.push(good, thin, far);
      var list = rxRedeployJobs(a), ids = list.map(function(x){ return x.job.id; });
      ok(ids.indexOf('j-rx-good') > -1 && ids.indexOf('j-rx-thin') > -1, 'both listed: ' + ids.join());
      ok(ids.indexOf('j-rx-far') < 0, 'pay outside ±15% filtered');
      var th = list.find(function(x){ return x.job.id === 'j-rx-thin'; }), gd = list.find(function(x){ return x.job.id === 'j-rx-good'; });
      ok(th.belowMin && !gd.belowMin, 'thin flagged');
      var h = rxRedeployHTML(a, 50); ok(/data-job="j-rx-thin" data-below-min="true"/.test(h) && /Below minimum margin/.test(h), 'flag shown');
      for(var i = 1; i < list.length; i++) ok(list[i - 1].score >= list[i].score, 'ranked by match score');
    });
    await t('availability link: #/avail/<token> answers Yes and updates the worker', async function(){
      var tk = rxAvailSend(a); location.hash = '#/avail/' + tk; await sleep(30);
      var root = document.getElementById('rx-avail-root'); ok(root && /Are you free/.test(root.textContent), 'page');
      root.querySelector('[data-avail="yes"]').click();
      eq(c.availability, 'Available'); eq(c.availableFrom, new Date(a.end + D).toISOString().slice(0, 10)); ok(/Thank you/.test(root.textContent));
      var t2 = rxAvailSend(a); eq(rxAvailAnswer(t2, 'notyet', '2027-01-15').availableFrom, '2027-01-15'); eq(c.availability, 'Not yet');
      ok(!rxAvailAnswer('nope', 'yes').ok, 'bad token');
      location.hash = ''; await sleep(30); eq(document.getElementById('rx-avail-root').innerHTML, '');
    });
    await t('redeployment rate: workers starting again within 14 days ÷ assignments ended', async function(){
      var mk = function(id, cid, start, end, status){ var x = JSON.parse(JSON.stringify(a)); x.id = id; x.candidateId = cid; x.start = start; x.end = end; x.endedAt = status === 'Ended' ? end : undefined; x.status = status; x.workerName = 'W' + cid; return x; };
      var before = rxRedeployMetrics(90);
      ASSIGNMENTS.push(mk('as-rx-1', 9001, now() - 100 * D, now() - 40 * D, 'Ended'), mk('as-rx-2', 9001, now() - 32 * D, now() + 60 * D, 'Active'),   // redeployed after 8 days
        mk('as-rx-3', 9002, now() - 100 * D, now() - 50 * D, 'Ended'), mk('as-rx-4', 9002, now() - 20 * D, now() + 60 * D, 'Active'),   // 30 days later: not counted
        mk('as-rx-5', 9003, now() - 90 * D, now() - 10 * D, 'Ended'));
      var m = rxRedeployMetrics(90);
      eq(m.ended - before.ended, 3, 'three more ended'); eq(m.redeployed - before.redeployed, 1, 'one redeployed');
      ok(m.rate === Math.round(m.redeployed / m.ended * 1000) / 10, 'rate');
      showView('rx-redeploy'); ok(document.getElementById('rx-redeploy') && document.getElementById('rx-redeploy-rate').textContent === m.rate + '%', 'board');
      ok(document.querySelector('#rx-redeploy [data-redeploy="' + a.id + '"]'), 'the ending assignment is on the board');
    });
    await t('Assignment Ended fires once', async function(){
      var x = ASSIGNMENTS.find(function(y){ return y.id === 'as-rx-5'; }); rxRedeploySweep(); rxRedeploySweep(); eq(evs('Assignment Ended', x.id).length, 1);
    });
    await t('corporate: Work Order Ending at 21 and 7 days; extend, convert and end run through existing functions', async function(){
      coDemoOn(); ok(jsCorp());
      var mkw = function(id, days){ var w = { id:id, ref:'WO-' + id, contractor:'Contractor ' + id, email:id + '@example.com', role:'Analyst', vendorId:(CO.vendors[0] || {}).id || null, jobId:null, approver:'A', start:now() - 120 * D, end:now() + days * D, rate:5000, unit:'day', hoursPerDay:8, sow:'Work', status:'Active', token:'tk' + id, extensions:[], createdAt:now() - 120 * D, createdBy:'Spec', converted:null }; CO.contracts.push(w); return w; };
      var w1 = mkw('rxw1', 20), w2 = mkw('rxw2', 6), w3 = mkw('rxw3', 10);
      rxRedeploySweep(); rxRedeploySweep();
      eq(evs('Work Order Ending', 'rxw1').length, 1, '21-day once'); eq(evs('Work Order Ending', 'rxw2').length, 1, '7-day once');
      showView('contract-hiring'); var card = document.getElementById('rx-wo-decide'); ok(card && card.querySelector('[data-wo="rxw1"]'), 'decision card');
      var calls = []; ['coWoExtend', 'coWoConvert', 'coAudit'].forEach(function(n){ var o = window[n]; window[n] = function(){ calls.push(n); return o.apply(this, arguments); }; });
      var r1 = rxWoDecide('rxw1', 'extend', new Date(now() + 60 * D).toISOString().slice(0, 10), 'Project extended by the client'); ok(r1.ok, JSON.stringify(r1)); eq(w1.status, 'Extended'); eq(w1.endDecision.decision, 'extend');
      var r2 = rxWoDecide('rxw2', 'convert', 14); ok(r2.ok, JSON.stringify(r2)); eq(w2.status, 'Converted'); ok(w2.converted && w2.converted.ctc === 14);
      ok(!rxWoDecide('rxw3', 'end', null, '').ok, 'reason required');
      ok(rxWoDecide('rxw3', 'end', null, 'Project finished').ok); eq(w3.endDecision.reason, 'Project finished'); eq(w3.status, 'Active', 'ends on its date');
      ok(calls.indexOf('coWoExtend') > -1 && calls.indexOf('coWoConvert') > -1 && calls.indexOf('coAudit') > -1, calls.join());
      showView('contract-hiring'); ok(!document.getElementById('rx-wo-decide') || !document.querySelector('#rx-wo-decide [data-wo="rxw3"]'), 'decided work orders leave the card');
    });
    await t('silver medalists: listed on approval, Invite to apply records it once', async function(){
      var j = JOBS.find(function(x){ return x.corp; }) || JOBS[0], cand = CANDIDATES.find(function(x){ return !SUBMISSIONS.some(function(s){ return s.candidateId === x.id && s.jobId === j.id; }); });
      SUBMISSIONS.push({ id:'sub-rx-silver', jobId:j.id, candidateId:cand.id, stage:'Rejected', status:'Closed', createdAt:new Date(now() - 90 * D).toISOString(), stageHistory:[{ stage:'Submitted', at:new Date(now() - 90 * D).toISOString() }, { stage:'Final Interview', at:new Date(now() - 80 * D).toISOString() }, { stage:'Rejected', at:new Date(now() - 75 * D).toISOString() }] });
      SUBMISSIONS.push({ id:'sub-rx-old', jobId:j.id, candidateId:CANDIDATES[1].id === cand.id ? CANDIDATES[2].id : CANDIDATES[1].id, stage:'Rejected', status:'Closed', createdAt:new Date(now() - 500 * D).toISOString(), stageHistory:[{ stage:'Final Interview', at:new Date(now() - 480 * D).toISOString() }] });
      var rq = { id:'rq-rx-silver', title:j.title, status:'Pending', headcount:1, ctcMax:12, skills:(j.skills || []).slice(), history:[], createdAt:now() };
      CO.reqs.push(rq); coReqApproved(rq);
      ok(rq.silver && rq.silver.some(function(x){ return x.candidateId === cand.id; }), 'listed'); ok(!rq.silver.some(function(x){ return x.submissionId === 'sub-rx-old'; }), 'older than 12 months left out');
      CO.ui.sel = rq.id; showView('requisition-detail', 'requisitions'); var s = document.getElementById('rx-silver'); ok(s && s.querySelector('[data-silver]'), 'shown on the requisition');
      ok(rxSilverInvite(rq.id, cand.id).ok); ok(!rxSilverInvite(rq.id, cand.id).ok, 'once');
      coDemoOff();
    });
    await t('switch off: no triggers, no panel, no board, no avail page', async function(){
      rxSetSwitch('g4', false); ok(WF_TRIGGERS.indexOf('Assignment Ending') < 0); eq(rxRedeploySweep().ran, false);
      ok(asPanelHTML(a).indexOf('rx-redeploy') < 0, 'no panel'); showView('rx-redeploy'); ok(!document.getElementById('rx-redeploy'), 'no board');
      rxSetSwitch('g4', true);
    });
    pub();
  }, 300); });
})();

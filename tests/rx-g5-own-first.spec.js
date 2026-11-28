// @rx-runner switches=g2,g4,g5
/* RX G5: own talent first — exclusions apply, the direct sourcing window holds the vendor release and lifts it on
   time or by button, urgent roles skip the window, and a hire from the window appears in G2 as agency fees avoided.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\rx-g5-own-first.spec.js */
(function(){
  var results = [];
  var errs = [];
  window.__RX_NO_TIMER__ = true;
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } pub(); }
  function pub(){ var pre = document.getElementById('auth-test-results'); if(!pre){ pre = document.createElement('pre'); pre.id = 'auth-test-results'; document.body.appendChild(pre); } pre.textContent = JSON.stringify(results); }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function eq(a, b, m){ if(a !== b) throw new Error((m ? m + ': ' : '') + 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
  var D = 86400000;
  function now(){ return fmNow(); }
  function as(role){ viewingAsFromManager = false; managerViewAsRecruiterId = null; previewAsRoleId = null; state.role = role; renderSidebar(); }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex');
    as('admin');
    var job = JOBS.find(function(j){ return j.status === 'Active' && !j.corp && (j.skills || []).length; });
    /* three candidates who match the job: consent given / none / in an active process / contacted elsewhere */
    var pool = CANDIDATES.filter(function(c){ return computeJobMatchPct(c, job) > 0 && !SUBMISSIONS.some(function(s){ return s.candidateId === c.id && s.jobId === job.id; }); });
    var free = pool.find(function(c){ return !SUBMISSIONS.some(function(s){ return s.candidateId === c.id; }); }) || pool[0];
    var mk = function(base, id, name){ var c = JSON.parse(JSON.stringify(base)); c.id = id; c.name = name; c.consent = { given:true }; CANDIDATES.push(c); return c; };
    var cOk = mk(free, 99101, 'Own Ok'), cNo = mk(free, 99102, 'Own NoConsent'), cBusy = mk(free, 99103, 'Own Busy'), cRecent = mk(free, 99104, 'Own Recent');
    cNo.consent = null;
    var other = JOBS.find(function(j){ return j.id !== job.id; });
    SUBMISSIONS.push({ id:'sub-g5-busy', jobId:other.id, candidateId:cBusy.id, stage:'Client Interview', status:'Active', createdAt:new Date(now() - 40 * D).toISOString(), stageHistory:[{ stage:'Submitted', at:new Date(now() - 40 * D).toISOString() }] });
    RX.touches.push({ id:'TCH-g5-r', workflowId:'wf-x', candidateId:cRecent.id, jobId:other.id, channel:'email', action:'message', at:new Date(now() - 3 * D).toISOString(), outcome:'sent' });

    await t('agency: publishJob and re-opening build the shortlist; exclusions apply with reasons', async function(){
      ok(publishJob.__g5, 'publishJob wrapped');
      setJobStatus(job.id, 'On Hold', 'spec'); setJobStatus(job.id, 'Active');
      var L = RX.g5.lists[job.id]; ok(L && L.why === 'Re-opened', 'built on re-open');
      ok(L.list.length <= WSX.rx.dbFirstCount, 'at most 25');
      ok(L.list.some(function(x){ return x.candidateId === cOk.id; }), 'eligible one listed');
      var ex = function(c){ var e = L.excluded.find(function(x){ return x.candidateId === c.id; }); return e && e.reason; };
      eq(ex(cNo), 'No consent'); eq(ex(cBusy), 'In an active process'); eq(ex(cRecent), 'Contacted for another job in the last 14 days');
      for(var i = 1; i < L.list.length; i++) ok(L.list[i - 1].score >= L.list[i].score, 'ranked');
    });
    await t('agency: one action sends the new role and records touches; the job shows it', async function(){
      var r = rxDbFirstSend(job.id); ok(r.ok && r.sent === RX.g5.lists[job.id].list.length, JSON.stringify(r));
      ok(RX.touches.some(function(x){ return x.workflowId === 'rx-dbfirst' && x.candidateId === cOk.id && x.jobId === job.id; }), 'touch');
      eq(rxDbFirstSend(job.id).sent, 0, 'never twice');
      openJob(job.id); var s = document.getElementById('rx-dbfirst'); ok(s && /Placements from own database/.test(s.textContent), 'on the job');
      /* cOk joins: placements from own database and G2 credit */
      SUBMISSIONS.push({ id:'sub-g5-ok', jobId:job.id, candidateId:cOk.id, stage:'Joined', status:'Active', createdAt:new Date(now()).toISOString(), stageHistory:[{ stage:'Submitted', at:new Date(now() + 1000).toISOString() }, { stage:'Joined', at:new Date(now() + 2000).toISOString() }] });
      eq(rxDbFirstPlacements(job.id), 1);
      var res = rxResults({ days:30, now:now() + 5000, workflowIds:['rx-dbfirst'] }); ok(res.rows[0] && res.rows[0].name === 'Database-first shortlist' && res.rows[0].counts.joins === 1, JSON.stringify(res.rows[0] && res.rows[0].counts));
    });
    await t('corporate: the window holds the vendor release, shows its date, lifts on time', async function(){
      coDemoOn(); ok(jsCorp());
      var v = CO.vendors.find(function(x){ return x.status === 'Active'; });
      var rq = JSON.parse(JSON.stringify(CO.reqs[0])); delete rq.silver; Object.assign(rq, { id:'rq-g5', title:'Direct Analyst', status:'Approved', jobId:null, urgent:false, priority:'Medium', headcount:1, ctcMax:12, skills:(cOk.skills || []).slice(0, 3), history:[{ at:now(), by:'Spec', what:'Approved · budget reserved' }], createdAt:now() });
      CO.reqs.push(rq); coReqOpenJob(rq); var j = jobById(rq.jobId); ok(j, 'job opened');
      ok(j.rxDirectUntil && j.internalUntil >= j.rxDirectUntil, 'held'); var b = coAssignBlock(j, v, {}); eq(b && b.code, 'internal_first', 'vendors blocked');
      var wd = 0; for(var d = now() + D; d <= j.rxDirectUntil; d += D){ var w = new Date(d).getDay(); if(w && w !== 6) wd++; } eq(wd, 5, 'five working days');
      CO.ui.sel = rq.id; showView('requisition-detail', 'requisitions'); var s = document.getElementById('rx-direct'); ok(s && /Direct sourcing until/.test(s.textContent) && /Release to vendors now/.test(s.textContent), 'shown');
      ok(s.querySelector('[data-direct]'), 'own pool matched');
      var off0 = FM.offset; FM.offset += (Math.ceil((j.internalUntil - now()) / D) + 1) * D;
      var b2 = coAssignBlock(j, v, {}); ok(!b2 || b2.code !== 'internal_first', 'lifted on time: ' + JSON.stringify(b2));
      FM.offset = off0;
    });
    await t('corporate: Release to vendors now (reason required) lifts it; urgent roles skip; Owner may set 0', async function(){
      var rq = { id:'rq-g5b', title:'Direct Analyst B', status:'Approved', headcount:1, ctcMax:12, skills:['Excel'], history:[{ at:now(), by:'Spec', what:'Approved' }], createdAt:now(), location:'Pune', department:'Finance', raisedBy:'Spec HM', band:'B2' };
      CO.reqs.push(rq); coReqOpenJob(rq); var j = jobById(rq.jobId);
      coVendorEarlyOpen(j.id); document.getElementById('co-why').value = ''; coEarlyDo(j.id); ok(now() < j.internalUntil, 'no reason, still held');
      coVendorEarlyOpen(j.id); document.getElementById('co-why').value = 'Hiring manager needs vendors now'; coEarlyDo(j.id); ok(j.internalUntil <= now(), 'released');
      var u = { id:'rq-g5u', title:'Urgent Analyst', status:'Approved', urgent:true, headcount:1, ctcMax:12, skills:['Excel'], history:[{ at:now(), what:'Approved' }], createdAt:now(), location:'Pune', department:'Finance', raisedBy:'Spec HM', band:'B2' };
      CO.reqs.push(u); coReqOpenJob(u); var ju = jobById(u.jobId); ok(!ju.rxDirectUntil, 'urgent: no window'); eq(RX.g5.direct[u.id].skipped, 'Urgent');
      WSX.rx.directWindowDays = 0; var z = { id:'rq-g5z', title:'Zero Analyst', status:'Approved', headcount:1, ctcMax:12, skills:['Excel'], history:[{ at:now(), what:'Approved' }], createdAt:now(), location:'Pune', department:'Finance', raisedBy:'Spec HM', band:'B2' };
      CO.reqs.push(z); coReqOpenJob(z); ok(!jobById(z.jobId).rxDirectUntil, 'window 0'); WSX.rx.directWindowDays = 5;
    });
    await t('corporate: a hire from the window appears in G2 as agency fees avoided (estimate)', async function(){
      var rq = CO.reqs.find(function(r){ return r.id === 'rq-g5'; }), j = jobById(rq.jobId), c = CANDIDATES.find(function(x){ return x.id === 99101; });
      ok(rxDirectInvite(rq.id, c.id).ok); ok(!rxDirectInvite(rq.id, c.id).ok, 'once');
      SUBMISSIONS.push({ id:'sub-g5-hire', jobId:j.id, candidateId:c.id, stage:'Joined', status:'Active', source:'Direct', createdAt:new Date(now() + 1000).toISOString(), stageHistory:[{ stage:'Submitted', at:new Date(now() + 1000).toISOString() }, { stage:'Joined', at:new Date(now() + 2000).toISOString() }], offer:{ ctc:12, status:'Accepted', at:new Date(now() + 1500).toISOString() } });
      var res = rxResults({ days:30, now:now() + 5000, workflowIds:['rx-direct'] }), r = res.rows[0], dbg = JSON.stringify(rxAttribute({ candidateId:c.id, at:new Date(now() + 1000).toISOString() })) + ' touches ' + JSON.stringify(RX.touches.filter(function(x){ return x.candidateId === c.id; }).map(function(x){ return x.workflowId + '@' + x.at; }));
      ok(res.corporate && r && r.name === 'Direct sourcing window' && r.records.joins.some(function(x){ return x.submissionId === 'sub-g5-hire'; }), JSON.stringify(r && r.counts) + dbg);
      var m = r.records.joins.find(function(x){ return x.submissionId === 'sub-g5-hire'; }).money; ok(m && m.kind === 'avoided' && m.estimate && Math.round(m.amount) === Math.round(12 * 100000 * 8.33 / 100), JSON.stringify(m));
      coDemoOff();
    });
    await t('switch off: no shortlist on re-open, no window on a new requisition', async function(){
      rxSetSwitch('g5', false); delete RX.g5.lists[job.id]; setJobStatus(job.id, 'On Hold', 'spec'); setJobStatus(job.id, 'Active'); ok(!RX.g5.lists[job.id], 'no list');
      coDemoOn(); var rq = { id:'rq-g5off', title:'Off Analyst', status:'Approved', headcount:1, ctcMax:12, skills:['Excel'], history:[{ at:now(), what:'Approved' }], createdAt:now(), location:'Pune', department:'Finance', raisedBy:'Spec HM', band:'B2' };
      CO.reqs.push(rq); coReqOpenJob(rq); ok(!jobById(rq.jobId).rxDirectUntil, 'no window'); coDemoOff();
      rxSetSwitch('g5', true);
    });
    pub();
  }, 300); });
})();

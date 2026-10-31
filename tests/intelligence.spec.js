/* Intelligence from real history: flow analytics, honest Reports, per-recruiter score, match explanation, stalled journeys.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\intelligence.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var q = function(s){ return document.querySelector(s); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e.stack || e.message).slice(0, 500) }); } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function as(role){ state.role = role; previewAsRoleId = null; renderSidebar(); }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'admin'; enterApp(); await sleep(100);

    await t('flowFunnel counts steps from stageHistory; later stages count for earlier steps; dwell reports its sample size', async function(){
      var sb = { source:'Talent Pool', stageHistory:[{ stage:'Submitted', at:'2026-01-01T10:00:00Z' }, { stage:'Offer Extended', at:'2026-01-11T10:00:00Z' }] };
      var f = flowFunnel([sb]); ok(f[0].n === 1 && f[1].n === 1 && f[2].n === 1 && f[3].n === 1 && f[4].n === 0 && f[5].n === 0, 'steps: ' + JSON.stringify(f.map(function(x){ return x.n; })));
      var d = flowDwellDays([sb], 'sent', 'offer'); ok(d.avg === 10 && d.n === 1, 'ten days, n=1: ' + JSON.stringify(d));
      ok(flowDwellDays([], 'sent', 'offer').avg === null, 'no data gives no average');
    });
    await t('Reports shows no invented figures and has the conversion card', async function(){
      as('admin'); var html = renderReports();
      ['Efficiency Score', 'Avg Time to Submit', 'benchmark'].forEach(function(s){ ok(html.indexOf(s) === -1, 'removed: ' + s); });
      ok(html.indexOf('STAGE CONVERSION') > -1, 'conversion card'); ok(html.indexOf('Avg days to join') > -1, 'computed day cards');
      showView('reports'); await sleep(20); ok(!/Something went wrong/.test(q('#main-content').textContent), 'renders');
    });
    await t('recruiter score is counted from the recruiter’s own submissions', async function(){
      var a = computeRecruiterScore('Priya Sharma'); ok(typeof a.sentCount === 'number', 'sentCount reported');
      var f = flowFunnel(SUBMISSIONS.filter(function(s){ return s.recruiterId === 'RP-088'; })); ok(a.sentCount === f[0].n, 'matches the funnel');
    });
    await t('a journey with no movement for 7+ days shows in Intelligence as a rule, not a prediction', async function(){
      var c = CANDIDATES[0], sb = createSubmission('j1', c.id, { source:'Test', stage:'Submitted' }) || findSubmission('j1', c.id);
      sb.updatedAt = new Date(Date.now() - 9 * 86400000).toISOString(); sb.hold = null;
      ok(flowStalled(7).some(function(x){ return x.sb === sb; }), 'stalled list has it');
      ok(/Rule: no stage change in 7\+ days/.test(JSON.stringify(intelBottlenecks())), 'the item says it is a rule');
    });
    await t('match explanation adds notice and pay lines; the percentage is unchanged', async function(){
      var c = { skills:['Java'], exp:'5 yrs', loc:'Pune', notice:'60 Days', salary:'₹30–34 LPA' };
      var job = { skills:['Java'], preferredSkills:[], minExp:'3 yrs', loc:'Pune', comp:{ currency:'INR', fixedMax:2500000 } };
      ok(computeJobMatchPct(c, job) === 100, 'percentage'); var m = computeMatchReasoning(c, job);
      ok(/60 days/.test(m.noticeSignal) && /above/.test(m.compSignal), 'lines: ' + m.noticeSignal + ' | ' + m.compSignal);
      ok(/not predictions/.test(matchReasoningHTML(c, job)), 'labelled as a rule'); ok(/Detailed fit/.test(matchReasoningHTML(c, job)), 'detailed fit is shown beside it');
      ok(/not recorded/.test(computeMatchReasoning({ skills:[], exp:'1 yrs', loc:'x' }, { skills:[], minExp:'1 yrs', loc:'x' }).noticeSignal), 'missing notice is said, not guessed');
    });
    await t('workflow match fields read the real skills match, not the join figure', async function(){
      var c = CANDIDATES[0], b = bestJobMatch(c), want = b ? b.pct : 0;
      var f1 = WF_CONDITION_FIELDS.find(function(x){ return x.key === 'matchScore'; }); ok(f1.extract(c) === want, 'workflow field');
    });

    await t('corporate insights: stuck approvals, vendor duplicates, contract expiry, time waiting and rate card compliance are counted with their rules', async function(){
      coSeedNow(); var now = coNow();
      var rq = CO.reqs.find(function(r){ return r.status === 'Pending approval'; });
      if(!rq){ rq = CO.reqs[0]; rq.status = 'Pending approval'; rq.chain = [{ key:'ta', label:'TA Head', status:'Pending' }]; }
      rq.history = (rq.history || []).concat([{ at: now - 8 * CO_D, by:'x', what:'Sent for approval' }]);
      var wo = coWoCreate({ contractor:'Insight Tester', email:'it@x.example', role:'Staff Nurse', approver:'Priya Sharma', start:new Date(now - 60 * CO_D).toISOString().slice(0, 10), end:new Date(now + 10 * CO_D).toISOString().slice(0, 10), rate:9000, unit:'day', sow:'Ward cover for the quarter' });
      var i = coInsights();
      ok(i.reqs.stuck.some(function(x){ return x.rq === rq && x.days >= 8; }), 'approval stuck for 8 days is flagged');
      ok(i.reqs.ageing.length > 0 && i.reqs.ageing[0].days >= i.reqs.ageing[i.reqs.ageing.length - 1].days, 'oldest first');
      ok(Array.isArray(i.contracts.soon), 'contract list builds');
      var w = coWoBy(wo.wo.id); w.status = 'Active';
      var j = coInsights(); ok(j.contracts.overRate.some(function(x){ return x.wo.id === w.id; }), 'rate above the card is listed'); ok(j.contracts.soon.some(function(x){ return x.wo.id === w.id && x.days <= 10; }), 'ends within 30 days'); ok(j.contracts.missing.some(function(x){ return x.wo.id === w.id; }), 'recent weeks with no time');
      var v = CO.vendors.filter(function(x){ return x.status === 'Active'; })[0]; ok(!v || j.vendors.some(function(x){ return x.v.id === v.id; }), 'active vendors are reported');
      ok(/Rule: flagged after/.test(coReqInsightsHTML()) && /small sample|guide only/.test(coVenInsightsHTML()) && /Rules:/.test(coConInsightsHTML()), 'rules are on screen');
    });
    await t('client account shows reply speed, requirement quality and progress from the client’s own journeys', async function(){
      var c = CLIENTS.find(function(x){ return SUBMISSIONS.some(function(s){ var jb = jobById(s.jobId); return jb && clientForJob(jb) === x; }); }) || CLIENTS[0];
      var s = clientSignals(c); ok(typeof s.n === 'number' && Array.isArray(s.waiting), 'signals build'); var html = clSignalsHTML(c);
      ok(!s.n || /Reply speed/.test(html) && /Requirement quality/.test(html), 'card shows the two signals'); ok(!/predict|forecast/i.test(html), 'no prediction language');
    });
    await t('Kairo suggestions are logged when acted on or dismissed, and the log reaches the audit trail', async function(){
      var jb = jobById('j1'); jb.kairoLog = []; var before = AUDIT_LOG.length;
      kairoAccept('j1', 'test:key'); kairoDismiss('j1', 'test:other');
      ok(jb.kairoLog.length === 2 && jb.kairoLog[0].outcome === 'accepted' && jb.kairoLog[1].outcome === 'dismissed', 'both outcomes kept');
      ok(AUDIT_LOG.length >= before + 2, 'audited'); ok(/Logged so far: 1 acted on, 1 dismissed/.test(kairoJobHTML(jb)), 'summary shown');
    });
    await t('messages Kairo drafts say so unless the switch is off', async function(){
      var c = { name:'Asha Rao', notice:'30 Days' }, step = { text:'Hi {{first_name|there}}, a role at {{company}}.' };
      WSX.hiring.aiDisclose = true; ok(/Drafted by Kairo/.test(cwTemplateText(step, c, { ownerId:'RP-088' })), 'line added');
      WSX.hiring.aiDisclose = false; ok(!/Drafted by Kairo/.test(cwTemplateText(step, c, { ownerId:'RP-088' })), 'line removed when off'); WSX.hiring.aiDisclose = true;
    });
    await t('Audit Center carries the fairness report and says what is not collected', async function(){
      as('admin'); var html = renderAuditCenter(); ok(/FAIRNESS AND HOW KAIRO DECIDES/.test(html) && /NOT COLLECTED YET/.test(html) && /does not use name, age, gender/.test(html), 'sections');
      ok(/No candidate is rejected by Oontu on its own/.test(html), 'human control stated'); ok(/small sample|Nothing has been sent/.test(html) || fairnessData().rows.every(function(r){ return r.sent >= 5; }), 'small samples are marked');
    });
    await t('detailed fit counts near skills as half and is only used for ranking when the model is switched', async function(){
      var c = { skills:['Kotlin','AWS'], exp:'2 yrs' }, job = { skills:['Java','AWS'], preferredSkills:['Docker'], minExp:'4 yrs' };
      var f = computeJobFit(c, job); ok(f.adjacent.indexOf('Java') > -1, 'Kotlin is near Java'); ok(f.pct > 0 && f.pct < 100, 'partial: ' + f.pct);
      ok(MATCH_MODEL === 'skills' && computeJobMatchPct(c, job) === 50, 'ranking still uses the skills match: ' + computeJobMatchPct(c, job));
      MATCH_MODEL = 'detailed'; try { ok(computeJobMatchPct(c, job) === f.pct, 'switch applies'); } finally { MATCH_MODEL = 'skills'; }
    });
    await t('Reports says why there is no forecast', async function(){ var html = renderReports(); ok(/No forecast is shown/.test(html), 'stated'); });

    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
  }, 800); });
})();

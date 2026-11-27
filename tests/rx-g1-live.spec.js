// @rx-runner switches=g1
/* RX G1: live workflow triggers — exactly one action per event, never twice, paused workflows never run, consent and
   daily limit guards, Run Test output unchanged.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\rx-g1-live.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var errs = [];
  window.__RX_NO_TIMER__ = true;
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } pub(); }
  function pub(){ var pre = document.getElementById('auth-test-results'); if(!pre){ pre = document.createElement('pre'); pre.id = 'auth-test-results'; document.body.appendChild(pre); } pre.textContent = JSON.stringify(results); }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function eq(a, b, m){ if(a !== b) throw new Error((m ? m + ': ' : '') + 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
  function touchesFor(wf, cid){ return RX.touches.filter(function(x){ return x.workflowId === wf.id && x.candidateId === cid; }); }
  /* "Offer Follow-up" from the template, set live on Offer Accepted with one message step */
  function offerFollowUp(){
    var tpl = WF_TEMPLATES.find(function(x){ return x.name === 'Offer Follow-up'; });
    var wf = { id:'wf-rx-offer', name:tpl.name, status:'Published', templateStatus:'Approved', trigger:'Offer Accepted', agentKey:WF_TRIGGER_AGENT['Offer Accepted'], conditions:[], conditionLogic:'AND', steps:[{ kind:'do', type:'sendWhatsapp', message:'Congratulations on accepting!' }], runCount:0 };
    WORKFLOWS.push(wf); return wf;
  }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex');
    var wf = offerFollowUp();
    var sb = SUBMISSIONS.find(function(s){ return s.id === 'sub-2'; }), c = byId(sb.candidateId);
    sb.consent = { state:'given', at:Date.now() };
    sb.offer = sb.offer || { id:'OF-RX1', status:'Made' }; sb.offer.status = 'Made';

    await t('switches: six upgrades, all off by default; the runner turned G1 on; settings defaults in WSX.rx', async function(){
      eq(Object.keys(RX_SWITCH).join(), 'g1,g2,g3,g4,g5,g6'); var forced = window.__RX_SWITCHES__ || {}; ok(rxOn('g1') && Object.keys(RX_SWITCH).every(function(id){ return rxOn(id) === !!forced[id]; }), 'only the switches the runner forced are on');
      eq(WSX.rx.maxActionsPerDay, 200); eq(WSX.rx.attributionDays, 30); eq(WSX.rx.defaultAgencyFeePct, 8.33); eq(WSX.rx.bookingSlots, 6);
    });
    await t('accepting an offer runs the published workflow: exactly one action for that candidate', async function(){
      var before = WA_BUSINESS_ACCOUNT.messagesToday; ok(offerSetStatus(sb, 'Accepted'), 'offer accepted');
      var ts = touchesFor(wf, c.id); eq(ts.length, 1, 'one action'); eq(ts[0].channel, 'whatsapp'); eq(ts[0].event, 'Offer Accepted'); eq(WA_BUSINESS_ACCOUNT.messagesToday, before + 1, 'same WhatsApp counter as Run Test uses');
      ok(RX.events.some(function(e){ return e.event === 'Offer Accepted' && e.candidateId === c.id; }), 'event on the bus');
    });
    await t('re-firing the same event does nothing', async function(){
      rxEmit('Offer Accepted', { candidateId:c.id, jobId:sb.jobId, submissionId:sb.id, eventId:'offer-accepted:' + sb.id });
      offerSetStatus(sb, 'Made'); offerSetStatus(sb, 'Accepted');
      eq(touchesFor(wf, c.id).length, 1, 'still one');
    });
    await t('paused workflows never run', async function(){
      wf.status = 'Paused'; rxEmit('Offer Accepted', { candidateId:c.id, submissionId:sb.id, eventId:'fresh-1' }); eq(touchesFor(wf, c.id).length, 1, 'nothing while paused'); wf.status = 'Published';
    });
    await t('no consent: skipped with the reason “No consent”; the daily limit holds', async function(){
      var other = CANDIDATES.find(function(x){ return x.id !== c.id && !rxHasConsent(x); });
      rxEmit('Offer Accepted', { candidateId:other.id, eventId:'no-consent-1' }); eq(touchesFor(wf, other.id).length, 0);
      ok(RX.skips.some(function(s){ return s.workflowId === wf.id && s.candidateId === other.id && s.reason === 'No consent'; }), 'reason recorded');
      WSX.rx.maxActionsPerDay = 1; rxEmit('Offer Accepted', { candidateId:c.id, eventId:'limit-1' }); eq(touchesFor(wf, c.id).length, 1, 'limit reached');
      ok(RX.skips.some(function(s){ return s.reason === 'Daily action limit reached'; })); WSX.rx.maxActionsPerDay = 200;
    });
    await t('conditions are checked for that candidate only; stage moves and interviews emit events', async function(){
      var wf2 = { id:'wf-rx-stage', name:'Stage watcher', status:'Published', templateStatus:'Approved', trigger:'Stage Changed', agentKey:WF_TRIGGER_AGENT['Stage Changed'], conditions:[{ field:'exp', op:'>', value:'99' }], conditionLogic:'AND', steps:[{ kind:'do', type:'notifyManager' }] };
      WORKFLOWS.push(wf2); moveSubmissionStage(sb.id, 'Interview Scheduled', 'spec');
      eq(touchesFor(wf2, c.id).length, 0, 'condition not met for this candidate'); ok(RX.skips.some(function(s){ return s.workflowId === wf2.id && s.reason === 'Conditions not met'; }));
      ok(RX.events.some(function(e){ return e.event === 'Interview Scheduled' && e.submissionId === sb.id; }), 'Interview Scheduled emitted');
      wf2.conditions = []; moveSubmissionStage(sb.id, 'Client Interview', 'spec'); eq(touchesFor(wf2, c.id).length, 1, 'runs when conditions hold');
    });
    await t('the workflow card shows the last live run, actions today and skips', async function(){
      var h = workflowCardHTML(wf); ok(/Last live run/.test(h) && /Actions today: <b>1<\/b>/.test(h) && /Skipped today/.test(h), h.slice(-400));
    });
    await t('Run Test output is identical with G1 on and off', async function(){
      var seed = WORKFLOWS[0]; wfEditingId = seed.id;
      var snap = function(){ return JSON.stringify([seed.lastMatchCount, seed.runCount]); };
      seed.runCount = 0; wfRunTest(); var a = [seed.lastMatchCount]; rxSetSwitch('g1', false); seed.runCount = 0; wfRunTest(); var b = [seed.lastMatchCount]; rxSetSwitch('g1', true);
      eq(JSON.stringify(a), JSON.stringify(b)); eq(touchesFor(seed, c.id).length, 0, 'Run Test writes no live touches');
    });
    await t('sweep: Notice Period Expiring fires once; switch off: nothing fires', async function(){
      var wf3 = { id:'wf-rx-notice', name:'Notice watch', status:'Published', templateStatus:'Approved', trigger:'Notice Period Expiring', agentKey:WF_TRIGGER_AGENT['Notice Period Expiring'], conditions:[], conditionLogic:'AND', steps:[{ kind:'do', type:'notifyManager' }] };
      WORKFLOWS.push(wf3); c.notice = '5 days'; sb.offer.acceptedAt = new Date().toISOString(); rxSweep(); rxSweep(); eq(touchesFor(wf3, c.id).length, 1, 'once');
      rxSetSwitch('g1', false); var n = RX.touches.length; moveSubmissionStage(sb.id, 'Offer Made', 'spec'); rxSweep(); eq(RX.touches.length, n, 'nothing while off'); rxSetSwitch('g1', true);
    });
    pub();
  }, 300); });
})();

// @cx-runner on
/* CX C10: final audit checks — no LinkedIn automation reachable with CX on (and every guarded function refuses),
   every CX send goes through a reservation, the six agents and the ownership map, CX off leaves today's behaviour.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\cx-audit.spec.js */
(function(){
  var results = [], errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } pub(); }
  function pub(){ var pre = document.getElementById('auth-test-results'); if(!pre){ pre = document.createElement('pre'); pre.id = 'auth-test-results'; document.body.appendChild(pre); } pre.textContent = JSON.stringify(results); }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function eq(a, b, m){ if(a !== b) throw new Error((m ? m + ': ' : '') + 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
  function as(role){ viewingAsFromManager = false; managerViewAsRecruiterId = null; previewAsRoleId = null; state.role = role; renderSidebar(); }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex');
    as('admin');

    await t('no LinkedIn automation is reachable with CX on; each guarded function refuses', async function(){
      eq(cxLiAutomationReachable().length, 0, 'reachable: ' + cxLiAutomationReachable().join());
      ok(liSendConnectionRequests(WORKFLOWS[0], [CANDIDATES[0]], true, false).refused, 'send'); ok(cwLiOpenAdd().refused, 'add account');
      ok(/Not used in Cowork v2/.test(liConnectAccountFormHTML({})), 'connect form'); ok(/Not used in Cowork v2/.test(liSenderProfilesSettingsHTML()), 'sender profiles');
      ok(typeof liListsSendToAutomation === 'function' && liListsSendToAutomation('wf-x').refused, 'lists to automation');
    });
    await t('every CX send goes through a reservation in the ledger', async function(){
      var n0 = CX_OUTBOX.length; var c = CANDIDATES.find(function(x){ return !cxOptedOut(x.id); }); cxSend({ agent:'outreach', channel:'email', candidateId:c.id, text:'Audit check' });
      CX_OUTBOX.slice(n0).forEach(function(m){ ok(m.sentByPerson || (m.reservationId && CX_LEDGER.some(function(r){ return r.reservationId === m.reservationId && r.status === 'reserved'; })), 'unreserved send ' + m.id); });
      ok(CX_OUTBOX.filter(function(m){ return !m.sentByPerson && m.agent !== 'linkedin'; }).every(function(m){ return !!m.reservationId; }), 'every agent send in the outbox has a reservation');
    });
    await t('six agents, every stage one owner, the wallet balance is the sum of the ledger', async function(){
      eq(CX_AGENTS.map(function(a){ return a[0]; }).join(), 'talent-discovery,outreach,linkedin,interviews,delivery-guardian,revenue-redeploy');
      Object.keys(CX_OWNERSHIP).forEach(function(k){ ok(CX_AGENTS.some(function(a){ return a[0] === CX_OWNERSHIP[k]; }), k); });
      eq(cxBalance(), CX_LEDGER.reduce(function(s, r){ return s + r.credits; }, 0));
    });
    await t('CX off: guarded functions run as before', async function(){
      cxSetSwitch(false); ok(!/Not used in Cowork v2/.test(String(liSenderProfilesSettingsHTML())), 'old settings'); var r = liSendConnectionRequests(WORKFLOWS[0], [], true, false); ok(!(r && r.refused), 'old send path'); cxSetSwitch(true);
    });
    /* QA fix A4: company Campaign plays and vendor-submitted screening go through the credit path */
    function wsAt(day, h, m){ var a = day.split('-'); return wsWallMs(+a[0], +a[1], +a[2], h, m || 0); }
    function tue10(){ var day = wsDay(CW.clock); while(wsDow(day) !== 2) day = wsAddDays(day, -1); var t = wsAt(day, 11); cwSetClock(t); return t; }
    function mkCand(id, name){ var c = { id:id, name:name, role:'Python Developer', exp:'4 yrs', loc:'Pune, IN', avail:'Available', availScore:80, joinProb:80, respProb:80, bestTime:'7 PM', counterRisk:10, trust:90, intent:'High', skills:['Python','Django','PostgreSQL','AWS'], salary:'₹16–20 LPA', notice:'30 Days', preferredRoles:[], goals:'', market:'', comms:'', employmentType:'Full-time', industry:'Technology', domain:'Backend', email:name.toLowerCase().replace(/ /g, '.') + '@test.example', phone:'9' + (800000000 + id), company:'Acme Labs', currentCompany:'Acme Labs' }; CANDIDATES.push(c); CW_OPTINS[personKeyOf(c)] = { source:'test', date:'Oct 2026' }; return c; }
    function fresh(jobId){ var c = cpNewCampaign(jobId, {}); c.status = 'running'; c.startedAt = CP_NOW() - CP_DAY; c.rules.checkFirst = 0; c.review.approved = 0; return c; }
    await t('A4 company campaign plays: credits are reserved before each send and settled after; no reservation, no send', async function(){
      tue10(); var a = mkCand(9411, 'Audit Alpha'), b; var c = fresh('j5');
      var realReserve = window.cxReserve, at = []; window.cxReserve = function(o){ at.push(SEND_LEDGER.length); return realReserve.apply(this, arguments); };
      try {
        var p = cpEnqueue(c, a, 'know'); ok(p, 'enqueued'); var n0 = SEND_LEDGER.length; cwEngineTick(0, { enrol:0 });
        var sent = SEND_LEDGER.slice(n0).filter(function(l){ return l.campaignId === c.id && l.status === 'sent'; }); ok(sent.some(function(l){ return l.personKey === personKeyOf(a); }), 'sent to the enqueued person: ' + sent.length + ' ' + (p.holdReason || ''));
        sent.forEach(function(l){
          var rid = l.cxReservationId; ok(rid, 'the send carries its reservation');
          ok(CX_LEDGER.some(function(r){ return r.reservationId === rid && (r.status === 'charged' || r.status === 'released'); }), 'reserved, then settled');
          eq(CX_LEDGER.filter(function(r){ return r.reservationId === rid && r.status === 'reserved'; }).length, 1, 'reserved once (the ledger hook does not reserve again)');
          ok(at.indexOf(SEND_LEDGER.indexOf(l)) > -1, 'reserved before the send was written');
        });
      } finally { window.cxReserve = realReserve; }
      window.cxReserve = function(){ return { blocked:'Not enough credits (test)' }; };
      try { b = mkCand(9412, 'Audit Bravo'); var q2 = cpEnqueue(c, b, 'know'); ok(q2, 'second person enqueued'); var n1 = SEND_LEDGER.length; cwEngineTick(CW_HOUR * 3, { enrol:0 }); ok(!SEND_LEDGER.slice(n1).some(function(l){ return l.campaignId === c.id && l.personKey === personKeyOf(b); }), 'nothing sent without credits'); ok(/Paused: credits/.test(q2.holdReason || ''), 'waits, with the reason: ' + q2.holdReason); }
      finally { window.cxReserve = realReserve; }
      ok(SEND_LEDGER.filter(function(l){ return l.campaignId === c.id && l.status === 'sent'; }).every(function(l){ return !!l.cxReservationId; }), 'every campaign send in the send ledger has a reservation');
    });
    await t('A4 vendor-submitted screening: the profile check reserves and settles ai-medium; no credits → a task, no check', async function(){
      var sub = SUBMISSIONS.find(function(s){ return jobById(s.jobId) && byId(s.candidateId); }); ok(sub, 'a submission');
      var b0 = cxBalance(), r = cxVendorScreen(sub, { ref:'VS-TEST' }); ok(r.ok && r.screen && typeof r.screen.fit === 'number', JSON.stringify(r));
      var rows = CX_LEDGER.filter(function(x){ return x.reservationId === r.screen.reservationId; }); ok(rows.some(function(x){ return x.status === 'reserved' && x.rateClass === 'ai-medium'; }) && rows.some(function(x){ return x.status === 'charged'; }), 'reserve → charge');
      eq(cxBalance(), b0 - cxRate('ai-medium'), 'charged its rate'); ok(sub.cxScreen && sub.cxScreen.fit === r.screen.fit, 'kept on the submission');
      var realReserve = window.cxReserve; window.cxReserve = function(){ return { blocked:'Not enough credits (test)' }; };
      try { var t0 = (window.CX_TASKS || []).length; var r2 = cxVendorScreen(sub, { ref:'VS-TEST2' }); ok(!r2.ok && r2.paused === 'credits', 'paused'); ok((window.CX_TASKS || []).length > t0, 'a task says so'); } finally { window.cxReserve = realReserve; }
      ok(coConsentGive.__fixA4, 'consent hands the new submission to the check');
    });
    pub();
  }, 300); });
})();

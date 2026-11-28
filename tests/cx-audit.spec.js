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
    pub();
  }, 300); });
})();

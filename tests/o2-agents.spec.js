// @o2-runner switches=1a,8b
/* O2 Step 8b: agent tool allow-list enforced and logged, limits, activity without content, act tools never high-risk.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\o2-agents.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } pub(); }
  function pub(){ var pre = document.getElementById('auth-test-results'); if(!pre){ pre = document.createElement('pre'); pre.id = 'auth-test-results'; document.body.appendChild(pre); } pre.textContent = JSON.stringify(results); }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function eq(a, b, m){ if(a !== b) throw new Error((m ? m + ': ' : '') + 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
  function as(id){ ACTIVE_PLATFORM_USER_ID = id; try { bosActAs(id); } catch(e){} }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'oontu'; as('PU-103'); var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex'); renderSidebar(); await sleep(30);
    var tk = bosCreateTicket({ subject:'How do I export candidates?', body:'Need a CSV export', contactEmail:'priya@harborpartners.example', source:'In-app' }).ticket;

    await t('acceptance: an act tool outside the allow-list is refused and logged', async function(){
      var n0 = BOS.agentRuns.length; var r = bosAsAgent(function(){ return bosRun('ticket.close', null, function(){ return { ok:true }; }); });
      ok(!r.ok && /tool list/.test(r.reason), r.reason); var run = BOS.agentRuns[BOS.agentRuns.length - 1]; eq(BOS.agentRuns.length, n0 + 1); eq(run.outcome, 'refused'); eq(run.tool, 'ticket.close'); eq(run.onBehalfOf, 'PU-103');
      ok(AUDIT_LOG.some(function(e){ return e.action === 'Agent action refused'; }), 'audited');
      r = bosAsAgent(function(){ return bosRun('refund.approve', null, function(){ return { ok:true }; }); }); ok(!r.ok && r.needsPerson, 'high-risk still refused outright');
    });
    await t('allowed draft and read actions run and are logged without content', async function(){
      var mine = BOS.tickets.find(function(x){ return bosCan('platform-ticket', 'edit', x); }) || tk;   /* a ticket in Rohan's queues */
      var d = bosKairo.draftReply(mine.id); ok(d.ok || d.state === 'partial', JSON.stringify(d).slice(0, 120));
      var c = bosKairo.classify(tk.id); ok(c.ok, c.reason); ok(BOS.agentRuns.some(function(r){ return r.tool === 'ticket.classify' && r.outcome === 'done'; }), 'read logged');
      var dump = JSON.stringify(BOS.agentRuns); ok(dump.indexOf('Thank you for writing') < 0 && dump.indexOf('Need a CSV export') < 0, 'no prompt or output content');
    });
    await t('acceptance: limits enforced (actions per user per day)', async function(){
      as('PU-001'); ok(o2SetAgentLimit('kairo', 1).ok); as('PU-104');
      var a1 = bosKairo.classify(tk.id), a2 = bosKairo.classify(tk.id); ok(a1.ok, 'first within the limit'); ok(!a2.ok && /Daily limit/.test(a2.reason), 'second refused: ' + a2.reason);
      as('PU-001'); o2SetAgentLimit('kairo', 50);
    });
    await t('act tools can never include high-risk commands', async function(){
      as('PU-001'); var r = o2SetAgentTools('kairo', 'act', ['ticket.assign', 'payment.verify']); ok(!r.ok && /high-risk/.test(r.reason), r.reason);
      ok(o2SetAgentTools('kairo', 'act', ['ticket.assign']).ok, 'a safe act tool is allowed'); eq(O2_AGENT_POLICY.kairo.act.join(), 'ticket.assign');
    });
    await t('AI agents screen: Catalogue · Tools & policies · Activity · Usage (illustrative)', async function(){
      showView('oontu-agents'); await sleep(5); eq(state.activeNav, 'oontu-ai'); var m = document.getElementById('main-content');
      eq(Array.prototype.map.call(m.querySelectorAll('.o2-host-tab'), function(b){ return b.textContent; }).join('|'), 'Catalogue|Tools & policies|Activity|Usage');
      o2AiTab('activity'); ok(/ticket\.close/.test(m.textContent), 'refusal listed'); o2AiTab('usage'); ok(/Illustrative data/.test(m.textContent)); o2AiTab('catalogue');
    });
    await t('switch 8b off: no allow-list enforcement', async function(){ o2SetSwitch('8b', false); as('PU-103'); var n0 = BOS.agentRuns.length; bosAsAgent(function(){ return bosRun('ticket.close', null, function(){ return { ok:true }; }); }); eq(BOS.agentRuns.length, n0, 'not logged while off'); o2SetSwitch('8b', true); });
    pub();
  }, 300); });
})();

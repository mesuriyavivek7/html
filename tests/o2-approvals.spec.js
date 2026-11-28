// @o2-runner switches=1a,1b
/* O2 Step 1b: approvals inbox (Waiting for me · I asked · Decided by me · All), same decision path, chips on records.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\o2-approvals.spec.js */
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
  function main(){ return document.getElementById('main-content'); }
  var CASE = { category:'Volume or multi-year commitment', reason:'The customer will sign a two-year term for all twelve recruiters if we hold fifteen percent for both years.', commitment:'12 licences × 24 months', withoutIt:'They stay on spreadsheets for another year.' };

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'oontu'; as('PU-001'); var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex'); renderSidebar(); await sleep(30);
    var opp = BOS.opps.find(function(o){ return o.ownerId === 'PU-101' && !/won|lost/i.test(o.stage || ''); });
    if(!opp){ as('PU-101'); opp = bosIntake({ company:'Inbox Labs', name:'Ira', email:'ira@inboxlabs.example', source:'Website' }).opp; opp.ownerId = 'PU-101'; }
    var apr = null;

    await t('acceptance 1: an approval Arjun raises waits in Kavya’s inbox, not in Arjun’s; it is in his “I asked”', async function(){
      as('PU-101'); var r = bosCreateProposal({ oppId:opp.id, planId:'plan-scale', seats:12, discountPct:15, justification:CASE }); ok(r.ok && r.approval, r.reason); apr = r.approval;
      var L = o2ApprovalLists(); ok(!L.waiting.some(function(a){ return a.id === apr.id; }), 'not waiting for Arjun'); ok(L.asked.some(function(a){ return a.id === apr.id; }), 'in Arjun’s I asked'); eq(L.all, null, 'Arjun has no All tab');
      as('PU-102'); L = o2ApprovalLists(); ok(L.waiting.some(function(a){ return a.id === apr.id; }), 'waiting for Kavya');
      showView('oontu-approvals'); eq(state.activeNav, 'oontu-approvals'); var row = document.getElementById('o2-apr-' + apr.id); ok(row, 'row in the inbox');
      var cells = Array.prototype.map.call(row.querySelectorAll('td'), function(c){ return c.textContent; });
      ok(/15% off/.test(cells[2]), 'amount/risk: ' + cells[2]); ok(/Arjun Rao/.test(cells[3]), 'asked by'); ok(/14 days/.test(cells[5]), 'expires: ' + cells[5]); ok(/Deal/.test(cells[6]), 'record link');
      ok(row.querySelector('button[onclick="bosApprovalDialog(\'' + apr.id + '\')"]'), 'Decide opens the existing dialog');
    });
    await t('acceptance 2: deciding from the inbox gives the same result as the old place (same dialog, same guards)', async function(){
      as('PU-102'); showView('oontu-approvals'); document.getElementById('o2-apr-' + apr.id).querySelector('.o-btn--primary').click(); await sleep(10);
      ok(/Reason for your decision|Your reasoning/.test(document.getElementById('bos-dialog-root').textContent), 'the existing decision dialog'); bosDialogClose();
      var r = bosDecide(apr.id, true, 'Two-year commitment for twelve licences protects the revenue and margin stays acceptable.', 'Volume or multi-year commitment secures the revenue'); ok(r.ok, r.reason);
      eq(BOS.approvals.find(function(a){ return a.id === apr.id; }).status, 'approved'); var L = o2ApprovalLists(); ok(L.decided.some(function(a){ return a.id === apr.id; }), 'in Decided by me'); ok(!L.waiting.some(function(a){ return a.id === apr.id; }));
      as('PU-101'); r = bosDecide(apr.id, true, 'x'.repeat(60), 'Volume or multi-year commitment secures the revenue'); ok(!r.ok, 'already decided / requester refused');
      as('PU-101'); var r2 = bosCreateProposal({ oppId:opp.id, planId:'plan-scale', seats:12, discountPct:16, justification:CASE });
      if(r2.ok && r2.approval){ as('PU-101'); ok(!bosCanDecide(r2.approval, currentPlatformUser()).ok, 'no self-approval'); as('PU-001'); }
    });
    await t('Billing and payments › Approvals shows the inbox table; record pages show a chip to the inbox', async function(){
      as('PU-106'); BOS_UI.tab['oontu-finance'] = 0; var h = RENDERERS['oontu-finance'](); ok(h.indexOf('id="o2-apr-h"') > -1, 'inbox table in the finance tab'); ok(h.indexOf('bos-apr-h') < 0, 'the old table is replaced');
      as('PU-102'); BOS_UI.sel.opp = opp.id; var o = RENDERERS['oontu-opp'](); ok(!/onclick="bosApprovalDialog\(/.test(o), 'no own Decide/View approval button'); ok(/o2-apr-chip/.test(o) && /open in Approvals/.test(o), 'chip');
      o2OpenApproval(apr.id); await sleep(10); eq(state.activeNav, 'oontu-approvals'); ok(document.querySelector('.o2-apr--focus'), 'the request is highlighted');
    });
    await t('All tab only with platform-audit:view; everyone active may open the inbox', async function(){
      as('PU-108'); ok(o2ApprovalLists().all !== null, 'Dev (audit) sees All'); o2ApprovalsTab('all'); showView('oontu-approvals'); ok(/All approvals/.test(main().textContent));
      as('PU-103'); ok(BOS_VIEW_ACCESS['oontu-approvals'](), 'Rohan may open it'); eq(o2ApprovalLists().all, null);
      showView('oontu-approvals'); ok(/Nothing is waiting for you/.test(main().textContent), 'empty state says what would appear');
    });
    await t('switch 1b off: the old approvals table and the old button come back', async function(){
      o2SetSwitch('1b', false); as('PU-106'); BOS_UI.tab['oontu-finance'] = 0; ok(RENDERERS['oontu-finance']().indexOf('bos-apr-h') > -1, 'old table');
      as('PU-102'); BOS_UI.sel.opp = opp.id; ok(!/o2-apr-chip/.test(RENDERERS['oontu-opp']()), 'no chip'); o2SetSwitch('1b', true);
    });
    pub();
  }, 300); });
})();

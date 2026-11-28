/* Accountable approvals (prototype, 2026-11-26): the requester gives a business case, the approver sees the deal context
   and records a reason and reasoning for approve AND decline; protections against approval shopping, changed terms,
   stale approvals and unchanged resubmissions.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\bos-approval-guard.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } pub(); }
  function pub(){ var pre = document.getElementById('auth-test-results'); if(!pre){ pre = document.createElement('pre'); pre.id = 'auth-test-results'; document.body.appendChild(pre); } pre.textContent = JSON.stringify(results); }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function eq(a, b, m){ if(a !== b) throw new Error((m ? m + ': ' : '') + 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
  function as(id){ ACTIVE_PLATFORM_USER_ID = id; }
  var CASE = { category:'Volume or multi-year commitment', reason:'Meridian will sign a two-year term for all 12 hospital recruiters if we hold 15% for both years.', commitment:'12 licences × 24 months', withoutIt:'They stay on spreadsheets for another year.' };
  var main = function(){ return document.getElementById('main-content').textContent; };

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    try { localStorage.clear(); } catch(e){}
    var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex');
    state.role = 'oontu'; as('PU-001'); renderSidebar(); await sleep(30);
    var opp = BOS.opps.find(function(x){ return x.title === 'Meridian Health Hiring · New business'; });

    await t('the requester must give a real business case for a discount above policy', async function(){
      as('PU-102');
      var r = bosCreateProposal({ oppId:opp.id, planId:'plan-scale', seats:12, discountPct:15 }); ok(!r.ok && r.field === 'case', 'no case: ' + r.reason);
      r = bosCreateProposal({ oppId:opp.id, planId:'plan-scale', seats:12, discountPct:15, justification:{ category:'Competitor offer', reason:'They have a cheaper quote from someone, please help us here.', withoutIt:'We lose it' } }); ok(!r.ok && r.field === 'competitor', 'competitor named: ' + r.reason);
      r = bosCreateProposal({ oppId:opp.id, planId:'plan-scale', seats:12, discountPct:15, justification:{ category:'Volume or multi-year commitment', reason:'urgent', commitment:'2y', withoutIt:'they walk away' } }); ok(!r.ok && /not a reason|fuller/.test(r.reason), 'stock reason refused');
      r = bosCreateProposal({ oppId:opp.id, planId:'plan-scale', seats:12, discountPct:8 }); ok(r.ok && !r.approval, 'within policy: no case needed');
      r = bosCreateProposal({ oppId:opp.id, planId:'plan-scale', seats:12, discountPct:15, justification:CASE }); ok(r.ok && r.approval, r.reason);
      eq(r.approval.justification.category, CASE.category); eq(r.approval.terms.discountPct, 15); ok(AUDIT_LOG.some(function(e){ return e.action === 'Discount case submitted'; }), 'case audited');
      var dup = bosCreateProposal({ oppId:opp.id, planId:'plan-scale', seats:12, discountPct:20, justification:CASE }); ok(!dup.ok && /already waiting/.test(dup.reason), 'one pending request per deal (no approval shopping)');
      as('PU-001');
    });
    await t('the approver sees the deal context and the risks', async function(){
      var a = BOS.approvals.filter(function(x){ return x.type === 'discount' && x.status === 'pending' && x.terms && x.terms.oppId === opp.id; })[0];
      var c = bosApprovalContext(a); ok(c.facts.some(function(f){ return f[0] === 'Price' && /gives away ₹/.test(f[1]); }), 'what Oontu gives away');
      ok(c.facts.some(function(f){ return /last 90 days/.test(f[0]); }), 'the requester’s pattern'); ok(c.facts.some(function(f){ return f[0] === 'This customer before'; }), 'customer history');
      as('PU-109'); bosApprovalDialog(a.id); var d = document.getElementById('bos-dialog-root').textContent;
      ok(/Why they ask/.test(d) && /two-year term/.test(d) && /Deal context/.test(d) && /Reason for your decision/.test(d) && /Your reasoning/.test(d), d.slice(0, 200)); bosDialogClose(); as('PU-001');
    });
    await t('approve and decline both need a reason and real reasoning; the deal owner can’t decide', async function(){
      var a = BOS.approvals.filter(function(x){ return x.type === 'discount' && x.status === 'pending' && x.terms && x.terms.oppId === opp.id; })[0];
      as('PU-102'); var own = bosDecide(a.id, true, 'Long reasoning that is quite detailed here.', 'Volume or multi-year commitment secures the revenue'); ok(!own.ok, 'requester (and deal owner) refused');
      as('PU-109');
      ok(!bosDecide(a.id, true, 'Looks fine to me, approving now quickly.').ok, 'reason category required');
      ok(!bosDecide(a.id, true, 'ok', 'Volume or multi-year commitment secures the revenue').ok, '“ok” is not reasoning');
      ok(!bosDecide(a.id, true, 'Two-year commitment for 12 licences protects the revenue; margin acceptable.', 'Margin too low for this deal').ok, 'an approve needs an approve reason');
      var r = bosDecide(a.id, true, 'Two-year commitment for 12 licences protects the revenue; margin stays acceptable.', 'Volume or multi-year commitment secures the revenue'); ok(r.ok, r.reason);
      eq(a.decisionCategory, 'Volume or multi-year commitment secures the revenue'); ok(/two-year/i.test(a.decisionReason) && a.contextSeen && a.contextSeen.facts.length, 'reasoning and context kept');
      ok(AUDIT_LOG.some(function(e){ return e.action === 'Decision reasoning' && e.detail.indexOf(a.id) > -1; }), 'audited'); as('PU-001');
    });
    await t('an approval holds for the exact terms and 14 days only', async function(){
      var a = BOS.approvals.filter(function(x){ return x.type === 'discount' && x.status === 'approved' && x.terms && x.terms.oppId === opp.id; }).slice(-1)[0], p = bosProposal(a.payload.proposalId);
      as('PU-102'); p.discountPct = 18; var s = bosSendProposal(p.id); ok(!s.ok && /differ from what was approved/.test(s.reason), 'changed terms refused'); p.discountPct = 15;
      APS.clockOffsetMs = (APS.clockOffsetMs || 0) + 15 * 864e5; s = bosSendProposal(p.id); APS.clockOffsetMs -= 15 * 864e5; ok(!s.ok && /14 days/.test(s.reason) && p.status === 'approval_expired', 'stale approval refused');
      as('PU-001');
    });
    await t('a decline is explained to the requester; the same case can’t come back unchanged; withdrawing is allowed', async function(){
      as('PU-102'); var r = bosCreateProposal({ oppId:opp.id, planId:'plan-scale', seats:12, discountPct:28, justification:CASE }); ok(r.ok && r.approval.type === 'discount-restricted', r.reason);
      as('PU-109'); var d = bosDecide(r.approval.id, false, 'Twenty-eight percent leaves too little margin on a 12-licence deal.', 'Offer a smaller discount instead'); ok(d.ok, d.reason);
      ok(BOS.notifications.some(function(n){ return n.userId === 'PU-102' && /declined/.test(n.text); }), 'requester told');
      as('PU-102'); var again = bosCreateProposal({ oppId:opp.id, planId:'plan-scale', seats:12, discountPct:28, justification:CASE }); ok(!again.ok && /declined/.test(again.reason), 'unchanged resubmission refused');
      var w = bosCreateProposal({ oppId:opp.id, planId:'plan-scale', seats:12, discountPct:20, justification:Object.assign({}, CASE, { reason:'New: they agreed to a three-year term for 12 licences if we hold 20% on the second and third years.' }) }); ok(w.ok, 'new information can be submitted');
      ok(bosWithdrawApproval(w.approval.id).ok, 'the requester withdraws'); eq(w.approval.status, 'withdrawn');
      as('PU-109'); ok(!bosWithdrawApproval(r.approval.id).ok, 'only the requester, only while pending'); as('PU-001');
    });
    await t('a pattern of above-policy requests becomes an integrity finding (review, not proof)', async function(){
      bosIntegrityScan(); ok(BOS.exceptions.some(function(e){ return e.rule === 'discount-pattern' && e.ref.id === 'PU-102'; }), 'flagged for review');
    });
    await t('promo codes need a business purpose; every approval type needs reasoning', async function(){
      as('PU-109'); ok(!bosCreatePromo({ code:'WINTER10', pct:10, validUntil:'2027-02-28' }).ok, 'purpose required');
      var p = bosCreatePromo({ code:'WINTER10', pct:10, validUntil:'2027-02-28', reason:'Winter campaign for new Desk customers, budgeted by marketing.' }); ok(p.ok, p.reason);
      as('PU-106'); ok(!bosDecide(p.approval.id, true).ok, 'no reason: refused'); ok(bosDecide(p.approval.id, true, 'Budget line exists and the margin on Desk allows 10%.', 'Evidence checked and valid').ok, 'approved with reasoning'); as('PU-001');
    });
    await t('the screens: the proposal dialog asks for the case; the approval dialog records the decision', async function(){
      as('PU-102'); bosProposalDialog(opp.id); var d = document.getElementById('bos-dialog-root').textContent; ok(/Business case/.test(d) && /What happens without the discount/.test(d), 'case fields'); bosDialogClose();
      var r = bosCreateProposal({ oppId:opp.id, planId:'plan-hire', seats:5, discountPct:12, justification:Object.assign({}, CASE, { reason:'Hire plan for the corporate HR team: five licences on a two-year term if we hold 12% on both years.' }) }); ok(r.ok, r.reason);
      as('PU-109'); bosApprovalDialog(r.approval.id); document.getElementById('bos-ap-cat').value = 'D|Needs more information first'; document.getElementById('bos-ap-note').value = 'Please attach the signed letter of intent for the two-year term.'; bosApprovalSubmit(r.approval.id); await sleep(20);
      eq(r.approval.status, 'declined'); eq(r.approval.decisionCategory, 'Needs more information first'); as('PU-001');
    });
    pub();
  }, 300); });
})();

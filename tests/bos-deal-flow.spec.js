/* Simplified deal page (2026-11-26): five steps, one next action worked out from the deal, a "To win" checklist,
   click a step to move (rules still apply), Mark lost with a reason, Kairo uses the same next action.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\bos-deal-flow.spec.js */
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
  var main = function(){ return document.getElementById('main-content').textContent; };
  var CASE = { category:'Competitor offer', reason:'Lotus has a written quote from a rival ATS at 15% below our list for 10 licences, valid this month.', competitor:'Rival ATS, 15% below list', withoutIt:'They sign with the rival this month.' };

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    try { localStorage.clear(); } catch(e){}
    var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex');
    state.role = 'oontu'; as('PU-001'); renderSidebar(); await sleep(30);

    await t('the page shows five steps, one next step and the “To win” checklist instead of ten stages', async function(){
      var o = BOS.opps.find(function(x){ return x.title === 'Vistaar HR Services · New business'; }); bosOpen('opp', o.id); await sleep(20);
      var steps = document.querySelectorAll('.df-step'); eq(steps.length, 5); eq(Array.prototype.map.call(steps, function(s){ return s.querySelector('b').textContent; }).join(','), 'Lead,Qualify,Demo,Proposal,Won');
      ok(document.querySelector('.df-step.is-now') && /Demo/.test(document.querySelector('.df-step.is-now').textContent), 'current step');
      ok(/Next step:/.test(main()) && /To win:/.test(main()), 'next step and checklist'); ok(!document.querySelector('.bos-stage'), 'the old ten pills are gone');
    });
    await t('the next step follows the deal from first contact to won', async function(){
      as('PU-101'); var r = bosIntake({ company:'Lotus Recruiters', name:'Anil', email:'anil@lotusrec.example', source:'Website' }); var o = r.opp;
      eq(bosDealNext(o).label, 'Qualify');
      bosQualify(o.id, { need:'Replace spreadsheets for 2 desks', volume:'120', teamSize:'10', decisionMaker:'Founder', timeline:'This month' }); eq(bosDealNext(o).label, 'Book a demo');
      var at = new Date(Date.now() + 864e5).toISOString(); bosScheduleDemo({ oppId:o.id, startsAt:at }); eq(bosDealNext(o).label, 'Prepare for the demo');
      var d = BOS.demos.find(function(x){ return x.oppId === o.id; }); d.startsAt = new Date(Date.now() - 3600e3).toISOString(); eq(bosDealNext(o).label, 'Record the demo outcome');
      bosDemoOutcome(d.id, { attendance:'attended', outcome:'Liked it; wants a proposal' }); eq(bosDealNext(o).label, 'Prepare the proposal');
      var p = bosCreateProposal({ oppId:o.id, planId:'plan-floor', seats:10, discountPct:15, justification:CASE }); ok(p.ok, p.reason); var n = bosDealNext(o); eq(n.label, 'Waiting for approval'); ok(n.waiting, 'waiting on someone else');
      as('PU-102'); ok(bosDecide(p.approval.id, true, 'Competitor quote is real and 10 licences are worth holding at 15%.', 'Matches a verified competitor offer').ok, 'approved');
      as('PU-101'); eq(bosDealNext(o).label, 'Send the proposal'); bosSendProposal(p.proposal.id); eq(bosDealNext(o).label, 'Customer accepted');
      bosAcceptProposal(p.proposal.id); eq(bosDealNext(o).label, 'Mark as won');
      ok(bosMoveStage(o.id, 'Won').ok, 'won'); eq(bosDealNext(o).label, 'Open onboarding');
      ok(bosDealChecklist(o).every(function(c){ return c.ok; }), 'checklist all done'); as('PU-001');
    });
    await t('clicking a step moves the deal; the rules still apply and say what is missing', async function(){
      as('PU-101'); var o = bosIntake({ company:'Peak Talent', name:'Pia', email:'pia@peaktalent.example', source:'Referral' }).opp;
      bosOpen('opp', o.id); await sleep(10); bosDealGoTo(o.id, 'demo'); eq(o.stage, 'Demo', 'jumped to Demo');
      bosDealGoTo(o.id, 'won'); ok(o.stage !== 'Won', 'Won refused without an accepted proposal');
      ok(/accepted proposal/.test(document.getElementById('toast-container').textContent), 'the refusal says what is missing'); as('PU-001');
    });
    await t('Mark lost asks for the reason; a lost deal offers Reopen', async function(){
      as('PU-101'); var o = bosIntake({ company:'Quiet Co', name:'Q', email:'q@quietco.example', source:'Outbound' }).opp; bosOpen('opp', o.id); await sleep(10);
      bosDealLostDialog(o.id); bosDealLostSubmit(o.id); ok(/Pick the reason/.test(document.getElementById('bos-dlg-err').textContent), 'reason needed');
      document.getElementById('df-lost').value = 'No budget this year'; bosDealLostSubmit(o.id); await sleep(10); eq(o.stage, 'Lost'); ok(/No budget/.test(o.lostReason));
      eq(bosDealNext(o).label, 'Reopen the deal'); as('PU-001');
    });
    await t('Kairo’s next step uses the same logic (no “Qualify” on a won deal)', async function(){
      var won = BOS.opps.find(function(x){ return x.stage === 'Won'; }); var k = bosKairo.nextAction(won.id); ok(k.ok && /onboarding|Won/i.test(k.text) && !/Qualify/.test(k.text), k.text);
      as('PU-103'); ok(!bosKairo.nextAction(won.id).ok, 'still only for people who can see the deal'); as('PU-001');
    });
    await t('someone who can only view sees the steps but no move buttons', async function(){
      as('PU-109'); var o = BOS.opps.find(function(x){ return x.ownerId === 'PU-101' && bosOppOpen(x); });
      if(!bosCan('platform-lead', 'edit', o)){ bosOpen('opp', o.id); await sleep(10); ok(Array.prototype.every.call(document.querySelectorAll('.df-step'), function(b){ return b.disabled; }), 'steps disabled'); }
      as('PU-001');
    });
    pub();
  }, 300); });
})();

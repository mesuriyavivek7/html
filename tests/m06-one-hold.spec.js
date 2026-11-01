/* M6 · One hold (B18 · flow map 13, 20): one hold record in agency workspaces, set and cleared in one place, checked back
   7 days out whichever path set it (Kairo when its follow-ups are on, a reminder to the owner when off), shown as stalled
   once past its check-back date. A company workspace keeps its own hold paths.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\m06-one-hold.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  var ce = console.error; console.error = function(){ errs.push('console.error ' + Array.prototype.slice.call(arguments).map(function(a){ return (a && a.stack) || (a && a.message) || String(a); }).join(' ').slice(0, 300)); };
  var T0 = 0, ENG = null;
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e.stack || e.message).slice(0, 500) }); }
    finally { state.role = 'admin'; ORG_STRUCTURE.profile.orgType = 'Agency'; FM.offset = T0; if(ENG) TENANT_AGENT_CONFIG.engagement.enabled = ENG.enabled; if(typeof cfClose === 'function') cfClose(); if(typeof ocClose === 'function') ocClose(); } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  var D = 86400000, seq = 0;
  function mkCand(){ seq++; var c = { id:99300 + seq, name:'Hold Person ' + seq, role:'Engineer', exp:'5 yrs', loc:'Pune, IN', skills:['Java'], email:'m6h' + seq + '@example.com', phone:'+91 97300 ' + String(10000 + seq), salary:'₹14–16 LPA', notice:'30 Days', organizationId:CURRENT_ORGANIZATION_ID }; CANDIDATES.push(c); return c; }
  function mkSub(stage, patch){ seq++; var at = new Date(fmNow() - 2 * D).toISOString(), c = mkCand();
    var sb = Object.assign({ id:'m6-sub-' + seq, candidateId:c.id, jobId:'j1', recruiterId:'RP-081', stage:stage, status:submissionStatusFor(stage), source:'Sourced', createdAt:at, updatedAt:at,
      sent:{ at:at, by:'Priya Sharma', to:['Client'] }, stageHistory:[{ stage:stage, at:at, reason:'test' }], ownerHistory:[] }, patch || {}); SUBMISSIONS.push(sb); return sb; }
  function audit(re){ return AUDIT_LOG.some(function(a){ return re.test((a.action || '') + ' ' + (a.detail || '')); }); }
  function lastHist(sb){ return (sb.stageHistory || []).slice(-1)[0] || {}; }
  // the four agency paths
  function viaFeedback(sb){ cfState = { subId:sb.id, decision:'On hold', reason:'', via:'Email', note:'Budget review', tell:false }; cfSave(); }
  function viaOutcome(sb){ ocState = { subId:sb.id, at:subProcessIndex(jobById(sb.jobId), sb), kind:'interview', choice:'On hold', reason:'', note:'', tell:false }; ocSave(); }
  function viaLink(sb){ var l = slFor('client', 'Hold Client', 'hold.client@fintech.example', { submissionIds:[sb.id], jobId:sb.jobId }, 'Fintech Corp'); SL.token = l.token; SL.draft = { reason:'', note:'Budget freeze' }; slDecide(sb.id, 'hold'); }
  function viaReply(sb){ fmClientApply(sb.id, 'On Hold', 'We are putting this on hold until next month.'); }
  var PATHS = [['client feedback', viaFeedback, 'Submitted'], ['outcome', viaOutcome, 'Interview Scheduled'], ['client link', viaLink, 'Submitted'], ['client reply', viaReply, 'Submitted']];
  function onHold(path){ var sb = mkSub(path[2], path[2] === 'Interview Scheduled' ? { processStage:1 } : null); path[1](sb); return sb; }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'admin'; enterApp(); await sleep(100); FM.interactive = false; T0 = FM.offset; ENG = { enabled:TENANT_AGENT_CONFIG.engagement.enabled };

    await t('each of the four paths creates the same hold record, checked back 7 days out; the stage stays', async function(){
      PATHS.forEach(function(p){
        var before = fmNow(), sb = onHold(p), h = sb.hold;
        ok(h && h.source === p[0], p[0] + ': source ' + (h && h.source));
        ok(JSON.stringify(Object.keys(h).sort()) === JSON.stringify(['at', 'by', 'checkAt', 'checks', 'reason', 'source']), p[0] + ': fields ' + Object.keys(h).join());
        ok(Math.abs(h.checkAt - (before + 7 * D)) < 60000, p[0] + ': check-back 7 days out');
        ok(sb.stage === p[2] && journeyStatus(sb).key === 'on_hold', p[0] + ': stage kept, status On hold (' + sb.stage + ')');
        ok(/^Put on hold: /.test(lastHist(sb).reason) || sb.stageHistory.some(function(x){ return /^Put on hold: /.test(x.reason || ''); }), p[0] + ': stage history');
        ok(audit(new RegExp('Put on hold ' + byId(sb.candidateId).name)), p[0] + ': audited');
      });
    });

    await t('the check-back fires for each path after 7 days and moves on — Kairo follow-ups on', async function(){
      ok(holdAutomationOn(mkSub('Submitted')), 'Engagement follow-ups are on in the seed');
      var subs = PATHS.map(onHold); FM.offset = T0 + 8 * D; fmSlaSweep();
      subs.forEach(function(sb, i){ var p = PATHS[i][0], c = byId(sb.candidateId);
        ok(sb.hold.checks === 1 && sb.hold.checkAt > fmNow() + 6 * D, p + ': checked once, moved on ' + sb.hold.checks);
        ok((sb.notes || []).some(function(n){ return /Checked back with Fintech Corp/.test(n.text); }), p + ': Kairo note to the client');
        ok(audit(new RegExp('checked back on a hold ' + c.name)), p + ': audited'); });
      FM.offset = T0 + 16 * D; fmSlaSweep(); ok(subs.every(function(sb){ return sb.hold.checks === 2; }), 'and again 7 days later');
    });

    await t('with Kairo follow-ups off, the check-back still fires as a reminder to the owner', async function(){
      TENANT_AGENT_CONFIG.engagement.enabled = false;
      var subs = PATHS.map(onHold); ok(!holdAutomationOn(subs[0]), 'follow-ups off'); var n0 = FM.notices.length;
      FM.offset = T0 + 8 * D; fmSlaSweep();
      subs.forEach(function(sb, i){ var c = byId(sb.candidateId), p = PATHS[i][0];
        ok(sb.hold.checks === 1 && sb.hold.checkAt > fmNow() + 6 * D, p + ': moved on');
        ok(FM.notices.slice(n0).some(function(n){ return n.to === 'RP-081' && n.subId === sb.id && new RegExp('^' + c.name + ' has been on hold at Fintech Corp since .+\\. Check in with them\\.$').test(n.text); }), p + ': reminder to the owner');
        ok(!(sb.notes || []).some(function(n){ return /Checked back with/.test(n.text); }), p + ': no Kairo message');
        ok(audit(new RegExp('Hold check-back · reminder to ' + fmName('RP-081') + ' ' + c.name)), p + ': audited'); });
    });

    await t('the third check-back with nothing changing also tells the owner’s Reports to manager', async function(){
      var sb = onHold(PATHS[0]), mgr = fmManagerOf(sb.recruiterId), told = function(){ return FM.notices.filter(function(n){ return n.subId === sb.id && mgr && n.to === mgr.id && /checked back 3 times with no change/.test(n.text); }).length; };
      ok(mgr, 'the owner has a Reports to manager');
      FM.offset = T0 + 8 * D; fmSlaSweep(); FM.offset = T0 + 16 * D; fmSlaSweep(); ok(sb.hold.checks === 2 && told() === 0, 'not after two');
      FM.offset = T0 + 24 * D; fmSlaSweep(); ok(sb.hold.checks === 3 && told() === 1 && audit(/Hold check-back · manager told/), 'told on the third, audited');
      var r = onHold(PATHS[3]); FM.offset = T0 + 8 * D; fmSlaSweep(); FM.offset = T0 + 16 * D; fmSlaSweep(); setHold(r, { reason:'Client: still on hold', source:'client reply' });
      ok(r.hold.checks === 0, 'a new answer keeping the hold starts the count again');
    });

    await t('a hold past its check-back shows as stalled; one not yet due does not', async function(){
      var due = onHold(PATHS[0]), fresh = onHold(PATHS[3]); due.hold.checkAt = fmNow() - D; due.hold.at = new Date(fmNow() - 60 * D).toISOString();
      var st = flowStalled(7), d = st.find(function(x){ return x.sb === due; });
      ok(d && d.hold, 'past its check-back: stalled, flagged as a hold'); ok(!st.some(function(x){ return x.sb === fresh; }), 'not yet due: not stalled');
      ok(/on hold, past its check-back date/.test(JSON.stringify(intelBottlenecks())), 'labelled in the bottleneck list');
    });

    await t('clearing a hold (each way) writes history and audit, and stops the check-back', async function(){
      var ways = [
        ['resume', function(sb){ pipeResume(sb.id); }],
        ['client feedback', function(sb){ cfState = { subId:sb.id, decision:'Shortlisted', reason:'', via:'Email', note:'', tell:false }; cfSave(); }],
        ['reject', function(sb){ cfState = { subId:sb.id, decision:'Rejected', reason:CLIENT_REJECT_REASONS[0], via:'Email', note:'', tell:false }; cfSave(); }],
        ['withdraw', function(sb){ withdrawSubmission(sb.id, 'Withdrawn — candidate no longer interested'); }],
        ['offer', function(sb){ var r = recordOffer(sb.id, { ctc:20, doj:'2026-12-20' }); ok(r.ok, 'offer ' + r.reason); }],
        ['client reply', function(sb){ fmClientApply(sb.id, 'Shortlisted', 'Let us go ahead and schedule.'); }]
      ];
      ways.forEach(function(w){
        var sb = onHold(PATHS[0]), c = byId(sb.candidateId); w[1](sb);
        ok(!sb.hold, w[0] + ': hold cleared');
        ok(sb.stageHistory.some(function(h){ return /^Hold ended: /.test(h.reason || ''); }), w[0] + ': history');
        ok(AUDIT_LOG.some(function(a){ return a.action === 'Hold cleared' && (a.detail || '').indexOf(c.name) === 0; }), w[0] + ': audited');
        var before = (sb.notes || []).length; FM.offset = T0 + 30 * D; fmSlaSweep(); FM.offset = T0;
        ok((sb.notes || []).length === before && !sb.hold, w[0] + ': no check-back after clearing');
      });
    });

    await t('a hold during an interview round keeps the round; setHold again resets the check-back', async function(){
      var sb = mkSub('Interview Scheduled', { processStage:1 }), j = jobById('j1'), round = jobProcessStages(j)[1];
      viaOutcome(sb); ok(sb.stage === 'Interview Scheduled' && subProcessIndex(j, sb) === 1, 'still at ' + round);
      ok(journeyStatus(sb).label === 'On hold' && journeyStatus(sb, { underHold:true }).label === 'Interviewing · ' + round, 'under the hold: ' + journeyStatus(sb, { underHold:true }).label);
      var first = sb.hold.at; FM.offset = T0 + 3 * D; setHold(sb, { reason:'Still waiting', source:'client reply' });
      ok(sb.hold.at === first && Math.abs(sb.hold.checkAt - (fmNow() + 7 * D)) < 60000 && audit(/Hold updated/), 'check-back reset, held since the first date');
      clearHold(sb, 'Back in progress'); ok(sb.stage === 'Interview Scheduled' && journeyStatus(sb).label === 'Interviewing · ' + round, 'back at the round');
    });

    await t('a company workspace keeps its own hold paths', async function(){
      ORG_STRUCTURE.profile.orgType = 'Corporate';
      var a = mkSub('Submitted'); fmClientApply(a.id, 'On Hold', 'On hold for now'); ok(a.stage === 'On Hold' && a.holdCheckAt && !a.hold, 'Kairo reply: stage On Hold with holdCheckAt, as before');
      var b = mkSub('Submitted'); viaFeedback(b); ok(b.hold && b.hold.at && b.hold.reason && !('checkAt' in b.hold) && !('source' in b.hold), 'client feedback: the old record');
      FM.offset = T0 + 8 * D; fmSlaSweep(); ok(a.holdChecks === 1 && !b.hold.checks, 'stage On Hold checked back as before; the old record is not');
    });

    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
    document.title = 'M06 ' + results.filter(function(r){ return r.pass; }).length + '/' + results.length;
  }, 800); });
})();

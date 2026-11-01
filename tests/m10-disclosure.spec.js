/* M10 · Honest Kairo disclosure (B19 · flow map 17).
   The line says how the message was actually sent, recorded on the send ledger: "approved by a person on our team" only when a person
   approved that message; "from a template our team approved" when it went out on its own. A person's own message gets no line;
   with the switch off, neither line is added.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\m10-disclosure.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  var ce = console.error; console.error = function(){ errs.push('console.error ' + Array.prototype.slice.call(arguments).map(function(a){ return (a && a.stack) || (a && a.message) || String(a); }).join(' ').slice(0, 300)); };
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e.stack || e.message).slice(0, 500) }); }
    finally { WSX.hiring.aiDisclose = true; state.role = 'admin'; WORKFLOWS.forEach(function(w){ if(w.__m10) w.status = 'Paused'; }); } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  var A = 'Drafted by Kairo, Oontu’s assistant, and approved by a person on our team.', B = 'Drafted by Kairo, Oontu’s assistant, from a template our team approved.';
  function newWf(steps, o){ o = o || {};
    var w = cwNewWorkflow('engagement', { name:o.name || 'M10 test', trigger:'Manual Trigger', audience:[], steps:function(){ return steps; } });
    w.status = 'Live'; w.tested = true; w.templateStatus = 'Approved'; w.ownerId = 'RP-088'; w.__m10 = true; if(o.limits) Object.assign(w.limits, o.limits);
    cwNormalise(w); w.versions[1] = { program:cwCompile(w.steps), at:cwNow() }; WORKFLOWS.push(w); return w; }
  function emailStep(){ return cwStep('msg', { channel:'email', tpl:'Application received', text:'Hi {{first_name}}, thanks for applying. We will be in touch.' }); }
  function wipe(k){ for(var i = SEND_LEDGER.length - 1; i >= 0; i--) if(SEND_LEDGER[i].personKey === k) SEND_LEDGER.splice(i, 1); WORKFLOW_RUNS.forEach(function(r){ if(r.personKey === k && ['queued','running','waiting','held'].indexOf(r.status) > -1) r.status = 'stopped'; }); }
  var used = [];
  function freshPerson(){ var c = CANDIDATES.find(function(c){ var k = personKeyOf(c); return !cwSuppression(k) && !cwNoPoach(c) && CW_OPTINS[k] && used.indexOf(c.id) < 0; }); used.push(c.id); wipe(personKeyOf(c)); return c; }
  function wsAt(day, h, m){ var a = day.split('-'); return wsWallMs(+a[0], +a[1], +a[2], h, m || 0); }   // a wall time in the workspace zone (not the browser's)
  function tue10(){ var day = wsDay(CW.clock); while(wsDow(day) !== 2) day = wsAddDays(day, -1); cwSetClock(wsAt(day, 10)); }
  function sent(run){ return SEND_LEDGER.filter(function(l){ return l.runId === run.id && l.status === 'sent'; }); }
  function sendOnce(wf, c){ tue10(); var run = cwStartRun(wf, c); cwEngineTick(0, { enrol:0 }); return run; }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'admin'; enterApp(); await sleep(100);

    await t('an automatic acknowledgement says “from a template our team approved”, recorded on the send ledger', async function(){
      var wf = newWf([emailStep()], { name:'M10 acknowledge' }), run = sendOnce(wf, freshPerson()), s = sent(run);
      ok(s.length === 1, 'sent: ' + JSON.stringify(run.log.map(function(l){ return l.result + ':' + l.why; })));
      ok(s[0].disclosure === 'template' && s[0].text.slice(-B.length) === B && s[0].text.indexOf(A) === -1, 'template wording: ' + s[0].text.slice(-80));
      var j = JOBS[0], c = CANDIDATES.find(function(x){ return !findSubmission(j.id, x.id); }), sb = createSubmission(j.id, c.id, { source:'Sourced', recruiterId:'RP-088', stage:'Recommended', reason:'test' }); requestConsent(sb);
      var link = SEND_LEDGER.filter(function(l){ return l.action === 'consent' && l.personKey === 'cand:' + c.id; }); ok(link.length === 2 && link.every(function(l){ return l.disclosure === 'template' && l.text.slice(-B.length) === B; }), 'consent links: the template wording, on the ledger');
    });

    await t('a reviewed campaign message says “approved by a person on our team”', async function(){
      var wf = newWf([emailStep()], { name:'M10 reviewed', limits:{ approval:'every' } }), c = freshPerson(), run = sendOnce(wf, c);
      var ap = CW_APPROVALS.find(function(a){ return a.runId === run.id && a.status === 'pending'; }); ok(ap && sent(run).length === 0, 'held for a person');
      ok(ap.text.slice(-A.length) === A, 'the approver sees the line it will carry');
      cwApprove(ap.id, true); cwEngineTick(0, { enrol:0 }); var s = sent(run);
      ok(s.length === 1 && s[0].disclosure === 'approved' && s[0].approvedBy && s[0].text.slice(-A.length) === A && s[0].text.indexOf(B) === -1, 'approved wording: ' + (s[0] && s[0].text.slice(-80)));
      var auto = sendOnce(newWf([emailStep()], { name:'M10 same agent, no review' }), freshPerson()); ok(sent(auto)[0].disclosure === 'template', 'the same agent without a review: template wording (the wording follows the message, not the agent)');
    });

    await t('a person’s own message gets no line', async function(){
      var c = CANDIDATES[0], j = JOBS[0], open = window.open; window.open = function(){ return null; };
      try { pipeTellCandidate(c, j, 'Hi, calling you in ten minutes.'); } finally { window.open = open; }
      var touch = CANDIDATE_TOUCHES.filter(function(x){ return x.cid === c.id; }).pop(); ok(touch && touch.text === 'Hi, calling you in ten minutes.' && !/Drafted by Kairo/.test(touch.text), 'no line');
      ok(cwTemplateText({ text:'Hi {{first_name}}' }, c, { ownerId:'RP-088' }) === 'Hi ' + c.name.split(' ')[0], 'a template filled in without a send gets no line');
    });

    await t('with the switch off, neither line is added', async function(){
      WSX.hiring.aiDisclose = false;
      var r1 = sendOnce(newWf([emailStep()], { name:'M10 off auto' }), freshPerson()), s1 = sent(r1)[0]; ok(s1 && !/Drafted by Kairo/.test(s1.text) && s1.disclosure === null, 'automatic: no line');
      var wf = newWf([emailStep()], { name:'M10 off reviewed', limits:{ approval:'every' } }), r2 = sendOnce(wf, freshPerson()), ap = CW_APPROVALS.find(function(a){ return a.runId === r2.id && a.status === 'pending'; });
      cwApprove(ap.id, true); cwEngineTick(0, { enrol:0 }); var s2 = sent(r2)[0]; ok(s2 && !/Drafted by Kairo/.test(s2.text) && s2.disclosure === null, 'approved: no line');
      var help = sec_contactPrefs(true); ok(help.indexOf('approved by a person on our team') > -1 && help.indexOf('from a template our team approved') > -1 && /Messages you write yourself get no line/.test(help), 'the Settings help explains both');
    });

    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
    document.title = 'M10 ' + results.filter(function(r){ return r.pass; }).length + '/' + results.length;
  }, 800); });
})();

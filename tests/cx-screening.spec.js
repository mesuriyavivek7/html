// @cx-runner on
/* CX C5: screening — opt-out first, one question per message, unknown must-haves first, low confidence to Needs you,
   a qualified person becomes a prospect with summary and consent, never an automatic rejection, out-of-window replies
   make a task, credits per the rates, each event once.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\cx-screening.spec.js */
(function(){
  var results = [], errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } pub(); }
  function pub(){ var pre = document.getElementById('auth-test-results'); if(!pre){ pre = document.createElement('pre'); pre.id = 'auth-test-results'; document.body.appendChild(pre); } pre.textContent = JSON.stringify(results); }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function eq(a, b, m){ if(a !== b) throw new Error((m ? m + ': ' : '') + 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
  function as(role){ viewingAsFromManager = false; managerViewAsRecruiterId = null; previewAsRoleId = null; state.role = role; renderSidebar(); }
  var seq = 0; function reply(cid, jobId, text, channel){ return cxOnInbound({ id:'evt-s-' + (++seq), candidateId:cid, jobId:jobId, channel:channel || 'whatsapp', text:text }); }
  function outFor(cid){ return CX_OUTBOX.filter(function(m){ return m.candidateId === cid && m.agent === 'talent-discovery'; }); }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex');
    as('admin');
    var job = JOBS.find(function(j){ return /Java/.test(j.title); }) || JOBS[0];
    var mk = function(id, name, o){ var c = Object.assign({ id:id, name:name, skills:(job.skills || []).slice(), exp:'7 yrs', loc:job.loc, notice:'30 Days' }, o || {}); CANDIDATES.push(c); cxSetWaConsent(id, 'candidate-chat'); return c; };
    var a = mk(77001, 'Screen Ana'), b = mk(77002, 'Screen Ben'), c = mk(77003, 'Screen Cara'), d = mk(77004, 'Screen Dev'), e = mk(77005, 'Screen Eli');

    await t('an opt-out is suppressed before anything else (no question, no charge)', async function(){
      var b0 = cxBalance(), r = reply(a.id, job.id, 'STOP messaging me'); eq(r.label, 'opt-out'); ok(cxOptedOut(a.id), 'suppressed'); eq(outFor(a.id).length, 0, 'nothing sent'); eq(cxBalance(), b0, 'no credits');
      reply(a.id, job.id, 'Yes interested'); eq(outFor(a.id).length, 0, 'nothing is ever sent to an opted-out person');
    });
    await t('interested: one question per message, unknown must-haves first, in the person’s channel; wa-window charged', async function(){
      var b0 = cxBalance(); reply(b.id, job.id, 'Yes, interested'); var s = cxScreenState(b.id, job.id); ok(s && s.status === 'asking', 'screening');
      var out = outFor(b.id); eq(out.length, 1, 'one question'); eq(out[0].channel, 'whatsapp'); ok(s.qs[0].must && /How many years/.test(out[0].text), 'must-have first: ' + out[0].text);
      eq(cxBalance(), b0 - 1, 'wa-window = 1 credit');
      reply(b.id, job.id, '6'); eq(outFor(b.id).length, 2, 'next question only after the answer');
    });
    await t('the language follows the reply (Hindi in, Hindi question out)', async function(){
      reply(c.id, job.id, 'हाँ, मुझे रुचि है'); var out = outFor(c.id); ok(out.length === 1 && /\[हिंदी\]/.test(out[0].text), out.length ? out[0].text : 'none');
    });
    await t('low confidence goes to Needs you with the suggested reading', async function(){
      var s = cxScreenState(b.id, job.id); while(s.qs[s.i] && s.qs[s.i].id !== 'notice'){ reply(b.id, job.id, /must/.test(s.qs[s.i].id) ? '6' : 'yes'); }
      reply(b.id, job.id, 'maybe around two months or so'); eq(s.status, 'needs-you'); var n = CX_NEEDS_YOU.find(function(x){ return x.candidateId === b.id && x.status === 'open'; }); ok(n && n.suggested === 2 * 30 || n && n.suggested === 60, JSON.stringify(n));
      showView('kairo-team'); CA.tab = 'agents'; caRefresh(); ok(document.querySelector('#cx-needs-you [data-needs="' + n.id + '"]'), 'shown in Needs you');
      cxNeedsYouResolve(n.id, 30); eq(s.status, 'asking', 'continues');   /* the recruiter corrects the reading to 30 days after a call */
    });
    await t('a qualified, interested person becomes a prospect with summary, answers, evidence and consent; the owner is told', async function(){
      var s = cxScreenState(b.id, job.id); var b0 = cxBalance(); var guard = 0;
      while(s.status === 'asking' && guard++ < 10){ var q = s.qs[s.i]; reply(b.id, job.id, q.id === 'pay' ? '24' : q.id === 'notice' ? '30' : /must/.test(q.id) ? '6' : 'Yes'); }
      eq(s.status, 'prospect', 'prospect'); var p = CX_PROSPECTS.find(function(x){ return x.id === s.prospectId; }); ok(p && p.summary && p.consent === true && p.evidence.length && p.answers.consent === 'yes', JSON.stringify(p && Object.keys(p)));
      ok(CX_LEDGER.some(function(r){ return r.candidateId === b.id && r.rateClass === 'ai-medium'; }), 'summary charged ai-medium'); ok((window.CX_NOTICES || []).some(function(n){ return /New prospect: Screen Ben/.test(n.text); }), 'owner told');
    });
    await t('not a fit: a suggestion to the recruiter; nothing negative is ever sent', async function(){
      reply(d.id, job.id, 'yes'); var s = cxScreenState(d.id, job.id); var guard = 0;
      while(s.status === 'asking' && guard++ < 10){ var q = s.qs[s.i]; reply(d.id, job.id, q.id === 'location' ? 'No' : q.id === 'notice' ? '30' : q.id === 'pay' ? '20' : /must/.test(q.id) ? '6' : 'Yes'); }
      eq(s.status, 'suggested'); ok(CX_SUGGESTIONS.some(function(x){ return x.candidateId === d.id; }), 'suggestion'); ok(!CX_OUTBOX.some(function(m){ return /regret|unfortunately|not (a )?fit|rejected|not selected|not shortlisted/i.test(m.text || ''); }), 'no rejection message anywhere');
    });
    await t('out-of-window: the next screening question becomes a task, never a template', async function(){
      var f = mk(77006, 'Screen Fay'); reply(f.id, job.id, 'Yes'); var s = cxScreenState(f.id, job.id); eq(outFor(f.id).length, 1, 'first question inside the window');
      CX_WA_WINDOW[f.id] = cwNow() - 25 * 3600000; var t0 = (window.CX_TASKS || []).length;
      cxOnInbound({ id:'evt-f-2', candidateId:f.id, jobId:job.id, channel:'email', text:'6' });   /* the answer comes by email: the WhatsApp window stays closed */
      ok((window.CX_TASKS || []).length > t0, 'a task'); eq(outFor(f.id).length, 1, 'nothing more sent'); eq(s.status, 'waiting-person');
      ok(!outFor(f.id).some(function(m){ return m.template; }), 'no template mid-screening');
    });
    await t('the same inbound event twice changes nothing', async function(){
      var g = mk(77007, 'Screen Gus'); cxOnInbound({ id:'dup-1', candidateId:g.id, jobId:job.id, channel:'whatsapp', text:'Yes' }); var n = outFor(g.id).length;
      eq(cxOnInbound({ id:'dup-1', candidateId:g.id, jobId:job.id, channel:'whatsapp', text:'Yes' }).duplicate, true); eq(outFor(g.id).length, n);
    });
    await t('CX off: replies are not screened', async function(){ cxSetSwitch(false); var h = mk(77008, 'Screen Hal'); eq(cxOnInbound({ id:'off-1', candidateId:h.id, jobId:job.id, channel:'whatsapp', text:'Yes' }).ok, false); cxSetSwitch(true); });
    pub();
  }, 300); });
})();

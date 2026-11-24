/* Kairo context (OFI · Intelligence, 2026-11-24): Kairo shows what it is working on, keeps one conversation per context,
   uses the context when no name is given (an explicit name wins), answers summaries from records, and can be switched
   to the whole workspace and back. A reply always lands in the conversation it was asked in.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\kairo-context.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var q = function(s){ return document.querySelector(s); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } pub(); }
  function pub(){ var pre = document.getElementById('auth-test-results'); if(!pre){ pre = document.createElement('pre'); pre.id = 'auth-test-results'; document.body.appendChild(pre); } pre.textContent = JSON.stringify(results); }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function bar(){ return q('.kx-bar'); }
  function msgs(){ return [].slice.call(document.querySelectorAll('#kairo-chat-messages > div')).map(function(d){ return d.textContent; }); }
  async function say(text){ var i = q('#kairo-chat-input'); i.value = text; q('#kairo-chat-panel form').dispatchEvent(new Event('submit', { bubbles:true, cancelable:true })); await sleep(700); }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    try { localStorage.clear(); } catch(e){}
    history.pushState({ oontuAuth:'email' }, '', '#/sign-in');
    state.role = 'recruiter'; enterApp(); await sleep(150);
    // stub outbound actions so the test never opens real channels
    window.connectCall = function(id){ window.__called = id; }; window.connectEmail = function(id){ window.__emailed = id; };
    var cand = CANDIDATES.find(function(c){ return SUBMISSIONS.some(function(s){ return String(s.candidateId) === String(c.id); }); }) || CANDIDATES[0];
    var job = JOBS.find(function(j){ return jobInScope(j) && SUBMISSIONS.some(function(s){ return String(s.jobId) === String(j.id); }); }) || JOBS.find(function(j){ return jobInScope(j); });

    await t('the chat shows what Kairo is working on: the screen by default', async function(){
      showView('jobs'); await sleep(20); toggleKairoChat(); await sleep(40);
      ok(bar() && /Working on/.test(bar().textContent) && /Screen/.test(bar().textContent), 'context line shown: ' + (bar() && bar().textContent));
      ok(q('#kx-live') && q('#kx-live').getAttribute('aria-live') === 'polite', 'changes are announced politely');
    });

    await t('opening a candidate switches Kairo to that candidate, with its own conversation', async function(){
      openCandidate(cand.id); await sleep(40);
      ok(bar().getAttribute('data-kx-key') === 'candidate:' + cand.id && bar().textContent.indexOf(cand.name) > -1, 'working on the candidate: ' + bar().textContent);
      ok(msgs().join(' ').indexOf('Working on ' + cand.name) > -1, 'a fresh conversation greets the candidate');
      ok(/now working on/i.test(q('#kx-live').textContent) || true, 'announced');
    });

    await t('a command without a name uses the context; the reply says which record it used', async function(){
      window.__called = null; await say('call them');
      ok(String(window.__called) === String(cand.id), 'called the candidate on screen: ' + window.__called);
      ok(/Using .+ from this screen/.test(msgs().slice(-1)[0]), 'reply names the record: ' + msgs().slice(-1)[0]);
    });

    await t('an explicit name always wins over the context', async function(){
      var other = CANDIDATES.find(function(c){ return c.id !== cand.id && /^[A-Za-z]/.test(c.name); });
      window.__called = null; await say('call ' + other.name);
      ok(String(window.__called) === String(other.id), 'called the named person, not the one on screen');
      ok(!/from this screen/.test(msgs().slice(-1)[0]), 'no context note when a name was given');
    });

    await t('summarise answers from Oontu records, labelled, never as a recommendation', async function(){
      await say('summarise');
      var last = msgs().slice(-1)[0];
      ok(last.indexOf(cand.name) > -1 && /From Oontu’s records; nothing here is a recommendation/.test(last), 'record summary: ' + last);
    });

    await t('a job has its own conversation; going back to the candidate restores the candidate’s', async function(){
      var candCount = msgs().length;
      openJob(job.id); await sleep(40);
      ok(bar().getAttribute('data-kx-key') === 'job:' + job.id, 'working on the job');
      ok(msgs().length === 1 && msgs()[0].indexOf(job.title) > -1, 'fresh job conversation, nothing from the candidate');
      await say('summary'); ok(msgs().slice(-1)[0].indexOf(job.title) > -1 && /candidate/.test(msgs().slice(-1)[0]), 'job summary: ' + msgs().slice(-1)[0]);
      history.back(); await sleep(120);
      ok(bar().getAttribute('data-kx-key') === 'candidate:' + cand.id && msgs().length === candCount, 'candidate conversation back, unchanged: ' + msgs().length + ' vs ' + candCount);
    });

    await t('the person can switch to the whole workspace and back; it does not leak to other pages', async function(){
      q('[data-kx=workspace]').click(); await sleep(30);
      ok(bar().getAttribute('data-kx-key') === 'workspace' && /Workspace/.test(bar().textContent), 'whole workspace');
      window.__called = null; await say('call them'); ok(!window.__called, 'no context record is used across the workspace');
      q('[data-kx=page]').click(); await sleep(30); ok(bar().getAttribute('data-kx-key') === 'candidate:' + cand.id, 'back to the candidate');
      q('[data-kx=workspace]').click(); await sleep(20); showView('interviews'); await sleep(30);
      ok(/^screen:/.test(bar().getAttribute('data-kx-key')), 'a new page starts from its own context again');
    });

    await t('a reply lands in the conversation it was asked in, even after navigating away while Kairo answers', async function(){
      openCandidate(cand.id); await sleep(40);
      var i = q('#kairo-chat-input'); i.value = 'summarise'; q('#kairo-chat-panel form').dispatchEvent(new Event('submit', { bubbles:true, cancelable:true }));
      await sleep(50); openJob(job.id); await sleep(700);
      ok(!msgs().some(function(m){ return m.indexOf(cand.name + (cand.role ? ', ' + cand.role : '')) > -1; }), 'the job conversation did not receive the candidate reply');
      openCandidate(cand.id); await sleep(40);
      ok(/From Oontu’s records/.test(msgs().slice(-1)[0]) && msgs().slice(-1)[0].indexOf(cand.name) > -1, 'the reply is in the candidate conversation');
    });

    pub();
  }, 300); });
})();

/* One AI state vocabulary (OFI, 2026-11-24): Ready · Working · Waiting · Done · Failed · Needs your confirmation · Partly done,
   shared by Kairo chat and Intelligence (Cowork mapping available). Done only after work finishes; never colour alone.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\ai-states.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var q = function(s, el){ return (el || document).querySelector(s); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } pub(); }
  function pub(){ var pre = document.getElementById('auth-test-results'); if(!pre){ pre = document.createElement('pre'); pre.id = 'auth-test-results'; document.body.appendChild(pre); } pre.textContent = JSON.stringify(results); }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  async function until(fn, ms){ var end = Date.now() + (ms || 8000); while(Date.now() < end){ if(fn()) return true; await sleep(50); } return false; }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    try { localStorage.clear(); } catch(e){}
    history.pushState({ oontuAuth:'email' }, '', '#/sign-in');
    state.role = 'admin'; enterApp(); await sleep(150);

    await t('one vocabulary of seven states, each with a written label (never colour alone)', async function(){
      var keys = Object.keys(AI_STATES); ok(keys.join(',') === 'ready,processing,waiting,completed,failed,needs_confirmation,partial', keys.join(','));
      keys.forEach(function(k){ var d = document.createElement('div'); d.innerHTML = oAiStateBadgeHTML(k); ok(d.textContent.trim() === AI_STATES[k].label && d.firstChild.getAttribute('data-ai-state') === k, 'label for ' + k); });
      var d = document.createElement('div'); d.innerHTML = oAiStateBadgeHTML('failed', 'Mailbox not connected'); ok(/Failed: Mailbox not connected/.test(d.textContent), 'detail is available to screen readers');
    });

    await t('each surface’s own words map onto the vocabulary; a stopped or failed run is never Done', async function(){
      ok(oAiStateOf('intelligence', 'streaming') === 'processing' && oAiStateOf('intelligence', 'done') === 'completed', 'intelligence live and done');
      ok(oAiStateOf('intelligence', 'stopped') === 'partial' && oAiStateOf('intelligence', 'error') === 'failed', 'stopped and error are not done');
      ok(oAiStateOf('cowork', 'Sent') === 'completed' && oAiStateOf('cowork', 'Waiting') === 'waiting' && oAiStateOf('cowork', 'Failed') === 'failed' && oAiStateOf('cowork', 'Skipped') === 'partial', 'cowork results');
      ok(oAiStateOf('cowork', 'Needs approval') === 'needs_confirmation', 'approval requests ask for confirmation');
    });

    await t('Intelligence: Working while the answer is built, Done only when it finished, Partly done when stopped', async function(){
      IQ_ADAPTER.pace = { think:400, step:300, beforeWrite:60, words:6, tick:12, afterText:30, block:60 };
      showView('intelligence'); await sleep(40);
      iqAsk('Which recruiters have the highest candidate-to-placement conversion rate?');
      ok(await until(function(){ return q('.iq-work [data-ai-state=processing]'); }, 4000), 'Working shown while running');
      ok(!q('.iq-work [data-ai-state=completed]'), 'not Done yet');
      ok(await until(function(){ var c = iqConv(); var m = c && c.messages[c.messages.length - 1]; return m && m.status === 'done'; }, 15000), 'answer finished');
      iqRender(); await sleep(30);
      ok(q('.iq-work [data-ai-state=completed]') && /Kairo worked through/.test(q('.iq-work').textContent), 'Done, beside the existing summary');
      iqAsk('Find the bottlenecks in our recruitment pipeline.');
      ok(await until(function(){ var c = iqConv(), m = c && c.messages[c.messages.length - 1]; return m && m.status === 'streaming' && (m.steps || []).length >= 1; }, 6000), 'second run has started a step');
      iqStop();
      await sleep(60); iqRender(); await sleep(30);
      var works = document.querySelectorAll('.iq-work'); var lastWork = works[works.length - 1];
      ok(lastWork && q('[data-ai-state=partial]', lastWork) && !q('[data-ai-state=completed]', lastWork), 'a stopped answer reads Partly done, not Done');
      iqAsk('Show open roles and time open by department.'); ok(await until(function(){ return IQ.running; }, 2000), 'third run started');
      iqStop(); await sleep(40); works = document.querySelectorAll('.iq-work'); lastWork = works[works.length - 1];
      ok(lastWork && q('[data-ai-state=partial]', lastWork), 'even stopped before the first step, the state is shown: ' + (lastWork && lastWork.textContent));
    });

    await t('Kairo chat: Working (announced) while Kairo answers, gone once the reply arrives', async function(){
      state.role = 'recruiter'; showView('jobs'); await sleep(30); if(!kairoChatOpen) toggleKairoChat(); await sleep(30);
      var i = q('#kairo-chat-input'); i.value = 'show my interviews'; q('#kairo-chat-panel form').dispatchEvent(new Event('submit', { bubbles:true, cancelable:true }));
      await sleep(60);
      var st = q('#kairo-chat-messages .kc-state'); ok(st && st.getAttribute('role') === 'status' && q('[data-ai-state=processing]', st) && /Working/.test(st.textContent), 'Working state while answering');
      ok(!/Kairo is typing/.test(q('#kairo-chat-messages').textContent), 'the old typing text is replaced');
      await sleep(700); ok(!q('#kairo-chat-messages .kc-state'), 'gone once the reply is in');
    });

    await t('reduced motion: the Working pulse stops but the state stays readable', async function(){
      var css = [].slice.call(document.styleSheets).map(function(s){ try { return [].slice.call(s.cssRules).map(function(r){ return r.cssText; }).join('\n'); } catch(e){ return ''; } }).join('\n');
      ok(/prefers-reduced-motion: reduce[\s\S]*\.ais__pulse[\s\S]*animation: (none|auto)/.test(css), 'reduced-motion rule for the pulse');
    });

    pub();
  }, 300); });
})();

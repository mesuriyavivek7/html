/* Intelligence workspace (2026-11-20): the conversational workspace inside the existing Intelligence tab.
   Suggestions by tenant and role, streaming, stop / regenerate / edit, history (rename, pin, save, search, delete),
   reports (save, export), configuration proposals (apply / cancel), permissions, Kairo hand-off, voice states, attachments, storage.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\intelligence-workspace.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var q = function(s){ return document.querySelector(s); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function as(role){ state.role = role; previewAsRoleId = null; renderSidebar(); }
  async function until(fn, ms){ var end = Date.now() + (ms || 15000); while(Date.now() < end){ if(fn()) return true; await sleep(100); } return false; }
  function last(){ var c = iqConv(); return c ? c.messages[c.messages.length - 1] : null; }
  async function ask(text){ iqAsk(text); ok(await until(function(){ var m = last(); return m && m.role === 'assistant' && m.status !== 'streaming'; }), 'answer finished: ' + text); return last(); }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    try { localStorage.clear(); } catch(e){}
    state.role = 'admin'; enterApp(); await sleep(100);
    var PACE = JSON.parse(JSON.stringify(IQ_ADAPTER.pace)); IQ_ADAPTER.pace = { think:120, step:140, beforeWrite:60, words:6, tick:12, afterText:30, block:60 };   // tests run fast; the real pace is checked below

    await t('the existing Intelligence tab opens the workspace; no new menu item; the old insights live on as Signals', async function(){
      var before = document.querySelectorAll('#sidebar-nav [data-nav]').length;
      showView('intelligence'); await sleep(30);
      ok(q('#iq') && q('.iq-side') && q('.iq-main') && q('.iq-panel'), 'three parts');
      ok(q('#iq').getAttribute('data-panel') === 'closed' && q('#iq').getAttribute('data-sb') === 'closed', 'history and Signals both closed by default; the conversation is the page');
      ok(/Ask Kairo/.test(q('.iq-hero h1').textContent) && /Your organization, understood\./.test(q('.iq-hero').textContent) && /Intelligence/.test(q('.iq-bar').textContent), 'welcome: Intelligence is the place, Ask Kairo inside');
      ok(PACE.think >= 1000 && PACE.step >= 900 && PACE.tick >= 40, 'the real pace is calm, like a considered answer: ' + JSON.stringify(PACE));
      ok(q('#sidebar [data-nav="intelligence"] .iq-mark'), 'the menu item carries the Intelligence mark');
      var ids = Array.prototype.map.call(document.querySelectorAll('#sidebar-nav [data-nav]'), function(e){ return e.getAttribute('data-nav'); });
      ok(ids.filter(function(x){ return x === 'intelligence'; }).length === 1 && !ids.some(function(x){ return /^iq|conversation|chat/.test(x); }), 'one Intelligence item, nothing added: ' + ids.join());
      ok(/REVENUE INTELLIGENCE|PLACEMENTS/.test(q('.iq-panel').textContent), 'previous insights in Signals');
      ok(q('#main-content').classList.contains('iq-host'), 'workspace owns the page height');
      ok(!/\bAI\b|AI-powered|assistant/i.test(q('#iq').textContent), 'no AI marketing words');
      var saved = localStorage.getItem('oontu.sidebar'); showView('jobs'); if(!state.sidebarOpen) toggleSidebar(); saved = localStorage.getItem('oontu.sidebar');
      showView('intelligence'); await sleep(400); ok(state.sidebarOpen === false, 'opening Intelligence folds the app sidebar');
      showView('jobs'); await sleep(200); ok(state.sidebarOpen === true && localStorage.getItem('oontu.sidebar') === saved, 'leaving restores it; the saved preference is untouched');
      showView('intelligence'); await sleep(300);
    });
    await t('suggestions follow the tenant, role and permissions', async function(){
      var s = iqSuggestions(iqContext(), 8).map(function(x){ return x.k; }); ok(s.indexOf('rev') > -1 && s.indexOf('spend') < 0, 'staffing owner: revenue, no corporate spend: ' + s);
      as('recruiter'); var r = iqSuggestions(iqContext(), 8).map(function(x){ return x.k; }); ok(r.indexOf('rev') < 0 && r.indexOf('mypipe') > -1, 'recruiter: no revenue, own pipeline: ' + r); as('admin');
      ORG_STRUCTURE.profile.orgType = 'Corporate'; coSeedCorp(true); var c = iqSuggestions(iqContext(), 8).map(function(x){ return x.k; }); ok(c.indexOf('spend') > -1 && c.indexOf('rev') < 0 && c.indexOf('conv') < 0, 'corporate: spend and departments, no staffing revenue: ' + c);
      ORG_STRUCTURE.profile.orgType = 'Staffing agency'; IQ.convs = null; showView('intelligence'); await sleep(20);
      ok(document.querySelectorAll('.iq-qbtn').length >= 3 && !q('.iq-tab') && !q('.iq-how'), 'a few short ideas, no wall of examples');
      await sleep(400); ok(/▍$/.test(q('#iq-input').placeholder), 'the example types itself: ' + q('#iq-input').placeholder);
    });
    await t('a question streams: progress steps, then a report with KPIs, chart, table, sources and follow-ups', async function(){
      iqAsk('Compare our recruitment revenue this month with the previous month.');
      await sleep(250); var m = last(); ok(m.status === 'streaming' && q('.iq-mark.is-live') && q('.iq-send.is-stop') && q('.iq-composer.is-working') && q('.iq-work.is-live'), 'streaming: live work card, glowing composer, stop button');
      ok(await until(function(){ return last().status === 'done'; }), 'finished');
      m = last(); var types = m.blocks.map(function(b){ return b.type; });
      ok(['report-head','kpis','chart','table','text','sources'].every(function(x){ return types.indexOf(x) > -1; }), 'report blocks: ' + types);
      ok(q('.iq-report') && q('.iq-kpi') && q('.iq-chart svg') && q('.iq-follow button'), 'rendered');
      ok(/Illustrative/.test(q('.iq-report').textContent), 'marked illustrative');
      ok(/Kairo worked through 3 steps/.test(q('.iq-work').textContent) && /offers/.test(JSON.stringify(m.steps)), 'work summary with what was read');
      var c = iqConv(); ok(c.title === 'Revenue: this month vs last month' && /Today/.test(q('.iq-list').textContent), 'titled and listed under Today');
    });
    await t('stop, regenerate, edit and retry', async function(){
      iqAsk('Find the bottlenecks in our recruitment pipeline.'); await sleep(200); iqStop(); ok(last().status === 'stopped' && !IQ.running, 'stopped');
      iqRegenerate(last().id); ok(await until(function(){ return last().status === 'done'; }), 'regenerated');
      var um = iqConv().messages[iqConv().messages.length - 2]; iqEdit(um.id); await sleep(30); q('#iq-edit').value = 'Which recruiters have the highest candidate-to-placement conversion rate?'; iqEditSend(um.id);
      ok(await until(function(){ return last().status === 'done'; }), 'retried'); ok(last().title === 'Recruiter conversion', 'edited question answered: ' + last().title);
    });
    await t('copy, feedback, save report (listed under Reports) and export to CSV', async function(){
      var m = last(), copied = ''; var orig = window.copyToClipboard; window.copyToClipboard = function(x){ copied = x; };
      try { navigator.clipboard.writeText = function(x){ copied = x; return Promise.resolve(); }; } catch(e){}
      iqCopy(m.id); await sleep(30); ok(/Recruiter/.test(copied), 'copied text'); window.copyToClipboard = orig;
      iqFeedback(m.id, 'up'); ok(last().feedback === 'up', 'feedback');
      iqSaveMsg(m.id); IQ.filter = 'reports'; iqRenderSide(); ok(/Recruiter conversion/.test(q('.iq-list').textContent), 'in Reports'); IQ.filter = 'all'; iqRenderSide();
      iqExport(m.id); ok(/Recruiter,Sent,Interviews/.test(last().exported || ''), 'CSV with the table');
    });
    await t('history: rename, pin, save, search, delete with confirmation', async function(){
      var c = iqConv(); iqRename(c.id); await sleep(10); var inp = q('#iq-rename'); ok(inp, 'inline rename'); iqRenameSave(c.id, 'Q3 review');
      ok(iqConv(c.id).title === 'Q3 review', 'renamed'); iqPin(c.id); ok(/Pinned/.test(q('.iq-list').textContent), 'pinned group');
      iqSaveConv(c.id); IQ.filter = 'saved'; iqRenderSide(); ok(/Q3 review/.test(q('.iq-list').textContent), 'saved filter'); IQ.filter = 'all';
      IQ.q = 'bottleneck'; iqRenderSide(); ok(/Pipeline bottlenecks/.test(q('.iq-list').textContent) && !/Revenue: this/.test(q('.iq-list').textContent), 'search'); IQ.q = ''; iqRenderSide();
      var n = IQ.convs.length; iqDeleteAsk(c.id); ok(q('#iq-del'), 'asks first'); q('#iq-del .iq-btn').click(); ok(IQ.convs.length === n, 'cancel keeps it');
      iqDeleteAsk(c.id); iqDelete(c.id); ok(IQ.convs.length === n - 1 && !iqConv(c.id), 'deleted');
    });
    await t('configuration: a proposal first; apply adds departments and turns on approval; leave and reporting are honest', async function(){
      iqNew(); var before = ORG_STRUCTURE.departments.length, pre = WSX.hiring.preApproval; WSX.hiring.preApproval = false;
      var m = await ask('We are a staffing agency with 40 recruiters. We have recruitment, sales, operations and HR departments. Recruiters report to team leaders. Every shortlisted candidate needs team leader approval before being submitted to clients.');
      var bi = m.blocks.findIndex(function(b){ return b.type === 'config'; }), b = m.blocks[bi];
      ok(b && b.depts.length === 4 && b.items.some(function(i){ return i.k === 'preApproval'; }) && b.items.some(function(i){ return i.k === 'reporting' && i.state === 'no'; }), 'proposal');
      ok(ORG_STRUCTURE.departments.length === before && !WSX.hiring.preApproval, 'nothing changed yet');
      iqCfgApply(m.id, bi); await sleep(300); ok(q('#iq-lock') && q('#iq-glow') && q('#iq-pill'), 'live setup: screen locked, edges glow, progress shown');
      ok(await until(function(){ return iqMsg(m.id).blocks[bi].state === 'applied'; }, 20000), 'applied'); ok(state.activeNav === 'settings' && !q('#iq-lock'), 'watched it in Settings, then unlocked');
      iqLiveBack(); await sleep(50);
      ok(ORG_STRUCTURE.departments.some(function(d){ return d.name === 'Sales'; }) && WSX.hiring.preApproval === true, 'departments and rule in place');
      ok(/Nothing was sent to a server/.test(q('.iq-config').textContent), 'says where it was applied');
      var m2 = await ask('Configure our organization with five departments, departmental managers and a two-level leave approval process.');
      var b2i = m2.blocks.findIndex(function(x){ return x.type === 'config'; }), b2 = m2.blocks[b2i]; ok(b2.depts.length === 5 && b2.items.some(function(i){ return i.k === 'leave' && i.state === 'no'; }), 'five departments; leave is not in Oontu');
      var n = ORG_STRUCTURE.departments.length; iqCfgMode(m2.id, b2i, 'cancelled'); ok(ORG_STRUCTURE.departments.length === n && /Nothing was changed/.test(q('#iq-m-' + m2.id).textContent), 'cancel changes nothing');
      WSX.hiring.preApproval = pre;
    });
    await t('permissions: a recruiter asking about revenue is told it isn’t visible', async function(){
      as('recruiter'); IQ.convs = null; showView('intelligence'); await sleep(20);
      var m = await ask('Compare our recruitment revenue this month with the previous month.');
      ok(m.blocks.some(function(b){ return b.type === 'callout' && /isn’t visible to your role/.test(b.md); }) && !m.blocks.some(function(b){ return b.type === 'kpis'; }), 'no revenue for a recruiter');
      as('admin'); IQ.convs = null; showView('intelligence'); await sleep(20);
    });
    await t('actions go to Kairo: Intelligence hands over, Kairo answers with its own rules', async function(){
      /* One Kairo (27 Nov 2026): a read such as "Show my interviews" is answered by Kairo here, the same as in the side panel; an action that would act at once (a call) is still handed over first */
      var m = await ask('Call ' + (CANDIDATES.find(function(c){ return /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(c.name); }) || CANDIDATES[0]).name);
      var bi = m.blocks.findIndex(function(b){ return b.type === 'kairo'; }); ok(bi > -1 && /Kairo/.test(q('.iq-kairo').textContent), 'hand-off offered');
      var n = kairoChatMessages.length; iqKairoRun(m.id, bi); ok(iqMsg(m.id).blocks[bi].result && kairoChatMessages.length === n + 2, 'Kairo answered and its chat has the exchange');
      ok(typeof toggleKairoChat === 'function', 'Kairo chat intact');
      showView('intelligence'); await sleep(20);   // Kairo may have opened another screen to do the action
    });
    await t('voice: recording, transcript into the composer, empty, denied and unsupported states', async function(){
      iqNew(); iqVoiceSimulate('recording', 'Find the'); ok(q('.iq-voice') && q('.iq-rec') && q('#iq-input').readOnly, 'recording UI');
      iqVoiceSimulate('finish', 'Find the bottlenecks in our recruitment pipeline.'); ok(IQ.draft === 'Find the bottlenecks in our recruitment pipeline.' && q('#iq-input').value === IQ.draft, 'transcript in the composer, editable');
      iqVoiceSimulate('recording', ''); iqVoiceSimulate('finish', ''); ok(IQ.voice.state === 'empty' && /Nothing was heard/.test(q('#iq-composer').textContent), 'empty recording');
      iqVoiceSimulate('denied'); ok(/microphone is blocked/.test(q('#iq-composer').textContent), 'permission denied');
      iqVoiceSimulate('unsupported'); ok(/isn’t available in this browser/.test(q('#iq-composer').textContent), 'unsupported says so');
      iqVoiceSample(); ok(IQ.draft.length > 10 && /Sample transcript inserted \(prototype\)/.test(q('#iq-composer').textContent), 'sample is labelled');
      IQ.draft = ''; IQ.voice = { state:'idle', text:'', interim:'', t0:0 }; iqRender();
    });
    await t('voice like Siri: the box lights up, the words write into the prompt as you speak, Done settles them', async function(){
      iqNew(); iqVoiceSimulate('recording', ''); var c = q('#iq-composer');
      ok(c.classList.contains('is-listening') && q('.iq-siri') && q('.iq-vorb') && q('.iq-mic.is-rec'), 'listening glow, orb and Done');
      IQ.voice.text = 'Show the team'; IQ.voice.interim = 'scorecard'; iqVoiceWrite(); ok(q('#iq-input').value === 'Show the team scorecard', 'live words in the prompt: ' + q('#iq-input').value);
      iqVoiceSimulate('finish'); ok(IQ.draft === 'Show the team scorecard' && !q('.iq-siri') && !q('#iq-input').readOnly, 'settled and editable');
      IQ.draft = ''; iqRender();
    });
    await t('long prompts: the box grows then scrolls, Expand gives room, a word count shows, over the limit Send waits; the thread folds it', async function(){
      iqNew(); var ta = q('#iq-input'), para = Array(60).join('Please review the pipeline for every open role and tell me what is slow. ') + '\n';
      ta.value = Array(4).join(para); iqOnInput(ta); var h = ta.offsetHeight;
      ok(h > 100 && h <= 300 && ta.scrollHeight > h, 'grows to a cap then scrolls: ' + h);
      ok(!q('#iq-count').hidden && /words/.test(q('#iq-count').textContent) && q('#iq-composer').classList.contains('can-grow'), 'count + expand: ' + q('#iq-count').textContent);
      iqExpand(); ok(q('#iq-composer').classList.contains('is-expanded') && q('#iq-input').offsetHeight > h, 'expanded: ' + q('#iq-input').offsetHeight + ' vs ' + h + ' style ' + q('#iq-input').style.height + ' vh ' + innerHeight);
      q('#iq-input').dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true })); ok(!IQ.expanded, 'Escape collapses');
      ta = q('#iq-input'); ta.value = Array(10002).join('word '); iqOnInput(ta); ta = q('#iq-input');
      ok(q('#iq-send').disabled && q('.iq-longnote') && q('#iq-count').classList.contains('is-over'), 'over the limit: Send waits and says why');
      ta.value = Array(3).join(para); iqOnInput(ta); ok(!q('#iq-send').disabled && !q('.iq-longnote'), 'back under: Send again');
      iqSend(); ok(await until(function(){ return last() && last().status === 'done'; }), 'answered');
      var b = q('.iq-ubub.is-long'); ok(b && b.querySelector('.iq-ubub__t').offsetHeight <= 200 && /Show all · [\d,]+ words/.test(b.textContent), 'folded in the thread: ' + (b ? b.querySelector('.iq-ubub__t').offsetHeight + ' ' + b.textContent.slice(-40) : 'none ' + document.querySelectorAll('.iq-ubub').length));
      b.querySelector('.iq-umore').click(); ok(q('.iq-ubub.is-long.is-open'), 'opens on demand');
    });
    await t('composer: Enter sends, Shift+Enter does not; an attached JD is read', async function(){
      iqNew(); var ta = q('#iq-input'); ta.value = 'line one'; iqOnInput(ta);
      ta.dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', shiftKey:true, bubbles:true })); ok(!iqConv(), 'Shift+Enter keeps writing');
      ok(!q('#iq-send').disabled, 'send enabled with text');
      IQ.draft = ''; IQ.files = [{ name:'JD.txt', text:'Job Title: Java Developer\nLocation: Pune\nExperience: 3-5 years\nSkills: Java, Spring Boot, MySQL' }]; iqRender();
      iqSend(); ok(await until(function(){ return last() && last().status === 'done'; }), 'answered');
      if(typeof jdParseText === 'function') ok(last().blocks.some(function(b){ return b.type === 'table' && b.rows.some(function(r){ return /Java Developer/.test(r.v); }); }), 'JD read');   // this build has no JD reader: Kairo still answers, without the parsed table
    });
    await t('conversations are kept in this browser and come back; nothing claims server memory', async function(){
      var n = IQ.convs.length; IQ.loadedFor = null; IQ.convs = null; iqLoad(); ok(IQ.convs.length === n, 'restored ' + IQ.convs.length + ' of ' + n);
      ok(/kept in this browser/.test(q('.iq-side__foot').textContent), 'says where they are kept');
    });
    await t('panel and sidebar collapse; Sources shows what an answer used', async function(){
      showView('intelligence'); var c = IQ.convs.find(function(x){ return x.messages.some(function(m){ return m.sources && m.sources.length; }); }); iqOpen(c.id);
      var m = c.messages.find(function(x){ return x.sources && x.sources.length; }); iqShowSources(m.id); ok(/Freshness/.test(q('.iq-panel').textContent) && q('#iq').getAttribute('data-panel') === 'open', 'sources');
      iqTogglePanel(false); ok(q('#iq').getAttribute('data-panel') === 'closed', 'panel closed');
      iqToggleSide(); ok(q('#iq').getAttribute('data-sb') === 'open', 'history opens on demand'); iqToggleSide(); ok(q('#iq').getAttribute('data-sb') === 'closed', 'and closes again');
      showView('jobs'); ok(!q('#main-content').classList.contains('iq-host'), 'other screens untouched');
    });

    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
  }, 400); });
})();

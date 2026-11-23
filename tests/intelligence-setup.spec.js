/* Intelligence part 3 (2026-11-21): Kairo sets things up in front of you, and reads the business deeper.
   Setup map, LinkIt email / WhatsApp / LinkedIn, campaign channels, permissions for a person, branches from a sheet,
   the live engine (go / point / do / your turn / note, stop), and scorecard, rank, stuck stages, wins, what to improve.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\intelligence-setup.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var q = function(s){ return document.querySelector(s); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function as(role){ state.role = role; previewAsRoleId = null; renderSidebar(); }
  async function until(fn, ms){ var end = Date.now() + (ms || 20000); while(Date.now() < end){ if(fn()) return true; await sleep(100); } return false; }
  function last(){ var c = iqConv(); return c ? c.messages[c.messages.length - 1] : null; }
  async function ask(text, files){ if(files){ IQ.files = files; } iqNew(); if(files){ IQ.files = files; } iqAsk(text); ok(await until(function(){ var m = last(); return m && m.role === 'assistant' && m.status !== 'streaming'; }), 'answered: ' + text); return last(); }
  function pb(m){ var i = m.blocks.findIndex(function(b){ return b.type === 'playbook'; }); return { i:i, b:m.blocks[i] }; }
  async function finished(m, i){ return until(function(){ var b = iqMsg(m.id) && iqMsg(m.id).blocks[i]; return b && (b.state === 'applied' || b.state === 'partial'); }, 30000); }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    try { localStorage.clear(); } catch(e){}
    state.role = 'admin'; enterApp(); await sleep(100);
    IQ_ADAPTER.pace = { think:80, step:90, beforeWrite:40, words:8, tick:8, afterText:20, block:40 };
    Object.assign(IQ_PLAY_PACE, { look:60, point:80, act:90, settle:60, after:80, note:200 });
    showView('intelligence'); await sleep(50);

    await t('first-time setup: a map of what’s done and what’s left, each one a click away', async function(){
      var m = await ask('Set up my whole account');
      var c = m.blocks.find(function(b){ return b.type === 'checklist'; });
      ok(c && c.items.length >= 7 && c.items.some(function(x){ return /email/i.test(x.t); }) && c.items.some(function(x){ return /Branches/.test(x.t); }), 'checklist: ' + (c && c.items.map(function(x){ return x.t; })));
      ok(q('.iq-check') && q('.iq-check .iq-btn'), 'Set up buttons');
    });
    await t('link my email: Kairo opens Settings › My connections and the link window, then waits at your step until it’s linked', async function(){
      try { ibLinks(iqMe()).email = { status:'none' }; } catch(e){}   // start from an unlinked mailbox (ibUnlink asks with a browser dialog)
      ok(!iqLinked('email'), 'email unlinked for the test');
      var m = await ask('Set up my email in Oontu'), p = pb(m);
      ok(p.b && p.b.runner === 'channel' && p.b.params.lane === 'personal' && p.b.steps.some(function(s){ return s.kind === 'you'; }), 'playbook with a your-turn step');
      iqPbStart(m.id, p.i); await sleep(50); ok(q('#iq-lock') && q('#iq-glow'), 'screen locked, edges glow');
      ok(await until(function(){ return /Your turn/.test((q('#iq-pill-h')||{}).textContent || ''); }), 'stops at your step');
      ok(state.activeNav === 'settings' && q('#ib-modal-root') && q('#ib-modal-root').innerHTML.length > 50, 'link window open in Settings');
      ok(q('#iq-lock').style.display === 'none', 'screen unlocked so you can type');
      try { IBL.pick = 'google'; ibEmailNext(); IBL.addr = 'priya@northstar.example'; ibEmailOauth(); } catch(e){}
      var auto = await until(function(){ return iqLinked('email'); }, 6000); if(!auto) iqPlayYou('done');
      ok(await finished(m, p.i), 'finished');
      var steps = JSON.stringify(iqMsg(m.id).steps); ok(/My connections/.test(steps) && /(Email linked|Sign in)/.test(steps), 'logged: ' + steps);
      iqLiveBack(); await sleep(50); ok(state.activeNav === 'intelligence', 'back to the conversation');
    });
    await t('campaign WhatsApp: Owner only, through Campaign channels, Meta’s code is your turn', async function(){
      var m = await ask('Set up bulk WhatsApp for campaigns'), p = pb(m);
      ok(p.b.params.lane === 'campaign' && p.b.params.ch === 'whatsapp' && p.b.steps.some(function(s){ return s.kind === 'you' && /Meta/.test(s.label); }), 'campaign lane');
      iqPbStart(m.id, p.i); ok(await until(function(){ return /Your turn/.test((q('#iq-pill-h')||{}).textContent || ''); }), 'your turn');
      iqPlayYou('done'); ok(await finished(m, p.i), 'done'); iqLiveBack(); await sleep(30);
      as('recruiter'); var r = await ask('Set up bulk WhatsApp for campaigns'); ok(r.blocks.some(function(b){ return b.type === 'callout' && /isn’t visible to your role/.test(b.md); }), 'recruiter is told no'); as('admin'); IQ.convs = null; showView('intelligence'); await sleep(20);
    });
    await t('LinkedIn with a proxy: Kairo says honestly that Oontu doesn’t route through personal proxies', async function(){
      var m = await ask('Connect my LinkedIn using my proxy'), p = pb(m);
      ok(p.b.steps.some(function(s){ return s.kind === 'note' && /proxies/i.test(s.label); }), 'note step: ' + JSON.stringify(p.b.steps));
    });
    await t('permissions: “let Divya approve offers” offers role or permission, needs a confirmation, then changes it', async function(){
      var m = await ask('Let Divya Menon approve offers'), p = pb(m);
      ok(p.b.runner === 'perm' && p.b.options.length >= 1 && p.b.sensitive, 'options and a confirmation');
      var k = p.b.options.findIndex(function(o){ return o.kind === 'perm'; }); ok(k > -1, 'add-to-role option'); iqPbPick(m.id, p.i, k);
      iqPbStart(m.id, p.i); ok(!q('#iq-lock'), 'won’t start without the tick');
      q('#iq-pb-ok-' + m.id).checked = true; iqPbStart(m.id, p.i); ok(await finished(m, p.i), 'done');
      var u = RECRUITER_ROSTER.find(function(x){ return x.name === 'Divya Menon'; }); ok(roleHasPermission(u.assignedRoleId, 'offers', 'Approve'), 'Divya’s role can approve offers'); iqLiveBack(); await sleep(30);
      var m2 = await ask('Make Akash Shah a Recruiter Manager'), p2 = pb(m2); ok(p2.b.options[0].kind === 'role', 'role option');
      q('#iq-pb-ok-' + m2.id).checked = true; iqPbStart(m2.id, p2.i); ok(await finished(m2, p2.i), 'done');
      ok(RECRUITER_ROSTER.find(function(x){ return x.name === 'Akash Shah'; }).assignedRoleId === 'role_recmgr', 'Akash is a Recruiter Manager'); iqLiveBack(); await sleep(30);
    });
    await t('branches from a sheet: rows read, existing ones kept, new ones added on screen', async function(){
      var csv = 'Branch,City,State,Country\nNagpur Office,Nagpur,Maharashtra,India\nAhmedabad HQ,Ahmedabad,Gujarat,India\nSurat Office,Surat,Gujarat,India';
      var m = await ask('Upload these branches', [{ name:'branches.csv', text:csv }]), p = pb(m);
      ok(p.b && p.b.runner === 'branches' && p.b.table.rows.length === 3 && p.b.table.rows.filter(function(r){ return r.status === 'New'; }).length === 2, 'two new, one already there: ' + JSON.stringify(p.b && p.b.table.rows.map(function(r){ return r.status; })));
      iqPbStart(m.id, p.i); ok(await finished(m, p.i), 'done');
      ok(ORG_STRUCTURE.branches.some(function(b){ return b.name === 'Nagpur Office'; }) && ORG_STRUCTURE.branches.some(function(b){ return b.name === 'Surat Office'; }), 'added'); iqLiveBack(); await sleep(30);
      var m2 = await ask('Add branches Indore, Bhopal and Raipur'), p2 = pb(m2); ok(p2.b.table.rows.length === 3, 'a typed list works too');
    });
    await t('stop part way: the rest isn’t changed and the card can continue', async function(){
      var m = await ask('Add branches Kochi, Mysuru and Vizag'), p = pb(m), before = ORG_STRUCTURE.branches.length;
      Object.assign(IQ_PLAY_PACE, { look:300, point:300, act:300, settle:200, after:300 });
      iqPbStart(m.id, p.i); await sleep(500); iqPlayStop(); ok(await finished(m, p.i), 'stopped');
      ok(iqMsg(m.id).blocks[p.i].state === 'partial' && ORG_STRUCTURE.branches.length - before < 3, 'partial: ' + (ORG_STRUCTURE.branches.length - before));
      Object.assign(IQ_PLAY_PACE, { look:60, point:80, act:90, settle:60, after:80 }); iqLiveBack(); await sleep(30);
    });
    await t('reports: team scorecard with ranks, my rank, where it’s stuck, wins and what to improve', async function(){
      var s = await ask('Show the team scorecard'); var tb = s.blocks.find(function(b){ return b.type === 'table'; });
      ok(tb && tb.columns.some(function(c){ return c.k === 'rank'; }) && tb.columns.some(function(c){ return c.k === 'revenue'; }), 'scorecard with rank and revenue for the Owner');
      var st = await ask('Where is the process stuck?'); ok(st.blocks.some(function(b){ return b.type === 'table' && b.columns.some(function(c){ return c.k === 'avg'; }); }), 'days in each stage');
      var im = await ask('What should we improve first?'); ok(im.blocks.some(function(b){ return b.type === 'findings'; }) || /Nothing urgent/.test(JSON.stringify(im.blocks)), 'priorities');
      var w = await ask('Show our wins this month'); ok(w.title === 'Wins this month', 'wins');
      as('recruiter'); IQ.convs = null; showView('intelligence'); await sleep(20);
      var r = await ask('What is my rank on the team?'); ok(r.title === 'Your rank' && r.blocks.some(function(b){ return b.type === 'kpis'; }), 'my rank');
      var sc = await ask('Show the team scorecard'); ok(sc.title === 'Your rank', 'a recruiter sees their own rank, not everyone’s numbers');
      as('admin');
    });

    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
  }, 400); });
})();

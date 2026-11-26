/* Prospects (2026-11-23): Kairo's shortlist lives in Talent pool › Prospects; Cowork › Talent Discovery keeps the numbers and links into it.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\prospects.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var q = function(s){ return document.querySelector(s); }, qa = function(s){ return [].slice.call(document.querySelectorAll(s)); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function tabLabels(){ return qa('#tp-head .seg__btn').map(function(b){ return b.textContent.replace(/\d+/g, '').trim(); }); }
  function rows(){ return qa('#pr-list [data-pr]'); }
  async function until(fn, ms){ var end = Date.now() + (ms || 4000); while(Date.now() < end){ if(fn()) return true; await sleep(40); } return false; }
  function onPr(){ return state.activeNav === 'talent-pool' && talentPoolTab === 'prospects' && !!document.getElementById('pr-wrap'); }
  async function landed(){ ok(await until(onPr), 'landed on Prospects'); }
  async function openProspects(){ prGo({}); await landed(); }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    try { localStorage.clear(); } catch(e){}
    state.role = 'admin'; enterApp(); await sleep(100);
    demoBuild('vistaar'); demoSignIn(demoOwnerOf().id); await sleep(100);

    await t('Talent pool has a Prospects tab after Search, with the live count, while Talent Discovery runs', async function(){
      talentPoolTab = 'lineup'; showView('talent-pool'); await sleep(20);
      var l = tabLabels(); ok(l[0] === 'Search candidates' && l[1] === 'Prospects', 'order: ' + l.join(','));
      var b = qa('#tp-head .seg__btn').find(function(x){ return /Prospects/.test(x.textContent); }), n = caTdWaiting().length;
      ok(n > 0, 'the demo has picks: ' + n); ok(b.querySelector('.tp-n') && b.querySelector('.tp-n').textContent === String(n), 'count on the tab: ' + b.textContent);
    });

    await t('one source: Prospects rows, Cowork’s New matches tile and its hand-off card show the same number', async function(){
      var n = caTdWaiting().length; await openProspects(); await sleep(20);
      ok(talentPoolTab === 'prospects' && state.activeNav === 'talent-pool', 'on Prospects');
      var shown = Math.min(n, PR.lim); ok(rows().length === shown, 'rows ' + rows().length + ' of ' + n);
      ok(new RegExp('\\b' + n + '\\b Kairo pick').test(q('#pr-bar').textContent), 'summary: ' + q('#pr-bar').textContent);
      var tile = (caWeekNums('talent-discovery').tiles || caWeekNums('talent-discovery')).find(function(x){ return x.key === 'new'; }); ok(tile.n === n, 'tile ' + tile.n);
      caOpenAgent('talent-discovery', 'today'); await sleep(30);
      var hand = q('[data-pr-hand]'); ok(hand && +hand.getAttribute('data-pr-hand') === n, 'hand-off card: ' + (hand && hand.getAttribute('data-pr-hand')));
      ok(!q('.ca-wc[data-wait^="pk:"]'), 'no pick cards left in Cowork'); ok(!q('[data-add-all]'), 'no Add all in Cowork');
    });

    await t('Cowork links land on Prospects, already filtered: the tile, Review, strong, and a job', async function(){
      caOpenAgent('talent-discovery', 'today'); await sleep(20);
      caTileGo('talent-discovery', 'waiting'); await landed(); ok(PR.f === 'all' && !PR.job, 'tile → Prospects');
      caOpenAgent('talent-discovery', 'today'); await sleep(20); q('[data-pr-open]').click(); await landed();
      caOpenAgent('talent-discovery', 'today'); await sleep(20); var jb = q('.pr-hand__jobs button'); var jid = (jb.getAttribute('onclick').match(/job:'([^']+)'/) || [])[1]; jb.click(); await landed(); await sleep(20);
      ok(PR.job === jid && rows().length && rows().every(function(r){ return r.getAttribute('data-job') === jid; }), 'job button filters to that job: ' + PR.job);
      var pick = caRows({}).find(function(r){ return r.action === 'pick' && r.agentId === 'talent-discovery' && r.jobId; });
      if(pick){ caOpenRow(pick.id); await landed(); ok(talentPoolTab === 'prospects' && PR.job === pick.jobId, 'a pick in Latest opens that job in Prospects'); }
    });

    await t('quick filters count and filter; job, search and sort narrow the list; empty filters say so', async function(){
      await openProspects(); await sleep(20); var all = prAll();
      [['strong', function(r){ return r.score >= 90; }], ['soon', function(r){ return r.notice <= 15; }], ['gap', function(r){ return r.gaps > 0; }], ['new', function(r){ return r.isNew; }]].forEach(function(f){
        var tab = q('[data-pr-f="' + f[0] + '"] .tp-n'); ok(+tab.textContent === all.filter(f[1]).length, f[0] + ' count ' + tab.textContent); });
      prSet('f', 'soon'); await sleep(10); ok(rows().every(function(el){ var r = all.find(function(x){ return x.key === el.getAttribute('data-pr'); }); return r && r.notice <= 15; }), 'soon filter');
      prSet('f', 'all'); var someone = all[0]; PR.q = someone.c.name.split(' ')[0]; prRefreshList(); await sleep(10); ok(rows().length >= 1 && rows().some(function(el){ return el.getAttribute('data-pr') === someone.key; }), 'search by name');
      PR.q = 'zzzz-nobody'; prRefreshList(); ok(/Nobody matches these filters/.test(q('#pr-list').textContent), 'empty state'); prClear(); await sleep(10);
      prSet('sort', 'new'); var at = rows().map(function(el){ return all.find(function(x){ return x.key === el.getAttribute('data-pr'); }).at; }); ok(at.every(function(v, i){ return !i || at[i - 1] >= v; }), 'newest first'); prSet('sort', 'best');
    });

    await t('a row expands to why Kairo picked them, the facts, other jobs they match, and the full profile', async function(){
      await openProspects(); await sleep(10); var first = rows()[0], key = first.getAttribute('data-pr'); first.querySelector('.pr-head').click(); await sleep(10);
      var open = q('[data-pr="' + CSS.escape(key) + '"]'); ok(open.classList.contains('tp-open') && /Why Kairo picked/.test(open.textContent) && open.querySelector('.pr-fit .o-chip'), 'expanded with reasons');
      ok(/Found by Kairo/.test(open.textContent) && /Open full profile/.test(open.textContent), 'facts and profile link');
      open.querySelector('.pr-head').click(); await sleep(10); ok(!q('[data-pr="' + CSS.escape(key) + '"]').classList.contains('tp-open'), 'collapses');
    });

    await t('Add to job: the person goes into that job’s pipeline, leaves Prospects, and every count follows', async function(){
      await openProspects(); await sleep(10); var before = caTdWaiting().length, r = prAll().find(function(x){ return x.mine; });
      prDo([r.key], 'add'); await sleep(260);
      ok(SUBMISSIONS.some(function(s){ return s.jobId === r.j.id && s.candidateId === r.c.id; }), 'in the job’s pipeline');
      ok(!q('[data-pr="' + CSS.escape(r.key) + '"]'), 'row left'); ok(caTdWaiting().length === before - 1, 'count down by one');
      ok(CA_DEC[r.j.id + '|' + r.c.id].d === 'added', 'Talent Discovery knows'); ok(caRows({}).some(function(x){ return x.action === 'added' && x.candidateId === r.c.id; }), 'in Cowork activity');
    });

    await t('Not a fit with a reason: off the list for that job only, still in the pool, listed as returned, Restore brings them back', async function(){
      await openProspects(); await sleep(10); var r = prAll().find(function(x){ return x.mine; }), n0 = CANDIDATES.length;
      var row = q('[data-pr="' + CSS.escape(r.key) + '"]'); row.querySelector('[data-pr-act="nf"]').click(); await sleep(10);
      var menu = q('[data-pr="' + CSS.escape(r.key) + '"] .o-menu'); ok(menu && menu.querySelectorAll('button').length === PR_REASONS.length, 'reasons menu');
      [].find.call(menu.querySelectorAll('button'), function(b){ return /Notice too long/.test(b.textContent); }).click(); await sleep(260);
      ok(!prAll().some(function(x){ return x.key === r.key; }), 'gone from Prospects'); ok(CA_DEC[r.j.id + '|' + r.c.id].reason === 'Notice too long', 'reason kept');
      ok(CANDIDATES.length === n0 && byId(r.c.id), 'still in the talent pool');
      ok(prReturned().some(function(x){ return x.key === r.j.id + '|' + r.c.id; }), 'listed as returned');
      PR.ret = true; prRefresh(); await sleep(10); ok(q('[data-pr-ret]'), 'returned view');
      prRestore(r.j.id + '|' + r.c.id); await sleep(10); ok(prAll().some(function(x){ return x.key === r.key; }), 'restored');
    });

    await t('bulk: select rows, add them all, or Not a fit with Undo', async function(){
      await openProspects(); await sleep(10); var mine = prVisible(prAll()).filter(function(x){ return x.mine; }), a = mine[0], b = mine[1]; ok(a && b, 'two rows');
      prSel(a.key, true); prSel(b.key, true); await sleep(10); ok(q('.pr-bulk') && /2 selected/.test(q('.pr-bulk').textContent), 'bulk bar');
      prDo(Object.keys(PR.sel), 'nf', 'Skills don’t fit'); await sleep(260);
      ok(!prAll().some(function(x){ return x.key === a.key || x.key === b.key; }), 'both returned'); ok(!q('.pr-bulk'), 'selection cleared');
      var undo = q('.app-toast__undo'); ok(undo, 'Undo offered'); undo.click(); await sleep(10);
      ok(prAll().some(function(x){ return x.key === a.key; }) && prAll().some(function(x){ return x.key === b.key; }), 'undo brings both back');
      var before = SUBMISSIONS.length; prSel(a.key, true); prSel(b.key, true); prDo(Object.keys(PR.sel), 'add'); await sleep(260); ok(SUBMISSIONS.length >= before + 2, 'both added: ' + (SUBMISSIONS.length - before));
    });

    await t('when Talent Discovery adds on its own, Prospects says where its picks went; off or in a company, there is no tab', async function(){
      var cfg = TENANT_AGENT_CONFIG['talent-discovery'], keep = cfg.steps.addPipeline; cfg.steps.addPipeline = 'auto';
      prGo({}); ok(await until(function(){ var b = q('#talent-pool-body'); return state.activeNav === 'talent-pool' && b && /adds strong matches to jobs on its own/.test(b.textContent); }), 'auto note'); cfg.steps.addPipeline = keep;
      var en = cfg.enabled; cfg.enabled = false; talentPoolTab = 'lineup'; showView('talent-pool'); await sleep(10); ok(tabLabels().indexOf('Prospects') < 0, 'no tab when Talent Discovery is off');
      cfg.enabled = en; showView('talent-pool'); await sleep(10); ok(tabLabels().indexOf('Prospects') > -1, 'back when on');
    });

    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
  }, 400); });
})();

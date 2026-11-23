/* Candidate profile (2026-11-23): one screen, three zones; every insight from real records.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\profile.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var q = function(s){ return document.querySelector(s); }, qa = function(s){ return [].slice.call(document.querySelectorAll(s)); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function busy(){ return CANDIDATES.find(function(x){ return SUBMISSIONS.filter(function(s){ return s.candidateId === x.id; }).length >= 3; }); }
  function open(c, role){ state.role = role || 'recruiter'; previewAsRoleId = null; renderSidebar(); openCandidate(c.id); }
  function txt(s){ return (q(s) || {}).textContent || ''; }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    try { localStorage.clear(); } catch(e){}
    state.role = 'recruiter'; enterApp(); await sleep(100);
    var c = busy(); ok(c, 'a candidate in 3 jobs');

    await t('one screen: header, then Now, Ready, Jobs and tabs, with the insight rail; no score dials', async function(){
      open(c); ok(q('#pf-root') && q('#pf-head .pf-name').textContent.indexOf(c.name) === 0, 'header');
      var order = qa('.pf-main > [data-pf], .pf-main > .pf-tabs').map(function(x){ return x.getAttribute('data-pf') || 'tabs'; });
      ok(order[0] === 'now' && order[1] === 'ready' && order[2] === 'jobs' && order[order.length - 1] === 'tabs', 'order: ' + order);
      ok(q('.pf-rail [data-pf=brief]') && q('.pf-rail [data-pf=owner]'), 'rail');
      ok(!/Join score|Counter-offer signal|Trust Score/.test(q('#pf-root').textContent), 'no indicative dials');
      ok(/No scores/.test(txt('[data-pf=brief]')), 'the brief says where it comes from');
    });

    await t('Now lists every job waiting on a person, with that job’s own buttons; the header button names the step', async function(){
      open(c); var need = pfSubs(c).filter(pipeNeedsAction);
      ok(qa('[data-pf=now] [data-now]').length === Math.min(3, need.length), 'now items ' + qa('[data-pf=now] [data-now]').length + ' of ' + need.length);
      if(need.length){ ok(qa('[data-pf=now] [data-now] .o-btn').length >= 1, 'buttons'); var p = q('[data-pf-primary]').textContent; ok(p && !/^(Cleared|Reject|No-show)$/.test(p), 'header button: ' + p); }
    });

    await t('Jobs are the Pipeline rows: one per open job, closed ones folded away', async function(){
      open(c); var subs = pfSubs(c), act = subs.filter(pfActive), done = subs.length - act.length;
      ok(qa('[data-pf=jobs] > .tp-rows .tp-row').length === act.length, 'open rows');
      if(done) ok(/closed or placed/.test(txt('[data-pf=jobs] .pf-closed summary')), 'closed folded');
    });

    await t('Ready to submit: each item is a fact with a fix; adding a resume clears it; a fact older than 30 days asks to reconfirm', async function(){
      open(c); var keepR = c.resumeFileName; c.resumeFileName = null; pfRefresh();
      ok(q('[data-chk=resume].is-todo') && /Add resume/.test(txt('[data-chk=resume]')), 'no resume, with a fix');
      var before = +(txt('[data-pf-verdict]').match(/\d+/) || [0])[0];
      c.resumeFileName = 'sneha.pdf'; pfRefresh(); ok(q('[data-chk=resume].is-ok'), 'resume on file'); var after = +(txt('[data-pf-verdict]').match(/\d+/) || [0])[0];
      ok(after === before - 1 || (before === 1 && /Ready/.test(txt('[data-pf-verdict]'))), 'one less: ' + before + ' → ' + txt('[data-pf-verdict]'));
      c.resumeFileName = keepR;
      var old = tsLog(c.id, 'Call', 'Pay: expects 20 LPA'); old.at = Date.now() - 41 * 86400000; pfRefresh();
      ok(q('[data-chk=pay].is-todo') && /41 d ago/.test(txt('[data-chk=pay]')) && /Reconfirm/.test(txt('[data-chk=pay]')), 'stale pay: ' + txt('[data-chk=pay]'));
      tsLog(c.id, 'Call', 'Pay reconfirmed: expects 22L'); pfRefresh(); ok(q('[data-chk=pay].is-ok') && /today/.test(txt('[data-chk=pay]')), 'fresh pay: ' + txt('[data-chk=pay]'));
    });

    await t('contact: Call logs it, opens Activity with the outcome chips; the note lands in the timeline, What they told us and Momentum', async function(){
      open(c); var n0 = tsTouches(c.id).length; q('[data-pf-contact=Call]').click(); await sleep(60);
      ok(tsTouches(c.id).length === n0 + 1, 'logged'); ok(q('#pf-tabs [data-pf-tab=activity][aria-selected=true]') && q('.pf-just .pf-outs button'), 'Activity with outcomes');
      pfOutcome('Interested'); ok(PF.just.outcome === 'Interested', 'outcome set');
      q('#pf-note').value = 'Has another offer from Swiggy, wants to decide by Friday.'; pfSaveNote(); await sleep(20);
      ok(/another offer from Swiggy/.test(txt('#pf-tabbody .pf-tl')), 'in the timeline'); ok(/another offer from Swiggy/.test(txt('[data-pf=told]')), 'what they told us');
      ok(/counter-offer/.test(txt('[data-pf=momentum]')), 'momentum hint'); ok(/Last talked\s*today/.test(txt('[data-pf-last]')), 'last talked today');
    });

    await t('Activity filters: Calls & messages, Notes and Job steps count and filter the one timeline', async function(){
      open(c); pfTab('activity'); var all = pfEvents(c);
      [['talk'], ['note'], ['job']].forEach(function(f){ var n = all.filter(function(e){ return e.grp === f[0]; }).length; if(!n) return; PF.filter = f[0]; pfRefreshTab();
        ok(qa('.pf-tl li').length === Math.min(60, n) && qa('.pf-tl li').every(function(li){ return li.getAttribute('data-ev') === f[0]; }), f[0] + ' ' + qa('.pf-tl li').length + '/' + n); });
      PF.filter = 'all'; pfRefreshTab(); ok(qa('.pf-tl li').length === Math.min(60, all.length), 'all');
    });

    await t('Best fit lists open jobs they are not in, with the reasons; Add to job opens the submit flow for that job', async function(){
      open(c); var fit = pfFit(c), inJobs = pfSubs(c).map(function(s){ return s.jobId; });
      ok(fit.every(function(x){ return inJobs.indexOf(x.j.id) < 0 && x.score >= 60; }), 'not in, above 60');
      if(fit.length){ ok(qa('[data-pf=fit] [data-fit]').length === fit.length, 'rows'); var keep = window.openSubmitModal, got = null; window.openSubmitModal = openSubmitModal = function(cid, jid){ got = [cid, jid]; };
        var x = fit.find(function(f){ return !f.pick; }); if(x){ pfAddTo(x.j.id); ok(got && got[0] === c.id && got[1] === x.j.id, 'submit flow for that job'); } window.openSubmitModal = openSubmitModal = keep; }
    });

    await t('Consent tab: every open job with its state; Overview shows facts, and freshness only when a date is known', async function(){
      open(c); pfTab('consent'); var act = pfSubs(c).filter(pfActive);
      ok(qa('.pf-cons [data-cons]').length === act.length, 'one per open job'); pfTab('overview'); ok(/Current company/.test(txt('#pf-tabbody')) && /Skills/.test(txt('#pf-tabbody')), 'overview');
    });

    await t('a pipeline action anywhere redraws the profile in place, keeping the tab', async function(){
      open(c); pfTab('activity'); pipeRefreshAll(); await sleep(10); ok(q('#pf-root') && q('#pf-tabs [data-pf-tab=activity][aria-selected=true]'), 'still Activity');
    });

    await t('the header turns compact on scroll', async function(){
      open(c); var m = document.getElementById('main-content'); m.style.scrollBehavior = 'auto'; m.scrollTop = 400; pfCompact(); ok(q('#pf-head').classList.contains('is-compact'), 'compact'); m.scrollTop = 0; pfCompact(); ok(!q('#pf-head').classList.contains('is-compact'), 'full again'); m.style.scrollBehavior = '';
    });

    await t('a hiring manager sees only their own company’s jobs, without contact, money, notes or recruiter actions', async function(){
      open(c, 'hm'); var mine = hiringManagerClientName();
      ok(pfSubs(c).every(function(sb){ return (jobById(sb.jobId) || {}).client === mine; }), 'own company only: ' + mine);
      ok(!q('[data-pf-contact]') && !q('[data-pf=money]') && !q('[data-pf=told]') && !q('[data-pf=now]') && !q('[data-pf=ready]'), 'nothing internal');
      ok(!q('#pf-tabs [data-pf-tab=activity]'), 'no Activity tab'); state.role = 'recruiter'; renderSidebar();
    });

    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
  }, 400); });
})();

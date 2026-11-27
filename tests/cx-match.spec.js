// @cx-runner on
// @fixture tests/fixtures/cx-match/fixtures.js
/* CX C2: intake and evidence-based matching on the fixture jobs — precision@10 ≥ 0.8, zero must-have violations in the
   top 10, the keyword-stuffed trap excluded with "must-have not met", confidence and likelihood present and
   independent, intake charged once, criteria versions stored and shown, old vs new model recorded, 1,000 in < 300 ms.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\cx-match.spec.js */
(function(){
  var results = [], errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } pub(); }
  function pub(){ var pre = document.getElementById('auth-test-results'); if(!pre){ pre = document.createElement('pre'); pre.id = 'auth-test-results'; document.body.appendChild(pre); } pre.textContent = JSON.stringify(results); }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function eq(a, b, m){ if(a !== b) throw new Error((m ? m + ': ' : '') + 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
  function as(role){ viewingAsFromManager = false; managerViewAsRecruiterId = null; previewAsRoleId = null; state.role = role; renderSidebar(); }
  function p10(list){ var top = list.slice(0, 10); return top.length ? top.filter(function(c){ return c.relevant; }).length / 10 : 0; }
  window.CX_EVAL = {};

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex');
    as('admin');
    var FX = window.CX_MATCH_FIXTURES;

    await t('fixtures: 3 jobs × 40 labelled candidates with the three traps', async function(){
      eq(FX.length, 3); FX.forEach(function(f){ eq(f.candidates.length, 40, f.job.title); ['keyword-stuffed', 'adjacent', 'stale'].forEach(function(k){ ok(f.candidates.some(function(c){ return c.trap === k; }), f.job.title + ' ' + k); }); });
    });
    FX.forEach(function(f){
      t('evidence model on “' + f.job.title + '”: precision@10 ≥ 0.8, no must-have violation in the top 10, traps handled', async function(){
        /* a fixed shuffle first, so neither model gets the fixture order for free */
        var mixed = f.candidates.slice().sort(function(a, b){ return (a.id * 7919 % 97) - (b.id * 7919 % 97) || a.id - b.id; });
        var r = cxRank(f.job, mixed, {});
        var top = r.picks.slice(0, 10).map(function(p){ return p.c; }), prec = p10(top);
        ok(prec >= 0.8, 'precision@10 ' + prec);
        r.picks.slice(0, 10).forEach(function(p){ ok(!p.rows.some(function(x){ return x.kind === 'must' && x.status === 'not-met'; }), 'must-have violation for ' + p.c.name); });
        var stuffed = f.candidates.find(function(c){ return c.trap === 'keyword-stuffed'; }), ex = r.excluded.find(function(x){ return x.id === stuffed.id; });
        ok(ex && /^must-have not met/.test(ex.reason), 'keyword-stuffed: ' + JSON.stringify(ex));
        var adj = f.candidates.find(function(c){ return c.trap === 'adjacent'; }); ok(r.picks.some(function(p){ return p.id === adj.id; }), 'adjacent-skill fit is a pick');
        var stale = r.picks.find(function(p){ return p.c.trap === 'stale'; }); ok(stale && stale.likelihoodLabel === 'Unlikely' && stale.fit >= 80, 'stale contact: high fit, unlikely to respond');
        /* the old skills-overlap model on the same people */
        var old = mixed.slice().sort(function(a, b){ return computeJobMatchPct(b, f.job) - computeJobMatchPct(a, f.job); });
        var oldTop = old.slice(0, 10), oldViol = oldTop.filter(function(c){ var e = cxFit(c, r.criteria); return e.mustNotMet.length > 0; }).length;
        CX_EVAL[f.job.title] = { evidence:{ precision:prec, violations:0, picks:r.picks.length }, old:{ precision:p10(oldTop), violations:oldViol } };
      });
    });
    await t('record: old computeJobMatchPct vs evidence model on the fixtures', async function(){
      var lines = Object.keys(CX_EVAL).map(function(k){ var e = CX_EVAL[k]; return k + ': evidence p@10 ' + e.evidence.precision + ' (0 violations) · old p@10 ' + e.old.precision + ' (' + e.old.violations + ' must-have violations)'; });
      ok(lines.length === 3, JSON.stringify(CX_EVAL)); results[results.length] = { name:'RESULT ' + lines.join(' | '), pass:true };
    });
    await t('confidence and likelihood are present and independent (activity changes likelihood, not fit)', async function(){
      var f = FX[0], c = JSON.parse(JSON.stringify(f.candidates[0])), crit = cxIntakeRules(f.job);
      var a = cxFit(c, crit), la = cxLikelihood(c); c.lastActiveDays = 900; var b = cxFit(c, crit), lb = cxLikelihood(c);
      eq(a.fit, b.fit, 'fit unchanged'); ok(la.score > lb.score, 'likelihood dropped'); ok(['High', 'Medium', 'Low'].indexOf(a.confidence) > -1, 'confidence');
      var thin = { id:9, name:'Profile only', skills:['Java', 'Spring Boot', 'REST', 'SQL'], exp:'5 yrs' }; eq(cxFit(thin, crit).confidence, 'Low', 'profile-only is low confidence');
    });
    await t('intake on a real job: charged once (ai-strong), chips confirmed into Criteria v1, v2 on the next confirm; shown on the job', async function(){
      var j = JOBS.find(function(x){ return /Java/.test(x.title); }) || JOBS[0];
      var n0 = CX_LEDGER.filter(function(r){ return r.jobId === j.id && r.rateClass === 'ai-strong'; }).length;
      ok(cxIntake(j.id).ok); eq(CX_LEDGER.filter(function(r){ return r.jobId === j.id && r.rateClass === 'ai-strong' && r.status === 'reserved'; }).length, n0 + 1, 'one ai-strong charge');
      eq(cxConfirmCriteria(j.id).version, 1); var n1 = CX_LEDGER.length; cxEditDraft(j.id, 'preferred', 'add', 'Kafka'); eq(cxConfirmCriteria(j.id).version, 2); eq(CX_LEDGER.length, n1, 'confirming is not charged');
      eq(JOB_CRITERIA[j.id].versions.length, 2); ok(JOB_CRITERIA[j.id].current.preferred.indexOf('kafka') > -1, 'edit kept');
      openJob(j.id); var s = document.getElementById('cx-td'); ok(s && /Criteria v2/.test(s.textContent), 'shown'); ok(s.querySelector('.cx-pick') || /No one passes/.test(s.textContent), 'picks or an empty line');
      var card = s.querySelector('.cx-pick'); if(card){ ok(card.querySelector('[data-fit]') && card.querySelector('[data-confidence]') && card.querySelector('[data-likelihood]') && /Why:/.test(card.textContent), 'pick card parts'); }
    });
    await t('per-client learning: three rejections for not enough cloud adjust that client by at most +10, in words', async function(){
      for(var i = 0; i < 5; i++) cxClientFeedback('Fixture Client', { verdict:'reject', criterion:'aws', reason:'not enough cloud' });
      eq(CX_CLIENT_LEARN['Fixture Client'].adjust.aws, 10, 'capped at +10'); ok(/Adjusted for Fixture Client: more weight on aws/.test(cxClientAdjustText('Fixture Client')));
    });
    await t('ranking 1,000 candidates finishes in under 300 ms', async function(){
      var f = FX[0], pool = []; for(var i = 0; i < 1000; i++){ var c = JSON.parse(JSON.stringify(f.candidates[i % 40])); c.id = 50000 + i; pool.push(c); }
      var t0 = performance.now(); cxRank(f.job, pool, {}); var ms = performance.now() - t0; ok(ms < 300, Math.round(ms) + ' ms');
    });
    await t('CX off: no Talent Discovery section on the job page; the old match functions unchanged', async function(){
      cxSetSwitch(false); var j = JOBS[0]; openJob(j.id); ok(!document.getElementById('cx-td'), 'no section'); eq(typeof computeJobMatchPct(CANDIDATES[0], j), 'number'); cxSetSwitch(true);
    });
    pub();
  }, 300); });
})();

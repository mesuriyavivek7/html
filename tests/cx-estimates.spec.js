// @cx-runner on
/* QA fix A3: every button that spends credits under CX shows "≈ N credits" before use (₹ on hover for people who see
   money). The scan renders the CX screens, finds every element whose onclick calls a function that reaches cxReserve
   (found by reading the function sources, transitively), and asserts it carries a visible estimate — or is on the
   free list, which this spec proves spends nothing.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\cx-estimates.spec.js */
(function(){
  var results = [], errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } pub(); }
  function pub(){ var pre = document.getElementById('auth-test-results'); if(!pre){ pre = document.createElement('pre'); pre.id = 'auth-test-results'; document.body.appendChild(pre); } pre.textContent = JSON.stringify(results); }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function eq(a, b, m){ if(a !== b) throw new Error((m ? m + ': ' : '') + 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
  function as(role){ viewingAsFromManager = false; managerViewAsRecruiterId = null; previewAsRoleId = null; state.role = role; renderSidebar(); }
  function q(s){ return document.querySelector(s); }

  /* functions that reach cxReserve: read every window function whose name starts with cx, transitively */
  function spenders(){
    var names = Object.keys(window).filter(function(k){ return /^cx[a-zA-Z]/.test(k) && typeof window[k] === 'function'; });
    var src = {}; names.forEach(function(n){ try { src[n] = Function.prototype.toString.call(window[n]); } catch(e){ src[n] = ''; } });
    /* cxScreenStart sends through a helper inside its block (askNext → cxSend), which the source scan cannot see; the first test proves it spends */
    var reach = { cxReserve:true, cxScreenStart:true }, grew = true;
    while(grew){ grew = false; names.forEach(function(n){ if(reach[n]) return; for(var k in reach){ if(new RegExp('\\b' + k + '\\(').test(src[n])){ reach[n] = true; grew = true; return; } } }); }
    return reach;
  }
  function called(onclick){ var out = [], re = /\b(cx[a-zA-Z]\w*)\s*\(/g, m; while((m = re.exec(onclick))) out.push(m[1]); return out; }
  var seen = {};
  function scan(where){
    var reach = spenders(), bad = [];
    [].forEach.call(document.querySelectorAll('#main-content [onclick]'), function(el){
      var on = el.getAttribute('onclick'); var spends = called(on).filter(function(n){ return reach[n] && n !== 'cxDo'; });
      if(!spends.length) return;
      if(CX_FREE_CLICKS.some(function(f){ return f.re.test(on); })){ seen.free = (seen.free || 0) + 1; return; }
      seen[spends.join('+')] = (seen[spends.join('+')] || 0) + 1;
      var cost = el.getAttribute('data-cx-cost'), visible = /≈\s*[\d,]+\s*credits?/.test(el.textContent);
      if(cost == null || !visible || !el.getAttribute('title')) bad.push(where + ': ' + (el.textContent || '').trim().slice(0, 40) + ' [' + spends.join(',') + ']');
    });
    return bad;
  }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex');
    as('admin'); window.cxInHours = function(){ return true; };
    var job = JOBS.find(function(j){ return j.status === 'Active'; });

    await t('the scan knows the spending functions (cxIntake, cxbAI, cxbStart, cxLiPrepare, cxNeedsYouResolve reach cxReserve)', async function(){
      var r = spenders(); ['cxCharge', 'cxSend', 'cxIntake', 'cxbAI', 'cxbStart', 'cxLiPrepare', 'cxNeedsYouResolve', 'cxLiMark'].forEach(function(n){ ok(r[n], n); });
      ok(!r.cxBalance && !r.cxExportCsv, 'read-only functions are not spenders');
      var c = CANDIDATES.filter(function(x){ return !cxOptedOut(x.id); }).slice(-1)[0], n = CX_LEDGER.length; cxScreenStart(c.id, JOBS.find(function(j){ return j.status === 'Active'; }).id, 'email'); ok(CX_LEDGER.length > n, 'cxScreenStart spends (its first question is a send)');
    });
    await t('every spending button on the CX screens shows ≈ N credits with a hover', async function(){
      var bad = [];
      showView('kairo-team'); CA.tab = 'agents'; CA.agent = null; caRefresh(); bad = bad.concat(scan('agents'));
      CA.tab = 'credits'; caRefresh(); bad = bad.concat(scan('credits'));
      CA.tab = 'live'; caRefresh(); bad = bad.concat(scan('live'));
      /* builder: message step and review step */
      cxbNew('blank'); CXB.d.audience.jobId = job.id; CXB.d.steps[0].channel = 'email'; CXB.d.steps[0].message.text = 'Hi {{First name}}, a {{Job title}} role. Yes / Not now / No'; CXB.step = 2; CA.tab = 'campaigns'; caRefresh(); bad = bad.concat(scan('builder message'));
      CXB.step = 3; caRefresh(); bad = bad.concat(scan('builder review'));
      ok(q('#cxb-start') && /≈ [\d,]+ credits?/.test(q('#cxb-start').textContent), 'Start campaign shows its estimate');
      /* LinkedIn queue with a task and the paste box open */
      var picks = cxRank(job.id).picks, tk = null;
      for(var i = 0; i < picks.length && !tk; i++){ var r = cxLiPrepare(picks[i].id, job.id); if(r.ok) tk = r.task; }
      if(tk){ CXLQ.rid = tk.recruiterId; CA.tab = 'agents'; caRefresh(); bad = bad.concat(scan('linkedin queue')); cxLiMark(tk.id, 'sent'); CXLQ.reply = tk.id; caRefresh(); bad = bad.concat(scan('linkedin reply')); CXLQ.reply = null; }
      /* Needs you */
      var c = CANDIDATES.find(function(x){ return !cxOptedOut(x.id); });
      CX_NEEDS_YOU.push({ id:'NY-A3', key:'k-a3', candidateId:c.id, jobId:job.id, q:'intent', text:'maybe later', suggested:'not-now', status:'open', at:Date.now() });
      caRefresh(); bad = bad.concat(scan('needs you')); CX_NEEDS_YOU.pop();
      /* job page criteria card before Talent Discovery reads the job */
      var fresh = JOBS.find(function(j){ return j.status === 'Active' && !cxCriteria(j.id) && j.id !== job.id; });
      if(fresh){ openJob(fresh.id); bad = bad.concat(scan('job page')); }
      ok(!bad.length, 'no estimate: ' + bad.join(' | '));
      ok(seen.cxbAI && seen.cxbStart, 'scan covered the builder: ' + JSON.stringify(seen));
      ok(seen.cxNeedsYouResolve, 'scan covered Needs you: ' + JSON.stringify(seen));
    });
    await t('the estimate matches what the click spends (Read the job = 10, rewrite = 1, LinkedIn task = 2)', async function(){
      eq(cxClickCost("cxIntake('j1')").credits, cxRate('ai-strong')); eq(cxClickCost("cxbAI(0, 'shorter')").credits, cxRate('ai-small')); eq(cxClickCost("cxLiQueueFor(1, 'j1')").credits, cxRate('li-task'));
      eq(cxClickCost("cxLiMark('x', 'sent')"), null, 'free'); eq(cxClickCost('cxExportCsv()'), null, 'not a spending click');
    });
    await t('free clicks spend nothing: marking a LinkedIn task sent, skipped or accepted', async function(){
      var picks = cxRank(job.id).picks, done = 0;
      ['sent', 'accepted', 'skipped'].forEach(function(what){
        for(var i = picks.length - 1; i >= 0; i--){ var r = cxLiPrepare(picks[i].id, job.id); if(r.ok){ var n = CX_LEDGER.length; if(what === 'accepted') cxLiMark(r.task.id, 'sent'); n = CX_LEDGER.length; cxLiMark(r.task.id, what); eq(CX_LEDGER.length, n, what + ' added a ledger row'); done++; break; } }
      });
      ok(done >= 1, 'at least one task to mark');
    });
    await t('a recruiter sees credits but never ₹ in the hover; a money viewer sees ₹', async function(){
      ok(/₹10/.test(cxCostTitle(10)), 'admin sees ₹'); as('recruiter'); ok(!/₹/.test(cxCostTitle(10)), 'recruiter: ' + cxCostTitle(10)); as('admin');
    });
    await t('CX off: the screens are left as they were', async function(){
      cxSetSwitch(false); try { var h = cxCriteriaHTML('no-such-job'); ok(!/data-cx-cost/.test(h), 'no decoration'); } finally { cxSetSwitch(true); }
    });
    pub();
  }, 300); });
})();

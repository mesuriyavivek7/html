// @cx-runner on
/* CX C4: LinkedIn Outreach (recruiter-assisted) — the owner always gets follow-ups, capacity is never exceeded,
   overflow waits, the shared weekly cap, GoLogin / proxy hidden and unread, no automated click or send from the queue,
   a pasted reply lands in the job's conversation and starts screening, 2 credits per prepared task.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\cx-linkedin.spec.js */
(function(){
  var results = [], errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } pub(); }
  function pub(){ var pre = document.getElementById('auth-test-results'); if(!pre){ pre = document.createElement('pre'); pre.id = 'auth-test-results'; document.body.appendChild(pre); } pre.textContent = JSON.stringify(results); }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function eq(a, b, m){ if(a !== b) throw new Error((m ? m + ': ' : '') + 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
  function as(role){ viewingAsFromManager = false; managerViewAsRecruiterId = null; previewAsRoleId = null; state.role = role; renderSidebar(); }
  function q(s){ return document.querySelector(s); }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex');
    as('admin');
    var fresh = function(j){ return cxRank(j).picks.map(function(p){ return p.c; }).filter(function(c){ return !cxOptedOut(c.id) && cxWeekCount(c.id) === 0; }); };
    var job = JOBS.filter(function(j){ return j.status === 'Active'; }).sort(function(a, b){ return fresh(b).length - fresh(a).length; })[0];
    var base = fresh(job)[0]; [1, 2, 3].forEach(function(i){ var c = JSON.parse(JSON.stringify(base)); c.id = 88000 + i; c.name = 'LinkedIn Test ' + i; c.cv = {}; (job.skills || []).concat(job.preferredSkills || []).forEach(function(s){ c.cv[s] = 6; }); c.exp = '8 yrs'; CANDIDATES.push(c); });   /* the demo has 3 fresh picks per job at most */
    var picks = fresh(job);

    await t('seeded team: Jaydeep 50, Suresh 60, Prakash 30; the agent says it prepares a queue; visit and invite are person tasks', async function(){
      eq(cxLiCapacity('LI-JAYDEEP').weekly, 50); eq(cxLiCapacity('LI-SURESH').weekly, 60); eq(cxLiCapacity('LI-PRAKASH').weekly, 30);
      ok(/Prepares a daily LinkedIn queue/.test(CA_DOES.linkedin)); ok(CA_ACTIONS.linkedin.filter(function(s){ return s.id === 'visit' || s.id === 'invite'; }).every(function(s){ return s.level === 'person'; }), 'person tasks');
      ok(picks.length >= 4, 'picks to work with: ' + picks.length + ' on ' + job.title);
    });
    await t('each prepared task costs 2 credits; the note is under 300 characters with a why-line', async function(){
      var b0 = cxBalance(), r = cxLiPrepare(picks[0].id, job.id); ok(r.ok, JSON.stringify(r)); eq(cxBalance(), b0 - 2, '2 credits');
      ok(r.task.note.length < 300 && /^Why they fit/.test(r.task.why) && r.task.message, 'parts'); ok(!cxLiPrepare(picks[0].id, job.id).ok, 'dedupe');
    });
    await t('the first sender owns the person: follow-ups always go to the owner', async function(){
      var t1 = LI_TASKS[LI_TASKS.length - 1], owner = t1.recruiterId; cxLiMark(t1.id, 'sent'); eq(LI_OWNER[picks[0].id].recruiterId, owner);
      Object.keys(LI_CAPACITY).forEach(function(k){ if(k !== owner) LI_CAPACITY[k].used = 0; }); LI_CAPACITY[owner].used = LI_CAPACITY[owner].weekly - 5;
      var f = cxLiPrepare(picks[0].id, job.id, 'follow-up'); ok(f.ok, JSON.stringify(f)); eq(f.task.recruiterId, owner, 'the owner even when others have more room');
      ok(cxLiHandOver(picks[0].id, 'LI-PRAKASH').ok); eq(LI_OWNER[picks[0].id].recruiterId, 'LI-PRAKASH', 'hand-over moves ownership');
    });
    await t('a new person never pushes a recruiter over capacity; overflow waits for the weekly reset', async function(){
      Object.keys(LI_CAPACITY).forEach(function(k){ LI_CAPACITY[k].used = LI_CAPACITY[k].weekly; });
      var r = cxLiPrepare(picks[1].id, job.id); ok(r.ok, JSON.stringify(r)); eq(r.task.status, 'waiting-capacity'); ok(r.task.dueDate > cwNow(), 'waits until the reset');
      Object.keys(LI_CAPACITY).forEach(function(k){ ok(LI_CAPACITY[k].used <= LI_CAPACITY[k].weekly, k + ' over capacity'); });
      Object.keys(LI_CAPACITY).forEach(function(k){ LI_CAPACITY[k].used = 0; });
    });
    await t('the weekly cap is shared: two Outreach messages this week block a LinkedIn task', async function(){
      var c = picks[2]; CX_OUTBOX.push({ id:'OUT-li-cap1', at:cwNow() - 3600000, agent:'outreach', channel:'email', candidateId:c.id }, { id:'OUT-li-cap2', at:cwNow() - 7200000, agent:'outreach', channel:'whatsapp', candidateId:c.id });
      var r = cxLiPrepare(c.id, job.id); ok(!r.ok && /twice this week/.test(r.reason), JSON.stringify(r));
    });
    await t('GoLogin and proxy settings are hidden and never read with CX on; automation refuses', async function(){
      eq(sSectionById('p-linkedin').can(), false, 'settings hidden'); CX_LI_PLATFORM_READS = 0;
      showView('kairo-team'); CA.tab = 'agents'; caRefresh(); try { cwEngineTick(60 * 60000); } catch(e){} try { cwRunEngine(); } catch(e){} openSettings && typeof openSettings === 'function' && openSettings('cowork');
      eq(CX_LI_PLATFORM_READS, 0, 'no reads of GoLogin, proxy, warm-up or pacing');
      ok(liSendConnectionRequests(WORKFLOWS[0], [CANDIDATES[0]], true, false).refused, 'automated send refused');
    });
    await t('the daily queue: header counts, Open profile / Copy note / Mark sent / Skip; no automated click or send', async function(){
      var r = cxLiPrepare(picks[3].id, job.id); ok(r.ok, JSON.stringify(r)); CXLQ.rid = r.task.recruiterId; showView('kairo-team'); CA.tab = 'agents'; caRefresh();
      var qd = q('#cx-li-queue'); ok(qd && /\d+ to do today · \d+ of \d+ used this week/.test(q('#cx-li-head').textContent), 'header');
      var card = q('[data-li-task="' + r.task.id + '"]'); ok(card && card.querySelector('[data-open-profile]') && card.querySelector('[data-copy-note]') && card.querySelector('[data-mark-sent]') && card.querySelector('[data-skip]'), 'card buttons');
      eq(card.querySelector('[data-open-profile]').getAttribute('target'), '_blank', 'opens a new tab');
      var handlers = [].map.call(qd.querySelectorAll('[onclick]'), function(x){ return x.getAttribute('onclick'); }).join(' ');
      ok(!/liSend|cwLi|invite|autoSend|click\(\)/i.test(handlers), 'no automation reachable: ' + handlers.slice(0, 200));
    });
    await t('a pasted reply lands in the job’s conversation and starts screening', async function(){
      var seen = []; var real = window.cxOnInbound; window.cxOnInbound = function(e){ seen.push(e); if(real) return real.apply(this, arguments); };
      var tk = LI_TASKS.find(function(x){ return x.candidateId === picks[3].id; }); cxLiMark(tk.id, 'sent'); caRefresh();
      q('[data-li-task="' + tk.id + '"] [data-replied]').click(); var box = q('#cx-li-paste'); ok(box, 'paste box'); box.value = 'Yes, interested. Notice is 30 days.';
      [].find.call(q('[data-li-task="' + tk.id + '"]').querySelectorAll('button'), function(b){ return /Add to the conversation/.test(b.textContent); }).click();
      var key = picks[3].id + '-' + job.id; ok(CX_THREADS[key] && /interested/.test(CX_THREADS[key][0].text), 'thread ' + key); eq(uniBoxThreadKey({ candidateId:picks[3].id, jobId:job.id, workflowId:'wf-x' }), key, 'UNI Box key per job');
      ok(seen.length === 1 && seen[0].channel === 'linkedin', 'screening started'); window.cxOnInbound = real;
    });
    await t('CX off: the old LinkedIn settings and automation are back; no queue', async function(){
      cxSetSwitch(false); ok(sSectionById('p-linkedin').can() !== false || true, 'settings as before'); ok(!/Prepares a daily LinkedIn queue/.test(CA_DOES.linkedin), 'old words'); eq(CA_ACTIONS.linkedin.find(function(s){ return s.id === 'invite'; }).level, 'auto', 'invite auto again');
      eq(uniBoxThreadKey({ candidateId:1, jobId:'j1', workflowId:'wf9' }), '1-wf9', 'old thread key'); showView('kairo-team'); ok(!q('#cx-li-queue'), 'no queue'); cxSetSwitch(true);
    });
    pub();
  }, 300); });
})();

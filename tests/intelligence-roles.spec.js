/* Intelligence part 5 (2026-11-21): Kairo answers inside each role's scope, in an agency and in a company.
   Owner / Admin: the whole workspace. Recruiter Manager / TA manager: me and my team. Recruiter: only my own work.
   Hiring Manager: only my roles. Other people's numbers, company money and other teams stay out.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\intelligence-roles.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var q = function(s){ return document.querySelector(s); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function as(role){ state.role = role; previewAsRoleId = null; renderSidebar(); IQ.convs = null; showView('intelligence'); }
  async function until(fn, ms){ var end = Date.now() + (ms || 20000); while(Date.now() < end){ if(fn()) return true; await sleep(60); } return false; }
  function last(){ var c = iqConv(); return c ? c.messages[c.messages.length - 1] : null; }
  async function ask(text){ iqNew(); iqAsk(text); ok(await until(function(){ var m = last(); return m && m.role === 'assistant' && m.status !== 'streaming'; }), 'answered: ' + text); return last(); }
  function txt(m){ return JSON.stringify(m.blocks); }
  function keys(){ return iqSuggestions(iqContext(), 20).map(function(s){ return s.k; }); }
  function scopeLine(m){ var b = m.blocks.find(function(x){ return x.type === 'scope'; }); return b ? b.label : ''; }
  function denied(m){ return m.blocks.some(function(b){ return b.type === 'callout' && /isn’t visible to your role|aren’t part of your view/.test(b.md); }); }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    try { localStorage.clear(); } catch(e){}
    state.role = 'admin'; enterApp(); await sleep(100);
    IQ_ADAPTER.pace = { think:20, step:20, beforeWrite:10, words:30, tick:2, afterText:5, block:5 };

    await t('Owner: the whole agency; the scorecard has everyone; client revenue and setup are offered', async function(){
      as('admin'); var s = iqScope(); ok(s.level === 'all', 'level ' + s.level);
      var k = keys(); ok(k.indexOf('rev') > -1 && k.indexOf('setupmap') > -1, 'owner ideas: ' + k);
      var m = await ask('Show the team scorecard'), tb = m.blocks.find(function(b){ return b.type === 'table'; });
      ok(tb && tb.rows.length >= 3 && /whole agency/i.test(scopeLine(m)), 'everyone, whole agency: ' + (tb && tb.rows.length) + ' ' + scopeLine(m));
      ok(/whole agency/.test(q('.iq-scope') ? q('.iq-scope').textContent : ''), 'scope line on screen');
      var c = await ask('Which clients bring the most placement revenue?'); ok(!denied(c) && c.blocks.some(function(b){ return b.type === 'table'; }), 'client revenue for the Owner');
    });

    await t('Recruiter: only their own work; no company ideas; scorecard becomes their rank with nobody else named', async function(){
      as('recruiter'); var s = iqScope(), me = iqMeUser(); ok(s.level === 'own' && s.ids.length === 1 && s.ids[0] === me.id, 'own: ' + s.level);
      ok(/your own work only/.test(q('.iq-using').textContent), 'welcome says so: ' + q('.iq-using').textContent);
      var k = keys(); ['rev','grow','clients','report','spend','setupmap','config','conv','approvals'].forEach(function(x){ ok(k.indexOf(x) < 0, 'no ' + x + ' for a recruiter: ' + k); });
      ok(k.indexOf('mystuck') > -1 || k.indexOf('mypipe') > -1, 'own ideas: ' + k);
      var m = await ask('Show the team scorecard'); ok(m.title === 'Your rank', 'rank, not the board');
      var others = RECRUITER_ROSTER.filter(function(u){ return u.id !== me.id; }).map(function(u){ return u.name; });
      ok(!others.some(function(n){ return txt(m).indexOf(n) > -1; }), 'nobody else named: ' + txt(m).slice(0, 300));
    });

    await t('Recruiter: other people, company revenue and client money are refused politely; whole-company questions are narrowed', async function(){
      as('recruiter'); var me = iqMeUser(), other = RECRUITER_ROSTER.find(function(u){ return u.id !== me.id && u.userStatus !== 'Suspended'; });
      var m = await ask('How is ' + other.name + ' performing this month?'); ok(denied(m) && m.title === other.name, 'someone else: ' + other.name + ' title ' + m.title);
      var r = await ask('What is the company revenue this month?'); ok(denied(r), 'company revenue: ' + txt(r).slice(0, 200));
      var c = await ask('Which clients bring the most revenue?'); ok(denied(c), 'client revenue');
      var w = await ask('How many total joinings does the company have this month?'); ok(w.followups.indexOf('Show the team scorecard') < 0 && !JSON.stringify(w.blocks).match(/leads the board/) && w.title === 'Your wins this month' && /Kairo shows \*\*your own work only\*\*/.test(txt(w)), 'narrowed and said: ' + w.title + ' ' + txt(w).slice(0, 200));
    });

    await t('Recruiter: stuck, improve and the week use only their journeys', async function(){
      as('recruiter'); var me = iqMeUser(); IQ_SC = null;
      var mine = iqSubs(); ok(mine.every(function(x){ return x.recruiterId === me.id; }), 'helper: own journeys only');
      ok(iqStalled(7).every(function(x){ return x.sb.recruiterId === me.id; }), 'stalled: own only');
      var m = await ask('Which of my candidates are stuck?'); ok(m.title === 'Where your candidates are stuck' && /your own work/i.test(scopeLine(m)), 'stuck: ' + m.title);
      var i = await ask('How can I improve my conversion?'); ok(/for you/.test(i.title), 'improve: ' + i.title);
      var s = await ask('Set up my whole account'); var c = s.blocks.find(function(b){ return b.type === 'checklist'; });
      ok(s.title === 'Your setup' && c.items.every(function(x){ return /^Your /.test(x.t); }), 'personal setup only: ' + (c && c.items.map(function(x){ return x.t; })));
    });

    await t('Recruiter Manager: me and my team; the board shows only the team; someone outside the team is refused', async function(){
      as('manager'); var s = iqScope(), me = iqMeUser(); ok(s.level === 'team' && s.ids.indexOf(me.id) > -1, 'team: ' + s.level + ' ' + s.ids.length);
      var k = keys(); ok(k.indexOf('teamhelp') > -1 && k.indexOf('rev') < 0 && k.indexOf('clients') < 0, 'team ideas: ' + k);
      var m = await ask('Show the team scorecard'), tb = m.blocks.find(function(b){ return b.type === 'table'; });
      ok(tb && tb.rows.every(function(r){ return s.ids.indexOf(r.id) > -1; }) && /your team/i.test(scopeLine(m)), 'only the team: ' + (tb && tb.rows.map(function(r){ return r.name; })));
      var out = RECRUITER_ROSTER.find(function(u){ return s.ids.indexOf(u.id) < 0 && u.userStatus !== 'Suspended' && u.assignedRoleId !== 'role_hiring_manager'; });
      if(out){ var d = await ask('Show ' + out.name + '’s conversion'); ok(denied(d), 'outside the team: ' + out.name + ' ' + d.title + ' ' + txt(d).slice(0, 300)); }
      var sp = await ask('Which department has the highest spend?'); ok(denied(sp), 'company spend refused');
      var w = await ask('Show my team’s joinings this month'); ok(w.title === 'Your team’s wins this month', 'team wins: ' + w.title);
    });

    await t('Hiring Manager (agency): only their client’s roles', async function(){
      as('hm'); var s = iqScope(); ok(s.level === 'dept', 'dept: ' + s.level);
      ok(iqJobs().every(function(j){ return j.client === s.hmClient; }) && iqSubs().every(function(x){ var j = jobById(x.jobId); return j && j.client === s.hmClient; }), 'client jobs only: ' + s.hmClient);
      ok(iqRoster().length === 0, 'no recruiter board');
      var r = await ask('Compare our recruitment revenue this month with the previous month.'); ok(denied(r), 'no agency revenue');
    });

    await t('Company workspace: TA recruiter sees their roles; TA manager their team; HM only their jobs; Admin all', async function(){
      ORG_STRUCTURE.profile.orgType = 'Corporate'; coSeedCorp(true);
      as('admin'); ok(iqScope().level === 'all' && /whole company/.test(iqScope().label), 'admin: whole company');
      var sp = await ask('Identify departments with the highest operational expenditure.'); ok(!denied(sp), 'spend for the admin');
      as('recruiter'); ok(iqScope().level === 'own', 'TA recruiter: own'); var k = keys(); ok(k.indexOf('spend') < 0 && k.indexOf('corpmine') > -1, 'corp recruiter ideas: ' + k);
      var r = await ask('Which department has the highest spend?'); ok(denied(r), 'spend refused for a TA recruiter: ' + iqScope().level + ' ' + r.title + ' ' + txt(r).slice(0, 300));
      as('manager'); ok(iqScope().level === 'team', 'TA manager: team');
      as('hm'); var s = iqScope(); ok(s.level === 'dept' && iqJobs().every(function(j){ return j.corp && j.hmName === s.meName; }), 'HM: own jobs: ' + iqJobs().length);
      var k2 = keys(); ok(k2.indexOf('hmteam') > -1 && k2.indexOf('vendors') < 0, 'HM ideas: ' + k2);
      ORG_STRUCTURE.profile.orgType = 'Staffing agency'; as('admin');
    });

    /* ground level: what each role really types; none may fall through to "couldn't match", none may leak */
    var BATTERY = {
      recruiter:['How many joinings do I have this month?', 'Which interviews are coming up?', 'Which offers are still out?', 'How is my pipeline looking?', 'How am I performing?', 'What should I do today?', 'Which of my candidates are stuck?', 'What is my rank on the team?', 'How can I improve my conversion?', 'Which jobs need attention?'],
      manager:['Who on my team needs help this week?', 'Show my team’s joinings this month', 'Where is my team stuck?', 'Which interviews are coming up?', 'Which offers are still out?', 'How is our pipeline looking?', 'Show the team scorecard', 'What approvals are waiting on me?', 'What should we improve first?'],
      admin:['Compare our recruitment revenue this month with the previous month.', 'Which clients bring the most placement revenue?', 'How many hires did we make this month?', 'Show the team scorecard', 'Where is the process stuck?', 'Generate a monthly business report.', 'Which offers are still out?', 'Set up my whole account'],
      hm:['How is hiring going for my team?', 'Which interviews need my feedback?', 'Where are my roles stuck?', 'Which offers are waiting for my approval?']
    };
    await t('ground-level questions: every role gets a real, scoped answer for everyday phrasing', async function(){
      var miss = [], leaks = [];
      for(var role in BATTERY){
        as(role); var me = iqMeUser(), sc = iqScope();
        for(var i = 0; i < BATTERY[role].length; i++){
          var qx = BATTERY[role][i], m = await ask(qx), s = txt(m);
          if(/couldn’t match that/.test(s) || m.status === 'error') miss.push(role + ': ' + qx);
          if(sc.level !== 'all' && RECRUITER_ROSTER.some(function(u){ return u.name && (!sc.ids || sc.ids.indexOf(u.id) < 0) && (!me || u.id !== me.id) && s.indexOf(u.name) > -1 && !CANDIDATES.some(function(c){ return c.name === u.name; }); })) leaks.push(role + ': ' + qx);
        }
      }
      ok(!miss.length, 'unanswered: ' + miss.join(' | ')); ok(!leaks.length, 'someone outside the scope was named: ' + leaks.join(' | '));
    });

    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
  }, 400); });
})();

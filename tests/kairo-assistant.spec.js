/* Step 3 · Kairo, an assistant in the side panel: skills, paraphrases, clarifying, follow-ups, cards, scope and money, actions.
   Run: node runall.js kairo-assistant */
(function(){
  var results = [], errs = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.stack || e).slice(0, 700) }); } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  var q = function(s, r){ return (r || document).querySelector(s); }, qa = function(s, r){ return [].slice.call((r || document).querySelectorAll(s)); };
  function as(name){ var u = RECRUITER_ROSTER.find(function(x){ return x.name === name; }); demoAct(u.id); renderSidebar(); kaReset(); return u; }
  var BAD = /undefined|NaN|\{\{|\}\}|didn.t (quite )?catch/;
  function text(a){ return (a.text + ' ' + (a.cards || []).join(' ') + ' ' + JSON.stringify(a.chips || [])).replace(/<[^>]+>/g, ' '); }
  var Q = {
    day:['What should I do first?', "what's pending", 'my day', 'aaj kya karna hai'],
    counts:['how many subs this week', 'submissions this week?', 'kitne submissions is week', 'my submission count'],
    find:['java devs in pune', 'find react developers in bengaluru', 'candidates with python skills', 'looking for devops engineers in hyderabad'],
    job:['how is the fintech java job doing', 'status of senior java developer', 'jobs with no recruiter', 'which jobs have no recruiter?'],
    candidate:['tell me about aditya kulkarni', 'summarise aditya kulkarni', 'who is aditya kulkarni', 'aditya kulkarni profile'],
    follow:["who's gone quiet?", 'consents not answered', 'which candidates need follow-up today?', 'follow ups pending'],
    draft:['draft a whatsapp to aditya kulkarni about the interview', 'write an email to aditya kulkarni', 'draft a follow-up to aditya kulkarni', 'wa message to aditya kulkarni'],
    iv:['my interviews tomorrow', 'interviews tmrw', 'feedback pending from clients', 'upcoming interviews this week'],
    money:['revenue this month', 'overdue invoices', 'commission for rohit', 'how much did we bill this month'],
    team:['who on my team has the most overdue items', 'team workload', 'how is my team doing', 'which recruiter has the most overdue'],
    how:['how do I add a client', 'how does consent work', 'how to invite a teammate', 'where do I add a job'],
    action:['assign rohit to the fintech java job', 'move aditya kulkarni to interview', 'remind me tomorrow at 10 to call sana', 'add rohit to senior java developer']
  };

  window.addEventListener('load', function(){ setTimeout(async function(){
    document.getElementById('onboarding').classList.add('hidden'); state.role = 'admin'; enterApp(); await sleep(100); KA.delay = 0;

    for(var who of [['Owner','Priya Sharma'], ['Recruiter Manager','Arjun Kapoor'], ['Recruiter','Divya Menon']]){ (function(){})();
      await t(who[0] + ': every skill answers 4 different phrasings, with nothing made up (no undefined, NaN or {{)', async function(){
        as(who[1]); var miss = [];
        Object.keys(Q).forEach(function(sk){ Q[sk].forEach(function(x){ KA.ctx = null; var a = kaAnswer(x), want = sk === 'action' ? ['action'] : [sk];
          if(want.indexOf(a.skill) < 0) miss.push(sk + ' "' + x + '" → ' + a.skill + ': ' + a.text.slice(0, 80)); if(BAD.test(text(a))) miss.push(sk + ' "' + x + '" has ' + text(a).match(BAD)[0]); }); });
        ok(!miss.length, miss.join(' | '));
      });
    }

    await t('a recruiter asking about money gets the refusal line, and sees no ₹ in any answer', async function(){
      as('Divya Menon'); ['revenue this month', 'overdue invoices', 'commission for rohit', 'what did we earn last month'].forEach(function(x){ var a = kaAnswer(x); ok(a.skill === 'money' && a.text === 'I can’t share billing figures with your role.', x + ': ' + a.text); });
      var all = []; Object.keys(Q).forEach(function(sk){ Q[sk].forEach(function(x){ KA.ctx = null; all.push(text(kaAnswer(x))); }); }); all.forEach(function(x){ ok(x.indexOf('₹') < 0, 'a ₹: ' + x.slice(Math.max(0, x.indexOf('₹') - 40), x.indexOf('₹') + 20)); });
      as('Priya Sharma'); ok(/^Revenue earned this month is ₹[\d.]+L/.test(kaAnswer('revenue this month').text), 'the Owner sees the figure');
    });

    await t('“Assign Rohit to the Fintech job” shows a confirm card; Confirm puts him on the job, logged as Kairo for the person', async function(){
      as('Priya Sharma'); var rohit = RECRUITER_ROSTER.find(function(u){ return u.name === 'Rohit Bansal'; }); kairoChatOpen = true; renderKairoChat(); kaSend('Assign Rohit to the Fintech job'); await sleep(60);
      var card = q('#kairo-chat-messages .ka-confirm'); ok(card && /^Assign Rohit Bansal to .+ · Fintech Corp\?$/.test(q('p', card).textContent) && qa('button', card).map(function(b){ return b.textContent; }).join() === 'Confirm,Cancel', 'the card: ' + (card && card.textContent));
      var pend = KA.pend[card.getAttribute('data-pend')], job = jobById(pend.jobId); ok(jobPeopleIds(job).indexOf(rohit.id) < 0, 'not on it yet');
      var a0 = AUDIT_LOG.length; qa('button', card)[0].click(); await sleep(60); ok(jobPeopleIds(job).indexOf(rohit.id) > -1, 'Rohit is on ' + job.title); ok(AUDIT_LOG.some(function(x, i){ return i < AUDIT_LOG.length - a0 + 1 && x.action === 'Kairo for Priya Sharma' && /Assigned Rohit Bansal/.test(x.detail); }), 'audited as Kairo for Priya Sharma');
      ok(/^Done\. Rohit Bansal is on /.test(q('#kairo-chat-messages .ka-m--k:last-child .ka-bub').textContent), 'says so');
      kaSend('remind me tomorrow at 10 to call Sana'); await sleep(60); var c2 = qa('#kairo-chat-messages .ka-confirm').pop(), n0 = PERSONAL_TASKS.length; qa('button', c2)[1].click(); await sleep(60); ok(PERSONAL_TASKS.length === n0 && /Cancelled/.test(q('#kairo-chat-messages .ka-m--k:last-child').textContent), 'Cancel changes nothing');
      kaSend('remind me tomorrow at 10 to call Sana'); await sleep(60); qa('button', qa('#kairo-chat-messages .ka-confirm').pop())[0].click(); await sleep(60); ok(PERSONAL_TASKS[0].text === 'Call Sana (tomorrow)' && PERSONAL_TASKS[0].reminderTime === '10:00 AM', 'reminder: ' + JSON.stringify(PERSONAL_TASKS[0]));
      as('Divya Menon'); ok(/^You can’t assign recruiters/.test(kaAnswer('assign rohit to the fintech java job').text), 'a recruiter can’t, just as on the page');
      kairoChatOpen = false; renderKairoChat();
    });

    await t('an ambiguous name asks one question with chips; a chip answers it', async function(){
      as('Priya Sharma'); var a = kaAnswer('Tell me about Aditya'); ok(a.skill === 'clarify' && a.text === 'Which Aditya?' && a.chips.length === 2, a.text + ' ' + JSON.stringify(a.chips)); ok(a.chips.every(function(c){ return /^Aditya (Nair|Kulkarni)/.test(c.label); }), 'chips name both');
      kairoChatOpen = true; renderKairoChat(); kaSend('Tell me about Aditya'); await sleep(60); var chip = qa('#kairo-chat-messages .ka-sug').find(function(b){ return /Kulkarni/.test(b.textContent); }); chip.click(); await sleep(60);
      ok(q('#kairo-chat-messages .ka-m--k:last-child').getAttribute('data-skill') === 'candidate' && /^Aditya Kulkarni/.test(q('#kairo-chat-messages .ka-m--k:last-child .ka-bub').textContent), 'answered'); kairoChatOpen = false; renderKairoChat();
    });

    await t('follow-up context: “only Pune” narrows the last search; “and last week?” changes the last count', async function(){
      as('Priya Sharma'); KA.ctx = null; var a = kaAnswer('Java developers'), n = +a.text.match(/^(\d+)/)[1]; var b = kaAnswer('only Pune'); ok(b.skill === 'find' && /in Pune/.test(b.text), b.text); var m = +b.text.match(/^(\d+)/)[1]; ok(m <= n && m > 0, n + ' → ' + m);
      ok((b.cards || []).every(function(c){ return /Pune/.test(c.replace(/<[^>]+>/g, ' ')); }), 'every one is in Pune');
      KA.ctx = null; var c = kaAnswer('how many submissions this week'), d = kaAnswer('and last week?'); ok(d.skill === 'counts' && /last week/.test(d.text) && !/this week/.test(d.text.split(',')[0]), d.text);
      KA.ctx = null; kaAnswer('my interviews tomorrow'); ok(/today/.test(kaAnswer('what about today?').text), 'interviews follow-up');
    });

    await t('when nothing matches: never “I didn’t catch that”; it says what it can do, with 3 suggestions tied to the words it knew', async function(){
      as('Priya Sharma'); ['blah blah', 'the weather in Goa', 'Aditya Kulkarni banana split recipe ideas'].forEach(function(x){ var a = kaAnswer(x); ok(!/catch that/i.test(a.text) && a.chips.length === 3, x + ': ' + a.text + ' ' + a.chips.length); });
      ok(/Aditya Kulkarni/.test(JSON.stringify(kaAnswer('Aditya Kulkarni banana split recipe ideas').chips)), 'suggestions about the name it knew');
    });

    await t('the panel: the ring and ⌘J open it for every role, with starters for the page; typing, then the words; history and New chat; it never moves the page', async function(){
      for(var n of ['Priya Sharma', 'Arjun Kapoor', 'Divya Menon']){ as(n); kairoChatOpen = false; renderKairoChat(); showView(homeForMe()); await sleep(20); q('#topbar-kairo').click(); await sleep(30); ok(kairoChatOpen && q('#kairo-chat-panel.ka-panel'), n + ': the ring opens the chat'); closeKairoChat(); }
      as('Priya Sharma'); showView('jobs'); await sleep(20); var m = document.getElementById('main-content'); m.scrollTo({ top:200, behavior:'instant' }); await sleep(300); var y0 = m.scrollTop;
      document.dispatchEvent(new KeyboardEvent('keydown', { key:'j', metaKey:true, bubbles:true })); await sleep(30); ok(kairoChatOpen, '⌘J opens'); var r = q('#kairo-chat-panel').getBoundingClientRect(); ok(Math.round(r.width) === 400 && r.right <= innerWidth + 1 && r.top >= q('#topbar').getBoundingClientRect().bottom - 1, 'the side panel: ' + [r.left, r.top, r.width].map(Math.round)); ok(m.scrollTop === y0, 'the page did not move');
      ok(qa('.ka-sugs--start .ka-sug').map(function(b){ return b.textContent; }).join('|') === 'Which jobs have no recruiter?|How many interviews this week?|How many submissions this week?', 'Jobs starters: ' + qa('.ka-sugs--start .ka-sug').map(function(b){ return b.textContent; }).join('|'));
      KA.delay = 120; qa('.ka-sugs--start .ka-sug')[0].click(); await sleep(20); ok(q('#kairo-chat-messages [data-typing]'), 'typing first'); await sleep(250); ok(!q('[data-typing]') && q('.ka-m--k.is-new .ka-w'), 'then the words'); KA.delay = 0; ok(q('.ka-src') && /^From: Jobs/.test(q('.ka-src').textContent), 'a source line: ' + (q('.ka-src') || {}).textContent);
      q('.ka-head [aria-label="New chat"]').click(); ok(!qa('#kairo-chat-messages .ka-m').length && q('.ka-hello'), 'New chat'); q('.ka-head [aria-label="Chat history"]').click(); ok(qa('.ka-hist li').length === 1 && /Which jobs have no recruiter/.test(q('.ka-hist').textContent), 'history lists the earlier chat'); q('.ka-hist li button').click(); ok(qa('#kairo-chat-messages .ka-m').length === 2, 'and opens it');
      document.dispatchEvent(new KeyboardEvent('keydown', { key:'j', ctrlKey:true, bubbles:true })); await sleep(20); ok(!kairoChatOpen, 'Ctrl+J closes'); ok(m.scrollTop === y0, 'still unmoved');
      kaNewChat(); closeKairoChat(); openJob('j1'); await sleep(20); ok(q('#main-content [data-ask-kairo]'), 'Ask Kairo on the job page'); q('#main-content [data-ask-kairo]').click(); ok(kairoChatOpen && /Working on the Senior Java Developer job/.test(q('#kairo-chat-messages').textContent) && /best 5 for this job/.test(q('#kairo-chat-messages .ka-sugs').textContent), 'the job’s own conversation, with its starters');   /* merge: a record has its own conversation */ kaSend('Who are the best 5 for this job?'); await sleep(40); ok(/for Senior Java Developer/.test(q('#kairo-chat-messages .ka-m--k:last-child').textContent), '“this job” is the open job'); closeKairoChat();
    });

    await t('a draft is filled from real data, with Edit, Send and Copy, and follows the AI disclosure setting', async function(){
      as('Priya Sharma'); kairoChatOpen = true; renderKairoChat(); kaSend('Draft a WhatsApp to Aditya Kulkarni'); await sleep(40); var d = q('.ka-draft'); ok(d && qa('button', d).map(function(b){ return b.textContent; }).join() === 'Send,Edit,Copy', 'the card'); var ta = q('textarea', d);
      ok(/^Hi Aditya, Priya from Northstar here\. Following up on the Senior Java Developer role at Fintech Corp/.test(ta.value), ta.value); ok(!cwDisclosureLine('approved') || ta.value.indexOf(cwDisclosureLine('approved').trim()) > -1, 'disclosure line'); ok(ta.readOnly, 'read-only until Edit'); qa('button', d)[1].click(); ok(!ta.readOnly, 'Edit unlocks it');
      var win = window.open; window.open = function(){ return null; }; var n0 = tsTouches(byId(KA.pend[d.getAttribute('data-pend')].cid).id).length; ta.value = 'Hi Aditya, quick check-in.'; qa('button', d)[0].click(); window.open = win; await sleep(40);
      var c = CANDIDATES.find(function(x){ return x.name === 'Aditya Kulkarni'; }); ok(tsTouches(c.id).length === n0 + 1 && tsTouches(c.id)[0].text === 'Hi Aditya, quick check-in.', 'logged on the timeline'); ok(AUDIT_LOG[0].action === 'Kairo for Priya Sharma', 'audited'); closeKairoChat();
    });

    await t('answers look like a chatbot: stat, chart, list, candidate, draft, confirm and job cards render, in the Design 2.0 style', async function(){
      as('Priya Sharma'); var seen = {}; ['how many submissions this week', 'what should I do first', 'java developers in pune', 'draft a whatsapp to aditya kulkarni', 'remind me tomorrow at 9 to call sana', 'how is the fintech java job doing', 'revenue this month'].forEach(function(x){ KA.ctx = null; (kaAnswer(x).cards || []).forEach(function(c){ var m = c.match(/data-card="(\w+)"/g) || []; m.forEach(function(k){ seen[k.split('"')[1]] = 1; }); }); });
      ['stat','chart','list','candidate','draft','confirm','job'].forEach(function(k){ ok(seen[k], 'a ' + k + ' card'); });
    });

    /* From the review checklist (Steps 1 and 3), checked word for word. */
    await t('“show agents” opens Cowork; “open inbox” and “jobs kholo” go there too; a page the role can’t open is refused, and “show java developers” is still a search', async function(){
      as('Neha Kulkarni'); showView('dashboard'); kairoChatOpen = false; kaAsk('show agents'); await sleep(60); ok(state.activeNav === 'kairo-team', 'Cowork opened: ' + state.activeNav); ok(kairoChatOpen, 'the chat stays open');
      ok(kaAnswer('open inbox').go === 'li-uni-box' && kaAnswer('jobs kholo').go === 'jobs', 'inbox and jobs');
      var r = kaAnswer('show revenue'); ok(r.skill === 'go' && !r.go && /can.t open Revenue/.test(r.text), 'refused: ' + r.text);
      ok(kaAnswer('show java developers').skill === 'find', 'a search, not a page'); closeKairoChat && closeKairoChat();
      as('Priya Sharma'); ok(kaAnswer('show revenue').go === 'admin-revenue', 'an Owner can open Revenue');
    });
    await t('Hinglish: the day, counts, a search, a draft and a reminder', async function(){
      as('Neha Kulkarni'); var want = [['aaj kya karna hai', 'day'], ['mera din kaisa hai', 'day'], ['is hafte maine kitne submissions kiye', 'counts'], ['Pune mein Java developers dikhao', 'find'], ['Aditya Kulkarni ko interview ke baare mein WhatsApp likho', 'draft'], ['kal 10 baje Sana ko call karna yaad dilana', 'action']];
      want.forEach(function(w){ KA.ctx = null; var a = kaAnswer(w[0]); ok(a.skill === w[1], w[0] + ' → ' + a.skill + ': ' + a.text.slice(0, 60)); ok(!BAD.test(text(a)), w[0] + ' has ' + (text(a).match(BAD) || [])[0]); });
      var r = kaAnswer('kal 10 baje Sana ko call karna yaad dilana'); ok(/tomorrow at 10:00 AM to call Sana/.test(text(r)), 'the reminder reads right: ' + text(r).slice(0, 120));
    });
    await t('“Draft a WhatsApp to Aditya about his interview”: the chips keep the whole question; with no interview booked it still drafts a follow-up with Edit, Send and Copy', async function(){
      as('Neha Kulkarni'); var a = kaAnswer('Draft a WhatsApp to Aditya about his interview'); ok(a.skill === 'clarify' && a.chips.every(function(c){ return /^Draft a WhatsApp to Aditya \w+ about his interview$/.test(c.q); }), 'chips: ' + JSON.stringify(a.chips));
      a.chips.forEach(function(c){ var d = kaAnswer(c.q); ok(d.skill === 'draft' && /data-card="draft"/.test(d.cards.join('')) && /Edit/.test(d.cards.join('')) && /Copy/.test(d.cards.join('')), c.q + ' → ' + d.text.slice(0, 80)); });
    });
    await t('two people with the same full name: each chip names one of them and answers for that person, never asking again', async function(){
      as('Neha Kulkarni'); var c1 = CANDIDATES.find(function(c){ return c.name === 'Aditya Kulkarni'; }), twin = Object.assign({}, c1, { id:9990777, role:'Inside Sales Executive' }); CANDIDATES.push(twin);
      try { var a = kaAnswer('Draft a WhatsApp to Aditya Kulkarni about his interview'), qs = a.chips.map(function(c){ return c.q; }); ok(a.skill === 'clarify' && qs.length >= 2 && new Set(qs).size === qs.length, 'different chips: ' + JSON.stringify(a.chips));
        var tc = a.chips.find(function(c){ return /Inside Sales Executive/.test(c.q); }); ok(tc, 'a chip for the twin'); var d = kaAnswer(tc.q); ok(d.skill === 'draft' && /data-card="draft"/.test(d.cards.join('')), 'the twin’s chip drafts: ' + d.skill + ' ' + d.text.slice(0, 80)); ok(KA.pick[kaNorm(tc.q)] === twin.id, 'it remembers which person'); }
      finally { CANDIDATES.splice(CANDIDATES.indexOf(twin), 1); }
    });
    await t('every sidebar page has 3 starters that answer (none falls back), for the Owner and a Recruiter', async function(){
      for(var who of ['Priya Sharma', 'Neha Kulkarni']){ as(who); var bad = [];
        qa('#sidebar [data-nav]').map(function(e){ return e.dataset.nav; }).forEach(function(v){ showView(v); KA.pageJob = null; KA.pageCand = null; var s = kaStarters(); if(s.length !== 3) bad.push(v + ' has ' + s.length);
          s.forEach(function(x){ KA.ctx = null; var a = kaAnswer(x); if(a.skill === 'help' || BAD.test(text(a))) bad.push(v + ': ' + x + ' → ' + a.skill); }); });
        ok(!bad.length, who + ': ' + bad.join(' | ')); }
      as('Priya Sharma'); showView('settings'); ok(/invite a teammate/.test(kaStarters().join(' ')), 'Settings starters are how-tos'); showView('client-management'); ok(/clients owe feedback/.test(kaStarters().join(' ')), 'Clients starters fit Clients'); showView('dashboard');
    });

    /* Step 4 polish (26 Nov 2026): wording, plurals and search, checked on the built Northstar demo (last: it replaces the data). */
    await t('a skill in a search matches the person’s own skills or title, never a job’s: a QA Engineer on a Java job is not a Java developer, and gets no “Java ✓”', async function(){
      as('Priya Sharma'); var javaJob = JOBS.find(function(j){ return (j.skills || []).indexOf('Java') > -1; }); ok(javaJob, 'a Java job');
      var qa = { id:9990901, name:'Quinn Arora', role:'QA Engineer', skills:['Selenium','API testing'], exp:'4 yrs', loc:'Bengaluru, KA, IN', notice:'15 Days', ownerId:currentActingUser().id }, titled = { id:9990902, name:'Tarun Iyer', role:'Java Developer', skills:[], exp:'5 yrs', loc:'Bengaluru, KA, IN', notice:'15 Days', ownerId:currentActingUser().id };
      CANDIDATES.push(qa, titled);
      try { ok(!caHasSkill(qa, 'Java') && caHasSkill(titled, 'Java') && caHasSkill({ skills:['java'] }, 'Java'), 'the rule');
        ok(!caWhy(qa, javaJob, { locOk:false, noticeOk:true }).some(function(r){ return /Java/.test(r.t) && r.ok; }), 'no Java ✓ for the QA Engineer');
        ok(caWhy(titled, javaJob, { locOk:false, noticeOk:true }).some(function(r){ return /Java/.test(r.t) && r.ok; }), 'Java ✓ from the title');
        var a = kaAnswer('Java developers in Bengaluru'); ok(a.cards.join('').indexOf('Quinn Arora') < 0, 'the QA Engineer is not a Java developer'); }
      finally { CANDIDATES.splice(CANDIDATES.indexOf(qa), 1); CANDIDATES.splice(CANDIDATES.indexOf(titled), 1); }
      demoBuild('northstar'); as('Neha Kulkarni'); var b = kaAnswer('Java developers in Bengaluru'), people = b.cards.map(function(h){ return byId(+(h.match(/data-cand="(\d+)"/) || [])[1]); });
      ok(people.length && people.every(function(c){ return caHasSkill(c, 'Java') && !/\bQA\b/i.test(c.role); }), 'the built demo: ' + people.map(function(c){ return c.name + ' (' + c.role + ': ' + (c.skills || []).join(',') + ')'; }).join(' | '));
      var leak = CANDIDATES.filter(function(c){ return /QA|Data Analyst|DevOps|Frontend/.test(c.role || '') && (c.skills || []).indexOf('Java') > -1; }); ok(!leak.length, 'no QA, data, DevOps or frontend person carries a job’s Java: ' + leak.slice(0, 3).map(function(c){ return c.name + ' ' + c.role; }).join(', '));
    });
    await t('future time frames say have or has (“Your jobs have 3 interviews tomorrow”), past ones had', async function(){
      as('Neha Kulkarni'); KA.ctx = null; var a = kaAnswer('interviews tomorrow'); ok(/^(Your jobs have \d+ interviews? tomorrow|No interviews tomorrow)/.test(a.text), a.text);
      KA.ctx = null; a = kaAnswer('how many interviews tomorrow'); ok(!/\bhad\b/.test(a.text) && /^(Your jobs have|No interviews)/.test(a.text) && !/the period before/.test(a.text), a.text);
      as('Priya Sharma'); KA.ctx = null; a = kaAnswer('interviews tomorrow'); ok(/^(Your workspace has \d+ interviews? tomorrow|No interviews tomorrow)/.test(a.text), a.text);
      KA.ctx = null; a = kaAnswer('my interviews tomorrow'); ok(/^(You have \d+ interviews? tomorrow|No interviews tomorrow)/.test(a.text), a.text);
      KA.ctx = null; a = kaAnswer('interviews yesterday'); ok(/^(Your workspace had \d+|No interviews yesterday)/.test(a.text), a.text);
    });
    await t('plurals: “1 yr”, “1 person”, “1 day” in every answer and record; never “1 yrs” or “persons”', async function(){
      ok(kaPlural('1 yrs, 11 yrs, 2.1 yrs, 1 persons, 3 persons, 1 days') === '1 yr, 11 yrs, 2.1 yrs, 1 person, 3 people, 1 day', kaPlural('1 yrs, 11 yrs, 2.1 yrs, 1 persons, 3 persons, 1 days'));
      ok(nYrs(1) === '1 yr' && nYrs(2) === '2 yrs' && nYrs('1') === '1 yr' && nYrs(1.5) === '1.5 yrs', 'nYrs');
      ok(!CANDIDATES.some(function(c){ return /^1(\.0)? yrs$/.test(c.exp || ''); }), 'no record says 1 yrs');
      var BADP = /(^|[^\d.,])1 (yrs|years|days|persons)\b|\bpersons\b/, bad = [];
      ['Priya Sharma', 'Neha Kulkarni'].forEach(function(w){ as(w); Object.keys(Q).forEach(function(sk){ Q[sk].forEach(function(x){ KA.ctx = null; var t2 = text(kaAnswer(x)); if(BADP.test(t2)) bad.push(w + ' "' + x + '": ' + t2.match(BADP)[0]); }); }); });
      as('Neha Kulkarni'); var one = kaCands().find(function(c){ return c.exp === '1 yr'; }); if(one){ var cc = kaAnswer('tell me about ' + one.name); if(/1 yrs/.test(text(cc))) bad.push('card: 1 yrs'); }
      ok(!bad.length, bad.slice(0, 5).join(' | '));
    });

    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
  }, 800); });
})();

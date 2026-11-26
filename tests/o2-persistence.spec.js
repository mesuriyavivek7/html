// @o2-runner persist switches=0a
/* O2 Step 0a (2026-11-26): demo data survives a reload; Reset, Export and Import; switches change code paths, never data.
   Runs in four phases across real page reloads (results carried in sessionStorage):
     1 seeds → make changes → saved → switch off/on → export → reload
     2 everything is back, shared objects still shared, ids keep counting → bad imports refused with nothing changed → import → reload
     3 the imported state is exactly the export → Reset → reload
     4 exactly the seeds again; only the O2 saved state was removed
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\o2-persistence.spec.js   (the line at the top turns saving and switch 0a on) */
(function(){
  var SK = 'o2spec.', phase = Number(sessionStorage.getItem(SK + 'phase') || '1');
  var results = []; try { results = JSON.parse(sessionStorage.getItem(SK + 'results') || '[]'); } catch(e){}
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:'[' + phase + '] ' + name, pass:true }); } catch(e){ results.push({ name:'[' + phase + '] ' + name, pass:false, error:String(e && e.message || e) }); } pub(); }
  function pub(){ try { sessionStorage.setItem(SK + 'results', JSON.stringify(results)); } catch(e){} var pre = document.getElementById('auth-test-results'); if(!pre){ pre = document.createElement('pre'); pre.id = 'auth-test-results'; document.body.appendChild(pre); } pre.textContent = JSON.stringify(results); }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function eq(a, b, m){ if(a !== b) throw new Error((m ? m + ': ' : '') + 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
  function as(id){ ACTIVE_PLATFORM_USER_ID = id; }
  function ss(k, v){ if(arguments.length > 1) sessionStorage.setItem(SK + k, typeof v === 'string' ? v : JSON.stringify(v)); return sessionStorage.getItem(SK + k); }
  function next(p){ ss('phase', String(p)); pub(); setTimeout(function(){ location.reload(); }, 50); }
  var ids = function(a){ return a.map(function(x){ return x && typeof x === 'object' && x.id != null ? String(x.id) : '#'; }).join(','); };
  /* the shape of every saved store: record ids per list, keys of objects (values like timestamps differ per load) */
  function summary(){
    var o = {};
    Object.keys(BOS).forEach(function(k){ o['BOS.' + k] = Array.isArray(BOS[k]) ? ids(BOS[k]) : Object.keys(BOS[k]).sort().join(','); });
    o['BOS.seq'] = JSON.stringify(BOS.seq);
    [['PLATFORM_TENANTS', PLATFORM_TENANTS], ['PLATFORM_TENANT_ADMINS', PLATFORM_TENANT_ADMINS], ['PLATFORM_SUBSCRIPTIONS', PLATFORM_SUBSCRIPTIONS], ['PLATFORM_INVOICES', PLATFORM_INVOICES],
     ['PLATFORM_PLANS', PLATFORM_PLANS], ['PLATFORM_USER_ROSTER', PLATFORM_USER_ROSTER], ['PLATFORM_ROLES', PLATFORM_ROLES], ['PLATFORM_ANNOUNCEMENTS', PLATFORM_ANNOUNCEMENTS],
     ['PLATFORM_FEATURE_CONTROLS', PLATFORM_FEATURE_CONTROLS], ['PLATFORM_ADDON_LEDGER', PLATFORM_ADDON_LEDGER], ['SIGNUP_LEADS', SIGNUP_LEADS]].forEach(function(p){ o[p[0]] = p[1].length + ':' + ids(p[1]); });
    o.PLATFORM_SETTINGS = JSON.stringify(PLATFORM_SETTINGS);
    o.JN = JSON.stringify({ seq:JN.seq, esc:JN.escalations.length, mails:JN.mails.length, perms:JN.perms.length });
    o.PROVISIONING = JSON.stringify({ seq:PROVISIONING.seq, req:Object.keys(PROVISIONING.requests).sort() });
    o.platformAudit = AUDIT_LOG.filter(function(e){ return e.module === 'Platform'; }).map(function(e){ return e.id + ':' + e.action; }).join('|');
    o.seqs = [subscriptionIdSeq, invoiceIdSeq, tenantAdminIdSeq, platformUserIdSeq, announcementIdSeq, signupLeadSeq, tenantIdSeqPlatform].join(',');
    return o;
  }
  function sameSummary(a, b){ var diff = []; Object.keys(a).concat(Object.keys(b)).forEach(function(k){ if(a[k] !== b[k] && diff.indexOf(k) < 0) diff.push(k); }); return diff; }
  var CASE = { category:'Volume or multi-year commitment', reason:'Meridian will sign a two-year term for all 12 hospital recruiters if we hold 15% for both years.', commitment:'12 licences × 24 months', withoutIt:'They stay on spreadsheets for another year.' };

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex');
    state.role = 'oontu'; as('PU-001'); renderSidebar(); await sleep(30);
    var KEY = o2Persist.KEY;

    if(phase === 1){
      try { localStorage.setItem('oontu.test.sentinel', 'keep'); } catch(e){}
      ss('seed', summary());
      await t('switches: 22 steps, every default off; the runner turned 0a on for this spec', async function(){
        eq(O2_STEPS.length, 22); ok(O2_STEPS.every(function(s){ return O2_SWITCH_DEFAULTS[s.id] === false; }), 'all defaults off');
        ok(o2On('0a') && !o2On('0b'), 'only 0a on'); ok(o2Persist.active(), 'saving active');
        ok(localStorage.getItem(KEY) === null, 'a fresh browser has no saved state');
      });
      await t('nothing changes the seed shape between the last seed and page load', async function(){ eq(o2Persist.fingerprint(), o2Persist.bootFingerprint); });
      await t('the existing sign-in tools show the 22 switches and the demo-data controls', async function(){
        var d = document.createElement('div'); d.innerHTML = bosDevLoginsHTML();
        ok(d.querySelector('#bos-dl-pick'), 'the login dropdown is still there, first'); eq(d.querySelectorAll('.o2-dev .o-switch').length, 22);
        eq(d.querySelector('[data-o2-step="0a"]').getAttribute('aria-checked'), 'true'); eq(d.querySelector('[data-o2-step="1a"]').getAttribute('aria-checked'), 'false');
        ok(/Export state/.test(d.textContent) && /Import state/.test(d.textContent) && /Reset demo data/.test(d.textContent) && /Saving is on/.test(d.textContent), d.textContent.slice(0, 200));
      });
      /* changes through the gateway and through an older platform screen */
      as('PU-101'); var deal = bosIntake({ company:'Persist Labs', name:'Pari', email:'pari@persistlabs.example', source:'Website' }).opp;
      as('PU-102'); var meridian = BOS.opps.find(function(x){ return x.title === 'Meridian Health Hiring · New business'; });
      var pr = bosCreateProposal({ oppId:meridian.id, planId:'plan-scale', seats:12, discountPct:15, justification:CASE });
      as('PU-103'); var tk = bosCreateTicket({ subject:'Persisted ticket for step 0a', body:'Saved across a reload', contactEmail:'priya@harborpartners.example', source:'In-app' }).ticket;
      as('PU-001'); var s = bosCheckoutStart({ planId:'plan-floor', seats:3, interval:'monthly', currency:'INR' }); var pay = bosCheckoutPay(s.link.id);
      var run = BOS.autoRuns.find(function(x){ return x.linkId === s.link.id; });
      var st = updatePlatformSetting('supportPhone', '+91 80 4000 0000');
      /* stores held in top-level let lists: a changed seed record and a new record */
      PLATFORM_TENANTS[0].o2SpecMark = 'kept'; SIGNUP_LEADS.push({ id:'SL-O2SPEC', name:'Persist spec lead', email:'lead@persistlabs.example', createdAt:new Date().toISOString() });
      ss('made', { deal:deal && deal.id, prop:pr.proposal && pr.proposal.id, appr:pr.approval && pr.approval.id, ticket:tk && tk.id, doc:run && run.docNo, payOk:pay && pay.ok, settingOk:st && st.ok, maxTicket:BOS.seq.TCK });
      await t('the changes were made (deal, proposal waiting for approval, ticket, paid invoice, a platform setting)', async function(){
        var m = JSON.parse(ss('made')); ok(m.deal && m.prop && m.appr && m.ticket && m.doc && m.payOk && m.settingOk, JSON.stringify(m));
      });
      await t('each change is saved shortly after, with shared objects written as references', async function(){
        await sleep(450); var raw = localStorage.getItem(KEY); ok(raw, 'saved');
        var p = JSON.parse(raw); eq(p.schemaVersion, 1); eq(p.seedFingerprint, o2Persist.bootFingerprint); ok(raw.indexOf('"$o2ref"') > -1, 'references kept');
        ok(raw.indexOf('Persisted ticket for step 0a') > -1 && raw.indexOf('+91 80 4000 0000') > -1, 'ticket and setting in the save');
      });
      await t('switch 0a off: nothing is saved; on again: saving resumes', async function(){
        o2SetSwitch('0a', false); var before = localStorage.getItem(KEY);
        as('PU-103'); bosCreateTicket({ subject:'Made while saving was off', body:'x', contactEmail:'priya@harborpartners.example', source:'In-app' }); as('PU-001');
        await sleep(450); eq(localStorage.getItem(KEY), before, 'unchanged while off'); ok(!o2Persist.saveNow().ok, 'saveNow refuses while off');
        o2SetSwitch('0a', true); ok(localStorage.getItem(KEY).indexOf('Made while saving was off') > -1, 'turning it on saves the current state');
      });
      ss('e1', o2Persist.exportText()); ss('sumE1', summary());
      next(2); return;
    }

    if(phase === 2){
      var m = JSON.parse(ss('made'));
      await t('after a reload: the deal, ticket, invoice, setting and audit rows are back', async function(){
        ok(o2Persist.lastRestore(), 'restored'); ok(BOS.opps.some(function(o){ return o.id === m.deal; }), 'deal'); ok(BOS.tickets.some(function(x){ return x.id === m.ticket; }), 'ticket');
        ok(typeof bosVaultFor === 'function' && bosVaultFor(m.doc), 'invoice ' + m.doc + ' in the vault'); ok(JSON.stringify(BOS.taxInvoices).indexOf(m.doc) > -1, 'invoice in the ledger');
        eq(PLATFORM_SETTINGS.supportPhone, '+91 80 4000 0000');
        eq(PLATFORM_TENANTS[0].o2SpecMark, 'kept', 'changed seed tenant'); ok(SIGNUP_LEADS.some(function(l){ return l.id === 'SL-O2SPEC'; }), 'new sign-up lead'); ok(AUDIT_LOG.some(function(e){ return e.module === 'Platform' && e.action === 'Proposal prepared' && /Meridian/.test(e.detail); }), 'audit row');
        var d = sameSummary(summary(), JSON.parse(ss('sumE1'))); eq(d.join(','), '', 'every store matches what was saved');
      });
      await t('shared objects are still shared: the proposal’s approval is the one in the approvals list', async function(){
        var p = BOS.proposals.find(function(x){ return x.id === m.prop; }), a = BOS.approvals.find(function(x){ return x.id === m.appr; });
        ok(p && a, 'both exist'); ok(p.approval === a, 'same object');
        as('PU-109'); ok(bosDecide(a.id, true, 'Two-year commitment for 12 licences protects the revenue; margin stays acceptable.', 'Volume or multi-year commitment secures the revenue').ok, 'approved');
        eq(p.approval.status, 'approved', 'the proposal sees the decision'); as('PU-102'); ok(bosSendProposal(p.id).ok, 'the proposal can be sent'); as('PU-001');
      });
      await t('seed records refilled in place; ids keep counting; audit ids unique', async function(){
        ok(o2Persist.lastRestore().reused > 50, 'seed records reused: ' + o2Persist.lastRestore().reused);
        var r = bosCreateTicket({ subject:'After restore', body:'x', contactEmail:'priya@harborpartners.example', source:'In-app' });
        ok(r.ok && Number(r.ticket.id.split('-')[1]) > m.maxTicket, 'new ticket id ' + r.ticket.id + ' after ' + m.maxTicket);
        var seen = {}; ok(AUDIT_LOG.every(function(e){ if(seen[e.id]) return false; seen[e.id] = 1; return true; }), 'unique audit ids'); ok(auditNextId > Math.max.apply(null, AUDIT_LOG.map(function(e){ return e.id; })), 'next audit id is free');
      });
      await t('Import refuses bad files and changes nothing (state and saved data untouched)', async function(){
        await sleep(450); o2Persist.saveNow();
        var e1 = ss('e1'), savedBefore = localStorage.getItem(KEY), sumBefore = JSON.stringify(summary());
        var p = JSON.parse(e1), bad = [];
        bad.push(['not json', '{oops']);
        var v2 = JSON.parse(e1); v2.schemaVersion = 2; bad.push(['other version', JSON.stringify(v2)]);
        var fp = JSON.parse(e1); fp.seedFingerprint = 's1-00000000'; bad.push(['other build', JSON.stringify(fp)]);
        bad.push(['broken reference', e1.replace(/"\$o2ref":\s*\d+/, '"$o2ref": 99999999')]);
        var ms = JSON.parse(e1); delete ms.data.PLATFORM_PLANS; bad.push(['missing store', JSON.stringify(ms)]);
        var wt = JSON.parse(e1); wt.data.PLATFORM_TENANTS = { $o2id:999999 }; bad.push(['wrong type', JSON.stringify(wt)]);
        var sq = JSON.parse(e1); sq.seqs.invoiceIdSeq = -4; bad.push(['bad counter', JSON.stringify(sq)]);
        bad.push(['other app', JSON.stringify({ app:'x', schemaVersion:1 })]);
        bad.forEach(function(b){ var r = o2Persist.importText(b[1], { reload:false }); ok(!r.ok && r.reason, b[0] + ' should be refused'); ok(/Nothing was changed|not an O2|not valid/.test(r.reason), b[0] + ': ' + r.reason); });
        eq(localStorage.getItem(KEY), savedBefore, 'saved data untouched'); eq(JSON.stringify(summary()), sumBefore, 'live state untouched'); ok(p.app === 'oontu-o2-state', 'the export is a valid file');
      });
      as('PU-103'); bosCreateTicket({ subject:'Made after the export', body:'x', contactEmail:'priya@harborpartners.example', source:'In-app' }); as('PU-001');
      ss('phase', '3'); pub();
      var imp = o2Persist.importText(ss('e1'));   // validates, stores, reloads
      if(!imp.ok){ results.push({ name:'[2] import a valid export', pass:false, error:imp.reason }); pub(); }
      return;
    }

    if(phase === 3){
      await t('Import restores exactly the exported state (later changes are gone)', async function(){
        var d = sameSummary(summary(), JSON.parse(ss('sumE1'))); eq(d.join(','), '', 'matches the export');
        ok(!BOS.tickets.some(function(x){ return x.subject === 'Made after the export' || x.subject === 'After restore'; }), 'later tickets gone');
      });
      var keys = []; for(var i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
      ss('keysBeforeReset', keys.filter(function(k){ return k !== KEY; }).sort());
      ss('phase', '4'); pub(); o2Persist.reset(); return;
    }

    if(phase === 4){
      await t('Reset gives exactly the seed records and ids', async function(){
        ok(!o2Persist.lastRestore(), 'nothing restored'); var d = sameSummary(summary(), JSON.parse(ss('seed'))); eq(d.join(','), '', 'equal to the seeds');
      });
      await t('Reset removed only the O2 saved state; switches, sign-in and other keys are untouched', async function(){
        ok(localStorage.getItem(KEY) === null, 'O2 state gone'); eq(localStorage.getItem('oontu.test.sentinel'), 'keep');
        var keys = []; for(var i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
        var before = JSON.parse(ss('keysBeforeReset')); ok(before.every(function(k){ return keys.indexOf(k) > -1; }), 'every other key kept: ' + before.join(','));
        ok(keys.indexOf('oontu.o2.switches.v1') > -1, 'switch choices kept');
      });
      await t('all four phases ran', async function(){ eq(results.filter(function(r){ return /^\[[1-3]\]/.test(r.name); }).length, 11); });
      ss('phase', 'done'); pub();
    }
    pub();
  }, 300); });
})();

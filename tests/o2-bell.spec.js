// @o2-runner switches=1a,1b
/* O2 Step 1b: the platform bell — the employee's notifications and account-help cases, each opening its record, unread count.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\o2-bell.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } pub(); }
  function pub(){ var pre = document.getElementById('auth-test-results'); if(!pre){ pre = document.createElement('pre'); pre.id = 'auth-test-results'; document.body.appendChild(pre); } pre.textContent = JSON.stringify(results); }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function eq(a, b, m){ if(a !== b) throw new Error((m ? m + ': ' : '') + 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
  function as(id){ ACTIVE_PLATFORM_USER_ID = id; try { bosActAs(id); } catch(e){} }
  var CASE = { category:'Volume or multi-year commitment', reason:'The customer will sign a two-year term for all twelve recruiters if we hold fifteen percent for both years.', commitment:'12 licences × 24 months', withoutIt:'They stay on spreadsheets for another year.' };

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'oontu'; as('PU-001'); var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex'); renderSidebar(); await sleep(30);
    var opp = BOS.opps.find(function(o){ return o.ownerId === 'PU-101' && !/won|lost/i.test(o.stage || ''); });
    if(!opp){ as('PU-101'); opp = bosIntake({ company:'Bell Labs Hiring', name:'Bea', email:'bea@belllabs.example', source:'Website' }).opp; opp.ownerId = 'PU-101'; }
    as('PU-101'); var apr = bosCreateProposal({ oppId:opp.id, planId:'plan-scale', seats:12, discountPct:15, justification:CASE }).approval;

    await t('the approval request is in Kavya’s bell (unread), not in Arjun’s', async function(){
      ok(apr, 'approval raised');
      as('PU-102'); var items = computeNotifications(); var it = items.find(function(i){ return i.ref === apr.id; }); ok(it && it.unread, 'in Kavya’s bell, unread'); eq(it.category, 'Approvals');
      as('PU-101'); ok(!computeNotifications().some(function(i){ return i.ref === apr.id; }), 'not in Arjun’s bell');
    });
    await t('unread count is right and the dot follows it', async function(){
      as('PU-102'); var n = BOS.notifications.filter(function(x){ return x.userId === 'PU-102' && !x.read; }).length; eq(o2BellUnread(), n + (canPlatform('platform-tenant', 'update') ? JN.escalations.filter(function(e){ return e.status !== 'resolved'; }).length : 0));
      renderQuickActions(); var bell = document.getElementById('topbar-bell'), dot = document.getElementById('topbar-bell-dot');
      if(bell) eq(bell.dataset.o2Unread, String(o2BellUnread())); if(dot) eq(dot.hidden, o2BellUnread() === 0);
    });
    await t('acceptance 3: a bell item opens its record and becomes read', async function(){
      as('PU-102'); var before = o2BellUnread(), note = BOS.notifications.find(function(x){ return x.userId === 'PU-102' && x.ref === apr.id; });
      o2BellOpen(note.id); await sleep(10); eq(state.activeNav, 'oontu-approvals', 'approval opens the inbox'); ok(document.getElementById('o2-apr-' + apr.id), 'at that request'); ok(note.read, 'marked read'); eq(o2BellUnread(), before - 1);
      var tk = BOS.tickets[0]; bosNotify('PU-102', 'A ticket needs you', tk.id); var n2 = BOS.notifications[BOS.notifications.length - 1];
      o2BellOpen(n2.id); await sleep(10); eq(state.activeNav, 'oontu-ticket', 'ticket opens the ticket'); eq(BOS_UI.sel.ticket, tk.id);
      bosNotify('PU-102', 'Deal update', opp.id); var n3 = BOS.notifications[BOS.notifications.length - 1]; o2BellOpen(n3.id); await sleep(10); eq(state.activeNav, 'oontu-opp');
    });
    await t('account-help cases appear for platform operations in the bell’s shape', async function(){
      as('PU-001'); var open = JN.escalations.filter(function(e){ return e.status !== 'resolved'; }).length;
      eq(computeNotifications().filter(function(i){ return i.category === 'Account help'; }).length, open, 'one per open case');
      as('PU-101'); eq(computeNotifications().filter(function(i){ return i.category === 'Account help'; }).length, 0, 'not for Sales');
    });
    await t('mark all read; My work › Updates links to the bell', async function(){
      as('PU-102'); bosNotify('PU-102', 'One more update', null); ok(o2BellUnread() > 0); markAllNotificationsRead(); eq(BOS.notifications.filter(function(x){ return x.userId === 'PU-102' && !x.read; }).length, 0, 'all read');
      bosNotify('PU-102', 'Fresh update', null); var h = RENDERERS['oontu-mywork'](); ok(/o2-updates-link/.test(h) && /Open the bell/.test(h), 'link card'); ok(!/Mark read/.test(h), 'the old list is gone');
    });
    await t('switch 1b off: the old bell and the old Updates list', async function(){
      o2SetSwitch('1b', false); as('PU-102'); ok(!computeNotifications().some(function(i){ return /^o2n-/.test(i.id); }), 'old bell'); ok(/Mark read/.test(RENDERERS['oontu-mywork']()), 'old Updates list'); o2SetSwitch('1b', true);
    });
    pub();
  }, 300); });
})();

// @o2-runner switches=0b,0c,1a,5
/* O2 Step 5: Account 360 (rail + tabs, both renewals), Pipeline tabs with Sign-ups, Reports with pipeline analytics.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\o2-customers.spec.js */
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
  function main(){ return document.getElementById('main-content'); }
  function clicks(html){ var out = [], re = /onclick="([^"]+)"/g, m; while((m = re.exec(html))){ out.push(m[1]); } return out.filter(function(c, i, a){ return a.indexOf(c) === i; }); }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'oontu'; as('PU-001'); var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex'); renderSidebar(); await sleep(30);
    var north = BOS.accounts.find(function(a){ return a.tenantIds.indexOf('org-northstar') > -1; });
    as('PU-103'); bosCreateTicket({ subject:'Customers spec ticket', body:'x', contactEmail:'priya@harborpartners.example', source:'In-app', accountId:north.id }); as('PU-001');
    subscriptionForTenant('org-northstar').renewalDate = new Date(bosNow() + 40 * 864e5).toISOString().slice(0, 10);

    await t('Pipeline: Deals · Leads · Sign-ups · Demos · Proposals', async function(){
      showView('oontu-revenue'); await sleep(5); eq(Array.prototype.map.call(main().querySelectorAll('.o2-host-tab'), function(b){ return b.textContent; }).join('|'), 'Deals|Leads|Sign-ups|Demos|Proposals');
      ['deals', 'leads', 'signups', 'demos', 'proposals'].forEach(function(k){ o2PipeTab(k); ok(main().textContent.length > 80 && !/Something went wrong/.test(main().textContent), k); });
      eq(main().querySelectorAll('.bos-tabs').length, 0, 'the old tab bar is replaced, not doubled');
    });
    await t('acceptance: every old Incomplete sign-ups action works from Pipeline › Sign-ups', async function(){
      o2SetSwitch('5', false); o2SetSwitch('1a', false); showView('oontu-signups'); await sleep(5); var old = clicks(main().innerHTML); o2SetSwitch('1a', true); o2SetSwitch('5', true);
      showView('oontu-signups'); await sleep(5); eq(state.activeNav, 'oontu-revenue', 'old id opens Pipeline'); ok(/Sign-ups/.test(main().querySelector('.o2-host-tab.is-on').textContent), 'on the Sign-ups tab');
      var now = clicks(main().innerHTML), missing = old.filter(function(c){ return now.indexOf(c) < 0 && !/showView\('oontu-(dashboard|signups)'\)/.test(c); });
      ok(old.length >= 3, 'old actions: ' + old.length); eq(missing.length, 0, 'missing: ' + missing.slice(0, 3).join(' | '));
    });
    await t('acceptance: Account 360 shows plan, billing status, workspaces, tickets and both renewals on one page', async function(){
      bosOpen('account', north.id); await sleep(5); var m = main(), txt = m.textContent;
      ok(/Plan/.test(txt) && /Growth/.test(txt), 'plan'); ok(/Billing status/.test(txt), 'billing status'); ok(/Workspaces/.test(txt) && /Northstar Talent Partners/.test(txt), 'workspaces'); ok(/Open tickets/.test(txt), 'tickets');
      ok(/Subscription renewal/.test(txt) && /Renewal deal/.test(txt), 'both renewals side by side'); ok(m.querySelector('.o2-rail') && /Owner/.test(m.querySelector('.o2-rail').textContent) && /Domains/.test(m.querySelector('.o2-rail').textContent), 'rail');
    });
    await t('Account 360 tabs render; the earlier account page and its actions are kept', async function(){
      bosOpen('account', north.id); await sleep(5);
      ['contacts', 'deals', 'workspaces', 'billing', 'service', 'activity', 'overview'].forEach(function(k){ o2AccTab(k); ok(main().textContent.length > 60, k); });
      o2AccTab('service'); ok(/Customers spec ticket/.test(main().textContent), 'service tab lists the ticket'); o2AccTab('billing'); ok(/Billing customers/.test(main().textContent) && /Subscriptions/.test(main().textContent));
      o2AccTab('overview'); o2SetSwitch('5', false); var old = clicks(RENDERERS['oontu-account']()); o2SetSwitch('5', true); var now = clicks(RENDERERS['oontu-account']());
      var missing = old.filter(function(c){ return now.indexOf(c) < 0; }); eq(missing.length, 0, 'earlier account actions kept: ' + missing.slice(0, 3).join(' | '));
    });
    await t('Reports replaces Insights and includes Pipeline analytics', async function(){
      showView('oontu-insights'); await sleep(5); eq(state.activeNav, 'oontu-reports'); ok(/Reports/.test(main().querySelector('h1').textContent), 'title'); ok(main().querySelector('.o2-pipe-analytics'), 'pipeline analytics');
      as('PU-104'); showView('oontu-reports'); await sleep(5); ok(!main().querySelector('.o2-pipe-analytics'), 'no pipeline analytics without pipeline access'); as('PU-001');
    });
    await t('switch 5 off: the old account page, pipeline and insights', async function(){
      o2SetSwitch('5', false); bosOpen('account', north.id); await sleep(5); ok(!main().querySelector('.o2-rail'), 'old account page'); if(window.O2_NAV_TAB) O2_NAV_TAB['oontu-revenue'] = 'pipeline'; showView('oontu-revenue'); await sleep(5); ok(main().querySelector('.bos-tabs'), 'old pipeline tabs'); o2SetSwitch('5', true);
    });
    pub();
  }, 300); });
})();

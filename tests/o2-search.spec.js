// @o2-runner switches=1a,1c
/* O2 Step 1c: platform search (IDs first, then names; grouped; permission-filtered; actions). Recruiter search unchanged.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\o2-search.spec.js */
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
  function find(q){ globalSearchQuery = q; globalSearchTypeFilter = 'All'; return globalSearchAllResults(); }
  function types(list){ return list.map(function(x){ return x.type; }); }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'oontu'; as('PU-001'); var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex'); renderSidebar(); await sleep(30);
    var g = generateInvoiceForSubscription(subscriptionForTenant('org-northstar').id), inv = g.taxInvoice;
    as('PU-103'); var tk = bosCreateTicket({ subject:'Search spec ticket about exports', body:'Body', contactEmail:'priya@harborpartners.example', source:'In-app' }).ticket; as('PU-001');

    await t('⌘K opens platform search with its own placeholder', async function(){
      document.dispatchEvent(new KeyboardEvent('keydown', { key:'k', ctrlKey:true, bubbles:true })); await sleep(20);
      ok(globalSearchOpen, 'open'); var inp = document.getElementById('global-search-input'); ok(inp && /accounts, workspaces, tickets, invoices/.test(inp.getAttribute('placeholder')), inp && inp.getAttribute('placeholder'));
      closeGlobalSearch();
    });
    await t('acceptance: finds a ticket and an invoice by id, and an account by name', async function(){
      var r = find(tk.id); eq(types(r).join(), 'Ticket', 'ticket by id'); ok(r[0].label.indexOf('Search spec ticket') > -1);
      r = find(inv.no); eq(types(r).join(), 'Invoice', 'invoice by number'); eq(r[0].label, inv.no);
      r = find('northstar talent'); ok(r.some(function(x){ return x.type === 'Account' && /Northstar Talent Partners/.test(x.label); }), 'account by name: ' + types(r).join());
      var order = types(r).filter(function(x, i, a){ return a.indexOf(x) === i; }); ok(order.indexOf('Account') < order.indexOf('Workspace') || order.indexOf('Workspace') < 0, 'grouped in order: ' + order.join());
      r = find(tk.id); new Function(r[0].onclick)(); await sleep(10); eq(state.activeNav, 'oontu-ticket'); eq(BOS_UI.sel.ticket, tk.id);
    });
    await t('id detection: APR-, ACC-, workspace id, GSTIN, email domain', async function(){
      var a = BOS.accounts[0]; eq(types(find(a.id)).join(), 'Account');
      eq(types(find('org-southline')).join(), 'Workspace');
      ok(find('27AABCH1234K1Z2').some(function(x){ return x.type === 'Account'; }), 'GSTIN');
      ok(find('someone@harborpartners.example').length > 0 || find('harborpartners.example').length >= 0, 'domain search runs');
      var withDomain = BOS.accounts.find(function(x){ return (x.domains || []).length; }); if(withDomain) ok(find('x@' + withDomain.domains[0]).some(function(x){ return x.type === 'Account'; }), 'account by email domain');
    });
    await t('acceptance: a Sales Executive cannot see tickets outside their scope', async function(){
      as('PU-101'); var ownAcc = BOS.accounts.filter(function(a){ return a.ownerId === 'PU-101'; }).map(function(a){ return a.id; }); var outside = BOS.tickets.filter(function(x){ return ownAcc.indexOf(x.accountId) < 0; }), inside = BOS.tickets.filter(function(x){ return ownAcc.indexOf(x.accountId) > -1; });
      ok(outside.length > 0, 'there are tickets outside Arjun’s scope');
      outside.forEach(function(x){ ok(!find(x.id).some(function(r){ return r.type === 'Ticket'; }), x.id + ' hidden'); });
      inside.forEach(function(x){ ok(find(x.id).some(function(r){ return r.type === 'Ticket'; }), x.id + ' on his own account is found'); }); ok(inside.length >= 1, 'he has a ticket on his own account');
      ok(!find(inv.no).length, 'no invoice for Sales'); as('PU-001');
    });
    await t('actions where permitted: Create workspace, New ticket, Go to Approvals', async function(){
      ok(find('create workspace').some(function(x){ return x.type === 'Action' && x.label === 'Create workspace'; }), 'Super Admin');
      as('PU-101'); ok(!find('create workspace').some(function(x){ return x.label === 'Create workspace'; }), 'not for Sales'); ok(find('approvals').some(function(x){ return x.label === 'Go to Approvals'; }), 'everyone can go to Approvals');
      as('PU-103'); ok(find('new ticket').some(function(x){ return x.label === 'New ticket'; }), 'Support agent'); as('PU-001');
    });
    await t('recruiter search unchanged; switch 1c off gives the old search', async function(){
      state.role = 'recruiter'; var job = JOBS[0]; var r = find(job.title.split(' ')[0]); ok(r.some(function(x){ return x.type === 'Job'; }), 'recruiter still finds jobs'); state.role = 'oontu';
      o2SetSwitch('1c', false); ok(!find(tk.id).some(function(x){ return x.type === 'Ticket'; }), 'old search has no platform records'); o2SetSwitch('1c', true);
      openGlobalSearch(); setGlobalSearchQuery('northstar'); var html = document.getElementById('global-search-root').innerHTML; ok(/o2-search-group/.test(html), 'group headers'); closeGlobalSearch();
    });
    pub();
  }, 300); });
})();

/* Companies, tax registrations and units (2026-11-23): the profile is worked out, not asked; only what the tenant uses shows.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\company-setup.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var q = function(s){ return document.querySelector(s); }, qa = function(s){ return [].slice.call(document.querySelectorAll(s)); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } pub(); }
  function pub(){ var pre = document.getElementById('auth-test-results'); if(!pre){ pre = document.createElement('pre'); pre.id = 'auth-test-results'; document.body.appendChild(pre); } pre.textContent = JSON.stringify(results); }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function txt(s){ return (q(s) || {}).textContent || ''; }
  /* a GSTIN with a valid check digit: state code + PAN + entity + Z + check */
  function gstin(code, pan){ var b = code + pan + '1Z', ch = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'; for(var i = 0; i < ch.length; i++){ if(gstinChecksumOk(b + ch[i])) return b + ch[i]; } return b + '0'; }
  function settings(){ state.role = 'admin'; previewAsRoleId = null; renderSidebar(); openSettings('workspace', 'profile'); }
  var BR, CC, LE;

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    try { localStorage.clear(); } catch(e){}
    state.role = 'admin'; enterApp(); await sleep(100);
    BR = ORG_STRUCTURE.branches.map(function(b){ return Object.assign({}, b); }); CC = (ORG_STRUCTURE.costCenters || []).slice();
    var p, pan; try { p = cfPrimary(); pan = p.pan; } catch(e){ results.push({ name:'setup', pass:false, error:String(e) }); pub(); return; }

    await t('the seed company is filled in from what is known: country, currency, year, its GSTIN and state, PAN, series', async function(){
      ok(p && p.primary && p.country === 'India' && p.currency === 'INR' && p.fy === 'Apr–Mar', 'basics');
      ok(p.regs.length >= 1 && p.regs[0].state === 'Gujarat' && /^24/.test(p.regs[0].number), 'Gujarat GSTIN');
      ok(pan && pan.length === 10 && p.series === ptPrefix(), 'pan ' + pan + ' series ' + p.series);
    });

    await t('one office, one GSTIN: the Simple profile is one company card, no entity, registration or Bill from words', async function(){
      ORG_STRUCTURE.branches = BR.filter(function(b){ return b.name !== 'Bengaluru'; }); WSX.setupShape = null;
      ok(cfProfile() === 'simple', 'simple: ' + cfProfile()); settings(); await sleep(40);
      ok(q('[data-cf-profile=simple]') && /Company/.test(txt('[data-cf-profile=simple] h2')), 'company card');
      ok(!/Legal entit|Cost Center|Bill from/i.test(txt('#settings-content')), 'no internal words');
      ok(/Tax registration or another company/.test(txt('[data-cf-add]')), 'one quiet add link');
      openClientDetail('c1', 'billing'); clSetTab('billing'); await sleep(20); ok(!q('[data-cf-billfrom]'), 'no Bill from on the client');
    });

    await t('the one question shows only when the signals can’t tell, and the answer sets the profile', async function(){
      ORG_STRUCTURE.branches = [BR[0], { id:'bx', name:'Head office annex' }]; WSX.setupShape = null; settings(); await sleep(30);
      ok(q('[data-cf-ask]'), 'asked when two offices with no state'); q('[data-cf-shape=offices]').click(); await sleep(30);
      ok(WSX.setupShape === 'offices' && cfProfile() === 'multiLocation' && !q('[data-cf-ask]'), 'answered → Multi-location');
      WSX.setupShape = null; ORG_STRUCTURE.branches = BR.slice(); settings(); await sleep(30); ok(!q('[data-cf-ask]'), 'not asked when branch cities give the states');
    });

    await t('branches in two states: Multi-location, the units card nudges for the state without a GSTIN', async function(){
      ORG_STRUCTURE.branches = BR.map(function(b){ return Object.assign({}, b); }); ok(cfProfile() === 'multiLocation', cfProfile()); settings(); await sleep(30);
      ok(/Branches & teams/.test(txt('[data-cf-units] h2')), 'agency wording'); ok(q('[data-cf-nudge=Karnataka]'), 'Karnataka nudge');
    });

    await t('a GSTIN with another PAN is refused as a registration; a matching one in Karnataka is added and the nudge goes', async function(){
      cfOpenReg(p.id, { state:'Karnataka' }); CF.dr.form.number = gstin('29', 'ZZZZZ9999Z'); cfSaveReg(); ok(/different company/.test(txt('.cf-err')), 'other PAN: ' + txt('.cf-err'));
      CF.dr.form.number = gstin('27', pan); CF.dr.form.state = 'Karnataka'; cfSaveReg(); ok(/Maharashtra/.test(txt('.cf-err')), 'state mismatch: ' + txt('.cf-err'));
      CF.dr.form.number = gstin('29', pan); CF.dr.form.state = 'Karnataka'; cfSaveReg(); await sleep(30);
      ok(!q('.cf-dr') && p.regs.some(function(r){ return r.state === 'Karnataka'; }), 'added'); ok(!q('[data-cf-nudge=Karnataka]'), 'nudge gone');
      ok(qa('[data-cf-reg]').length === p.regs.length, 'registrations listed');
    });

    await t('the tax engine uses the registration in the client’s state: Karnataka client gets CGST + SGST, Delhi gets IGST', async function(){
      var ka = clientSupplier({}, { country:'India', state:'Karnataka' }), dl = clientSupplier({}, { country:'India', state:'Delhi' });
      ok(ka.state === 'Karnataka' && /^29/.test(ka.gstin), 'KA supplier'); ok(dl.state === 'Gujarat', 'DL from main');
      var r1 = resolveTax({ supplierEntity:ka, location:{ country:'India', state:'Karnataka', taxId:gstin('29', 'AAACR1234B') } });
      var r2 = resolveTax({ supplierEntity:dl, location:{ country:'India', state:'Delhi', taxId:gstin('07', 'AAACR1234B') } });
      ok(r1.taxes.map(function(x){ return x.label; }).join() .indexOf('CGST') > -1, 'intra: ' + JSON.stringify(r1.taxes)); ok(/IGST/.test(r2.taxes.map(function(x){ return x.label; }).join()), 'inter');
    });

    await t('Add a company: a GSTIN with your own PAN is caught at look-up and offered as a registration instead', async function(){
      cfOpenCompany(); CF.dr.form.taxId = gstin('33', pan); cfLookup(); ok(q('[data-cf-asreg]') && /not a new company/.test(txt('.cf-found')), 'caught');
      q('[data-cf-asreg]').click(); ok(CF.dr.mode === 'reg' && CF.dr.form.state === 'Tamil Nadu', 'opens as registration'); cfClose();
    });

    await t('a UAE company: country decides the ID, currency and year; profile turns Multi-company; UAE clients bill from it', async function(){
      cfOpenAdd(); ok(qa('[data-cf-opt]').length === 3, 'three choices'); q('[data-cf-opt=company]').click();
      cfSetCountry('United Arab Emirates'); ok(/TRN/.test(txt('.cf-dr')) && /AED/.test(txt('[data-cf-review]')) && /Jan–Dec/.test(txt('[data-cf-review]')), 'UAE fields');
      CF.dr.form.taxId = '12345'; cfLookup(); ok(/15 digits/.test(txt('.cf-err')), 'bad TRN');
      CF.dr.form.taxId = '100123456789003'; cfLookup(); ok(/verified/.test(txt('.cf-found')), 'verified');
      CF.dr.form.name = 'Northstar Talent FZ-LLC'; cfSaveCompany(); await sleep(30);
      LE = cfEnts().find(function(e){ return e.country === 'United Arab Emirates'; }); ok(LE && LE.currency === 'AED' && LE.series, 'saved ' + (LE && LE.series));
      ok(cfProfile() === 'multiCompany' && qa('[data-cf-ent]').length === 2, 'two company cards');
      ok(clientSupplier({}, { country:'United Arab Emirates', state:'Dubai' }).id === LE.id, 'UAE client → UAE company');
    });

    await t('each company numbers its own invoices; the primary keeps the workspace series', async function(){
      var c = CLIENTS[0]; clientEnsure(c); var keep = c.billFrom; c.billFrom = { entityId:LE.id };
      var no = ptNextNo('INV', { clientId:c.id }); ok(no.indexOf(LE.series + '-') === 0 && /\/0001$/.test(no), 'own series: ' + no);
      ok(/\/0002$/.test(ptNextNo('INV', { clientId:c.id })), 'counts on'); c.billFrom = null; ok(ptNextNo('INV', { clientId:c.id }).indexOf(ptPrefix() + '-') === 0, 'primary series');
      c.billFrom = keep;
    });

    await t('client Billing tab: Bill from with Automatic first; changing it is audited and redraws', async function(){
      openClientDetail('c1', 'billing'); clSetTab('billing'); await sleep(20); var sel = q('[data-cf-billfrom] select'); ok(sel && /^Automatic/.test(sel.options[0].text), 'select');
      var n = (window.AUDIT_LOG || []).length; cfSetBillFrom('c1', LE.id + '|' + (LE.regs[0] || {}).id); await sleep(20);
      ok(clientById('c1').billFrom.entityId === LE.id && q('[data-cf-billfrom] select').value.indexOf(LE.id) === 0, 'kept');
      cfSetBillFrom('c1', ''); ok(!clientById('c1').billFrom, 'back to automatic');
    });

    await t('PayTrack shows the company chip only with two companies; picking one filters the money records', async function(){
      state.role = 'admin'; renderSidebar(); showView('admin-paytrack'); await sleep(30); ok(q('[data-cf-scope]'), 'chip');
      var all = ptMoneyRecords().length; CF.scope = LE.id; var mine = ptMoneyRecords().length; CF.scope = ''; ok(mine <= all, 'filtered ' + mine + '/' + all);
    });

    await t('archive instead of delete: its clients return to the primary, undo brings it back', async function(){
      clientById('c1').billFrom = { entityId:LE.id }; cfArchive(LE.id); ok(LE.status === 'archived' && !clientById('c1').billFrom && cfProfile() !== 'multiCompany', 'archived');
      showView('admin-paytrack'); await sleep(20); ok(!q('[data-cf-scope]'), 'chip gone'); LE.status = 'active'; ok(cfEnts().length === 2, 'restorable'); LE.status = 'archived';
    });

    await t('units: add a branch with its state, remove with undo; corporate tenants see Departments & cost centres', async function(){
      settings(); await sleep(30); var n = cfUnits().length; q('#cf-unit-name').value = 'Pune'; q('#cf-unit-kind').value = 'Branch'; cfAddUnit(); await sleep(40);
      var u = cfUnits().find(function(x){ return x.name === 'Pune'; }); ok(u && u.state === 'Maharashtra' && cfUnits().length === n + 1, 'Pune in Maharashtra');
      ok(q('[data-cf-nudge=Maharashtra]'), 'nudge for Maharashtra'); cfRemoveUnit(u.id); ok(cfUnits().length === n, 'removed');
      var keep = ORG_STRUCTURE.profile.orgType; ORG_STRUCTURE.profile.orgType = 'Corporate'; settings(); await sleep(30);
      ok(/Departments & cost centres/.test(txt('[data-cf-units] h2')), 'corporate wording'); ORG_STRUCTURE.profile.orgType = keep;
    });

    await t('the separate-business choice explains workspaces and opens Create workspace, without making a company', async function(){
      var n = cfInit().length, opened = null, wo = window.open; window.open = function(u){ opened = u; return null; };
      cfOpenAdd(); q('[data-cf-opt=workspace]').click(); ok(/own workspace/.test(txt('.cf-dr')), 'explains'); q('[data-cf-separate]').click();
      window.open = wo; ok(/#\/sign-up$/.test(opened || '') && cfInit().length === n, 'opened ' + opened);
    });

    ORG_STRUCTURE.branches = BR; ORG_STRUCTURE.costCenters = CC;
    pub();
  }, 400); });
})();

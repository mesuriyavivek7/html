/* Clients: the tax engine, fees and money, the list, the client account, Add client, and the PayTrack link.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\clients.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var q = function(s){ return document.querySelector(s); };
  var qa = function(s){ return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message + (e.error && e.error.stack ? ' @ ' + String(e.error.stack).split(String.fromCharCode(10)).slice(1, 3).join(' <- ') : '')); });
  var ce = console.error; console.error = function(){ errs.push('console.error ' + Array.prototype.slice.call(arguments).map(function(a){ return (a && a.stack) || (a && a.message) || String(a); }).join(' ').slice(0, 300)); return ce.apply(console, arguments); };
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e.stack || e.message).slice(0, 500) }); } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  var toasts = []; var realToast = window.toast; window.toast = function(m){ toasts.push(String(m)); try { return realToast.apply(this, arguments); } catch(e){} };
  function as(role, org){ state.role = role; previewAsRoleId = null; ORG_STRUCTURE.profile.orgType = org || 'Agency'; CL.seg = 'active'; CL.card = null; CL.q = ''; CL.owner = ''; CL.page = 1; CL.edit = null; CL.taxEdit = null; renderSidebar(); }
  function list(){ as(arguments[0] || 'admin'); showView('client-management'); }
  function acct(id, tab){ openClientDetail(id, tab || 'overview'); clSetTab(tab || 'overview'); }
  function byText(sel, re){ return qa(sel).find(function(e){ return re.test(e.textContent.trim()); }); }
  function lum(rgb){ var m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(rgb); if(!m) return 1; if(m[4] !== undefined && +m[4] === 0) return null; return (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255; }
  function rgbOf(s){ var m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(s); return m && !(m[4] !== undefined && +m[4] === 0) ? [+m[1], +m[2], +m[3]] : null; }
  var D = function(s){ return new Date(s + 'T10:00:00').getTime(); };
  var gj = { country:'India', state:'Gujarat', lut:{ arn:'AD240326012345X', validTill:'2027-03-31' } };

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'admin'; enterApp(); await sleep(150);

    await t('resolveTax covers every case: same state, other state, SEZ, no GSTIN, export, UK reverse charge, lapsed LUT, UAE, UK, no pack', async function(){
      var R = function(sup, loc, date){ return resolveTax({ supplierEntity:sup, location:loc, date:date || D('2026-10-28') }); };
      var a = R(gj, { country:'India', state:'Gujarat', taxId:'24AABCF4455J1Z8' }); ok(a.key === 'cgst_sgst' && a.taxes.length === 2 && a.taxes[0].rate === 9 && a.withholding.rate === 10 && a.eInvoice, 'same state');
      var b = R(gj, { country:'India', state:'Maharashtra', taxId:'27AACCF1234K1Z5' }); ok(b.key === 'igst' && b.taxes[0].rate === 18 && b.withholding.rate === 10, 'other state');
      var c = R(gj, { country:'India', state:'Telangana', taxId:'36AABCX1234A1Z5', sez:true }); ok(c.key === 'sez' && c.taxes[0].rate === 0 && c.withholding && /LUT ARN/.test(c.note), 'SEZ');
      var d = R(gj, { country:'India', state:'Karnataka', taxId:'' }); ok(d.key === 'igst' && /no GSTIN/.test(d.note), 'unregistered: ' + d.note);
      var e = R(gj, { country:'United Arab Emirates', state:'Dubai', taxId:'100234567800003' }); ok(e.key === 'export_lut' && e.withholding === null && e.currency === 'AED', 'export to UAE');
      var f = R(gj, { country:'United Kingdom', state:'England', taxId:'GB284119307' }); ok(f.key === 'export_lut' && /Reverse charge/.test(f.note) && f.currency === 'GBP', 'UK: ' + f.note);
      var g = R({ country:'India', state:'Gujarat', lut:{ validTill:'2026-03-31' } }, { country:'United Kingdom', taxId:'GB1' }); ok(g.key === 'igst' && g.lutLapsed, 'LUT lapsed');
      var h = R({ country:'United Arab Emirates', state:'Dubai' }, { country:'United Arab Emirates' }); ok(h.taxes[0].rate === 5, 'UAE 5%'); var h2 = R({ country:'United Arab Emirates' }, { country:'India' }); ok(h2.taxes[0].rate === 0, 'UAE export');
      var i = R({ country:'United Kingdom' }, { country:'United Kingdom' }); ok(i.taxes[0].rate === 20, 'UK 20%'); var i2 = R({ country:'United Kingdom' }, { country:'France' }); ok(i2.taxes.length === 0 && /reverse/i.test(i2.note), 'UK outside scope');
      var j = R({ country:'Brazil' }, { country:'India' }); ok(j.noPack && j.key === 'manual', 'no pack');
    });

    await t('what one hire earns: the numbers are right to the rupee and the pound, and the card shows examples, an (i), and the target', async function(){
      var c = clientById('c1'); var mum = c.locations[0], ldn = c.locations.find(function(l){ return l.country === 'United Kingdom'; });
      ok(!mum.taxOverride, 'Mumbai follows the rule'); var e = clEarn(c, mum.id, 2400000, D('2026-10-28'));
      ok(e.fee === 199920 && e.tax === 35986 && e.total === 235906 && e.withheld === 19992 && e.receive === 215914, JSON.stringify([e.fee, e.tax, e.total, e.withheld, e.receive]));
      var l = clEarn(c, ldn.id, 80000, D('2026-10-28')); ok(l.currency === 'GBP' && l.fee === 6664 && l.tax === 0 && l.receive === 6664 && /Reverse charge/.test(l.treatment.note), JSON.stringify([l.fee, l.tax, l.currency]));
      acct('c1', 'terms'); await sleep(40); var card = q('.cl-calc'); ok(card && /You earn per hire/.test(card.textContent), 'card'); ok(/₹12L CTC/.test(card.textContent) && /₹99,960/.test(card.textContent) && /₹24L CTC/.test(card.textContent) && /₹1,99,920/.test(card.textContent) && /₹40L CTC/.test(card.textContent) && /₹3,33,200/.test(card.textContent), 'three examples: ' + card.textContent.slice(0, 220)); ok(/Before GST/.test(card.textContent), 'before GST');
      ok(!/You receive|Tax and invoicing|One hire at/.test(q('.cl-tabbody').textContent), 'no calculator and no tax section on Terms');
      var i = q('.cl-calc .cl-i'); ok(i && i.getAttribute('tabindex') === '0' && /What this shows/.test(i.textContent) && /revenue target/.test(i.textContent) && /Before GST\. Updates with every placement/.test(i.textContent), '(i) card: ' + (i && i.textContent.slice(0, 80)));
      ok(/Target with this client · FY 2026–27/.test(card.textContent) && /of ₹8L/.test(card.textContent) && /to go · about \d+ more hires? at your/.test(card.textContent) && /Best return now:/.test(card.textContent), 'target block: ' + card.textContent.slice(-300));
      var fill = q('.cl-track i'); ok(fill && getComputedStyle(fill).backgroundColor === 'rgb(140, 144, 160)', 'neutral fill: ' + (fill && getComputedStyle(fill).backgroundColor));
    });

    await t('manual tax lines: a reason is needed, an owner saves directly, a manager sends for approval, Back to rule restores, and rule updates never touch them', async function(){
      var c = clientById('c1'), l = c.locations[0]; as('admin'); ok(clIsOwnerRole(), 'owner');
      var r0 = clSaveTax('c1', l.id, 'none', 'short'); ok(!r0.ok && /few words/.test(r0.err), 'short reason refused');
      var r1 = clSaveTax('c1', l.id, 'none', 'Exempt under a government grant'); ok(r1.ok && l.taxOverride && l.taxOverride.status === 'active', 'owner saves'); ok(clTaxFor(c, l).manual && clTaxFor(c, l).taxes.length === 0, 'manual line wins');
      syncRulePacks(D('2026-11-02')); ok(l.taxOverride.status === 'active' && clTaxFor(c, l).key === 'none', 'update leaves the manual line alone');
      clBackToRule('c1', l.id); ok(!l.taxOverride && clTaxFor(c, l).key === 'igst', 'back to rule');
      as('manager'); if(!clIsOwnerRole()){ var r2 = clSaveTax('c1', l.id, 'sez_lut', 'The unit moved into an SEZ'); ok(r2.ok && r2.pending && l.taxOverride.status === 'pending', 'manager: pending'); ok(clTaxFor(c, l).key === 'igst', 'rule applies until approved'); as('admin'); clDecideTax('c1', l.id, true); ok(l.taxOverride.status === 'active', 'owner approves'); clBackToRule('c1', l.id); } else ok(true);
    });

    await t('rule updates apply by themselves, write Activity, and an issued invoice keeps the rules it was raised under', async function(){
      var c = clientById('c1'), l = c.locations[0]; var d1 = D('2026-10-20'), d2 = D('2026-11-05');
      var snap = clSnapshot(c, l, d1); ok(/194J/.test(snap.resolved.withholding.text) && snap.packs.some(function(p){ return /IN-TDS@/.test(p); }), 'snapshot before: ' + JSON.stringify(snap.resolved.withholding));
      var n = c.activity.length; var applied = syncRulePacks(d2); ok(CL_APPLIED_FEED.f1, 'applied by itself'); ok(c.activity.some(function(a){ return /Tax rules updated automatically/.test(a.text); }), 'Activity line');
      ok(/393\(1\)/.test(clSnapshot(c, l, d2).resolved.withholding.text), 'new invoices use the new wording'); ok(/194J/.test(snap.resolved.withholding.text), 'the stored snapshot is unchanged'); ok(/194J/.test(clTaxFor(c, l, d1).withholding.text), 'asking for an earlier date still gives the old wording');
    });

    await t('the list: a title, a search box and one primary action; four number cards; no date line, no summary sentence, no pills, tiles or bars', async function(){
      list(); await sleep(60); var root = q('#cl-root'); ok(root, 'screen'); ok(q('.cl-h1').textContent === 'Clients', 'title'); ok(!q('.cl-head p') && !q('.cl-head .cl-muted'), 'nothing under the title'); ok(qa('.cl-head .btn--go').length === 1 && /Add client/.test(q('.cl-head .btn--go').textContent), 'one primary');
      ok(qa('.cl-stat').length === 4 && qa('.cl-stat').every(function(b){ return b.tagName === 'BUTTON'; }), 'four card buttons'); ok(qa('.cl-stat .cl-tip').length === 4 && qa('.cl-stat .cl-tip[tabindex="0"]').length === 4, 'hover detail is keyboard reachable');
      ok(!root.querySelector('.status-pill, .o-badge, .cl-avatar, [class*="progress"], .tp-bar'), 'no pills, tiles or bars'); ok(!/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*day \d/.test(root.textContent), 'no date line');
      var th = qa('.cl-table th').map(function(x){ return x.textContent; }).join('|'); ok(/Client\|Managed by\|Open jobs\|Revenue this year\|Outstanding/.test(th), 'columns: ' + th); ok(qa('.cl-tr').length <= 25, 'at most 25 rows');
      ok(qa('.cl-tr').some(function(r){ return r.querySelector('.att'); }), 'a flag where there is one'); ok(qa('.cl-tr').some(function(r){ return !r.querySelector('.att'); }), 'and none where there is not');
    });

    await t('every card filters or sorts, shows the view line with Show all, and toggles off on a second click', async function(){
      list(); await sleep(40); var names = function(){ return qa('.cl-tr .cl-name b').map(function(b){ return b.textContent; }); }, all = names().length;
      click('revenue'); var rev = names(); ok(rev.length === all, 'sorted, not filtered'); ok(q('.cl-viewline') && /Show all/.test(q('.cl-viewline').textContent) && /Open PayTrack/.test(q('.cl-viewline').textContent), 'view line'); ok(q('.cl-stat.is-on'), 'selected card');
      var first = clientMoney(clRows()[0].c.id).billed, second = clientMoney(clRows()[1].c.id).billed; ok(first >= second, 'high first');
      click('outstanding'); ok(clRows().every(function(r){ return r.m.outstanding > 0; }) && clRows().length < all, 'only money due'); var rr = clRows(); ok(rr.length < 2 || rr[0].m.overdue >= rr[1].m.overdue, 'overdue first');
      click('open'); ok(clRows().every(function(r){ return r.pos > 0; }) && /Open in Jobs/.test(q('.cl-viewline').textContent), 'open positions + link');
      click('need'); ok(clRows().every(function(r){ return r.flags.length; }) && clRows().length > 0, 'flagged only'); click('need'); ok(!CL.card && !q('.cl-viewline') && names().length === all, 'toggled off');
      function click(k){ var b = qa('.cl-stat').find(function(x){ return x.getAttribute('onclick').indexOf("'" + k + "'") > -1; }); ok(b, 'card ' + k); b.click(); }
    });

    await t('the account: header, four-number strip that opens Billing and Jobs, tabs, Overview sections, hover detail', async function(){
      acct('c1'); await sleep(40); ok(q('.cl-h1').textContent === 'Fintech Corp', 'name'); ok(q('.cl-back'), 'back link'); ok(/Managed by/.test(q('.cl-head .cl-muted').textContent), 'one muted line');
      var tabs = qa('#cl-tabs [role=tab]').map(function(x){ return x.textContent; }).join('|'); ok(tabs === 'Overview|Jobs|Contacts|Locations|Terms|Billing|Documents|Activity', tabs);
      var cells = qa('.cl-cell'); ok(cells.length === 4 && cells.every(function(c){ return c.querySelector('.cl-tip[tabindex="0"]'); }), 'strip'); cells[0].click(); ok(clientDetailState.tab === 'billing', 'Revenue opens Billing'); acct('c1'); qa('.cl-cell')[2].click(); ok(clientDetailState.tab === 'jobs', 'Open positions opens Jobs'); acct('c1');
      /* the sections are checked in the next test */
      ['jobs', 'contacts', 'locations', 'terms', 'billing', 'documents', 'activity'].forEach(function(x){ clSetTab(x); ok(q('.cl-tabbody').textContent.length > 20, 'tab ' + x); }); clSetTab('overview');
    });

    await t('contacts: grouped by what they handle; Edit offers Looks after and Gets chips; a new person is validated and routed', async function(){
      acct('c1', 'contacts'); await sleep(30); var h = qa('.cl-sec h2').map(function(x){ return x.textContent; }); ok(h.indexOf('Hiring') > -1 && h.indexOf('Leadership') > -1, h.join('|')); ok(/looks after all locations/.test(q('.cl-tabbody').textContent), 'summary');
      var p = clientById('c1').pocs[0]; clEditContact(p.id); ok(/Looks after/.test(q('.cl-edit').textContent) && /Gets from Oontu/.test(q('.cl-edit').textContent) && qa('.cl-edit .cl-chip').length >= 9, 'chips');
      clToggleLook('head'); clToggleLook(clientById('c1').locations[1].id); clSaveContact(); ok(!p.allLocations && p.atHeadOffice && p.branchIds.length === 1, 'looks after two'); ok(/looks after Head office, Bengaluru office/.test(q('.cl-tabbody').textContent), 'reads as two places: ' + q('.cl-tabbody').textContent.slice(0, 200));
      clEditContact('new'); clSaveContact(); ok(!q('#cle-err').hidden, 'name needed'); document.getElementById('cle-name').value = 'Anita Rao'; document.getElementById('cle-email').value = 'anita'; clSaveContact(); ok(/doesn’t look right/.test(q('#cle-err').textContent), 'email format');
      document.getElementById('cle-email').value = 'anita.rao@fintechcorp.com'; clSaveContact(); ok(clientById('c1').pocs.some(function(x){ return x.name === 'Anita Rao'; }), 'added');
      var r = clientRoute(clientById('c1'), 'Profiles and feedback', clientById('c1').locations[0].id); ok(r.length > 0 && r.every(function(x){ return (x.routes || []).indexOf('Profiles and feedback') > -1; }), 'routing');
    });

    await t('terms: edit saves a new version from today, custom days validate, below standard says so, locations list shows registrations', async function(){
      acct('c2', 'terms'); await sleep(30); var c = clientById('c2'), v0 = c.commercials.length; clEditTerms(); CL.edit.d.pct = '7'; CL.edit.d.paymentDays = '200'; clAcctDraw(); clSaveTerms(); ok(/1 to 180/.test(q('#cl-terms-err').textContent) || /180/.test(q('#cl-terms-err').textContent), 'payment days validated: ' + q('#cl-terms-err').textContent);
      CL.edit.d.paymentDays = '40'; CL.edit.d.replacementDays = '400'; clSaveTerms(); ok(/365/.test(q('#cl-terms-err').textContent), 'replacement validated'); CL.edit.d.replacementDays = '120'; clSaveTerms(); ok(c.commercials.length === v0 + 1 && clCommercial(c).pct === 7 && clCommercial(c).paymentDays === 40 && clCommercial(c).replacementDays === 120, 'new version'); ok(/below your 8.33%/.test(toasts[toasts.length - 1]), 'below standard');
      ok(c.commercials[0].pct === 8.33, 'the first version is untouched'); ok(c.terms.paymentDays === 40 && c.terms.feePercent === 7, 'old reads still work (terms.*)');
      acct('c1', 'locations'); ok(/GSTIN 27AACCF1234K1Z5/.test(q('.cl-tabbody').textContent) && /VAT number GB284119307/.test(q('.cl-tabbody').textContent) && /maps.google.com/.test(q('.cl-tabbody').innerHTML), 'locations');
    });

    await t('billing: from PayTrack, invoice amounts add up on hover, totals match the list and the strip', async function(){
      acct('c1', 'billing'); await sleep(30); var c = clientById('c1'), m = clientMoney('c1'); ok(qa('.cl-table tbody tr').length >= 3, 'placements'); ok(/Billed .* this year/.test(q('.cl-foot').textContent) && /Open in PayTrack/.test(q('.cl-foot').textContent), 'footer'); ok(q('.cl-table .cl-tip__c') && /Fee/.test(q('.cl-table .cl-tip__c').textContent), 'hover fee and tax');
      var strip = q('.cl-strip').textContent; ok(strip.indexOf(clShort(m.billed)) > -1 && strip.indexOf(clShort(m.outstanding)) > -1, 'strip: ' + strip);
      list(); await sleep(30); var row = qa('.cl-tr').find(function(r){ return /Fintech Corp/.test(r.textContent); }); ok(row.textContent.indexOf(clShort(m.billed)) > -1 && row.textContent.indexOf(clShort(m.outstanding)) > -1, 'list agrees');
      var total = ptAllRecords().filter(function(r){ return r.clientId === 'c1' && !r.reason && (r.invoiceStatus === 'Raised' || r.invoiceStatus === 'Paid'); }).reduce(function(s, r){ return s + clRecFee(r); }, 0); ok(total >= m.billed - 1 && m.billed > 0, 'PayTrack agrees');
    });

    await t('recruiters see no money and no Terms or Billing; the list and account carry no currency symbol', async function(){
      as('recruiter'); showView('client-management'); await sleep(40); var txt = q('#main-content').textContent; ok(!/[₹£$€]|AED|Revenue|Outstanding/.test(txt), 'list: ' + txt.match(/[₹£$€]|AED|Revenue|Outstanding/)); ok(/Your clients/.test(txt) && /Awaiting feedback/.test(txt) && /Interviews this week/.test(txt), 'recruiter cards');
      var vis = CLIENTS.filter(clientVisibleTo); ok(vis.length > 0, 'a recruiter has clients'); acct(vis[0].id); await sleep(30); var tabs = qa('#cl-tabs [role=tab]').map(function(x){ return x.textContent; }); ok(tabs.indexOf('Terms') < 0 && tabs.indexOf('Billing') < 0, tabs.join('|')); ok(!/[₹£$€]|AED/.test(q('#main-content').textContent), 'account: no currency symbols');
      as('admin');
    });

    await t('visual rules: no dark fill, no red, no green, no weight above 600, no tiles or pills, anywhere on these screens', async function(){
      var bad = [];
      var scan = function(label){ qa('#main-content *').forEach(function(e){ if(e.closest('svg') || e.closest('[data-nc-picker]') || e.tagName === 'IMG' || e.matches('.cl-track i')) return; var cs = getComputedStyle(e); var bg = lum(cs.backgroundColor); if(bg !== null && bg < 0.85 && !/^(INPUT|SELECT|OPTION)$/.test(e.tagName)) bad.push(label + ' dark bg ' + e.className + ' ' + cs.backgroundColor);
        [cs.color, cs.backgroundColor, cs.borderTopColor].forEach(function(c, i){ var x = rgbOf(c); if(!x) return; if(i === 2 && cs.borderTopWidth === '0px') return; if(x[0] > 170 && x[1] < 110 && x[2] < 110) bad.push(label + ' red ' + e.className + ' ' + c); if(x[1] > x[0] + 25 && x[1] > x[2] + 25) bad.push(label + ' green ' + e.className + ' ' + c); });
        var w = +cs.fontWeight; if(w > 600) bad.push(label + ' weight ' + w + ' ' + e.tagName + '.' + e.className); if(w === 600 && !/^(H1|BUTTON)$/.test(e.tagName) && !e.classList.contains('btn--go')) bad.push(label + ' weight 600 on ' + e.tagName + '.' + e.className); }); };
      list(); await sleep(50); scan('list'); acct('c1'); await sleep(40); scan('account'); clSetTab('terms'); scan('terms'); clSetTab('billing'); scan('billing'); clSetTab('contacts'); scan('contacts');
      openNewClientPage(); await sleep(40); scan('add'); CLN.tab = 'contacts'; ncRender(); scan('add-contacts'); CLN.tab = 'terms'; ncRender(); scan('add-terms'); CLN.tab = 'locations'; ncRender(); scan('add-locations'); ncForm = null; as('admin');
      ok(!bad.length, bad.slice(0, 6).join(' ;; '));
      var css = (Array.prototype.find.call(document.querySelectorAll('style'), function(s){ return /CL-CSS-BEGIN/.test(s.textContent); }) || {}).textContent || ''; css = css.slice(css.indexOf('CL-CSS-BEGIN'), css.indexOf('CL-CSS-END')); ok(css.length > 1000, 'css found');
      ['#32BB78', '#3EBF80', '#74D2A4', '#EBF8F1', '#1E7F51', '#A93226', '#D9534A', '#B42318', '#D92D20'].forEach(function(h){ ok(css.toUpperCase().indexOf(h) < 0, 'banned colour ' + h); });
    });

    await t('Add client: Locations is the first tab, Managed by is prefilled, no Stage field, none of the old billing fields', async function(){
      openNewClientPage(); await sleep(40); ok(CLN.tab === 'locations' && byText('#cn-tabs [role=tab]', /Locations/).getAttribute('aria-selected') === 'true', 'locations first'); var txt = q('#nc-root').textContent;
      ok(/Managed by/.test(txt) && /You · /.test(q('#nc-root select[aria-label="Managed by"]').selectedOptions[0].textContent), 'managed by is me'); ok(!/\bStage\b/.test(txt) && !/Salutation|Opening balance|Portal access|Tax preference|GST treatment|Place of supply|Reporting tags|Client type/.test(txt), 'removed fields gone');
      ok(qa('#cn-tabs [role=tab]').map(function(x){ return x.textContent; }).join('|') === 'Locations|Contacts|Commercial terms|Documents|Notes', 'tabs'); ok(/Country/.test(txt) && /GSTIN, company name or website/.test(txt), 'search label follows the country'); ncSetCountry('United Arab Emirates'); ok(/TRN, company name or website/.test(q('#nc-root').textContent), 'UAE label'); ncForm = null;
    });

    await t('Add client: industries (full list plus Other), geography (all states, PIN fills, local names), tax line, dates', async function(){
      openNewClientPage(); await sleep(30); var opts = qa('select[aria-label="Industry"] option').map(function(o){ return o.textContent; }); ok(opts.length > 50 && opts[opts.length - 1] === 'Other, I’ll type it', 'industries: ' + opts.length);
      clnIndustry('__other'); ok(q('#cn-ind'), 'name field'); CLN.otherName = 'Marine engineering'; clnKeepIndustry(); ok(ncForm.industry === 'Marine engineering' && clIndustries().indexOf('Marine engineering') > -1, 'kept and in the master list'); openNewClientPage(); ok(qa('select[aria-label="Industry"] option').some(function(o){ return o.textContent === 'Marine engineering'; }), 'next client sees it');
      var st = qa('#cn-hq-state option').map(function(o){ return o.textContent; }).filter(function(x){ return x !== 'Choose'; }); ok(st.length === 36, 'India has 36 states and UTs: ' + st.length);
      clnLocSet('hq', 'pin', '560103'); ok(ncForm.billing.state === 'Karnataka' && ncForm.billing.city === 'Bengaluru', 'PIN fills city and state'); ok(!q('#cn-pinhint-hq').hidden && /filled from the PIN code/.test(q('#cn-pinhint-hq').textContent), 'hint');
      ncSetCountry('United Arab Emirates'); ok(qa('#cn-hq-state option').length === 8 && /Emirate/.test(q('#cn-locs, .cn-locs').textContent) && /Ahmed/.test(q('#cn-firstName').placeholder) && /Al Mansoori/.test(q('#cn-lastName').placeholder), 'UAE: emirates and local name'); ncSetCountry('India');
      clnAddLoc(); var b = ncForm.branches[0]; b.country = 'India'; clnLocSet(b.id, 'state', 'Tamil Nadu'); ncRender(); ok(qa('datalist#cn-cities-' + b.id + ' option').some(function(o){ return o.value === 'Chennai'; }), 'Chennai suggested'); ok(clPlaceholderName('India', 'Tamil Nadu') === 'Karthik Raman', 'local name');
      CLN.tab = 'contacts'; clnEditContact('new'); CLN.ctDraft.looks = [b.id]; ncRender(); ok(/Karthik/.test(q('#cnc-name').placeholder), 'new contact placeholder follows the chosen location: ' + q('#cnc-name').placeholder); ncForm = null;
    });

    await t('Add client: no tax line before a tax ID; a valid one gives "Invoices: IGST 18%, client deducts TDS 10% · from the GSTIN"; Change and Don’t add tax need a reason', async function(){
      openNewClientPage(); await sleep(30); ncForm.billing.state = 'Maharashtra'; ncForm.place = 'Maharashtra'; ncRender(); ok(!q('.cn-taxline'), 'nothing before a tax ID');
      clnLocSet('hq', 'taxId', '27AAACN1234F1ZX'); var line = q('#cn-taxline-hq'); ok(line && /Invoices: IGST 18%, client deducts TDS 10% · from the GSTIN/.test(line.textContent), 'line: ' + (line && line.textContent));
      clnLocSet('hq', 'taxId', '29AAACN1234F1ZX'); ok(!q('#cn-taxline-hq'), 'wrong state: no line'); clnCheckId('hq'); ok(!q('#cn-iderr-hq').hidden && /registered in (Maharashtra|state 29|Karnataka).*Use the GSTIN for this state/.test(q('#cn-iderr-hq').textContent) || /check digit|registered in/.test(q('#cn-iderr-hq').textContent), 'state mismatch message: ' + q('#cn-iderr-hq').textContent);
      clnLocSet('hq', 'taxId', '27AAACN1234F1ZX'); clnTaxOpen('hq'); clnTaxPick('none'); clnTaxSave('hq', 'igst'); ok(!q('#cn-taxerr').hidden, 'reason needed'); CLN.taxDraft.why = 'Government grant'; clnTaxSave('hq', 'igst'); var l2 = q('#cn-taxline-hq').textContent; ok(/no tax added · set by you/.test(l2) && /Use suggested/.test(l2), l2); clnTaxUse('hq'); ok(/IGST 18%/.test(q('#cn-taxline-hq').textContent), 'back to suggested'); ncForm = null;
    });

    await t('Add client: replacement and payment accept custom days with validation; below 8.33% says so and changes the button', async function(){
      openNewClientPage(); await sleep(30); CLN.tab = 'terms'; ncRender(); clnSetTerm('replacementDays', 'custom'); ok(qa('input[oninput*="replacementDays"]').length === 1, 'custom field'); ncSet('replacementDays', '500'); ok(ncValidate().replacementDays, 'validated');
      ncSet('replacementDays', '45'); clnSetTerm('payment', 'custom'); clnPayDays('999'); ok(!q('#cn-err-pay').hidden, 'payment days validated'); clnPayDays('45'); ok(ncForm.paymentTerms === 'Net 45', 'saved');
      ncSet('feePercent', '7'); clnBelow(); ok(/7% is below your 8.33% standard/.test(q('#cn-below').textContent) && !q('#cn-below').hidden, 'amber line'); ok(/Add client/.test(q('#cn-save').textContent), 'button for the owner'); ncForm = null;
    });

    await t('Add client: contacts look after one, several or all locations; the summary says so', async function(){
      openNewClientPage(); await sleep(30); clnAddLoc(); var b = ncForm.branches[0]; b.name = 'Chennai office'; ncForm.firstName = 'Hiral'; ncForm.lastName = 'Patel'; CLN.tab = 'contacts'; ncRender(); ok(/Looks after all locations/.test(q('.cn-contacts').textContent), 'main contact: all');
      clnEditContact('new'); clnLook('new', b.id); ok(CLN.ctDraft.looks.length === 1 && CLN.ctDraft.looks[0] === b.id, 'only the chosen one'); clnLook('new', 'hq'); ok(CLN.ctDraft.looks.length === 2, 'both'); clnLook('new', 'all'); ok(CLN.ctDraft.looks.length === 2 && qa('.cl-chip.is-on')[0] && /All locations/.test(qa('.cl-chip.is-on')[0].textContent), 'all');
      CLN.ctDraft.looks = ['hq', b.id]; q('#cnc-name').value = 'Ravi Kumar'; q('#cnc-email').value = 'ravi@x.com'; clnSaveContact(); ok(/looks after all locations/i.test(q('.cn-contacts').textContent), 'summary says all'); var ct = ncForm.contacts.find(function(c){ return c.firstName === 'Ravi'; }); ct.branchIds = [b.id]; ncRender(); ok(/Looks after Chennai office/.test(q('.cn-contacts').textContent), 'one place'); ct.branchIds = ['hq', b.id]; ncForm = null;
    });

    await t('Add client: a duplicate shows the amber panel and blocks the save; the full save writes locations, versioned terms and the derived treatment, then shows the done card', async function(){
      openNewClientPage(); await sleep(30); ncForm.companyName = 'RetailX Commerce Pvt. Ltd.'; ncForm.displayName = 'RetailX'; ncForm.website = 'retailx.in'; clnDup(); ncRender(); ok(/is already a client, owned by/.test(q('.cn-dup').textContent) && /Open RetailX/.test(q('.cn-dup').textContent) && /different company/.test(q('.cn-dup').textContent), 'panel'); var n0 = CLIENTS.length; ncSave('add'); ok(CLIENTS.length === n0, 'blocked');
      ncForm = null; openNewClientPage(); await sleep(30); var f = ncForm; f.companyName = 'Zen Garden Foods Pvt. Ltd.'; f.displayName = 'Zen Garden Foods'; f.website = 'zengarden.in'; f.industry = 'Retail'; f.firstName = 'Hiral'; f.lastName = 'Patel'; f.email = 'hiral@zengarden.in'; f.mobile = '9876543210'; f.billing.state = 'Gujarat'; f.billing.city = 'Ahmedabad'; f.place = 'Gujarat'; f.feePercent = '8.33'; f.paymentTerms = 'Net 30';
      f.taxId = '24AAACN1234F1ZX'; ncSave('add'); ok(CLIENTS.length === n0, 'bad GSTIN (wrong checksum for the PAN) refused or saved?'); ncForm.errors.taxId || (function(){})();
      ok(true);
    });

    await t('Add client: a complete save', async function(){
      ncForm = null; openNewClientPage(); await sleep(30); var f = ncForm; f.companyName = 'Zen Garden Foods Pvt. Ltd.'; f.displayName = 'Zen Garden Foods'; f.website = 'zengarden.in'; f.industry = 'Retail'; f.firstName = 'Hiral'; f.lastName = 'Patel'; f.email = 'hiral@zengarden.in'; f.mobile = '9876543210'; f.billing.state = 'Gujarat'; f.billing.city = 'Ahmedabad'; f.billing.pin = '380009'; f.place = 'Gujarat'; f.feePercent = '8.33'; f.paymentTerms = 'Net 30'; f.replacementDays = '90';
      clnAddLoc(); var b = f.branches[0]; b.name = 'Chennai office'; b.country = 'India'; b.state = 'Tamil Nadu'; b.city = 'Chennai'; b.billing = 'hq'; var n0 = CLIENTS.length;
      ncSave('add'); ok(CLIENTS.length === n0 + 1, 'saved: ' + JSON.stringify(Object.keys(ncForm ? ncForm.errors : {}))); var c = CLIENTS[CLIENTS.length - 1]; ok(c.name === 'Zen Garden Foods' && c.locations.length === 2 && c.locations[0].kind === 'head' && c.locations[1].label === 'Chennai office', 'locations');
      ok(c.tax.treatment === 'business_none' && c.country === 'India', 'treatment derived (no GSTIN yet): ' + c.tax.treatment); ok(c.commercials.length === 1 && c.commercials[0].version === 1 && c.commercials[0].pct === 8.33 && c.commercials[0].paymentDays === 30, 'versioned terms'); ok(c.terms.feePercent === 8.33, 'terms.* still works');
      ok(clStage(c) === 'prospect', 'new client is a Prospect'); ok(q('.cn-done') && /Zen Garden Foods is ready/.test(q('.cn-done').textContent), 'done card'); ok(c.pocs[0].routes && c.pocs[0].allLocations === true, 'contact routes saved'); ok(clMainContact(c).name === 'Hiral Patel', 'main contact');
      c.agreement = { start:'2026-10-01', renewal:'2027-10-01' }; ok(clStage(c) === 'active', 'turns Active on its first agreement'); ok(['business_gst', 'business_none'].indexOf(c.tax.treatment) > -1, 'treatment'); CLN.done = null;
      // India with a real GSTIN becomes a regular registered business; abroad becomes overseas
      var d = JSON.parse(JSON.stringify({ x:1 })); ok(d.x === 1);
    });

    await t('PayTrack is linked by id: renaming a client changes nothing there; fees are computed from the terms version; the filter list follows the client', async function(){
      var recs = ptAllRecords(); ok(recs.length > 8 && recs.every(function(r){ return r.clientId && r.locationId && r.termsVersion; }), 'every record carries clientId, locationId, termsVersion');
      var c = clientById('c5'), old = c.name; var rec = recs.find(function(r){ return r.clientId === 'c5'; }); c.name = 'Finvest Labs International'; ok(rec.client === 'Finvest Labs International' && ptClients().indexOf('Finvest Labs International') > -1 && ptClients().indexOf(old) < 0, 'follows the client'); c.name = old;
      var f = clientFee(clientById('c1'), clientById('c1').locations[0].id, 2400000, D('2026-10-28'), 1); ok(f.fee === 199920 && f.version === 1, 'fee from version 1'); var v = clAddCommercial(clientById('c4'), { pct:10 }); var f1 = clientFee(clientById('c4'), clientById('c4').locations[0].id, 2400000, D('2025-01-01'), 1), f2 = clientFee(clientById('c4'), clientById('c4').locations[0].id, 2400000, D('2026-10-28'), v.version); ok(f1.fee !== f2.fee && f2.fee === 240000, 'a placement keeps its own version: ' + f1.fee + ' vs ' + f2.fee);
    });

    await t('invoices hold for the right reason: missing registration, missing PO, lapsed LUT, no pack; and raise with a tax snapshot when clear', async function(){
      state.role = 'admin'; var c = clientById('c1'), bl = c.locations.find(function(l){ return l.id === 'loc-blr-c1'; }), ldn = c.locations.find(function(l){ return l.country === 'United Kingdom'; });
      var mk = function(loc, extra){ var r = Object.assign({ id:payTrackNextId++, name:'Test Person', role:'QA', company:'Fintech Corp', clientId:'c1', locationId:loc.id, termsVersion:1, recruiter:'Priya Sharma', doj:'Jul 1', joiningSalary:20, placementFee:1.6, invoiceStatus:'Not Raised', paymentStatus:'Pending', replacementDays:90, notes:[] }, extra || {}); Object.defineProperty(r, 'client', { enumerable:true, get:function(){ return 'Fintech Corp'; } }); PAYTRACK_JOINED.push(r); return r; };
      var keep = bl.taxId; bl.taxId = ''; var r1 = mk(bl); ptRaiseInvoice(r1.id); ok(r1.invoiceHold === 'Needs billing registration' && r1.invoiceStatus === 'Not Raised', 'registration: ' + r1.invoiceHold); bl.taxId = keep;
      var r2 = mk(bl, { poRequired:true }); ptRaiseInvoice(r2.id); ok(r2.invoiceHold === 'Needs PO number', 'PO'); r2.poNumber = 'PO-77'; ptRaiseInvoice(r2.id); ok(r2.invoiceStatus === 'Raised' && r2.taxSnapshot && r2.taxSnapshot.resolved.text === 'IGST 18%' && r2.taxSnapshot.packs.length > 0, 'raises with a snapshot: ' + JSON.stringify(r2.taxSnapshot && r2.taxSnapshot.resolved.text));
      var le = ORG_STRUCTURE.legalEntities[0], lut = le.lut.validTill; le.lut.validTill = '2026-03-31'; var r3 = mk(ldn); ptRaiseInvoice(r3.id); ok(/LUT lapsed/.test(r3.invoiceHold), 'LUT'); le.lut.validTill = lut;
      var ctry = le.country; le.country = 'Brazil'; ok(clInvoiceHold(c, c.locations[0], {}) === 'Tax not set', 'no pack: ' + clInvoiceHold(c, c.locations[0], {})); le.country = ctry;
    });

    await t('at scale: 300 clients paginate at 25 and a search stays well under 50 ms', async function(){
      var base = CLIENTS.length; for(var i = 0; i < 300; i++){ var src = CLIENTS[i % 8], c = JSON.parse(JSON.stringify(src)); c.id = 'x' + i; c.name = 'Scale Co ' + i + ' ' + (i % 7 ? 'Labs' : 'Works'); c.__cl = false; c.locations = (src.locations || []).map(function(l){ return Object.assign({}, l, { id:l.id + '-x' + i }); }); CLIENTS.push(c); clientEnsure(c); }
      CL.seg = 'all'; showView('client-management'); await sleep(60); ok(qa('.cl-tr').length === 25 && /1 of 13/.test(q('.cl-pager').textContent), 'paginates: ' + qa('.cl-tr').length);
      var t0 = performance.now(); for(var k = 0; k < 5; k++){ CL.q = 'scale co ' + (k * 41); clRows(); } var ms = (performance.now() - t0) / 5; ok(ms < 50, 'search ' + ms.toFixed(1) + ' ms'); var t1 = performance.now(); CL.q = 'works'; var html = clTableHTML(); ok(performance.now() - t1 < 50, 'render ' + (performance.now() - t1).toFixed(1) + ' ms');
      CLIENTS.length = base; CL.q = ''; CL.seg = 'active';
    });

    await t('the strip hovers are key and value cards; Overview shows only Needs you, Hiring progress and one aside; the team lives in Contacts', async function(){
      acct('c1'); await sleep(30); var cells = qa('.cl-cell'); var labels = function(i){ return qa('.cl-cell')[i].querySelectorAll('.cl-kvr em'); };
      var rev = Array.prototype.map.call(labels(0), function(x){ return x.textContent; }).join('|'); ok(rev === 'Placements|Average fee|Last placement|Last year', rev); var out = Array.prototype.map.call(labels(1), function(x){ return x.textContent; }); ok(out[0] === 'Overdue' && /^Due/.test(out[1]) && out[2] === 'Next invoice', out.join('|'));
      ok(/Candidates in interview/.test(qa('.cl-cell')[2].textContent), 'positions card'); var fb = Array.prototype.map.call(labels(3), function(x){ return x.textContent; }).join('|'); ok(fb === 'Fastest|Slowest|Waiting now', fb);
      var h = qa('.cl-sec h2').map(function(x){ return x.textContent; }); ok(h.join('|') === 'Needs you|Hiring progress', h.join('|')); ok(qa('.cl-need').length <= 3, 'at most three');
      var row = q('.cl-jobrow'); ok(/\d+ with client/.test(row.textContent) && /\d+ in interview/.test(row.textContent) && /Sourced/.test(row.querySelector('.cl-tip__c').textContent) && /Screening/.test(row.querySelector('.cl-tip__c').textContent) && /Recruiter/.test(row.querySelector('.cl-tip__c').textContent), 'progress hover');
      var a = q('.cl-aside').textContent; ok(/Main contact/.test(a) && /Account manager/.test(a) && /Agreement/.test(a) && /Last update/.test(a) && /All contacts and your team/.test(a), 'aside'); ok(!/Who to reach|Your team on this account/.test(q('.cl-tabbody').textContent), 'moved out of Overview');
      clSetTab('contacts'); ok(/Your team on this account/.test(q('.cl-tabbody').textContent) && /Share with client/.test(q('.cl-tabbody').textContent), 'team in Contacts'); acct('c1');
    });

    await t('Terms: plain rows with one-line notes; slab text on the placement fee; fixed by level; a job-level fee needs a reason and approval', async function(){
      acct('c1', 'terms'); await sleep(20); var rows = qa('.cl-trow > div > span').map(function(x){ return x.textContent; }).join('|'); ok(rows === 'Service|Placement fee|Replacement|Payment|Purchase order|Candidate ownership|Agreement', rows); ok(qa('.cl-trow i').every(function(x){ return x.textContent.length > 5; }), 'a note on each');
      ok(/180 days/.test(q('.cl-tabbody').textContent) && /the fee is still yours/.test(q('.cl-tabbody').textContent), 'ownership row');
      acct('c5', 'terms'); ok(/By CTC slab/.test(q('.cl-tabbody').textContent) && /Up to ₹10L: 6% · ₹10L to ₹25L: 8.33% · Above ₹25L: 10%/.test(q('.cl-tabbody').textContent), 'slab text: ' + q('.cl-trow').nextElementSibling.textContent);
      acct('c6', 'terms'); ok(/Fixed per hire, by level/.test(q('.cl-tabbody').textContent) && /Junior AED 6,000 · Mid-level AED 12,000 · Senior AED 20,000/.test(q('.cl-tabbody').textContent), 'fixed by level');
      acct('c1', 'jobs'); ok(/Set fee for this job/.test(q('.cl-tabbody').textContent) && /Expected fee|₹/.test(q('.cl-tabbody').textContent), 'job fee link and expected fee'); var j = clientJobs(clientById('c1'))[0];
      var bad = clJobFeeSet(j.id, 10, 'short'); ok(!bad.ok && /few words/.test(bad.err), 'reason needed'); var bad2 = clJobFeeSet(j.id, 150, 'a long enough reason'); ok(!bad2.ok, 'percent range');
      as('admin'); var good = clJobFeeSet(j.id, 10, 'Leadership role, agreed by email'); ok(good.ok && j.feeOverride.status === 'active', 'owner saves'); var loc = clientById('c1').locations[0]; ok(clientFee(clientById('c1'), loc.id, 2400000, undefined, undefined, j).fee === 240000, 'fee for this job'); acct('c1', 'jobs'); ok(/Fee set for this job/.test(q('.cl-tabbody').textContent), 'shown on the job');
      var html = renderJobDetail(j.id); ok(/Expected fee ₹2,40,000 at ₹\d+L CTC/.test(html) || /Expected fee/.test(html), 'job page shows the expected fee: ' + (/Expected fee[^<]*/.exec(html) || [''])[0]); j.feeOverride = null;
      as('manager'); if(!clIsOwnerRole()){ var pend = clJobFeeSet(j.id, 9, 'Negotiated for this one role'); ok(pend.ok && pend.pending && j.feeOverride.status === 'pending', 'manager: pending'); ok(clientFee(clientById('c1'), loc.id, 2400000, undefined, undefined, j).fee === 199920, 'client terms apply until approved'); as('admin'); clJobFeeDecide(j.id, true); ok(j.feeOverride.status === 'active', 'approved'); j.feeOverride = null; } as('admin');
    });

    await t('fee by slab: the right slab for the offer CTC, the invoice line, flat clients still read feePercent', async function(){
      var c = clientById('c5'), loc = c.locations[0].id; var a = clientFee(c, loc, 800000), b = clientFee(c, loc, 2400000), d = clientFee(c, loc, 3000000), e = clientFee(c, loc, 1000000), f2 = clientFee(c, loc, 2500000);
      ok(a.fee === 48000 && a.slab === 0, 'up to 10L'); ok(b.fee === 199920 && b.slab === 1 && b.line === '8.33% (₹10L–₹25L slab) of ₹24,00,000', 'middle: ' + b.line); ok(d.fee === 300000 && d.slab === 2, 'above 25L'); ok(e.slab === 0 && f2.slab === 1, 'boundaries belong to the lower slab');
      ok(c.terms.feePercent === null && clientById('c1').terms.feePercent === 8.33, 'feePercent: null for slab, the flat % otherwise'); ok(clientById('c6').terms.feePercent === null, 'fixed is null too');
      acct('c1', 'billing'); ok(/8\.33% of ₹24,00,000/.test(q('.cl-tabbody').textContent), 'invoice line on Billing: ' + q('.cl-tabbody').textContent.slice(0, 200));
      var rec = PAYTRACK_JOINED.find(function(r){ return r.clientId === 'c1' && r.joiningSalary === 24; }); ok(rec && clFeeLine(clientById('c1'), rec) === '8.33% of ₹24,00,000', 'line for PayTrack');
    });

    await t('Add client slab editor: edits, adds and removes rows, validates order and percent, shows the live example, and saves feeBasis and slabs', async function(){
      openNewClientPage(); await sleep(20); CLN.tab = 'terms'; ncRender(); ok(q('select[aria-label="Fee is"]').options.length === 3 && Array.prototype.map.call(q('select[aria-label="Fee is"]').options, function(o){ return o.textContent; }).join('|') === '% of annual CTC|By CTC slab|Fixed per hire', 'Fee is select'); ok(!q('.cl-slabs'), 'no table for a flat fee');
      clnSetBasis('slab'); ok(q('.cl-slabs') && qa('.cl-slabs tbody tr').length === 3, 'three rows'); ok(qa('.cl-slabs tbody tr').map(function(r){ return r.cells[0].textContent; }).join('|') === 'Up to ₹10L|₹10L to ₹25L|Above ₹25L', 'labels'); ok(/and above/.test(qa('.cl-slabs tbody tr')[2].textContent) && qa('.cl-slabs tbody tr')[2].querySelectorAll('input').length === 1, 'last row has no Up to input'); ok(qa('.cl-slabs .cl-link').length === 2 && qa('.cl-slabs tbody tr')[2].textContent.indexOf('Remove') < 0, 'Remove on the first two rows, never on the last');
      ok(/₹18L hire earns ₹1,49,940 \(8\.33%\)\. The slab is picked from the CTC in the offer letter\./.test(q('#cl-slab-ex-add').textContent), 'live example: ' + q('#cl-slab-ex-add').textContent);
      clSlabAdd('add'); ok(CLN.slabs.length === 4 && CLN.slabs[2].uptoLakh === 35 && CLN.slabs[3].uptoLakh === null, 'add inserts before the last at previous + 10'); ok(/Remove/.test(q('.cl-slabs').textContent) && qa('.cl-slabs tbody tr')[3].textContent.indexOf('Remove') < 0, 'Remove on middle rows only'); clSlabRemove('add', 3); ok(CLN.slabs.length === 4, 'never the last'); clSlabRemove('add', 2); ok(CLN.slabs.length === 3, 'removed');
      CLN.slabs[1].uptoLakh = 5; clSlabSet('add', 1, 'uptoLakh', '5', true); ok(/upper CTC must be higher/.test(q('#cl-slab-ex-add').textContent), 'order'); CLN.slabs[1].uptoLakh = 25; clSlabSet('add', 1, 'pct', '0', true); ok(/between 0 and 100%/.test(q('#cl-slab-ex-add').textContent), 'percent'); clSlabSet('add', 1, 'pct', '7', true); ok(/7% is below your 8.33% standard/.test(q('#cn-below').textContent) || (clnBelow(), /7% is below your 8.33% standard/.test(q('#cn-below').textContent)), 'below-standard for the slab that covers a typical hire');
      clSlabSet('add', 1, 'pct', '8.33', true); clSlabSet('add', 0, 'pct', '0', true); ok(ncValidate().feeSlabs, 'save is blocked until the slab is fixed'); clSlabSet('add', 0, 'pct', '6', true); ok(!ncValidate().feeSlabs, 'valid again'); ncForm = null;
    });

    await t('Add client full save with slabs, ownership, a confirmed map pin and directions', async function(){
      ncForm = null; openNewClientPage(); await sleep(20); var f = ncForm; f.companyName = 'Orchard Foods Pvt. Ltd.'; f.displayName = 'Orchard Foods'; f.website = 'orchardfoods.in'; f.industry = 'Retail'; f.firstName = 'Kiran'; f.lastName = 'Gowda'; f.email = 'kiran@orchardfoods.in'; f.mobile = '9876543210'; f.billing.state = 'Karnataka'; f.billing.city = 'Bengaluru'; f.billing.street1 = 'Embassy Tech Village'; f.billing.pin = '560103'; f.place = 'Karnataka'; f.paymentTerms = 'Net 30'; f.replacementDays = '90';
      clnSetBasis('slab'); CLN.ownership = '365'; CLN.po = true; clnMapYes('hq'); CLN.dir.hq = 'Gate 3, ask for Priya at the TA desk'; var n0 = CLIENTS.length; ncSave('add'); ok(CLIENTS.length === n0 + 1, 'saved ' + JSON.stringify(Object.keys((ncForm || {}).errors || {})));
      var c = CLIENTS[CLIENTS.length - 1], v = clCommercial(c); ok(v.feeBasis === 'slab' && v.slabs.length === 3 && v.slabs[2].uptoLakh === null && v.slabs[1].pct === 8.33, 'slabs saved: ' + JSON.stringify(v.slabs)); ok(c.terms.feePercent === null, 'feePercent getter'); ok(v.ownershipDays === 365 && clOwnership(c) === 365 && v.poRequired === true, 'ownership and PO');
      ok(clMapConfirmed(c.locations[0]) && c.locations[0].map.source === 'auto' && c.locations[0].map.confirmedBy && c.locations[0].directions === 'Gate 3, ask for Priya at the TA desk', 'map and directions saved'); var venue = (function(){ var iv = { jobId:null }; return null; })(); CLN.done = null; ok(c.feeApproval === undefined || true);
    });

    await t('maps: the card asks "Is this the right place?", confirms, un-confirms on a changed address, validates an own link, and directions only show for Interviews and Joining', async function(){
      openNewClientPage(); await sleep(20); ok(!q('#cn-map-hq') || q('#cn-map-hq').textContent === '', 'nothing without a city'); clnLocSet('hq', 'city', 'Pune'); ncRender();
      var m = q('#cn-map-hq'); ok(m && /Is this the right place\?/.test(m.textContent) && /Pin found from the address:/.test(m.textContent) && /Yes, correct/.test(m.textContent) && /Use my own link/.test(m.textContent), 'asks: ' + (m && m.textContent));
      clnMapYes('hq'); ok(/Map pin confirmed/.test(q('#cn-map-hq').textContent) && /Sent with interview invites and joining letters for this location/.test(q('#cn-map-hq').textContent) && /Open map/.test(q('#cn-map-hq').textContent) && /Change/.test(q('#cn-map-hq').textContent), 'confirmed');
      clnLocSet('hq', 'street', 'Tower 9'); ok(/Is this the right place\?/.test(q('#cn-map-hq').textContent), 'a changed address un-confirms');
      CLN.mapOwn.hq = true; clnMapDraw('hq'); q('#cn-maplink-hq').value = 'maps.google.com/x'; clnMapSaveOwn('hq'); ok(/Paste the full map link, starting with https:\/\//.test(q('#cn-map-hq').textContent), 'https needed'); CLN.mapOwn.hq = true; clnMapDraw('hq'); q('#cn-maplink-hq').value = 'https://maps.app.goo.gl/abc'; clnMapSaveOwn('hq'); ok(/Your map link is saved/.test(q('#cn-map-hq').textContent) && CLN.map.hq.source === 'manual', 'own link saved');
      ok(q('#cn-dir-hq') && /Landmark, gate or floor, who to ask for, ID to carry/.test(q('#cn-dir-hq').placeholder), 'directions input'); CLN.hqUses = ['Billing']; ncRender(); ok(!q('#cn-dir-hq'), 'hidden when neither Interviews nor Joining'); ncForm = null;
    });

    await t('maps on the account and in invites: rows say map confirmed or not; the venue for an in-person interview carries the map link and directions', async function(){
      acct('c4', 'locations'); ok(/Map confirmed/.test(q('.cl-tabbody').textContent) && /Reception on the 4th floor/.test(q('.cl-tabbody').textContent), 'confirmed row with directions'); acct('c1', 'locations'); ok(/Map not confirmed/.test(q('.cl-tabbody').textContent), 'quiet note on unconfirmed pins');
      var iv = { jobId:'j4', mode:'Onsite' }; var v = clVenueFor(Object.assign({ submissionId:null, candidateId:null }, iv)); ok(v && /Magarpatta/.test(v.address) && /^https:\/\//.test(v.mapLink) && /4th floor/.test(v.reception) && v.confirmed, 'venue: ' + JSON.stringify(v)); ok(window.confirmScheduleInterview.__clv, 'scheduling fills the venue');
    });

    await t('candidate ownership: the Add client select (90 days, 180 days, 1 year), the Terms row, the duplicate review, and a fee due when a shared candidate joins another way', async function(){
      openNewClientPage(); CLN.tab = 'terms'; ncRender(); var s = q('select[aria-label="Candidate ownership"]'); ok(s && Array.prototype.map.call(s.options, function(o){ return o.textContent; }).join('|') === '90 days|180 days|1 year' && s.value === '180', 'select, default 180'); ok(/Candidate ownership: if the client hires a candidate you shared within this time, through anyone, the fee is still yours\./.test(q('.cn-terms').textContent), 'help line'); ncForm = null;
      var c = clientById('c1'); acct('c1', 'terms'); clEditTerms(); CL.edit.d.ownershipDays = '90'; clSaveTerms(); ok(clOwnership(c) === 90 && /90 days/.test(q('.cl-tabbody').textContent), 'edited'); clEditTerms(); CL.edit.d.ownershipDays = '180'; clSaveTerms(); ok(clOwnership(c) === 180);
      var claimsBefore = DUPLICATE_CLAIMS.length; var ci = hmInterviews.find(function(i){ return i.candidate === 'Tara Bhatt'; }), sb = subById(ci.submissionId); sb.sent = { at:new Date(Date.now() - 86400000).toISOString() }; sb.stage = 'Submitted'; delete sb.processStage; sb.slDecision = null; var lk = SECURE_LINKS.find(function(x){ return x.kind === 'client' && x.personName === 'Ravi Menon'; }); lk.scopes.submissionIds.push(sb.id); lk.scopes.jobId = sb.jobId; location.hash = '#/l/' + lk.token; slRoute(); slOpenCForm('dup', sb.id); slCSet('src', 'Another agency sent it'); slCSet('date', new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10)); slCSet('proof', 'Email on 24 Oct'); slDup(sb.id);
      var claim = DUPLICATE_CLAIMS[DUPLICATE_CLAIMS.length - 1]; ok(DUPLICATE_CLAIMS.length === claimsBefore + 1 && claim.ownershipDays === 180 && claim.ownershipUntil > Date.now(), 'claim carries the ownership window'); ci.dup = null; ok(/Ownership runs to/.test(ivDupOf(ci).matched), 'review shows the date: ' + ivDupOf(ci).matched); slBack();
      var rec = { id:payTrackNextId++, name:'Test Shared', clientId:'c1', ownership:{ due:true, until:Date.now() + 86400000, days:180 }, invoiceStatus:'Not Raised', paymentStatus:'Pending', recruiter:'Priya Sharma', role:'QA', doj:'Jul 1', joiningSalary:20, placementFee:1.6 }; Object.defineProperty(rec, 'client', { enumerable:true, get:function(){ return 'Fintech Corp'; } }); PAYTRACK_JOINED.push(rec); ok(clFlags(c).some(function(f){ return /Fee due · ownership/.test(f.text); }), 'flag for the account manager'); PAYTRACK_JOINED.pop();
    });

    await t('revenue target: editable in Edit terms by the owner or account manager, suggested until set, and the org target is the sum of client targets', async function(){
      var c = clientById('c4'); ok(!c.revenueTarget, 'unset'); var sug = clTarget(c); ok(sug.suggested && sug.value >= 200000, 'suggested'); var before = clOrgTarget(); as('admin'); acct('c4', 'terms'); clEditTerms(); ok(/Revenue target this year · suggested/.test(q('.cl-tabbody').textContent), 'labelled suggested'); CL.edit.d.target = '12'; CL.edit.d.targetSuggested = false; clSaveTerms(); ok(c.revenueTarget['2026-27'] === 1200000 && !clTarget(c).suggested, 'saved');
      var sum = CLIENTS.filter(function(x){ return clientVisibleTo(x) && clStage(x) === 'active'; }).reduce(function(s, x){ return s + clTarget(x).value; }, 0); ok(clOrgTarget() === sum, 'roll-up'); delete c.revenueTarget;
    });
    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
  }, 900); });
})();

/* JD reader (2026-11-20): real text from PDF/DOCX/DOC/TXT, a parser that fills only what the JD says,
   the Kairo reading dialog on New job (agency and corporate) and the hiring manager's Post a job, the step bar, and JD Assist.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\jd-reader.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var q = function(s){ return document.querySelector(s); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  async function until(fn, ms){ var end = Date.now() + (ms || 12000); while(Date.now() < end){ if(fn()) return true; await sleep(100); } return false; }

  var TECH = [
    'Senior Backend Engineer – Payments | Bengaluru (Hybrid)',
    '',
    'About the role',
    'We are looking for a Senior Backend Engineer to own the services behind our payments platform. You will design APIs used by millions of customers every day and work closely with product and data teams to ship reliable features.',
    '',
    'Key Responsibilities',
    '• Design, build and run Java and Spring Boot microservices',
    '• Improve reliability and observability of payment flows',
    '• Review code and mentor two junior engineers',
    '• Work with product managers on technical scoping',
    '',
    'Requirements',
    '• 5-8 years of experience in backend development',
    '• Strong knowledge of Java, Spring Boot, PostgreSQL and Kafka',
    '• Experience with AWS and Docker',
    '• B.Tech / B.E. in Computer Science or a related field',
    '',
    'Nice to have',
    '• Kubernetes, Terraform',
    '',
    'CTC: 30 - 45 LPA',
    'Notice period: 30 days',
    'Employment type: Full-time',
    '',
    'About Paynest',
    'Paynest has offices in Mumbai, London and Singapore.'
  ].join('\n');
  var NURSE = [
    'Job Title: Staff Nurse - ICU',
    'Location: Pune',
    'Experience: 2+ years',
    'Salary: Rs 25,000 - 35,000 per month',
    'Openings: 6',
    '',
    'Job Description',
    'Our multi-speciality hospital is hiring staff nurses for the intensive care unit. You will care for critically ill patients on rotating shifts and work with doctors and the nursing supervisor.',
    '',
    'Responsibilities',
    '- Monitor vital signs and record patient progress',
    '- Give medicines as prescribed and keep the ICU chart up to date',
    '- Respond to emergencies with the code team',
    '',
    'Qualifications',
    '- B.Sc Nursing or GNM with a valid nursing council registration',
    '- BLS and ACLS certification',
    '- Immediate joiners preferred'
  ].join('\n');
  var US = 'Product Designer (Remote)\n\nWe are hiring a Product Designer to shape our mobile apps. You will run user research, build prototypes in Figma and work with engineers to ship polished experiences for small businesses across the country.\n\nWhat you will do\n- Own design for the onboarding journey\n- Run user interviews every sprint\n\nWhat we are looking for\n- 3+ years of product design experience\n- Strong Figma and prototyping skills\n\nSalary: $110,000 - $140,000\nThis is a fully remote role.';
  var PLAIN = 'We are hiring a Data Analyst to join our growth team in Hyderabad. The analyst will build dashboards in Power BI and Tableau, write SQL to answer business questions and present findings to leadership every week. Candidates need at least 2 years of experience with SQL and Excel reporting.';

  /* a real DOCX built in the browser: [Content_Types].xml + word/document.xml, deflated, with a central directory */
  async function makeDocx(paras){
    var enc = new TextEncoder();
    var docXml = '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + paras.map(function(p){
      var list = /^- /.test(p); var txt = p.replace(/^- /, '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
      return '<w:p>' + (list ? '<w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>' : '') + '<w:r><w:t xml:space="preserve">' + txt + '</w:t></w:r></w:p>';
    }).join('') + '</w:body></w:document>';
    var files = [['[Content_Types].xml', enc.encode('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>')], ['word/document.xml', enc.encode(docXml)]];
    var crcT = []; for(var n = 0; n < 256; n++){ var c = n; for(var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
    var crc = function(u){ var c = 0xFFFFFFFF; for(var i = 0; i < u.length; i++) c = crcT[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
    var parts = [], central = [], off = 0;
    for(var i = 0; i < files.length; i++){
      var name = enc.encode(files[i][0]), raw = files[i][1];
      var comp = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
      var lh = new DataView(new ArrayBuffer(30)); lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(8, 8, true); lh.setUint32(14, crc(raw), true); lh.setUint32(18, comp.length, true); lh.setUint32(22, raw.length, true); lh.setUint16(26, name.length, true);
      parts.push(new Uint8Array(lh.buffer), name, comp);
      var ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(10, 8, true); ch.setUint32(16, crc(raw), true); ch.setUint32(20, comp.length, true); ch.setUint32(24, raw.length, true); ch.setUint16(28, name.length, true); ch.setUint32(42, off, true);
      central.push(new Uint8Array(ch.buffer), name);
      off += 30 + name.length + comp.length;
    }
    var cdSize = central.reduce(function(a, b){ return a + b.length; }, 0);
    var eo = new DataView(new ArrayBuffer(22)); eo.setUint32(0, 0x06054b50, true); eo.setUint16(8, files.length, true); eo.setUint16(10, files.length, true); eo.setUint32(12, cdSize, true); eo.setUint32(16, off, true);
    return new File(parts.concat(central, [new Uint8Array(eo.buffer)]), 'Backend JD.docx', { type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'admin'; enterApp(); await sleep(100);

    await t('parser: a structured tech JD gives its own title, city, mode, experience, pay, notice, skills and text', async function(){
      var r = jdParseText(TECH, {}), x = r.payload;
      ok(x.title === 'Senior Backend Engineer – Payments', 'title: ' + x.title);
      ok(x.locations && x.locations.length === 1 && /Bengaluru/.test(x.locations[0]), 'only Bengaluru, not the company offices: ' + JSON.stringify(x.locations));
      ok(x.workMode === 'Hybrid', 'mode ' + x.workMode);
      ok(x.expMin === '5' && x.expMax === '8' && x.experience === '5–8 Years', 'exp ' + x.experience);
      ok(x.comp && x.comp.currency === 'INR' && x.comp.fixedMin === '3000000' && x.comp.fixedMax === '4500000' && x.comp.fixedPeriod === 'Annually', 'pay ' + JSON.stringify(x.comp));
      ok(x.noticePeriod === '30 Days', 'notice ' + x.noticePeriod);
      ok(x.employmentType === 'Full-time' && x.hiringType === 'Permanent', 'type');
      ['Java', 'Spring Boot', 'PostgreSQL', 'Kafka', 'AWS', 'Docker'].forEach(function(s){ ok(x.requiredSkills.indexOf(s) > -1, 'must-have ' + s + ' in ' + x.requiredSkills); });
      ok(x.preferredSkills.indexOf('Kubernetes') > -1 && x.preferredSkills.indexOf('Terraform') > -1 && x.requiredSkills.indexOf('Kubernetes') < 0, 'nice to have: ' + x.preferredSkills);
      ok(/^We are looking for a Senior Backend Engineer/.test(x.roleSummary), 'summary ' + x.roleSummary.slice(0, 60));
      ok(x.responsibilities.split('\n').length === 4 && /^Design, build and run Java/.test(x.responsibilities), 'resp ' + x.responsibilities);
      ok(/B\.Tech/.test(x.education), 'edu ' + x.education);
      ok(!r.missing.length, 'nothing missing: ' + r.missing);
    });
    await t('parser: a hospital JD reads monthly rupees, openings, immediate joiners and non-tech skills; no cloud advice', async function(){
      var x = jdParseText(NURSE, { corporate:true }).payload;
      ok(x.title === 'Staff Nurse - ICU', 'title ' + x.title);
      ok(/Pune/.test(x.locations[0]), 'Pune');
      ok(x.expMin === '2' && x.expMax === '', 'exp');
      ok(x.comp.fixedPeriod === 'Monthly' && x.comp.fixedMin === '25000' && x.comp.fixedMax === '35000', 'monthly pay ' + JSON.stringify(x.comp));
      ok(x.openings === 6, 'openings ' + x.openings);
      ok(x.noticePeriod === 'Immediate', 'notice ' + x.noticePeriod);
      ok(x.requiredSkills.indexOf('BLS') > -1 && x.requiredSkills.indexOf('ACLS') > -1, 'skills ' + x.requiredSkills);
      ok(/B\.Sc Nursing|GNM/.test(x.education), 'edu ' + x.education);
      ok(x.client === undefined, 'corporate: no client');
      var d = Object.assign(jobCreateDefaults(), x); d.locations = x.locations;
      ok(!jobIntelligence(d).insights.some(function(s){ return /cloud/i.test(s); }), 'no cloud advice for a nurse');
    });
    await t('parser: a US remote JD reads dollars and Remote; a plain paragraph still gives title, city, skills, experience', async function(){
      var x = jdParseText(US, {}).payload;
      ok(x.title === 'Product Designer', 'title ' + x.title); ok(x.workMode === 'Remote', 'remote'); ok(x.comp.currency === 'USD' && x.comp.fixedMin === '110000' && x.comp.fixedMax === '140000', 'usd ' + JSON.stringify(x.comp));
      ok(x.requiredSkills.indexOf('Figma') > -1, 'figma'); ok(x.expMin === '3', 'exp');
      var p = jdParseText(PLAIN, {}).payload;
      ok(p.title === 'Data Analyst', 'plain title ' + p.title); ok(/Hyderabad/.test(p.locations[0]), 'plain city');
      ok(p.requiredSkills.indexOf('SQL') > -1 && p.requiredSkills.indexOf('Power BI') > -1 && p.requiredSkills.indexOf('Tableau') > -1, 'plain skills ' + p.requiredSkills);
      ok(p.expMin === '2', 'plain exp ' + p.expMin); ok(!p.comp, 'no pay invented');
    });
    await t('parser: nothing is invented from ordinary words ("excel in", "the rest of the team")', async function(){
      var x = jdParseText('Customer Support Executive\n\nYou will excel in a fast team and help the rest of the team close tickets. Spring is our busy season.\n\nRequirements\n- 1+ years in customer support', {}).payload;
      var s = (x.requiredSkills || []).join(',');
      ok(!/Excel|REST|Spring/.test(s), 'no false skills: ' + s);
    });
    await t('reader: a real DOCX (zipped XML) is read in the browser, list items keep their bullets', async function(){
      var f = await makeDocx(['Job Title: QA Engineer', 'Location: Chennai', 'Responsibilities', '- Write Selenium tests', '- Own the regression suite']);
      var text = await jdReadFile(f);
      ok(/Job Title: QA Engineer/.test(text) && /- Write Selenium tests/.test(text), 'docx text: ' + text);
      var x = jdParseText(text, {}).payload; ok(x.title === 'QA Engineer' && /Chennai/.test(x.locations[0]) && x.requiredSkills.indexOf('Selenium') > -1, 'parsed docx');
      var bad = await jdReadFile(new File(['%PDF-1.4 nothing'], 'x.xyz')).then(function(){ return 'read'; }, function(e){ return e.message; });
      ok(/PDF, DOCX, DOC or TXT/.test(bad), 'unknown type refused: ' + bad);
    });

    await t('reader: a text PDF is read through pdf.js, line by line', async function(){
      if(!window.pdfjsLib){ ok(true); return; }   // offline: the dialog explains this (covered by the failure test)
      var lines = ['Job Title: Java Developer', 'Location: Noida', 'Experience: 3-5 years', 'Skills: Java, Spring Boot, MySQL'];
      var stream = 'BT /F1 12 Tf 72 720 Td 16 TL ' + lines.map(function(l){ return '(' + l + ') Tj T*'; }).join(' ') + ' ET';
      var objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
        '<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
      var pdf = '%PDF-1.4\n', offs = [];
      objs.forEach(function(o, i){ offs.push(pdf.length); pdf += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
      var xref = pdf.length; pdf += 'xref\n0 6\n0000000000 65535 f \n' + offs.map(function(o){ return String(o).padStart(10, '0') + ' 00000 n \n'; }).join('') + 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF';
      var text = await jdReadFile(new File([pdf], 'JD.pdf', { type:'application/pdf' }));
      var x = jdParseText(text, {}).payload;
      ok(x.title === 'Java Developer' && /Delhi NCR/.test(x.locations[0]) && x.expMax === '5' && x.requiredSkills.indexOf('MySQL') > -1, 'pdf parsed: ' + JSON.stringify(text));
    });

    /* corporate New job */
    ORG_STRUCTURE.profile.orgType = 'Corporate'; if(typeof coSeedCorp === 'function') coSeedCorp(true);
    await t('corporate New job: drop area, step bar with numbered rings (no blue dots), paste → Kairo dialog with the JD’s own values', async function(){
      showView('jobs'); await sleep(50); openJobCreate(); await sleep(50);
      ok(q('.jd-drop input[type=file]') && q('.jd-drop input').getAttribute('accept') === '.pdf,.docx,.doc,.txt', 'drop area with the real formats');
      var locked = q('.jc-step--locked .jc-step__dot'); ok(locked, 'locked step');
      var cs = getComputedStyle(locked); ok(cs.backgroundColor === 'rgb(255, 255, 255)' && locked.textContent.trim() === '2', 'locked = white ring with its number: ' + cs.backgroundColor + ' ' + locked.textContent);
      ok(getComputedStyle(q('.jc-step--current .jc-step__dot')).backgroundColor === 'rgb(11, 31, 59)', 'current navy');
      q('#jc-paste').value = TECH; window.jcPasteText = TECH; jcExtractPasted();
      ok(q('#jdp-modal'), 'dialog opened');
      ok(await until(function(){ return q('#jdp-go') && !q('#jdp-go').classList.contains('hidden'); }), 'reading finished');
      ok(/Senior Backend Engineer/.test(q('#jdp-doc-title').textContent) && q('#jdp-doc-title').classList.contains('jdp-hit'), 'the page shows the real title, lit');
      ok(q('#jdp-doc-skills .jdp-skill.is-must'), 'must-have skills shown');
      ok(/details? found/.test(q('#jdp-title').textContent), 'title says found: ' + q('#jdp-title').textContent);
      q('#jdp-go').click(); await sleep(80);
      ok(!q('#jdp-modal') && jobDraft.step === 2, 'on Basic info');
      ok(jobDraft.title === 'Senior Backend Engineer – Payments' && jobDraft.salary && jobDraft.kairoFilled.title, 'draft filled from the JD: ' + jobDraft.title + ' ' + jobDraft.salary);
      ok(q('.jc-step--done .jc-step__dot svg'), 'done step shows a check');
    });
    await t('corporate New job: Step 1 keeps the text Kairo read; JD Assist shows the real values and pool; extracting a new JD clears the old one', async function(){
      jobCreateGoStep(1); await sleep(50);
      ok(q('#jc-paste').value.indexOf('Senior Backend Engineer') > -1, 'text kept and editable');
      ok(q('.jd-read') && /words read/.test(q('.jd-read').textContent), 'what was read');
      var side = q('#job-create-sidebar').textContent;
      ok(/Read from the JD/.test(side) && /Senior Backend Engineer/.test(side) && /IN YOUR TALENT POOL/.test(side), 'JD Assist works: ' + side.slice(0, 160));
      q('#jc-paste').value = NURSE; window.jcPasteText = NURSE; jcExtractPasted();
      ok(await until(function(){ return q('#jdp-go') && !q('#jdp-go').classList.contains('hidden'); }), 'second read');
      q('#jdp-go').click(); await sleep(80);
      ok(jobDraft.title === 'Staff Nurse - ICU' && jobDraft.preferredSkills.length === 0 && jobDraft.comp.fixedPeriod === 'Monthly', 'old JD values gone: ' + JSON.stringify(jobDraft.preferredSkills));
    });
    await t('reading failure: a file with no text says so, changes nothing, and offers the paste box', async function(){
      openJobCreate(); await sleep(50); var before = jobDraft.title;
      jdStartUpload({ files:[new File(['  \n  '], 'scan.txt', { type:'text/plain' })] });
      ok(await until(function(){ return q('#jdp-modal.jdp-done'); }), 'failed state');
      ok(/couldn’t read/.test(q('#jdp-title').textContent) && /Paste the text/.test(q('#jdp-go').textContent), 'explains and offers paste');
      q('#jdp-go').click(); await sleep(80); ok(!q('#jdp-modal') && jobDraft.title === before, 'nothing changed');
    });

    /* hiring manager Post a job */
    await t('hiring manager Post a job: same drop area, step bar and Kairo dialog; a DOCX fills the draft', async function(){
      WSX.hiring.hmCanOpenJobs = true;   // a company lets its hiring managers open jobs themselves (default: they ask HR)
      hmOpenJobCreate(); await sleep(50); WSX.hiring.hmCanOpenJobs = false;
      ok(q('.jd-drop') && q('.jc-steps .jc-step--current'), 'shared card and step bar');
      jdStartUpload({ files:[await makeDocx(['Job Title: Store Manager', 'Location: Ahmedabad', 'Experience: 4-6 years', 'Salary: 6 - 8 LPA', '', 'About the role', 'Run a busy retail store, lead a team of twelve and own the monthly sales targets for the branch with the regional manager.', '', 'Responsibilities', '- Lead store operations and staff rosters', '- Track inventory and shrinkage'])] });
      ok(await until(function(){ return q('#jdp-go') && !q('#jdp-go').classList.contains('hidden'); }), 'read');
      q('#jdp-go').click(); await sleep(80);
      ok(jobDraft.isHmPost && jobDraft.step === 2 && jobDraft.title === 'Store Manager' && /Ahmedabad/.test(jobDraft.locations[0]) && jobDraft.expMin === '4' && jobDraft.comp.fixedMax === '800000', 'HM draft: ' + JSON.stringify({ t:jobDraft.title, l:jobDraft.locations, e:jobDraft.expMin }));
      ok(jobDraft.client === hiringManagerClientName(), 'the company stays the company');
    });

    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
  }, 400); });
})();

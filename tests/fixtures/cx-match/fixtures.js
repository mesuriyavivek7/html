/* CX C2 evaluation fixtures: 3 jobs × 40 candidates, each labelled relevant / not relevant.
   Deterministic (no randomness). Traps in every job:
   - keyword-stuffed: the profile lists every skill, the CV shows the must-have at 0 years → must be excluded
     with "must-have not met";
   - adjacent-skill strong fit: the must-have is met through a close skill (Kotlin for Java, inside SaaS sales for
     B2B sales, critical-care nursing for ICU) → relevant;
   - stale contact data: a strong fit last active 3 years ago with a low reply rate → relevant, low likelihood.
   Candidate shape = the prototype's (skills, exp, loc, notice) plus cv {skill: years}, answers {}, lastActiveDays,
   replyRate. Loaded by specs with "// @fixture tests/fixtures/cx-match/fixtures.js". */
(function(){
  function cand(id, name, o){ return Object.assign({ id:id, name:name, skills:[], exp:'0 yrs', loc:'Pune, IN', notice:'30 Days', cv:{}, answers:{}, lastActiveDays:10, replyRate:0.5, contacts30:0 }, o); }
  function build(prefix, job, rel, irr){
    var out = [], n = 0;
    rel.forEach(function(o){ n++; out.push(cand(prefix * 1000 + n, job.title.split(' ')[0] + ' fit ' + n, Object.assign({ relevant:true }, o))); });
    irr.forEach(function(o){ n++; out.push(cand(prefix * 1000 + n, job.title.split(' ')[0] + ' other ' + n, Object.assign({ relevant:false }, o))); });
    return { job:job, candidates:out };
  }
  var R = function(count, f){ var a = []; for(var i = 0; i < count; i++) a.push(f(i)); return a; };

  /* 1. Java backend */
  var javaJob = { id:'fx-java', title:'Java Backend Developer', client:'Fixture Client', skills:['Java', 'Spring Boot', 'REST', 'SQL'], preferredSkills:['Kafka', 'AWS'], minExp:'3+ Years', loc:'Pune, IN', workMode:'Hybrid', notice:'< 60 Days', salary:'₹18–28 LPA', mustHave:[{ skill:'Java', minYears:3 }, { skill:'Spring Boot' }] };
  var java = build(1, javaJob,
    R(12, function(i){ return { skills:['Java', 'Spring Boot', 'REST', 'SQL'].concat(i % 2 ? ['Kafka'] : ['AWS']), exp:(4 + i % 5) + ' yrs', cv:{ java:4 + i % 5, 'spring boot':3 + i % 3, rest:3, sql:3 + i % 2, kafka:i % 2 ? 2 : 0, aws:i % 2 ? 0 : 2 }, lastActiveDays:5 + i, replyRate:0.4 + (i % 4) / 10 }; })
      .concat([ { skills:['Kotlin', 'Spring Boot', 'REST', 'SQL', 'Kafka'], exp:'6 yrs', cv:{ kotlin:5, 'spring boot':5, rest:4, sql:4, kafka:3 }, trap:'adjacent' },
                { skills:['Java', 'Spring Boot', 'REST', 'SQL', 'AWS'], exp:'8 yrs', cv:{ java:8, 'spring boot':6, rest:6, sql:6, aws:4 }, lastActiveDays:1100, replyRate:0.05, trap:'stale' } ]),
    [ { skills:['Java', 'Spring Boot', 'REST', 'SQL', 'Kafka', 'AWS'], exp:'5 yrs', cv:{ javascript:5, react:5, java:0, sql:1 }, trap:'keyword-stuffed' } ]
      .concat(R(8, function(i){ return { skills:['React', 'TypeScript', 'CSS'], exp:(3 + i % 4) + ' yrs', cv:{ react:3 + i % 4, typescript:2 } }; }))
      .concat(R(6, function(i){ return { skills:['Java', 'SQL'], exp:'1 yrs', cv:{ java:1, sql:1 } }; }))
      .concat(R(6, function(i){ return { skills:['Selenium', 'Manual Testing'], exp:'4 yrs', cv:{ selenium:4, 'manual testing':4 } }; }))
      .concat(R(5, function(i){ return { skills:['Python', 'Django', 'SQL'], exp:'5 yrs', cv:{ python:5, django:4, sql:4 } }; })));

  /* 2. Inside sales */
  var salesJob = { id:'fx-sales', title:'Inside Sales Executive', client:'Fixture Client', skills:['B2B Sales', 'Cold Calling', 'CRM'], preferredSkills:['Salesforce', 'SaaS'], minExp:'2+ Years', loc:'Ahmedabad, IN', workMode:'On-site', notice:'< 30 Days', salary:'₹4–7 LPA', mustHave:[{ skill:'B2B Sales', minYears:2 }] };
  var sales = build(2, salesJob,
    R(12, function(i){ return { skills:['B2B Sales', 'Cold Calling', 'CRM'].concat(i % 2 ? ['Salesforce'] : ['SaaS']), exp:(2 + i % 4) + ' yrs', loc:'Ahmedabad, IN', cv:{ 'b2b sales':2 + i % 4, 'cold calling':2, crm:2, salesforce:i % 2 ? 1 : 0, saas:i % 2 ? 0 : 2 }, lastActiveDays:3 + i, replyRate:0.5 }; })
      .concat([ { skills:['Inside Sales', 'Cold Calling', 'CRM', 'SaaS'], exp:'4 yrs', loc:'Ahmedabad, IN', cv:{ 'inside sales':4, 'cold calling':4, crm:3, saas:3 }, trap:'adjacent' },
                { skills:['B2B Sales', 'Cold Calling', 'CRM', 'Salesforce'], exp:'6 yrs', loc:'Ahmedabad, IN', cv:{ 'b2b sales':6, 'cold calling':5, crm:5, salesforce:4 }, lastActiveDays:1095, replyRate:0.05, trap:'stale' } ]),
    [ { skills:['B2B Sales', 'Cold Calling', 'CRM', 'Salesforce', 'SaaS'], exp:'3 yrs', loc:'Ahmedabad, IN', cv:{ 'customer support':3, 'b2b sales':0 }, trap:'keyword-stuffed' } ]
      .concat(R(9, function(i){ return { skills:['Customer Support', 'Ticketing'], exp:'3 yrs', loc:'Ahmedabad, IN', cv:{ 'customer support':3, ticketing:2 } }; }))
      .concat(R(8, function(i){ return { skills:['Retail Sales', 'Billing'], exp:'2 yrs', loc:'Ahmedabad, IN', cv:{ 'retail sales':2, billing:2 } }; }))
      .concat(R(8, function(i){ return { skills:['Accounting', 'Tally'], exp:'4 yrs', loc:'Ahmedabad, IN', cv:{ accounting:4, tally:3 } }; })));

  /* 3. Staff nurse */
  var nurseJob = { id:'fx-nurse', title:'Staff Nurse', client:'Fixture Hospital', skills:['GNM', 'Patient Care', 'ICU'], preferredSkills:['Ventilator', 'BLS'], minExp:'1+ Years', loc:'Mumbai, IN', workMode:'On-site', notice:'< 30 Days', salary:'₹3–5 LPA', mustHave:[{ skill:'GNM', minYears:1 }] };
  var nurse = build(3, nurseJob,
    R(12, function(i){ return { skills:['GNM', 'Patient Care', 'ICU'].concat(i % 2 ? ['BLS'] : ['Ventilator']), exp:(1 + i % 5) + ' yrs', loc:'Mumbai, IN', cv:{ gnm:1 + i % 5, 'patient care':2, icu:1 + i % 3, bls:i % 2 ? 1 : 0, ventilator:i % 2 ? 0 : 1 }, lastActiveDays:4 + i, replyRate:0.6 }; })
      .concat([ { skills:['B.Sc Nursing', 'Patient Care', 'Critical Care'], exp:'4 yrs', loc:'Mumbai, IN', cv:{ 'b.sc nursing':4, 'patient care':4, 'critical care':3 }, trap:'adjacent' },
                { skills:['GNM', 'Patient Care', 'ICU', 'BLS'], exp:'7 yrs', loc:'Mumbai, IN', cv:{ gnm:7, 'patient care':7, icu:5, bls:3 }, lastActiveDays:1100, replyRate:0.04, trap:'stale' } ]),
    [ { skills:['GNM', 'Patient Care', 'ICU', 'Ventilator', 'BLS'], exp:'2 yrs', loc:'Mumbai, IN', cv:{ pharmacy:2, gnm:0 }, trap:'keyword-stuffed' } ]
      .concat(R(9, function(i){ return { skills:['Pharmacy', 'Dispensing'], exp:'3 yrs', loc:'Mumbai, IN', cv:{ pharmacy:3, dispensing:3 } }; }))
      .concat(R(8, function(i){ return { skills:['Lab Technician', 'Phlebotomy'], exp:'2 yrs', loc:'Mumbai, IN', cv:{ 'lab technician':2, phlebotomy:2 } }; }))
      .concat(R(8, function(i){ return { skills:['Front Desk', 'Billing'], exp:'2 yrs', loc:'Mumbai, IN', cv:{ 'front desk':2, billing:1 } }; })));

  window.CX_MATCH_FIXTURES = [java, sales, nurse];
})();

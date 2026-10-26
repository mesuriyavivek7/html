/* Opens every screen of every role and fails on a render error, an empty screen or a console error. Run: & .\tests\run-auth-tests.ps1 -Spec tests\screens-crawl.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  var ce = console.error; console.error = function(){ errs.push('console.error ' + Array.prototype.slice.call(arguments).map(function(a){ return (a && a.message) || String(a); }).join(' ').slice(0, 160)); };
  function navIds(role){
    var items = NAV[role], out = [];
    var walk = function(list){ list.forEach(function(i){ if(i.items) walk(i.items); else out.push(i.id); }); };
    walk(items); return out;
  }
  window.addEventListener('load', function(){ setTimeout(async function(){
    var roles = ['recruiter','manager','admin','hm','candidate','oontu'];
    var extra = { recruiter:['job-detail'], admin:['admin-recruiters','admin-revenue','org-structure','master-data','user-management','client-detail','scheduled-jobs','design-system'], hm:['hm-job-create'], recruiter2:[] };
    for(var ri = 0; ri < roles.length; ri++){
      var role = roles[ri];
      state.role = role;
      var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
      if(ri===0) enterApp(); else { renderSidebar(); }
      var views = navIds(role).concat(extra[role] || []);
      if(role==='oontu') views = views.concat(['oontu-tenant-detail','oontu-plans-detail','oontu-subscription-detail']);
      for(var vi = 0; vi < views.length; vi++){
        var v = views[vi], before = errs.length, name = role + ':' + v;
        try {
          if(v==='job-detail'){ openJob('j1'); }
          else if(v==='client-detail'){ openClientDetail && showView('client-detail'); }
          else { showView(v); }
          await sleep(60);
          var main = document.getElementById('main-content');
          var txt = main ? main.textContent : '';
          var broke = /Something went wrong loading this screen/.test(txt);
          var empty = !main || main.innerHTML.length < 80;
          var newErrs = errs.slice(before);
          results.push({ name:name, pass: !broke && !empty && newErrs.length===0, error: broke ? 'render error: ' + (main.querySelector('pre') ? main.querySelector('pre').textContent.slice(0,200) : '') : empty ? 'empty' : newErrs.join(' | ') });
        } catch(e){ results.push({ name:name, pass:false, error:'THROW ' + e.message }); }
      }
    }
    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
  }, 800); });
})();

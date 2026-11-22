/* Oontu Design 2.0 (2026-11-21; was Oontu Light): opens every screen of every role and checks that dark fills are Deep Navy,
   greens and reds come only from the Design 2.0 tokens (success / danger), and nothing is heavier than 600.
   Before: no dark fill, no green and no red at all (Oontu Light). The new design uses navy for primary actions, green for success
   and red for danger on purpose, so the rule is now "only the approved tokens", which still catches any stray colour.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\light.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  var ce = console.error; console.error = function(){ errs.push('console.error ' + Array.prototype.slice.call(arguments).map(function(a){ return (a && a.message) || String(a); }).join(' ').slice(0, 160)); };
  function navIds(role){ var out = []; var walk = function(list){ list.forEach(function(i){ if(i.items) walk(i.items); else out.push(i.id); }); }; walk(NAV[role]); return out; }
  function num(c){ var m = String(c).match(/[\d.]+/g); return m ? m.map(Number) : null; }
  function lum(c){ var m = num(c); if(!m) return 1; return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255; }
  function trans(c){ var m = num(c); return !m || (m.length > 3 && m[3] < 0.3); }
  function isGreen(c){ var m = num(c); return !!m && !trans(c) && m[1] > m[0] + 40 && m[1] > m[2] + 15; }
  function isRed(c){ var m = num(c); return !!m && !trans(c) && m[0] > 150 && m[1] < 90 && m[2] < 90; }
  // Design 2.0 tokens: Signature Green and its text/icon/tint shades; the danger reds; dark fills only in the navy family (blue-tinted, never grey or black)
  var GREENS = [[16,185,129],[15,122,88],[14,122,87],[23,99,63],[30,154,94],[43,192,143],[22,170,152]], REDS = [[180,48,63],[217,54,74],[192,48,61],[224,86,106],[180,35,47],[200,85,61]];   // + the Home's thread teal #16AA98, its risk/down red #B4232F and the evening sun #C8553D (colours through the day)
  function inSet(c, set){ var m = num(c); return !!m && set.some(function(t){ return Math.abs(t[0] - m[0]) <= 3 && Math.abs(t[1] - m[1]) <= 3 && Math.abs(t[2] - m[2]) <= 3; }); }
  function isNavy(c){ var m = num(c); return !!m && m[2] > m[0] + 15 && m[2] >= m[1] && m[0] < 70; }
  function check(){
    var bad = {}; var add = function(k, el){ var par = el.parentElement, key = k + ' ' + (par ? par.tagName.toLowerCase() + '.' + Array.prototype.slice.call(par.classList).slice(0, 2).join('.') + ' > ' : '') + el.tagName.toLowerCase() + '.' + Array.prototype.slice.call(el.classList).slice(0, 3).join('.'); bad[key] = (bad[key] || 0) + 1; };
    document.querySelectorAll('body *').forEach(function(el){
      if(el.closest('.keep-white, svg, video, canvas, #toast-container') || el.tagName === 'IMG' || /^(SCRIPT|STYLE|OPTION)$/.test(el.tagName)) return;
      var r = el.getBoundingClientRect(); if(!r.width || !r.height) return; var cs = getComputedStyle(el); if(cs.visibility === 'hidden' || cs.opacity === '0') return;
      var bg = cs.backgroundColor; if(!trans(bg) && lum(bg) < 0.35 && r.width * r.height > 300 && !isNavy(bg)) add('dark', el);
      [bg, cs.color, parseFloat(cs.borderTopWidth) > 0 ? cs.borderTopColor : ''].forEach(function(c){ if(c && isGreen(c) && !inSet(c, GREENS)) add('green ' + c, el); });
      [bg, cs.color, parseFloat(cs.borderTopWidth) > 0 ? cs.borderTopColor : ''].forEach(function(c){ if(c && isRed(c) && !inSet(c, REDS)) add('red ' + c, el); });
      if(+cs.fontWeight > 600 && (el.childNodes.length && Array.prototype.some.call(el.childNodes, function(n){ return n.nodeType === 3 && n.textContent.trim(); }))) add('weight' + cs.fontWeight, el);
    });
    return bad;
  }
  window.addEventListener('load', function(){ setTimeout(async function(){
    var roles = ['recruiter', 'manager', 'admin', 'hm', 'candidate', 'oontu'];
    var extra = { recruiter:['job-detail'], admin:['admin-recruiters', 'admin-revenue', 'org-structure', 'master-data', 'user-management', 'client-detail', 'scheduled-jobs', 'design-system'], hm:['hm-job-create'] };
    var total = {};
    for(var ri = 0; ri < roles.length; ri++){
      var role = roles[ri]; state.role = role; var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden'); if(ri === 0) enterApp(); else renderSidebar();
      var views = navIds(role).concat(extra[role] || []); if(role === 'oontu') views = views.concat(['oontu-tenant-detail', 'oontu-plans-detail', 'oontu-subscription-detail']);
      for(var vi = 0; vi < views.length; vi++){
        var v = views[vi], name = role + ':' + v;
        try { if(v === 'job-detail') openJob('j1'); else if(v === 'client-detail') openClientDetail('c1'); else showView(v); await sleep(70);
          var bad = (v === 'design-system') ? {} : check(), keys = Object.keys(bad); keys.forEach(function(k){ total[k] = (total[k] || 0) + bad[k]; });
          results.push({ name:name, pass:keys.length === 0, error:keys.sort(function(a, b){ return bad[b] - bad[a]; }).slice(0, 5).map(function(k){ return k + ' ×' + bad[k]; }).join('  |  ') });
        } catch(e){ results.push({ name:name, pass:false, error:'THROW ' + e.message }); }
      }
    }
    results.push({ name:'TOTALS', pass:Object.keys(total).length === 0, error:Object.keys(total).sort(function(a, b){ return total[b] - total[a]; }).slice(0, 40).map(function(k){ return k + ' ×' + total[k]; }).join('\n') });
    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
  }, 800); });
})();

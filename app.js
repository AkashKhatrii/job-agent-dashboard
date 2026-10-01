
(function(){
  var rows = window.MATCHES || [];
  var tbody = document.getElementById('mtbody');
  var count = document.getElementById('mcount');
  var fCompany = document.getElementById('f-company');
  var fLoc = document.getElementById('f-loc');
  var fSource = document.getElementById('f-source');
  var sortKey = 'score', sortDir = -1;

  function badge(s){
    var c = s>=80?'hi':s>=70?'good':s>=60?'mid':'low';
    return '<span class="badge '+c+'">'+s+'</span>';
  }
  function escHtml(s){
    return String(s==null?'':s).replace(/[&<>"']/g,function(m){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];});
  }
  function filtered(){
    var qc = fCompany.value.toLowerCase(), ql = fLoc.value.toLowerCase(),
        qs = fSource.value;
    var r = rows.filter(function(x){
      return (!qc || (x.company||'').toLowerCase().indexOf(qc)>=0)
          && (!ql || (x.location||'').toLowerCase().indexOf(ql)>=0)
          && (!qs || x.source===qs);
    });
    r.sort(function(a,b){
      var va=a[sortKey], vb=b[sortKey];
      if(sortKey==='score'){ va=+va||0; vb=+vb||0; }
      else { va=(va||'').toLowerCase(); vb=(vb||'').toLowerCase(); }
      return (va<vb?-1:va>vb?1:0)*sortDir;
    });
    return r;
  }
  function render(){
    var r = filtered();
    count.textContent = r.length + ' of ' + rows.length + ' matches';
    tbody.innerHTML = r.map(function(x){
      return '<tr><td>'+badge(x.score)+'</td><td>'+escHtml(x.company)+'</td>'
        +'<td>'+escHtml(x.title)+'</td><td>'+escHtml(x.location)+'</td>'
        +'<td><span class="tag '+(x.source==='greenhouse'?'gh':'ashby')+'">'
        +escHtml(x.source)+'</span></td>'
        +'<td><a href="'+escHtml(x.url)+'" target="_blank" rel="noopener">posting</a></td></tr>';
    }).join('');
    document.querySelectorAll('th[data-k]').forEach(function(th){
      var k = th.getAttribute('data-k');
      var base = th.textContent.replace(/[\s\u25B2\u25BC]+$/,'');
      th.innerHTML = escHtml(base) + ' <span class="arr">'
        + (k===sortKey ? (sortDir===-1?'\u25BC':'\u25B2') : '') + '</span>';
    });
  }
  document.querySelectorAll('th[data-k]').forEach(function(th){
    th.addEventListener('click', function(){
      var k = th.getAttribute('data-k');
      if(k===sortKey){ sortDir = -sortDir; } else { sortKey=k; sortDir=(k==='score'?-1:1); }
      render();
    });
  });
  [fCompany,fLoc,fSource].forEach(function(el){ el.addEventListener('input', render); });
  render();
})();

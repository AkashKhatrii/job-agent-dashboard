
/* Job Agent dashboard — interactions.
   Table filtering/sorting + Tsenta-style motion: scroll reveals,
   count-up stats, animated funnel bars, score rings, sticky nav. */
(function(){
  "use strict";

  /* ---------- scroll reveals (fade + rise, slow ease) ---------- */
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(!e.isIntersecting) return;
      var el = e.target;
      if(el.hasAttribute("data-d")){
        el.style.transitionDelay = (parseInt(el.getAttribute("data-d"),10) * 90) + "ms";
      }
      el.classList.add("in");
      io.unobserve(el);
    });
  }, {threshold:0, rootMargin:"0px 0px -36px 0px"});
  document.querySelectorAll(".rv").forEach(function(el){ io.observe(el); });

  /* ---------- animated counters ---------- */
  function fmt(n){ return Math.round(n).toLocaleString("en-US"); }
  var cio = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(!e.isIntersecting) return;
      var el = e.target, target = parseFloat(el.getAttribute("data-count")) || 0;
      var t0 = null, dur = 1300;
      function step(t){
        if(!t0) t0 = t;
        var p = Math.min((t - t0) / dur, 1);
        var ez = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(target * ez);
        if(p < 1) requestAnimationFrame(step);
        else el.textContent = fmt(target);
      }
      requestAnimationFrame(step);
      cio.unobserve(el);
    });
  }, {threshold:.4});
  document.querySelectorAll("[data-count]").forEach(function(el){ cio.observe(el); });

  /* ---------- funnel bars fill on reveal ---------- */
  var bio = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(!e.isIntersecting) return;
      e.target.querySelectorAll(".fill[data-w]").forEach(function(f){
        f.style.width = f.getAttribute("data-w") + "%";
      });
      bio.unobserve(e.target);
    });
  }, {threshold:.25});
  document.querySelectorAll(".funnel").forEach(function(el){ bio.observe(el); });

  /* ---------- nav shadow on scroll ---------- */
  var nav = document.querySelector(".nav");
  if(nav){
    addEventListener("scroll", function(){
      nav.classList.toggle("scrolled", scrollY > 24);
    }, {passive:true});
  }

  /* ---------- score rings ---------- */
  function ringColor(s){
    return s >= 80 ? "#16a34a" : s >= 70 ? "#7c3aed" : s >= 60 ? "#d97706" : "#b6b6b6";
  }
  function ring(s){
    s = Math.round(+s) || 0;
    var r = 15.5, c = 2 * Math.PI * r;
    var off = c * (1 - Math.min(s, 100) / 100);
    return '<svg class="ring" viewBox="0 0 36 36" role="img" aria-label="match score '+s+'">'
      + '<circle cx="18" cy="18" r="'+r+'" fill="none" stroke="#ececec" stroke-width="3.5"/>'
      + '<circle class="rfill" cx="18" cy="18" r="'+r+'" fill="none" stroke="'+ringColor(s)+'"'
      + ' stroke-width="3.5" stroke-linecap="round"'
      + ' stroke-dasharray="'+c.toFixed(1)+'" stroke-dashoffset="'+c.toFixed(1)+'"'
      + ' data-off="'+off.toFixed(1)+'" transform="rotate(-90 18 18)"/>'
      + '<text x="18" y="22" text-anchor="middle" font-size="11" font-weight="800" fill="#0a0a0a">'+s+'</text>'
      + '</svg>';
  }
  function animateRings(scope){
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        (scope || document).querySelectorAll(".rfill").forEach(function(el){
          el.style.strokeDashoffset = el.getAttribute("data-off");
        });
      });
    });
  }
  function escHtml(s){
    return String(s == null ? "" : s).replace(/[&<>"']/g, function(m){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m];
    });
  }
  function renderPagerInto(el, pages, page, go){
    if(pages <= 1){ el.innerHTML = ""; el.style.display = "none"; return; }
    el.style.display = "flex";
    var html = '<button class="pgbtn" data-pg="' + (page - 1) + '"'
      + (page === 1 ? " disabled" : "") + ">← Prev</button>";
    var prev = 0;
    for(var i = 1; i <= pages; i++){
      if(i === 1 || i === pages || Math.abs(i - page) <= 2){
        if(i - prev > 1) html += '<span class="pgdots">…</span>';
        html += '<button class="pgbtn' + (i === page ? " on" : "") + '" data-pg="' + i + '">'
          + i + "</button>";
        prev = i;
      }
    }
    html += '<button class="pgbtn" data-pg="' + (page + 1) + '"'
      + (page === pages ? " disabled" : "") + ">Next →</button>";
    el.innerHTML = html;
    el.querySelectorAll(".pgbtn[data-pg]").forEach(function(b){
      b.addEventListener("click", function(){
        var p = parseInt(b.getAttribute("data-pg"), 10);
        if(p >= 1 && p <= pages && p !== page) go(p);
      });
    });
  }

  /* ---------- matches table ---------- */
  var rows = window.MATCHES || [];
  var tbody = document.getElementById("mtbody");
  if(tbody){
    var count = document.getElementById("mcount");
    var fCompany = document.getElementById("f-company");
    var fLoc = document.getElementById("f-loc");
    var fSource = document.getElementById("f-source");
    var sortKey = "score", sortDir = -1;
    var pageSize = 25, page = 1;

    function filtered(){
      var qc = fCompany.value.toLowerCase(), ql = fLoc.value.toLowerCase(),
          qs = fSource.value;
      var r = rows.filter(function(x){
        return (!qc || (x.company || "").toLowerCase().indexOf(qc) >= 0)
            && (!ql || (x.location || "").toLowerCase().indexOf(ql) >= 0)
            && (!qs || x.source === qs);
      });
      r.sort(function(a, b){
        var va = a[sortKey], vb = b[sortKey];
        if(sortKey === "score"){ va = +va || 0; vb = +vb || 0; }
        else { va = (va || "").toLowerCase(); vb = (vb || "").toLowerCase(); }
        return (va < vb ? -1 : va > vb ? 1 : 0) * sortDir;
      });
      return r;
    }
    function render(){
      var r = filtered();
      var total = r.length;
      var pages = Math.max(1, Math.ceil(total / pageSize));
      if(page > pages) page = pages;
      if(page < 1) page = 1;
      var start = (page - 1) * pageSize;
      var slice = r.slice(start, start + pageSize);
      count.textContent = total
        ? ("Showing " + (start + 1) + "–" + Math.min(start + pageSize, total)
           + " of " + total + " matches")
        : "No matches for these filters.";
      tbody.innerHTML = slice.map(function(x){
        return "<tr><td>" + ring(x.score) + "</td><td><strong>" + escHtml(x.company) + "</strong></td>"
          + "<td>" + escHtml(x.title) + "</td><td>" + escHtml(x.location) + "</td>"
          + '<td><span class="tag ' + (x.source === "greenhouse" ? "gh" : "ashby") + '">'
          + escHtml(x.source) + "</span></td>"
          + '<td><a href="' + escHtml(x.url) + '" target="_blank" rel="noopener">posting&nbsp;→</a></td></tr>';
      }).join("");
      animateRings(tbody);
      document.querySelectorAll("th[data-k]").forEach(function(th){
        var k = th.getAttribute("data-k");
        var base = th.textContent.replace(/[\s▴▾]+$/, "");
        th.innerHTML = escHtml(base) + ' <span class="arr">'
          + (k === sortKey ? (sortDir === -1 ? "▾" : "▴") : "") + "</span>";
      });
      renderPagerInto(document.getElementById("pager"), pages, page, function(p){
        page = p; render();
        document.getElementById("matches").scrollIntoView({behavior:"smooth", block:"start"});
      });
    }
    document.querySelectorAll("th[data-k]").forEach(function(th){
      th.addEventListener("click", function(){
        var k = th.getAttribute("data-k");
        if(k === sortKey){ sortDir = -sortDir; }
        else { sortKey = k; sortDir = (k === "score" ? -1 : 1); }
        page = 1; render();
      });
    });
    [fCompany, fLoc, fSource].forEach(function(el){
      el.addEventListener("input", function(){ page = 1; render(); });
    });
    render();
  }

  /* ---------- companies directory ---------- */
  if(document.getElementById("ctbody")){
    var crows = window.COMPANIES || [];
    var cPageSize = 12, cPage = 1, cSortKey = "matches", cSortDir = -1;
    var ctbody = document.getElementById("ctbody");
    var ccount = document.getElementById("ccount");
    var cpager = document.getElementById("cpager");
    var fcname = document.getElementById("f-cname");

    function cFiltered(){
      var q = fcname.value.trim().toLowerCase();
      var r = crows.filter(function(x){
        return !q || x.company.toLowerCase().indexOf(q) !== -1;
      });
      var k = cSortKey, d = cSortDir;
      return r.slice().sort(function(a, b){
        var va = (k === "source") ? a.sources.join(",") : a[k];
        var vb = (k === "source") ? b.sources.join(",") : b[k];
        if(va == null) va = -1;
        if(vb == null) vb = -1;
        var c = (typeof va === "string") ? va.localeCompare(vb) : (va - vb);
        return c * d;
      });
    }
    function cRender(){
      var r = cFiltered();
      var total = r.length;
      var pages = Math.max(1, Math.ceil(total / cPageSize));
      if(cPage > pages) cPage = pages;
      if(cPage < 1) cPage = 1;
      var start = (cPage - 1) * cPageSize;
      var slice = r.slice(start, start + cPageSize);
      ccount.textContent = total
        ? ("Showing " + (start + 1) + "–" + Math.min(start + cPageSize, total)
           + " of " + total + " companies")
        : "No companies match that filter.";
      ctbody.innerHTML = slice.map(function(x){
        var tags = x.sources.map(function(s){
          return '<span class="tag ' + (s === "greenhouse" ? "gh" : "ashby") + '">'
            + escHtml(s) + "</span>";
        }).join(" ");
        var top = (x.top == null) ? '<span class="muted">—</span>' : ring(x.top);
        return "<tr><td><strong>" + escHtml(x.company) + "</strong></td><td>" + tags + "</td>"
          + '<td class="num">' + x.postings.toLocaleString() + "</td>"
          + '<td class="num">' + x.matches + "</td>"
          + "<td>" + top + "</td></tr>";
      }).join("");
      animateRings(ctbody);
      document.querySelectorAll("th[data-ck]").forEach(function(th){
        var k = th.getAttribute("data-ck");
        var base = th.textContent.replace(/[\s▴▾]+$/, "");
        th.innerHTML = escHtml(base) + ' <span class="arr">'
          + (k === cSortKey ? (cSortDir === -1 ? "▾" : "▴") : "") + "</span>";
      });
      renderPagerInto(cpager, pages, cPage, function(p){
        cPage = p; cRender();
        document.getElementById("companies")
          .scrollIntoView({behavior:"smooth", block:"start"});
      });
    }
    document.querySelectorAll("th[data-ck]").forEach(function(th){
      th.addEventListener("click", function(){
        var k = th.getAttribute("data-ck");
        if(k === cSortKey){ cSortDir = -cSortDir; }
        else { cSortKey = k; cSortDir = (k === "company" || k === "source") ? 1 : -1; }
        cPage = 1; cRender();
      });
    });
    fcname.addEventListener("input", function(){ cPage = 1; cRender(); });
    cRender();
  }
})();
/* end app.js */

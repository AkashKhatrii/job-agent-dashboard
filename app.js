
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

  /* ---------- matches table ---------- */
  var rows = window.MATCHES || [];
  var tbody = document.getElementById("mtbody");
  if(tbody){
    var count = document.getElementById("mcount");
    var fCompany = document.getElementById("f-company");
    var fLoc = document.getElementById("f-loc");
    var fSource = document.getElementById("f-source");
    var sortKey = "score", sortDir = -1;

    function escHtml(s){
      return String(s == null ? "" : s).replace(/[&<>"']/g, function(m){
        return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m];
      });
    }
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
      count.textContent = r.length + " of " + rows.length + " matches";
      tbody.innerHTML = r.map(function(x){
        return "<tr><td>" + ring(x.score) + "</td><td><strong>" + escHtml(x.company) + "</strong></td>"
          + "<td>" + escHtml(x.title) + "</td><td>" + escHtml(x.location) + "</td>"
          + '<td><span class="tag ' + (x.source === "greenhouse" ? "gh" : "ashby") + '">'
          + escHtml(x.source) + "</span></td>"
          + '<td><a href="' + escHtml(x.url) + '" target="_blank" rel="noopener">posting&nbsp;→</a></td></tr>';
      }).join("");
      animateRings(tbody);
      document.querySelectorAll("th[data-k]").forEach(function(th){
        var k = th.getAttribute("data-k");
        var base = th.textContent.replace(/[\s▲▼]+$/, "");
        th.innerHTML = escHtml(base) + ' <span class="arr">'
          + (k === sortKey ? (sortDir === -1 ? "▾" : "▴") : "") + "</span>";
      });
    }
    document.querySelectorAll("th[data-k]").forEach(function(th){
      th.addEventListener("click", function(){
        var k = th.getAttribute("data-k");
        if(k === sortKey){ sortDir = -sortDir; }
        else { sortKey = k; sortDir = (k === "score" ? -1 : 1); }
        render();
      });
    });
    [fCompany, fLoc, fSource].forEach(function(el){ el.addEventListener("input", render); });
    render();
  }
})();
/* end app.js */

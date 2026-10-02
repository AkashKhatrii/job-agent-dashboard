
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

  /* ---------- bulk-apply selection state ---------- */
  var selectedJobs = {};
  var APP_ACTIVE = {submitted: 1, approved: 1, queued: 1, pending: 1, running: 1, blocked: 1};
  function jobSelectable(x){
    return x && (x.score >= 65) && !APP_ACTIVE[x.app];
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
        var canSel = jobSelectable(x);
        var whyNot = x.app ? ("Status: " + x.app) : "Score below 65";
        var cb = canSel
          ? '<input type="checkbox" class="apply-sel" data-job="' + x.job_id + '"'
            + (selectedJobs[x.job_id] ? " checked" : "") + ' title="Queue for application">'
          : '<span class="muted" title="' + escHtml(whyNot) + '">—</span>';
        return "<tr><td>" + cb + "</td><td>" + ring(x.score) + "</td><td><strong>" + escHtml(x.company) + "</strong></td>"
          + "<td>" + escHtml(x.title) + "</td><td>" + escHtml(x.location) + "</td>"
          + '<td><span class="tag ' + (x.source === "greenhouse" ? "gh" : "ashby") + '">'
          + escHtml(x.source) + "</span></td>"
          + '<td><a href="' + escHtml(x.url) + '" target="_blank" rel="noopener">posting&nbsp;→</a></td></tr>';
      }).join("");
      animateRings(tbody);
      tbody.querySelectorAll(".apply-sel").forEach(function(cb){
        cb.addEventListener("change", function(){
          var jid = cb.getAttribute("data-job");
          if(cb.checked){ selectedJobs[jid] = true; } else { delete selectedJobs[jid]; }
          updateApplyBar();
        });
      });
      var selAll = document.getElementById("sel-all");
      if(selAll){
        selAll.checked = false;
        selAll.onchange = function(){
          tbody.querySelectorAll(".apply-sel").forEach(function(cb){
            cb.checked = selAll.checked;
            var jid = cb.getAttribute("data-job");
            if(selAll.checked){ selectedJobs[jid] = true; } else { delete selectedJobs[jid]; }
          });
          updateApplyBar();
        };
      }
      updateApplyBar();
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
  /* ---------- agent API: refresh + bulk apply ---------- */
  var apiBase = null;

  function setApiStatus(msg, cls){
    var el = document.getElementById("api-status");
    if(!el) return;
    el.className = "muted " + (cls || "");
    el.innerHTML = '<span class="pulse-dot' + (cls === "busy" ? " busy" : "") + '"></span>' + escHtml(msg);
  }

  function api(path, opts){
    opts = opts || {};
    opts.headers = Object.assign({"Content-Type": "application/json"}, opts.headers || {});
    return fetch(apiBase + path, opts).then(function(r){
      if(!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  function updateApplyBar(){
    var bar = document.getElementById("apply-bar");
    var btn = document.getElementById("btn-apply-sel");
    if(!bar || !btn) return;
    var n = Object.keys(selectedJobs).length;
    bar.style.display = "flex";
    btn.disabled = !n || !apiBase;
    btn.textContent = "Apply for selected (" + n + ")";
  }

  function pollRefresh(){
    api("/api/status").then(function(s){
      var r = (s && s.refresh) || {};
      if(r.state === "running"){
        setApiStatus(r.message || "Refreshing…", "busy");
        setTimeout(pollRefresh, 15000);
      } else {
        var btn = document.getElementById("btn-refresh");
        if(btn) btn.disabled = false;
        if(r.state === "done"){
          setApiStatus("Done — reloading dashboard…", "ok");
          setTimeout(function(){ location.reload(); }, 2500);
        } else {
          setApiStatus(r.message || ("Refresh " + r.state), r.state === "error" ? "err" : "");
        }
      }
    }).catch(function(){
      setTimeout(pollRefresh, 30000);
    });
  }

  function initAgentControls(){
    var refBtn = document.getElementById("btn-refresh");
    if(refBtn){
      refBtn.addEventListener("click", function(){
        if(!apiBase) return;
        refBtn.disabled = true;
        setApiStatus("Refresh started — sweeping boards, this takes a while…", "busy");
        api("/api/refresh", {method: "POST", body: "{}"}).then(function(res){
          if(res && res.started === false){
            setApiStatus(res.reason || "Refresh already running.", "busy");
            refBtn.disabled = false;
          } else {
            pollRefresh();
          }
        }).catch(function(e){
          setApiStatus("Could not start refresh: " + e.message, "err");
          refBtn.disabled = false;
        });
      });
    }
    var applyBtn = document.getElementById("btn-apply-sel");
    if(applyBtn){
      applyBtn.addEventListener("click", function(){
        var ids = Object.keys(selectedJobs).map(function(k){ return +k; });
        if(!ids.length || !apiBase) return;
        if(!confirm("Queue " + ids.length + " application(s)? The agent will tailor each résumé and submit.")) return;
        applyBtn.disabled = true;
        api("/api/apply", {method: "POST", body: JSON.stringify({job_ids: ids})}).then(function(res){
          var ok = (res.accepted || []).length;
          var msg = "Queued " + ok + " of " + ids.length + ". The agent picks them up within minutes.";
          if(res.rejected && res.rejected.length){
            msg += " Skipped: " + res.rejected.map(function(r){ return "job " + r.job_id + " (" + r.reason + ")"; }).join(", ");
          }
          setApiStatus(msg, "ok");
          (res.accepted || []).forEach(function(jid){
            var cb = document.querySelector('.apply-sel[data-job="' + jid + '"]');
            if(cb){ cb.disabled = true; cb.checked = false; }
            delete selectedJobs[String(jid)];
          });
          updateApplyBar();
        }).catch(function(e){
          setApiStatus("Queue failed: " + e.message, "err");
          updateApplyBar();
        });
      });
    }
    api("/api/status").then(function(s){
      var q = (s && s.queue) || {};
      if(q.queued){
        setApiStatus(q.queued + " application(s) waiting in the agent queue.", "busy");
      }
    }).catch(function(){});
  }

  fetch("api-config.json").then(function(r){
    if(!r.ok) throw new Error("no config");
    return r.json();
  }).then(function(c){
    if(c && c.api_base){
      apiBase = String(c.api_base).replace(/\/+$/, "");
      setApiStatus("Agent API connected.", "ok");
      initAgentControls();
    } else {
      setApiStatus("Agent API not configured yet.", "");
    }
    updateApplyBar();
  }).catch(function(){
    setApiStatus("Agent API unreachable — controls disabled.", "err");
    updateApplyBar();
  });
})();
/* end app.js */

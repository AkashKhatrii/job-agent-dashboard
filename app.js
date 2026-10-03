
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
  /* ---------- agent commands: relay API (fallback: email) ---------- */
  /* Primary: POST to the Google Apps Script relay; the VM polls it every
     few minutes. Fallback (relay not configured): pre-filled email. */
  var RELAY_URL = "https://script.google.com/macros/s/AKfycbwWZTmJT1SFA0Uvums62qR_Gje1MQbAsyRX53S9XnloQDLNMGRxGNy8Dm1KWYzk5UOg7A/exec";
  var RELAY_SECRET = "v5IVFMKVur31cS7UqE_YJBZk18QH5jDMrPix6wKzCuM";
  var CMD_EMAIL = "akash.m.khatri@gmail.com";

  function setApiStatus(msg, cls){
    var el = document.getElementById("api-status");
    if(!el) return;
    el.className = "muted " + (cls || "");
    el.innerHTML = '<span class="pulse-dot' + (cls === "busy" ? " busy" : "") + '"></span>' + escHtml(msg);
  }

  function mailtoCmd(subject, body){
    window.location.href = "mailto:" + encodeURIComponent(CMD_EMAIL)
      + "?subject=" + encodeURIComponent(subject)
      + "&body=" + encodeURIComponent(body);
  }

  function sendCommand(cmd, jobIds, done){
    if(cmd === "APPLY"){
      // Prefer the Mac Apply Agent on localhost (fast local browser automation).
      // Falls back to the relay/email flow if the Mac server is not running.
      sendToMac(jobIds, function(macOk, macQueued){
        if(macOk){ done("mac", macQueued); return; }
        if(RELAY_URL){
          fetch(RELAY_URL, {
            method: "POST", mode: "no-cors",
            headers: {"Content-Type": "text/plain"},
            body: JSON.stringify({secret: RELAY_SECRET, cmd: cmd, job_ids: jobIds || []})
          }).then(function(){ done("relay", 0); }, function(){ done(false, 0); });
        } else {
          var subject = "JOBAGENT APPLY";
          var body = "job_ids: " + (jobIds || []).join(", ");
          mailtoCmd(subject, body);
          done("email", 0);
        }
      });
      return;
    }
    if(RELAY_URL){
      fetch(RELAY_URL, {
        method: "POST", mode: "no-cors",
        headers: {"Content-Type": "text/plain"},
        body: JSON.stringify({secret: RELAY_SECRET, cmd: cmd, job_ids: jobIds || []})
      }).then(function(){ done(true); }, function(){ done(false); });
    } else {
      var subject = cmd === "REFRESH" ? "JOBAGENT REFRESH" : "JOBAGENT APPLY";
      var body = "Run today's job discovery and scoring, then rebuild this dashboard.";
      mailtoCmd(subject, body);
      done(true);
    }
  }

  var MAC_APPLY_URL = "http://127.0.0.1:8765/apply";

  function sendToMac(jobIds, done){
    // Map selected job ids to their apply URLs from the embedded matches.
    var byId = {};
    (window.MATCHES || []).forEach(function(m){ byId[m.job_id] = m.url; });
    var urls = (jobIds || []).map(function(id){ return byId[id]; })
      .filter(function(u){ return u && u.indexOf("greenhouse.io") !== -1; });
    if(!urls.length){ done(false, 0); return; }
    var ctrl = new AbortController();
    var timer = setTimeout(function(){ ctrl.abort(); }, 4000);
    fetch(MAC_APPLY_URL, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({urls: urls}),
      signal: ctrl.signal
    }).then(function(r){
      clearTimeout(timer);
      if(!r.ok) throw new Error("bad status");
      return r.json();
    }).then(function(j){
      done(true, j.queued || 0);
    }).catch(function(){
      clearTimeout(timer);
      done(false, 0);
    });
  }

  function updateApplyBar(){
    var bar = document.getElementById("apply-bar");
    var btn = document.getElementById("btn-apply-sel");
    if(!bar || !btn) return;
    var n = Object.keys(selectedJobs).length;
    bar.style.display = "flex";
    btn.disabled = !n;
    btn.textContent = "Apply for selected (" + n + ")";
  }

  function initAgentControls(){
    var refBtn = document.getElementById("btn-refresh");
    if(refBtn){
      refBtn.addEventListener("click", function(){
        refBtn.disabled = true;
        sendCommand("REFRESH", [], function(ok){
          refBtn.disabled = false;
          if(RELAY_URL){
            setApiStatus(ok ? "Refresh command sent — the agent will pick it up within a couple minutes." : "Could not reach the relay.", ok ? "busy" : "err");
          } else {
            setApiStatus("Email opened — hit Send and the agent will refresh jobs within ~10 minutes.", "busy");
          }
        });
      });
    }
    var applyBtn = document.getElementById("btn-apply-sel");
    if(applyBtn){
      applyBtn.addEventListener("click", function(){
        var ids = Object.keys(selectedJobs).map(function(k){ return +k; });
        if(!ids.length) return;
        if(!confirm("Queue " + ids.length + " application(s)? The agent will validate, tailor each résumé, and apply within minutes.")) return;
        applyBtn.disabled = true;
        sendCommand("APPLY", ids, function(where, macQueued){
          if(where === "mac"){
            setApiStatus("Sent " + (macQueued || ids.length) + " job(s) to your Mac — applying now.", "ok");
          } else if(RELAY_URL){
            setApiStatus(where ? "Queued " + ids.length + " application(s) — the agent picks them up within minutes." : "Could not reach the relay.", where ? "ok" : "err");
          } else {
            setApiStatus("Mac server not running and no relay — email opened, hit Send to queue " + ids.length + " application(s).", "ok");
          }
          updateApplyBar();
        });
      });
    }
    fetch("status.json").then(function(r){
      if(!r.ok) throw new Error("no status");
      return r.json();
    }).then(function(s){
      var parts = [];
      if(s.queue_depth) parts.push(s.queue_depth + " in apply queue");
      if(s.applications_today) parts.push(s.applications_today + " applied today");
      setApiStatus("Dashboard updated " + (s.built_at || "") + (parts.length ? " — " + parts.join(" · ") : ""),
                   s.queue_depth ? "busy" : "ok");
    }).catch(function(){
      setApiStatus("The agent checks for emailed commands every ~10 minutes.", "");
    });
    updateApplyBar();
  }
  initAgentControls();
;
})();
/* end app.js */

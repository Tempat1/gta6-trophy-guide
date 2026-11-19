/* GTA VI Trophy Guide — tracker logic. Vanilla JS, no network, no libraries.
   Progress is stored in localStorage under KEY so it survives reloads. */
(function () {
  "use strict";
  var KEY = "gta6-trophy-guide-v1";
  var CATEGORIES = ["Story", "Exploration", "Combat", "Driving", "Collectibles", "Side", "Misc"];
  var GRADES = ["Platinum", "Gold", "Silver", "Bronze"];

  var earned = {};   // id -> true
  var query = "";
  var gradeFilter = "All";
  var categoryFilter = "All";
  var statusFilter = "all"; // all | earned | unearned
  var sortMode = "default";
  var hideSpoilers = false;

  function $(id) { return document.getElementById(id); }
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") earned = parsed;
      }
    } catch (e) { earned = {}; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(earned)); } catch (e) { /* storage full/blocked: progress just won't persist */ }
  }
  function isEarned(t) { return !!earned[t.id]; }
  function gradeRank(g) { return GRADES.indexOf(g); }

  function filtered() {
    var q = query.trim().toLowerCase();
    var list = TROPHIES.filter(function (t) {
      if (gradeFilter !== "All" && t.grade !== gradeFilter) return false;
      if (categoryFilter !== "All" && t.category !== categoryFilter) return false;
      if (statusFilter === "earned" && !isEarned(t)) return false;
      if (statusFilter === "unearned" && isEarned(t)) return false;
      if (q) {
        var hay = (t.name + " " + t.desc + " " + t.tip + " " + t.category + " " + t.grade).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
    if (sortMode === "name") list.sort(function (a, b) { return a.name.localeCompare(b.name); });
    else if (sortMode === "grade") list.sort(function (a, b) { return gradeRank(a.grade) - gradeRank(b.grade) || a.name.localeCompare(b.name); });
    else if (sortMode === "easiest") list.sort(function (a, b) { return a.priority - b.priority || gradeRank(a.grade) - gradeRank(b.grade); });
    return list;
  }

  function renderProgress() {
    var total = TROPHIES.length;
    var done = TROPHIES.filter(isEarned).length;
    var pct = total ? Math.round(done / total * 100) : 0;
    $("earnedCount").textContent = done;
    $("totalCount").textContent = total;
    $("pctBig").textContent = pct + "%";
    $("progressFill").style.width = pct + "%";
    $("progressFill").setAttribute("aria-valuenow", String(pct));
    $("barLabel").textContent = done + " of " + total + " trophies earned";
    $("pointsLabel").textContent = TROPHIES.filter(isEarned).reduce(function (s, t) { return s + (t.points || 0); }, 0) + " / 1,000 Gamerscore (Xbox equivalent)";

    var chips = GRADES.map(function (g) {
      var gTotal = TROPHIES.filter(function (t) { return t.grade === g; }).length;
      var gDone = TROPHIES.filter(function (t) { return t.grade === g && isEarned(t); }).length;
      return '<span class="chip ' + g.toLowerCase() + '"><b>' + gDone + " / " + gTotal + "</b> " + g + "</span>";
    }).join("");
    $("gradeChips").innerHTML = chips;

    $("catBars").innerHTML = CATEGORIES.map(function (c) {
      var cTotal = TROPHIES.filter(function (t) { return t.category === c; }).length;
      var cDone = TROPHIES.filter(function (t) { return t.category === c && isEarned(t); }).length;
      var cp = cTotal ? Math.round(cDone / cTotal * 100) : 0;
      return '<div class="cat-row"><div class="row-top"><span>' + c + '</span><b>' + cDone + " / " + cTotal + " · " + cp + '%</b></div><div class="mini"><div style="width:' + cp + '%"></div></div></div>';
    }).join("");

    var plat = TROPHIES[0];
    $("platCallout").innerHTML = isEarned(plat)
      ? "<b>Leonida Legend!</b> You earned the Platinum — Vice Got a Price! Every trophy is yours."
      : "<b>Platinum progress:</b> " + done + " / 54 trophies before the Platinum. " + (54 - done) + " to go.";
  }

  function renderNextUp() {
    var box = $("nextList");
    var remaining = TROPHIES.map(function (t, i) { return { t: t, i: i }; })
      .filter(function (x) { return !isEarned(x.t) && x.t.grade !== "Platinum"; })
      .sort(function (a, b) { return a.t.priority - b.t.priority || a.i - b.i; })
      .slice(0, 5)
      .map(function (x) { return x.t; });
    if (!remaining.length) {
      box.innerHTML = '<div class="next-empty"><b>Leonida Legend!</b>Every trophy is checked off — including the Platinum. Time to enjoy Vice City.</div>';
      return;
    }
    box.innerHTML = remaining.map(function (t, i) {
      var why = t.missable ? "Do first — potentially missable"
        : t.priority === 2 ? "Story — unlocks naturally"
        : t.priority === 3 ? "Quick win"
        : "Grind — chip away at it";
      return '<div class="next-item"><div class="rank">' + (i + 1) + '</div><div><div class="why">' + why + '</div><h3>' + esc(t.name) + ' <span class="badge ' + t.grade + '">' + t.grade + '</span></h3><p>' + esc(t.desc) + " " + esc(t.tip) + "</p></div></div>";
    }).join("");
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function renderGrid() {
    var list = filtered();
    var grid = $("grid");
    $("resultCount").textContent = list.length + " of " + TROPHIES.length + " trophies shown";
    if (!list.length) {
      grid.innerHTML = '<div class="empty"><b>No trophies match.</b>Try a different search or clear the filters.</div>';
      return;
    }
    grid.innerHTML = list.map(function (t) {
      var e = isEarned(t);
      var blur = hideSpoilers && t.category === "Story" ? " spoiler-blur" : "";
      var tags = '<span class="tag">' + t.category + '</span>'
        + (t.hidden ? '<span class="tag hidden-t">Hidden</span>' : "")
        + (t.missable ? '<span class="tag missable">Potentially missable</span>' : "")
        + '<span class="tag points">' + t.points + "G</span>";
      return '<article class="card' + (e ? " earned" : "") + (t.missable && !e ? " missable-card" : "") + '" data-id="' + t.id + '">'
        + '<div class="card-head"><input type="checkbox" class="check" data-id="' + t.id + '"' + (e ? " checked" : "") + ' aria-label="Mark ' + esc(t.name) + ' as earned">'
        + '<div><h3 class="' + blur + '">' + esc(t.name) + (e ? ' <span class="earned-mark">✓</span>' : "") + '</h3>'
        + '<span class="badge ' + t.grade + '">' + t.grade + '</span></div></div>'
        + '<p class="desc' + blur + '">' + esc(t.desc) + '</p>'
        + '<p class="tip"><b>How to unlock:</b> ' + esc(t.tip) + '</p>'
        + '<div class="meta">' + tags + '</div></article>';
    }).join("");
  }

  function renderAll() { renderProgress(); renderNextUp(); renderGrid(); }

  function buildPills(containerId, values, current, onPick) {
    var c = $(containerId);
    c.innerHTML = values.map(function (v) {
      return '<button type="button" class="pill' + (v === current ? " active" : "") + '" data-v="' + v + '">' + v + '</button>';
    }).join("");
    c.querySelectorAll(".pill").forEach(function (b) {
      b.addEventListener("click", function () { onPick(b.getAttribute("data-v")); });
    });
  }

  function init() {
    load();
    // grade pills
    var gradePick = function (v) {
      gradeFilter = v;
      buildPills("gradePills", ["All"].concat(GRADES), gradeFilter, gradePick);
      renderGrid();
    };
    buildPills("gradePills", ["All"].concat(GRADES), gradeFilter, gradePick);

    var statusPick = function (v) {
      statusFilter = v;
      buildPills("statusPills", [["all", "All"], ["earned", "Earned"], ["unearned", "Not yet earned"]].map(function (x) { return x[0]; }), statusFilter, function () {});
      // rebuild with labels
      var c = $("statusPills");
      c.innerHTML = [["all", "All"], ["earned", "Earned"], ["unearned", "Not yet earned"]].map(function (x) {
        return '<button type="button" class="pill' + (x[0] === statusFilter ? " active" : "") + '" data-v="' + x[0] + '">' + x[1] + '</button>';
      }).join("");
      c.querySelectorAll(".pill").forEach(function (b) {
        b.addEventListener("click", function () { statusPick(b.getAttribute("data-v")); });
      });
      renderGrid();
    };
    // initial status pills
    (function () {
      var c = $("statusPills");
      c.innerHTML = [["all", "All"], ["earned", "Earned"], ["unearned", "Not yet earned"]].map(function (x) {
        return '<button type="button" class="pill' + (x[0] === statusFilter ? " active" : "") + '" data-v="' + x[0] + '">' + x[1] + '</button>';
      }).join("");
      c.querySelectorAll(".pill").forEach(function (b) {
        b.addEventListener("click", function () { statusPick(b.getAttribute("data-v")); });
      });
    })();

    $("search").addEventListener("input", function (e) { query = e.target.value; renderGrid(); });
    $("categorySelect").addEventListener("change", function (e) { categoryFilter = e.target.value; renderGrid(); });
    $("sortSelect").addEventListener("change", function (e) { sortMode = e.target.value; renderGrid(); });
    $("spoilerToggle").addEventListener("change", function (e) { hideSpoilers = e.target.checked; renderGrid(); });

    $("grid").addEventListener("change", function (e) {
      var cb = e.target;
      if (!cb.classList.contains("check")) return;
      var id = cb.getAttribute("data-id");
      if (cb.checked) earned[id] = true; else delete earned[id];
      save();
      renderAll();
    });

    $("resetBtn").addEventListener("click", function () {
      if (window.confirm("Reset all trophy progress? This clears every checkmark.")) {
        earned = {};
        save();
        renderAll();
      }
    });
    $("copyBtn").addEventListener("click", function () {
      var done = TROPHIES.filter(isEarned).length;
      var pct = Math.round(done / TROPHIES.length * 100);
      var text = "GTA VI — " + done + "/55 trophies (" + pct + "%)\n" +
        TROPHIES.filter(isEarned).map(function (t) { return "✓ " + t.name + " (" + t.grade + ")"; }).join("\n");
      var doneMsg = function (msg) { $("copyBtn").textContent = msg; setTimeout(function () { $("copyBtn").textContent = "Copy progress summary"; }, 2000); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { doneMsg("Copied!"); }, function () { doneMsg("Copy failed"); });
      } else { doneMsg("Copy not supported"); }
    });

    renderAll();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

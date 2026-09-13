/* Fluorine Free DWR - interactive result charts (vanilla SVG, no deps).
   Reads data/observations.csv (built by tools/build_data.py from the lab exports)
   and replaces the static PNG in any figure carrying data-chart. No JS, or a failed
   fetch, leaves the PNG in place. Every value is also in a table under each chart.
   Encoding: dots = individual swatches, rules and lines = mean of released swatches,
   triangles in the top band = no release by 90 degrees (never averaged in as 90).
   HOUSE STYLE: no em dashes, no hyphenated compounds in visible text. */
(function () {
  "use strict";

  var holders = [].slice.call(document.querySelectorAll("[data-chart]"));
  if (!holders.length || !window.fetch || !document.createElementNS) return;

  var SVGNS = "http://www.w3.org/2000/svg";
  var MONO = '"Geist Mono", ui-monospace, Menlo, monospace';
  /* the lab figure palette (scripts/figlib.py), validated for CVD separation on white */
  var SAMPLES = [
    { id: "C-A1",  color: "#2a78d6", fabric: "cotton",     name: "Emulsion only" },
    { id: "C-B3",  color: "#1baf7a", fabric: "cotton",     name: "Emulsion + bare anatase" },
    { id: "C-C3",  color: "#eda100", fabric: "cotton",     name: "Emulsion + silane treated anatase" },
    { id: "F-A1",  color: "#9c1668", fabric: "finisterre", name: "Emulsion only" },
    { id: "F-DWR", color: "#d92b1f", fabric: "finisterre", name: "Commercial finish" }
  ];
  var BY_ID = {};
  SAMPLES.forEach(function (s) { BY_ID[s.id] = s; });
  var FABRIC_NAME = { cotton: "Cotton", finisterre: "Finisterre fabric" };
  var INK = "#17150f", INK2 = "#5b564a", GRID = "#ebe6da", SURFACE = "#ffffff", BAND = "#f3efe6";

  /* ---------- small helpers ---------- */
  function el(name, attrs, parent) {
    var n = document.createElementNS(SVGNS, name), k;
    for (k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function text(parent, x, y, str, attrs) {
    var t = el("text", Object.assign({ x: x, y: y, fill: INK2, "font-family": MONO, "font-size": 11 }, attrs || {}), parent);
    t.textContent = str;
    return t;
  }
  function h(tag, cls, str) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (str != null) n.textContent = str;
    return n;
  }
  function mean(a) { return a.reduce(function (s, v) { return s + v; }, 0) / a.length; }
  function fmt(v) { return Math.round(v) + "°"; }
  function fmt1(v) { return v.toFixed(1) + "°"; }
  function scale(d0, d1, r0, r1) { return function (v) { return r0 + (v - d0) / (d1 - d0) * (r1 - r0); }; }

  function parseCSV(str) {
    var lines = str.trim().split(/\r?\n/), head = lines.shift().split(",");
    function split(line) {                       /* commas inside quotes stay in the field */
      var out = [], cur = "", q = false, i, c;
      for (i = 0; i < line.length; i++) {
        c = line[i];
        if (c === '"') { if (q && line[i + 1] === '"') { cur += c; i++; } else q = !q; }
        else if (c === "," && !q) { out.push(cur); cur = ""; }
        else cur += c;
      }
      out.push(cur);
      return out;
    }
    return lines.map(function (line) {
      var cells = split(line), o = {};
      head.forEach(function (k, i) { o[k] = cells[i]; });
      o.cycles = +o.cycles;
      o.swatch = +o.swatch;
      o.value = o.value_deg === "" ? null : +o.value_deg;
      return o;
    });
  }

  /* group rows into { sampleId: { key: [rows] } } */
  function groupBy(rows, keyFn) {
    var out = {};
    rows.forEach(function (r) {
      var k = keyFn(r);
      (out[r.sample] = out[r.sample] || {});
      (out[r.sample][k] = out[r.sample][k] || []).push(r);
    });
    return out;
  }
  function summarise(rows) {
    var released = rows.filter(function (r) { return r.value != null; });
    return {
      rows: rows,
      values: released.map(function (r) { return r.value; }),
      n: rows.length,
      nReleased: released.length,
      mean: released.length ? mean(released.map(function (r) { return r.value; })) : null
    };
  }

  /* ---------- shared tooltip ---------- */
  var tip = h("div", "chart-tip");
  tip.setAttribute("role", "status");
  tip.hidden = true;
  document.body.appendChild(tip);

  function showTip(anchorRect, title, lines) {
    tip.textContent = "";
    tip.appendChild(h("p", "chart-tip-title", title));
    lines.forEach(function (ln) {
      var row = h("p", "chart-tip-row");
      if (ln.color) {
        var key = h("span", "chart-tip-key");
        key.style.background = ln.color;
        row.appendChild(key);
      }
      row.appendChild(h("b", null, ln.value));
      row.appendChild(h("span", null, " " + ln.label));
      tip.appendChild(row);
    });
    tip.hidden = false;
    var tw = tip.offsetWidth, th = tip.offsetHeight;
    var x = anchorRect.left + anchorRect.width / 2 - tw / 2;
    var y = anchorRect.top - th - 10;
    if (y < 8) y = anchorRect.bottom + 10;
    x = Math.max(8, Math.min(x, window.innerWidth - tw - 8));
    tip.style.transform = "translate(" + Math.round(x + window.scrollX) + "px," + Math.round(y + window.scrollY) + "px)";
  }
  function hideTip() { tip.hidden = true; }
  window.addEventListener("scroll", hideTip, { passive: true });

  function swatchList(s) {
    return s.rows.map(function (r) { return r.value == null ? "no release" : fmt1(r.value); }).join(", ");
  }

  /* ---------- table view ---------- */
  function tableView(caption, headers, body) {
    var d = h("details", "more chart-table");
    d.appendChild(h("summary", null, "Data table"));
    var wrap = h("div", "rtable-wrap");
    var t = h("table", "rtable");
    t.appendChild(h("caption", null, caption));
    var thead = h("thead"), tr = h("tr");
    headers.forEach(function (x) { tr.appendChild(h("th", null, x)); });
    thead.appendChild(tr);
    t.appendChild(thead);
    var tb = h("tbody");
    body.forEach(function (row) {
      var r = h("tr");
      row.forEach(function (cell, i) { r.appendChild(h("td", i > 1 ? "num" : null, cell)); });
      tb.appendChild(r);
    });
    t.appendChild(tb);
    wrap.appendChild(t);
    d.appendChild(wrap);
    return d;
  }

  /* ---------- category strip plot (repellency, shedding) ---------- */
  var ORDER = ["C-A1", "C-B3", "C-C3", "F-A1", "F-DWR"];

  /* x positions: three cotton columns, a gap, two Finisterre columns */
  function categoryX(left, width) {
    var slots = 5.6, step = width / slots, pos = {};
    ORDER.forEach(function (id, i) { pos[id] = left + step * (i + (i >= 3 ? 1.1 : 0.5)); });
    return { pos: pos, step: step,
      groups: [
        { name: FABRIC_NAME.cotton, from: left, to: left + step * 3 },
        { name: FABRIC_NAME.finisterre, from: left + step * 3.6, to: left + width }
      ] };
  }

  function stripPanel(svg, box, opts) {
    /* box: {x, y, w, h}; opts: {title, y0, y1, ticks, groups (sample -> summary), censorBand, label} */
    var g = el("g", {}, svg);
    var plotTop = box.y + 26, plotBottom = box.y + box.h - (box.w / 5.6 < 90 ? 58 : 44);
    var left = box.x + 38, right = box.x + box.w - 6;
    var bandH = opts.censorBand ? 22 : 0;
    var y = scale(opts.y0, opts.y1, plotBottom, plotTop + bandH);
    text(g, box.x, box.y + 12, opts.title, { fill: INK, "font-size": 12, "font-weight": 600 });

    opts.ticks.forEach(function (v) {
      el("line", { x1: left, x2: right, y1: y(v), y2: y(v), stroke: GRID, "stroke-width": 1 }, g);
      if (!(opts.censorBand && v === 90)) text(g, left - 8, y(v) + 4, v + "°", { "text-anchor": "end" });
    });
    if (opts.censorBand) {
      el("rect", { x: left, y: plotTop, width: right - left, height: bandH - 4, fill: BAND, rx: 4 }, g);
      text(g, left - 8, plotTop + 12, ">90°", { "text-anchor": "end" });
    }
    var cx = categoryX(left, right - left);
    /* narrow columns: the mean goes under the sample name instead of beside the rule */
    var under = cx.step < 90, drop = under ? 14 : 0;
    cx.groups.forEach(function (gr) {
      el("line", { x1: gr.from + 4, x2: gr.to - 4, y1: plotBottom + 30 + drop, y2: plotBottom + 30 + drop, stroke: GRID, "stroke-width": 1 }, g);
      text(g, (gr.from + gr.to) / 2, plotBottom + 42 + drop, gr.name, { "text-anchor": "middle", "font-size": 10.5 });
    });

    ORDER.forEach(function (id) {
      var s = opts.groups[id];
      if (!s) return;
      var col = BY_ID[id].color, x0 = cx.pos[id];
      text(g, x0, plotBottom + 18, id, { "text-anchor": "middle", fill: INK });
      var n = s.rows.length;
      s.rows.forEach(function (r, i) {
        var dx = n > 1 ? (i - (n - 1) / 2) * Math.min(9, cx.step * 0.5 / n) : 0;
        if (r.value == null) {
          var ty = plotTop + (bandH - 4) / 2 + 3, tx = x0 + dx;
          el("path", { d: "M" + tx + "," + (ty - 5) + " L" + (tx + 5) + "," + (ty + 4) + " L" + (tx - 5) + "," + (ty + 4) + " Z",
            fill: col, stroke: SURFACE, "stroke-width": 1.5 }, g);
        } else {
          el("circle", { cx: x0 + dx, cy: y(r.value), r: 4.5, fill: col, stroke: SURFACE, "stroke-width": 2 }, g);
        }
      });
      if (s.mean != null) {
        var rw = Math.min(26, cx.step * 0.38);
        el("line", { x1: x0 - rw, x2: x0 + rw, y1: y(s.mean), y2: y(s.mean), stroke: INK, "stroke-width": 2, "stroke-linecap": "round" }, g);
        var lab = fmt(s.mean) + (s.nReleased < s.n ? "*" : "");
        if (under) text(g, x0, plotBottom + 32, lab, { "text-anchor": "middle", fill: INK, "font-size": 10.5 });
        else text(g, x0 + rw + 5, y(s.mean) + 4, lab, { fill: INK, "font-size": 11 });
      }
      /* column hit area, bigger than the marks */
      var hit = el("rect", { x: x0 - cx.step / 2, y: plotTop, width: cx.step, height: plotBottom - plotTop + 24,
        fill: "transparent", tabindex: 0, role: "img",
        "aria-label": id + ", " + FABRIC_NAME[BY_ID[id].fabric] + ": " + opts.label(s) }, g);
      function on() {
        var lines = [{ color: col, value: s.mean != null ? fmt1(s.mean) : "none", label: "mean of released swatches" },
          { value: s.nReleased + " of " + s.n, label: opts.countLabel || "measured" },
          { value: swatchList(s), label: "" }];
        showTip(hit.getBoundingClientRect(), id + " · " + BY_ID[id].name + ", " + FABRIC_NAME[BY_ID[id].fabric].toLowerCase(), lines);
      }
      hit.addEventListener("pointerenter", on);
      hit.addEventListener("focus", on);
      hit.addEventListener("pointerleave", hideTip);
      hit.addEventListener("blur", hideTip);
    });
  }

  function makeSVG(holder, height) {
    var w = Math.max(280, holder.clientWidth);
    var svg = el("svg", { width: w, height: height, viewBox: "0 0 " + w + " " + height, class: "chart-svg" });
    return { svg: svg, w: w };
  }

  /* ---------- chart: repellency ---------- */
  function renderRepellency(holder, rows) {
    var data = rows.filter(function (r) { return r.dataset === "wca_baseline"; });
    var groups = {}, by = groupBy(data, function () { return "all"; });
    ORDER.forEach(function (id) { if (by[id]) groups[id] = summarise(by[id].all); });
    var m = makeSVG(holder, 340);
    el("title", {}, m.svg).textContent = "Water contact angle before any wear, three swatches per sample, grouped by fabric.";
    stripPanel(m.svg, { x: 0, y: 0, w: m.w, h: 340 }, {
      title: "Contact angle, before any wear", y0: 90, y1: 150, ticks: [90, 110, 130, 150], groups: groups,
      countLabel: "swatches",
      label: function (s) { return "mean " + fmt1(s.mean) + ", swatches " + swatchList(s); }
    });
    return { svg: m.svg, table: tableView("Contact angle before any wear. Per swatch: median angle 2 to 10 s after landing.",
      ["Sample", "Fabric", "Mean", "Swatches"],
      ORDER.filter(function (id) { return groups[id]; }).map(function (id) {
        return [id + " " + BY_ID[id].name, FABRIC_NAME[BY_ID[id].fabric], fmt1(groups[id].mean), swatchList(groups[id])];
      })) };
  }

  /* ---------- chart: shedding, before washing ---------- */
  function renderShedding(holder, rows) {
    var small = groupBy(rows.filter(function (r) { return r.dataset === "rolloff_small"; }), function () { return "all"; });
    var large = groupBy(rows.filter(function (r) { return r.dataset === "rolloff_durability" && r.exposure === "none"; }), function () { return "all"; });
    var gs = {}, gl = {};
    ORDER.forEach(function (id) {
      if (small[id]) gs[id] = summarise(small[id].all);
      if (large[id]) gl[id] = summarise(large[id].all);
    });
    var twoUp = holder.clientWidth >= 640;
    var H = twoUp ? 360 : 720;
    var m = makeSVG(holder, H);
    el("title", {}, m.svg).textContent = "Roll off angle before washing, with a smaller drop and with a larger drop of about 33 microlitres.";
    var pw = twoUp ? (m.w - 28) / 2 : m.w;
    var common = { y0: 0, y1: 90, ticks: [0, 30, 60, 90], censorBand: true, countLabel: "drops released",
      label: function (s) { return s.nReleased + " of " + s.n + " drops released" + (s.mean != null ? ", mean " + fmt1(s.mean) : ""); } };
    stripPanel(m.svg, { x: 0, y: 0, w: pw, h: 360 }, Object.assign({ title: "Smaller drop, 1 July", groups: gs }, common));
    stripPanel(m.svg, twoUp ? { x: pw + 28, y: 0, w: pw, h: 360 } : { x: 0, y: 360, w: pw, h: 360 },
      Object.assign({ title: "Larger drop (about 33 µL), 2 July", groups: gl }, common));
    function rowsFor(label, g) {
      return ORDER.filter(function (id) { return g[id]; }).map(function (id) {
        return [id + " " + label, FABRIC_NAME[BY_ID[id].fabric], g[id].mean != null ? fmt1(g[id].mean) : "none",
          g[id].nReleased + " of " + g[id].n, swatchList(g[id])];
      });
    }
    return { svg: m.svg, table: tableView("Roll off before washing. * marks a mean of only the drops that released.",
      ["Sample, drop", "Fabric", "Mean", "Released", "Each drop"], rowsFor("smaller", gs).concat(rowsFor("larger", gl))) };
  }

  /* ---------- chart: durability small multiples ---------- */
  var durState = { isolate: null, swatches: true };
  var durCharts = [];

  function renderDurability(holder, rows, metric) {
    var ds = metric === "rolloff" ? "rolloff_durability" : "wca_durability";
    var data = rows.filter(function (r) { return r.dataset === ds; });
    var cfg = metric === "rolloff"
      ? { y0: 0, y1: 90, ticks: [0, 30, 60, 90], band: true, noun: "Roll off", better: "lower sheds more easily" }
      : { y0: 90, y1: 160, ticks: [90, 110, 130, 150], band: false, noun: "Contact angle", better: "higher beads more" };

    var cols = holder.clientWidth >= 760 ? 4 : 2;
    var gap = 18, pw = (holder.clientWidth - gap * (cols - 1)) / cols, ph = 250;
    var nrows = Math.ceil(4 / cols), H = nrows * ph + (nrows - 1) * 12;
    var m = makeSVG(holder, H);
    el("title", {}, m.svg).textContent = cfg.noun + " through 20 wash cycles and 200 abrasion passes, by fabric. Lines join the mean of the swatches; dots are single swatches.";

    var panels = [
      { exp: "wash", fabric: "cotton" }, { exp: "wash", fabric: "finisterre" },
      { exp: "abrasion", fabric: "cotton" }, { exp: "abrasion", fabric: "finisterre" }
    ];
    var tableRows = [];

    panels.forEach(function (p, i) {
      var bx = (i % cols) * (pw + gap), by = Math.floor(i / cols) * (ph + 12);
      var g = el("g", {}, m.svg);
      var left = bx + 34, right = bx + pw - 8, top = by + 36, bottom = by + ph - 36;
      var bandH = cfg.band ? 20 : 0;
      var xmax = p.exp === "wash" ? 20 : 200;
      var x = scale(0, xmax, left + 8, right - 8);
      var y = scale(cfg.y0, cfg.y1, bottom, top + bandH);
      text(g, bx, by + 12, (p.exp === "wash" ? "Washing" : "Abrasion") + " · " + (p.fabric === "cotton" ? "cotton" : "Finisterre"), { fill: INK, "font-size": cols === 4 ? 12 : 11, "font-weight": 600 });
      cfg.ticks.forEach(function (v) {
        el("line", { x1: left, x2: right, y1: y(v), y2: y(v), stroke: GRID, "stroke-width": 1 }, g);
        if (i % cols === 0 && !(cfg.band && v === 90)) text(g, left - 6, y(v) + 4, v + "°", { "text-anchor": "end", "font-size": 10 });
      });
      if (cfg.band) {
        el("rect", { x: left, y: top, width: right - left, height: bandH - 4, fill: BAND, rx: 4 }, g);
        if (i % cols === 0) text(g, left - 6, top + 11, ">90°", { "text-anchor": "end", "font-size": 10 });
      }
      var stages = {};
      data.forEach(function (r) {
        if (BY_ID[r.sample].fabric !== p.fabric) return;
        if (r.exposure !== "none" && r.exposure !== p.exp) return;
        stages[r.cycles] = true;
      });
      var xs = Object.keys(stages).map(Number).sort(function (a, b) { return a - b; });
      /* every stage gets a tick; only well spaced stages get a number */
      var labelled = p.exp === "wash" ? [0, 5, 10, 20] : [0, 50, 100, 200];
      xs.forEach(function (c) {
        el("line", { x1: x(c), x2: x(c), y1: bottom, y2: bottom + 4, stroke: INK2, "stroke-width": 1 }, g);
        if (labelled.indexOf(c) >= 0) text(g, x(c), bottom + 16, String(c), { "text-anchor": "middle", "font-size": 10 });
      });
      text(g, (left + right) / 2, bottom + 30, p.exp === "wash" ? "wash cycles" : "abrasion passes", { "text-anchor": "middle", "font-size": 10 });

      var ids = SAMPLES.filter(function (s) { return s.fabric === p.fabric; }).map(function (s) { return s.id; });
      var series = {};
      ids.forEach(function (id) {
        var rs = data.filter(function (r) { return r.sample === id && (r.exposure === "none" || r.exposure === p.exp); });
        var byC = {};
        rs.forEach(function (r) { (byC[r.cycles] = byC[r.cycles] || []).push(r); });
        series[id] = xs.filter(function (c) { return byC[c]; }).map(function (c) { var s = summarise(byC[c]); s.cycles = c; return s; });
      });

      ids.forEach(function (id) {
        var col = BY_ID[id].color, dim = durState.isolate && durState.isolate !== id;
        var sg = el("g", { opacity: dim ? 0.12 : 1, "data-sample": id }, g);
        var pts = series[id].filter(function (s) { return s.mean != null; });
        if (durState.swatches) {
          series[id].forEach(function (s) {
            s.rows.forEach(function (r) {
              var dx = (r.swatch - 2) * 3;
              if (r.value == null) {
                var tx = x(s.cycles) + dx, ty = top + (bandH - 4) / 2 + 2;
                el("path", { d: "M" + tx + "," + (ty - 4.5) + " L" + (tx + 4.5) + "," + (ty + 3.5) + " L" + (tx - 4.5) + "," + (ty + 3.5) + " Z", fill: col }, sg);
              } else {
                el("circle", { cx: x(s.cycles) + dx, cy: y(r.value), r: 2.4, fill: col, opacity: 0.5 }, sg);
              }
            });
          });
        }
        el("path", { d: pts.map(function (s, k) { return (k ? "L" : "M") + x(s.cycles) + "," + y(s.mean); }).join(" "),
          fill: "none", stroke: col, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }, sg);
        pts.forEach(function (s) {
          var partial = s.nReleased < s.n;
          el("circle", { cx: x(s.cycles), cy: y(s.mean), r: 4, fill: partial ? SURFACE : col, stroke: partial ? col : SURFACE, "stroke-width": 2 }, sg);
        });
        var first = series[id][0], last = series[id][series[id].length - 1];
        if (first && last && first.mean != null && last.mean != null) {
          tableRows.push([id + " " + BY_ID[id].name, FABRIC_NAME[p.fabric] + ", " + (p.exp === "wash" ? "washing" : "abrasion"),
            fmt1(first.mean), fmt1(last.mean) + (last.nReleased < last.n ? " (" + last.nReleased + " of " + last.n + " released)" : ""),
            series[id].map(function (s) { return s.cycles + ": " + (s.mean != null ? fmt1(s.mean) : "none"); }).join("; ")]);
        }
      });

      /* stage crosshair: nearest cycle wins, one tooltip lists every series */
      var cross = el("line", { y1: top, y2: bottom, stroke: INK2, "stroke-width": 1, opacity: 0 }, g);
      var hit = el("rect", { x: left, y: top, width: right - left, height: bottom - top, fill: "transparent", tabindex: 0, role: "img",
        "aria-label": cfg.noun + ", " + (p.exp === "wash" ? "washing" : "abrasion") + ", " + FABRIC_NAME[p.fabric] + ". Use arrow keys to step through the stages." }, g);
      var idx = 0;
      function show(k) {
        idx = Math.max(0, Math.min(xs.length - 1, k));
        var c = xs[idx];
        cross.setAttribute("x1", x(c)); cross.setAttribute("x2", x(c)); cross.setAttribute("opacity", 0.5);
        var lines = [];
        ids.forEach(function (id) {
          if (durState.isolate && durState.isolate !== id) return;
          var s = series[id].filter(function (q) { return q.cycles === c; })[0];
          if (!s) return;
          lines.push({ color: BY_ID[id].color, value: s.mean != null ? fmt1(s.mean) : "none",
            label: id + (s.nReleased < s.n ? ", " + s.nReleased + " of " + s.n + " released" : "") + " (" + swatchList(s) + ")" });
        });
        var hr = hit.getBoundingClientRect(), px = hr.left + (x(c) - left) / (right - left) * hr.width;
        showTip({ left: px, width: 0, top: hr.top, bottom: hr.bottom }, (c === 0 ? "Before wear" : c + (p.exp === "wash" ? " wash cycles" : " abrasion passes")) + " · " + FABRIC_NAME[p.fabric].toLowerCase(), lines);
      }
      function nearest(evt) {
        var hr = hit.getBoundingClientRect(), vx = left + (evt.clientX - hr.left) / hr.width * (right - left), best = 0;
        xs.forEach(function (c, k) { if (Math.abs(x(c) - vx) < Math.abs(x(xs[best]) - vx)) best = k; });
        return best;
      }
      function off() { cross.setAttribute("opacity", 0); hideTip(); }
      hit.addEventListener("pointermove", function (e) { show(nearest(e)); });
      hit.addEventListener("pointerdown", function (e) { show(nearest(e)); });
      hit.addEventListener("pointerleave", off);
      hit.addEventListener("focus", function () { show(idx); });
      hit.addEventListener("blur", off);
      hit.addEventListener("keydown", function (e) {
        if (e.key === "ArrowRight") { show(idx + 1); e.preventDefault(); }
        if (e.key === "ArrowLeft") { show(idx - 1); e.preventDefault(); }
        if (e.key === "Escape") off();
      });
    });

    return { svg: m.svg, table: tableView(cfg.noun + " before wear and at the last stage, mean of swatches (" + cfg.better + ").",
      ["Sample", "Fabric, test", "Before", "Last stage", "Every stage"], tableRows) };
  }

  /* ---------- durability controls: one row above both charts ---------- */
  function buildDurControls(host) {
    var row = h("div", "chart-controls");
    var legend = h("div", "chart-legend");
    legend.setAttribute("role", "group");
    legend.setAttribute("aria-label", "Show one sample");
    SAMPLES.forEach(function (s) {
      var b = h("button", "chart-key");
      b.type = "button";
      b.setAttribute("aria-pressed", "false");
      var line = h("span", "chart-key-line");
      line.style.background = s.color;
      b.appendChild(line);
      b.appendChild(h("b", null, s.id));
      b.appendChild(h("span", null, " " + s.name));
      b.addEventListener("click", function () {
        durState.isolate = durState.isolate === s.id ? null : s.id;
        [].forEach.call(legend.children, function (k, i) {
          k.setAttribute("aria-pressed", String(SAMPLES[i].id === durState.isolate));
        });
        redrawDurability();
      });
      legend.appendChild(b);
    });
    var sw = h("label", "chart-switch");
    var cb = h("input");
    cb.type = "checkbox";
    cb.checked = true;
    cb.addEventListener("change", function () { durState.swatches = cb.checked; redrawDurability(); });
    sw.appendChild(cb);
    sw.appendChild(document.createTextNode(" Show single swatches"));
    row.appendChild(legend);
    row.appendChild(sw);
    var key = h("p", "chart-keynote", "Line and filled circle: mean of the swatches. Small dots: single swatches. Open circle: mean of fewer than three, because a swatch did not release. Triangle in the band marked >90°: the drop had not moved by 90°.");
    host.appendChild(row);
    host.appendChild(key);
  }

  /* ---------- chart: how one contact angle recording becomes one number ---------- */
  var GON = null;
  function renderGoniometer(holder) {
    var BLUE = "#2a78d6", ORANGE = "#c2410c", GREY = "#b3ab9c";
    var frames = GON.map(function (r) {
      return { t: +r.t_s, l: r.left_deg === "" ? null : +r.left_deg, r: r.right_deg === "" ? null : +r.right_deg,
        lok: r.left_ok === "True", rok: r.right_ok === "True",
        avg: r.instrument_avg_deg === "" ? null : +r.instrument_avg_deg, f: r.filtered_deg === "" ? null : +r.filtered_deg };
    });
    function median(a) { a = a.slice().sort(function (p, q) { return p - q; }); var m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }
    var inWin = frames.filter(function (d) { return d.t >= 2 && d.t <= 10; });
    var medF = median(inWin.filter(function (d) { return d.f != null; }).map(function (d) { return d.f; }));
    var medA = median(inWin.filter(function (d) { return d.avg != null; }).map(function (d) { return d.avg; }));
    var rejected = frames.reduce(function (n, d) { return n + (d.l != null && !d.lok ? 1 : 0) + (d.r != null && !d.rok ? 1 : 0); }, 0);

    var KEYS = [["dot", "#8a8374", "fit kept"], ["ring", ORANGE, "fit rejected"], ["line", GREY, "plain average"], ["line", BLUE, "filtered"]];
    var keyW = function (k) { return 14 + k[2].length * 6.4 + 16; };   /* monospace, so width is predictable */
    var Wd = Math.max(280, holder.clientWidth);
    var twoRows = KEYS.reduce(function (t, k) { return t + keyW(k); }, 40) > Wd;
    var H = twoRows ? 316 : 300;
    var svg = el("svg", { width: Wd, height: H, viewBox: "0 0 " + Wd + " " + H, class: "chart-svg" });
    el("title", {}, svg).textContent = "Left and right contact angle for every video frame of one drop on C-A1, with rejected fits, the instrument's plain average and the filtered value.";
    var left = 40, right = Wd - 8, top = twoRows ? 46 : 30, bottom = H - 38;
    var tmax = frames[frames.length - 1].t;
    var x = scale(0, tmax, left, right), y = scale(115, 160, bottom, top);
    /* legend row */
    var lx = left, ly = 12;
    KEYS.forEach(function (k, i) {
      if (twoRows && i === 2) { lx = left; ly += 16; }
      if (k[0] === "dot") el("circle", { cx: lx + 4, cy: ly, r: 3, fill: k[1] }, svg);
      else if (k[0] === "ring") el("circle", { cx: lx + 4, cy: ly, r: 3, fill: "none", stroke: k[1], "stroke-width": 1.5 }, svg);
      else el("line", { x1: lx - 2, x2: lx + 10, y1: ly, y2: ly, stroke: k[1], "stroke-width": 2 }, svg);
      text(svg, lx + 14, ly + 4, k[2], { "font-size": 10.5 });
      lx += keyW(k);
    });
    el("rect", { x: x(2), y: top, width: x(10) - x(2), height: bottom - top, fill: BAND }, svg);
    text(svg, x(6), bottom - 6, "2 to 10 s window", { "text-anchor": "middle", "font-size": 10 });
    [120, 130, 140, 150, 160].forEach(function (v) {
      el("line", { x1: left, x2: right, y1: y(v), y2: y(v), stroke: GRID }, svg);
      text(svg, left - 6, y(v) + 4, v + "°", { "text-anchor": "end", "font-size": 10 });
    });
    for (var sec = 0; sec <= tmax; sec += 2) text(svg, x(sec), bottom + 16, String(sec), { "text-anchor": "middle", "font-size": 10 });
    text(svg, (left + right) / 2, bottom + 31, "seconds after the first good fit", { "text-anchor": "middle", "font-size": 10 });
    var gp = el("g", {}, svg);
    frames.forEach(function (d, i) {
      if (i % 2) return;                             /* every other frame keeps the plot readable */
      [[d.l, d.lok], [d.r, d.rok]].forEach(function (s2) {
        if (s2[0] == null || s2[0] < 115 || s2[0] > 160) return;
        if (s2[1]) el("circle", { cx: x(d.t), cy: y(s2[0]), r: 1.8, fill: "#8a8374", opacity: 0.55 }, gp);
        else el("circle", { cx: x(d.t), cy: y(s2[0]), r: 2.4, fill: "none", stroke: ORANGE, "stroke-width": 1.1, opacity: 0.8 }, gp);
      });
    });
    function pathOf(key) {
      return frames.filter(function (d) { return d[key] != null; }).map(function (d, i) { return (i ? "L" : "M") + x(d.t) + "," + y(d[key]); }).join(" ");
    }
    el("path", { d: pathOf("avg"), fill: "none", stroke: GREY, "stroke-width": 1, opacity: 0.8 }, svg);
    el("path", { d: pathOf("f"), fill: "none", stroke: BLUE, "stroke-width": 2, "stroke-linejoin": "round" }, svg);
    el("line", { x1: x(2), x2: x(10), y1: y(medF), y2: y(medF), stroke: INK, "stroke-width": 2 }, svg);
    var labBg = el("rect", { x: x(2) + 2, y: y(medF) + 6, width: 128, height: 16, fill: SURFACE, opacity: 0.9, rx: 3 }, svg);
    text(svg, x(2) + 6, y(medF) + 18, fmt1(medF) + " swatch value", { fill: INK, "font-size": 10.5, "font-weight": 600 });

    var cross = el("line", { y1: top, y2: bottom, stroke: INK2, opacity: 0 }, svg);
    var hit = el("rect", { x: left, y: top, width: right - left, height: bottom - top, fill: "transparent", tabindex: 0, role: "img",
      "aria-label": "Frame by frame fit. Arrow keys step through the recording one second at a time." }, svg);
    var cur = 2;
    function show(tq) {
      cur = Math.max(0, Math.min(tmax, tq));
      var d = frames.reduce(function (b, q) { return Math.abs(q.t - cur) < Math.abs(b.t - cur) ? q : b; }, frames[0]);
      cross.setAttribute("x1", x(d.t)); cross.setAttribute("x2", x(d.t)); cross.setAttribute("opacity", 0.5);
      var f = function (v, ok) { return v == null ? "no fit" : fmt1(v) + (ok ? "" : ", rejected"); };
      var hr = hit.getBoundingClientRect(), px = hr.left + (x(d.t) - left) / (right - left) * hr.width;
      showTip({ left: px, width: 0, top: hr.top, bottom: hr.bottom }, d.t.toFixed(2) + " s", [
        { value: f(d.l, d.lok), label: "left side" }, { value: f(d.r, d.rok), label: "right side" },
        { color: GREY, value: d.avg == null ? "n/a" : fmt1(d.avg), label: "plain average" },
        { color: BLUE, value: d.f == null ? "n/a" : fmt1(d.f), label: "filtered" }]);
    }
    function off() { cross.setAttribute("opacity", 0); hideTip(); }
    hit.addEventListener("pointermove", function (e) { var hr = hit.getBoundingClientRect(); show((e.clientX - hr.left) / hr.width * tmax); });
    hit.addEventListener("pointerleave", off);
    hit.addEventListener("focus", function () { show(cur); });
    hit.addEventListener("blur", off);
    hit.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { show(cur + 1); e.preventDefault(); }
      if (e.key === "ArrowLeft") { show(cur - 1); e.preventDefault(); }
      if (e.key === "Escape") off();
    });
    return { svg: svg, table: tableView("One drop on C-A1, swatch 1, 29 June 2026. Values over the 2 to 10 s window.",
      ["Quantity", "Frames", "Value", "Note"], [
        ["Filtered, then median", String(inWin.length), fmt1(medF), "the swatch value used in the results"],
        ["Plain average, then median", String(inWin.length), fmt1(medA), "what the instrument's own average gives"],
        ["Rejected side fits", String(frames.length) + " frames", String(rejected), "fit RMSE above 1.0"]]) };
  }

  /* ---------- mount ---------- */
  var RENDER = { repellency: renderRepellency, goniometer: function (hd) { return renderGoniometer(hd); }, shedding: renderShedding,
    "durability-rolloff": function (hd, rows) { return renderDurability(hd, rows, "rolloff"); },
    "durability-wca": function (hd, rows) { return renderDurability(hd, rows, "wca"); } };
  var DATA = null;

  function mount(holder) {
    var kind = holder.getAttribute("data-chart");
    var stage = holder.querySelector(".chart-stage");
    if (!stage) {
      stage = h("div", "chart-stage");
      holder.appendChild(stage);
    }
    stage.textContent = "";
    if (kind === "goniometer" && !GON) return;
    var out = RENDER[kind](stage, DATA);
    stage.appendChild(out.svg);
    var old = holder.parentNode.querySelector(".chart-table");
    if (old) old.parentNode.removeChild(old);
    holder.parentNode.insertBefore(out.table, holder.nextSibling);
    var img = holder.querySelector("img");
    if (img) img.hidden = true;
  }
  function redrawDurability() {
    holders.forEach(function (hd) { if (/^durability/.test(hd.getAttribute("data-chart"))) mount(hd); });
  }

  function getText(url) { return fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }); }
  var gonReq = document.querySelector('[data-chart="goniometer"]')
    ? getText("data/goniometer_example.csv").then(function (t) { GON = parseCSV(t); }).catch(function () { GON = null; })
    : Promise.resolve();
  Promise.all([getText("data/observations.csv"), gonReq])
    .then(function (got) {
      var csv = got[0];
      DATA = parseCSV(csv);
      var ctl = document.getElementById("durability-controls");
      if (ctl) buildDurControls(ctl);
      holders.forEach(function (hd) { hd.classList.add("chart-live"); mount(hd); });
      var lastW = window.innerWidth, t = null;
      window.addEventListener("resize", function () {
        if (window.innerWidth === lastW) return;
        lastW = window.innerWidth;
        clearTimeout(t);
        t = setTimeout(function () { hideTip(); holders.forEach(mount); }, 150);
      }, { passive: true });
    })
    .catch(function () { /* leave the static figures in place */ });
})();

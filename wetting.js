/* Fluorine Free DWR - wetting concepts page: controls and drawing (vanilla, no deps).
   All physics comes from wetting-physics.js, which is unit tested. Nothing here is
   fitted to or describes the lab samples. Texture sizes in module 1 are fixed in
   micrometres and never rescale with the inputs. HOUSE STYLE: no em dashes. */
(function () {
  "use strict";

  var P = window.WettingPhysics;
  if (!P || !document.getElementById("cWenzel")) return;

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var MONO = '"Geist Mono", ui-monospace, Menlo, monospace';
  var COL = {
    paper: "#f6f3ec", paper2: "#efeae0", ink: "#17150f", ink2: "#5b564a", teal: "#0e6e5c",
    tealDeep: "#0a5546", line: "#ddd7c9", water: "#cfe3ee", waterEdge: "#4d8fae", solid: "#d9d2c1", air: "#ffffff"
  };
  function rad(d) { return d * Math.PI / 180; }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function $(id) { return document.getElementById(id); }

  /* ---------- a slider and a number box that stay in step ---------- */
  function bind(rangeId, numId, onChange) {
    var r = $(rangeId), n = $(numId);
    function set(v, from) {
      v = clamp(parseFloat(v), parseFloat(r.min), parseFloat(r.max));
      if (isNaN(v)) return;
      if (from !== r) r.value = v;
      if (from !== n) n.value = v;
      onChange();
    }
    r.addEventListener("input", function () { set(r.value, r); });
    n.addEventListener("change", function () { set(n.value, null); });
    return { get: function () { return parseFloat(r.value); } };
  }

  /* ---------- canvas sizing ---------- */
  function fit(canvas, ratio, lo, hi) {
    var w = canvas.clientWidth;
    if (!w) return null;
    var h = Math.round(clamp(w * ratio, lo, hi)), dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.height = h + "px";
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: h };
  }
  function label(ctx, str, x, y, align, color, weight) {
    ctx.fillStyle = color || COL.ink2;
    ctx.font = (weight || "500") + " 11px " + MONO;
    ctx.textAlign = align || "left";
    ctx.textBaseline = "middle";
    ctx.fillText(str, x, y);
  }
  function wrapText(ctx, str, x, y, maxW, lh) {
    var words = str.split(" "), line = "", lines = [], i, test;
    for (i = 0; i < words.length; i++) {
      test = line ? line + " " + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = words[i]; } else line = test;
    }
    lines.push(line);
    lines.forEach(function (l, k) { ctx.fillText(l, x, y + (k - (lines.length - 1) / 2) * lh); });
  }

  /* ===================================================================
     MODULE 1: same angle, two explanations
     =================================================================== */
  var PITCH = 40;          /* um, both textures */
  var W_PILLAR = 20;       /* um, filled texture: fixed pillar width, height follows r */
  var H_PILLAR = 30;       /* um, air texture: fixed height, width follows fs */
  var H_MAX = 110;         /* um, tallest pillar drawn */

  var aY = bind("aY", "aYn", renderA), aS = bind("aS", "aSn", renderA);

  /* the whole drop, same angle in both panels; returns the magnifier anchor */
  function drawMacroDrop(ctx, w, top, baseY, theta) {
    var c = Math.cos(rad(theta));
    var R = Math.min((baseY - top - 6) / (1 - c), w * 0.2);
    var cx = w * 0.42, yc = baseY + R * c, half = R * Math.sin(rad(theta));
    ctx.strokeStyle = COL.line; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(10, baseY); ctx.lineTo(w - 10, baseY); ctx.stroke();
    ctx.beginPath();
    var N = 80, i, phi;
    for (i = 0; i <= N; i++) {
      phi = -Math.PI / 2 - rad(theta) + 2 * rad(theta) * (i / N);
      if (i === 0) ctx.moveTo(cx + R * Math.cos(phi), yc + R * Math.sin(phi));
      else ctx.lineTo(cx + R * Math.cos(phi), yc + R * Math.sin(phi));
    }
    ctx.closePath();
    ctx.fillStyle = COL.water; ctx.fill();
    ctx.strokeStyle = COL.waterEdge; ctx.lineWidth = 1.5; ctx.stroke();
    /* angle through the liquid at the right contact point */
    var rx = cx + half;
    ctx.strokeStyle = COL.tealDeep; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.arc(rx, baseY, 15, Math.PI, Math.PI + rad(theta), false); ctx.stroke();
    label(ctx, Math.round(theta) + "°", rx + 14, baseY - 22, "left", COL.tealDeep, "600");
    ctx.strokeStyle = COL.ink2; ctx.lineWidth = 1;
    ctx.strokeRect(rx - 8, baseY - 8, 16, 13);
    return { x: rx, y: baseY + 5 };
  }

  function drawTexture(ctx, w, top, bottom, mode, dims, anchor) {
    var viewUm = PITCH * 5, liquidUm = 22;
    var s = Math.min((w - 20) / viewUm, (bottom - top - 24) / (dims.h + liquidUm + 4));
    var left = (w - viewUm * s) / 2, base = bottom - 18, i;
    var tops = base - dims.h * s;
    ctx.strokeStyle = COL.line; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(anchor.x - 8, anchor.y); ctx.lineTo(left, tops - liquidUm * s);
    ctx.moveTo(anchor.x + 8, anchor.y); ctx.lineTo(left + viewUm * s, tops - liquidUm * s);
    ctx.stroke();
    ctx.fillStyle = COL.solid;
    ctx.fillRect(left, base, viewUm * s, 6);
    ctx.fillStyle = COL.water;
    ctx.fillRect(left, tops - liquidUm * s, viewUm * s, liquidUm * s);
    ctx.fillStyle = mode === "wenzel" ? COL.water : COL.air;
    ctx.fillRect(left, tops, viewUm * s, dims.h * s);
    for (i = 0; i < 5; i++) {
      var x0 = left + (i * PITCH + (PITCH - dims.a) / 2) * s;
      ctx.fillStyle = COL.solid;
      ctx.fillRect(x0, tops, dims.a * s, dims.h * s);
      if (mode === "cassie" && i < 4) {
        var gL = x0 + dims.a * s, gR = left + ((i + 1) * PITCH + (PITCH - dims.a) / 2) * s;
        ctx.fillStyle = COL.water;
        ctx.beginPath();
        ctx.moveTo(gL, tops);
        ctx.quadraticCurveTo((gL + gR) / 2, tops + Math.min(5, (gR - gL) * 0.18), gR, tops);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = COL.waterEdge; ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(gL, tops);
        ctx.quadraticCurveTo((gL + gR) / 2, tops + Math.min(5, (gR - gL) * 0.18), gR, tops);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = COL.waterEdge; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(left, tops - liquidUm * s); ctx.lineTo(left + viewUm * s, tops - liquidUm * s); ctx.stroke();
    var bar = 20 * s, by = bottom - 4;
    ctx.strokeStyle = COL.ink2; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(left, by - 3); ctx.lineTo(left, by); ctx.lineTo(left + bar, by); ctx.lineTo(left + bar, by - 3); ctx.stroke();
    label(ctx, "20 µm", left + bar + 6, by - 2);
    label(ctx, mode === "wenzel" ? "water in the gaps" : "air in the gaps", left + viewUm * s, by - 2, "right");
  }

  function panelA(canvasId, mode, thetaStar, need) {
    var c = fit($(canvasId), 0.78, 240, 320);
    if (!c) return;
    var ctx = c.ctx, w = c.w, h = c.h, msg = null, dims = null;
    ctx.clearRect(0, 0, w, h);
    var anchor = drawMacroDrop(ctx, w, 8, h * 0.36, thetaStar);
    if (!need.ok) msg = "Not possible: " + need.reason;
    else if (mode === "wenzel") {
      dims = { a: W_PILLAR, h: (need.value - 1) * PITCH * PITCH / (4 * W_PILLAR) };
      if (dims.h > H_MAX) msg = "Not reachable with these pillars: they would need to be " + Math.round(dims.h) + " µm tall";
    } else {
      dims = { a: PITCH * Math.sqrt(need.value), h: H_PILLAR };
    }
    if (msg) {
      ctx.fillStyle = COL.ink2; ctx.font = "500 12px " + MONO; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      wrapText(ctx, msg, w / 2, h * 0.68, w - 40, 16);
      return;
    }
    drawTexture(ctx, w, h * 0.44, h, mode, dims, anchor);
  }

  function cap(str) { return str.charAt(0).toUpperCase() + str.slice(1) + "."; }

  function renderA() {
    var ty = aY.get(), ts = aS.get();
    var nr = P.requiredR(ts, ty), nf = P.requiredFs(ts, ty);
    panelA("cWenzel", "wenzel", ts, nr);
    panelA("cCassie", "cassie", ts, nf);
    var wh = nr.ok ? (nr.value - 1) * PITCH * PITCH / (4 * W_PILLAR) : null;
    $("oR").innerHTML = nr.ok ? "r = " + nr.value.toFixed(2) + " <span>roughness needed</span>" : "not possible <span>roughness</span>";
    $("oF").innerHTML = nf.ok ? "f<sub>s</sub> = " + Math.round(nf.value * 100) + "% <span>solid contact needed</span>" : "not possible <span>solid contact</span>";
    $("oRnote").textContent = !nr.ok ? cap(nr.reason)
      : (wh > H_MAX ? "More extra surface than these pillars can give." : "With 20 µm pillars every 40 µm, that means pillars about " + Math.round(wh) + " µm tall.");
    $("oFnote").textContent = !nf.ok ? cap(nf.reason)
      : "With 30 µm pillars every 40 µm, the pillar tops would be about " + Math.round(PITCH * Math.sqrt(nf.value)) + " µm wide.";
    $("aNote").textContent = ts <= ty
      ? "On a water repellent material, neither ideal state can give a measured angle at or below the smooth surface angle."
      : "Both pictures give exactly " + Math.round(ts) + "°. A goniometer reading on its own cannot tell you which one you have, and the next model shows why that matters for whether the drop runs off.";
    $("aLive").textContent = "Smooth " + ty + " degrees, measured " + ts + " degrees. " + $("oR").textContent + ". " + $("oF").textContent + ".";
  }

  /* ===================================================================
     MODULE 2: what makes a drop let go
     =================================================================== */
  var bA = bind("bA", "bAn", renderB), bR = bind("bR", "bRn", renderB),
      bV = bind("bV", "bVn", renderB), bK = bind("bK", "bKn", renderB);
  var res = null, tilt = 0, slide = 0, raf = null, phase = "idle", t0 = 0, limit = 0, settleTimer = null;

  function inputsB() { return { thetaA: bA.get(), thetaR: bR.get(), vol: bV.get(), k: bK.get() }; }

  /* drop outline in mm, y up from the surface; the downhill lean makes the front
     edge steeper as the stage tilts (drawing only, the number comes from Furmidge) */
  function dropPoints(Rmm, thetaDeg, lean) {
    var th = rad(thetaDeg), pts = [], i, phi, x, u, N = 96;
    var yc = -Rmm * Math.cos(th), L = Math.max(Rmm * (1 - Math.cos(th)) * 0.45, 1e-4);
    for (i = 0; i <= N; i++) {
      phi = Math.PI / 2 - th + 2 * th * (i / N);
      x = Rmm * Math.cos(phi);
      u = Math.max(0, yc + Rmm * Math.sin(phi));
      pts.push([x + lean * L * (1 - Math.exp(-u / L)), u]);
    }
    return pts;
  }

  function drawTilt() {
    var c = fit($("cTilt"), 0.5, 220, 340);
    if (!c) return;
    var ctx = c.ctx, W = c.w, H = c.h, o = inputsB();
    ctx.clearRect(0, 0, W, H);
    if (!res || !res.ok) { label(ctx, "Receding cannot be above advancing.", W / 2, H / 2, "center"); return; }
    var theta = (o.thetaA + o.thetaR) / 2;
    var Rmm = (res.width * 1000 / 2) / Math.sin(rad(theta));
    var S = Math.min(W * 0.34 / (2 * Rmm), (H * 0.45) / (Rmm * (1 - Math.cos(rad(theta)))));
    var pivotY = H - 42 - clamp(tilt / 90, 0, 1) * H * 0.3, cx = W / 2;
    var frac = res.released ? clamp(tilt / res.alpha, 0, 1) : clamp(tilt / 90, 0, 1);
    var lean = clamp(1 / Math.tan(rad(theta)) - 1 / Math.tan(rad(o.thetaA)), 0, 1) * frac;

    ctx.save();
    ctx.translate(cx, pivotY);
    ctx.rotate(rad(tilt));
    ctx.fillStyle = COL.paper2; ctx.fillRect(-W, 0, 2 * W, H);
    ctx.strokeStyle = COL.line; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-W, 0); ctx.lineTo(W, 0); ctx.stroke();
    var pts = dropPoints(Rmm, theta, lean), i;
    ctx.translate(slide * Math.max(W, H), 0);
    ctx.globalAlpha = 1 - slide * 0.85;
    ctx.beginPath();
    ctx.moveTo(pts[0][0] * S, -pts[0][1] * S);
    for (i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * S, -pts[i][1] * S);
    ctx.closePath();
    ctx.fillStyle = COL.water; ctx.fill();
    ctx.strokeStyle = COL.waterEdge; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.restore();

    if (tilt > 2.5) {
      var tr = clamp(Math.min(W, H) * 0.25, 40, 110);
      ctx.strokeStyle = "rgba(91,86,74,.45)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx - tr * 0.4, pivotY); ctx.lineTo(cx + tr * 1.3, pivotY); ctx.stroke();
      ctx.strokeStyle = COL.tealDeep; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(cx, pivotY, tr, 0, rad(tilt)); ctx.stroke();
      label(ctx, Math.round(tilt) + "°", cx + Math.cos(rad(tilt / 2)) * (tr + 12), pivotY + Math.sin(rad(tilt / 2)) * (tr + 12), "left", COL.tealDeep, "600");
    }
    label(ctx, o.vol + " µL", W - 12, H - 14, "right");
    label(ctx, o.thetaA + "° / " + o.thetaR + "°", 12, H - 14);
  }

  function stopAnim() {
    if (raf) cancelAnimationFrame(raf);
    clearTimeout(settleTimer);
    raf = null; settleTimer = null; phase = "idle";
  }
  function runTilt() {
    stopAnim();
    tilt = 0; slide = 0;
    if (!res || !res.ok) return;
    limit = res.released ? res.alpha : 90;
    var done = res.released ? "Moved at " + Math.round(limit) + "°" : "No release by 90°";
    if (reduce) { tilt = limit; drawTilt(); $("tiltBtn").textContent = done; return; }
    phase = "tilting"; t0 = performance.now();
    raf = requestAnimationFrame(function step(now) {
      if (phase === "tilting") {
        var t = (now - t0) / (900 + limit * 14);
        tilt = limit * clamp(t, 0, 1);
        drawTilt();
        if (t >= 1) {
          if (!res.released) { $("tiltBtn").textContent = done; phase = "idle"; raf = null; return; }
          phase = "sliding"; t0 = now;
        }
      } else {
        var s = clamp((now - t0) / 700, 0, 1);
        slide = s * s;
        drawTilt();
        if (s >= 1) {
          $("tiltBtn").textContent = done; phase = "idle"; raf = null;
          settleTimer = setTimeout(function () { slide = 0; drawTilt(); }, 250);
          return;
        }
      }
      raf = requestAnimationFrame(step);
    });
  }
  $("tiltBtn").addEventListener("click", runTilt);

  /* roll off against drop volume (SVG, one series plus the k band) */
  var SVGNS = "http://www.w3.org/2000/svg";
  function svgEl(name, attrs, parent) {
    var n = document.createElementNS(SVGNS, name), k;
    for (k in attrs) n.setAttribute(k, attrs[k]);
    parent.appendChild(n);
    return n;
  }
  function svgText(parent, x, y, str, attrs) {
    var t = svgEl("text", Object.assign({ x: x, y: y, fill: COL.ink2, "font-family": MONO, "font-size": 11 }, attrs || {}), parent);
    t.textContent = str;
    return t;
  }

  function drawChart() {
    var svg = $("bChart"), o = inputsB();
    var W = 600, H = 250, left = 44, right = W - 12, top = 14, bottom = H - 36, bandH = 20;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.textContent = "";
    if (!res || !res.ok) return;
    var x = function (v) { return left + (v - 2) / 48 * (right - left); };
    var y = function (a) { return bottom - a / 90 * (bottom - top - bandH); };
    var yNone = top + (bandH - 4) / 2;
    [0, 30, 60, 90].forEach(function (a) {
      svgEl("line", { x1: left, x2: right, y1: y(a), y2: y(a), stroke: "#ebe6da" }, svg);
      if (a < 90) svgText(svg, left - 8, y(a) + 4, a + "°", { "text-anchor": "end" });
    });
    svgEl("rect", { x: left, y: top, width: right - left, height: bandH - 4, fill: "#f3efe6", rx: 4 }, svg);
    svgText(svg, left - 8, top + 12, ">90°", { "text-anchor": "end" });
    [2, 10, 20, 30, 40, 50].forEach(function (v) { svgText(svg, x(v), bottom + 16, String(v), { "text-anchor": "middle" }); });
    svgText(svg, (left + right) / 2, bottom + 31, "drop volume (µL)", { "text-anchor": "middle" });
    svgEl("line", { x1: x(33), x2: x(33), y1: top + bandH, y2: bottom, stroke: COL.line }, svg);
    svgText(svg, x(33) + 5, bottom - 6, "33 µL", { "font-size": 10 });

    function series(k) {
      var out = [], v, r;
      for (v = 2; v <= 50.001; v += 0.5) {
        r = P.rolloff({ thetaA: o.thetaA, thetaR: o.thetaR, vol: v, k: k });
        out.push([x(v), r.released ? y(r.alpha) : yNone]);
      }
      return out;
    }
    var lo = series(0.8), hi = series(1.3), mid = series(o.k);
    svgEl("polygon", { points: lo.concat(hi.slice().reverse()).map(function (p) { return p[0] + "," + p[1]; }).join(" "),
      fill: COL.teal, "fill-opacity": 0.1 }, svg);
    svgEl("path", { d: mid.map(function (p, i) { return (i ? "L" : "M") + p[0] + "," + p[1]; }).join(" "), fill: "none",
      stroke: COL.teal, "stroke-width": 2, "stroke-linejoin": "round" }, svg);
    svgEl("circle", { cx: x(o.vol), cy: res.released ? y(res.alpha) : yNone, r: 5, fill: COL.teal, stroke: "#fff", "stroke-width": 2 }, svg);

    var read = svgText(svg, right - 4, top + bandH + 16, "", { "text-anchor": "end", fill: COL.ink });
    var hit = svgEl("rect", { x: left, y: top, width: right - left, height: bottom - top, fill: "transparent", tabindex: 0,
      "aria-label": "Roll off against drop volume. Focus shows the value at the current volume." }, svg);
    function show(v) {
      v = clamp(Math.round(v), 2, 50);
      var f = function (k) { var r = P.rolloff({ thetaA: o.thetaA, thetaR: o.thetaR, vol: v, k: k }); return r.released ? Math.round(r.alpha) + "°" : "no release"; };
      read.textContent = v + " µL: " + f(o.k) + " (k 0.8 to 1.3: " + f(0.8) + " to " + f(1.3) + ")";
    }
    hit.addEventListener("pointermove", function (e) {
      var r = svg.getBoundingClientRect();
      show(2 + ((e.clientX - r.left) / r.width * W - left) / (right - left) * 48);
    });
    hit.addEventListener("pointerleave", function () { read.textContent = ""; });
    hit.addEventListener("focus", function () { show(o.vol); });
    hit.addEventListener("blur", function () { read.textContent = ""; });
  }

  function renderB() {
    stopAnim(); tilt = 0; slide = 0;
    $("tiltBtn").textContent = "Tilt test";
    var o = inputsB();
    res = P.rolloff(o);
    if (!res.ok) {
      $("oAlpha").textContent = "n/a"; $("oBond").textContent = "n/a"; $("oW").textContent = "n/a";
      $("bNote").textContent = "The receding angle cannot be above the advancing angle. Lower the receding angle or raise the advancing one.";
    } else {
      $("oAlpha").textContent = res.released ? Math.round(res.alpha) + "°" : "no release";
      $("oBond").textContent = res.bond.toFixed(2);
      $("oBond").className = res.bond > 0.3 ? "warn" : "";
      $("oW").textContent = (res.width * 1000).toFixed(1) + " mm";
      var note = res.released
        ? "Gravity wins at " + Math.round(res.alpha) + "° of tilt."
        : "Even tilted to vertical, the grip of the edge beats the drop's weight.";
      note += " The gap between advancing and receding is " + (o.thetaA - o.thetaR) + "°; a smaller gap, or a higher receding angle, lets go sooner.";
      if (res.bond > 0.3) note += " At this size gravity visibly flattens the drop, so the footprint and the roll off angle are less accurate.";
      $("bNote").textContent = note;
    }
    drawTilt();
    drawChart();
    $("bLive").textContent = "Roll off " + $("oAlpha").textContent + ", Bond number " + $("oBond").textContent + ".";
  }

  /* ===================================================================
     MODULE 3: an ideal textured surface
     =================================================================== */
  var cY = bind("cY", "cYn", renderC), cR = bind("cR", "cRn", renderC), cF = bind("cF", "cFn", renderC);
  function renderC() {
    var ty = cY.get(), r = cR.get(), fs = cF.get();
    var wz = P.wenzelAngle(ty, r), cb = P.cassieAngle(ty, fs), st = P.lowerEnergyState(ty, r, fs);
    $("oCW").textContent = wz <= 0 ? "wets out" : Math.round(wz) + "°";
    $("oCC").textContent = Math.round(cb) + "°";
    $("oCS").textContent = st.state === "cassie" ? "on air" : "filled";
    var note = ty < 90
      ? "The smooth material already wets, so filling the texture pulls the angle down, and real fabric would also soak water up. "
      : "";
    note += st.criticalAngle != null
      ? "With this texture, resting on air has the lower energy above a smooth surface angle of " + st.criticalAngle.toFixed(1) + "°."
      : "With this texture, filling the texture has the lower energy at every smooth surface angle.";
    $("cNote").textContent = note;
  }

  /* ---------- go ---------- */
  renderA(); renderB(); renderC();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { renderA(); drawTilt(); });
  var ideal = $("ideal");
  if (ideal) ideal.addEventListener("toggle", renderC);
  var lastW = window.innerWidth, resizeTimer = null;
  window.addEventListener("resize", function () {
    if (window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { renderA(); drawTilt(); }, 120);
  }, { passive: true });
})();

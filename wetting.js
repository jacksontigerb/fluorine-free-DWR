/* Fluorine-Free DWR - interactive wetting model (vanilla, no deps).
   Wenzel / Cassie-Baxter apparent contact angle + Furmidge roll-off angle,
   drawn as a cross-section on canvas. Degrades: no JS = static text + equations.
   HOUSE STYLE: no em dashes. */
(function () {
  "use strict";

  var canvas = document.getElementById("wetCanvas");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  /* ---------- constants ---------- */
  var GAMMA = 0.0728;   /* water surface tension, N/m */
  var RHO   = 1000;     /* kg/m3 */
  var GRAV  = 9.81;     /* m/s2 */
  var H_FLAT = 0.30;    /* intrinsic hysteresis on a smooth surface, cos(r) - cos(a) */

  var COL = {
    paper: "#f6f3ec", paper2: "#efeae0", ink: "#17150f", ink2: "#5b564a",
    teal: "#0e6e5c", tealDeep: "#0a5546", line: "#ddd7c9",
    water: "#cfe3ee", waterEdge: "#4d8fae", solid: "#e2dccd"
  };
  /* ---------- state ---------- */
  var state = { thetaY: 108, r: 2.0, fs: 0.46, vol: 10 };

  var PRESETS = [
    { id: "cu",   label: "Uncoated cotton",
      v: { thetaY: 45, r: 1.10, fs: 0.95, vol: 10 },
      note: "Cellulose is high energy, so water spreads and soaks in. Measured: about 39°, no roll-off." },
    { id: "a1",   label: "My coating (C-A1)",
      v: { thetaY: 108, r: 2.10, fs: 0.45, vol: 10 },
      note: "Waxy stearyl chains on a woven surface. Repellent chemistry, but not quite repellent enough for the drop to hold itself off the weave. Measured: 132 to 135°, pinned to the 90° limit." },
    { id: "c3",   label: "Coating + particles (C-C3)",
      v: { thetaY: 108, r: 2.20, fs: 0.40, vol: 10 },
      note: "Titanium dioxide adds texture, and the contact angle barely moves. Roughness alone cannot lift the drop while the chemistry sits below the threshold. Measured: about 133°, and the worst roll-off of the three." },
    { id: "dwr",  label: "Commercial DWR (F-DWR)",
      v: { thetaY: 118, r: 2.10, fs: 0.45, vol: 10 },
      note: "The same texture, ten degrees of chemistry apart, and the drop flips onto trapped air. Measured: 132°, rolls at about 24° after a wash." },
    { id: "lotus", label: "Lotus leaf",
      v: { thetaY: 112, r: 3.50, fs: 0.08, vol: 10 },
      note: "Waxy chemistry plus very sparse, tall texture. Real lotus sheds at 2 to 3°." }
  ];
  /* ---------- helpers ---------- */
  function rad(d) { return d * Math.PI / 180; }
  function deg(r) { return r * 180 / Math.PI; }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  /* ---------- physics ---------- */
  function compute(s) {
    var cY = Math.cos(rad(s.thetaY));
    var cW = s.r * cY;                    /* Wenzel */
    var cCB = s.fs * (cY + 1) - 1;        /* Cassie-Baxter */

    /* Cassie is the lower energy state when cos(thetaY) < (fs-1)/(r-fs) */
    var canAir = s.fs < 0.995 && s.r > 1.005;
    var cCrit = (s.r - s.fs) > 1e-6 ? (s.fs - 1) / (s.r - s.fs) : -1;
    var cassie = canAir && cY < cCrit;
    /* a metastable Cassie state only makes sense on a hydrophobic material */
    var metastable = canAir && !cassie && cY < 0 && cCB > -1 && cCB < cW;

    var mode = (!canAir && s.r <= 1.005) ? "flat" : (cassie ? "cassie" : "wenzel");
    var rawCos = cassie ? cCB : cW;
    var wetsOut = rawCos >= 1;
    var cosApp = clamp(rawCos, -0.9986, 0.9962);   /* keep 5 to 177 degrees for geometry */
    var theta = deg(Math.acos(cosApp));

    /* hysteresis: pinning scales with contact area (fs in Cassie, r in Wenzel) */
    var amp = cassie ? s.fs : s.r;
    var dcos = H_FLAT * amp;
    var cAdv = clamp(cosApp - dcos / 2, -1, 1);
    var cRec = clamp(cosApp + dcos / 2, -1, 1);
    var dEff = cRec - cAdv;
    /* if the advancing angle saturates the contact line cannot advance at all,
       so the drop is stuck rather than easier to move */
    var saturated = (cosApp - dcos / 2) < -1;

    /* spherical cap of the given volume */
    var V = s.vol * 1e-9;                                        /* m3 */
    var fcap = (Math.PI / 3) * (2 - 3 * cosApp + Math.pow(cosApp, 3));
    var R = Math.pow(V / fcap, 1 / 3);                           /* m */
    var w = 2 * R * Math.sin(rad(theta));                        /* contact width, m */

    /* Furmidge: rho V g sin(alpha) = gamma w (cos thetaR - cos thetaA) */
    var sinA = GAMMA * w * dEff / (RHO * V * GRAV);
    var pinned = wetsOut || saturated || theta < 15 || !(sinA < 1);
    var alpha = pinned ? null : deg(Math.asin(sinA));

    return {
      mode: mode, cassie: cassie, metastable: metastable, wetsOut: wetsOut,
      theta: theta, cosApp: cosApp,
      thetaAdv: deg(Math.acos(cAdv)), thetaRec: deg(Math.acos(cRec)),
      dcos: dEff, R: R * 1000, alpha: alpha, pinned: pinned,
      thetaCrit: canAir ? deg(Math.acos(clamp(cCrit, -1, 1))) : null
    };
  }
  /* ---------- drawing ---------- */
  var tilt = 0;        /* current drawn tilt, degrees */
  var slide = 0;       /* 0 to 1, drop sliding away */
  var res = compute(state);

  function fit() {
    var w = canvas.parentNode.clientWidth;
    var h = Math.round(clamp(w * 0.60, 280, 430));
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* Drop outline in mm, y measured up from the contact plane. The tilted drop is
     leaned downhill by a displacement d(u) = k*L*(1 - e^(-u/L)): the slope at the
     contact line is exactly k, which sets the contact angles, but it saturates
     higher up so the body stays round instead of shearing into a wedge. */
  function dropPoints(Rmm, thetaDeg, k) {
    var th = rad(thetaDeg), pts = [], i, phi, x, u;
    var yc = -Rmm * Math.cos(th);
    var L = Math.max(Rmm * (1 - Math.cos(th)) * 0.45, 1e-4);
    var p0 = Math.PI / 2 - th, p1 = Math.PI / 2 + th, N = 96;
    for (i = 0; i <= N; i++) {
      phi = p0 + (p1 - p0) * (i / N);
      x = Rmm * Math.cos(phi);
      u = yc + Rmm * Math.sin(phi);
      if (u < 0) u = 0;
      pts.push([x + k * L * (1 - Math.exp(-u / L)), u]);
    }
    return pts;
  }

  function draw() {
    var W = canvas.clientWidth, H = canvas.clientHeight;
    if (!W) return;
    ctx.clearRect(0, 0, W, H);

    var Rmm = res.R;
    var half = Rmm * Math.sin(rad(res.theta));                  /* contact half width, mm */

    /* texture: pitch follows the footprint so the drop always spans a few cells,
       then the pillar geometry follows from fs and r (a = pitch*sqrt(fs),
       r = 1 + 4*a*h/pitch^2) */
    var pitch = clamp(2 * half / 7, 0.04, 1.2);
    var wf = Math.sqrt(clamp(state.fs, 0.02, 0.999));
    var a = wf * pitch;
    var hp = clamp((state.r - 1) / (4 * wf) * pitch, 0, 2.4);   /* pillar height, mm */
    var flatTop = (pitch - a) < pitch * 0.04 || hp < pitch * 0.02;
    if (flatTop) hp = 0;

    /* frame the drop: scale so it fills the stage at any volume or angle */
    var slabPx = 24, labelPx = 46, padPx = 18;
    var drawH = Math.max(60, H - slabPx - labelPx - padPx);
    /* the drop's own box, then its bounding box once the stage is tilted */
    var boxW = res.theta > 90 ? 2 * Rmm : 2 * half;
    var boxH = Rmm * (1 - Math.cos(rad(res.theta))) + hp + pitch * 0.4;
    var ct = Math.abs(Math.cos(rad(tilt))), st = Math.abs(Math.sin(rad(tilt)));
    var needW = (boxW * ct + boxH * st) * 1.6;
    var needH = (boxW * st + boxH * ct) * 1.15;
    var S = clamp(Math.min(W * 0.9 / needW, drawH / needH), 4, 900);   /* px per mm */
    var floorY = H - slabPx - labelPx;
    var cx = W / 2;

    /* shear so the downhill contact angle grows towards the advancing angle */
    var frac = res.pinned ? (tilt / 90) : (res.alpha > 0.5 ? tilt / res.alpha : 0);
    var kMax = 1 / Math.tan(rad(res.theta)) - 1 / Math.tan(rad(res.thetaAdv));
    var k = clamp(kMax, 0, 1) * clamp(frac, 0, 1);

    /* lift the contact point as the stage tilts, so a steep surface stays in frame */
    var pivotY = floorY - clamp(tilt / 90, 0, 1) * drawH * 0.45;

    ctx.save();
    ctx.translate(cx, pivotY);
    ctx.rotate(rad(tilt));

    /* ---- substrate slab ---- */
    var ext = (W + H) / S;                       /* mm of surface to draw either side */
    ctx.fillStyle = COL.paper2;
    ctx.strokeStyle = COL.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(-ext * S, 0, 2 * ext * S, Math.max(H, W));
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-ext * S, 0);
    ctx.lineTo(ext * S, 0);
    ctx.stroke();

    /* ---- pillars ---- */
    var nMax = Math.min(Math.ceil(ext / pitch), 260), nMin = -nMax, n, x0;
    if (!flatTop) {
      ctx.fillStyle = COL.solid;
      ctx.strokeStyle = COL.line;
      for (n = nMin; n <= nMax; n++) {
        x0 = (n * pitch - a / 2) * S;
        ctx.beginPath();
        ctx.rect(x0, -hp * S, a * S, hp * S);
        ctx.fill();
        ctx.stroke();
      }
    }

    /* ---- water inside the texture ---- */
    ctx.fillStyle = COL.water;
    if (!flatTop) {
      for (n = nMin; n <= nMax; n++) {
        var gapL = (n * pitch + a / 2), gapR = ((n + 1) * pitch - a / 2);
        var mid = (gapL + gapR) / 2;
        if (Math.abs(mid) > half) continue;
        if (res.cassie) {
          /* trapped air: a sagging meniscus bridges the gap */
          var sag = Math.min(hp * 0.55, (gapR - gapL) * 0.4);
          ctx.beginPath();
          ctx.moveTo(gapL * S, -hp * S);
          ctx.quadraticCurveTo(mid * S, (-hp + sag * 2) * S, gapR * S, -hp * S);
          ctx.fill();                       /* fill closes the path, stroke leaves it open */
          ctx.strokeStyle = COL.waterEdge;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        } else {
          /* Wenzel: liquid fills the grooves */
          ctx.fillRect(gapL * S, -hp * S, (gapR - gapL) * S, hp * S);
        }
      }
    }

    /* ---- the drop ---- */
    var pts = dropPoints(Rmm, res.theta, k), i;
    ctx.save();
    ctx.translate(slide * Math.max(W, H) * 0.95, 0);
    ctx.globalAlpha = 1 - slide * 0.85;
    ctx.beginPath();
    ctx.moveTo(pts[0][0] * S, -(pts[0][1] + hp) * S);
    for (i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * S, -(pts[i][1] + hp) * S);
    ctx.closePath();
    ctx.fillStyle = COL.water;
    ctx.fill();
    ctx.strokeStyle = COL.waterEdge;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;

    /* ---- contact angle annotation, untilted only ---- */
    if (tilt < 0.5 && slide === 0 && !res.wetsOut) {
      var px = half * S, py = -hp * S;
      var arm = clamp(Rmm * S * 0.9, 26, 90);   /* annotation arm length, px */
      ctx.save();
      ctx.strokeStyle = "rgba(14,110,92,.55)";
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();                          /* surface reference, into the liquid */
      ctx.moveTo(px - arm, py);
      ctx.lineTo(px + arm * 0.45, py);
      ctx.stroke();
      ctx.beginPath();                          /* tangent at the contact line */
      ctx.moveTo(px, py);
      ctx.lineTo(px - Math.cos(rad(res.theta)) * arm, py - Math.sin(rad(res.theta)) * arm);
      ctx.stroke();
      ctx.setLineDash([]);
      /* the angle is measured through the liquid: from the surface pointing left
         round to the tangent, so sweep anticlockwise from (theta - 180) to -180 */
      ctx.beginPath();
      var ar = arm * 0.42;
      ctx.arc(px, py, ar, rad(res.theta) - Math.PI, -Math.PI, true);
      ctx.strokeStyle = COL.tealDeep;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      var mid = rad(res.theta) / 2 - Math.PI;             /* halfway round the sweep */
      ctx.fillStyle = COL.tealDeep;
      ctx.font = "600 12px ui-monospace, Menlo, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(Math.round(res.theta) + "°",
        px + Math.cos(mid) * (ar + 15), py + Math.sin(mid) * (ar + 15));
      ctx.restore();
    }

    ctx.restore();

    /* ---- tilt indicator, screen space ---- */
    if (tilt > 2.5) {
      var tr = clamp(Math.min(W, H) * 0.22, 40, 120);
      ctx.save();
      ctx.strokeStyle = "rgba(91,86,74,.45)";
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();                            /* horizontal reference */
      ctx.moveTo(cx - tr * 0.5, pivotY);
      ctx.lineTo(cx + tr * 1.35, pivotY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(cx, pivotY, tr, 0, rad(tilt));
      ctx.strokeStyle = COL.tealDeep;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = COL.tealDeep;
      ctx.font = "600 12px ui-monospace, Menlo, monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(Math.round(tilt) + "°",
        cx + Math.cos(rad(tilt / 2)) * (tr + 10), pivotY + Math.sin(rad(tilt / 2)) * (tr + 10));
      ctx.restore();
    }

    /* ---- scale bar: the view rescales with the drop, so say how big it is ---- */
    var steps = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10], mm = steps[0], j;
    for (j = 0; j < steps.length; j++) { if (steps[j] * S <= 120) mm = steps[j]; }
    var barPx = mm * S, bx = 14, by = H - 34;
    ctx.save();
    ctx.strokeStyle = COL.ink2;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx, by - 4); ctx.lineTo(bx, by); ctx.lineTo(bx + barPx, by); ctx.lineTo(bx + barPx, by - 4);
    ctx.stroke();
    ctx.font = "500 11px ui-monospace, Menlo, monospace";
    ctx.fillStyle = COL.ink2;
    ctx.textAlign = "left";
    ctx.fillText(mm < 1 ? (mm * 1000) + " µm" : mm + " mm", bx + barPx + 8, by);
    ctx.restore();

    /* ---- state label ---- */
    ctx.save();
    ctx.font = "500 11px ui-monospace, Menlo, monospace";
    ctx.fillStyle = COL.ink2;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    var label = res.wetsOut ? "SOAKS IN"
      : res.cassie ? "CASSIE: DROP SITS ON TRAPPED AIR"
      : (flatTop ? "ALL BUT SMOOTH: NOTHING FOR AIR TO SIT IN"
                 : "WENZEL: LIQUID FILLS THE TEXTURE");
    ctx.fillText(label, 14, H - 14);
    ctx.textAlign = "right";
    ctx.fillText(state.vol + " µL", W - 14, H - 14);
    ctx.restore();
  }
  /* ---------- readouts ---------- */
  var el = {
    theta: document.getElementById("outTheta"),
    state: document.getElementById("outState"),
    roll: document.getElementById("outRoll"),
    hyst: document.getElementById("outHyst"),
    note: document.getElementById("outNote"),
    live: document.getElementById("outLive"),
    tiltBtn: document.getElementById("tiltBtn")
  };

  function render() {
    res = compute(state);
    el.theta.textContent = res.wetsOut ? "wets out" : Math.round(res.theta) + "°";
    el.state.textContent = res.wetsOut ? "Soaks in"
      : res.cassie ? "Cassie-Baxter" : (res.mode === "flat" ? "Smooth" : "Wenzel");
    el.roll.textContent = res.pinned ? "pinned" : Math.round(res.alpha) + "°";
    el.hyst.textContent = res.wetsOut ? "n/a"
      : Math.round(res.thetaAdv) + "° / " + Math.round(res.thetaRec) + "°";

    var note;
    if (res.wetsOut) {
      note = "The surface energy is too high for this texture to help. Roughness makes a wetting surface wet faster, which is what happens to uncoated cotton.";
    } else if (res.cassie) {
      note = "Air is trapped under the drop, so it touches only the tops of the texture. Little contact means little pinning, and the drop runs off"
        + (res.alpha != null && res.alpha < 10 ? " almost as soon as you tilt it." : " at a modest tilt.");
    } else if (res.mode === "flat") {
      note = "No texture, so the drop sits at the intrinsic angle of the chemistry itself.";
    } else {
      note = "The liquid follows the texture into the grooves, so the wetted area goes up with r. That raises the contact angle but it also raises pinning, which is why a high angle here still means a stuck drop.";
      if (res.thetaCrit != null) {
        note += " Push the chemistry past " + Math.round(res.thetaCrit) + "° and it flips into the Cassie state.";
      }
    }
    if (res.metastable) {
      note += " A drop gently placed here can sit on air for a while, but it is metastable: pressure, impact or a wash cycle collapses it into the grooves.";
    }
    el.note.textContent = note;
    el.live.textContent = "Contact angle " + el.theta.textContent
      + ", " + el.state.textContent + " state, roll-off " + el.roll.textContent + ".";
    el.tiltBtn.textContent = "Tilt test";
    draw();
  }
  /* ---------- tilt animation ---------- */
  var raf = null, t0 = 0, phase = "idle", limit = 0;
  function stopAnim() { if (raf) cancelAnimationFrame(raf); raf = null; phase = "idle"; }

  function runTilt() {
    stopAnim();
    limit = res.pinned ? 90 : res.alpha;
    if (reduce) {
      tilt = limit; slide = res.pinned ? 0 : 1; draw();
      el.tiltBtn.textContent = res.pinned ? "Still pinned at 90°" : "Rolled at " + Math.round(limit) + "°";
      return;
    }
    phase = "tilting"; t0 = performance.now(); slide = 0;
    raf = requestAnimationFrame(step);
  }

  function step(now) {
    var dur = 900 + limit * 14;
    var t = (now - t0) / dur;
    if (phase === "tilting") {
      tilt = limit * clamp(t, 0, 1);
      draw();
      if (t >= 1) {
        tilt = limit;
        if (res.pinned) {
          el.tiltBtn.textContent = "Still pinned at 90°";
          phase = "idle"; raf = null; return;
        }
        phase = "sliding"; t0 = now;
      }
      raf = requestAnimationFrame(step);
    } else if (phase === "sliding") {
      var s = clamp((now - t0) / 700, 0, 1);
      slide = s * s;
      draw();
      if (s >= 1) {
        el.tiltBtn.textContent = "Rolled at " + Math.round(limit) + "°";
        phase = "idle"; raf = null;
        setTimeout(function () { if (phase === "idle") { slide = 0; tilt = limit; draw(); } }, 250);
        return;
      }
      raf = requestAnimationFrame(step);
    }
  }
  /* ---------- controls ---------- */
  var sliders = [
    { id: "sThetaY", key: "thetaY", out: "vThetaY", fmt: function (v) { return Math.round(v) + "°"; } },
    { id: "sR",      key: "r",      out: "vR",      fmt: function (v) { return v.toFixed(2); } },
    { id: "sFs",     key: "fs",     out: "vFs",     fmt: function (v) { return v.toFixed(2); } },
    { id: "sVol",    key: "vol",    out: "vVol",    fmt: function (v) { return v + " µL"; } }
  ];

  function syncInputs() {
    sliders.forEach(function (s) {
      var input = document.getElementById(s.id);
      input.value = state[s.key];
      document.getElementById(s.out).textContent = s.fmt(state[s.key]);
    });
  }

  function reset() { stopAnim(); tilt = 0; slide = 0; }

  sliders.forEach(function (s) {
    var input = document.getElementById(s.id);
    input.addEventListener("input", function () {
      state[s.key] = parseFloat(input.value);
      document.getElementById(s.out).textContent = s.fmt(state[s.key]);
      clearPreset();
      reset();
      render();
    });
  });

  var chips = [].slice.call(document.querySelectorAll(".preset"));

  function applyPreset(id) {
    var chip = chips.filter(function (c) { return c.dataset.preset === id; })[0];
    var p = PRESETS.filter(function (x) { return x.id === id; })[0];
    if (!chip || !p) return false;
    clearPreset();
    chip.classList.add("on");
    chip.setAttribute("aria-pressed", "true");
    state.thetaY = p.v.thetaY; state.r = p.v.r; state.fs = p.v.fs; state.vol = p.v.vol;
    syncInputs();
    reset();
    render();
    var m = document.getElementById("presetNote");
    m.textContent = p.note;
    m.hidden = false;
    return true;
  }

  function clearPreset() {
    chips.forEach(function (c) { c.classList.remove("on"); c.setAttribute("aria-pressed", "false"); });
    var m = document.getElementById("presetNote");
    m.textContent = "";
    m.hidden = true;
  }
  chips.forEach(function (chip) {
    chip.addEventListener("click", function () { applyPreset(chip.dataset.preset); });
  });

  el.tiltBtn.addEventListener("click", runTilt);

  var resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { fit(); draw(); }, 120);
  }, { passive: true });
  /* ---------- go ---------- */
  fit();
  syncInputs();
  render();

  /* ?p=<preset> opens the page on a named surface, handy for a QR code */
  var q = /[?&]p=([a-z0-9]+)/i.exec(window.location.search);
  if (q) applyPreset(q[1].toLowerCase());
})();

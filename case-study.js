/* ==========================================================================
   Fluorine-Free DWR - case study (home) motion + interaction.
   GSAP + ScrollTrigger drive reveals and the sticky process highlight when
   available. Without GSAP, or under reduced motion, everything is shown
   instantly (no hidden content). No-JS is handled by CSS (reveal stays visible).
   The liquid guide droplet (below) is its own scroll-driven system.
   ========================================================================== */
(function () {
  "use strict";

  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasGSAP = typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined";

  function revealAll() {
    $$(".reveal").forEach(function (el) { el.style.opacity = "1"; el.style.transform = "none"; });
  }
  /* safety net: if anything below throws, never leave reveal content hidden */
  window.addEventListener("error", revealAll);

  /* ---------- lightbox (works regardless of GSAP) ---------- */
  try { (function lightbox() {
    var box = $("#cs-lightbox"), inner = $("#cs-lightbox-inner"), closeBtn = $("#cs-lightbox-close");
    if (!box) return;
    var lastFocus = null;

    function open(stage) {
      var node = stage.querySelector("svg, img");
      if (!node) return;
      inner.innerHTML = "";
      inner.appendChild(node.cloneNode(true));
      box.classList.add("open");
      document.body.style.overflow = "hidden";
      lastFocus = document.activeElement;
      closeBtn.focus();
    }
    function close() {
      box.classList.remove("open");
      inner.innerHTML = "";
      document.body.style.overflow = "";
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    $$(".exhibit-stage.is-zoomable").forEach(function (stage) {
      stage.addEventListener("click", function () { open(stage); });
      stage.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(stage); }
      });
    });
    closeBtn.addEventListener("click", close);
    box.addEventListener("click", function (e) { if (e.target === box) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && box.classList.contains("open")) close(); });
  })(); } catch (e) { /* non-critical */ }

  /* ---------- sticky process highlight (IntersectionObserver; GSAP-independent) ---------- */
  try { (function processHighlight() {
    var svg = $("#proc-svg");
    var steps = $$(".sticky-steps .cs-stage");
    if (!svg || !steps.length || !("IntersectionObserver" in window)) return;
    var stages = $$(".stage", svg);
    stages.forEach(function (g) { g.style.transition = "opacity .45s cubic-bezier(.16,1,.3,1)"; });

    function setActive(n) {
      stages.forEach(function (g) {
        g.style.opacity = (g.getAttribute("data-stage") === String(n)) ? "1" : "0.26";
      });
      steps.forEach(function (s) {
        s.style.borderColor = (s.getAttribute("data-stage") === String(n)) ? "var(--accent-deep)" : "";
      });
    }
    setActive(1);
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) setActive(e.target.getAttribute("data-stage"));
      });
    }, { rootMargin: "-45% 0px -45% 0px" });
    steps.forEach(function (s) { io.observe(s); });
  })(); } catch (e) { /* non-critical */ }

  /* ======================================================================
     LIQUID GUIDE DROPLET
     A single premium water bead travels down the page on glass. Its descent is
     a smoothed "journey" scalar coupled to scroll (not gravity); laterally it
     weaves toward the live on-screen cards/figures/notes/headings. It lands on
     an element's top edge, settles, rolls off, and continues to the next, and
     calms to a rest when you stop scrolling. Matter.js is used only locally, for
     the few micro-droplets thrown on a meaningful impact. Rendered procedurally
     (no image): an asymmetric, breathing glass bead. Off on narrow screens and
     reduced motion.
     ====================================================================== */
  try { (function liquidGuideDroplet() {
    var canvas = $("#rain-canvas");
    if (!canvas || reduce || window.innerWidth < 1024) return;

    /* ---- tuning ---- */
    var CONFIG = {
      pathCurviness: 0.0055,           // weave frequency along the descent
      pathSideTravel: 30,              // weave amplitude in px
      anchorAttraction: 0.085,         // how strongly x eases toward the guide / ledge
      scrollProgressSmoothing: 0.16,   // scroll-velocity smoothing (lower = floatier)
      dropletRadius: 14,               // bead size in px
      dropletOpacity: 0.92,
      contactPauseMs: 240,             // how long it settles/rolls on a ledge
      edgeRollSpeed: 1.7,              // px/frame slide while rolling off an edge
      impactBounce: 0.5,               // squash strength on contact
      impactRippleThreshold: 520,      // min scroll speed (px/s) to throw a splash
      idleDrift: 0.12,                 // tiny motion when idle
      maxShapeStretch: 1.5             // cap on velocity stretch
    };
    var ANCHOR_SELECTOR = "figure, .exhibit-stage, .method, .cs-stage, .cs-note, .metric, .cs-h2, .cs-h3, blockquote, .pull";
    var DESCENT_PER_VH = 2.4;          // viewport-heights of scroll per full top->bottom pass

    var hasMatter = typeof Matter !== "undefined";
    var Engine, World, Bodies, Body, engine;
    if (hasMatter) { Engine = Matter.Engine; World = Matter.World; Bodies = Matter.Bodies; Body = Matter.Body; engine = Engine.create(); engine.gravity.y = 1; }

    var ctx = canvas.getContext("2d");
    var W = 0, H = 0, dpr = Math.min(2, window.devicePixelRatio || 1);
    var ledges = [], guide = [];                 // guide = centerline [{y,x}] in viewport space
    var splashes = [];
    var lastScrollY = window.scrollY, lastT = performance.now(), scrollVel = 0, energy = 0, active = false, dScroll = 0;
    var journey = 0, holdUntil = 0, reenter = false, lastLandAt = -9999, lastLandY = -9999;
    var d = { x: 0, y: 0, px: 0, py: 0, alpha: 0, squash: 0, state: "idle", landedY: 0, rollDir: 1 };
    var raf = 0, running = false;
    function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
    function lerp(a, b, t) { return a + (b - a) * t; }

    function size() {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = W + "px"; canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /* ---- 1. anchors from live, visible DOM ---- */
    function collectElementAnchors() {
      var pad = 26, out = [];
      $$(ANCHOR_SELECTOR).forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.width < 60 || r.bottom < -60 || r.top > H + 140) return;
        out.push({ x0: r.left + pad, x1: r.right - pad, cx: r.left + r.width / 2, y: r.top });
      });
      out.sort(function (a, b) { return a.y - b.y; });
      return out;
    }

    /* ---- 2. build a smooth lateral guide x(y) over the viewport from the anchors ---- */
    function buildScrollPath() {
      ledges = collectElementAnchors();
      var midX = W / 2, half = (W - 180) / 2;
      var pts = [{ y: -40, x: midX - half * 0.4 }];
      ledges.forEach(function (l, i) {
        var side = (i % 2 ? 1 : -1);
        pts.push({ y: l.y, x: clamp(lerp(midX + side * half * 0.5, l.cx, 0.5), 70, W - 70) });
      });
      pts.push({ y: H + 40, x: midX + half * 0.4 });
      pts.sort(function (a, b) { return a.y - b.y; });
      guide = pts;
    }
    function guideX(y) {
      if (guide.length < 2) return W / 2;
      var i = 0; while (i < guide.length - 2 && y > guide[i + 1].y) i++;
      var p0 = guide[i - 1] || guide[i], p1 = guide[i], p2 = guide[i + 1] || p1, p3 = guide[i + 2] || p2;
      var t = clamp((y - p1.y) / Math.max(1, p2.y - p1.y), 0, 1), t2 = t * t, t3 = t2 * t;
      return 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
    }

    /* ---- 3. sample the designed path at a normalized progress (0 top -> 1 bottom) ---- */
    function samplePathAtProgress(p) {
      var y = lerp(H * 0.12, H * 0.86, p);
      return { x: guideX(y) + Math.sin(y * CONFIG.pathCurviness) * CONFIG.pathSideTravel, y: y };
    }

    /* ---- 4. scroll model: journey advances with scroll, freezes while settling ---- */
    function updateScrollProgressModel(now, dt) {
      var sy = window.scrollY;
      dScroll = sy - lastScrollY; lastScrollY = sy;
      scrollVel += ((dScroll / dt * 1000) - scrollVel) * CONFIG.scrollProgressSmoothing;
      energy = clamp(Math.abs(scrollVel) / 700, 0, 1.4);
      active = Math.abs(scrollVel) > 22;
      reenter = false;
      if (now > holdUntil) {
        journey += dScroll / (H * DESCENT_PER_VH);
        if (journey > 1) { journey -= 1; reenter = true; }
        if (journey < 0) journey += 1;
      }
    }

    /* ---- 5. state machine: path-follow / impact / settling / edge-roll / idle ---- */
    function updateDropletState(now) {
      var s = samplePathAtProgress(journey);
      var tx = s.x, ty = s.y;

      if (now < holdUntil) {
        // on a ledge: first settle, then roll off the nearer edge
        ty = d.landedY;
        var phase = 1 - (holdUntil - now) / CONFIG.contactPauseMs;   // 0..1 through the pause
        if (phase < 0.4) { d.state = "settling"; tx = d.x; }
        else { d.state = "edge-roll"; tx = d.x + d.rollDir * CONFIG.edgeRollSpeed * (0.5 + energy); }
      } else if (!active) {
        d.state = "idle";
        tx = lerp(d.x, s.x, 0.04) + Math.sin(now * 0.0012) * CONFIG.idleDrift;
        ty = d.y + Math.sin(now * 0.0016) * CONFIG.idleDrift;   // cling / drift minimally
      } else {
        d.state = "path-follow";
        // landing test: a visible ledge near the descending bead and under it
        // (cooldown + position guard so it never re-lands on the same ledge in a loop)
        if (dScroll > 0 && now - lastLandAt > CONFIG.contactPauseMs + 320) {
          for (var i = 0; i < ledges.length; i++) {
            var l = ledges[i];
            if (tx > l.x0 && tx < l.x1 && ty >= l.y - 12 && ty <= l.y + 14 && Math.abs(l.y - lastLandY) > 30) {
              d.state = "impact";
              d.landedY = l.y;
              d.rollDir = (tx - l.x0 < l.x1 - tx) ? -1 : 1;       // roll toward nearer edge
              holdUntil = now + CONFIG.contactPauseMs;
              lastLandAt = now; lastLandY = l.y;
              d.squash = CONFIG.impactBounce;
              if (Math.abs(scrollVel) > CONFIG.impactRippleThreshold) emitContactRipple(tx, l.y, energy);
              ty = l.y;
              break;
            }
          }
        }
      }
      d._tx = clamp(tx, 60, W - 60); d._ty = ty;
    }

    /* ---- 6. local physics: easing lag, wobble, squash decay, re-entry ---- */
    function applyLocalPhysicsOffsets(now) {
      if (reenter) { d.y = d._ty; d.x = d._tx; d.alpha = 0; }    // wrapped to top: teleport + fade in
      var exLag = d.state === "path-follow" ? (0.4 + energy * 0.6) : 1;
      d.px = d.x; d.py = d.y;
      d.x += (d._tx - d.x) * CONFIG.anchorAttraction * (0.6 + energy);
      d.y += (d._ty - d.y) * 0.14 * exLag;
      d.squash *= 0.86; if (d.squash < 0.01) d.squash = 0;
      d.alpha += (1 - d.alpha) * 0.1;
      if (hasMatter) Engine.update(engine, 1000 / 60);
    }

    /* ---- splash: rare, only on meaningful contact ---- */
    function emitContactRipple(x, y, e) {
      splashes.push({ ring: true, x: x, y: y, r: 4, life: 1 });
      var n = clamp(Math.round(4 + e * 6), 4, 12);
      for (var i = 0; i < n && hasMatter; i++) {
        var a = -Math.PI / 2 + (Math.random() - 0.5) * 1.4, sp = 1.6 + Math.random() * (2 + e * 2);
        var b = Bodies.circle(x, y - 2, 1.1 + Math.random() * 1.2, { restitution: 0.35, frictionAir: 0.02, density: 0.001 });
        Body.setVelocity(b, { x: Math.cos(a) * sp, y: Math.sin(a) * sp });
        World.add(engine.world, b); splashes.push({ body: b, life: 1 });
      }
    }

    /* ---- 7. procedural liquid rendering: asymmetric breathing glass bead ---- */
    function beadPath(s, w) {
      var topY = -s * 1.1, botY = s * 1.12, rx = s * 0.96;
      ctx.beginPath();
      ctx.moveTo(0, topY);
      ctx.bezierCurveTo(rx * 0.62, topY + s * 0.16, rx * (1.0 + w.a), -s * 0.34, rx * (1.0 + w.b), s * 0.06);
      ctx.bezierCurveTo(rx * 1.0, s * 0.52, rx * 0.6, botY, 0, botY);
      ctx.bezierCurveTo(-rx * 0.6, botY, -rx * 1.0, s * 0.52, -rx * (1.0 + w.c), s * 0.06);
      ctx.bezierCurveTo(-rx * (1.0 + w.d), -s * 0.34, -rx * 0.62, topY + s * 0.16, 0, topY);
      ctx.closePath();
    }
    function renderDroplet(ctx, drop) {
      var s = CONFIG.dropletRadius, t = performance.now(), wa = 0.06;
      var w = { a: Math.sin(t * 0.0022) * wa, b: Math.sin(t * 0.0027 + 1.7) * wa, c: Math.sin(t * 0.0019 + 3.1) * wa, d: Math.sin(t * 0.0024 + 4.6) * wa };
      var vx = drop.x - drop.px, vy = drop.y - drop.py, v = Math.sqrt(vx * vx + vy * vy);
      var st = clamp(1 + v * 0.02, 1, CONFIG.maxShapeStretch);
      var sy = st * (1 - drop.squash * 0.5), sx = (1 / st) * (1 + drop.squash * 0.42);
      ctx.save();
      ctx.globalAlpha = drop.alpha * CONFIG.dropletOpacity;
      ctx.translate(drop.x, drop.y);
      ctx.rotate(clamp(vx * 0.03, -0.3, 0.3));
      ctx.scale(sx, sy);
      // ambient glow
      var glow = ctx.createRadialGradient(0, 0, s * 0.3, 0, 0, s * 2.2);
      glow.addColorStop(0, "rgba(150,200,225,0.13)"); glow.addColorStop(1, "rgba(150,200,225,0)");
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, s * 2.2, 0, 6.2832); ctx.fill();
      // glass body
      beadPath(s, w);
      var g = ctx.createRadialGradient(-s * 0.34, -s * 0.4, s * 0.1, s * 0.12, s * 0.26, s * 1.5);
      g.addColorStop(0, "rgba(247,252,255,0.78)");
      g.addColorStop(0.4, "rgba(214,236,247,0.6)");
      g.addColorStop(0.82, "rgba(150,193,217,0.5)");
      g.addColorStop(1, "rgba(120,166,194,0.52)");
      ctx.fillStyle = g;
      ctx.shadowColor = "rgba(54,96,122,0.26)"; ctx.shadowBlur = s * 0.6; ctx.shadowOffsetY = s * 0.3;
      ctx.fill(); ctx.shadowColor = "transparent";
      // inner shading, clipped to body
      ctx.save(); beadPath(s, w); ctx.clip();
      var bot = ctx.createLinearGradient(0, -s * 0.2, 0, s * 1.2);
      bot.addColorStop(0, "rgba(58,102,132,0)"); bot.addColorStop(1, "rgba(58,102,132,0.16)");
      ctx.fillStyle = bot; ctx.fillRect(-s * 1.6, -s * 1.6, s * 3.2, s * 3.2);
      var refr = ctx.createRadialGradient(s * 0.06, s * 0.5, s * 0.05, s * 0.06, s * 0.5, s * 0.72);
      refr.addColorStop(0, "rgba(255,255,255,0.3)"); refr.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = refr; ctx.beginPath(); ctx.arc(s * 0.06, s * 0.5, s * 0.72, 0, 6.2832); ctx.fill();
      ctx.restore();
      // specular highlights
      ctx.beginPath(); ctx.ellipse(-s * 0.32, -s * 0.32, s * 0.17, s * 0.27, -0.4, 0, 6.2832);
      ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.fill();
      ctx.beginPath(); ctx.arc(s * 0.2, -s * 0.04, s * 0.07, 0, 6.2832);
      ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.fill();
      ctx.restore();
    }

    function drawSplashes() {
      for (var i = splashes.length - 1; i >= 0; i--) {
        var p = splashes[i];
        if (p.ring) {
          p.r += 1.0; p.life -= 0.05;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832);
          ctx.strokeStyle = "rgba(150,195,220," + Math.max(0, p.life * 0.5) + ")"; ctx.lineWidth = 1.3; ctx.stroke();
          if (p.life <= 0) splashes.splice(i, 1);
        } else if (p.body) {
          p.life -= 0.022;
          ctx.beginPath(); ctx.arc(p.body.position.x, p.body.position.y, p.body.circleRadius, 0, 6.2832);
          ctx.fillStyle = "rgba(168,204,225," + Math.max(0, Math.min(0.8, p.life)) + ")"; ctx.fill();
          if (p.life <= 0 || p.body.position.y > H + 50) { if (hasMatter) World.remove(engine.world, p.body); splashes.splice(i, 1); }
        }
      }
    }

    /* ---- 8. main loop ---- */
    function animate() {
      var now = performance.now(), dt = clamp(now - lastT, 8, 40); lastT = now;
      updateScrollProgressModel(now, dt);
      buildScrollPath();
      updateDropletState(now);
      applyLocalPhysicsOffsets(now);
      ctx.clearRect(0, 0, W, H);
      drawSplashes();
      if (d.y > -60 && d.y < H + 60) renderDroplet(ctx, d);
      raf = requestAnimationFrame(animate);
    }
    function start() { if (!running) { running = true; lastT = performance.now(); lastScrollY = window.scrollY; raf = requestAnimationFrame(animate); } }
    function stop() { running = false; cancelAnimationFrame(raf); }

    size(); buildScrollPath();
    var s0 = samplePathAtProgress(0); d.x = d.px = s0.x; d.y = d.py = s0.y;
    start();
    var rt;
    function onResize() { clearTimeout(rt); rt = setTimeout(size, 180); }
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else start(); });
  })(); } catch (e) { /* non-critical */ }

  /* ---------- fallback path: no GSAP or reduced motion → reveal everything ---------- */
  if (!hasGSAP || reduce) { revealAll(); return; }

  gsap.registerPlugin(ScrollTrigger);

  /* ---------- hero entrance ---------- */
  var heroBits = $$(".cs-hero .reveal");
  if (heroBits.length) {
    gsap.timeline({ defaults: { ease: "power3.out" } })
      .to(heroBits, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.1 })
      .from(heroBits, { y: 22, duration: 0.9, stagger: 0.1 }, 0);
  }

  /* ---------- gentle reveals on scroll ---------- */
  $$(".reveal").forEach(function (el) {
    if (el.closest(".cs-hero")) return; /* hero handled above */
    gsap.set(el, { y: 24 });
    gsap.to(el, {
      autoAlpha: 1, y: 0, duration: 0.85, ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 86%", once: true }
    });
  });
})();

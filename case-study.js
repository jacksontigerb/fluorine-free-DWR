/* ==========================================================================
   Fluorine-Free DWR - case study (home) motion + interaction.
   GSAP + ScrollTrigger drive reveals and the sticky process highlight when
   available. Without GSAP, or under reduced motion, everything is shown
   instantly (no hidden content). No-JS is handled by CSS (reveal stays visible).
   The liquid guide droplet (below) is independent of GSAP.
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

  /* ---------- liquid guide droplet ----------
     A single premium water droplet that travels a DESIGNED, scroll-driven path down the
     page, like a bead of water finding an interesting route down glass. The authored path
     is the primary motion; Matter.js is used only as a secondary accent, for the little
     splash bodies that bounce off the live on-screen cards. The droplet is drawn
     procedurally on canvas (no image asset): a slightly asymmetric, breathing liquid blob
     with layered glass shading. Skipped on narrow screens and reduced motion. */
  try { (function liquidGuide() {
    var canvas = $("#rain-canvas");
    if (!canvas || reduce || window.innerWidth < 1024) return;

    /* ---- tunable config ---- */
    var CONFIG = {
      pathSideAmplitude: 0.26,   // how far it drifts sideways (fraction of usable half-width)
      pathCurveStrength: 1.15,   // weave frequency between content waypoints
      pathLookAhead: 0.014,      // scroll-progress look-ahead used for the directional lean
      scrollSmoothing: 0.10,     // scroll-progress easing (lower = more lag / float)
      dropletSize: 13,           // base radius in px
      dropletOpacity: 0.9,
      wobbleAmount: 0.07,        // shape-breathing magnitude (fraction of radius)
      wobbleSpeed: 0.0021,       // shape-breathing speed (per ms)
      impactSquish: 0.5,         // squish strength on contact
      edgePauseMs: 260           // (reserved) edge-cling feel near card tops
    };
    /* which elements the path is biased toward and the drop reacts to */
    var TARGET_SELECTOR = "figure, .exhibit-stage, .method, .cs-stage, .cs-note, .metric";
    var PATH_SELECTOR = "figure, .exhibit-stage, .method, .cs-stage, .cs-note, .metric, .cs-h2";

    var hasMatter = typeof Matter !== "undefined";
    var Engine, World, Bodies, Body, engine, colliders = [];
    var ctx = canvas.getContext("2d");
    var W = 0, H = 0, docH = 0, dpr = Math.min(2, window.devicePixelRatio || 1);
    var path = [], targets = [], splashes = [];
    var pSmooth = 0, curX = 0, curY = 0, lastDrawY = 0, offX = 0, squish = 0;
    var raf = 0, running = false;
    function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
    function lerp(a, b, t) { return a + (b - a) * t; }

    if (hasMatter) {
      Engine = Matter.Engine; World = Matter.World; Bodies = Matter.Bodies; Body = Matter.Body;
      engine = Engine.create(); engine.gravity.y = 1;
    }

    function size() {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = W + "px"; canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /* ---- authored path: a smooth lateral curve x(y) over the document, biased toward content ---- */
    function catmull1D(p0, p1, p2, p3, t) {
      var t2 = t * t, t3 = t2 * t;
      return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
    }
    function buildPath() {
      docH = Math.max(document.documentElement.scrollHeight, H + 1);
      var margin = 96, half = (W - margin * 2) / 2, midX = W / 2;
      var wps = [{ y: 0, x: midX - half * 0.55 }];   // enter just left of centre, up top
      $$(PATH_SELECTOR).map(function (el) {
        var r = el.getBoundingClientRect();
        return { top: r.top + window.scrollY, cx: r.left + r.width / 2 };
      }).filter(function (o) { return o.top > 24 && o.top < docH - 24; })
        .sort(function (a, b) { return a.top - b.top; })
        .forEach(function (o, i) {
          var weave = Math.sin(i * CONFIG.pathCurveStrength) * half * CONFIG.pathSideAmplitude;
          wps.push({ y: o.top, x: clamp(lerp(midX + weave, o.cx, 0.42), margin, W - margin) });
        });
      wps.push({ y: docH, x: midX + half * 0.45 });
      wps.sort(function (a, b) { return a.y - b.y; });
      /* densely sample a 1-D Catmull-Rom x(y) */
      path = [];
      var steps = 700;
      for (var s = 0; s <= steps; s++) {
        var yy = docH * s / steps;
        var i = 0; while (i < wps.length - 2 && yy > wps[i + 1].y) i++;
        var p1 = wps[i], p2 = wps[i + 1] || p1, p0 = wps[i - 1] || p1, p3 = wps[i + 2] || p2;
        var t = clamp((yy - p1.y) / Math.max(1, p2.y - p1.y), 0, 1);
        path.push(catmull1D(p0.x, p1.x, p2.x, p3.x, t));
      }
    }
    function xAtY(y) { return path[clamp(Math.round(y / docH * (path.length - 1)), 0, path.length - 1)]; }

    function buildColliders() {
      targets = $$(TARGET_SELECTOR);
      if (!hasMatter) return;
      colliders.forEach(function (c) { World.remove(engine.world, c.body); });
      colliders = targets.map(function (el) {
        var r = el.getBoundingClientRect();
        var b = Bodies.rectangle(-9999, -9999, Math.max(50, r.width), 12, { isStatic: true, restitution: 0.32, friction: 0.3 });
        World.add(engine.world, b);
        return { el: el, body: b };
      });
    }

    function splash(x, y, n) {
      splashes.push({ ring: true, x: x, y: y, r: 3, life: 1 });
      for (var i = 0; i < n; i++) {
        if (hasMatter) {
          var a = -Math.PI / 2 + (Math.random() - 0.5) * 1.5, sp = 1.8 + Math.random() * 3.2;
          var b = Bodies.circle(x, y, 1.2 + Math.random() * 1.3, { restitution: 0.4, frictionAir: 0.02, density: 0.001 });
          Body.setVelocity(b, { x: Math.cos(a) * sp, y: Math.sin(a) * sp });
          World.add(engine.world, b); splashes.push({ body: b, life: 1 });
        }
      }
    }

    /* ---- procedural liquid rendering ---- */
    function blob(s, wob) {
      var topY = -s * 1.28, botY = s * 1.05, rx = s * 0.84;
      ctx.beginPath();
      ctx.moveTo(0, topY);
      ctx.bezierCurveTo(rx * 0.55, topY + s * 0.34, rx * (1.0 + wob.a), -s * 0.06, rx * (0.97 + wob.b), s * 0.28);
      ctx.bezierCurveTo(rx * 0.93, s * 0.72, rx * 0.48, botY, 0, botY);
      ctx.bezierCurveTo(-rx * 0.48, botY, -rx * 0.93, s * 0.72, -rx * (0.97 + wob.c), s * 0.28);
      ctx.bezierCurveTo(-rx * (1.0 + wob.d), -s * 0.06, -rx * 0.55, topY + s * 0.34, 0, topY);
      ctx.closePath();
    }
    function drawDroplet(x, y, lean) {
      var t = performance.now(), s = CONFIG.dropletSize, wa = CONFIG.wobbleAmount, ws = CONFIG.wobbleSpeed;
      var wob = {
        a: Math.sin(t * ws) * wa, b: Math.sin(t * ws * 1.3 + 1) * wa,
        c: Math.sin(t * ws * 0.8 + 2) * wa, d: Math.sin(t * ws * 1.1 + 3) * wa
      };
      ctx.save();
      ctx.globalAlpha = CONFIG.dropletOpacity;
      ctx.translate(x, y);
      ctx.rotate(lean);
      ctx.scale(1 + squish * 0.5, 1 - squish * 0.45);   // contact squish + lean
      /* soft glow under the body */
      var gl = ctx.createRadialGradient(0, 0, s * 0.2, 0, 0, s * 2.0);
      gl.addColorStop(0, "rgba(186,219,237,0.16)"); gl.addColorStop(1, "rgba(186,219,237,0)");
      ctx.fillStyle = gl; blob(s * 1.5, { a: 0, b: 0, c: 0, d: 0 }); ctx.fill();
      /* translucent glass body */
      blob(s, wob);
      var g = ctx.createRadialGradient(-s * 0.3, -s * 0.45, s * 0.1, s * 0.05, s * 0.18, s * 1.5);
      g.addColorStop(0, "rgba(245,251,255,0.80)");
      g.addColorStop(0.36, "rgba(208,233,245,0.56)");
      g.addColorStop(0.78, "rgba(170,206,227,0.42)");
      g.addColorStop(1, "rgba(150,189,213,0.36)");
      ctx.fillStyle = g;
      ctx.shadowColor = "rgba(58,98,124,0.20)"; ctx.shadowBlur = s * 0.7; ctx.shadowOffsetY = s * 0.26;
      ctx.fill();
      ctx.shadowColor = "transparent";
      /* inner layers, clipped to the body */
      ctx.save();
      blob(s, wob); ctx.clip();
      ctx.beginPath(); ctx.ellipse(0, s * 0.52, s * 0.66, s * 0.44, 0, 0, Math.PI * 2);   // lower volume shadow
      ctx.fillStyle = "rgba(64,110,140,0.10)"; ctx.fill();
      ctx.beginPath(); ctx.ellipse(s * 0.08, s * 0.3, s * 0.46, s * 0.28, 0, 0, Math.PI * 2); // refraction
      ctx.fillStyle = "rgba(255,255,255,0.16)"; ctx.fill();
      ctx.beginPath(); ctx.ellipse(-s * 0.34, -s * 0.32, s * 0.19, s * 0.32, -0.3, 0, Math.PI * 2); // highlight
      ctx.fillStyle = "rgba(255,255,255,0.72)"; ctx.fill();
      ctx.restore();
      ctx.restore();
    }

    function frame() {
      var sy = window.scrollY;
      var maxScroll = Math.max(1, (document.documentElement.scrollHeight || docH) - H);
      var p = clamp(sy / maxScroll, 0, 1);
      pSmooth += (p - pSmooth) * CONFIG.scrollSmoothing;
      var docY = pSmooth * docH;
      var baseX = xAtY(docY);
      var aheadX = xAtY(clamp(pSmooth + CONFIG.pathLookAhead, 0, 1) * docH);
      var lean = clamp((aheadX - baseX) * 0.012, -0.32, 0.32);
      var tx = baseX + offX, ty = docY - sy;
      curX += (tx - curX) * 0.35;
      curY += (ty - curY) * 0.42;

      /* live colliders + secondary physics step (splash bodies) */
      for (var i = 0; i < targets.length; i++) {
        var r = targets[i].getBoundingClientRect();
        if (hasMatter && colliders[i]) {
          if (r.width > 0 && r.bottom > -30 && r.top < H + 30) Body.setPosition(colliders[i].body, { x: r.left + r.width / 2, y: r.top });
          else Body.setPosition(colliders[i].body, { x: -9999, y: -9999 });
        }
        /* light reaction: crossing a visible card top -> squish, splash, slide off nearest edge */
        if (r.width > 0 && curX > r.left + 4 && curX < r.right - 4 &&
            lastDrawY < r.top && curY >= r.top && curY < r.top + 16) {
          squish = CONFIG.impactSquish;
          splash(curX, r.top, 8);
          offX += (curX - r.left < r.right - curX ? -1 : 1) * 18;
        }
      }
      if (hasMatter) Engine.update(engine, 1000 / 60);
      offX += (0 - offX) * 0.06;
      squish *= 0.85; if (squish < 0.01) squish = 0;
      lastDrawY = curY;

      /* render */
      ctx.clearRect(0, 0, W, H);
      for (var s = splashes.length - 1; s >= 0; s--) {
        var q = splashes[s];
        if (q.ring) {
          q.r += 1.0; q.life -= 0.05;
          ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(150,195,220," + Math.max(0, q.life * 0.5) + ")"; ctx.lineWidth = 1.3; ctx.stroke();
          if (q.life <= 0) splashes.splice(s, 1);
        } else if (q.body) {
          q.life -= 0.02;
          ctx.beginPath(); ctx.arc(q.body.position.x, q.body.position.y, q.body.circleRadius, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(170,205,226," + Math.max(0, Math.min(0.8, q.life)) + ")"; ctx.fill();
          if (q.life <= 0 || q.body.position.y > H + 50) { if (hasMatter) World.remove(engine.world, q.body); splashes.splice(s, 1); }
        }
      }
      if (curY > -50 && curY < H + 50) drawDroplet(curX, curY, lean);
      raf = requestAnimationFrame(frame);
    }
    function start() { if (!running) { running = true; raf = requestAnimationFrame(frame); } }
    function stop() { running = false; cancelAnimationFrame(raf); }

    size(); buildPath(); buildColliders();
    pSmooth = clamp(window.scrollY / Math.max(1, (document.documentElement.scrollHeight || docH) - H), 0, 1);
    curX = xAtY(pSmooth * docH); curY = pSmooth * docH - window.scrollY; lastDrawY = curY;
    start();

    var rt;
    function rebuild() { clearTimeout(rt); rt = setTimeout(function () { size(); buildPath(); buildColliders(); }, 200); }
    window.addEventListener("resize", rebuild);
    window.addEventListener("orientationchange", rebuild);
    /* layout settles after fonts/images: refresh the path a couple of times */
    setTimeout(buildPath, 600); setTimeout(buildPath, 1600);
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

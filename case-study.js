/* ==========================================================================
   Fluorine-Free DWR - case study (home) motion + interaction.
   GSAP + ScrollTrigger drive reveals, the progress bar and the sticky
   process highlight when available. Without GSAP, or under reduced motion,
   everything is shown instantly (no hidden content). No raw scroll handlers
   beyond rAF-throttled progress. No-JS is handled by CSS (reveal stays visible).
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

  /* ---------- one scroll-coupled hero raindrop (Matter.js) ----------
     A single glassy drop is anchored to the viewport. Its motion is driven mostly by
     the user's scroll inertia and lightly by gravity, so it follows you down the page,
     bounces off the live on-screen cards/figures/headings, splashes on impact, and
     settles/clings when idle. It is NOT endless rain: it respawns only while you are
     actively scrolling. Skipped on narrow screens, reduced motion, or without Matter. */
  try { (function rainPhysics() {
    var canvas = $("#rain-canvas");
    if (!canvas || reduce || window.innerWidth < 1024 || typeof Matter === "undefined") return;

    /* editable: which elements the drop physically interacts with */
    var COLLIDER_SELECTOR = "figure, .exhibit-stage, .method, .cs-stage, .cs-note, .metric, .card, .panel, blockquote, .pull, .cs-h2, .cs-h3, h2, h3";
    var SOFT_SELECTOR = ".cs-h2, .cs-h3, .pull, blockquote, h2, h3"; /* gentle deflection, thin */

    var Engine = Matter.Engine, World = Matter.World, Bodies = Matter.Bodies, Body = Matter.Body, Events = Matter.Events;
    var ctx = canvas.getContext("2d");
    var W = 0, H = 0, dpr = Math.min(2, window.devicePixelRatio || 1);
    var engine = Engine.create(); engine.gravity.y = 0.22;       /* light: scroll dominates */
    var walls = [], colliders = [], splashes = [], raf = 0, running = false;
    var drop = null, dropAlpha = 0, squash = 0, spawnAt = 0;
    var lastScrollY = window.scrollY, lastT = performance.now(), scrollVel = 0, awaiting = false;
    var R = 12;
    function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

    function size() {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = W + "px"; canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function makeWalls() {
      walls.forEach(function (w) { World.remove(engine.world, w); });
      walls = [Bodies.rectangle(-31, H / 2, 60, H * 4, { isStatic: true, restitution: 0.3 }),
               Bodies.rectangle(W + 31, H / 2, 60, H * 4, { isStatic: true, restitution: 0.3 })];
      World.add(engine.world, walls);
    }
    function trackEls() {
      colliders.forEach(function (c) { World.remove(engine.world, c.body); });
      colliders = [];
      $$(COLLIDER_SELECTOR).forEach(function (el, i) {
        var soft = el.matches(SOFT_SELECTOR);
        var r = el.getBoundingClientRect();
        var b = Bodies.rectangle(-9999, -9999, Math.max(50, r.width), soft ? 8 : 14, {
          isStatic: true, restitution: soft ? 0.12 : 0.3, friction: 0.4, frictionStatic: 0.6,
          angle: (i % 2 ? 0.025 : -0.025), label: "box"
        });
        colliders.push({ el: el, body: b }); World.add(engine.world, b);
      });
    }

    function spawn(x, vx) {
      if (drop) { World.remove(engine.world, drop); drop = null; }
      drop = Bodies.circle(clamp(x, R + 4, W - R - 4), -R - 14, R, {
        restitution: 0.34, friction: 0.35, frictionStatic: 0.6, frictionAir: 0.012, density: 0.001, label: "drop"
      });
      Body.setInertia(drop, Infinity);                 /* no spin: cleaner + rests when idle */
      Body.setVelocity(drop, { x: vx || 0, y: 1.4 });
      dropAlpha = 0; spawnAt = performance.now();
      World.add(engine.world, drop);
    }

    function splash(x, y, n) {
      splashes.push({ x: x, y: y, r: 3, life: 1, ring: true });
      for (var i = 0; i < n; i++) {
        var a = -Math.PI / 2 + (Math.random() - 0.5) * 1.7, sp = 1.3 + Math.random() * 2.4;
        splashes.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 1.1 + Math.random() * 1.4, life: 1, g: 0.16 });
      }
    }
    Events.on(engine, "collisionStart", function (ev) {
      ev.pairs.forEach(function (p) {
        var d = p.bodyA.label === "drop" ? p.bodyA : (p.bodyB.label === "drop" ? p.bodyB : null);
        if (!d) return;
        var sp = Math.sqrt(d.velocity.x * d.velocity.x + d.velocity.y * d.velocity.y);
        if (sp > 1.8) { squash = clamp(sp / 10, 0.25, 1); splash(d.position.x, d.position.y + R - 1, clamp(Math.round(sp), 6, 14)); }
      });
    });

    function drawDrop() {
      if (!drop) return;
      var vx = drop.velocity.x, vy = drop.velocity.y, v = Math.sqrt(vx * vx + vy * vy);
      var ang = Math.atan2(vy, vx) - Math.PI / 2;
      var stretch = clamp(1 + v * 0.04, 1, 1.7) * (1 - 0.5 * squash);
      var fatten = (1 / Math.sqrt(clamp(1 + v * 0.04, 1, 1.7))) * (1 + 0.7 * squash);
      ctx.save();
      ctx.globalAlpha = dropAlpha;
      ctx.translate(drop.position.x, drop.position.y);
      if (v > 0.3) ctx.rotate(ang);
      ctx.scale(fatten, stretch);
      /* contact shadow */
      ctx.beginPath(); ctx.ellipse(0, R * 1.2, R * 0.7, R * 0.3, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(40,70,90,0.10)"; ctx.fill();
      /* glossy teardrop body */
      ctx.beginPath();
      ctx.moveTo(0, -R * 1.5);
      ctx.bezierCurveTo(R * 0.95, -R * 0.5, R * 1.05, R * 0.7, 0, R * 1.45);
      ctx.bezierCurveTo(-R * 1.05, R * 0.7, -R * 0.95, -R * 0.5, 0, -R * 1.5);
      ctx.closePath();
      var g = ctx.createRadialGradient(-R * 0.32, -R * 0.4, R * 0.15, R * 0.1, R * 0.2, R * 1.6);
      g.addColorStop(0, "rgba(255,255,255,0.96)"); g.addColorStop(0.26, "#cfeaf7");
      g.addColorStop(0.7, "#8fc0dc"); g.addColorStop(1, "#4a8aae");
      ctx.fillStyle = g;
      ctx.shadowColor = "rgba(53,106,140,0.38)"; ctx.shadowBlur = 7; ctx.shadowOffsetY = 3;
      ctx.fill(); ctx.shadowColor = "transparent";
      ctx.lineWidth = 1; ctx.strokeStyle = "rgba(53,106,140,0.6)"; ctx.stroke();
      /* inner refraction crescent (caustic feel) */
      ctx.beginPath(); ctx.ellipse(R * 0.1, R * 0.55, R * 0.55, R * 0.3, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.22)"; ctx.fill();
      /* specular highlight */
      ctx.beginPath(); ctx.ellipse(-R * 0.3, R * 0.05, R * 0.2, R * 0.38, -0.2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.fill();
      ctx.restore();
    }

    function frame() {
      var now = performance.now(), dt = Math.max(1, now - lastT); lastT = now;
      /* smoothed scroll velocity in px/sec */
      var sy = window.scrollY, inst = (sy - lastScrollY) / dt * 1000; lastScrollY = sy;
      scrollVel += (inst - scrollVel) * 0.25;
      var activelyScrolling = Math.abs(scrollVel) > 45;

      /* live colliders track on-screen element rects */
      for (var i = 0; i < colliders.length; i++) {
        var c = colliders[i], r = c.el.getBoundingClientRect();
        if (r.width > 0 && r.bottom > -40 && r.top < H + 40) Body.setPosition(c.body, { x: r.left + r.width / 2, y: r.top });
        else Body.setPosition(c.body, { x: -9999, y: -9999 });
      }

      /* scroll coupling: bias the drop's velocity, preserving collision response */
      if (drop) {
        var dn = clamp(scrollVel * 0.0013, -0.55, 1.2);                 /* down when scrolling down */
        var lat = (scrollVel > 0 ? Math.sin(now / 520) * 0.05 : (Math.random() - 0.5) * 0.12);
        Body.setVelocity(drop, {
          x: clamp(drop.velocity.x + lat, -7, 7),
          y: clamp(drop.velocity.y + dn, -5, 15)
        });
      }

      Engine.update(engine, 1000 / 60);
      squash *= 0.86; if (squash < 0.01) squash = 0;
      dropAlpha += (1 - dropAlpha) * 0.12;

      /* respawn policy: only while actively scrolling; otherwise wait for the next scroll */
      if (drop && drop.position.y > H + 50) {
        var keepVx = drop.velocity.x;
        if (activelyScrolling) { spawn(clamp(drop.position.x, R + 4, W - R - 4), clamp(keepVx, -4, 4)); }
        else { World.remove(engine.world, drop); drop = null; awaiting = true; }
      }
      if (!drop && awaiting && activelyScrolling) { awaiting = false; spawn(W * 0.5, 0); }

      /* render */
      ctx.clearRect(0, 0, W, H);
      drawDrop();
      for (var s = splashes.length - 1; s >= 0; s--) {
        var p = splashes[s];
        if (p.ring) {
          p.r += 1.1; p.life -= 0.05;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(94,157,192," + Math.max(0, p.life * 0.6) + ")"; ctx.lineWidth = 1.4; ctx.stroke();
        } else {
          p.vy += p.g; p.x += p.vx; p.y += p.vy; p.life -= 0.03;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(127,180,210," + Math.max(0, p.life) + ")"; ctx.fill();
        }
        if (p.life <= 0) splashes.splice(s, 1);
      }
      raf = requestAnimationFrame(frame);
    }
    function start() { if (!running) { running = true; lastT = performance.now(); lastScrollY = window.scrollY; raf = requestAnimationFrame(frame); } }
    function stop() { running = false; cancelAnimationFrame(raf); }

    size(); makeWalls(); trackEls(); spawn(W * 0.5, 0); start();
    var rt;
    function rebuild() { clearTimeout(rt); rt = setTimeout(function () { size(); makeWalls(); trackEls(); }, 220); }
    window.addEventListener("resize", rebuild);
    window.addEventListener("orientationchange", rebuild);
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

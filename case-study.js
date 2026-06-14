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

  /* ---------- realistic raindrop physics (Matter.js) ----------
     A glassy water drop falls under real gravity over the page and bounces off the tops
     of whatever content boxes are on screen, splashing on impact, then cascades on down.
     Invisible static colliders track the live screen positions of the boxes (with a slight
     tilt so the drop slides off an edge rather than resting), so the drop interacts with
     the real layout as you scroll. Custom canvas render makes it look like water.
     Skipped on narrow screens, reduced motion, or if Matter is unavailable. */
  try { (function rainPhysics() {
    var canvas = $("#rain-canvas");
    if (!canvas || reduce || window.innerWidth < 1024 || typeof Matter === "undefined") return;

    var Engine = Matter.Engine, World = Matter.World, Bodies = Matter.Bodies, Body = Matter.Body, Events = Matter.Events;
    var ctx = canvas.getContext("2d");
    var W = 0, H = 0, dpr = Math.min(2, window.devicePixelRatio || 1);
    var engine = Engine.create(); engine.gravity.y = 0.8;
    var walls = [], colliders = [], drops = [], splashes = [], raf = 0, running = false;
    function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

    function size() {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = W + "px"; canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function makeWalls() {
      walls.forEach(function (w) { World.remove(engine.world, w); });
      walls = [Bodies.rectangle(-31, H / 2, 60, H * 4, { isStatic: true }),
               Bodies.rectangle(W + 31, H / 2, 60, H * 4, { isStatic: true })];
      World.add(engine.world, walls);
    }
    function trackEls() {
      colliders.forEach(function (c) { World.remove(engine.world, c.body); });
      colliders = [];
      $$(".exhibit-stage, .method, .cs-stage, .cs-note").forEach(function (el, i) {
        var r = el.getBoundingClientRect();
        var b = Bodies.rectangle(-9999, -9999, Math.max(60, r.width), 14,
          { isStatic: true, restitution: 0.32, friction: 0.02, frictionStatic: 0,
            angle: (i % 2 ? 0.05 : -0.05), label: "box" });
        colliders.push({ el: el, body: b }); World.add(engine.world, b);
      });
    }
    function spawnDrop(x) {
      var d = Bodies.circle(x == null ? (60 + Math.random() * (W - 120)) : x, -30, 10,
        { restitution: 0.42, friction: 0.02, frictionAir: 0.006, density: 0.001, label: "drop" });
      Body.setVelocity(d, { x: Math.random() * 1.2 - 0.6, y: 2 });
      drops.push(d); World.add(engine.world, d); return d;
    }
    function splash(x, y, n) {
      splashes.push({ x: x, y: y, r: 3, life: 1, ring: true });
      for (var i = 0; i < n; i++) {
        var a = -Math.PI / 2 + (Math.random() - 0.5) * 1.7, sp = 1.4 + Math.random() * 2.6;
        splashes.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 1.3 + Math.random() * 1.5, life: 1, g: 0.16 });
      }
    }
    Events.on(engine, "collisionStart", function (ev) {
      ev.pairs.forEach(function (p) {
        var d = p.bodyA.label === "drop" ? p.bodyA : (p.bodyB.label === "drop" ? p.bodyB : null);
        if (!d) return;
        var sp = Math.sqrt(d.velocity.x * d.velocity.x + d.velocity.y * d.velocity.y);
        if (sp > 1.6) splash(d.position.x, d.position.y + 9, Math.min(7, 2 + Math.round(sp)));
      });
    });

    function drawDrop(d) {
      var v = Math.sqrt(d.velocity.x * d.velocity.x + d.velocity.y * d.velocity.y);
      var ang = Math.atan2(d.velocity.y, d.velocity.x) - Math.PI / 2;
      var stretch = clamp(1 + v * 0.045, 1, 1.9), R = 10;
      ctx.save();
      ctx.translate(d.position.x, d.position.y); ctx.rotate(ang); ctx.scale(1 / Math.sqrt(stretch), stretch);
      ctx.beginPath();
      ctx.moveTo(0, -R * 1.5);
      ctx.bezierCurveTo(R * 0.95, -R * 0.5, R * 1.05, R * 0.65, 0, R * 1.45);
      ctx.bezierCurveTo(-R * 1.05, R * 0.65, -R * 0.95, -R * 0.5, 0, -R * 1.5);
      ctx.closePath();
      var g = ctx.createRadialGradient(-R * 0.3, -R * 0.35, R * 0.2, 0, 0, R * 1.5);
      g.addColorStop(0, "rgba(255,255,255,0.95)"); g.addColorStop(0.28, "#cdeaf7"); g.addColorStop(1, "#4f90b4");
      ctx.fillStyle = g; ctx.shadowColor = "rgba(53,106,140,0.4)"; ctx.shadowBlur = 6; ctx.shadowOffsetY = 3;
      ctx.fill(); ctx.shadowColor = "transparent";
      ctx.lineWidth = 1; ctx.strokeStyle = "rgba(53,106,140,0.65)"; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-R * 0.28, R * 0.15, R * 0.22, R * 0.4, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.fill();
      ctx.restore();
    }

    function frame() {
      for (var i = 0; i < colliders.length; i++) {
        var c = colliders[i], r = c.el.getBoundingClientRect();
        if (r.width > 0 && r.bottom > -40 && r.top < H + 40) Body.setPosition(c.body, { x: r.left + r.width / 2, y: r.top });
        else Body.setPosition(c.body, { x: -9999, y: -9999 });
      }
      Engine.update(engine, 1000 / 60);
      for (var k = drops.length - 1; k >= 0; k--) if (drops[k].position.y > H + 60) { World.remove(engine.world, drops[k]); drops.splice(k, 1); }
      if (!drops.length) spawnDrop();

      ctx.clearRect(0, 0, W, H);
      drops.forEach(drawDrop);
      for (var s = splashes.length - 1; s >= 0; s--) {
        var p = splashes[s];
        if (p.ring) {
          p.r += 1.1; p.life -= 0.045;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(94,157,192," + Math.max(0, p.life * 0.6) + ")"; ctx.lineWidth = 1.4; ctx.stroke();
        } else {
          p.vy += p.g; p.x += p.vx; p.y += p.vy; p.life -= 0.028;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(127,180,210," + Math.max(0, p.life) + ")"; ctx.fill();
        }
        if (p.life <= 0) splashes.splice(s, 1);
      }
      raf = requestAnimationFrame(frame);
    }
    function start() { if (!running) { running = true; raf = requestAnimationFrame(frame); } }
    function stop() { running = false; cancelAnimationFrame(raf); }

    size(); makeWalls(); trackEls(); spawnDrop(W * 0.5); start();
    var rt;
    window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { size(); makeWalls(); trackEls(); }, 220); });
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

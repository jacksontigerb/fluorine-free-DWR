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

  /* ---------- falling raindrop with physics ----------
     A big, glassy drop falls down the page over the content. Scroll drives how far it
     has fallen; within each gap it accelerates under "gravity", then lands on the top of
     the next heading or figure, squashes and bounces, throws a small splash, and falls on.
     Skipped on narrow screens and reduced motion. */
  try { (function rainDrop() {
    var host = $("#rain-river");
    if (!host || reduce || window.innerWidth < 1024) return;

    var NS = "http://www.w3.org/2000/svg";
    var svg, ripples, drop, gStretch, gBounce;
    var marks = [], segs = [], totalSpan = 0;
    var cx = 0, cy = 0, lastY = 0, animating = false, curSeg = -1;
    function px(n) { return Math.round(n * 100) / 100; }
    function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
    function easeIn(t) { return t * t; }            /* accelerate (fall) */
    function smooth(t) { return t * t * (3 - 2 * t); } /* ease the sideways drift */

    function collect() {
      var W = document.documentElement.clientWidth;
      var els = $$(".cs-hero h1, .cs-h2, .exhibit, .cs-note");
      var arr = [];
      els.forEach(function (el, i) {
        var r = el.getBoundingClientRect();
        arr.push({ x: clamp(r.left + r.width / 2 + ((i * 53) % 40 - 20), 70, W - 70), y: r.top + window.scrollY });
      });
      arr.sort(function (a, b) { return a.y - b.y; });
      if (arr.length) arr.unshift({ x: arr[0].x, y: Math.max(0, arr[0].y - 170) });
      return arr;
    }

    function build() {
      host.innerHTML = "";
      var W = document.documentElement.clientWidth;
      var H = document.documentElement.scrollHeight;
      host.style.height = H + "px";
      marks = collect();
      segs = []; totalSpan = 0;
      for (var i = 0; i < marks.length - 1; i++) {
        var span = Math.max(1, marks[i + 1].y - marks[i].y);
        segs.push({ x0: marks[i].x, y0: marks[i].y, x1: marks[i + 1].x, y1: marks[i + 1].y, span: span, start: totalSpan });
        totalSpan += span;
      }
      svg = document.createElementNS(NS, "svg");
      svg.setAttribute("width", W); svg.setAttribute("height", H);
      svg.setAttribute("viewBox", "0 0 " + W + " " + H); svg.setAttribute("preserveAspectRatio", "none");
      svg.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;";
      svg.innerHTML = '<defs><radialGradient id="cs-dropg" cx="36%" cy="28%" r="78%">' +
        '<stop offset="0%" stop-color="#ffffff"/><stop offset="26%" stop-color="#cdeaf7"/>' +
        '<stop offset="100%" stop-color="#4f90b4"/></radialGradient></defs>';
      ripples = document.createElementNS(NS, "g"); svg.appendChild(ripples);
      drop = document.createElementNS(NS, "g");
      drop.style.filter = "drop-shadow(0 4px 5px rgba(53,106,140,.40))";
      gStretch = document.createElementNS(NS, "g");
      gBounce = document.createElementNS(NS, "g");
      var tear = document.createElementNS(NS, "path");
      tear.setAttribute("d", "M0 -15 C 9 -4 11 7 0 15 C -11 7 -9 -4 0 -15 Z");
      tear.setAttribute("fill", "url(#cs-dropg)"); tear.setAttribute("stroke", "#356a8c"); tear.setAttribute("stroke-width", "1");
      var hi = document.createElementNS(NS, "ellipse");
      hi.setAttribute("cx", "-3.2"); hi.setAttribute("cy", "3"); hi.setAttribute("rx", "2.6"); hi.setAttribute("ry", "4.4");
      hi.setAttribute("fill", "#ffffff"); hi.setAttribute("opacity", "0.65");
      gBounce.appendChild(tear); gBounce.appendChild(hi);
      gStretch.appendChild(gBounce); drop.appendChild(gStretch); svg.appendChild(drop);
      host.appendChild(svg);
      curSeg = -1; cx = marks[0].x; cy = marks[0].y; lastY = cy;
      render(true);
    }

    function ripple(x, y) {
      var c = document.createElementNS(NS, "circle");
      c.setAttribute("cx", x); c.setAttribute("cy", y); c.setAttribute("r", "3");
      c.setAttribute("fill", "none"); c.setAttribute("stroke", "#5e9dc0"); c.setAttribute("stroke-width", "1.6");
      ripples.appendChild(c);
      try { c.animate([{ r: 3, opacity: .7 }, { r: 30, opacity: 0 }], { duration: 760, easing: "cubic-bezier(.2,.6,.2,1)" }).onfinish = function () { c.remove(); }; }
      catch (e) { setTimeout(function () { c.remove(); }, 800); }
      for (var k = 0; k < 3; k++) (function (k) {
        var s = document.createElementNS(NS, "circle");
        var dx = (k - 1) * 11 + (Math.random() * 6 - 3);
        s.setAttribute("cx", x); s.setAttribute("cy", y); s.setAttribute("r", (1.6 + Math.random()).toFixed(1));
        s.setAttribute("fill", "#7fb4d2"); ripples.appendChild(s);
        try {
          s.animate([
            { transform: "translate(0px,0px)", opacity: .9 },
            { transform: "translate(" + dx + "px,-15px)", opacity: .9, offset: .5 },
            { transform: "translate(" + (dx * 1.5) + "px,7px)", opacity: 0 }
          ], { duration: 560, easing: "cubic-bezier(.3,.1,.5,1)" }).onfinish = function () { s.remove(); };
        } catch (e) { s.remove(); }
      })(k);
    }

    function bounce() {
      if (!gBounce.animate) return;
      try {
        gBounce.animate([
          { transform: "scaleY(1) scaleX(1)" },
          { transform: "scaleY(.55) scaleX(1.5)", offset: .18 },
          { transform: "scaleY(1.18) scaleX(.88)", offset: .5 },
          { transform: "scaleY(.94) scaleX(1.05)", offset: .74 },
          { transform: "scaleY(1) scaleX(1)" }
        ], { duration: 520, easing: "cubic-bezier(.3,.7,.4,1)" });
      } catch (e) { }
    }

    function segFor(dist) { var i = 0; while (i < segs.length - 1 && dist > segs[i].start + segs[i].span) i++; return i; }

    function render(snap) {
      if (!segs.length) return;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var dist = (max > 0 ? clamp(window.scrollY / max, 0, 1) : 0) * totalSpan;
      var i = segFor(dist), s = segs[i];
      var t = clamp((dist - s.start) / s.span, 0, 1);
      var ny = s.y0 + (s.y1 - s.y0) * easeIn(t);
      var nx = s.x0 + (s.x1 - s.x0) * smooth(t) + Math.sin(t * Math.PI) * ((i % 2) ? -26 : 26);
      cx += (nx - cx) * (snap ? 1 : 0.25);
      cy += (ny - cy) * (snap ? 1 : 0.25);
      var stretch = clamp(1 + Math.abs(cy - lastY) * 0.045, 1, 2.4); lastY = cy;
      drop.setAttribute("transform", "translate(" + px(cx) + "," + px(cy) + ")");
      gStretch.setAttribute("transform", "scale(" + px(1 / Math.sqrt(stretch)) + "," + px(stretch) + ")");
      if (i !== curSeg) {
        if (i > curSeg && curSeg >= 0) { ripple(marks[i].x, marks[i].y); bounce(); }
        curSeg = i;
      }
    }

    function loop() {
      render(false);
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var dist = (max > 0 ? clamp(window.scrollY / max, 0, 1) : 0) * totalSpan;
      var s = segs[segFor(dist)], t = clamp((dist - s.start) / s.span, 0, 1);
      var ny = s.y0 + (s.y1 - s.y0) * easeIn(t);
      if (Math.abs(ny - cy) > 0.4) requestAnimationFrame(loop); else animating = false;
    }
    function kick() { if (!animating) { animating = true; requestAnimationFrame(loop); } }

    build();
    window.addEventListener("scroll", kick, { passive: true });
    var rt;
    window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(build, 220); });
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

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

  /* ---------- falling raindrop that follows a river path through the page ----------
     A realistic droplet runs down a smooth curve threaded through the headings and
     figures. It stretches with scroll speed, points its tail uphill as it falls, and
     splashes a ripple each time it passes a landmark. The wet trail fills in behind it.
     Works with or without GSAP; skipped on narrow screens and reduced motion. */
  try { (function rainRiver() {
    var host = $("#rain-river");
    if (!host || reduce || window.innerWidth < 1024) return;

    var NS = "http://www.w3.org/2000/svg";
    var svg, basePath, wetPath, ripples, drop, dropInner;
    var totalLen = 0, anchors = [], curLen = 0, lastLen = 0, target = 0, animating = false;
    function px(n) { return Math.round(n * 100) / 100; }

    function collectAnchors() {
      var W = document.documentElement.clientWidth;
      var els = $$(".cs-hero h1, .cs-h2, .exhibit, .cs-note");
      var pts = [];
      els.forEach(function (el, i) {
        var r = el.getBoundingClientRect();
        pts.push({ x: W * (i % 2 === 0 ? 0.30 : 0.70), y: r.top + window.scrollY + r.height / 2 });
      });
      pts.sort(function (a, b) { return a.y - b.y; });
      if (pts.length) {
        pts.unshift({ x: W * 0.5, y: Math.max(0, pts[0].y - 150) });
        pts.push({ x: W * 0.5, y: pts[pts.length - 1].y + 220 });
      }
      return pts;
    }

    function catmull(pts) {
      if (pts.length < 2) return "";
      var d = "M " + px(pts[0].x) + " " + px(pts[0].y);
      for (var i = 0; i < pts.length - 1; i++) {
        var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
        d += " C " + px(p1.x + (p2.x - p0.x) / 6) + " " + px(p1.y + (p2.y - p0.y) / 6) +
             " " + px(p2.x - (p3.x - p1.x) / 6) + " " + px(p2.y - (p3.y - p1.y) / 6) +
             " " + px(p2.x) + " " + px(p2.y);
      }
      return d;
    }

    function ripple(x, y) {
      var c = document.createElementNS(NS, "circle");
      c.setAttribute("cx", x); c.setAttribute("cy", y); c.setAttribute("r", "2");
      c.setAttribute("fill", "none"); c.setAttribute("stroke", "#5e9dc0"); c.setAttribute("stroke-width", "1.4");
      ripples.appendChild(c);
      try {
        var a = c.animate([{ r: 2, opacity: 0.65 }, { r: 24, opacity: 0 }],
          { duration: 700, easing: "cubic-bezier(.2,.6,.2,1)" });
        a.onfinish = function () { c.remove(); };
      } catch (e) { setTimeout(function () { c.remove(); }, 750); }
    }

    function build() {
      host.innerHTML = "";
      var W = document.documentElement.clientWidth;
      var H = document.documentElement.scrollHeight;
      host.style.height = H + "px";
      anchors = collectAnchors();
      svg = document.createElementNS(NS, "svg");
      svg.setAttribute("width", W); svg.setAttribute("height", H);
      svg.setAttribute("viewBox", "0 0 " + W + " " + H);
      svg.setAttribute("preserveAspectRatio", "none");
      svg.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;";
      svg.innerHTML = '<defs><radialGradient id="cs-dropg" cx="38%" cy="30%" r="75%">' +
        '<stop offset="0%" stop-color="#ffffff"/><stop offset="30%" stop-color="#cdeaf7"/>' +
        '<stop offset="100%" stop-color="#5e9dc0"/></radialGradient></defs>';
      var d = catmull(anchors);
      basePath = document.createElementNS(NS, "path");
      basePath.setAttribute("d", d); basePath.setAttribute("fill", "none");
      basePath.setAttribute("stroke", "#9cc4dc"); basePath.setAttribute("stroke-width", "2");
      basePath.setAttribute("stroke-linecap", "round"); basePath.setAttribute("opacity", "0.16");
      svg.appendChild(basePath);
      wetPath = basePath.cloneNode(false);
      wetPath.setAttribute("stroke", "#5e9dc0"); wetPath.setAttribute("stroke-width", "2.4");
      wetPath.setAttribute("opacity", "0.4");
      svg.appendChild(wetPath);
      ripples = document.createElementNS(NS, "g"); svg.appendChild(ripples);
      drop = document.createElementNS(NS, "g");
      drop.style.filter = "drop-shadow(0 3px 4px rgba(53,106,140,.35))";
      dropInner = document.createElementNS(NS, "g");
      var tear = document.createElementNS(NS, "path");
      tear.setAttribute("d", "M0 -11 C 6 -3 8 5 0 11 C -8 5 -6 -3 0 -11 Z");
      tear.setAttribute("fill", "url(#cs-dropg)"); tear.setAttribute("stroke", "#356a8c"); tear.setAttribute("stroke-width", "0.8");
      var hi = document.createElementNS(NS, "ellipse");
      hi.setAttribute("cx", "-2.4"); hi.setAttribute("cy", "2.5"); hi.setAttribute("rx", "1.9"); hi.setAttribute("ry", "3.2");
      hi.setAttribute("fill", "#ffffff"); hi.setAttribute("opacity", "0.6");
      dropInner.appendChild(tear); dropInner.appendChild(hi); drop.appendChild(dropInner);
      svg.appendChild(drop);
      host.appendChild(svg);

      totalLen = basePath.getTotalLength();
      wetPath.style.strokeDasharray = totalLen;
      anchors.forEach(function (a) {
        var best = 0, bd = 1e12;
        for (var s = 0; s <= 150; s++) {
          var L = totalLen * s / 150, p = basePath.getPointAtLength(L);
          var dx = p.x - a.x, dy = p.y - a.y, dd = dx * dx + dy * dy;
          if (dd < bd) { bd = dd; best = L; }
        }
        a._len = best; a._done = false;
      });
      curLen = lastLen = target = 0;
      render(true);
    }

    function render(snap) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      target = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) * totalLen : 0;
      curLen += (target - curLen) * (snap ? 1 : 0.16);
      var p = basePath.getPointAtLength(curLen);
      var p2 = basePath.getPointAtLength(Math.min(totalLen, curLen + 1));
      var ang = Math.atan2(p2.y - p.y, p2.x - p.x) * 180 / Math.PI - 90;
      var speed = Math.abs(curLen - lastLen); lastLen = curLen;
      var stretch = Math.min(2.3, 1 + speed * 0.05);
      drop.setAttribute("transform", "translate(" + px(p.x) + "," + px(p.y) + ") rotate(" + px(ang) + ")");
      dropInner.setAttribute("transform", "scale(" + px(1 / Math.sqrt(stretch)) + "," + px(stretch) + ")");
      wetPath.style.strokeDashoffset = (totalLen - curLen);
      anchors.forEach(function (a) {
        if (!a._done && curLen >= a._len && curLen > 2) { a._done = true; ripple(a.x, a.y); }
        else if (a._done && curLen < a._len - 60) { a._done = false; }
      });
    }

    function loop() {
      render(false);
      if (Math.abs(target - curLen) > 0.4) { requestAnimationFrame(loop); } else { animating = false; }
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

/* DWR Decoded - motion orchestration (v2).
   GSAP + ScrollTrigger drive everything; no raw scroll listeners anywhere.
   Reduced motion (or missing GSAP) falls back to instant state switching.
   The schematic timeline is generic: each <g data-on="..."> declares its
   scenes; .draw strokes draw on, .pop elements spring in. */

(function () {
  "use strict";

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  var SCENES = 9;
  var fig = $("[data-schematic]");
  var groups = fig ? $$("g[data-on]", fig) : [];
  var steps = $$(".step");

  function onIn(g, n) {
    return g.getAttribute("data-on").split(" ").indexOf(String(n)) !== -1;
  }

  /* ===== static path: reduced motion, or GSAP failed to load ===== */
  function staticMode() {
    document.body.classList.add("static");
    groups.forEach(function (g) { g.classList.toggle("is-on", onIn(g, 1)); });
    if (steps.length && "IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          var i = steps.indexOf(e.target);
          steps.forEach(function (s, j) { s.classList.toggle("is-active", j === i); });
          groups.forEach(function (g) { g.classList.toggle("is-on", onIn(g, i + 1)); });
        });
      }, { rootMargin: "-42% 0px -50% 0px" });
      steps.forEach(function (s) { io.observe(s); });
    }
  }

  var hasGSAP = typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!hasGSAP || reduce) { staticMode(); return; }

  gsap.registerPlugin(ScrollTrigger);

  /* ===== hero entrance: masked word rise ===== */
  var h1 = $("#hero-h1");
  if (h1) {
    var frag = document.createDocumentFragment();
    function addWord(word, accent) {
      var wm = document.createElement("span"); wm.className = "wm";
      var w = document.createElement("span"); w.className = accent ? "w accent-word" : "w";
      w.textContent = word;
      wm.appendChild(w);
      frag.appendChild(wm);
      frag.appendChild(document.createTextNode(" "));
    }
    Array.prototype.slice.call(h1.childNodes).forEach(function (node) {
      if (node.nodeType === 3) {
        node.textContent.split(/\s+/).filter(Boolean).forEach(function (w) { addWord(w, false); });
      } else if (node.nodeName === "BR") {
        frag.appendChild(document.createElement("br"));
      } else if (node.nodeName === "EM") {
        node.textContent.split(/\s+/).filter(Boolean).forEach(function (w) { addWord(w, true); });
      }
    });
    h1.innerHTML = "";
    h1.appendChild(frag);

    gsap.timeline({ defaults: { ease: "power4.out" } })
      .from($$(".w", h1), { yPercent: 115, duration: 0.95, stagger: 0.07 }, 0.15)
      .from(".context-line", { autoAlpha: 0, y: 14, duration: 0.6 }, 0.1)
      .from(".hero-content .lede", { autoAlpha: 0, y: 18, duration: 0.7 }, 0.55)
      .from(".hero-cta", { autoAlpha: 0, y: 18, duration: 0.7 }, 0.72)
      .from(".hero-caption", { autoAlpha: 0, duration: 0.8 }, 1.05);
  }

  /* ===== manifesto: word-by-word scrubbed emphasis ===== */
  var mLine = $("#manifesto-line");
  if (mLine) {
    var words = mLine.textContent.trim().split(/\s+/);
    mLine.textContent = "";
    words.forEach(function (w, i) {
      var s = document.createElement("span");
      s.className = "mw";
      s.textContent = w;
      mLine.appendChild(s);
      if (i < words.length - 1) mLine.appendChild(document.createTextNode(" "));
    });
    gsap.fromTo($$(".mw", mLine), { opacity: 0.14 }, {
      opacity: 1, stagger: 0.06, ease: "none",
      scrollTrigger: { trigger: mLine, start: "top 80%", end: "top 32%", scrub: 0.6 }
    });
  }

  /* ===== schematic: scrubbed master timeline across 9 scenes ===== */
  if (fig && steps.length && groups.length) {
    var drawEls = $$(".draw", fig);
    drawEls.forEach(function (el) {
      var len = 600;
      try { len = el.getTotalLength(); } catch (e) {}
      el.dataset.len = len;
      el.style.strokeDasharray = len + " " + len;
    });

    /* initial state = scene 1 settled */
    groups.forEach(function (g) {
      gsap.set(g, { autoAlpha: onIn(g, 1) ? 1 : 0 });
      $$(".draw", g).forEach(function (el) {
        gsap.set(el, { strokeDashoffset: onIn(g, 1) ? 0 : parseFloat(el.dataset.len) });
      });
    });

    var master = gsap.timeline({
      defaults: { ease: "power2.out" },
      scrollTrigger: {
        trigger: ".steps",
        start: "top 62%",
        end: "bottom 40%",
        scrub: 0.7
      }
    });

    for (var n = 2; n <= SCENES; n++) {
      (function (n) {
        var label = "s" + n;
        var entering = groups.filter(function (g) { return onIn(g, n) && !onIn(g, n - 1); });
        var leaving = groups.filter(function (g) { return !onIn(g, n) && onIn(g, n - 1); });

        master.addLabel(label);
        if (leaving.length) {
          master.to(leaving, { autoAlpha: 0, y: -10, duration: 0.35, stagger: 0.02 }, label);
        }
        if (entering.length) {
          master.fromTo(entering,
            { autoAlpha: 0, y: 14 },
            { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.04 },
            label + "+=0.15");
          entering.forEach(function (g) {
            var d = $$(".draw", g);
            if (d.length) {
              master.fromTo(d,
                { strokeDashoffset: function (i, el) { return parseFloat(el.dataset.len); } },
                { strokeDashoffset: 0, duration: 0.6, stagger: 0.07, ease: "power1.inOut" },
                label + "+=0.22");
            }
            var p = $$(".pop", g);
            if (p.length) {
              master.fromTo(p,
                { scale: 0.4, autoAlpha: 0, transformOrigin: "50% 50%" },
                { scale: 1, autoAlpha: 1, duration: 0.5, stagger: 0.05, ease: "back.out(1.8)" },
                label + "+=0.28");
            }
          });
        }
        if (n === 8) {  /* the unlock: heat shimmer while the oven scene is live */
          master.to($$(".heat", fig), { y: -4, duration: 0.12, repeat: 5, yoyo: true, ease: "sine.inOut" }, label + "+=0.6");
        }
        master.to({}, { duration: 0.55 });   /* dwell between scenes */
      })(n);
    }

    /* step card focus (CSS transitions carry the visual change) */
    steps.forEach(function (s) {
      ScrollTrigger.create({
        trigger: s, start: "top 62%", end: "bottom 38%",
        onToggle: function (st) {
          if (st.isActive) {
            steps.forEach(function (o) { o.classList.toggle("is-active", o === s); });
          }
        }
      });
    });
  }

  /* ===== evidence counters ===== */
  $$("[data-count]").forEach(function (el) {
    var target = parseInt(el.getAttribute("data-count"), 10);
    if (isNaN(target)) return;
    el.textContent = "0";
    ScrollTrigger.create({
      trigger: el, start: "top 86%", once: true,
      onEnter: function () {
        var obj = { v: 0 };
        gsap.to(obj, {
          v: target, duration: 1.6, ease: "power1.out",
          onUpdate: function () { el.textContent = Math.round(obj.v); }
        });
      }
    });
  });

  /* ===== gentle reveals ===== */
  $$(".reveal").forEach(function (el) {
    gsap.from(el, {
      autoAlpha: 0, y: 26, duration: 0.9, ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 84%", once: true }
    });
  });

  /* ===== image parallax inside masked frames ===== */
  $$("[data-parallax]").forEach(function (img) {
    gsap.fromTo(img, { yPercent: -11 }, {
      yPercent: 11, ease: "none",
      scrollTrigger: { trigger: img.parentElement, start: "top bottom", end: "bottom top", scrub: true }
    });
  });

  /* ===== lazy 3D hero (Three.js): load after window load, fade over fallback ===== */
  function webglOK() {
    try {
      var c = document.createElement("canvas");
      return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
    } catch (e) { return false; }
  }
  function loadScript(src, ok) {
    var s = document.createElement("script");
    s.src = src; s.onload = ok;
    document.head.appendChild(s);
  }

  var glHost = $("#hero-gl");
  if (glHost && webglOK()) {
    var boot = function () {
      loadScript("assets/vendor/three.min.js", function () {
        loadScript("hero3d.js", function () {
          if (!window.initHero3D) return;
          var api = window.initHero3D(glHost, window.matchMedia("(max-width: 768px)").matches);
          if (!api) return;
          gsap.fromTo(glHost, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.5, ease: "power2.inOut" });
          gsap.to(".hero-fallback", { autoAlpha: 0, duration: 1.5, ease: "power2.inOut" });
          var cap = $("#hero-caption");
          if (cap) cap.textContent = "live render · droplets at water's refractive index, n = 1.33";
          new IntersectionObserver(function (entries) {
            entries.forEach(function (e) { if (e.isIntersecting) { api.resume(); } else { api.pause(); } });
          }).observe($(".hero-stage"));
          document.addEventListener("visibilitychange", function () {
            if (document.hidden) { api.pause(); } else { api.resume(); }
          });
        });
      });
    };
    if (document.readyState === "complete") { setTimeout(boot, 200); }
    else { window.addEventListener("load", function () { setTimeout(boot, 200); }); }
  }
})();

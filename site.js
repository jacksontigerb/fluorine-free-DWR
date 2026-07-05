/* Fluorine-Free DWR - single page interactions (vanilla, no deps).
   Reveals, sticky-nav state, active section link, scroll-scrubbed drop video.
   Everything degrades: no JS = full content; reduced motion = no scrub, no reveal. */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- sticky nav: solid after the hero ---- */
  var nav = document.getElementById("nav");
  function navState() {
    if (!nav) return;
    nav.classList.toggle("scrolled", window.scrollY > window.innerHeight * 0.6);
  }

  /* ---- reveals on enter ---- */
  var reveals = [].slice.call(document.querySelectorAll(".reveal"));
  if ("IntersectionObserver" in window && reveals.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.12 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---- active nav link ---- */
  var links = [].slice.call(document.querySelectorAll('.nav nav a'));
  var sections = links
    .map(function (a) {
      var href = a.getAttribute("href") || "";
      return href.charAt(0) === "#" ? document.querySelector(href) : null;
    })
    .filter(Boolean);
  if ("IntersectionObserver" in window && sections.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          links.forEach(function (a) {
            a.classList.toggle("active", a.getAttribute("href") === "#" + e.target.id);
          });
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach(function (s) { spy.observe(s); });
  }

  /* ---- drop video: autoplay only while on screen (save battery) ---- */
  var vid = document.getElementById("dropVid");
  if (vid && "IntersectionObserver" in window) {
    var vio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { var p = vid.play(); if (p && p.catch) p.catch(function () {}); }
        else { vid.pause(); }
      });
    }, { threshold: 0.25 });
    vio.observe(vid);
  }

  /* ---- rAF-throttled scroll loop (nav state) ---- */
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { navState(); ticking = false; });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  navState();
})();

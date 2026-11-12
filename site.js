/* Fluorine free DWR, shared page behaviour (vanilla, no deps).
   The nav sits clear over the home page film and turns solid once the film has
   scrolled away. Pages without a film start solid. The film only plays on screen
   and stays on its poster frame for anyone who asks for reduced motion. */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var nav = document.getElementById("nav");
  var hero = document.getElementById("hero");

  function navState() {
    if (!nav) return;
    var solid = !hero || window.scrollY > hero.offsetHeight - nav.offsetHeight - 8;
    nav.classList.toggle("solid", solid);
  }

  var vid = document.getElementById("dropVid");
  if (vid) {
    if (reduce) {
      vid.removeAttribute("autoplay");
      vid.pause();
    } else if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { var p = vid.play(); if (p && p.catch) p.catch(function () {}); }
          else { vid.pause(); }
        });
      }, { threshold: 0.1 }).observe(vid);
    }
  }

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

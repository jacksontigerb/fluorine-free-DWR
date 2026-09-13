/* Fluorine Free DWR - wetting physics for the teaching page (pure functions, no DOM).
   Loaded as a plain script in the browser (window.WettingPhysics) and by
   tests/physics.test.mjs under `node --test`. Angles in degrees, volumes in uL.
   These are idealised textbook relations, not a model of the lab samples. */
(function (root) {
  "use strict";

  var GAMMA = 0.0728;   /* water surface tension at about 20 C, N/m */
  var RHO = 998;        /* water density, kg/m3 */
  var G = 9.81;         /* m/s2 */

  function rad(d) { return d * Math.PI / 180; }
  function deg(r) { return r * 180 / Math.PI; }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  /* Wenzel: the liquid follows the texture. cos(theta*) = r cos(thetaY) */
  function wenzelAngle(thetaY, r) {
    var c = r * Math.cos(rad(thetaY));
    return c >= 1 ? 0 : (c <= -1 ? 180 : deg(Math.acos(c)));
  }

  /* Cassie-Baxter on flat topped texture: cos(theta*) = fs (cos(thetaY) + 1) - 1 */
  function cassieAngle(thetaY, fs) {
    return deg(Math.acos(clamp(fs * (Math.cos(rad(thetaY)) + 1) - 1, -1, 1)));
  }

  /* the roughness a Wenzel drop needs to show theta* on a material with thetaY */
  function requiredR(thetaStar, thetaY) {
    var cy = Math.cos(rad(thetaY)), cs = Math.cos(rad(thetaStar));
    if (Math.abs(cy) < 1e-9) return { ok: false, reason: "no roughness changes a 90° surface" };
    var r = cs / cy;
    if (r < 1) return { ok: false, reason: "roughness can only push the angle further from 90°", value: r };
    return { ok: true, value: r };
  }

  /* the solid fraction a Cassie-Baxter drop needs to show theta* */
  function requiredFs(thetaStar, thetaY) {
    var fs = (Math.cos(rad(thetaStar)) + 1) / (Math.cos(rad(thetaY)) + 1);
    if (fs > 1) return { ok: false, reason: "resting on air can only raise the angle", value: fs };
    if (fs <= 0) return { ok: false, reason: "needs no solid contact at all", value: fs };
    return { ok: true, value: fs };
  }

  /* which ideal state has the lower energy (Bico, Marzolin and Quere criterion) */
  function lowerEnergyState(thetaY, r, fs) {
    var crit = (fs - 1) / (r - fs);          /* Cassie is lower when cos(thetaY) < crit */
    return {
      state: Math.cos(rad(thetaY)) < crit ? "cassie" : "wenzel",
      criticalAngle: crit > -1 && crit < 1 ? deg(Math.acos(crit)) : null
    };
  }

  /* radius of the sphere with the same volume, m */
  function equivalentRadius(volUL) { return Math.cbrt(3 * volUL * 1e-9 / (4 * Math.PI)); }

  /* Bond number on the equivalent sphere radius: gravity against surface tension */
  function bond(volUL) {
    var R = equivalentRadius(volUL);
    return RHO * G * R * R / GAMMA;
  }

  /* contact width of a spherical cap of this volume at this angle, m */
  function capWidth(volUL, theta) {
    var c = Math.cos(rad(theta));
    var shape = (Math.PI / 3) * (2 - 3 * c + c * c * c);
    var R = Math.cbrt(volUL * 1e-9 / shape);
    return 2 * R * Math.sin(rad(theta));
  }

  /* Furmidge retention balance: rho V g sin(alpha) = k gamma w (cos thetaR - cos thetaA).
     The footprint w uses a spherical cap at the mean of the two angles, an
     approximation that gets worse as the Bond number grows. */
  function rolloff(o) {
    if (!(o.thetaR <= o.thetaA)) return { ok: false, reason: "the receding angle cannot be above the advancing angle" };
    var k = o.k == null ? 1 : o.k;
    var w = capWidth(o.vol, (o.thetaA + o.thetaR) / 2);
    var retain = k * GAMMA * w * (Math.cos(rad(o.thetaR)) - Math.cos(rad(o.thetaA)));
    var weight = RHO * o.vol * 1e-9 * G;
    var s = retain / weight;
    return {
      ok: true,
      released: s < 1,
      alpha: s < 1 ? deg(Math.asin(s)) : null,
      width: w,
      bond: bond(o.vol)
    };
  }

  var api = {
    GAMMA: GAMMA, RHO: RHO, G: G,
    wenzelAngle: wenzelAngle, cassieAngle: cassieAngle,
    requiredR: requiredR, requiredFs: requiredFs, lowerEnergyState: lowerEnergyState,
    equivalentRadius: equivalentRadius, bond: bond, capWidth: capWidth, rolloff: rolloff
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  root.WettingPhysics = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

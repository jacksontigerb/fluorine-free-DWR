// Run from the repo root: node --test tests/physics.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const P = createRequire(import.meta.url)("../wetting-physics.js");
const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} is not within ${tol} of ${b}`);

test("same angle, two explanations: 132 degrees on a 108 degree material", () => {
  const r = P.requiredR(132, 108), fs = P.requiredFs(132, 108);
  assert.ok(r.ok && fs.ok);
  near(r.value, 2.165, 0.001);
  near(fs.value, 0.479, 0.001);
  near(P.wenzelAngle(108, r.value), 132, 1e-6);
  near(P.cassieAngle(108, fs.value), 132, 1e-6);
});

test("impossible textures are refused, not clamped", () => {
  assert.equal(P.requiredR(100, 108).ok, false);   // Wenzel cannot pull a hydrophobic angle towards 90
  assert.equal(P.requiredFs(100, 108).ok, false);  // resting on air cannot lower the angle
  assert.equal(P.requiredR(120, 90).ok, false);
});

test("Bond numbers at 10, 20 and 50 uL (equivalent sphere radius)", () => {
  near(P.bond(10), 0.241, 0.001);
  near(P.bond(20), 0.382, 0.001);
  near(P.bond(50), 0.703, 0.002);
});

test("a spherical cap keeps its volume", () => {
  // at 90 degrees the cap is a hemisphere: V = (2/3) pi R^3, width = 2R
  const w = P.capWidth(10, 90), R = w / 2;
  near((2 / 3) * Math.PI * R ** 3 * 1e9, 10, 1e-9);
});

test("roll off: no release when retention beats weight", () => {
  const res = P.rolloff({ thetaA: 150, thetaR: 90, vol: 5, k: 1 });
  assert.ok(res.ok);
  assert.equal(res.released, false);
  assert.equal(res.alpha, null);
});

test("roll off falls as the drop gets bigger", () => {
  const a = [5, 10, 20, 40].map((vol) => P.rolloff({ thetaA: 140, thetaR: 125, vol, k: 1 }).alpha);
  assert.ok(a.every((v) => v !== null));
  for (let i = 1; i < a.length; i++) assert.ok(a[i] < a[i - 1], `alpha did not fall: ${a}`);
});

test("a receding angle above the advancing angle is rejected", () => {
  assert.equal(P.rolloff({ thetaA: 120, thetaR: 130, vol: 10 }).ok, false);
});

test("lower energy state flips at the critical angle", () => {
  // cos(thetaC) = (fs - 1) / (r - fs) = -0.52 / 1.72, so thetaC is about 107.6 degrees
  const s = P.lowerEnergyState(108, 2.2, 0.48);
  near(s.criticalAngle, 107.6, 0.05);
  assert.equal(s.state, "cassie");
  assert.equal(P.lowerEnergyState(107, 2.2, 0.48).state, "wenzel");
});

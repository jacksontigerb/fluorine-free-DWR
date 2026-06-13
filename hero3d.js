/* DWR Decoded - hero render (Three.js r149, classic script).
   A woven cotton surface with water droplets beading on it.
   Scientific notes baked in: droplet material uses water's real
   refractive index (ior 1.33), and droplets sit mostly above the
   surface, i.e. a high contact angle. One droplet rolls across the
   weave, which is the whole point of the project.
   Lazy-loaded by site.js; pausable; never initialised under
   prefers-reduced-motion (site.js guards that). */

window.initHero3D = function (host, isMobile) {
  "use strict";
  if (!window.THREE) return null;
  var THREE = window.THREE;

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (e) { return null; }

  var W = Math.max(host.clientWidth, 2);
  var H = Math.max(host.clientHeight, 2);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
  renderer.setSize(W, H);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  host.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(34, W / H, 0.1, 60);
  var camBase = new THREE.Vector3(0, 2.15, 7.6);
  camera.position.copy(camBase);
  camera.lookAt(0, 0.5, -0.4);

  scene.add(new THREE.AmbientLight(0xffffff, 0.85));
  var dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(3.5, 6, 4);
  scene.add(dir);
  scene.add(new THREE.HemisphereLight(0xf2f6f2, 0xdde6e0, 0.55));

  /* ---- woven surface: two interlaced sets of sinusoidal tubes ---- */
  var weave = new THREE.Group();
  var fibreMat = new THREE.MeshStandardMaterial({ color: 0xe7ebe6, roughness: 0.94, metalness: 0 });
  var R = 0.21, SP = 0.62;
  var EXT = isMobile ? 4.6 : 6.4;
  var SEGS = isMobile ? 36 : 48;

  function tube(axis, offset, phase) {
    var pts = [];
    for (var t = -EXT; t <= EXT + 0.001; t += 0.4) {
      var wave = Math.sin((t / SP) * Math.PI + phase) * 0.16;
      if (axis === "x") pts.push(new THREE.Vector3(t, wave, offset));
      else pts.push(new THREE.Vector3(offset, -wave, t));
    }
    var geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), SEGS, R, 9, false);
    return new THREE.Mesh(geo, fibreMat);
  }

  var i;
  var warpN = isMobile ? 4 : 5;
  var weftN = isMobile ? 7 : 10;
  for (i = -warpN; i <= warpN; i++) weave.add(tube("x", i * SP, i % 2 ? 0 : Math.PI));
  for (i = -weftN; i <= weftN; i++) weave.add(tube("z", i * SP, i % 2 ? Math.PI : 0));
  weave.position.y = -0.1;
  scene.add(weave);

  /* ---- droplets: ior 1.33 = water ---- */
  var dropMat = new THREE.MeshPhysicalMaterial({
    color: 0xeaf4fa,
    transmission: 0.92,
    thickness: 1.1,
    ior: 1.33,
    roughness: 0.06,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    transparent: true
  });
  var sphereGeo = new THREE.SphereGeometry(1, 40, 28);

  /* [x, z, radius]; z is depth into the scene */
  var spots = isMobile
    ? [[-1.7, -0.4, 0.5], [0.5, -1.2, 0.62], [1.9, 0.4, 0.4], [-0.7, 1.0, 0.34]]
    : [[-2.7, -0.5, 0.5], [-0.9, -1.1, 0.66], [0.9, 0.2, 0.42], [2.4, -0.9, 0.56], [3.7, 0.5, 0.3], [-3.9, 0.8, 0.34], [1.8, 1.3, 0.3]];

  var drops = [];
  spots.forEach(function (s, idx) {
    var m = new THREE.Mesh(sphereGeo, dropMat);
    var r = s[2];
    m.scale.set(r, r * 0.92, r);                 /* slight flatten: a seated bead */
    m.position.set(s[0], 0.3 + r * 0.84, s[1]);  /* mostly above the surface: high contact angle */
    scene.add(m);
    drops.push({ mesh: m, base: r, phase: idx * 1.7 });
  });

  /* one droplet rolls across the weave */
  var rollerR = 0.38;
  var roller = new THREE.Mesh(sphereGeo, dropMat);
  roller.scale.set(rollerR, rollerR * 0.92, rollerR);
  scene.add(roller);

  /* ---- pointer parallax (pointermove only, no scroll listeners) ---- */
  var tx = 0, ty = 0, px = 0, py = 0;
  function onPointer(e) {
    tx = (e.clientX / window.innerWidth - 0.5) * 2;
    ty = (e.clientY / window.innerHeight - 0.5) * 2;
  }
  window.addEventListener("pointermove", onPointer, { passive: true });

  function onResize() {
    W = Math.max(host.clientWidth, 2);
    H = Math.max(host.clientHeight, 2);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    renderer.setSize(W, H);
  }
  window.addEventListener("resize", onResize);

  /* ---- loop ---- */
  var clock = new THREE.Clock();
  var running = false, rafOn = false, disposed = false;

  function loop() {
    if (disposed || !running) { rafOn = false; return; }
    rafOn = true;
    requestAnimationFrame(loop);

    var t = clock.getElapsedTime();
    px += (tx - px) * 0.04;
    py += (ty - py) * 0.04;
    camera.position.x = camBase.x + px * 0.5;
    camera.position.y = camBase.y - py * 0.22;
    camera.lookAt(0, 0.5, -0.4);

    /* breathing beads */
    for (var k = 0; k < drops.length; k++) {
      var d = drops[k];
      var s = 1 + Math.sin(t * 1.3 + d.phase) * 0.012;
      d.mesh.scale.set(d.base * s, d.base * 0.92 * s, d.base * s);
    }

    /* rolling bead: crosses the visible weave, wraps offscreen */
    var span = EXT * 1.6;
    var x = -span / 2 + ((t * 0.55) % span);
    roller.position.set(x, 0.3 + rollerR * 0.84 + Math.sin((x / SP) * Math.PI) * 0.05, 1.6);
    roller.rotation.z = -x * 1.6;

    renderer.render(scene, camera);
  }

  var api = {
    pause: function () { running = false; },
    resume: function () {
      if (disposed) return;
      if (!running) { running = true; clock.getDelta(); }
      if (!rafOn) loop();
    },
    dispose: function () {
      disposed = true; running = false;
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
  };
  api.resume();
  return api;
};

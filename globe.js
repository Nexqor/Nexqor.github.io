// Nexqor 3D attack globe (hero). Requires three.js r128 (global THREE).
(function () {
  const host = document.querySelector('.reticle');
  if (!host || !window.THREE) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (e) { return; } // no WebGL: keep the SVG fallback
  const CHERRY = 0xc41237, BRIGHT = 0xff3a5c, CYAN = 0x3fe3ff;

  const canvas = renderer.domElement;
  canvas.className = 'globe3d';
  canvas.setAttribute('aria-hidden', 'true');
  host.prepend(canvas);
  host.classList.add('has3d');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0, 4.3);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const world = new THREE.Group();
  world.rotation.x = 0.35;
  scene.add(world);

  // --- dotted sphere (fibonacci points)
  const N = 1400, R = 1.25, pts = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = Math.PI * (3 - Math.sqrt(5)) * i;
    pts.set([Math.cos(th) * r * R, y * R, Math.sin(th) * r * R], i * 3);
  }
  const dotGeo = new THREE.BufferGeometry();
  dotGeo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  world.add(new THREE.Points(dotGeo, new THREE.PointsMaterial({ color: CHERRY, size: 0.022, transparent: true, opacity: 0.85 })));

  // --- faint wire shell + inner glow core
  world.add(new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(R * 1.002, 2)),
    new THREE.LineBasicMaterial({ color: CHERRY, transparent: true, opacity: 0.12 })));
  const core = new THREE.Mesh(new THREE.SphereGeometry(R * 0.985, 48, 48),
    new THREE.MeshBasicMaterial({ color: 0x14030a, transparent: true, opacity: 0.85 }));
  world.add(core);

  // --- orbit ring (equatorial scanner)
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R * 1.32, 0.004, 8, 160),
    new THREE.MeshBasicMaterial({ color: CHERRY, transparent: true, opacity: 0.55 }));
  ring.rotation.x = Math.PI / 2;
  scene.add(ring);
  const ring2 = ring.clone(); ring2.scale.setScalar(1.12); ring2.material = ring.material.clone(); ring2.material.opacity = 0.25;
  scene.add(ring2);

  // --- nodes (targets) and attack arcs
  const randOnSphere = () => {
    const u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    return new THREE.Vector3(s * Math.cos(t), u, s * Math.sin(t)).multiplyScalar(R);
  };
  const nodes = Array.from({ length: 14 }, randOnSphere);
  const nodeGeo = new THREE.SphereGeometry(0.028, 12, 12);
  nodes.forEach((p, i) => {
    const m = new THREE.Mesh(nodeGeo, new THREE.MeshBasicMaterial({ color: i % 5 === 0 ? CYAN : BRIGHT }));
    m.position.copy(p); world.add(m);
  });

  const SEG = 64, arcs = [];
  function makeArc() {
    const a = nodes[Math.floor(Math.random() * nodes.length)];
    let b = nodes[Math.floor(Math.random() * nodes.length)];
    if (a === b) b = randOnSphere();
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const lift = 1 + a.distanceTo(b) * 0.45;
    mid.normalize().multiplyScalar(R * lift);
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(SEG));
    geo.setDrawRange(0, 0);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: BRIGHT, transparent: true, opacity: 0.9 }));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    world.add(line, head);
    return { line, head, curve, t: 0, speed: 0.006 + Math.random() * 0.008, fade: 1 };
  }
  for (let i = 0; i < 7; i++) { const a = makeArc(); a.t = Math.random(); arcs.push(a); }

  // --- pointer parallax
  let tx = 0, ty = 0;
  addEventListener('pointermove', e => {
    tx = (e.clientX / innerWidth - 0.5) * 0.6;
    ty = (e.clientY / innerHeight - 0.5) * 0.4;
  }, { passive: true });

  function resize() {
    const w = host.clientWidth, h = host.clientHeight || w;
    renderer.setSize(w * 1.35, h * 1.35, false);
    camera.aspect = 1; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host);
  resize();

  let visible = true;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(host);

  function tick() {
    requestAnimationFrame(tick);
    if (!visible) return;
    world.rotation.y += reduce ? 0 : 0.0022;
    world.rotation.x += ((0.35 + ty) - world.rotation.x) * 0.04;
    scene.rotation.y += (tx - scene.rotation.y) * 0.04;
    ring.rotation.z += 0.003; ring2.rotation.z -= 0.002;
    if (!reduce) arcs.forEach((a, i) => {
      a.t += a.speed;
      const n = Math.min(SEG + 1, Math.floor(a.t * (SEG + 1)));
      a.line.geometry.setDrawRange(0, n);
      a.head.position.copy(a.curve.getPoint(Math.min(a.t, 1)));
      a.head.visible = a.t < 1;
      if (a.t > 1) { a.fade -= 0.03; a.line.material.opacity = Math.max(0, a.fade); }
      if (a.fade <= 0) {
        world.remove(a.line, a.head); a.line.geometry.dispose();
        arcs[i] = makeArc();
      }
    });
    renderer.render(scene, camera);
  }
  if (reduce) arcs.forEach(a => { a.line.geometry.setDrawRange(0, SEG + 1); a.head.visible = false; });
  tick();
})();

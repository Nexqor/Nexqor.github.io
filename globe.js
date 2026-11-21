// Nexqor 3D attack globe (hero) - v3
// Techniques used by well-known product globes:
//  * dotted continents generated programmatically from real land polygons (Natural Earth 110m)
//  * fresnel atmosphere glow shader
//  * animated attack arcs between real cities with landing pulses
// Requires three.js r128 (global THREE). Falls back to the SVG reticle without WebGL.
(function () {
  const host = document.querySelector('.reticle');
  if (!host || !window.THREE) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch (e) { return; }

  const CHERRY = new THREE.Color(0xc41237), HOT = new THREE.Color(0xff3a5c), CYAN = new THREE.Color(0x3fe3ff);
  const R = 1.2;

  const canvas = renderer.domElement;
  canvas.className = 'globe3d';
  canvas.setAttribute('aria-hidden', 'true');
  host.prepend(canvas);
  host.classList.add('has3d');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 4.4);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const world = new THREE.Group();
  world.rotation.set(0.28, -1.9, 0);
  scene.add(world);

  const toVec = (lat, lon, r = R) => {
    const phi = (90 - lat) * Math.PI / 180, th = (lon + 180) * Math.PI / 180;
    return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
  };

  // ---- dark ocean core
  world.add(new THREE.Mesh(new THREE.SphereGeometry(R * 0.995, 64, 64),
    new THREE.MeshBasicMaterial({ color: 0x0d0207 })));

  // ---- fresnel atmosphere (back-side additive glow)
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.18, 64, 64), new THREE.ShaderMaterial({
    uniforms: { c: { value: CHERRY } },
    vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 c; varying vec3 vN; void main(){ float i = pow(0.72 - dot(vN, vec3(0.,0.,1.)), 3.0); gl_FragColor = vec4(c, 1.0) * i * 1.6; }',
    side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false
  }));
  scene.add(atmo);

  // ---- dotted land (instanced discs facing outward)
  function buildDots(isLand) {
    const disc = new THREE.CircleGeometry(0.0085, 6);
    const pos = [];
    const ROWS = 150;
    for (let i = 0; i < ROWS; i++) {
      const lat = -82 + (164 * i) / (ROWS - 1);
      const n = Math.max(1, Math.round(Math.cos(lat * Math.PI / 180) * ROWS * 2.05));
      for (let j = 0; j < n; j++) {
        const lon = -180 + (360 * j) / n;
        if (isLand(lat, lon)) pos.push([lat, lon]);
      }
    }
    const mesh = new THREE.InstancedMesh(disc, new THREE.MeshBasicMaterial({ color: CHERRY, side: THREE.DoubleSide, transparent: true, opacity: 0.95 }), pos.length);
    const o = new THREE.Object3D();
    pos.forEach(([lat, lon], k) => {
      o.position.copy(toVec(lat, lon, R * 1.001));
      o.lookAt(o.position.clone().multiplyScalar(2));
      o.updateMatrix();
      mesh.setMatrixAt(k, o.matrix);
    });
    world.add(mesh);
  }

  async function landMask() {
    const load = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    if (!window.topojson) await load('https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js');
    const topo = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json').then(r => r.json());
    const land = topojson.feature(topo, topo.objects.land);
    const W = 1440, H = 720, c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    const polys = land.features.flatMap(f => f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates);
    polys.forEach(poly => {
      g.beginPath();
      poly.forEach(ring => {
        let prev = null;
        ring.forEach(([lon, lat], k) => {
          const x = (lon + 180) / 360 * W, y = (90 - lat) / 180 * H;
          if (k === 0 || (prev !== null && Math.abs(lon - prev) > 180)) g.moveTo(x, y); else g.lineTo(x, y);
          prev = lon;
        });
        g.closePath();
      });
      g.fill('evenodd');
    });
    const data = g.getImageData(0, 0, W, H).data;
    return (lat, lon) => {
      const x = Math.min(W - 1, Math.floor((lon + 180) / 360 * W)), y = Math.min(H - 1, Math.floor((90 - lat) / 180 * H));
      return data[(y * W + x) * 4 + 3] > 128;
    };
  }

  landMask().then(buildDots).catch(() => {
    // offline fallback: sparse random dots
    buildDots(() => Math.random() < 0.28);
  });

  // ---- cities (public coordinates) and attack traffic
  const CITIES = [
    [37.77, -122.42], [40.71, -74.0], [38.9, -77.04], [43.65, -79.38], [-23.55, -46.63], [51.51, -0.13],
    [52.52, 13.4], [48.86, 2.35], [50.45, 30.52], [59.33, 18.07], [55.75, 37.62], [25.2, 55.27],
    [28.61, 77.21], [1.35, 103.82], [22.32, 114.17], [31.23, 121.47], [35.68, 139.69], [37.57, 126.98],
    [-33.87, 151.21], [6.52, 3.38], [-26.2, 28.05], [19.43, -99.13]
  ].map(([la, lo]) => toVec(la, lo, R * 1.003));

  const markerGeo = new THREE.CircleGeometry(0.018, 16);
  CITIES.forEach((p, i) => {
    const m = new THREE.Mesh(markerGeo, new THREE.MeshBasicMaterial({ color: i % 6 === 0 ? CYAN : HOT, side: THREE.DoubleSide }));
    m.position.copy(p); m.lookAt(p.clone().multiplyScalar(2)); world.add(m);
  });

  const SEG = 80, arcs = [], pulses = [];
  const ringGeo = new THREE.RingGeometry(0.02, 0.028, 32);
  function makeArc() {
    const a = CITIES[Math.floor(Math.random() * CITIES.length)];
    let b = CITIES[Math.floor(Math.random() * CITIES.length)];
    if (a === b) b = CITIES[(CITIES.indexOf(a) + 5) % CITIES.length];
    const d = a.distanceTo(b);
    const mid = a.clone().add(b).normalize().multiplyScalar(R * (1 + d * 0.32));
    const c1 = a.clone().lerp(mid, 0.5).normalize().multiplyScalar(R * (1 + d * 0.24));
    const c2 = b.clone().lerp(mid, 0.5).normalize().multiplyScalar(R * (1 + d * 0.24));
    const curve = new THREE.CubicBezierCurve3(a, c1, c2, b);
    const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(SEG));
    geo.setDrawRange(0, 0);
    const col = Math.random() < 0.18 ? CYAN : HOT;
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending }));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    world.add(line, head);
    return { line, head, curve, end: b, col, t: 0, tail: 0, speed: 0.007 + Math.random() * 0.007, landed: false };
  }
  function landPulse(p, col) {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 1, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    m.position.copy(p); m.lookAt(p.clone().multiplyScalar(2));
    world.add(m); pulses.push({ m, s: 1 });
  }
  for (let i = 0; i < 9; i++) { const a = makeArc(); a.t = Math.random(); arcs.push(a); }

  // ---- pointer drag + parallax
  let tx = 0, ty = 0, dragging = false, lx = 0, velY = 0;
  addEventListener('pointermove', e => {
    tx = (e.clientX / innerWidth - 0.5) * 0.5;
    ty = (e.clientY / innerHeight - 0.5) * 0.3;
    if (dragging) { velY = (e.clientX - lx) * 0.005; world.rotation.y += velY; lx = e.clientX; }
  }, { passive: true });
  host.style.pointerEvents = 'auto';
  host.addEventListener('pointerdown', e => { dragging = true; lx = e.clientX; host.style.cursor = 'grabbing'; });
  addEventListener('pointerup', () => { dragging = false; host.style.cursor = 'grab'; });
  host.style.cursor = 'grab';

  function resize() {
    const w = host.clientWidth, h = host.clientHeight || w;
    renderer.setSize(w * 1.4, h * 1.4, false);
    camera.aspect = 1; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host);
  resize();

  let visible = true;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(host);

  function tick() {
    requestAnimationFrame(tick);
    if (!visible) return;
    if (!dragging) { world.rotation.y += reduce ? 0 : 0.0016 + velY; velY *= 0.94; }
    world.rotation.x += ((0.28 + ty) - world.rotation.x) * 0.04;
    scene.rotation.y += (tx - scene.rotation.y) * 0.04;
    if (!reduce) {
      arcs.forEach((a, i) => {
        if (a.t < 1) {
          a.t = Math.min(1, a.t + a.speed);
          a.line.geometry.setDrawRange(0, Math.floor(a.t * (SEG + 1)));
          a.head.position.copy(a.curve.getPoint(a.t));
        } else {
          if (!a.landed) { a.landed = true; a.head.visible = false; landPulse(a.end, a.col); }
          a.tail = Math.min(1, a.tail + a.speed * 1.3);
          const s = Math.floor(a.tail * (SEG + 1));
          a.line.geometry.setDrawRange(s, SEG + 1 - s);
          if (a.tail >= 1) {
            world.remove(a.line, a.head); a.line.geometry.dispose();
            arcs[i] = makeArc();
          }
        }
      });
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i]; p.s += 0.06; p.m.scale.setScalar(p.s); p.m.material.opacity = Math.max(0, 1 - (p.s - 1) / 3);
        if (p.s > 4) { world.remove(p.m); p.m.material.dispose(); pulses.splice(i, 1); }
      }
    }
    renderer.render(scene, camera);
  }
  if (reduce) arcs.forEach(a => { a.line.geometry.setDrawRange(0, SEG + 1); a.head.visible = false; });
  tick();
})();

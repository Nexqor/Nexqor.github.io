// Nexqor 3D attack globe (hero) - v5 with on-globe navigation
//  * dotted continents from real land polygons (Natural Earth 110m)
//  * fresnel atmosphere glow
//  * illustrative attack arcs between real cities, typed and filterable
//  * navigation pins pinned to the globe: click -> globe turns to the pin -> card -> open section
//  * control panel: pause, attack-type filters, live (simulated) traffic feed
// Requires three.js r128 (global THREE). Falls back to the SVG reticle without WebGL.
(function () {
  const host = document.querySelector('.reticle');
  if (!host || !window.THREE) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch (e) { return; }

  const CHERRY = new THREE.Color(0xc41237), CYAN = new THREE.Color(0x3fe3ff);
  const R = 1.2, SCALE = 1.4;

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

  // ---------------------------------------------------------------- globe body
  world.add(new THREE.Mesh(new THREE.SphereGeometry(R * 0.995, 64, 64), new THREE.MeshBasicMaterial({ color: 0x0d0207 })));
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.12, 64, 64), new THREE.ShaderMaterial({
    uniforms: { c: { value: CHERRY } },
    vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 c; varying vec3 vN; void main(){ float i = pow(max(0.0, 0.62 - dot(vN, vec3(0.,0.,1.))), 3.2); gl_FragColor = vec4(c, 1.0) * i * 0.85; }',
    side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false
  })));

  function buildDots(isLand) {
    const disc = new THREE.CircleGeometry(0.0085, 6), pos = [], ROWS = 150;
    for (let i = 0; i < ROWS; i++) {
      const lat = -82 + (164 * i) / (ROWS - 1);
      const n = Math.max(1, Math.round(Math.cos(lat * Math.PI / 180) * ROWS * 2.05));
      for (let j = 0; j < n; j++) { const lon = -180 + (360 * j) / n; if (isLand(lat, lon)) pos.push([lat, lon]); }
    }
    const mesh = new THREE.InstancedMesh(disc, new THREE.MeshBasicMaterial({ color: CHERRY, side: THREE.DoubleSide, transparent: true, opacity: 0.95 }), pos.length);
    const o = new THREE.Object3D();
    pos.forEach(([lat, lon], k) => { o.position.copy(toVec(lat, lon, R * 1.001)); o.lookAt(o.position.clone().multiplyScalar(2)); o.updateMatrix(); mesh.setMatrixAt(k, o.matrix); });
    world.add(mesh);
  }
  async function landMask() {
    const load = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    if (!window.topojson) await load('https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js');
    const topo = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json').then(r => r.json());
    const land = topojson.feature(topo, topo.objects.land);
    const W = 1440, H = 720, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); g.fillStyle = '#fff';
    land.features.flatMap(f => f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).forEach(poly => {
      g.beginPath();
      poly.forEach(ring => { let prev = null; ring.forEach(([lon, lat], k) => { const x = (lon + 180) / 360 * W, y = (90 - lat) / 180 * H; if (k === 0 || (prev !== null && Math.abs(lon - prev) > 180)) g.moveTo(x, y); else g.lineTo(x, y); prev = lon; }); g.closePath(); });
      g.fill('evenodd');
    });
    const data = g.getImageData(0, 0, W, H).data;
    return (lat, lon) => data[(Math.min(H - 1, Math.floor((90 - lat) / 180 * H)) * W + Math.min(W - 1, Math.floor((lon + 180) / 360 * W))) * 4 + 3] > 128;
  }
  landMask().then(buildDots).catch(() => buildDots(() => Math.random() < 0.28));

  // ---------------------------------------------------------------- cities & typed traffic
  const CITY = [
    ['San Francisco', 37.77, -122.42], ['New York', 40.71, -74.0], ['Washington', 38.9, -77.04], ['Toronto', 43.65, -79.38],
    ['São Paulo', -23.55, -46.63], ['London', 51.51, -0.13], ['Berlin', 52.52, 13.4], ['Paris', 48.86, 2.35],
    ['Kyiv', 50.45, 30.52], ['Stockholm', 59.33, 18.07], ['Dubai', 25.2, 55.27], ['New Delhi', 28.61, 77.21],
    ['Singapore', 1.35, 103.82], ['Hong Kong', 22.32, 114.17], ['Shanghai', 31.23, 121.47], ['Tokyo', 35.68, 139.69],
    ['Seoul', 37.57, 126.98], ['Sydney', -33.87, 151.21], ['Lagos', 6.52, 3.38], ['Johannesburg', -26.2, 28.05], ['Mexico City', 19.43, -99.13]
  ].map(([name, la, lo]) => ({ name, p: toVec(la, lo, R * 1.003) }));

  const TYPES = [
    { id: 'injection', label: 'Prompt injection', color: 0xff3a5c },
    { id: 'llmjacking', label: 'LLMjacking', color: 0xffb020 },
    { id: 'exfil', label: 'Data exfiltration', color: 0xe0435f },
    { id: 'mcp', label: 'MCP poisoning', color: 0x3fe3ff },
    { id: 'deepfake', label: 'Deepfake fraud', color: 0xb28cff }
  ];
  const active = new Set(TYPES.map(t => t.id));

  const markerGeo = new THREE.CircleGeometry(0.016, 16);
  CITY.forEach(c => { const m = new THREE.Mesh(markerGeo, new THREE.MeshBasicMaterial({ color: 0xff8fa3, side: THREE.DoubleSide })); m.position.copy(c.p); m.lookAt(c.p.clone().multiplyScalar(2)); world.add(m); });

  const SEG = 80, arcs = [], pulses = [];
  const ringGeo = new THREE.RingGeometry(0.02, 0.028, 32);
  function makeArc() {
    const pool = TYPES.filter(t => active.has(t.id));
    if (!pool.length) return null;
    const type = pool[Math.floor(Math.random() * pool.length)];
    const a = CITY[Math.floor(Math.random() * CITY.length)];
    let b = CITY[Math.floor(Math.random() * CITY.length)];
    if (a === b) b = CITY[(CITY.indexOf(a) + 5) % CITY.length];
    const d = a.p.distanceTo(b.p);
    const mid = a.p.clone().add(b.p).normalize().multiplyScalar(R * (1 + d * 0.32));
    const c1 = a.p.clone().lerp(mid, 0.5).normalize().multiplyScalar(R * (1 + d * 0.24));
    const c2 = b.p.clone().lerp(mid, 0.5).normalize().multiplyScalar(R * (1 + d * 0.24));
    const curve = new THREE.CubicBezierCurve3(a.p, c1, c2, b.p);
    const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(SEG)); geo.setDrawRange(0, 0);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: type.color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending }));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    world.add(line, head);
    feed(a.name, b.name, type);
    return { line, head, curve, end: b.p, type, t: 0, tail: 0, speed: 0.007 + Math.random() * 0.007, landed: false };
  }
  function killArc(a) { if (!a) return; world.remove(a.line, a.head); a.line.geometry.dispose(); }
  function landPulse(p, color) {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    m.position.copy(p); m.lookAt(p.clone().multiplyScalar(2)); world.add(m); pulses.push({ m, s: 1 });
  }

  // ---------------------------------------------------------------- navigation pins
  const NAV = [
    { k: 'news', label: 'NEWS', lat: 52, lon: -30, href: 'news.html', desc: 'Live feed of AI hacks, leaks and patches, rated and sourced.' },
    { k: 'map', label: '3D MAP', lat: 8, lon: 20, href: 'threatmap.html', desc: 'Every tracked incident, orbiting its attack class in 3D.' },
    { k: 'playbook', label: 'PLAYBOOK', lat: 40, lon: 95, href: 'playbook.html', desc: '9 attacks on AI: how they work, detection, defense.' },
    { k: 'checklist', label: 'CHECKLIST', lat: -22, lon: 135, href: 'checklist.html', desc: 'Score your AI agent security in 3 minutes. 24 checks.' },
    { k: 'scanner', label: 'SCANNER', lat: -12, lon: -60, href: 'tools.html', desc: 'Paste any page or email, find hidden prompt injection.' },
    { k: 'github', label: 'GITHUB', lat: 45, lon: -105, href: 'https://github.com/Nexqor', desc: 'mcp-audit, rag-canary, Sigma rules and more. Open source.' }
  ];
  const navLayer = document.createElement('div');
  navLayer.className = 'gnav';
  host.appendChild(navLayer);
  const pinGeo = new THREE.RingGeometry(0.03, 0.045, 32);
  NAV.forEach(n => {
    n.v = toVec(n.lat, n.lon, R * 1.004);
    const ring = new THREE.Mesh(pinGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
    ring.position.copy(n.v); ring.lookAt(n.v.clone().multiplyScalar(2)); world.add(ring); n.ring = ring;
    const stalk = new THREE.Line(new THREE.BufferGeometry().setFromPoints([n.v, n.v.clone().multiplyScalar(1.16)]), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }));
    world.add(stalk); n.top = n.v.clone().multiplyScalar(1.16);
    const b = document.createElement('button');
    b.className = 'gpin'; b.type = 'button'; b.innerHTML = `<i></i>${n.label}`;
    b.setAttribute('aria-label', `${n.label}: ${n.desc}`);
    b.addEventListener('pointerdown', e => e.stopPropagation());
    b.addEventListener('click', () => focus(n));
    navLayer.appendChild(b); n.el = b;
  });

  const card = document.createElement('div');
  card.className = 'gcard'; card.setAttribute('role', 'dialog');
  host.appendChild(card);
  card.addEventListener('pointerdown', e => e.stopPropagation());
  let focused = null, targetY = null;
  function focus(n) {
    focused = n;
    NAV.forEach(m => m.el.classList.toggle('on', m === n));
    const t = Math.atan2(-n.v.x, n.v.z);
    const cur = world.rotation.y; let d = ((t - cur) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    targetY = cur + d;
    const ext = /^https?:/.test(n.href);
    card.innerHTML = `<button class="gx" aria-label="Close">×</button><div class="gtag">// ${n.label}</div><p>${n.desc}</p><a class="btn solid" href="${n.href}"${ext ? ' target="_blank" rel="noopener"' : ''}>Open ${n.label.toLowerCase()} →</a>`;
    card.querySelector('.gx').onclick = () => { card.classList.remove('open'); focused = null; NAV.forEach(m => m.el.classList.remove('on')); };
    card.classList.add('open');
  }

  // ---------------------------------------------------------------- control panel + feed
  const hud = document.createElement('div');
  hud.className = 'ghud';
  hud.innerHTML = `<div class="grow"><button class="gbtn" id="gPause" aria-pressed="false" title="Pause">❚❚</button>${TYPES.map(t => `<button class="gchip on" data-t="${t.id}" style="--c:#${t.color.toString(16).padStart(6, '0')}"><i></i>${t.label}</button>`).join('')}</div>
    <div class="gfeed" aria-live="off"><div class="gfh"><span>LIVE TRAFFIC</span><em>simulated</em></div><ul id="gFeed"></ul></div>`;
  host.after(hud);
  hud.addEventListener('pointerdown', e => e.stopPropagation());
  let paused = reduce;
  const pauseB = hud.querySelector('#gPause');
  const syncPause = () => { pauseB.textContent = paused ? '▶' : '❚❚'; pauseB.setAttribute('aria-pressed', paused); pauseB.title = paused ? 'Play' : 'Pause'; };
  syncPause();
  pauseB.onclick = () => { paused = !paused; syncPause(); };
  hud.querySelectorAll('.gchip').forEach(ch => ch.onclick = () => {
    const id = ch.dataset.t;
    if (active.has(id) && active.size === 1) return; // keep at least one
    active.has(id) ? active.delete(id) : active.add(id);
    ch.classList.toggle('on', active.has(id));
    arcs.forEach((a, i) => { if (a && !active.has(a.type.id)) { killArc(a); arcs[i] = makeArc(); } });
  });
  const feedEl = hud.querySelector('#gFeed');
  function feed(from, to, type) {
    if (!feedEl) return;
    const li = document.createElement('li');
    li.innerHTML = `<i style="background:#${type.color.toString(16).padStart(6, '0')}"></i><b>${from}</b> → <b>${to}</b><span>${type.label}</span>`;
    feedEl.prepend(li);
    while (feedEl.children.length > 4) feedEl.lastChild.remove();
  }
  for (let i = 0; i < 9; i++) { const a = makeArc(); if (a) { a.t = Math.random(); arcs.push(a); } }

  // ---------------------------------------------------------------- input
  let tx = 0, ty = 0, dragging = false, lx = 0, velY = 0;
  addEventListener('pointermove', e => {
    tx = (e.clientX / innerWidth - 0.5) * 0.5; ty = (e.clientY / innerHeight - 0.5) * 0.3;
    if (dragging) { velY = (e.clientX - lx) * 0.005; world.rotation.y += velY; lx = e.clientX; targetY = null; }
  }, { passive: true });
  host.style.cursor = 'grab';
  host.addEventListener('pointerdown', e => { dragging = true; lx = e.clientX; host.style.cursor = 'grabbing'; });
  addEventListener('pointerup', () => { dragging = false; host.style.cursor = 'grab'; });

  function resize() {
    const w = host.clientWidth, h = host.clientHeight || w;
    renderer.setSize(w * SCALE, h * SCALE, false);
    camera.aspect = 1; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host); resize();
  let visible = true;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(host);

  // ---------------------------------------------------------------- frame
  const tmp = new THREE.Vector3(), nrm = new THREE.Vector3(), toCam = new THREE.Vector3();
  function placePins() {
    const w = host.clientWidth, h = host.clientHeight || w;
    NAV.forEach(n => {
      tmp.copy(n.top); world.localToWorld(tmp); scene.localToWorld(tmp);
      nrm.copy(n.v); world.localToWorld(nrm); scene.localToWorld(nrm); nrm.normalize();
      toCam.copy(camera.position).sub(tmp).normalize();
      const facing = nrm.dot(toCam);
      tmp.project(camera);
      const x = (tmp.x * 0.5 + 0.5) * w * SCALE - w * (SCALE - 1) / 2;
      const y = (-tmp.y * 0.5 + 0.5) * h * SCALE - h * (SCALE - 1) / 2;
      n.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
      const vis = facing > 0.12;
      n.el.classList.toggle('hidden', !vis);
      n.el.tabIndex = vis ? 0 : -1;
      n.ring.material.opacity = vis ? 0.95 : 0.25;
    });
  }
  function tick() {
    requestAnimationFrame(tick);
    if (!visible) return;
    if (targetY !== null) { world.rotation.y += (targetY - world.rotation.y) * 0.08; if (Math.abs(targetY - world.rotation.y) < 0.002) targetY = null; }
    else if (!dragging && !paused && !focused) { world.rotation.y += 0.0016 + velY; velY *= 0.94; }
    world.rotation.x += ((0.28 + ty) - world.rotation.x) * 0.04;
    scene.rotation.y += (tx * (focused ? 0.2 : 1) - scene.rotation.y) * 0.04;
    if (!paused) {
      arcs.forEach((a, i) => {
        if (!a) { arcs[i] = makeArc(); return; }
        if (a.t < 1) { a.t = Math.min(1, a.t + a.speed); a.line.geometry.setDrawRange(0, Math.floor(a.t * (SEG + 1))); a.head.position.copy(a.curve.getPoint(a.t)); }
        else {
          if (!a.landed) { a.landed = true; a.head.visible = false; landPulse(a.end, a.type.color); }
          a.tail = Math.min(1, a.tail + a.speed * 1.3);
          const s = Math.floor(a.tail * (SEG + 1)); a.line.geometry.setDrawRange(s, SEG + 1 - s);
          if (a.tail >= 1) { killArc(a); arcs[i] = makeArc(); }
        }
      });
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i]; p.s += 0.06; p.m.scale.setScalar(p.s); p.m.material.opacity = Math.max(0, 1 - (p.s - 1) / 3);
        if (p.s > 4) { world.remove(p.m); p.m.material.dispose(); pulses.splice(i, 1); }
      }
    }
    const pulse = 1 + Math.sin(performance.now() / 400) * 0.15;
    NAV.forEach(n => n.ring.scale.setScalar(n === focused ? 1.5 : pulse));
    renderer.render(scene, camera);
    placePins();
  }
  tick();
})();

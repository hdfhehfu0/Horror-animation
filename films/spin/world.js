/* =========================================================================
   STOPPED SPINNING — world.js
   The series' 3D street (three.js r170, vendored), camera tilted up so the
   sky fills most of the frame; the sky itself is drawn in 2D behind this
   transparent render (film.js). Here the sun moves: one directional light
   follows TL.sun(t) across the street, so the shadows sweep with every
   time-lapse day, lamps and windows come on at each dusk, and then the Sun
   stops at noon. The long day bleaches and browns everything; the long night
   rimes it with frost; and something walks down the road under the lamps.
   World.render(t) is a pure function of t, so parallel render workers agree.
   ========================================================================= */
(function (g) {
  'use strict';
  const { U, TL, THREE } = g;
  const W = TL.W, HT = TL.H;
  const rnd = U.mulberry32(20261121);
  const R = (a, b) => a + (b - a) * rnd();

  let renderer, scene, camera, key, hemi, skyMat, starMat, moon, moonHalo, cloudMats = [], fog;
  const lamps = [], windows = [], swayers = [], ends = [], houses = [], trees = [], lampGroups = [];
  let carGrp, dunes;
  let creature, canvas;

  /* ------------------------------ helpers ------------------------------ */
  const matCache = new Map();
  function lam(color) {
    if (!matCache.has(color)) { const m = new THREE.MeshLambertMaterial({ color, flatShading: true }); m.userData.c0 = m.color.clone(); matCache.set(color, m); }
    return matCache.get(color);
  }
  // move shared vertices of a non-indexed geometry together, so faces stay closed but irregular
  function jitter(geo, amt, seed) {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const h = (k) => U.hash(Math.round(x * 97) * 0.13 + Math.round(y * 89) * 0.71 + Math.round(z * 83) * 0.37 + seed * 3.1 + k) - 0.5;
      p.setXYZ(i, x + h(1) * amt, y + h(2) * amt, z + h(3) * amt);
    }
    geo.computeVertexNormals();
    return geo;
  }
  function mesh(geo, mat, x = 0, y = 0, z = 0, o = {}) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (o.ry) m.rotation.y = o.ry;
    if (o.rx) m.rotation.x = o.rx;
    if (o.rz) m.rotation.z = o.rz;
    m.castShadow = o.cast !== false; m.receiveShadow = o.recv !== false;
    return m;
  }
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

  /* ------------------------------ the street ------------------------------ */
  function ground() {
    const grp = new THREE.Group();
    // asphalt road, x -4..4, from the camera to the dead end
    grp.add(mesh(box(8, 0.1, 110), lam('#5d636c'), 0, -0.05, -40, { cast: false }));
    // worn lighter strips + patch repairs + cracks + a manhole + drains
    grp.add(mesh(box(1.4, 0.02, 110), lam('#666c75'), -1.9, 0.005, -40, { cast: false }));
    grp.add(mesh(box(1.4, 0.02, 110), lam('#666c75'), 1.9, 0.005, -40, { cast: false }));
    for (const [x, z, w, d] of [[-1.2, 3.5, 2.2, 1.2], [1.6, -9, 1.6, 2.4], [-2.2, -27, 2.4, 1.6], [0.8, -48, 3, 1.4]]) grp.add(mesh(box(w, 0.02, d), lam('#50555d'), x, 0.012, z, { cast: false }));
    for (let i = 0; i < 14; i++) {
      const x = R(-3.5, 3.5), z = R(-60, 8), len = R(0.8, 2.6);
      grp.add(mesh(box(0.05, 0.02, len), lam('#2c2f34'), x, 0.015, z, { ry: R(-1.2, 1.2), cast: false }));
    }
    grp.add(mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.03, 14), lam('#33363b'), 1.7, 0.02, 1.5, { cast: false }));
    for (const [x, z] of [[-3.85, -4], [3.85, -19], [-3.85, -40], [3.85, -58]]) grp.add(mesh(box(0.35, 0.03, 0.9), lam('#2a2c30'), x, 0.02, z, { cast: false }));
    // curbs, sidewalks, lawns, the dead-end turnaround
    for (const s of [-1, 1]) {
      grp.add(mesh(box(0.25, 0.18, 106), lam('#b9b6ad'), s * 4.1, 0.09, -38, { cast: false }));
      grp.add(mesh(box(1.8, 0.12, 106), lam('#c9c5bb'), s * 5.15, 0.06, -38, { cast: false }));
      grp.add(mesh(box(30, 0.1, 110), lam('#5f8f3c'), s * 21, 0.0, -40, { cast: false }));
      // a grass verge strip between curb and sidewalk is skipped: the trees stand on the lawn edge
    }
    grp.add(mesh(new THREE.CylinderGeometry(9, 9, 0.1, 18), lam('#5d636c'), 0, -0.04, -88, { cast: false }));
    // the land beyond: lawn, then the forest floor rising into hills
    grp.add(mesh(box(400, 0.1, 300), lam('#4f7a35'), 0, -0.08, -230, { cast: false }));
    for (let i = 0; i < 9; i++) {
      const hill = jitter(new THREE.IcosahedronGeometry(1, 1), 0.15, i);
      const m = mesh(hill, lam(i % 2 ? '#3f6a2c' : '#476f31'), R(-140, 140), -6, R(-230, -150), { cast: false });
      m.scale.set(R(45, 80), R(14, 30), R(30, 50)); grp.add(m);
    }
    scene.add(grp);
  }

  // a deciduous street tree: forked trunk + a cluster of faceted crowns
  function tree(x, z, s, seed) {
    const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.scale.setScalar(s);
    const bark = lam(['#4a3b30', '#3f342c', '#54443a'][seed % 3]);
    const trunk = mesh(new THREE.CylinderGeometry(0.13, 0.22, 3.4, 5), bark, 0, 1.7, 0);
    grp.add(trunk);
    for (const k of [-1, 1]) {
      const br = mesh(new THREE.CylinderGeometry(0.06, 0.11, 2.0, 4), bark, k * 0.45, 3.6, 0.1 * k, { rz: -k * 0.55 });
      grp.add(br);
    }
    const crown = new THREE.Group(); crown.position.y = 4.4; grp.add(crown);
    const greens = [['#3f8f2f', '#57a83a', '#2f7426'], ['#4a9434', '#3a8130', '#64ad40'], ['#357f2b', '#4f9a35', '#2a6a22']][seed % 3];
    const n = 3 + (seed % 3);
    for (let i = 0; i < n; i++) {
      const r = 1.1 + U.hash(seed * 7 + i) * 0.8;
      const geo = jitter(new THREE.IcosahedronGeometry(r, 0), r * 0.35, seed * 10 + i);
      const a = (i / n) * Math.PI * 2 + seed;
      const m = mesh(geo, lam(greens[i % 3]), Math.cos(a) * 0.9, 0.3 + U.hash(seed + i * 3) * 1.4, Math.sin(a) * 0.7);
      crown.add(m);
    }
    crown.add(mesh(jitter(new THREE.IcosahedronGeometry(1.4, 0), 0.5, seed * 13), lam(greens[1]), 0, 1.6, 0));
    swayers.push({ crown, seed, z });
    trees.push({ grp, crown, x, z, seed, s });
    scene.add(grp);
    return grp;
  }

  // forest of pines (instanced): behind the houses and beyond the dead end
  function forest() {
    const coneGeo = jitter(new THREE.ConeGeometry(1.3, 3.6, 6).toNonIndexed(), 0.2, 4), cone2 = jitter(new THREE.ConeGeometry(1.0, 2.8, 6).toNonIndexed(), 0.16, 5);
    const spots = [];
    for (let i = 0; i < 620; i++) {
      let x, z;
      const zone = rnd();
      if (zone < 0.45) { x = R(-60, 60); z = R(-150, -90); }            // beyond the dead end
      else if (zone < 0.72) { x = R(-70, -24); z = R(-95, 5); }          // behind the left houses
      else { x = R(24, 70); z = R(-95, 5); }                             // behind the right houses
      if (Math.abs(x) < 10 && z > -92) continue;
      spots.push([x, z, R(0.9, 1.7)]);
    }
    const n = spots.length;
    const cols = ['#24461f', '#2b5224', '#1f3d1b', '#30592a'].map((c) => new THREE.Color(c));
    const mk = (geo, yOff, sc) => {
      const im = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ flatShading: true }), n);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sv = new THREE.Vector3();
      spots.forEach(([x, z, s], i) => {
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), U.hash(i) * 6);
        m4.compose(v.set(x, yOff * s, z), q, sv.set(s * sc, s, s * sc));
        im.setMatrixAt(i, m4); im.setColorAt(i, cols[i % 4]);
      });
      im.castShadow = false; im.receiveShadow = false; scene.add(im);
    };
    mk(coneGeo, 2.6, 1); mk(cone2, 4.6, 1);
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.16, 1.4, 4), lam('#3a2e26'), n);
    const m4 = new THREE.Matrix4(); spots.forEach(([x, z, s], i) => { m4.makeTranslation(x, 0.7 * s, z); trunks.setMatrixAt(i, m4); });
    scene.add(trunks);
  }

  function prism(w, h, d) {   // gable roof
    const geo = new THREE.BufferGeometry();
    const hw = w / 2, hd = d / 2;
    const v = [
      -hw, 0, hd, hw, 0, hd, 0, h, hd,  -hw, 0, -hd, 0, h, -hd, hw, 0, -hd,
      -hw, 0, hd, 0, h, hd, 0, h, -hd,  -hw, 0, hd, 0, h, -hd, -hw, 0, -hd,
      hw, 0, hd, hw, 0, -hd, 0, h, -hd,  hw, 0, hd, 0, h, -hd, 0, h, hd,
    ];
    geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); geo.computeVertexNormals();
    return geo;
  }
  // a two-storey clapboard house; side = -1 (left of the road) or 1 (right). Faces the road.
  function house(x, z, side, o) {
    const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = side * -Math.PI / 2;
    const w = o.w || 9, d = o.d || 8, h = o.h || 5.6;
    grp.add(mesh(box(w, h, d), lam(o.col), 0, h / 2, 0));
    const roof = mesh(prism(w + 0.8, o.roofH || 2.6, d + 0.8), lam(o.roof), 0, h, 0); grp.add(roof);
    grp.add(mesh(box(0.7, 2, 0.7), lam('#7a4b3a'), w * 0.25, h + 1.6, -1));           // chimney
    // trim bands
    grp.add(mesh(box(w + 0.1, 0.25, d + 0.1), lam('#e9e6df'), 0, h - 0.1, 0, { cast: false }));
    // front face is +z in local space (towards the road after rotation)
    const fz = d / 2 + 0.03;
    grp.add(mesh(box(1.2, 2.2, 0.08), lam(o.door || '#6b2f2a'), -w * 0.18, 1.1, fz));
    grp.add(mesh(box(2.6, 0.3, 1.4), lam('#d8d3c8'), -w * 0.18, 0.15, fz + 0.6, { cast: false }));
    const wins = o.wins || [[w * 0.2, 1.7], [w * 0.36, 1.7], [-w * 0.32, 4.1], [-w * 0.05, 4.1], [w * 0.28, 4.1]];
    wins.forEach(([wx, wy], k) => {
      const frame = mesh(box(1.25, 1.55, 0.06), lam('#f1efe9'), wx, wy, fz, { cast: false }); grp.add(frame);
      const m = new THREE.MeshBasicMaterial({ color: '#9fb2c4' });
      const pane = mesh(box(1.0, 1.3, 0.08), m, wx, wy, fz + 0.01, { cast: false }); grp.add(pane);
      grp.add(mesh(box(1.0, 0.07, 0.1), lam('#f1efe9'), wx, wy, fz + 0.03, { cast: false }));
      windows.push({ m, i: windows.length, warm: new THREE.Color(k % 2 ? '#ffcf7a' : '#ffbf66') });
    });
    // a little fence along the front lawn
    for (let i = 0; i < 9; i++) grp.add(mesh(box(0.12, 0.9, 0.06), lam('#ece9e2'), -w / 2 + i * (w / 8), 0.45, d / 2 + 5.2, { cast: false }));
    grp.add(mesh(box(w, 0.08, 0.06), lam('#ece9e2'), 0, 0.75, d / 2 + 5.2, { cast: false }));
    houses.push({ grp, roof, side, seed: houses.length });
    scene.add(grp);
  }

  // streetlamp: pole + arm over the road + a head that glows; a spotlight pools light below it
  function lamp(x, z, side, idx) {
    const grp = new THREE.Group(); grp.position.set(x, 0, z);
    const metal = lam('#3d4148');
    grp.add(mesh(new THREE.CylinderGeometry(0.08, 0.12, 6.4, 6), metal, 0, 3.2, 0));
    const arm = mesh(box(1.9, 0.09, 0.09), metal, -side * 0.9, 6.3, 0); grp.add(arm);
    const headMat = new THREE.MeshBasicMaterial({ color: '#2a2a28' });
    const head = mesh(box(0.7, 0.18, 0.34), headMat, -side * 1.8, 6.18, 0, { cast: false }); grp.add(head);
    grp.add(mesh(box(0.8, 0.12, 0.42), metal, -side * 1.8, 6.32, 0));
    const spot = new THREE.SpotLight('#ffc983', 0, 22, 0.95, 0.65, 1.6);
    spot.position.set(x - side * 1.8, 6.1, z); spot.target.position.set(x - side * 1.8, 0, z);
    scene.add(spot, spot.target);
    lamps[idx] = { headMat, spot, pos: new THREE.Vector3(x - side * 1.8, 6.1, z) };
    lampGroups.push({ grp, side });
    scene.add(grp);
  }

  function car(x, z) {   // an old station wagon, parked
    const grp = new THREE.Group(); grp.position.set(x, 0, z);
    const paint = lam('#c9a13a'), dark = lam('#1d2026'), glass = lam('#3b4a5a');
    grp.add(mesh(box(1.9, 0.75, 4.6), paint, 0, 0.75, 0));
    grp.add(mesh(box(1.7, 0.7, 3.0), paint, 0, 1.45, 0.35));
    grp.add(mesh(box(1.72, 0.52, 2.9), glass, 0, 1.47, 0.35, { cast: false }));
    grp.add(mesh(box(1.94, 0.18, 4.7), lam('#9a7a2a'), 0, 0.45, 0, { cast: false }));
    for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.5], [0.95, -1.5]]) grp.add(mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.26, 10), dark, wx, 0.36, wz, { rz: Math.PI / 2 }));
    grp.add(mesh(box(0.3, 0.14, 0.05), lam('#c43a2a'), -0.65, 0.85, -2.33, { cast: false }));
    grp.add(mesh(box(0.3, 0.14, 0.05), lam('#c43a2a'), 0.65, 0.85, -2.33, { cast: false }));
    carGrp = grp;
    scene.add(grp);
  }

  function props() {
    // mailbox (right, near), hydrant, a kid's bike on the left lawn
    const mb = new THREE.Group(); mb.position.set(5.4, 0, 3.2);
    mb.add(mesh(box(0.1, 1.1, 0.1), lam('#4a3b30'), 0, 0.55, 0));
    mb.add(mesh(box(0.32, 0.3, 0.55), lam('#2b4f7a'), 0, 1.2, 0));
    mb.add(mesh(box(0.04, 0.22, 0.12), lam('#c43a2a'), 0.18, 1.32, 0.1));
    scene.add(mb);
    const hy = new THREE.Group(); hy.position.set(4.7, 0, -15);
    hy.add(mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.7, 8), lam('#c43a2a'), 0, 0.35, 0));
    hy.add(mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.18, 8), lam('#c43a2a'), 0, 0.78, 0));
    scene.add(hy);
    const bike = new THREE.Group(); bike.position.set(-7.2, 0.05, -2.5); bike.rotation.set(Math.PI / 2 - 0.05, 0, 0.7);
    for (const bx of [-0.55, 0.55]) bike.add(mesh(new THREE.TorusGeometry(0.33, 0.04, 5, 12), lam('#1d1d22'), bx, 0, 0, { cast: false }));
    bike.add(mesh(box(1.1, 0.06, 0.06), lam('#c43a2a'), 0, 0.12, 0)); bike.add(mesh(box(0.06, 0.06, 0.5), lam('#c43a2a'), 0.25, 0.3, 0));
    scene.add(bike);
    // the dead end: a striped barricade and a sign
    const bar = new THREE.Group(); bar.position.set(0, 0, -83);
    for (const bx of [-3.2, 3.2]) bar.add(mesh(box(0.15, 1.3, 0.15), lam('#e8e4da'), bx, 0.65, 0));
    for (let k = 0; k < 8; k++) {
      bar.add(mesh(box(0.85, 0.32, 0.08), lam(k % 2 ? '#e8e4da' : '#c4362a'), -3 + k * 0.86, 0.95, 0.05, { cast: false }));
      bar.add(mesh(box(0.85, 0.32, 0.08), lam(k % 2 ? '#c4362a' : '#e8e4da'), -3 + k * 0.86, 0.5, 0.05, { cast: false }));
    }
    scene.add(bar); ends.push(bar);
    const c2 = document.createElement('canvas'); c2.width = 256; c2.height = 256;
    const x2 = c2.getContext('2d');
    x2.fillStyle = '#e2b62e'; x2.translate(128, 128); x2.rotate(Math.PI / 4); x2.fillRect(-84, -84, 168, 168); x2.rotate(-Math.PI / 4);
    x2.fillStyle = '#151515'; x2.font = '800 44px Arial'; x2.textAlign = 'center'; x2.fillText('DEAD', 0, -6); x2.fillText('END', 0, 40);
    const tex = new THREE.CanvasTexture(c2); tex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Group(); sign.position.set(5.2, 0, -70);
    sign.add(mesh(box(0.08, 2.6, 0.08), lam('#8a8f96'), 0, 1.3, 0));
    sign.add(mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshLambertMaterial({ map: tex, transparent: true }), 0, 2.75, 0.05, { ry: -0.25, cast: false }));
    scene.add(sign);
  }

  // the thing between the trees: something long, low and four-legged that never catches the light
  function makeCreature() {
    const m = new THREE.MeshBasicMaterial({ color: '#030203', fog: false });
    const grp = new THREE.Group();
    grp.add(mesh(new THREE.CapsuleGeometry(0.36, 2.6, 3, 7), m, 0, 1.3, 0, { rz: Math.PI / 2 - 0.1, cast: false }));     // body, shoulders high
    grp.add(mesh(new THREE.SphereGeometry(0.5, 8, 6), m, 1.25, 1.42, 0, { cast: false }));                                  // shoulders
    grp.add(mesh(new THREE.CapsuleGeometry(0.17, 0.8, 3, 6), m, 1.8, 1.15, 0, { rz: 0.75, cast: false }));                // neck, hanging low
    const head = mesh(new THREE.SphereGeometry(0.3, 8, 6), m, 2.25, 0.85, 0, { cast: false }); head.scale.set(1.6, 0.75, 0.8); grp.add(head);
    for (const s of [-1, 1]) grp.add(mesh(new THREE.ConeGeometry(0.08, 0.36, 4), m, 2.05, 1.12, s * 0.14, { rz: 0.5, cast: false }));
    const legs = [];
    for (const [lx, lz, ph] of [[1.2, 0.2, 0], [1.2, -0.2, Math.PI], [-1.25, 0.2, Math.PI], [-1.25, -0.2, 0]]) {
      const hip = new THREE.Group(); hip.position.set(lx, 1.2, lz);
      hip.add(mesh(new THREE.CylinderGeometry(0.05, 0.09, 1.25, 5), m, 0, -0.6, 0, { cast: false }));
      grp.add(hip); legs.push([hip, ph]);
    }
    const tail = new THREE.Group(); tail.position.set(-1.55, 1.25, 0);
    tail.add(mesh(new THREE.ConeGeometry(0.09, 2.0, 5), m, -0.75, -0.45, 0, { rz: -2.1, cast: false }));
    grp.add(tail);
    // eyeshine: two small cold points that catch the starlight
    const eyeMat = new THREE.MeshBasicMaterial({ color: '#d8ecff', fog: false, transparent: true, opacity: 0 });
    const eyes = [-1, 1].map((s) => { const e = mesh(new THREE.SphereGeometry(0.05, 6, 4), eyeMat, 2.64, 0.93, s * 0.13, { cast: false }); grp.add(e); return e; });
    grp.userData = { legs, tail, eyes, eyeMat };
    grp.visible = false; scene.add(grp);
    return grp;
  }

  function sky() {
    skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color() }, low: { value: new THREE.Color() } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top;\nuniform vec3 low;\nvarying vec3 vP;\nvoid main(){\n float h = clamp(vP.y * 2.4, 0.0, 1.0);\n gl_FragColor = vec4(mix(low, top, pow(h, 0.6)), 1.0);\n #include <colorspace_fragment>\n}',
    });
    const s = new THREE.Mesh(new THREE.SphereGeometry(450, 24, 12), skyMat); s.renderOrder = -2; scene.add(s);
    // stars
    const pts = [];
    for (let i = 0; i < 900; i++) { const a = R(0, Math.PI * 2), e = R(0.06, 1.3); pts.push(Math.cos(a) * Math.cos(e) * 420, Math.sin(e) * 420, Math.sin(a) * Math.cos(e) * 420); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    starMat = new THREE.PointsMaterial({ color: '#ffffff', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
    scene.add(new THREE.Points(sg, starMat));
    // moon + clouds that later cover it
    moon = new THREE.Mesh(new THREE.CircleGeometry(9, 32), new THREE.MeshBasicMaterial({ color: '#f2f1e6', transparent: true, opacity: 0, fog: false }));
    moon.position.set(50, 60, -321); moon.lookAt(0, 1.6, 9); scene.add(moon);
    moonHalo = new THREE.Mesh(new THREE.CircleGeometry(26, 32), new THREE.MeshBasicMaterial({ color: '#9fb4d8', transparent: true, opacity: 0, fog: false, depthWrite: false }));
    moonHalo.position.copy(moon.position).add(new THREE.Vector3(0, 0, -1)); moonHalo.lookAt(0, 1.6, 9); scene.add(moonHalo);
    for (let i = 0; i < 7; i++) {
      const m = new THREE.MeshBasicMaterial({ color: '#06070c', transparent: true, opacity: 0, fog: false, depthWrite: false });
      const c = new THREE.Mesh(jitter(new THREE.IcosahedronGeometry(1, 1), 0.2, i * 5), m);
      c.userData = { x0: -200 + i * 30, y: 95 + (i % 3) * 22, w: R(40, 70) };
      c.scale.set(c.userData.w, R(10, 18), 10); c.position.set(c.userData.x0, c.userData.y, -300); scene.add(c);
      cloudMats.push(c);
    }
  }

  /* ------------------------------ build ------------------------------ */
  function init() {
    if (renderer) return;
    canvas = document.createElement('canvas'); canvas.width = W; canvas.height = HT;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(1); renderer.setSize(W, HT, false);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    scene = new THREE.Scene();
    fog = new THREE.Fog('#0b1024', 60, 260); scene.fog = fog;
    camera = new THREE.PerspectiveCamera(58, W / HT, 0.1, 900);
    camera.position.set(0, 1.62, 9); camera.rotation.set(0.07, 0, 0);

    hemi = new THREE.HemisphereLight('#cfe1f5', '#5b6b45', 1.0); scene.add(hemi);
    key = new THREE.DirectionalLight('#ffe2b8', 2.6);
    key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0006; key.shadow.normalBias = 0.02;
    Object.assign(key.shadow.camera, { left: -32, right: 32, top: 40, bottom: -60, near: 1, far: 220 });
    key.target.position.set(0, 0, -30); scene.add(key, key.target);

    ground(); forest(); makeDunes();
    // houses: left side (side -1) and right side (+1), facing the road
    const L = [['#7f9cb8', '#3f4650'], ['#e6dcc4', '#5a3d32'], ['#9aa98a', '#3c3a38'], ['#c9a46a', '#4a3a30'], ['#b7b2aa', '#2f3238']];
    const Rr = [['#a8493d', '#3a3534'], ['#e9e6df', '#44484f'], ['#c7b37f', '#3f3a36'], ['#6f8f9a', '#383a3f'], ['#d6cbb9', '#4b3f38']];
    [-2, -20, -38, -56, -73].forEach((z, i) => house(-14.5, z, -1, { col: L[i][0], roof: L[i][1], h: 5.4 + (i % 2) * 0.6 }));
    [-9, -27, -45, -62].forEach((z, i) => house(14.5, z, 1, { col: Rr[i][0], roof: Rr[i][1], h: 5.6 + (i % 2) * 0.4 }));
    // street trees on the lawn edges
    let sd = 1;
    for (let z = 4; z > -80; z -= 8.5) {
      tree(-7.2 + U.hash(z) * 0.8, z + U.hash(z + 1) * 2, 1.0 + U.hash(z * 3) * 0.25, sd++);
      tree(7.2 - U.hash(z + 5) * 0.8, z - 4 + U.hash(z + 7) * 2, 1.0 + U.hash(z * 5) * 0.25, sd++);
    }
    tree(-9.6, 6.5, 1.55, 99); tree(10.2, 5.2, 1.6, 98);   // big framing trees at the edges
    // 4 streetlamps: index 0 = nearest
    lamp(4.6, -4, 1, 0); lamp(-4.6, -22, -1, 1); lamp(4.6, -40, 1, 2); lamp(-4.6, -58, -1, 3);
    car(-3.0, -13); props();
    creature = makeCreature();
  }

  // snowdrifts that rise out of the ground and bury the street (the air, frozen)
  function makeDunes() {
    const geo = new THREE.PlaneGeometry(160, 240, 90, 120); geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const h = 0.55 + 0.45 * Math.sin(x * 0.21 + z * 0.07) * Math.cos(z * 0.13 - x * 0.05) + 0.25 * Math.sin(z * 0.41 + x * 0.3) + 0.12 * (U.hash(i * 0.37) - 0.5);
      p.setY(i, Math.max(0, h) * 1.6);
    }
    const nonIdx = geo.toNonIndexed(); nonIdx.computeVertexNormals();
    dunes = new THREE.Mesh(nonIdx, new THREE.MeshLambertMaterial({ color: '#e6edf5', flatShading: true }));
    dunes.position.set(0, -3, -60); dunes.receiveShadow = true; scene.add(dunes);
  }

  /* ------------------------------ per frame ------------------------------ */
  const ICE = new THREE.Color('#cfdbe6'), BAKE = new THREE.Color('#b99a62'), tmpC = new THREE.Color(), SUNC = new THREE.Color();
  // streetlamps: on whenever it's dark; in the long night two of them can't hold a steady light
  function lampLevel(i, t) {
    const S = TL.sun(t), dark = 1 - U.smooth(0.08, 0.3, S.day + 0.25 * (1 - S.tw) * (S.up ? 1 : 0));
    let v = S.up && S.day > 0.35 ? 0 : dark;
    if (t > TL.k.longNight && (i === 1 || i === 3)) v *= U.hash(Math.floor(t * 9) * 1.7 + i) > 0.18 ? 1 : 0.15;
    return v;
  }
  function update(t) {
    const K = TL.k, S = TL.sun(t), bake = K.bake(t), frost = K.frost(t);
    const day = S.day, warm = 1 - U.smooth(0.15, 0.6, Math.max(0, S.e));
    // the sun: a directional light that follows it across the sky, in front of the camera (backlit street)
    const az = U.lerp(-0.85, 0.85, U.clamp(S.s)), el = Math.max(0.03, 0.8 * Math.max(0, S.e));
    key.position.set(Math.sin(az) * Math.cos(el) * 160, Math.sin(el) * 160, -20 - Math.cos(az) * Math.cos(el) * 160);
    key.target.position.set(0, 0, -20);
    SUNC.set('#fff4e0').lerp(tmpC.set('#ff9a52'), warm).lerp(tmpC.set('#fffaf0'), bake);
    key.color.copy(SUNC); key.intensity = (2.4 + 1.0 * bake) * day;
    hemi.color.set('#0e1630').lerp(tmpC.set('#a9c8ea'), day).lerp(tmpC.set('#f0e6cc'), bake * day);
    hemi.groundColor.set('#1b1e26').lerp(tmpC.set('#6b6250'), day);
    hemi.intensity = 0.42 + 0.6 * day + 0.25 * S.tw * (S.up ? 1 : 0.4);
    fog.color.set('#0b1024').lerp(tmpC.set('#c9b08a'), 0.55 * S.tw * (1 - day)).lerp(tmpC.set('#b9d2ea'), day).lerp(tmpC.set('#e3d6b4'), bake * day);
    fog.near = 60 - 30 * bake; fog.far = 260 - 110 * bake;   // heat haze thickens the distance
    // six months of sun bleaches and browns everything; six months of night rimes it with frost
    matCache.forEach((m) => { m.color.copy(m.userData.c0).lerp(BAKE, 0.38 * bake).lerp(ICE, 0.32 * frost); });
    lamps.forEach((L, i) => { const v = lampLevel(i, t); L.spot.intensity = v * 110; L.headMat.color.set(v > 0.5 ? '#fff0c8' : '#2a2a28'); });
    // windows light up each evening of the time-lapse; once the long day starts nobody is home
    const evening = 1 - U.smooth(0.1, 0.35, day);
    windows.forEach((w) => {
      let on = U.hash(w.i * 5.1) > 0.35 && evening > U.hash(w.i * 2.7) * 0.8 + 0.1;
      if (t > TL.T_S + 6) on = false;
      if (on) w.m.color.copy(w.warm); else w.m.color.set(day > 0.4 ? '#7f93a6' : '#141821');
    });
    // trees: a light breeze in the afternoon; the crowns wilt in the long day
    trees.forEach((T) => { T.crown.rotation.z = Math.sin(t * 1.3 + T.seed) * 0.02 * (1 - bake); T.crown.scale.setScalar(1 - 0.22 * bake); });
    dunes.visible = false;
    camera.rotation.set(0.07, 0, 0); camera.position.set(0, 1.62, 9);
    // something walks down the middle of the road, under the lamps, and stops to look at us
    const C = TL.creature;
    if (t > C.t0 && t < C.t1) {
      creature.visible = true; creature.scale.setScalar(1.8);
      const walk = U.clamp((t - C.t0) / (C.stop + 0.4 - C.t0));
      creature.position.set(0.3, 0, U.lerp(-62, -30, U.easeOut(walk)));
      creature.rotation.y = Math.PI / 2 - 0.06;
      const moving = 1 - U.smooth(C.stop, C.stop + 0.7, t);
      creature.userData.legs.forEach(([hip, ph]) => { hip.rotation.z = Math.sin(t * 5.2 + ph) * 0.42 * moving; });
      creature.rotation.z = 0.16 * U.smooth(C.stop, C.stop + 1.0, t);
      creature.userData.tail.rotation.z = Math.sin(t * 1.3) * 0.08;
      creature.userData.eyeMat.opacity = eyeLevel(t);
    } else creature.visible = false;
  }

  const eyeLevel = (t) => U.smooth(TL.creature.stop + 0.1, TL.creature.stop + 0.6, t);
  // where the eyes are on screen, for the glow film.js draws over them
  function eyes(t) {
    if (!creature || !creature.visible || eyeLevel(t) <= 0) return [];
    return creature.userData.eyes.map((e) => { const p = e.getWorldPosition(new THREE.Vector3()); return { ...project(p.x, p.y, p.z), a: eyeLevel(t) }; });
  }
  function render(t) {
    init();
    update(t);
    renderer.render(scene, camera);
    return canvas;
  }
  const v3 = new THREE.Vector3();
  function project(x, y, z) {
    init();
    v3.set(x, y, z).project(camera);
    const dist = camera.position.distanceTo(new THREE.Vector3(x, y, z));
    return { x: (v3.x * 0.5 + 0.5) * W, y: (-v3.y * 0.5 + 0.5) * HT, d: dist, vis: v3.z < 1 };
  }
  g.World = { init, render, project, eyes, lamps: () => lamps.map((L) => L.pos), lampLevel };
})(window);

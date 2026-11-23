/* =========================================================================
   MOON (first person) — world.js
   A city avenue in three.js (r170, vendored), seen through your own eyes:
   stone and glass towers with procedural windows (lit at night), a subway
   entrance with lit stairs, green iron railings, trees in planters, lamps, a
   taxi. Your gloved hand is out in front; later both hands grip the railing
   on the curb, and when you're lifted your legs hang below you. Water runs
   the wrong way, the taxi and the litter float, the buildings tear off their
   foundations and rocks stream up past you. The sky (and the Moon) is drawn
   in 2D behind this transparent render (film.js). World.render(t) is a pure
   function of t.
   ========================================================================= */
(function (g) {
  'use strict';
  const { U, TL, THREE } = g;
  const W = TL.W, HT = TL.H;
  const rnd = U.mulberry32(20261123);
  const R = (a, b) => a + (b - a) * rnd();

  let renderer, scene, camera, canvas, key, hemi, fog;
  const spots = [], lampHeads = [], lifters = [], trees = [], litter = [], uniforms = [];
  let taxi, car2, railSeg, railPivot, bolts = [], handR, gripL, gripR, sleeves = [], legs, debris, debrisData = [];
  let gutterMat, puddleMat, stairWaterMat, landingWaterMat, stairLights = [];

  /* ------------------------------ helpers ------------------------------ */
  const matCache = new Map();
  function lam(color) { if (!matCache.has(color)) matCache.set(color, new THREE.MeshLambertMaterial({ color })); return matCache.get(color); }
  function mesh(geo, mat, x = 0, y = 0, z = 0, o = {}) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
    if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz;
    m.castShadow = o.cast !== false; m.receiveShadow = o.recv !== false; return m;
  }
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  // a box from (x0,y0,z0) to (x1,y1,z1)
  function slab(x0, y0, z0, x1, y1, z1, mat, o) { return mesh(box(x1 - x0, y1 - y0, z1 - z0), mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, o); }

  /* ------------------------------ building material: procedural windows, lit at night ------------------------------ */
  const WIN = `
    float side = step(abs(vON.y), 0.5);
    vec2 gp = vec2(abs(vON.x) > 0.5 ? vOP.z : vOP.x, vOP.y);
    #ifdef GLASS
      vec2 cs = vec2(2.3, 3.6); vec4 wr = vec4(0.05, 0.95, 0.10, 0.97);
    #else
      vec2 cs = vec2(3.3, 3.7); vec4 wr = vec4(0.24, 0.76, 0.26, 0.86);
    #endif
    vec2 wid = floor(gp / cs); vec2 fc = fract(gp / cs);
    float win = side * step(wr.x, fc.x) * step(fc.x, wr.y) * step(wr.z, fc.y) * step(fc.y, wr.w) * step(5.0, vOP.y);
    float sx = fract(gp.x / 5.2);
    float shop = side * step(0.6, vOP.y) * (1.0 - step(4.3, vOP.y)) * step(0.07, sx) * step(sx, 0.93);
    float hh = fract(sin(dot(wid + vec2(floor(vOP.x * 0.031) * 7.0, floor(vOP.z * 0.031) * 13.0), vec2(12.9898, 78.233))) * 43758.5453);
    vec3 glassC = mix(vec3(0.10, 0.12, 0.16), vec3(0.47, 0.58, 0.70), uDay * (0.45 + 0.55 * fc.y));
    diffuseColor.rgb = mix(diffuseColor.rgb, glassC, max(win, shop * 0.92));
    diffuseColor.rgb *= mix(1.0, 0.82, 1.0 - side);
    vec3 litC = vec3(0.95, 0.62, 0.30) * win * step(1.0 - uLit, hh) * uNight * (0.22 + 0.3 * fract(hh * 7.31))
              + vec3(0.95, 0.72, 0.45) * shop * uNight * 0.22 * step(0.45, hh);
  `;
  function cityMat(glass) {
    const m = new THREE.MeshLambertMaterial({ vertexColors: true });
    const u = { uDay: { value: 1 }, uNight: { value: 0 }, uLit: { value: 0.16 } };
    uniforms.push(u);
    if (glass) m.defines = { GLASS: '' };
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec3 aW;\nvarying vec3 vOP;\nvarying vec3 vON;')
        .replace('#include <fog_vertex>', '#include <fog_vertex>\nvOP = aW;\nvON = normal;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vOP;\nvarying vec3 vON;\nuniform float uDay;\nuniform float uNight;\nuniform float uLit;')
        .replace('#include <color_fragment>', '#include <color_fragment>\n' + WIN)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += litC;');
    };
    m.customProgramCacheKey = () => (glass ? 'moon-glass' : 'moon-stone');
    return m;
  }
  // geometry builder for boxes with per-vertex colour and the world position used by the window pattern
  function Builder() { this.p = []; this.n = []; this.c = []; this.w = []; }
  Builder.prototype.box = function (cx, y0, cz, w, h, d, color, origin) {
    const geo = new THREE.BoxGeometry(w, h, d).toNonIndexed(), P = geo.attributes.position, N = geo.attributes.normal, col = new THREE.Color(color);
    const ox = origin ? origin[0] : 0, oy = origin ? origin[1] : 0, oz = origin ? origin[2] : 0;
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i) + cx, y = P.getY(i) + y0 + h / 2, z = P.getZ(i) + cz;
      this.p.push(x - ox, y - oy, z - oz); this.n.push(N.getX(i), N.getY(i), N.getZ(i)); this.c.push(col.r, col.g, col.b); this.w.push(x, y, z);
    }
  };
  Builder.prototype.geo = function () {
    const g2 = new THREE.BufferGeometry();
    g2.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g2.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g2.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3)); g2.setAttribute('aW', new THREE.Float32BufferAttribute(this.w, 3));
    return g2;
  };

  // many small plain boxes merged into one mesh (lane markings, crosswalks)
  function merged(list, cast) {
    const b = new Builder();
    for (const [x0, y0, z0, x1, y1, z1, col] of list) b.box((x0 + x1) / 2, y0, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, col);
    const m = new THREE.Mesh(b.geo(), new THREE.MeshLambertMaterial({ vertexColors: true })); m.castShadow = !!cast; m.receiveShadow = true; return m;
  }
  // thin vertical bars as one instanced mesh, along local z from 0 to len
  function pickets(len, step, mat) {
    const n = Math.round(len / step) + 1, im = new THREE.InstancedMesh(box(0.025, 1.0, 0.025), mat, n), mm = new THREE.Matrix4();
    for (let k = 0; k < n; k++) { mm.makeTranslation(0, 0.55, k * len / (n - 1)); im.setMatrixAt(k, mm); }
    im.castShadow = true; im.receiveShadow = false; return im;
  }

  /* ------------------------------ the city ------------------------------ */
  const STONE = ['#cfc6b6', '#bdb3a2', '#a9a49c', '#d8d0c2', '#9a6d55', '#b98c6e', '#8f8b86', '#c4b8a4'];
  const GLASSC = ['#41566b', '#3a4a5c', '#506478', '#2f3d4d'];
  function city() {
    const stone = new Builder(), glass = new Builder(), stoneMat = cityMat(false), glassMat = cityMat(true);
    const crossZ = [250, 70, -110, -290, -470, -650];   // cross streets (centres)
    const bands = [[15, 70], [70, 122], [138, 190], [190, 245]];
    for (const s of [-1, 1]) for (const [b0, b1] of bands) for (let ci = 0; ci < crossZ.length - 1; ci++) {
      const zA = crossZ[ci] - 13, zB = crossZ[ci + 1] + 13;   // block from zA down to zB
      let z = zA;
      while (z > zB + 6) {
        const len = Math.min(z - zB, R(16, 34)), zc = z - len / 2;
        const front = b0 === 15, near = front && Math.abs(zc) < 140;
        const tower = rnd() < (front ? 0.18 : 0.3);
        let h = tower ? R(95, 175) : front ? R(26, near ? 70 : 85) : R(30, 130);
        const depth = (b1 - b0) - R(0, 6), cx = s * (b0 + depth / 2);
        const liftable = s === 1 && front && zc < 50 && zc > -260;
        if (liftable) {
          const bld = new Builder(), base = [cx, 0, zc];
          bld.box(cx, 0, zc, depth, h, len - 1.2, tower ? GLASSC[lifters.length % 4] : STONE[lifters.length % STONE.length], base);
          const m = new THREE.Mesh(bld.geo(), tower ? glassMat : stoneMat); m.position.set(...base); m.castShadow = m.receiveShadow = true;
          scene.add(m); lifters.push({ m, base, h, delay: R(0, 0.45), spin: [R(-1, 1), R(-1, 1), R(-1, 1)], z: zc });
        } else (tower ? glass : stone).box(cx, 0, zc, depth, h, len - 1.2, tower ? GLASSC[(rnd() * 4) | 0] : STONE[(rnd() * STONE.length) | 0]);
        // a setback or a rooftop box now and then
        if (!liftable && !tower && rnd() < 0.35) stone.box(cx + R(-4, 4), h, zc + R(-3, 3), depth * 0.45, R(3, 9), len * 0.4, '#8e8a84');
        z -= len;
      }
    }
    for (const [b, mat] of [[stone, stoneMat], [glass, glassMat]]) { const m = new THREE.Mesh(b.geo(), mat); m.castShadow = m.receiveShadow = true; scene.add(m); }
    // far horizon boxes so the view down the avenue ends in a skyline, not a void
    const far = new Builder();
    for (let i = 0; i < 90; i++) { const x = R(-700, 700), z = R(-1500, -700), h = R(40, 260); far.box(x, 0, z, R(30, 70), h, R(30, 70), STONE[i % STONE.length]); }
    const fm = new THREE.Mesh(far.geo(), stoneMat); scene.add(fm);
  }

  /* ------------------------------ the street ------------------------------ */
  function street() {
    const asphalt = lam('#3b3e44'), walk = lam('#a19e98'), curb = lam('#8d8a85'), line = lam('#d9d6cc');
    scene.add(slab(-8, -0.1, -1600, 8, 0, 400, asphalt, { cast: false }));
    // the left sidewalk has the subway opening in it (x -13.4..-11.0, z -11..-3)
    scene.add(slab(-15, 0, -1600, -13.4, 0.15, 400, walk, { cast: false }));
    scene.add(slab(-11.0, 0, -1600, -8.15, 0.15, 400, walk, { cast: false }));
    scene.add(slab(-13.4, 0, -3, -11.0, 0.15, 400, walk, { cast: false }));
    scene.add(slab(-13.4, 0, -1600, -11.0, 0.15, -11, walk, { cast: false }));
    scene.add(slab(8.15, 0, -1600, 15, 0.15, 400, walk, { cast: false }));
    for (const s of [-1, 1]) scene.add(slab(s > 0 ? 8.0 : -8.15, 0, -1600, s > 0 ? 8.15 : -8.0, 0.16, 400, curb, { cast: false }));
    // cross streets
    const marks = [];
    for (const z of [250, 70, -110, -290, -470]) { scene.add(slab(-260, -0.09, z - 7, 260, 0.005, z + 7, asphalt, { cast: false })); for (let k = 0; k < 9; k++) marks.push([-7 + k * 1.6, 0.006, z + 8, -6.2 + k * 1.6, 0.012, z + 11, '#d9d6cc']); }
    // ground beyond the avenues (between blocks), so the aerial view has no holes
    scene.add(slab(-900, -6.2, -1600, 900, -6.0, 500, lam('#4a4c50'), { cast: false }));
    // lane markings
    for (let z = 60; z > -900; z -= 9) { for (const x of [-2.7, 2.7]) marks.push([x - 0.07, 0.004, z - 3, x + 0.07, 0.01, z, '#d9d6cc']); marks.push([-0.08, 0.004, z - 9, 0.08, 0.01, z, '#c9a43a']); }
    scene.add(merged(marks, false));
  }

  // the subway stairs: 18 steps down to a lit landing and a dark tunnel
  function subway() {
    const conc = lam('#8f8a83'), wall = lam('#b9b2a6'), dark = lam('#18191c');
    for (let i = 0; i < 18; i++) { const top = 0.15 - 0.2 * (i + 1), z0 = -3 - 0.36 * i; scene.add(slab(-13.4, -3.8, z0 - 0.36, -11.0, top, z0, conc)); }
    scene.add(slab(-13.4, -3.9, -24, -11.0, -3.6, -9.48, conc));
    scene.add(slab(-13.4, -0.45, -24, -11.0, 0.0, -11, wall));                 // ceiling under the sidewalk
    for (const x of [-13.6, -10.8]) scene.add(slab(x - 0.2, -3.9, -24, x + 0.2, 0.16, -3, wall));
    scene.add(slab(-13.4, -3.9, -24.4, -11.0, 0.0, -24, dark));
    // wall lights: lit slots on both walls, and two warm lights
    const lit = new THREE.MeshBasicMaterial({ color: '#fff3dc' });
    for (const z of [-4.2, -6.0, -7.8, -9.6, -12.0, -15.0, -18.0]) {
      const yb = z > -9.5 ? 0.15 - 0.2 * Math.ceil((-3 - z) / 0.36) : -3.6;
      for (const x of [-13.38, -11.02]) { const m = mesh(box(0.04, 0.42, 0.09), lit, x, yb + 1.45, z, { cast: false, recv: false }); scene.add(m); }
    }
    for (const [y, z] of [[-1.0, -6.0], [-2.6, -12.5]]) { const p = new THREE.PointLight('#ffe2b8', 0, 11, 1.4); p.position.set(-12.2, y, z); scene.add(p); stairLights.push(p); }
    // handrails
    const rail = lam('#c9c3b6');
    for (const x of [-13.32, -11.08]) {
      const len = Math.hypot(6.5, 3.6), r = mesh(new THREE.CylinderGeometry(0.03, 0.03, len, 6), rail, x, 0.15 + 0.9 - 1.8, -3 - 3.25, { rx: Math.atan2(6.5, 3.6), cast: false });
      scene.add(r);
    }
    // the iron railings around the opening (the street end at z=-3 is open)
    const iron = lam('#1d3a2b');
    const fence = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(x1 - x0, z1 - z0);
      const grp = new THREE.Group(); grp.position.set(x0, 0.15, z0); grp.rotation.y = ang;
      grp.add(mesh(box(0.06, 0.06, len), iron, 0, 1.0, len / 2)); grp.add(mesh(box(0.05, 0.05, len), iron, 0, 0.12, len / 2));
      grp.add(pickets(len, 0.14, iron));
      for (let k = 0; k <= Math.floor(len / 1.4); k++) grp.add(mesh(box(0.07, 1.12, 0.07), iron, 0, 0.56, k * 1.4));
      scene.add(grp); return grp;
    };
    fence(-11.0, -11, -11.0, -3); fence(-13.4, -11, -13.4, -3); fence(-13.4, -11, -11.0, -11);
    // a green railing along the curb beside the entrance -- the one you'll hold
    fence(-8.42, -12.5, -8.42, -8.9); fence(-8.42, -4.0, -8.42, -2.0);
    railPivot = new THREE.Group(); railPivot.position.set(-8.42, 0.15, -8.6); scene.add(railPivot);
    railSeg = new THREE.Group(); railPivot.add(railSeg);
    const len = 4.3;
    railSeg.add(mesh(box(0.06, 0.06, len), iron, 0, 1.0 - 0.15 + 0.15, len / 2)); railSeg.add(mesh(box(0.05, 0.05, len), iron, 0, 0.12, len / 2));
    railSeg.add(pickets(len, 0.14, iron));
    for (const zz of [0.0, 1.45, 2.9, 4.3]) { railSeg.add(mesh(box(0.07, 1.12, 0.07), iron, 0, 0.56, zz)); const b = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 6), lam('#6b6e72'), 0, 0.02, zz, { cast: false }); railSeg.add(b); bolts.push(b); }
  }

  // a street tree in a square planter
  function tree(x, z, s) {
    const grp = new THREE.Group(); grp.position.set(x, 0.15, z);
    grp.add(mesh(box(1.5, 0.45, 1.5), lam('#8d8a85'), 0, 0.22, 0)); grp.add(mesh(box(1.3, 0.05, 1.3), lam('#3d3227'), 0, 0.46, 0, { cast: false }));
    const trunk = mesh(new THREE.CylinderGeometry(0.1, 0.15, 3.2, 6), lam('#4a3b2e'), 0, 2.0, 0); grp.add(trunk);
    const crown = new THREE.Group(); crown.position.y = 4.2; grp.add(crown);
    const greens = ['#4f7f3a', '#5e8e44', '#476f33'];
    for (let i = 0; i < 6; i++) { const r = 0.9 + rnd() * 0.6; const a = i * 1.05; crown.add(mesh(new THREE.IcosahedronGeometry(r, 0), lam(greens[i % 3]), Math.cos(a) * 0.8 * s, rnd() * 1.2, Math.sin(a) * 0.8 * s)); }
    crown.add(mesh(new THREE.IcosahedronGeometry(1.3, 0), lam(greens[1]), 0, 1.3, 0));
    scene.add(grp); trees.push({ grp, crown, x, z, delay: R(0, 0.5), spin: R(-1, 1) });
  }
  function lampPost(x, z, side, withLight) {
    const grp = new THREE.Group(); grp.position.set(x, 0.15, z);
    const metal = lam('#26282b');
    grp.add(mesh(new THREE.CylinderGeometry(0.09, 0.13, 7.2, 8), metal, 0, 3.6, 0));
    grp.add(mesh(box(1.6, 0.08, 0.08), metal, -side * 0.75, 7.15, 0));
    const head = mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: '#3a3a36' }), -side * 1.5, 6.95, 0, { cast: false });
    grp.add(head);
    scene.add(grp);
    const pos = new THREE.Vector3(x - side * 1.5, 7.1, z);
    lampHeads.push({ pos, head, grp });
    if (withLight) { const s = new THREE.SpotLight('#ffcf96', 0, 26, 1.0, 0.6, 1.5); s.position.copy(pos); s.target.position.set(pos.x, 0, pos.z); scene.add(s, s.target); spots.push(s); }
  }
  function carBody(color, roofSign) {
    const grp = new THREE.Group(), paint = lam(color), dark = lam('#16181b'), glass = lam('#2c3846');
    grp.add(mesh(box(1.9, 0.7, 4.7), paint, 0, 0.7, 0)); grp.add(mesh(box(1.75, 0.6, 2.6), paint, 0, 1.33, -0.1));
    grp.add(mesh(box(1.77, 0.46, 2.5), glass, 0, 1.36, -0.1, { cast: false }));
    for (const [wx, wz] of [[-0.95, 1.5], [0.95, 1.5], [-0.95, -1.5], [0.95, -1.5]]) grp.add(mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.26, 12), dark, wx, 0.36, wz, { rz: Math.PI / 2 }));
    grp.add(mesh(box(1.92, 0.12, 4.75), dark, 0, 0.42, 0, { cast: false }));
    if (roofSign) {
      const c2 = document.createElement('canvas'); c2.width = 256; c2.height = 64; const x2 = c2.getContext('2d');
      x2.fillStyle = '#f5f0dc'; x2.fillRect(0, 0, 256, 64); x2.fillStyle = '#1b1b1b'; x2.font = '800 44px Arial'; x2.textAlign = 'center'; x2.fillText('TAXI', 128, 48);
      const tex = new THREE.CanvasTexture(c2); tex.colorSpace = THREE.SRGBColorSpace;
      grp.add(mesh(box(0.9, 0.26, 0.24), new THREE.MeshLambertMaterial({ map: tex }), 0, 1.76, -0.2));
    }
    scene.add(grp); return grp;
  }
  function props() {
    // trees on the curbs (none where the railing is), lamps, a hydrant, a trash can, paper on the ground
    for (const z of [12, -18, -33, -48, -63, -78, -93, -128, -143]) tree(-9.4, z, 1);
    for (const z of [7, -8, -23, -38, -53, -68, -83, -98, -133, -148]) tree(9.4, z, 1);
    lampPost(-8.7, -15, -1, true); lampPost(8.7, 1, 1, true); lampPost(8.7, -29, 1, true); lampPost(-8.7, -45, -1, true);
    for (const z of [-75, -105, -135, -165, -195, -225]) { lampPost(-8.7, z, -1, false); lampPost(8.7, z + 15, 1, false); }
    const hy = new THREE.Group(); hy.position.set(-9.0, 0.15, 5.5); hy.add(mesh(new THREE.CylinderGeometry(0.15, 0.19, 0.7, 8), lam('#b23a2c'), 0, 0.35, 0)); scene.add(hy);
    const can = mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.95, 10), lam('#2f5a3f'), -14.4, 0.62, 3.5); scene.add(can);
    taxi = carBody('#e8b51f', true); taxi.position.set(4.0, 0, 3.5); taxi.rotation.y = 0.08;
    car2 = carBody('#5a6470', false); car2.position.set(6.2, 0, -24);
    const paper = [lam('#ecebe4'), lam('#d9d4c4'), lam('#c8c2ae')];
    for (let i = 0; i < 40; i++) {
      const m = mesh(new THREE.PlaneGeometry(R(0.18, 0.34), R(0.22, 0.4)), paper[i % 3], R(-12.8, 5), 0.17, R(-14, 10), { rx: -Math.PI / 2, cast: false });
      m.material.side = THREE.DoubleSide; if (m.position.x > -8.1) m.position.y = 0.012;
      scene.add(m); litter.push({ m, x0: m.position.x, y0: m.position.y, z0: m.position.z, delay: R(0, 0.75), s: R(0.6, 1.4) });
    }
  }

  /* ------------------------------ water that runs the wrong way ------------------------------ */
  function waterMat(extra) {
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      uniforms: { uT: { value: 0 }, uAmt: { value: 0 }, uFront: { value: 0 }, uSky: { value: new THREE.Color('#9fb6cc') } },
      vertexShader: 'varying vec2 vUv;\nvoid main(){\n vUv = uv;\n gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n}',
      fragmentShader: `uniform float uT;\nuniform float uAmt;\nuniform float uFront;\nuniform vec3 uSky;\nvarying vec2 vUv;\n
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
        void main(){
          ${extra}
          float broad = n(vec2(vUv.x * 3.0, vUv.y * 8.0 + uT * 1.5));
          float rip = sin(vUv.y * 140.0 + uT * 9.0 + n(vec2(vUv.x * 9.0, vUv.y * 30.0)) * 6.0);
          float hi = smoothstep(0.86, 0.99, rip) * (0.5 + 0.5 * n(vec2(vUv.x * 20.0, vUv.y * 60.0 + uT * 4.0)));
          vec3 col = mix(uSky * 0.42, uSky * 0.95, 0.2 + 0.5 * broad) + vec3(0.55, 0.6, 0.65) * hi * 0.55;
          gl_FragColor = vec4(col, a * (0.62 + 0.25 * hi));
          #include <colorspace_fragment>
        }`,
    });
    return m;
  }
  function water() {
    // the gutter: a strip along the left curb, flowing toward the Moon (-z)
    gutterMat = waterMat('float a = uAmt * smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.6, vUv.x);');
    const gm = mesh(new THREE.PlaneGeometry(0.55, 70), gutterMat, -7.72, 0.014, -18, { rx: -Math.PI / 2, cast: false, recv: false }); gm.renderOrder = 2; scene.add(gm);
    // a puddle that stretches and slides toward it
    puddleMat = waterMat('vec2 q = (vUv - vec2(0.5, 0.25 + 0.5 * uFront)) * vec2(2.0, 2.0 / (0.35 + 0.65 * uFront)); float a = uAmt * smoothstep(1.0, 0.75, length(q));');
    const pm = mesh(new THREE.PlaneGeometry(1.6, 4.2), puddleMat, -6.9, 0.016, -2.6, { rx: -Math.PI / 2, cast: false, recv: false }); pm.renderOrder = 2; scene.add(pm);
    // the stairs: a sheet of water climbing from the landing toward you (uFront = how far up it has reached)
    stairWaterMat = waterMat('float a = uAmt * step(1.0 - uFront, vUv.y) * (0.75 + 0.25 * smoothstep(1.0 - uFront, 1.0 - uFront + 0.04, vUv.y));');
    const slope = Math.hypot(6.48, 3.6), sm = mesh(new THREE.PlaneGeometry(2.3, slope), stairWaterMat, -12.2, 0.15 - 1.8 + 0.06, -3 - 3.24, { rx: -Math.PI / 2 + Math.atan2(3.6, 6.48), cast: false, recv: false });
    sm.rotation.order = 'YXZ'; sm.rotation.x = -Math.PI / 2 - Math.atan2(3.6, 6.48); sm.renderOrder = 2; scene.add(sm);
    landingWaterMat = waterMat('float a = uAmt;');
    const lm = mesh(new THREE.PlaneGeometry(2.3, 14), landingWaterMat, -12.2, -3.55, -16.5, { rx: -Math.PI / 2, cast: false, recv: false }); lm.renderOrder = 2; scene.add(lm);
  }

  /* ------------------------------ you: gloved hands, sleeves, legs ------------------------------ */
  const GLOVE = '#3a3d43', SLEEVE = '#5d636c';
  function hand(curl) {
    const grp = new THREE.Group(), glove = lam(GLOVE);
    grp.add(mesh(box(0.09, 0.03, 0.1), glove, 0, 0, 0, { cast: false }));
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Group(); f.position.set(-0.033 + i * 0.022, 0, -0.05); f.rotation.x = -curl * (0.9 + 0.1 * i); grp.add(f);
      f.add(mesh(new THREE.CapsuleGeometry(0.0095, 0.05 - Math.abs(i - 1.5) * 0.006, 3, 6), glove, 0, 0, -0.03, { rx: Math.PI / 2, cast: false }));
      const tip = new THREE.Group(); tip.position.z = -0.055; tip.rotation.x = -curl * 1.1; f.add(tip);
      tip.add(mesh(new THREE.CapsuleGeometry(0.009, 0.03, 3, 6), glove, 0, 0, -0.02, { rx: Math.PI / 2, cast: false }));
    }
    const th = mesh(new THREE.CapsuleGeometry(0.011, 0.045, 3, 6), glove, 0.055, -0.005, -0.015, { rx: Math.PI / 2, ry: -0.7, cast: false }); grp.add(th);
    grp.add(mesh(new THREE.CylinderGeometry(0.042, 0.046, 0.08, 8), glove, 0, 0, 0.07, { rx: Math.PI / 2, cast: false }));   // cuff
    return grp;
  }
  function you() {
    // right hand reaching forward (attached to the camera, like the reference)
    handR = new THREE.Group();
    const h = hand(0.25); h.rotation.set(-0.35, 0.3, -0.25); handR.add(h);
    const sl = mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.6, 10), lam(SLEEVE), 0.1, -0.13, 0.3, { rx: Math.PI / 2 - 0.45, rz: -0.32, cast: false }); handR.add(sl);
    handR.position.set(0.07, -0.215, -0.45); camera.add(handR);
    // both hands for gripping (in the world, on the rail), with sleeves to the shoulders
    gripR = hand(1.0); gripL = hand(1.0); scene.add(gripR, gripL);
    for (let i = 0; i < 2; i++) { const s = mesh(new THREE.CylinderGeometry(0.036, 0.05, 1, 10), lam('#2e3239'), 0, 0, 0, { cast: false }); scene.add(s); sleeves.push(s); }
    // legs, seen when you look down while you're lifted
    legs = new THREE.Group(); const trous = lam('#2b2f36'), shoe = lam('#141516');
    for (const s of [-1, 1]) {
      const leg = new THREE.Group(); leg.position.set(s * 0.12, -0.8, 0.05); leg.userData.s = s;
      leg.add(mesh(new THREE.CapsuleGeometry(0.075, 0.75, 4, 8), trous, 0, -0.45, 0, { cast: false }));
      leg.add(mesh(box(0.11, 0.09, 0.28), shoe, 0, -0.92, -0.06, { cast: false }));
      legs.add(leg);
    }
    legs.visible = false; scene.add(legs);
  }

  /* ------------------------------ debris pulled into the sky ------------------------------ */
  function makeDebris() {
    const N = 320, geo = new THREE.IcosahedronGeometry(1, 0), mat = new THREE.MeshLambertMaterial({ color: '#77716a' });
    debris = new THREE.InstancedMesh(geo, mat, N); debris.castShadow = false; debris.frustumCulled = false;
    const cols = ['#77716a', '#5b5853', '#8e8a83', '#3d3b38', '#9a8f7c'].map((c) => new THREE.Color(c));
    for (let i = 0; i < N; i++) {
      const near = i < 90, r = near ? R(1.5, 16) : R(10, 160), a = R(0, Math.PI * 2);
      debrisData.push({ x: -9 + Math.cos(a) * r, z: -6 + Math.sin(a) * r * 1.4, t0: near ? R(56, 80) : R(48, 78), s: near ? R(0.05, 0.25) : R(0.2, 1.6), acc: R(2.5, 6), drift: R(-1, 1), spin: R(0.5, 3) });
      debris.setColorAt(i, cols[i % 5]);
    }
    scene.add(debris);
  }

  /* ------------------------------ build ------------------------------ */
  function init() {
    if (renderer) return;
    canvas = document.createElement('canvas'); canvas.width = W; canvas.height = HT;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: true });
    renderer.setClearColor(0x000000, 0); renderer.setPixelRatio(1); renderer.setSize(W, HT, false);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0; renderer.outputColorSpace = THREE.SRGBColorSpace;
    scene = new THREE.Scene(); fog = new THREE.Fog('#c9d9ea', 140, 1100); scene.fog = fog;
    camera = new THREE.PerspectiveCamera(TL.FOV, W / HT, 0.04, 3000); camera.rotation.order = 'YXZ'; scene.add(camera);
    hemi = new THREE.HemisphereLight('#b9d4f0', '#6b6558', 1.0); scene.add(hemi);
    key = new THREE.DirectionalLight('#fff1d8', 2.6); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0005; key.shadow.normalBias = 0.03;
    Object.assign(key.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 400 });
    scene.add(key, key.target);
    city(); street(); subway(); props(); water(); you(); makeDebris();
  }

  /* ------------------------------ per frame ------------------------------ */
  const tmpC = new THREE.Color(), v = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Euler(), m4 = new THREE.Matrix4();
  let flashLevel = 0;
  function flash(t) {   // how much light the impacts throw on the scene right now
    let f = 0; for (const m of TL.meteors) if (t > m.t1) f += m.s * Math.exp(-(t - m.t1) * 2.4) * (m.z > -300 ? 1 : 0.5);
    return Math.min(1.6, f);
  }
  function update(t) {
    const C = TL.cam(t), day = TL.day(t), dusk = TL.dusk(t), night = TL.night(t), lampsOn = TL.lamps(t), split = TL.split(t), crack = TL.crack(t);
    camera.position.set(C.x, C.y, C.z); camera.rotation.set(C.pitch, C.yaw, C.roll);
    camera.updateMatrixWorld();
    flashLevel = flash(t);
    // light: the sun behind you in the afternoon, the Moon in front at night
    const md = TL.moonDir(t), sunDir = v.set(0.45, Math.max(0.05, 0.62 * (1 - U.smooth(10, 27, t))), 0.65).normalize().clone();
    const toMoon = U.smooth(18, 30, t), dir = sunDir.lerp(v.set(md[0], md[1], md[2]), toMoon).normalize();
    key.target.position.set(C.x, 0, C.z - 8); key.position.copy(key.target.position).addScaledVector(dir, 180);
    key.color.set('#fff1d8').lerp(tmpC.set('#ffad6a'), dusk * (1 - toMoon)).lerp(tmpC.set('#c8d4ff'), toMoon).lerp(tmpC.set('#ff8a4a'), 0.45 * split);
    key.intensity = 2.7 * day + 1.2 * dusk * (1 - toMoon) + toMoon * (0.35 + 1.6 * U.clamp(TL.moonR(t) / 30)) * (1 - 0.3 * split) + 0.6 * crack;
    hemi.color.set('#b9d4f0').lerp(tmpC.set('#e3a98a'), dusk * 0.6).lerp(tmpC.set('#6676a6'), night).lerp(tmpC.set('#ff9a5a'), Math.min(1, flashLevel * 0.6));
    hemi.groundColor.set('#6b6558').lerp(tmpC.set('#2a2c34'), night);
    hemi.intensity = 1.0 * day + 0.6 * dusk + 0.85 * night + 1.1 * flashLevel;
    fog.color.set('#c9d9ea').lerp(tmpC.set('#c49482'), dusk * 0.7).lerp(tmpC.set('#0d1222'), night).lerp(tmpC.set('#3a2a26'), 0.4 * split);
    fog.near = U.lerp(140, 60, night); fog.far = U.lerp(1100, 700, night);
    for (const u of uniforms) { u.uDay.value = day; u.uNight.value = Math.max(night, dusk * 0.4) * (1 - 0.5 * TL.buildings(t)); }
    for (const s of spots) s.intensity = 140 * lampsOn;
    for (const L of lampHeads) L.head.material.color.set(lampsOn > 0.5 ? '#fff0cc' : '#3a3a36');
    for (const p of stairLights) p.intensity = 18;
    // water
    const wt = t, ws = TL.water(t), sw = TL.stairWater(t);
    gutterMat.uniforms.uT.value = -wt; gutterMat.uniforms.uAmt.value = ws;
    puddleMat.uniforms.uT.value = wt * 0.5; puddleMat.uniforms.uAmt.value = 0.9 * (1 - U.smooth(18, 20, t)); puddleMat.uniforms.uFront.value = U.smooth(10.8, 16, t);
    stairWaterMat.uniforms.uT.value = wt; stairWaterMat.uniforms.uAmt.value = U.smooth(25.2, 26.2, t) * (1 - U.smooth(33, 34, t)); stairWaterMat.uniforms.uFront.value = 0.08 + 0.55 * sw;
    landingWaterMat.uniforms.uT.value = wt; landingWaterMat.uniforms.uAmt.value = U.smooth(24.8, 25.8, t) * (1 - U.smooth(33, 34, t));
    const skyC = tmpC.set('#9fb6cc').lerp(new THREE.Color('#d9a08a'), dusk * 0.6).lerp(new THREE.Color('#3b4a6e'), night);
    for (const m of [gutterMat, puddleMat, stairWaterMat, landingWaterMat]) m.uniforms.uSky.value.copy(skyC);
    // litter lifts off and drifts toward the Moon, fluttering
    const lk = TL.litter(t);
    for (const L of litter) {
      const k = U.clamp((lk - L.delay * 0.5) / 0.6) ** 1.6;
      L.m.position.set(L.x0 + Math.sin(t * 1.3 * L.s + L.delay * 9) * 0.5 * k, L.y0 + k * (2 + 30 * k) * L.s, L.z0 - k * 8 * L.s);
      L.m.rotation.set(-Math.PI / 2 + k * Math.sin(t * 3 * L.s) * 1.4, k * t * L.s, k * Math.cos(t * 2.4 * L.s));
    }
    // the taxi leaves the road; later the parked car follows
    const tk = TL.taxi(t);
    taxi.position.set(4.0 + tk * 1.5, 14 * tk ** 1.7, 3.5 - tk * 6); taxi.rotation.set(0.5 * tk, 0.08 + 0.4 * tk, 0.7 * tk ** 1.3);
    const ck = U.clamp((t - 52) / 14);
    car2.position.set(6.2, 30 * ck ** 2, -24 - ck * 10); car2.rotation.set(0.6 * ck, 0, -0.9 * ck);
    // trees uproot and streams of rocks rise
    const pull = TL.pull(t);
    for (const T of trees) {
      const k = U.clamp((pull - T.delay) / 0.5) ** 2;
      T.grp.position.y = 0.15 + 45 * k; T.grp.rotation.set(0.8 * k * T.spin, 0, 1.1 * k); T.crown.rotation.z = Math.sin(t * 2 + T.x) * 0.06 * (pull > 0 ? 1 : 0.2);
    }
    for (let i = 0; i < lampHeads.length; i++) { const L = lampHeads[i], k = U.clamp((pull - 0.35 - (i % 5) * 0.08) / 0.5); L.grp.rotation.z = (L.pos.x < 0 ? -1 : 1) * 0.5 * k * k; }
    debrisData.forEach((d, i) => {
      const dt = Math.max(0, t - d.t0), y = 0.15 + 0.5 * d.acc * dt * dt;
      e.set(d.spin * dt, d.spin * dt * 0.7, 0); q.setFromEuler(e);
      v.set(d.x + d.drift * dt * 1.5, dt > 0 ? y : -50, d.z - dt * dt * 0.8);
      m4.compose(v, q, new THREE.Vector3(d.s, d.s * 0.7, d.s * 0.9)); debris.setMatrixAt(i, m4);
    });
    debris.instanceMatrix.needsUpdate = true;
    // the buildings across the street tear off their foundations
    const bk = TL.buildings(t);
    for (const B of lifters) {
      const k = U.clamp((bk - B.delay) / (1 - B.delay));
      B.m.position.set(B.base[0] + B.spin[0] * 10 * k, B.base[1] + 240 * k ** 1.5, B.base[2] - 50 * k * k);
      B.m.rotation.set(0.35 * B.spin[0] * k, 0.25 * B.spin[1] * k, 0.45 * B.spin[2] * k);
    }
    // the railing: bends up, its bolts pull out; then it comes away with you
    const rb = TL.railBend(t), lift = TL.lift(t);
    if (lift <= 0) {
      railPivot.position.set(-8.42, 0.15 + 0.5 * rb * rb, -8.6); railPivot.rotation.set(0, 0, -0.32 * rb);
    } else {
      // keep the rail (and your grip on it) where it was relative to you
      const c0 = TL.cam(TL.railBend.end || 71.8);
      railPivot.position.set(C.x + (-8.42 - c0.x), C.y + (0.15 + 0.5 - c0.y), C.z + (-8.6 - c0.z)); railPivot.rotation.set(0.15 * lift, 0, -0.32 - 0.25 * lift);
    }
    bolts.forEach((b, i) => { const k = U.clamp((rb - 0.35 - i * 0.12) / 0.3); b.position.set(0, 0.02 + k * 0.6, b.position.z); b.rotation.x = k * 3 * (i % 2 ? 1 : -1); b.visible = lift < 0.05; });
    railPivot.updateMatrixWorld(true);
    // hands
    const reach = TL.reach(t), grip = TL.grip(t);
    handR.visible = reach > 0.02 && grip < 0.5; handR.position.set(0.07 + 0.12 * (1 - reach), -0.215 - 0.25 * (1 - reach), -0.45);
    gripR.visible = gripL.visible = sleeves[0].visible = sleeves[1].visible = grip > 0.02;
    if (grip > 0.02) {
      const fwd = v.set(-Math.sin(C.yaw), 0, -Math.cos(C.yaw)).clone(), right = new THREE.Vector3(Math.cos(C.yaw), 0, -Math.sin(C.yaw));
      [[gripR, 2.15, 1], [gripL, 1.75, -1]].forEach(([H, zz, s], i) => {
        const onRail = railSeg.localToWorld(new THREE.Vector3(0, 1.05, zz));
        const free = camera.localToWorld(new THREE.Vector3(s * 0.2, -0.38, -0.5));
        const p = free.lerp(onRail, grip);
        H.position.copy(p); H.rotation.set(0, Math.atan2(right.x, right.z) + Math.PI / 2 * 0, 0); H.rotation.y = C.yaw + (s > 0 ? -0.25 : 0.25); H.rotation.x = 0.15;
        const sh = new THREE.Vector3(C.x, C.y, C.z).addScaledVector(right, s * 0.2).add(new THREE.Vector3(0, -0.5, 0)).addScaledVector(fwd, -0.18);
        const wrist = p.clone().addScaledVector(fwd, 0.06).add(new THREE.Vector3(0, -0.01, 0));
        const S = sleeves[i], mid = sh.clone().add(wrist).multiplyScalar(0.5), len = sh.distanceTo(wrist);
        S.position.copy(mid); S.scale.set(1, len, 1); S.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), wrist.clone().sub(sh).normalize());
      });
    }
    // legs, when you're off the ground
    legs.visible = lift > 0 || rb > 0.6;
    if (legs.visible) { legs.position.set(C.x, C.y, C.z); legs.rotation.set(0, C.yaw, 0); legs.children.forEach((L, i) => { L.rotation.x = Math.sin(t * 2.2 + i * 1.7) * 0.35 * (0.3 + lift); L.rotation.z = (i ? 1 : -1) * 0.08; }); }
  }

  function prepare(t) { init(); update(t); }
  function draw() { renderer.render(scene, camera); return canvas; }
  function render(t) { prepare(t); return draw(); }
  const v3 = new THREE.Vector3();
  function project(x, y, z) {
    init();
    v3.set(x, y, z).project(camera);
    return { x: (v3.x * 0.5 + 0.5) * W, y: (-v3.y * 0.5 + 0.5) * HT, d: camera.position.distanceTo(new THREE.Vector3(x, y, z)), vis: v3.z < 1 && v3.z > -1 };
  }
  // a direction (unit vector) -> screen point, or null if it's behind you
  function projectDir(dx, dy, dz) {
    init();
    const p = new THREE.Vector3(dx, dy, dz).applyQuaternion(camera.quaternion.clone().invert());
    if (p.z >= -1e-3) return null;
    const f = 1 / Math.tan(TL.FOV * Math.PI / 360);
    return { x: W / 2 + (p.x / -p.z) * f * HT / 2, y: HT / 2 - (p.y / -p.z) * f * HT / 2 };
  }
  g.World = { init, prepare, draw, render, project, projectDir, lamps: () => lampHeads.map((L) => L.head.getWorldPosition(new THREE.Vector3())), camera: () => camera,
    bases: () => lifters.map((B) => ({ x: B.base[0], z: B.base[2], delay: B.delay })) };
})(window);

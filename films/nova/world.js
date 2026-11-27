/* =========================================================================
   BETELGEUSE (first person) — world.js
   three.js (r170, vendored). A log cabin on a snowy hillside at 60 deg N on a
   winter night: a stone fireplace with a real-looking fire, tea, your friend
   by the mantel. Outside, the valley to the south-west and over it Orion,
   setting -- placed from the stars' real coordinates. When the countdown
   lands, Betelgeuse's light arrives: a blue-white point brighter than every
   star and planet, light pouring through the window across the floor, the
   lone pines throwing long shadows over the snow. The sky follows the owner's
   approved recipe (.claude/skills/mad-space/references/space_look_spec.md).
   World.render(t) is a pure function of t.
   ========================================================================= */
(function (g) {
  'use strict';
  const { U, TL, THREE } = g;
  const W = TL.W, HT = TL.H, D2R = Math.PI / 180;
  const rnd = U.mulberry32(20261127);
  const R = (a, b) => a + (b - a) * rnd();
  const dirAzEl = (az, el) => new THREE.Vector3(Math.sin(az * D2R) * Math.cos(el * D2R), Math.sin(el * D2R), -Math.cos(az * D2R) * Math.cos(el * D2R));
  const radec = (ra, dec) => { const p = TL.altaz(ra, dec); return dirAzEl(p.az, p.el); };
  const SDIR = dirAzEl(TL.BETEL.az, TL.BETEL.el);         // toward Betelgeuse
  const GROUND = -0.45;

  let renderer, scene, camera, canvas, fog;
  let hemi, starLight, fireKey, fireFill, fireLow, lampLight, outWarm, northWarm, doorLamp, doorLight;
  let skyMat, cubes = {}, MW;
  const fireMats = [], fireCards = [], glowMats = [], snowU = { uNova: { value: 0 }, uCamQ: { value: new THREE.Vector3() } };
  let emberMat, logMat, coalMat, shaftMat, steamMat, smokeMat, steam, smoke, lampFlame;
  let door, heroMug, friendMug, friend, heroFig, friendHands = [], heroHands = [], povArms = [], povLegs;

  /* ------------------------------ helpers ------------------------------ */
  function mesh(geo, mat, x = 0, y = 0, z = 0, o = {}) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
    if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz;
    m.castShadow = o.cast !== false; m.receiveShadow = o.recv !== false; return m;
  }
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  function slab(x0, y0, z0, x1, y1, z1, mat, o) { return mesh(box(x1 - x0, y1 - y0, z1 - z0), mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, o); }
  const matStd = new Map();
  function std(color, rough = 0.85, map = null, extra = {}) {
    const k = color + rough + (map ? map.uuid : '') + JSON.stringify(extra);
    if (!matStd.has(k)) matStd.set(k, new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough, map }, extra)));
    return matStd.get(k);
  }
  function canvasTex(n, paint, rep = [1, 1], srgb = true) {
    const c = document.createElement('canvas'); c.width = c.height = n; paint(c.getContext('2d'), n);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  }
  const UPY = new THREE.Vector3(0, 1, 0);

  /* ------------------------------ shared GLSL: hashes and noise ------------------------------ */
  const NOISE = `
    float h1(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    vec3 h3(vec3 p){ return vec3(h1(p), h1(p + 17.31), h1(p + 41.77)); }
    float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(h1(i), h1(i + vec3(1,0,0)), f.x), mix(h1(i + vec3(0,1,0)), h1(i + vec3(1,1,0)), f.x), f.y),
                 mix(mix(h1(i + vec3(0,0,1)), h1(i + vec3(1,0,1)), f.x), mix(h1(i + vec3(0,1,1)), h1(i + vec3(1,1,1)), f.x), f.y), f.z); }
    float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * n3(p); p = p * 2.03 + 1.7; a *= 0.5; } return s; }
  `;

  /* ------------------------------ the sky (spec §3, §4) ------------------------------ */
  const SKYLIB = `
    uniform vec3 uMWa; uniform vec3 uMWb; uniform vec3 uMWc;
    vec3 tempCol(float k){
      vec3 c[7]; c[0]=vec3(1.0,0.45,0.25); c[1]=vec3(1.0,0.62,0.32); c[2]=vec3(1.0,0.82,0.55); c[3]=vec3(1.0,0.92,0.80);
      c[4]=vec3(0.70,0.82,1.0); c[5]=vec3(0.55,0.68,1.0); c[6]=vec3(0.45,0.58,1.0);
      float x = clamp(k, 0.0, 0.9999) * 6.0; int i = int(floor(x)); return mix(c[i], c[min(i + 1, 6)], fract(x));
    }
    void band(vec3 d, out float ll, out float bb){
      vec3 n = normalize(cross(uMWa, uMWb)), u1 = normalize(uMWc - n * dot(uMWc, n)), u2 = cross(n, u1);
      bb = asin(clamp(dot(d, n), -1.0, 1.0)); ll = atan(dot(d, u2), dot(d, u1));
    }
    float gauss(float x, float s){ return exp(-x * x / (2.0 * s * s)); }
  `;
  const BAKE_FS = `
    uniform float uLayer; varying vec3 vDir;
    ${NOISE}
    ${SKYLIB}
    float neb(vec3 d, float ll, float bb, float l0, float b0, float s, float seed){
      vec2 q = vec2(ll - l0, bb - b0); float r = length(q * vec2(0.8, 1.2));
      float f = fbm(d * 26.0 + seed), g = fbm(d * 70.0 + seed * 2.0);
      return exp(-r * r / (2.0 * s * s)) * smoothstep(0.25, 0.75, f) * (0.55 + 0.9 * g);
    }
    void main(){
      vec3 d = normalize(vDir);
      float ll, bb; band(d, ll, bb);
      float inBand = gauss(bb, 0.16) * smoothstep(-1.6, -0.9, ll) * (1.0 - smoothstep(1.2, 1.9, ll));
      float patchM = smoothstep(0.32, 0.68, n3(d * 2.6) + 0.35 * inBand);
      float clumps = 0.25 + 0.75 * smoothstep(0.35, 0.72, fbm(d * 5.0 + 2.0));
      float f0 = 0.06, kk = 0.21, ragged = 0.6 * fbm(d * 14.0) + 0.4 * fbm(d * 40.0);
      float w = 0.018 + 0.012 * max(ll - f0, 0.0);
      float lane1 = ll < f0 ? gauss(bb - 0.01 * sin(ll * 9.0), w) : gauss(bb - kk * (ll - f0) * 0.6, w);
      float lane2 = ll < f0 ? 0.0 : gauss(bb + kk * (ll - f0) * 0.35, w * 0.8);
      float lanes = max(lane1, lane2) * smoothstep(-1.2, -0.3, ll) * (1.0 - smoothstep(0.9, 1.4, ll));
      float dust = 1.0 - 0.88 * lanes * (0.55 + 0.45 * ragged);
      if (uLayer < 0.5) { gl_FragColor = vec4(patchM, inBand * clumps * dust, dust, 1.0); return; }
      float body = gauss(bb, 0.12) * (0.45 + 0.55 * fbm(d * 3.0)) * (0.7 + 0.6 * fbm(d * 9.0 + 4.0));
      body *= smoothstep(-1.6, -0.8, ll) * (1.0 - smoothstep(1.1, 1.8, ll));
      float cloud = gauss(ll, 0.30) * gauss(bb, 0.10) * 4.2;
      float lum = body + cloud * (0.6 + 0.4 * fbm(d * 6.0));
      lum *= 0.75 + 0.5 * fbm(d * 24.0 + 9.0);
      lum *= dust * (0.6 + 0.4 * clumps);
      float k = clamp((ll + 0.4) / 1.7, 0.0, 1.0);
      vec3 tone = k < 0.2 ? mix(vec3(1.0, 0.70, 0.36), vec3(1.0, 0.78, 0.46), k / 0.2)
                : k < 0.45 ? mix(vec3(1.0, 0.78, 0.46), vec3(0.98, 0.90, 0.78), (k - 0.2) / 0.25)
                : k < 0.7 ? mix(vec3(0.98, 0.90, 0.78), vec3(0.80, 0.70, 1.0), (k - 0.45) / 0.25)
                : mix(vec3(0.80, 0.70, 1.0), vec3(0.45, 0.60, 1.0), (k - 0.7) / 0.3);
      vec3 col = tone * lum * 0.24;
      float rose = smoothstep(0.0, 0.08, bb) * gauss(bb - 0.14, 0.08) * gauss(ll - 0.1, 0.35) * (0.5 * fbm(d * 7.0) + 0.5 * fbm(d * 18.0 + 3.0));
      col += vec3(0.95, 0.36, 0.50) * 0.95 * rose * 0.24 * 1.6;
      float e = neb(d, ll, bb, -0.30, 0.012, 0.035, 1.0) + 0.8 * neb(d, ll, bb, 0.34, -0.035, 0.028, 5.0) + 0.6 * neb(d, ll, bb, 0.66, 0.045, 0.04, 9.0) + 0.5 * neb(d, ll, bb, -0.62, -0.02, 0.03, 13.0);
      col += vec3(0.95, 0.28, 0.36) * e * 0.11 * dust;
      col += vec3(0.40, 0.55, 1.0) * neb(d, ll, bb, 0.20, 0.13, 0.03, 17.0) * 0.035;
      gl_FragColor = vec4(col, 1.0);
    }`;
  // the galactic plane, from galactic to equatorial to the sky over the cabin
  function galactic(l, b) {
    const ag = 192.85948 * D2R, dg = 27.12825 * D2R, ln = 122.93192 * D2R, L = l * D2R, B = b * D2R;
    const sd = Math.sin(dg) * Math.sin(B) + Math.cos(dg) * Math.cos(B) * Math.cos(ln - L);
    const ra = ag + Math.atan2(Math.cos(B) * Math.sin(ln - L), Math.cos(dg) * Math.sin(B) - Math.sin(dg) * Math.cos(B) * Math.cos(ln - L));
    return radec(((ra / D2R) + 360) % 360, Math.asin(sd) / D2R);
  }
  function bakeSky() {
    // the winter Milky Way rises from Puppis in the south-east, past Monoceros on Orion's left, up through Auriga overhead;
    // the designed gold cloud sits in Monoceros, between Betelgeuse and Procyon
    MW = { a: galactic(255, 0), b: galactic(160, 0), c: galactic(238, -1.5) };
    const bakeMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { uLayer: { value: 0 }, uMWa: { value: MW.a }, uMWb: { value: MW.b }, uMWc: { value: MW.c } },
      vertexShader: 'varying vec3 vDir;\nvoid main(){\n vDir = position;\n gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n}',
      fragmentShader: BAKE_FS,
    });
    const bs = new THREE.Scene(); bs.add(new THREE.Mesh(new THREE.SphereGeometry(10, 96, 48), bakeMat));
    for (const [name, layer, size] of [['M', 0, 512], ['C', 1, 1024]]) {
      const rt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
      const cc = new THREE.CubeCamera(0.1, 100, rt);
      bakeMat.uniforms.uLayer.value = layer; cc.update(renderer, bs); cubes[name] = rt.texture;
    }
    bakeMat.dispose();
  }
  // the named stars around Orion: [ra, dec, magnitude, colour 0 red .. 1 blue]
  const NAMED = [
    [78.634, -8.202, 0.13, 0.80], [81.283, 6.350, 1.64, 0.92], [86.939, -9.670, 2.06, 0.9], [85.190, -1.943, 1.77, 0.92],
    [84.053, -1.202, 1.69, 0.9], [83.002, -0.299, 2.23, 0.9], [83.785, 9.934, 3.33, 0.88], [83.858, -5.910, 2.77, 0.86],
    [72.460, 6.961, 3.19, 0.62], [72.802, 5.605, 3.69, 0.8], [72.653, 8.900, 4.35, 0.75],
    [101.287, -16.716, -1.46, 0.74], [114.825, 5.225, 0.34, 0.58], [68.980, 16.509, 0.85, 0.12], [79.172, 45.998, 0.08, 0.45],
    [116.329, 28.026, 1.14, 0.2], [113.650, 31.888, 1.58, 0.7], [81.573, 28.607, 1.65, 0.82], [99.428, 16.399, 1.93, 0.76],
    [95.675, -17.956, 1.98, 0.86], [89.882, 44.947, 1.90, 0.72], [83.183, -17.822, 2.58, 0.6], [82.061, -20.759, 2.84, 0.5],
    [64.948, 15.628, 3.65, 0.3], [65.734, 17.543, 3.76, 0.3], [67.154, 19.180, 3.53, 0.28], [67.166, 15.871, 3.40, 0.62],
    [56.871, 24.105, 2.87, 0.86], [57.291, 24.054, 3.62, 0.86], [56.219, 24.113, 3.70, 0.86], [56.457, 24.368, 3.87, 0.86],
    [56.581, 23.948, 4.18, 0.86], [56.302, 24.467, 4.29, 0.86],
  ];
  const NS = NAMED.length;
  function makeDome() {
    const sv = NAMED.map(([ra, dec, mag]) => { const v = radec(ra, dec); return new THREE.Vector4(v.x, v.y, v.z, mag); });
    const sc = NAMED.map((s) => new THREE.Vector3(s[3], 0, 0));
    skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uM: { value: cubes.M }, uC: { value: cubes.C }, uVisB: { value: 1 }, uVisF: { value: 1 }, uVisMW: { value: 1 },
        uPx: { value: 0.0006 }, uS: { value: 0 }, uNova: { value: 0 }, uBet: { value: SDIR }, uM42: { value: radec(83.82, -5.39) }, uOri: { value: radec(83.8, -0.8) },
        uMWa: { value: MW.a }, uMWb: { value: MW.b }, uMWc: { value: MW.c }, uSt: { value: sv }, uStC: { value: sc } },
      vertexShader: 'varying vec3 vDir;\nvoid main(){\n vDir = position;\n vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n gl_Position = p.xyww;\n}',
      fragmentShader: `uniform samplerCube uM; uniform samplerCube uC; uniform float uVisB; uniform float uVisF; uniform float uVisMW;
        uniform float uPx; uniform float uS; uniform float uNova; uniform vec3 uBet; uniform vec3 uM42; uniform vec3 uOri; uniform vec4 uSt[${NS}]; uniform vec3 uStC[${NS}];
        varying vec3 vDir;
        ${NOISE}
        ${SKYLIB}
        vec3 starLayer(vec3 d, float scale, float keep, float gain, float rad, float seed, float tw, float bloom){
          float rc = rad * uPx * scale, fade = 1.0 - smoothstep(0.32, 0.55, rc);
          if (fade <= 0.0) return vec3(0.0);
          vec3 p = d * scale, c0 = floor(p), f = p - c0, o = step(0.5, f) - 1.0, acc = vec3(0.0);
          for (int i = 0; i < 8; i++) {
            float fi = float(i); vec3 c = c0 + o + vec3(mod(fi, 2.0), mod(floor(fi / 2.0), 2.0), floor(fi / 4.0));
            vec3 hh = h3(c + seed);
            if (hh.x > keep) continue;
            float b = pow(hh.y, 9.0) * gain;
            if (b < 0.003) continue;
            vec3 sp = normalize(c + 0.5 + (h3(c + seed + 7.13) - 0.5) * 0.55);
            float px = length(d - sp) / uPx;
            float shape = exp(-px * px / (2.0 * rad * rad)) + bloom * smoothstep(0.86, 0.995, hh.y) * 0.04 * exp(-px * px / (2.0 * 16.0 * rad * rad));
            float sc = 1.0 + tw * smoothstep(0.6, 0.9, hh.y) * (0.6 * sin(uS * (11.0 + 9.0 * hh.z) + hh.x * 63.0) + 0.4 * sin(uS * (23.0 + 7.0 * hh.y) + hh.z * 41.0));
            vec3 col = mix(vec3(1.0), tempCol(hh.z), smoothstep(0.80, 0.97, hh.y));
            acc += col * b * sc * shape;
          }
          return acc * fade;
        }
        // a named star: a crisp core a pixel or two wide, a soft 0.3 deg halo; colour from the temperature ramp
        vec3 named(vec3 d, vec3 s, float mag, float k, float tw){
          float a = length(d - s); if (a > 0.035) return vec3(0.0);
          float f = pow(10.0, -0.2 * (mag - 0.1)), px = a / uPx, r = 1.2 + 0.85 * min(f, 2.5);
          vec3 col = mix(vec3(1.0), tempCol(k), 0.85);
          float ad = degrees(a);
          return col * (10.0 * f * tw * exp(-px * px / (2.0 * r * r)) + 0.55 * f * f * exp(-ad * ad / (2.0 * 0.22 * 0.22)) + 0.12 * f * f * exp(-ad * ad / (2.0 * 0.7 * 0.7)));
        }
        void main(){
          vec3 d = normalize(vDir); float el = max(d.y, 0.0);
          vec3 col = mix(vec3(0.014, 0.021, 0.042), vec3(0.0030, 0.0050, 0.0140), pow(el, 0.6));
          col += vec3(0.008, 0.013, 0.012) * (1.0 - smoothstep(0.0, 0.18, el));
          col += vec3(0.004, 0.011, 0.006) * smoothstep(0.02, 0.08, el) * (1.0 - smoothstep(0.1, 0.26, el)) * (0.6 + 0.4 * n3(d * 6.0));
          // the new star lights the air around it, and a little of the whole sky: blue, the upper sky still navy
          float an = acos(clamp(dot(d, uBet), -1.0, 1.0));
          col += vec3(0.10, 0.17, 0.34) * uNova * (0.42 * exp(-an * an / (2.0 * 0.11 * 0.11)) + 0.16 * exp(-an * an / (2.0 * 0.42 * 0.42)));
          col += vec3(0.003, 0.006, 0.014) * uNova * pow(1.0 - el, 1.5);
          float wash = 1.0 - 0.8 * uNova * exp(-an * an / (2.0 * 0.28 * 0.28));
          if (d.y > -0.01) {
            vec3 m = textureCube(uM, d).rgb;
            float tw = 0.12 + 0.4 * (1.0 - smoothstep(0.04, 0.5, d.y));
            float ori = 1.0 - 0.6 * smoothstep(0.966, 0.991, dot(d, uOri));              // within ~15 deg of Orion's belt
            vec3 st = starLayer(d, 70.0, 0.10, 6.5, 1.1, 0.0, tw, 1.0) * uVisB * ori;
            if (uVisF > 0.003) {
              vec3 f = starLayer(d, 190.0, 0.12, 2.8, 0.9, 31.0, tw * 0.6, 0.0) * m.r * ori;
              f += starLayer(d, 420.0, 0.14, 1.3, 0.85, 77.0, 0.0, 0.0) * m.r;
              f += starLayer(d, 640.0, 0.12, 0.9, 0.8, 151.0, 0.0, 0.0) * m.r;
              if (m.g > 0.01) f += starLayer(d, 760.0, 0.30, 1.5, 0.8, 113.0, 0.0, 0.0) * m.g * 0.32;
              st += f * uVisF * wash;
            }
            // Orion and its neighbours, from their real coordinates
            for (int i = 0; i < ${NS}; i++) {
              vec4 s = uSt[i];
              float scin = 1.0 + 0.18 * (1.0 - smoothstep(0.05, 0.4, d.y)) * sin(uS * (13.0 + float(i) * 1.7) + float(i) * 4.1);
              st += named(d, s.xyz, s.w, uStC[i].x, scin) * (0.55 + 0.45 * wash);
            }
            // the Orion Nebula under the belt: a small rose glow with structure
            float am = degrees(length(d - uM42));
            if (am < 1.5) st += vec3(0.95, 0.42, 0.62) * 0.05 * exp(-am * am / (2.0 * 0.28 * 0.28)) * (0.5 + 0.8 * fbm(d * 900.0)) * wash;
            st = max(st - 0.006, 0.0);
            st *= smoothstep(0.0, 0.05, d.y);
            float pk = max(st.r, max(st.g, st.b));
            st *= 1.25 / (1.0 + 0.4 * pk);
            vec3 mw = textureCube(uC, d).rgb * uVisMW * smoothstep(0.0, 0.16, d.y) * (0.35 + 0.65 * wash);
            // Betelgeuse: an orange-red giant until the light arrives, then the supernova
            float ad = degrees(an), px = an / uPx;
            vec3 bet = vec3(1.0, 0.56, 0.28) * (13.0 * exp(-px * px / (2.0 * 1.5 * 1.5)) + 0.32 * exp(-ad * ad / (2.0 * 0.32 * 0.32))) * (1.0 - smoothstep(0.0, 0.25, uNova));
            if (uNova > 0.0 && ad < 14.0) {
              vec3 up = vec3(0.0, 1.0, 0.0), e1 = normalize(cross(up, uBet)), e2 = cross(uBet, e1);
              vec2 q = vec2(dot(d - uBet, e1), dot(d - uBet, e2)) / uPx;          // pixels from the star
              float r = length(q), sp = 0.0;
              for (int k = 0; k < 3; k++) { float th = 0.5236 + float(k) * 1.0472; vec2 ax = vec2(cos(th), sin(th)); float al = dot(q, ax), pr = dot(q, vec2(-ax.y, ax.x)); sp += exp(-pr * pr / 1.4) * exp(-abs(al) / 42.0); }
              vec3 nc = vec3(0.86, 0.92, 1.0);
              bet += uNova * (nc * 90.0 * exp(-r * r / (2.0 * 2.2 * 2.2))
                    + vec3(0.62, 0.76, 1.0) * (1.4 * exp(-ad * ad / (2.0 * 0.3 * 0.3)) + 0.42 * exp(-ad * ad / (2.0 * 1.4 * 1.4)) + 0.05 * exp(-ad * ad / (2.0 * 5.0 * 5.0)))
                    + vec3(0.7, 0.8, 1.0) * sp * 0.4);
            }
            float bk = max(bet.r, max(bet.g, bet.b)); bet *= 1.8 / (1.0 + 0.8 * bk);
            col += st + mw + bet * smoothstep(-0.01, 0.02, d.y);
          }
          if (d.y < 0.0) col = mix(col, vec3(0.010, 0.016, 0.030), smoothstep(0.0, -0.05, d.y));
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    const s = new THREE.Mesh(new THREE.SphereGeometry(30000, 64, 32), skyMat); s.frustumCulled = false; s.renderOrder = 10; scene.add(s);
  }

  /* ------------------------------ textures: wood, stone, wool, snow ------------------------------ */
  let TEX;
  function grain(x, n, r, col, k = 90) { for (let i = 0; i < k; i++) { x.strokeStyle = `rgba(${col},${0.05 + 0.12 * r()})`; x.lineWidth = 0.6 + r() * 1.4; x.beginPath(); let px = r() * n, py = r() * n; x.moveTo(px, py); for (let j = 0; j < 8; j++) { px += 12 + r() * 30; py += (r() - 0.5) * 3; x.lineTo(px, py); } x.stroke(); } }
  function logs(x, n, base, seed, light) {
    const r = U.mulberry32(seed), L = 4, h = n / L;
    for (let i = 0; i < L; i++) {
      const y0 = i * h, g2 = x.createLinearGradient(0, y0, 0, y0 + h), b = base.map((c) => Math.round(c * (0.86 + 0.24 * r())));
      g2.addColorStop(0, `rgb(${b.map((c) => c * 0.45 | 0)})`); g2.addColorStop(0.18, `rgb(${b.map((c) => c * 0.9 | 0)})`); g2.addColorStop(0.45, `rgb(${b.map((c) => Math.min(255, c * light) | 0)})`);
      g2.addColorStop(0.8, `rgb(${b.map((c) => c * 0.8 | 0)})`); g2.addColorStop(1, `rgb(${b.map((c) => c * 0.4 | 0)})`);
      x.fillStyle = g2; x.fillRect(0, y0, n, h);
      x.save(); x.beginPath(); x.rect(0, y0 + 3, n, h - 6); x.clip(); grain(x, n, r, '40,24,12', 70); x.restore();
      for (let k = 0; k < 2; k++) { const kx = r() * n, ky = y0 + h * (0.35 + 0.3 * r()); x.fillStyle = 'rgba(45,25,12,0.55)'; x.beginPath(); x.ellipse(kx, ky, 6 + r() * 6, 3 + r() * 2, 0, 0, Math.PI * 2); x.fill(); }
      x.fillStyle = 'rgba(200,186,160,0.55)'; x.fillRect(0, y0 + h - 3, n, 3);                         // chinking
    }
  }
  function textures() {
    if (TEX) return TEX;
    TEX = {
      logIn: canvasTex(512, (x, n) => logs(x, n, [150, 98, 60], 3, 1.18), [3, 2.7]),
      logOut: canvasTex(512, (x, n) => logs(x, n, [110, 82, 64], 7, 1.12), [3, 3]),
      floor: canvasTex(512, (x, n) => {
        const r = U.mulberry32(11), P = 5, w = n / P;
        for (let i = 0; i < P; i++) { const v = 0.8 + 0.35 * r(); x.fillStyle = `rgb(${110 * v | 0},${74 * v | 0},${46 * v | 0})`; x.fillRect(i * w, 0, w, n); x.save(); x.translate(i * w, 0); x.rotate(Math.PI / 2); x.translate(0, -w); x.beginPath(); x.rect(0, 0, n, w); x.clip(); grain(x, n, r, '45,26,12', 60); x.restore(); x.fillStyle = 'rgba(20,12,6,0.85)'; x.fillRect(i * w, 0, 3, n); const cut = r() * n; x.fillRect(i * w, cut, w, 2); for (const yy of [cut + 8, cut - 8]) { x.fillStyle = 'rgba(30,24,20,0.7)'; x.fillRect(i * w + 8, yy, 3, 3); x.fillRect(i * w + w - 11, yy, 3, 3); } }
      }, [4, 4]),
      ceil: canvasTex(512, (x, n) => { const r = U.mulberry32(17), P = 6, w = n / P; for (let i = 0; i < P; i++) { const v = 0.75 + 0.3 * r(); x.fillStyle = `rgb(${126 * v | 0},${86 * v | 0},${54 * v | 0})`; x.fillRect(i * w, 0, w, n); x.save(); x.translate(i * w, 0); x.rotate(Math.PI / 2); x.translate(0, -w); x.beginPath(); x.rect(0, 0, n, w); x.clip(); grain(x, n, r, '45,26,12', 40); x.restore(); x.fillStyle = 'rgba(20,12,6,0.8)'; x.fillRect(i * w, 0, 2, n); } }, [4, 3]),
      stone: canvasTex(512, (x, n) => {   // fieldstone: irregular stones packed in courses, dark recessed mortar
        const r = U.mulberry32(23); x.fillStyle = '#2e2a26'; x.fillRect(0, 0, n, n);
        let y = 0;
        while (y < n) {
          const hh = 34 + r() * 26; let xx = -r() * 40;
          while (xx < n) {
            const w = 44 + r() * 70, v = 0.62 + 0.5 * r(), tint = r();
            const base = tint < 0.4 ? [124, 116, 106] : tint < 0.75 ? [116, 100, 84] : [98, 100, 102];
            const pts = []; for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2, rr = 0.84 + 0.16 * r(); pts.push([xx + w / 2 + Math.cos(a) * (w / 2 - 3) * rr, y + hh / 2 + Math.sin(a) * (hh / 2 - 3) * rr]); }
            for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) {
              const g2 = x.createLinearGradient(xx + ox, y + oy, xx + ox + w * 0.4, y + oy + hh);
              g2.addColorStop(0, `rgb(${base.map((c) => Math.min(255, c * v * 1.22) | 0)})`); g2.addColorStop(0.6, `rgb(${base.map((c) => c * v | 0)})`); g2.addColorStop(1, `rgb(${base.map((c) => c * v * 0.62 | 0)})`);
              x.fillStyle = g2; x.beginPath(); pts.forEach(([px, py], k) => (k ? x.lineTo(px + ox, py + oy) : x.moveTo(px + ox, py + oy))); x.closePath(); x.fill();
              x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 2; x.stroke();
            }
            xx += w + 2 + r() * 4;
          }
          y += hh + 2;
        }
        for (let i = 0; i < 16000; i++) { x.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.09)'; x.fillRect(r() * n, r() * n, 1.5, 1.5); }
      }, [1, 1]),
      soot: canvasTex(256, (x, n) => { const r = U.mulberry32(29); x.fillStyle = '#1a1512'; x.fillRect(0, 0, n, n); for (let i = 0; i < 4000; i++) { x.fillStyle = `rgba(${r() > 0.5 ? '60,40,28' : '0,0,0'},${0.2 * r()})`; x.fillRect(r() * n, r() * n, 2, 2); } }),
      rug: canvasTex(512, (x, n) => {
        x.fillStyle = '#6e1d1a'; x.fillRect(0, 0, n, n);
        const band = (m, c, w) => { x.strokeStyle = c; x.lineWidth = w; x.strokeRect(m, m, n - 2 * m, n - 2 * m); };
        band(14, '#d8c39a', 10); band(32, '#1f2a44', 14); band(52, '#d8c39a', 5); band(70, '#a8462c', 8);
        x.fillStyle = '#1f2a44'; x.save(); x.translate(n / 2, n / 2); for (const s of [150, 104, 60]) { x.beginPath(); x.moveTo(0, -s); x.lineTo(s * 0.7, 0); x.lineTo(0, s); x.lineTo(-s * 0.7, 0); x.closePath(); x.fillStyle = s === 104 ? '#d8c39a' : s === 60 ? '#a8462c' : '#1f2a44'; x.fill(); } x.restore();
        const r = U.mulberry32(31); for (let i = 0; i < 26000; i++) { x.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)'; x.fillRect(r() * n, r() * n, 1.4, 1.4); }
      }),
      knit: canvasTex(256, (x, n) => {   // cable knit: ribs and twisted cables (greyscale; the material colour tints it)
        x.fillStyle = '#d6d6d6'; x.fillRect(0, 0, n, n);
        for (let k = 0; k < n; k += 8) { x.fillStyle = 'rgba(0,0,0,0.16)'; x.fillRect(k, 0, 2, n); }
        for (const cx of [n * 0.25, n * 0.75]) for (let y = 0; y < n; y += 32) for (const s of [-1, 1]) {
          x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 5; x.beginPath(); x.moveTo(cx - 10 * s, y); x.bezierCurveTo(cx - 10 * s, y + 12, cx + 10 * s, y + 20, cx + 10 * s, y + 32); x.stroke();
          x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = 2; x.beginPath(); x.moveTo(cx - 9 * s, y + 1); x.bezierCurveTo(cx - 9 * s, y + 12, cx + 9 * s, y + 20, cx + 9 * s, y + 31); x.stroke();
        }
        const r = U.mulberry32(37); for (let i = 0; i < 5000; i++) { x.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'; x.fillRect(r() * n, r() * n, 1.5, 2.5); }
      }, [3, 2]),
      fine: canvasTex(128, (x, n) => { x.fillStyle = '#d0d0d0'; x.fillRect(0, 0, n, n); for (let k = 0; k < n; k += 3) { x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(k, 0, 1, n); } for (let k = 0; k < n; k += 4) { x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(0, k, n, 1); } }, [4, 4]),
      tartan: canvasTex(256, (x, n) => { x.fillStyle = '#7a1f1c'; x.fillRect(0, 0, n, n); const st = (p, w, c, a) => { x.fillStyle = c; x.globalAlpha = a; x.fillRect(p, 0, w, n); x.fillRect(0, p, n, w); x.globalAlpha = 1; }; st(30, 40, '#1d2b22', 0.7); st(150, 40, '#1d2b22', 0.7); st(96, 6, '#e0c98a', 0.8); st(216, 6, '#e0c98a', 0.8); st(60, 3, '#111', 0.6); }, [2, 2]),
      leather: canvasTex(256, (x, n) => { const r = U.mulberry32(41); x.fillStyle = '#5a3420'; x.fillRect(0, 0, n, n); for (let i = 0; i < 60; i++) { const g2 = x.createRadialGradient(r() * n, r() * n, 2, r() * n, r() * n, 40 + r() * 60); g2.addColorStop(0, 'rgba(140,90,55,0.16)'); g2.addColorStop(1, 'rgba(140,90,55,0)'); x.fillStyle = g2; x.fillRect(0, 0, n, n); } for (let i = 0; i < 6000; i++) { x.fillStyle = 'rgba(0,0,0,0.1)'; x.fillRect(r() * n, r() * n, 1, 1); } }),
      charred: canvasTex(256, (x, n) => { const r = U.mulberry32(43); x.fillStyle = '#1c1612'; x.fillRect(0, 0, n, n); for (let i = 0; i < 5000; i++) { x.fillStyle = `rgba(${r() > 0.5 ? '70,58,48' : '0,0,0'},${0.3 * r()})`; x.fillRect(r() * n, r() * n, 2, 2); } x.strokeStyle = 'rgba(0,0,0,0.8)'; x.lineWidth = 2; for (let i = 0; i < 40; i++) { x.beginPath(); const px = r() * n, py = r() * n; x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 40, py + (r() - 0.5) * 14); x.stroke(); } }),
      embers: canvasTex(256, (x, n) => {   // alligator cracks that glow where the fire is hot
        const r = U.mulberry32(47); x.fillStyle = '#000'; x.fillRect(0, 0, n, n);
        for (let i = 0; i < 70; i++) { x.strokeStyle = `rgba(255,${120 + 80 * r() | 0},40,${0.4 + 0.6 * r()})`; x.lineWidth = 1 + r() * 2.2; x.beginPath(); let px = r() * n, py = r() * n; x.moveTo(px, py); for (let k = 0; k < 4; k++) { px += (r() - 0.5) * 34; py += (r() - 0.5) * 22; x.lineTo(px, py); } x.stroke(); }
      }, [1, 1]),
      snow: canvasTex(512, (x, n) => { const r = U.mulberry32(53); x.fillStyle = '#e8eef6'; x.fillRect(0, 0, n, n); for (let i = 0; i < 70; i++) { const px = r() * n, py = r() * n, rr = 30 + r() * 120; for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) { const g2 = x.createRadialGradient(px + ox, py + oy, 1, px + ox, py + oy, rr); g2.addColorStop(0, `rgba(150,165,190,${0.08 + 0.1 * r()})`); g2.addColorStop(1, 'rgba(150,165,190,0)'); x.fillStyle = g2; x.fillRect(px + ox - rr, py + oy - rr, 2 * rr, 2 * rr); } } for (let i = 0; i < 20000; i++) { x.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.25)' : 'rgba(120,135,160,0.08)'; x.fillRect(r() * n, r() * n, 1.5, 1.5); } }, [40, 40]),
      bark: canvasTex(128, (x, n) => { const r = U.mulberry32(59); x.fillStyle = '#3a2a1e'; x.fillRect(0, 0, n, n); for (let i = 0; i < 80; i++) { x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(r() * n, 0, 1 + r() * 2, n); } }, [1, 2]),
      frost: canvasTex(256, (x, n) => { x.clearRect(0, 0, n, n); const r = U.mulberry32(61); for (const [cx, cy] of [[0, 0], [n, 0], [0, n], [n, n]]) { const g2 = x.createRadialGradient(cx, cy, 2, cx, cy, n * 0.42); g2.addColorStop(0, 'rgba(235,242,255,0.75)'); g2.addColorStop(0.6, 'rgba(235,242,255,0.18)'); g2.addColorStop(1, 'rgba(235,242,255,0)'); x.fillStyle = g2; x.fillRect(0, 0, n, n); } x.strokeStyle = 'rgba(240,246,255,0.4)'; x.lineWidth = 0.8; for (let i = 0; i < 260; i++) { const a = r() * Math.PI * 2, cx = r() < 0.5 ? 0 : n, cy = r() < 0.5 ? 0 : n, d0 = r() * n * 0.3; let px = cx + Math.cos(a) * d0, py = cy + Math.sin(a) * d0; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 4; k++) { px += (r() - 0.5) * 18; py += (r() - 0.5) * 18; x.lineTo(px, py); } x.stroke(); } }, [1, 1]),
      planks: canvasTex(256, (x, n) => { const r = U.mulberry32(67); for (let i = 0; i < 4; i++) { const v = 0.8 + 0.3 * r(); x.fillStyle = `rgb(${92 * v | 0},${60 * v | 0},${36 * v | 0})`; x.fillRect(i * 64, 0, 64, n); x.fillStyle = 'rgba(15,8,4,0.8)'; x.fillRect(i * 64, 0, 2, n); } grain(x, n, r, '40,22,10', 50); }),
      clock: canvasTex(128, (x, n) => { x.fillStyle = '#efe6d2'; x.beginPath(); x.arc(n / 2, n / 2, n / 2 - 4, 0, Math.PI * 2); x.fill(); x.strokeStyle = '#3a2a1a'; x.lineWidth = 5; x.stroke(); x.fillStyle = '#2a1e14'; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; x.fillRect(n / 2 + Math.sin(a) * 48 - 2, n / 2 - Math.cos(a) * 48 - 5, 4, 10); } x.strokeStyle = '#1a120c'; x.lineCap = 'round'; x.lineWidth = 5; x.beginPath(); x.moveTo(n / 2, n / 2); x.lineTo(n / 2 + Math.sin(-0.4) * 26, n / 2 - Math.cos(-0.4) * 26); x.stroke(); x.lineWidth = 3; x.beginPath(); x.moveTo(n / 2, n / 2); x.lineTo(n / 2 + Math.sin(4.92) * 40, n / 2 - Math.cos(4.92) * 40); x.stroke(); }),
      lens: canvasTex(64, (x, n) => { const g2 = x.createLinearGradient(0, 0, 0, n); g2.addColorStop(0, '#120c08'); g2.addColorStop(0.55, '#3a1d0c'); g2.addColorStop(0.8, '#a2541c'); g2.addColorStop(1, '#2a140a'); x.fillStyle = g2; x.fillRect(0, 0, n, n); }),
    };
    TEX.snow.colorSpace = THREE.SRGBColorSpace;
    return TEX;
  }

  /* ------------------------------ the ground, the valley, the trees ------------------------------ */
  // the snow: flat round the cabin, rolling, falling away into the valley to the south-west (toward the star)
  const FWD = [Math.sin(TL.BETEL.az * D2R), -Math.cos(TL.BETEL.az * D2R)];
  function groundY(x, z) {
    const f = x * FWD[0] + z * FWD[1], side = x * -FWD[1] + z * FWD[0];
    let h = GROUND + 0.25 * Math.sin(x * 0.11 + 1.3) * Math.sin(z * 0.09) + 0.4 * U.noise(x * 0.03, z * 0.03);
    const near = Math.hypot(x - 1, z + 2); h = U.lerp(GROUND, h, U.smooth(7, 16, near));
    if (f > 34) h -= 0.22 * Math.pow(f - 34, 1.25) * (0.75 + 0.25 * Math.cos(side * 0.01));
    return h;
  }
  function snowMat() {
    const T = textures();
    const m = new THREE.MeshStandardMaterial({ color: '#f2f6ff', roughness: 0.82, map: T.snow });
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, snowU);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nuniform float uNova;\nuniform vec3 uCamQ;\n' + NOISE)
        .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
          { vec3 q = vWP * 110.0, c = floor(q); float hs = h1(c + uCamQ * 0.37);
            float dd = length(fract(q.xz) - 0.5);
            float sp = step(0.9975, hs) * (0.5 + 0.5 * h1(c + 3.1)) * smoothstep(0.32, 0.05, dd);
            float lit = dot(reflectedLight.directDiffuse, vec3(0.333));
            reflectedLight.directSpecular += vec3(0.85, 0.92, 1.0) * sp * lit * 26.0 * uNova; }`);
    };
    m.customProgramCacheKey = () => 'nova-snow';
    return m;
  }
  function ground() {
    const n = 180, S = 560, geo = new THREE.PlaneGeometry(S, S, n, n); geo.rotateX(-Math.PI / 2);
    const P = geo.attributes.position;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i) + 20, z = P.getZ(i) - 40; P.setXYZ(i, x, groundY(x, z), z); }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, snowMat()); m.receiveShadow = true; m.castShadow = false; scene.add(m);
    // a finer patch round the cabin and where you stand, so the shadows on it stay crisp
    const g2 = new THREE.PlaneGeometry(40, 40, 80, 80); g2.rotateX(-Math.PI / 2);
    const Q = g2.attributes.position;
    for (let i = 0; i < Q.count; i++) { const x = Q.getX(i) + 3, z = Q.getZ(i) - 6; Q.setXYZ(i, x, groundY(x, z) + 0.012, z); }
    g2.computeVertexNormals(); const m2 = new THREE.Mesh(g2, snowMat()); m2.receiveShadow = true; scene.add(m2);
    // the far ridge across the valley: dark forest and snow, low enough to keep Orion clear
    const pos = [], col = [], idx = [], N = 220;
    for (let i = 0; i <= N; i++) {
      const a = (TL.BETEL.az - 95 + 190 * i / N) * D2R, dist = 2600 + 700 * U.noise(i * 0.05, 3);
      const peak = 120 + 160 * Math.abs(U.noise(i * 0.045, 7)) + 70 * U.noise(i * 0.17, 11);
      const dx = Math.sin(a), dz = -Math.cos(a);
      for (const [r2, hh] of [[dist - 400, -260], [dist, peak], [dist + 900, peak * 0.6]]) {
        pos.push(dx * r2, hh, dz * r2);
        const sn = hh > 40 ? 0.55 + 0.3 * U.hash(i * 3.1) : 0.12; col.push(0.42 * sn + 0.06, 0.46 * sn + 0.07, 0.55 * sn + 0.1);
      }
    }
    for (let i = 0; i < N; i++) for (let k = 0; k < 2; k++) { const a = i * 3 + k, b = a + 3; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); rg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); rg.setIndex(idx); rg.computeVertexNormals();
    const ridge = new THREE.Mesh(rg, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })); scene.add(ridge);
  }
  // a snowy pine: stacked drooping tiers, snow lying on their upper faces
  function pineGeo(seed) {
    const r = U.mulberry32(seed), pos = [], nor = [], col = [];
    const add = (geo, tint) => { const g2 = geo.toNonIndexed(), P = g2.attributes.position, N = g2.attributes.normal; for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(N.getX(i), N.getY(i), N.getZ(i)); col.push(...tint(P.getY(i), N.getY(i), i)); } };
    add(new THREE.CylinderGeometry(0.035, 0.06, 0.3, 6).translate(0, 0.15, 0), () => [0.16, 0.11, 0.08]);
    const tiers = 9;
    for (let k = 0; k < tiers; k++) {
      const y0 = 0.12 + k * 0.094, hgt = 0.24 - k * 0.008, rad = 0.31 - k * 0.03;
      const cone = new THREE.ConeGeometry(rad, hgt, 14, 2); cone.rotateY(r() * 6.28); cone.translate(0, y0 + hgt / 2, 0);
      const P = cone.attributes.position;
      for (let i = 0; i < P.count; i++) {
        const y = P.getY(i), x = P.getX(i), z = P.getZ(i), rr = Math.hypot(x, z);
        if (y < y0 + 0.02 && rr > 0.01) { const j = 0.6 + 0.75 * U.hash(i * 3.7 + k * 11 + seed), a2 = Math.atan2(z, x) + (r() - 0.5) * 0.25; P.setXYZ(i, Math.cos(a2) * rr * j, y - 0.05 * j * (0.6 + r() * 0.8), Math.sin(a2) * rr * j); }
        else if (rr > 0.01) { const j = 0.85 + 0.3 * r(); P.setX(i, x * j); P.setZ(i, z * j); }
      }
      cone.computeVertexNormals();
      add(cone, (y, ny, i) => { const top = U.smooth(y0 - 0.02, y0 + hgt * 0.7, y), sn = U.clamp(0.15 + 0.85 * top * (0.45 + 0.7 * U.hash(i * 1.7 + seed + k))) * (ny > 0.25 ? 1 : 0.12); return [U.lerp(0.06, 0.86, sn), U.lerp(0.1, 0.9, sn), U.lerp(0.075, 0.96, sn)]; });
    }
    const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g2.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g2.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return g2;   // unit height (about 1.0)
  }
  function trees() {
    const T = [], keepOut = (x, z) => Math.hypot(x - 1, z + 1) < 15;
    // the forest round the clearing, thinning toward the valley
    for (let i = 0; i < 1400 && T.length < 760; i++) {
      const a = rnd() * Math.PI * 2, d = 18 + Math.pow(rnd(), 0.7) * 190, x = Math.cos(a) * d + 1, z = Math.sin(a) * d - 2;
      if (keepOut(x, z)) continue;
      const f = x * FWD[0] + z * FWD[1], side = Math.abs(x * -FWD[1] + z * FWD[0]);
      if (f > 10 && side < f * 1.25 + 6) { if (f < 34 || rnd() < 0.6) continue; }   // the open slope and the valley
      T.push([x, z, R(9, 17) * (d > 120 ? 1.2 : 1)]);
    }
    // the valley floor's forest, far below
    for (let i = 0; i < 520; i++) { const f = R(60, 260), side = R(-1, 1) * (f * 1.1 + 40), x = FWD[0] * f - FWD[1] * side, z = FWD[1] * f + FWD[0] * side; T.push([x, z, R(10, 18)]); }
    // lone pines on the open slope, off Orion's line: their shadows run long across the snow toward you
    const O = TL.OUT;
    for (const [az, d, h] of [[2, 15, 7.5], [9, 23, 9.5], [-6, 30, 11], [52, 13, 6.5], [60, 22, 9], [47, 31, 10.5], [14, 39, 12], [62, 5.8, 4.2], [78, 7.6, 5.4], [55, 9.5, 5.0], [90, 11, 6.0]]) {
      const a = (TL.BETEL.az + az - 25.5) * D2R; T.push([O[0] + Math.sin(a) * d, O[2] - Math.cos(a) * d, h]);
    }
    const geos = [pineGeo(1), pineGeo(2), pineGeo(3)], mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
    const groups = [[], [], []]; T.forEach((t, i) => groups[i % 3].push(t));
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), V = new THREE.Vector3();
    groups.forEach((G, gi) => {
      const im = new THREE.InstancedMesh(geos[gi], mat, G.length); im.castShadow = true; im.receiveShadow = true;
      G.forEach(([x, z, h], i) => { Q.setFromAxisAngle(UPY, rnd() * 6.28); S.set(h * R(0.85, 1.1), h, h * R(0.85, 1.1)); V.set(x, groundY(x, z) - 0.15, z); M.compose(V, Q, S); im.setMatrixAt(i, M); });
      scene.add(im);
    });
    // snow-covered rocks and drifts near the cabin
    for (let i = 0; i < 26; i++) { const a = rnd() * 6.28, d = R(5, 22), x = 2 + Math.cos(a) * d, z = -4 + Math.sin(a) * d; if (Math.hypot(x - 5, z + 8.5) < 3) continue; const m = mesh(new THREE.SphereGeometry(R(0.25, 0.8), 10, 7), std('#eef3fa', 0.85), x, groundY(x, z) - 0.1, z); m.scale.y = R(0.35, 0.6); scene.add(m); }
  }

  /* ------------------------------ the cabin ------------------------------
     interior x -4..4, z -3..3, floor y 0, ceiling 2.7; walls 0.22 thick; gable roof, ridge along x at y 5.0 */
  const IN = { x0: -4, x1: 4, z0: -3, z1: 3, ceil: 2.7, t: 0.22 };
  function wallBox(x0, y0, z0, x1, y1, z1, inFace) {   // inFace: which face looks into the room (+x 0, -x 1, +z 4, -z 5)
    const T = textures(), mi = std('#ffffff', 0.85, T.logIn), mo = std('#ffffff', 0.9, T.logOut), mats = [mo, mo, mo, mo, mo, mo]; mats[inFace] = mi;
    const m = new THREE.Mesh(box(x1 - x0, y1 - y0, z1 - z0), mats); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); m.castShadow = m.receiveShadow = true;
    // keep the log texture at one scale on every wall piece
    const g2 = m.geometry, uv = g2.attributes.uv, P = g2.attributes.position, N = g2.attributes.normal;
    for (let i = 0; i < uv.count; i++) { const ax = Math.abs(N.getX(i)) > 0.5, wx = P.getX(i) + m.position.x, wy = P.getY(i) + m.position.y, wz = P.getZ(i) + m.position.z; uv.setXY(i, (ax ? wz : wx) / 2.7, wy / 0.9); }
    uv.needsUpdate = true; mi.map.repeat.set(1, 1); mo.map.repeat.set(1, 1);
    scene.add(m); return m;
  }
  function worldUV(m, sx = 1.1, sy = 1.1) {
    const g2 = m.geometry, uv = g2.attributes.uv, P = g2.attributes.position, N = g2.attributes.normal;
    for (let i = 0; i < uv.count; i++) { const ax = Math.abs(N.getX(i)) > 0.5, ay = Math.abs(N.getY(i)) > 0.5, wx = P.getX(i) + m.position.x, wy = P.getY(i) + m.position.y, wz = P.getZ(i) + m.position.z; uv.setXY(i, (ax ? wz : wx) / sx, (ay ? wz : wy) / sy); }
    uv.needsUpdate = true; return m;
  }
  function cabin() {
    const T = textures(), t = IN.t, top = 2.98;
    // south wall (z -3.22..-3): the fireplace (x -0.5..1.3), the window (x 1.6..2.9, y 0.8..2.3), the door (x 3.15..3.95, y 0..2.1)
    const sz0 = IN.z0 - t, sz1 = IN.z0;
    wallBox(IN.x0 - t, GROUND, sz0, 1.6, top, sz1, 4);
    wallBox(1.6, GROUND, sz0, 2.9, 0.8, sz1, 4); wallBox(1.6, 2.3, sz0, 2.9, top, sz1, 4);
    wallBox(2.9, GROUND, sz0, 3.15, top, sz1, 4); wallBox(3.15, 2.1, sz0, 3.95, top, sz1, 4); wallBox(3.95, GROUND, sz0, IN.x1 + t, top, sz1, 4);
    wallBox(3.15, GROUND, sz0, 3.95, 0, sz1, 4);
    // north, east (-x), west (+x) walls
    wallBox(IN.x0 - t, GROUND, IN.z1, IN.x1 + t, top, IN.z1 + t, 5);
    wallBox(IN.x0 - t, GROUND, IN.z0, IN.x0, top, IN.z1, 0);
    wallBox(IN.x1, GROUND, IN.z0, IN.x1 + t, top, IN.z1, 1);
    // gable ends
    for (const sx of [IN.x0 - t, IN.x1]) {
      const sh = new THREE.Shape(); sh.moveTo(-3.22, 0); sh.lineTo(3.22, 0); sh.lineTo(0, 2.02); sh.closePath();
      const geo = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: false }); geo.rotateY(Math.PI / 2);
      const uv = geo.attributes.uv, P = geo.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, P.getZ(i) / 2.7, (P.getY(i) + 2.6) / 0.9);
      const m = mesh(geo, std('#ffffff', 0.9, T.logOut), sx, top, 0); scene.add(m);
    }
    // floor, ceiling, beams
    const fl = slab(IN.x0, -0.12, IN.z0, IN.x1, 0, IN.z1, std('#ffffff', 0.7, T.floor), { cast: false }); scene.add(fl);
    scene.add(slab(IN.x0, IN.ceil, IN.z0, IN.x1, IN.ceil + 0.06, IN.z1, std('#ffffff', 0.85, T.ceil)));
    for (const z of [-2.1, -0.6, 0.9, 2.4]) scene.add(slab(IN.x0, IN.ceil - 0.18, z - 0.09, IN.x1, IN.ceil, z + 0.09, std('#5c3b22', 0.8)));
    // the roof: two slopes with a thick blanket of snow; icicles along the south eave
    const roofM = std('#3b2a1f', 0.9), snowR = std('#eef3fb', 0.8);
    for (const s of [-1, 1]) {
      const ang = Math.atan2(2.45, 3.9), len = (s < 0 ? 3.57 : 3.9) / Math.cos(ang);
      const r = new THREE.Group(); r.position.set(0, 5.0, 0); r.rotation.x = s * ang; scene.add(r);
      const rf = mesh(box(9.6, 0.18, len + 0.1), roofM, 0, -0.09, s * (len / 2)); r.add(rf);
      const sn = mesh(box(9.7, 0.24, len + 0.12), snowR, 0, 0.11, s * (len / 2)); r.add(sn);
    }
    for (let x = -4.6; x < 4.6; x += R(0.12, 0.3)) { const L = R(0.06, 0.38); scene.add(mesh(new THREE.ConeGeometry(0.018, L, 5), std('#dfe9f7', 0.15, null, { transparent: true, opacity: 0.85 }), x, 2.6 - L / 2, -3.55, { rx: Math.PI, cast: false })); }
    // the chimney: stone, outside the south wall, through the eave and up past the ridge
    const stoneM = std('#ffffff', 0.92, T.stone);
    scene.add(worldUV(slab(-0.35, GROUND, -3.95, 1.15, 5.7, -3.22, stoneM))); scene.add(slab(-0.45, 5.7, -4.05, 1.25, 5.85, -3.12, std('#4d4842', 0.9)));
    scene.add(slab(-0.4, 5.85, -3.95, 1.2, 5.88, -3.22, std('#eef3fb', 0.8)));
    // the door step, a lantern by the door, the woodpile against the west wall
    scene.add(slab(3.05, GROUND - 0.05, -3.78, 4.05, -0.22, -3.22, std('#6b6660', 0.95, T.stone)));
    doorLamp = new THREE.Group(); doorLamp.position.set(4.12, 1.95, -3.34); scene.add(doorLamp);
    doorLamp.add(mesh(box(0.14, 0.22, 0.14), std('#1c1a18', 0.5), 0, 0, 0, { cast: false }));
    doorLamp.add(mesh(box(0.1, 0.16, 0.1), new THREE.MeshBasicMaterial({ color: '#ffb15c' }), 0, 0, 0, { cast: false }));
    outWarm = new THREE.PointLight('#ffb66e', 1.6, 9, 1.6); outWarm.position.set(4.12, 1.9, -3.6); scene.add(outWarm);
    for (let i = 0; i < 7; i++) for (let j = 0; j < 9; j++) { const z = -1.8 + j * 0.27 + (i % 2) * 0.13; scene.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.55, 8), std(['#6e5338', '#5e4630', '#7a5e40'][(i + j) % 3], 0.95), IN.x1 + t + 0.32, GROUND + 0.13 + i * 0.23, z, { rz: Math.PI / 2, ry: 0 })); }
    scene.add(slab(IN.x1 + t + 0.02, GROUND + 1.7, -2.0, IN.x1 + t + 0.62, GROUND + 1.86, 0.6, std('#eef3fb', 0.8)));
    // the north side's windows, warm from inside (seen in the wide shot)
    for (const x of [-2.2, 1.4]) {
      scene.add(mesh(new THREE.PlaneGeometry(1.1, 1.0), new THREE.MeshBasicMaterial({ color: '#ffb46a' }), x, 1.5, IN.z1 + t + 0.005, { ry: 0, cast: false }));
      for (const [w, h, dx, dy] of [[0.05, 1.1, 0, 0], [1.2, 0.05, 0, 0], [1.2, 0.07, 0, 0.53], [1.2, 0.07, 0, -0.53], [0.07, 1.1, 0.58, 0], [0.07, 1.1, -0.58, 0]]) scene.add(mesh(box(w, h, 0.05), std('#3a2a1f', 0.8), x + dx, 1.5 + dy, IN.z1 + t + 0.02, { cast: false }));
    }
    northWarm = new THREE.PointLight('#ffae62', 2.2, 10, 1.6); northWarm.position.set(-0.4, 1.4, IN.z1 + 1.4); scene.add(northWarm);
    // drifts against the south wall
    for (let x = -4.4; x < 3.0; x += 0.7) { const m = mesh(new THREE.SphereGeometry(R(0.5, 0.8), 12, 8), std('#eef3fa', 0.85), x, GROUND - 0.15, -3.45 - R(0, 0.25), { cast: false }); m.scale.set(1.3, 0.45, 0.7); if (x > -0.6 && x < 1.3) continue; scene.add(m); }
  }

  /* ------------------------------ inside: the fireplace, the window, the door, the furniture ------------------------------ */
  function interior() {
    const T = textures(), stoneM = std('#ffffff', 0.92, T.stone), sootM = std('#ffffff', 1.0, T.soot), wood = std('#4a2e1c', 0.7), dark = std('#2b1d14', 0.75);
    // the chimney breast with its firebox (opening x 0..0.8, y 0.12..0.85, depth to z -2.98)
    const z0 = IN.z0, zf = -2.45;
    scene.add(worldUV(slab(-0.5, 0, z0, 0.0, IN.ceil, zf, stoneM))); scene.add(worldUV(slab(0.8, 0, z0, 1.3, IN.ceil, zf, stoneM))); scene.add(worldUV(slab(0.0, 0.85, z0, 0.8, IN.ceil, zf, stoneM)));
    scene.add(slab(0.0, 0.0, z0, 0.8, 0.12, zf, stoneM));
    scene.add(slab(0.0, 0.12, -2.98, 0.8, 0.85, -2.95, sootM)); scene.add(slab(0.0, 0.12, -2.98, 0.03, 0.85, zf, sootM)); scene.add(slab(0.77, 0.12, -2.98, 0.8, 0.85, zf, sootM)); scene.add(slab(0.0, 0.82, -2.98, 0.8, 0.85, zf, sootM));
    scene.add(slab(-0.72, 0, -2.45, 1.52, 0.1, -1.92, std('#6f6860', 0.8, T.stone)));                    // the raised hearth
    scene.add(slab(-0.66, 1.22, -2.64, 1.46, 1.36, -2.28, wood));                                        // the mantel beam
    // on the mantel: a clock, two jars, a small brass lantern
    const clock = new THREE.Group(); clock.position.set(0.4, 1.36, -2.4); scene.add(clock);
    clock.add(mesh(box(0.26, 0.3, 0.12), dark, 0, 0.15, 0)); clock.add(mesh(new THREE.CircleGeometry(0.095, 32), new THREE.MeshStandardMaterial({ map: T.clock, roughness: 0.5 }), 0, 0.17, 0.062, { cast: false }));
    clock.add(mesh(new THREE.TorusGeometry(0.098, 0.008, 6, 32), std('#a07a3a', 0.35, null, { metalness: 0.8 }), 0, 0.17, 0.064, { cast: false }));
    scene.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 14), std('#5d7a8a', 0.3), -0.25, 1.44, -2.42)); scene.add(mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.12, 14), std('#9a5b34', 0.4), -0.42, 1.42, -2.44));
    scene.add(mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.2, 10), std('#8a6a34', 0.3, null, { metalness: 0.7 }), 1.15, 1.46, -2.42));
    // a basket of split logs, a poker stand
    for (let i = 0; i < 7; i++) scene.add(mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.42, 7), std(['#6e5338', '#5e4630', '#7a5e40'][i % 3], 0.95), -0.95 + (i % 3) * 0.13, 0.12 + Math.floor(i / 3) * 0.11, -2.05 + (i % 2) * 0.05, { rz: Math.PI / 2 }));
    scene.add(mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.75, 6), std('#1a1816', 0.4, null, { metalness: 0.8 }), 1.42, 0.4, -2.1, { rz: 0.12 }));
    // the window: frame, muntins (2 x 3 panes), the deep sill, frost in the corners, the glass, a plaid curtain
    const fr = std('#5a3a24', 0.75);
    scene.add(slab(1.5, 0.74, -3.02, 3.0, 0.8, -2.8, fr));                                                // sill
    for (const [x0, x1, y0, y1] of [[1.56, 1.64, 0.8, 2.3], [2.86, 2.94, 0.8, 2.3], [1.56, 2.94, 2.26, 2.34], [1.56, 2.94, 0.8, 0.86], [2.23, 2.27, 0.8, 2.3], [1.6, 2.9, 1.3, 1.335], [1.6, 2.9, 1.8, 1.835]]) scene.add(slab(x0, y0, -3.14, x1, y1, -3.07, fr));
    for (const [x0, x1, y0, y1] of [[1.5, 1.6, 0.74, 2.42], [2.9, 3.0, 0.74, 2.42], [1.5, 3.0, 2.3, 2.42]]) scene.add(slab(x0, y0, -3.02, x1, y1, -2.97, fr));   // trim
    const glass = mesh(new THREE.PlaneGeometry(1.3, 1.5), new THREE.MeshStandardMaterial({ color: '#9fb4c8', roughness: 0.05, metalness: 0.0, transparent: true, opacity: 0.07, depthWrite: false }), 2.25, 1.55, -3.105, { cast: false }); scene.add(glass);
    const frost = mesh(new THREE.PlaneGeometry(1.3, 1.5), new THREE.MeshStandardMaterial({ map: T.frost, transparent: true, depthWrite: false, roughness: 0.9, color: '#ffffff' }), 2.25, 1.55, -3.1, { cast: false, recv: false }); scene.add(frost);
    { const cg = new THREE.PlaneGeometry(0.34, 1.9, 10, 1), P = cg.attributes.position; for (let i = 0; i < P.count; i++) P.setZ(i, 0.03 * Math.sin(P.getX(i) * 40)); cg.computeVertexNormals(); scene.add(mesh(cg, std('#ffffff', 0.95, T.tartan, { side: THREE.DoubleSide }), 1.33, 1.52, -2.93)); }
    // the door: planks, iron straps and latch; it swings inward on its hinge at x 3.95
    door = new THREE.Group(); door.position.set(3.95, 0, -3.1); scene.add(door);
    door.add(mesh(box(0.8, 2.08, 0.06), std('#ffffff', 0.8, T.planks), -0.4, 1.04, 0));
    for (const y of [0.35, 1.75]) door.add(mesh(box(0.62, 0.05, 0.012), std('#1d1b19', 0.45, null, { metalness: 0.6 }), -0.3, y, 0.037, { cast: false }));
    door.add(mesh(new THREE.TorusGeometry(0.05, 0.009, 6, 16, Math.PI), std('#1d1b19', 0.4, null, { metalness: 0.7 }), -0.7, 1.02, 0.045, { rz: Math.PI / 2, cast: false }));
    door.add(mesh(box(0.1, 0.02, 0.02), std('#1d1b19', 0.4, null, { metalness: 0.7 }), -0.7, 1.08, 0.04, { cast: false }));
    for (const [x0, x1, y0, y1] of [[3.07, 3.15, 0, 2.18], [3.95, 4.0, 0, 2.18], [3.07, 4.0, 2.1, 2.18]]) scene.add(slab(x0, y0, -3.02, x1, y1, -2.97, fr));
    // an oil lamp on a bracket between the window and the door
    const LX = IN.x1 - 0.12, LZ = -2.05;
    scene.add(slab(IN.x1 - 0.2, 1.72, LZ - 0.09, IN.x1, 1.75, LZ + 0.09, wood));
    scene.add(mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.07, 14), std('#8a6a34', 0.35, null, { metalness: 0.7 }), LX, 1.785, LZ));
    scene.add(mesh(new THREE.CylinderGeometry(0.024, 0.03, 0.15, 14, 1, true), new THREE.MeshStandardMaterial({ color: '#ffe8c0', roughness: 0.05, transparent: true, opacity: 0.25, side: THREE.DoubleSide }), LX, 1.9, LZ, { cast: false }));
    { const f2 = mesh(new THREE.SphereGeometry(0.009, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffd08a' }), LX, 1.86, LZ, { cast: false }); f2.scale.y = 2.2; scene.add(f2); }
    doorLight = new THREE.PointLight('#ffb468', 1.2, 5, 1.6); doorLight.position.set(LX - 0.1, 1.95, LZ); scene.add(doorLight);
    // coats on pegs by the door, boots on the floor
    for (const [z, c] of [[-1.55, '#2e3a2c'], [-1.0, '#5a4030']]) { const coat = mesh(new THREE.LatheGeometry([[0.0, 0], [0.24, 0.02], [0.22, 0.55], [0.15, 0.95], [0.05, 1.02]].map(([a, b]) => new THREE.Vector2(a, b)), 14), std(c, 0.9, T.fine), IN.x1 - 0.18, 0.75, z); coat.scale.set(0.6, 1, 1); scene.add(coat); scene.add(mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.14, 6), wood, IN.x1 - 0.06, 1.8, z, { rz: Math.PI / 2 })); }
    for (const z of [-2.55, -2.35]) scene.add(mesh(box(0.11, 0.24, 0.28), std('#2a211b', 0.6), 3.7 + (z + 2.45) * 0.4, 0.12, z + 0.5));
    // the rug, your armchair (leather, a plaid blanket over the arm), the side table with an oil lamp and a book
    scene.add(slab(-0.9, 0, -1.85, 1.75, 0.014, 0.95, std('#ffffff', 0.95, T.rug), { cast: false }));
    const lea = std('#ffffff', 0.62, T.leather), C = [0.2, 0, 1.45];
    scene.add(slab(C[0] - 0.42, 0.22, C[2] - 0.4, C[0] + 0.42, 0.46, C[2] + 0.38, lea));
    scene.add(slab(C[0] - 0.42, 0.22, C[2] + 0.3, C[0] + 0.42, 1.12, C[2] + 0.5, lea));
    for (const s of [-1, 1]) { scene.add(slab(C[0] + s * 0.42 - 0.08, 0.22, C[2] - 0.4, C[0] + s * 0.42 + 0.08, 0.62, C[2] + 0.42, lea)); scene.add(mesh(new THREE.CapsuleGeometry(0.085, 0.74, 4, 10), lea, C[0] + s * 0.42, 0.63, C[2] + 0.01, { rx: Math.PI / 2 })); }
    for (const [x, z] of [[-0.3, 1.1], [0.7, 1.1], [-0.3, 1.9], [0.7, 1.9]]) scene.add(mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.22, 8), dark, x, 0.11, z));
    { const bl = mesh(new THREE.BoxGeometry(0.3, 0.05, 0.7, 4, 1, 6), std('#ffffff', 0.95, T.tartan), C[0] - 0.42, 0.72, C[2] - 0.02); bl.rotation.z = 0.15; scene.add(bl); }
    scene.add(mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.035, 24), wood, -0.62, 0.6, 1.05)); scene.add(mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.6, 8), dark, -0.62, 0.3, 1.05));
    scene.add(mesh(box(0.16, 0.035, 0.22), std('#3b4a5e', 0.7), -0.55, 0.635, 1.12, { ry: 0.4 }));
    const lamp = new THREE.Group(); lamp.position.set(-0.68, 0.618, 0.98); scene.add(lamp);
    lamp.add(mesh(new THREE.CylinderGeometry(0.06, 0.075, 0.1, 16), std('#8a6a34', 0.35, null, { metalness: 0.7 }), 0, 0.05, 0));
    lamp.add(mesh(new THREE.SphereGeometry(0.045, 16, 10), new THREE.MeshStandardMaterial({ color: '#ffe2b0', roughness: 0.1, transparent: true, opacity: 0.35, emissive: '#ffb060', emissiveIntensity: 0.6 }), 0, 0.18, 0, { cast: false }));
    lamp.add(mesh(new THREE.CylinderGeometry(0.028, 0.035, 0.16, 16, 1, true), new THREE.MeshStandardMaterial({ color: '#ffe8c0', roughness: 0.05, transparent: true, opacity: 0.25, side: THREE.DoubleSide }), 0, 0.28, 0, { cast: false }));
    lampFlame = mesh(new THREE.SphereGeometry(0.011, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffd08a' }), 0, 0.19, 0, { cast: false }); lampFlame.scale.set(1, 2.2, 1); lamp.add(lampFlame);
    lampLight = new THREE.PointLight('#ffb468', 1.3, 6, 1.6); lampLight.position.set(-0.68, 0.84, 0.98); scene.add(lampLight);
    // a bookshelf on the east wall, half in the dark
    scene.add(slab(IN.x0, 0, -1.2, IN.x0 + 0.32, 2.0, 0.4, wood));
    for (let s = 0; s < 4; s++) for (let b = 0; b < 12; b++) { const h = R(0.22, 0.32); scene.add(mesh(box(0.22, h, R(0.035, 0.07)), std(['#6b2a22', '#2c3e50', '#556b2f', '#7a5b2a', '#3d2b4f'][(s * 5 + b) % 5], 0.8), IN.x0 + 0.17, 0.12 + s * 0.48 + h / 2, -1.12 + b * 0.12, { cast: false })); }
  }

  /* ------------------------------ the fire (spec §6: 7 cards + 5 licks, charred logs with glowing cracks, coals, embers) ------------------------------ */
  const FIRE = new THREE.Vector3(0.4, 0.14, -2.74);
  const FLAME_FS = `
    uniform float uT; uniform float uSeed; uniform float uBright; uniform float uLick; varying vec2 vUv;
    ${NOISE}
    vec3 ramp(float k){
      vec3 c0 = vec3(0.30, 0.03, 0.0), c1 = vec3(0.95, 0.26, 0.03), c2 = vec3(1.0, 0.55, 0.12), c3 = vec3(1.0, 0.80, 0.42), c4 = vec3(1.0, 0.93, 0.74);
      return k < 0.25 ? mix(c0, c1, k / 0.25) : k < 0.5 ? mix(c1, c2, (k - 0.25) / 0.25) : k < 0.75 ? mix(c2, c3, (k - 0.5) / 0.25) : mix(c3, c4, clamp((k - 0.75) / 0.25, 0.0, 1.0));
    }
    void main(){
      vec2 uv = vUv; float y = uv.y;
      float n = fbm(vec3(uv.x * 2.6 + uSeed, y * 2.0 - uT * 1.7, uT * 0.3 + uSeed * 3.1));
      float n2 = fbm(vec3(uv.x * 6.0 - uSeed, y * 4.6 - uT * 3.0, uSeed * 1.7 + uT * 0.5));
      float x = (uv.x - 0.5) + (n - 0.5) * 0.5 * y + (n2 - 0.5) * 0.14 * y + 0.05 * sin(uT * 2.3 + uSeed) * y * y;
      float w = mix(0.36, 0.22, uLick) * pow(max(1.0 - y, 0.0), 0.7) * (0.75 + 0.5 * n);
      float body = smoothstep(w, w * 0.25, abs(x));
      float top = smoothstep(1.0, 0.18 + 0.5 * n2, y + 0.3 * (n - 0.5));
      float dens = body * top * smoothstep(0.0, 0.07, y);
      float k = dens * (1.2 - 0.95 * y) * (1.0 - 1.4 * abs(x));
      vec3 col = ramp(clamp(k, 0.0, 1.0)) * dens * uBright;
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;
  function fire() {
    const T = textures();
    // grate, ash bed, coals, three charred logs
    scene.add(slab(0.06, 0.12, -2.92, 0.74, 0.135, -2.52, std('#3a3430', 1.0, T.soot)));
    coalMat = new THREE.MeshStandardMaterial({ color: '#1e1814', roughness: 1.0, emissive: '#ffffff', emissiveMap: T.embers, emissiveIntensity: 1.2 });
    for (let i = 0; i < 26; i++) { const m = mesh(new THREE.DodecahedronGeometry(R(0.025, 0.05), 0), coalMat, R(0.1, 0.7), 0.15, R(-2.9, -2.55), { cast: false }); m.scale.y = 0.6; m.rotation.set(R(0, 6), R(0, 6), 0); scene.add(m); }
    for (let i = 0; i < 40; i++) { const m = mesh(new THREE.SphereGeometry(R(0.01, 0.03), 6, 4), std(['#b8b2aa', '#8c8680', '#d2ccc4'][i % 3], 1.0), R(0.08, 0.72), 0.14, R(-2.92, -2.52), { cast: false }); m.scale.y = 0.4; scene.add(m); }
    logMat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: T.charred, roughness: 0.95, emissive: '#ffffff', emissiveMap: T.embers, emissiveIntensity: 0.9 });
    for (const [x, z, ry, rz, y] of [[0.4, -2.8, 0.15, 0.0, 0.2], [0.3, -2.66, -0.35, 0.06, 0.21], [0.5, -2.7, 0.55, -0.05, 0.3]]) {
      const lg = mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.7, 12, 3), logMat, x, y, z, { rz: Math.PI / 2 + rz, cast: false }); lg.rotation.y = ry; scene.add(lg);
    }
    // the flames: billboard cards that face you, flowing noise, a hot base and soft ragged tongues
    const specs = [];
    for (let i = 0; i < 7; i++) specs.push({ x: R(-0.24, 0.24), z: R(-0.12, 0.08), w: R(0.22, 0.34), h: R(0.36, 0.56), lick: 0, b: R(0.85, 1.15) });
    for (let i = 0; i < 5; i++) specs.push({ x: R(-0.28, 0.28), z: R(-0.1, 0.1), w: R(0.09, 0.14), h: R(0.2, 0.34), lick: 1, b: R(0.7, 1.0) });
    specs.forEach((sp, i) => {
      const mat = new THREE.ShaderMaterial({
        uniforms: { uT: { value: 0 }, uSeed: { value: i * 7.13 + 1.1 }, uBright: { value: 1 }, uLick: { value: sp.lick } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: FLAME_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      });
      const geo = new THREE.PlaneGeometry(sp.w, sp.h); geo.translate(0, sp.h / 2, 0);
      const m = new THREE.Mesh(geo, mat); m.position.set(FIRE.x + sp.x, FIRE.y + 0.04, FIRE.z + sp.z); m.renderOrder = 20; m.userData.b = sp.b;
      scene.add(m); fireCards.push(m); fireMats.push(mat);
    });
    // embers drifting up
    const N = 60, P = new Float32Array(N * 3), S = new Float32Array(N);
    for (let i = 0; i < N; i++) { P[i * 3] = R(-0.25, 0.25); P[i * 3 + 1] = 0; P[i * 3 + 2] = R(-0.1, 0.1); S[i] = rnd(); }
    const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(P, 3)); eg.setAttribute('aS', new THREE.BufferAttribute(S, 1));
    emberMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uT: { value: 0 }, uScale: { value: 1 } },
      vertexShader: `uniform float uT; uniform float uScale; attribute float aS; varying float vA;
        void main(){
          float life = 1.6 + 1.4 * aS, ph = fract(uT / life + aS * 7.3), y = ph * (0.55 + 0.4 * aS);
          vec3 p = position + vec3(0.06 * sin(uT * 3.0 + aS * 40.0) * ph, y, 0.04 * cos(uT * 2.3 + aS * 21.0) * ph);
          vA = (1.0 - ph) * step(0.55, fract(aS * 13.7)) * (0.6 + 0.4 * sin(uT * 30.0 + aS * 90.0));
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = max(1.5, uScale / -mv.z); gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `varying float vA; void main(){ vec2 q = gl_PointCoord - 0.5; float a = exp(-dot(q, q) * 18.0); gl_FragColor = vec4(vec3(1.0, 0.55, 0.15) * a * vA * 1.6, 1.0);
        #include <colorspace_fragment>
      }`,
    });
    const ep = new THREE.Points(eg, emberMat); ep.position.copy(FIRE).add(new THREE.Vector3(0, 0.12, 0)); ep.frustumCulled = false; ep.renderOrder = 21; scene.add(ep);
    // a warm glow inside the firebox
    const gm = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uB: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uB; varying vec2 vUv; void main(){ vec2 q = vUv - vec2(0.5, 0.2); float a = exp(-dot(q * vec2(1.4, 1.0), q * vec2(1.4, 1.0)) * 9.0); gl_FragColor = vec4(vec3(1.0, 0.42, 0.1) * a * 0.22 * uB, 1.0);
        #include <colorspace_fragment>
      }` });
    glowMats.push(gm);
    const gl2 = mesh(new THREE.PlaneGeometry(0.8, 0.75), gm, 0.4, 0.48, -2.93, { cast: false, recv: false }); gl2.renderOrder = 19; scene.add(gl2);
    // the fire's light: a key that throws shadows into the room, a fill, and a low warm light inside the firebox
    fireKey = new THREE.SpotLight('#ff9a4a', 9, 14, 1.3, 0.85, 1.5); fireKey.position.set(0.4, 0.42, -2.5); fireKey.target.position.set(0.3, 0.6, 2.0);
    fireKey.castShadow = true; fireKey.shadow.mapSize.set(1024, 1024); fireKey.shadow.bias = -0.0015; fireKey.shadow.radius = 4; fireKey.shadow.camera.near = 0.1; fireKey.shadow.camera.far = 12;
    scene.add(fireKey, fireKey.target);
    fireFill = new THREE.PointLight('#ff8c40', 2.2, 7, 1.6); fireFill.position.set(0.4, 0.6, -2.1); scene.add(fireFill);
    fireLow = new THREE.PointLight('#ff7a30', 1.6, 1.6, 1.4); fireLow.position.set(0.4, 0.32, -2.7); scene.add(fireLow);
  }

  /* ------------------------------ the light through the window: a faint shaft of dust, the panes in it ------------------------------ */
  function shaft() {
    shaftMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uNova: { value: 0 }, uT: { value: 0 } },
      vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }',
      fragmentShader: `uniform float uNova; uniform float uT; varying vec2 vUv; varying vec3 vW;
        ${NOISE}
        void main(){
          if (vW.y < 0.0 || vW.z < -2.98 || vW.y > 2.68) discard;
          vec2 p = vUv * vec2(1.3, 1.5);                                   // window coordinates (m)
          float pane = step(0.04, p.x) * step(p.x, 1.26) * step(0.06, p.y) * step(p.y, 1.44);
          pane *= 1.0 - step(abs(p.x - 0.65), 0.02); pane *= 1.0 - step(abs(p.y - 0.5), 0.018); pane *= 1.0 - step(abs(p.y - 1.0), 0.018);
          float dust = 0.55 + 0.45 * fbm(vec3(vW * 6.0 + vec3(0.0, uT * 0.05, uT * 0.03)));
          gl_FragColor = vec4(vec3(0.55, 0.68, 1.0) * pane * dust * 0.016 * uNova, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    // slices of the beam: the window's rectangle carried along the light's path
    const L = SDIR.clone().negate();
    for (let i = 0; i < 14; i++) {
      const d = 0.15 + i * 0.27, m = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.5), shaftMat);
      m.position.set(2.25, 1.55, -3.1).addScaledVector(L, d); m.renderOrder = 15; m.frustumCulled = false; scene.add(m);
    }
  }

  /* ------------------------------ people: you and your friend (men; cable-knit sweaters, beanies, beards, dark glasses: no eyes anywhere) ------------------------------ */
  const SKIN = '#b48466', KNIT_GLOVE = '#b5a283';
  function limb(mat, rA, rB) { const g2 = new THREE.CylinderGeometry(rB, rA, 1, 12, 1); g2.translate(0, 0.5, 0); const m = new THREE.Mesh(g2, mat); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; scene.add(m); return m; }
  function setLimb(m, A, B) { const d = B.clone().sub(A); m.position.copy(A); m.scale.set(1, d.length(), 1); m.quaternion.setFromUnitVectors(UPY, d.normalize()); }
  // a hand in a fingerless knit glove; local -z runs along the fingers, curl bends them toward -y (the palm side)
  function hand(curl) {
    const T = textures(), grp = new THREE.Group(), glove = std(KNIT_GLOVE, 0.95, T.fine), skin = std(SKIN, 0.6), fingers = [];
    grp.add(mesh(new THREE.BoxGeometry(0.084, 0.03, 0.094, 2, 1, 2), glove, 0, 0, 0, { cast: false }));
    { const m = mesh(new THREE.SphereGeometry(0.045, 10, 6), glove, 0, 0.004, 0.012, { cast: false }); m.scale.set(1, 0.42, 1.1); grp.add(m); }
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Group(); f.position.set(-0.032 + i * 0.021, 0, -0.046); grp.add(f);
      f.add(mesh(new THREE.CapsuleGeometry(0.0094, 0.03, 3, 8), glove, 0, 0, -0.018, { rx: Math.PI / 2, cast: false }));
      const mid = new THREE.Group(); mid.position.z = -0.036; f.add(mid);
      mid.add(mesh(new THREE.CapsuleGeometry(0.0086, 0.022 - Math.abs(i - 1.5) * 0.004, 3, 8), skin, 0, 0, -0.014, { rx: Math.PI / 2, cast: false }));
      const tip = new THREE.Group(); tip.position.z = -0.03; mid.add(tip);
      tip.add(mesh(new THREE.CapsuleGeometry(0.008, 0.016, 3, 8), skin, 0, 0, -0.01, { rx: Math.PI / 2, cast: false }));
      fingers.push({ f, mid, tip });
    }
    const th = new THREE.Group(); th.position.set(0.046, -0.004, -0.004); th.rotation.y = -0.75; grp.add(th);
    th.add(mesh(new THREE.CapsuleGeometry(0.0105, 0.03, 3, 8), glove, 0, 0, -0.016, { rx: Math.PI / 2, cast: false }));
    th.add(mesh(new THREE.CapsuleGeometry(0.0095, 0.018, 3, 8), skin, 0, 0, -0.042, { rx: Math.PI / 2, cast: false }));
    grp.add(mesh(new THREE.CylinderGeometry(0.044, 0.048, 0.09, 12), std(KNIT_GLOVE, 0.95, T.knit), 0, 0, 0.075, { rx: Math.PI / 2, cast: false }));   // the glove's cuff
    grp.userData.fingers = fingers; grp.userData.thumb = th; setCurl(grp, curl); return grp;
  }
  function setCurl(h, curl, spread = 0) { h.userData.fingers.forEach(({ f, mid, tip }, i) => { const c = curl * (0.9 + 0.08 * i); f.rotation.x = -c * 0.8; mid.rotation.x = -c * 1.0; tip.rotation.x = -c * 0.7; f.rotation.y = (i - 1.5) * 0.06 * spread; }); }
  function man(o) {
    const T = textures(), grp = new THREE.Group(), sw = std(o.sweater, 0.95, T.knit), trous = std(o.trousers, 0.9, T.fine), knit = std(o.cap, 1.0, T.knit), skin = std(SKIN, 0.62);
    for (const s of [-1, 1]) { grp.add(mesh(new THREE.CapsuleGeometry(0.075, 0.72, 4, 10), trous, s * 0.105, 0.5, 0)); grp.add(mesh(box(0.115, 0.1, 0.28), std('#231b15', 0.6), s * 0.105, 0.05, -0.05)); }
    const prof = [[0.0, 0.0], [0.19, 0.0], [0.215, 0.06], [0.235, 0.3], [0.245, 0.5], [0.24, 0.6], [0.2, 0.68], [0.12, 0.72], [0.0, 0.73]].map(([r, y]) => new THREE.Vector2(r, y));
    const body = mesh(new THREE.LatheGeometry(prof, 28), sw, 0, 0.84, 0); body.scale.set(1.08, 1, 0.74); grp.add(body);
    grp.add(mesh(new THREE.TorusGeometry(0.2, 0.045, 8, 24), sw, 0, 0.88, 0, { rx: Math.PI / 2 }));                   // ribbed hem
    grp.add(mesh(new THREE.CylinderGeometry(0.075, 0.095, 0.12, 16), sw, 0, 1.6, 0));                                 // roll neck
    for (const s of [-1, 1]) grp.add(mesh(new THREE.SphereGeometry(0.09, 14, 10), sw, s * 0.21, 1.49, 0));
    // the head on a neck pivot: skin, a full dark beard, a knit beanie, dark round glasses (opaque: no eyes)
    const head = new THREE.Group(); head.position.set(0, 1.64, 0); grp.add(head); grp.userData.head = head;
    { const m = mesh(new THREE.SphereGeometry(0.1, 20, 16), skin, 0, 0.14, -0.005); m.scale.set(0.92, 1.12, 1.0); head.add(m); }
    { const m = mesh(new THREE.SphereGeometry(0.104, 20, 12, Math.PI * 0.75, Math.PI * 1.5, Math.PI * 0.5, Math.PI * 0.5), std(o.beard, 1.0, T.fine), 0, 0.135, -0.005); m.scale.set(0.95, 1.18, 1.04); head.add(m); }
    { const m = mesh(new THREE.SphereGeometry(0.06, 14, 10), std(o.beard, 1.0, T.fine), 0, 0.04, -0.05); m.scale.set(1.15, 0.9, 0.95); head.add(m); }
    { const m = mesh(new THREE.TorusGeometry(0.032, 0.009, 6, 14, Math.PI), std(o.beard, 1.0), 0, 0.1, -0.1, { rz: Math.PI }); m.scale.set(1.1, 0.6, 1); head.add(m); }
    { const m = mesh(new THREE.SphereGeometry(0.019, 10, 8), skin, 0, 0.135, -0.105); m.scale.set(0.8, 1.2, 1.1); head.add(m); }
    for (const s of [-1, 1]) { const m = mesh(new THREE.SphereGeometry(0.022, 8, 6), skin, s * 0.092, 0.14, 0.005); m.scale.set(0.5, 1, 0.8); head.add(m); }
    head.add(mesh(new THREE.SphereGeometry(0.108, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), knit, 0, 0.19, 0));
    head.add(mesh(new THREE.TorusGeometry(0.104, 0.022, 8, 24), knit, 0, 0.2, 0, { rx: Math.PI / 2 }));
    const lens = new THREE.MeshStandardMaterial({ color: '#140d09', roughness: 0.15, metalness: 0.3, emissive: '#ffffff', emissiveMap: T.lens, emissiveIntensity: 0.9 });
    const rim = std('#2a1a10', 0.4);
    for (const s of [-1, 1]) {
      head.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.006, 18), lens, s * 0.037, 0.168, -0.113, { rx: Math.PI / 2 + 0.06, cast: false }));
      head.add(mesh(new THREE.TorusGeometry(0.031, 0.0045, 6, 18), rim, s * 0.037, 0.168, -0.112, { rx: 0.06, cast: false }));
      head.add(mesh(box(0.004, 0.006, 0.11), rim, s * 0.07, 0.172, -0.058, { cast: false }));
    }
    head.add(mesh(box(0.016, 0.005, 0.005), rim, 0, 0.175, -0.116, { cast: false }));
    grp.userData.shoulders = [new THREE.Vector3(-0.225, 1.48, 0.0), new THREE.Vector3(0.225, 1.48, 0.0)];
    grp.userData.arms = [0, 1].map(() => ({ up: limb(sw, 0.068, 0.06), fore: limb(sw, 0.058, 0.048), elbow: (() => { const m = mesh(new THREE.SphereGeometry(0.06, 10, 8), sw); scene.add(m); return m; })() }));
    return grp;
  }
  function poseArm(P, i, S, E, Wr) { const a = P.userData.arms[i]; setLimb(a.up, S, E); setLimb(a.fore, E, Wr); a.elbow.position.copy(E); }
  function setPersonVisible(P, v) { P.visible = v; P.userData.arms.forEach((a) => { a.up.visible = a.fore.visible = a.elbow.visible = v; }); }
  function ik(S, Wp, L1, L2, hint) {
    const d = Wp.clone().sub(S), dl = Math.min(d.length(), L1 + L2 - 1e-4), u = d.clone().normalize();
    const a = (L1 * L1 - L2 * L2 + dl * dl) / (2 * dl), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    const b = hint.clone().addScaledVector(u, -hint.dot(u)).normalize();
    return S.clone().addScaledVector(u, a).addScaledVector(b, h);
  }
  function mugMesh(color) {
    const grp = new THREE.Group(), cer = std(color, 0.35);
    grp.add(mesh(new THREE.CylinderGeometry(0.043, 0.039, 0.1, 24, 1, true), new THREE.MeshStandardMaterial({ color, roughness: 0.35, side: THREE.DoubleSide }), 0, 0.05, 0, { cast: true }));
    grp.add(mesh(new THREE.CylinderGeometry(0.039, 0.039, 0.006, 24), cer, 0, 0.003, 0));
    grp.add(mesh(new THREE.TorusGeometry(0.043, 0.004, 6, 24), cer, 0, 0.1, 0, { rx: Math.PI / 2, cast: false }));
    grp.add(mesh(new THREE.CircleGeometry(0.04, 24), std('#3a1c0a', 0.2), 0, 0.082, 0, { rx: -Math.PI / 2, cast: false }));            // tea
    grp.add(mesh(new THREE.TorusGeometry(0.026, 0.0075, 8, 16, Math.PI * 1.2), cer, 0.05, 0.05, 0, { rz: -Math.PI * 0.6, cast: false }));   // handle (+x)
    return grp;
  }
  function people() {
    friend = man({ sweater: '#c9b28c', trousers: '#3b3128', cap: '#9c4a2a', beard: '#2b1e16' }); scene.add(friend);
    friendHands = [hand(0.9), hand(0.85)]; friendHands[1].scale.x = -1; friendHands.forEach((h) => scene.add(h));
    friendMug = mugMesh('#5b6b7a'); scene.add(friendMug);
    heroFig = man({ sweater: '#7a3a2e', trousers: '#2f2a26', cap: '#2e3a4a', beard: '#241a14' }); scene.add(heroFig);
    heroHands = [hand(0.9), hand(0.9)]; heroHands[1].scale.x = -1; heroHands.forEach((h) => scene.add(h));
    const sleeve = std('#7a3a2e', 0.95, textures().knit);
    for (let i = 0; i < 2; i++) { const fore = limb(sleeve, 0.052, 0.043), up = limb(sleeve, 0.062, 0.056), el = mesh(new THREE.SphereGeometry(0.054, 12, 8), sleeve); scene.add(el); povArms.push({ fore, up, el }); }
    povLegs = new THREE.Group(); scene.add(povLegs);
    for (const s of [-1, 1]) { povLegs.add(mesh(new THREE.CapsuleGeometry(0.075, 0.6, 4, 10), std('#2f2a26', 0.9, textures().fine), s * 0.12, -0.95, 0.06)); povLegs.add(mesh(box(0.12, 0.11, 0.3), std('#231b15', 0.6), s * 0.12, -1.6, -0.05)); }
    heroMug = mugMesh('#d8cbb0'); scene.add(heroMug);
    // steam over your tea: thin curling wisps, never round puffs
    steamMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uT: { value: 0 }, uA: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uT; uniform float uA; varying vec2 vUv;
        ${NOISE}
        void main(){
          float y = vUv.y, n = fbm(vec3(vUv.x * 3.0, y * 2.2 - uT * 0.55, uT * 0.2));
          float x = vUv.x - 0.5 + (n - 0.5) * 0.7 * y + 0.08 * sin(y * 9.0 - uT * 1.6) * y;
          float w = 0.05 + 0.12 * y;
          float s = smoothstep(w, 0.0, abs(x)) * smoothstep(0.0, 0.12, y) * (1.0 - smoothstep(0.45, 1.0, y)) * smoothstep(0.35, 0.65, fbm(vec3(vUv.x * 5.0, y * 6.0 - uT * 0.9, 3.0)));
          gl_FragColor = vec4(vec3(1.0, 0.92, 0.84), s * 0.32 * uA);
        }`,
    });
    steam = new THREE.Group(); scene.add(steam);
    for (const r of [0, 1.3]) { const p = mesh(new THREE.PlaneGeometry(0.12, 0.26), steamMat, 0, 0.21, 0, { ry: r, cast: false, recv: false }); p.renderOrder = 22; steam.add(p); }
  }

  /* ------------------------------ the chimney smoke (seen in the wide shot) ------------------------------ */
  function chimneySmoke() {
    smokeMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uT: { value: 0 }, uNova: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uT; uniform float uNova; varying vec2 vUv;
        ${NOISE}
        void main(){
          float y = vUv.y, n = fbm(vec3(vUv.x * 2.5, y * 3.0 - uT * 0.35, uT * 0.1));
          float x = vUv.x - 0.12 - 0.55 * y * y + (n - 0.5) * 0.35 * y;
          float w = 0.04 + 0.2 * y;
          float s = smoothstep(w, 0.0, abs(x)) * smoothstep(0.0, 0.05, y) * (1.0 - smoothstep(0.4, 1.0, y)) * (0.5 + 0.5 * fbm(vec3(vUv * 6.0, uT * 0.2)));
          vec3 c = mix(vec3(0.16, 0.16, 0.18), vec3(0.55, 0.62, 0.78), uNova);
          gl_FragColor = vec4(c, s * 0.55);
        }`,
    });
    smoke = mesh(new THREE.PlaneGeometry(4.5, 7), smokeMat, 0.4 + 1.6, 5.9 + 3.5, -3.58, { cast: false, recv: false }); smoke.renderOrder = 23; scene.add(smoke);
  }

  /* ------------------------------ build ------------------------------ */
  function init() {
    if (renderer) return;
    canvas = document.createElement('canvas'); canvas.width = W; canvas.height = HT;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1); renderer.setSize(W, HT, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0; renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene = new THREE.Scene(); fog = new THREE.Fog('#0b1424', 260, 5200); scene.fog = fog;
    camera = new THREE.PerspectiveCamera(70, W / HT, 0.03, 60000); camera.rotation.order = 'YXZ'; scene.add(camera);
    hemi = new THREE.HemisphereLight('#3a4a6e', '#1a1c24', 0.32); scene.add(hemi);
    starLight = new THREE.DirectionalLight('#d4e2ff', 0); starLight.castShadow = true; starLight.shadow.mapSize.set(2048, 2048);
    starLight.shadow.bias = -0.0006; starLight.shadow.normalBias = 0.02; starLight.shadow.radius = 2; scene.add(starLight, starLight.target);
    bakeSky(); makeDome(); ground(); trees(); cabin(); interior(); fire(); people(); chimneySmoke();
  }

  /* ------------------------------ per frame ------------------------------ */
  const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpM = new THREE.Matrix4();
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const quatBasis = (X, Y, Z) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
  // a hand placed at wrist-ish point P with palm normal Pn and fingers along F (world); right hands are mirrored
  function placeHand(h, P, Pn, F, right) {
    const Z = F.clone().negate().normalize(), Y = Pn.clone().negate(); Y.addScaledVector(Z, -Y.dot(Z)).normalize();
    const X = new THREE.Vector3().crossVectors(Y, Z);
    h.quaternion.copy(quatBasis(X, Y, Z)); h.position.copy(P);
  }
  let shadowMode = '';
  function setShadowBox(center, half, far) {
    starLight.position.copy(center).addScaledVector(SDIR, far * 0.5); starLight.target.position.copy(center); starLight.target.updateMatrixWorld();
    const c = starLight.shadow.camera; c.left = -half; c.right = half; c.top = half; c.bottom = -half; c.near = 0.5; c.far = far; c.updateProjectionMatrix();
  }
  function update(t) {
    const s = TL.sceneT(t), C = TL.cam(t), nova = TL.nova(s), inside = !C.wide && TL.inside(s);
    camera.position.set(C.x, C.y, C.z); camera.rotation.set(C.pitch, C.yaw, C.roll); camera.fov = C.fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    // the sky
    const U2 = skyMat.uniforms;
    U2.uPx.value = 2 * Math.tan(C.fov * D2R / 2) / HT; U2.uS.value = s; U2.uNova.value = nova;
    U2.uVisB.value = TL.visBright(s); U2.uVisF.value = TL.visFaint(s); U2.uVisMW.value = TL.visMW(s);
    // the star's light: shadows sized to where you are (the room, the slope, or the wide view)
    starLight.intensity = 2.3 * nova;
    const mode = C.wide ? 'wide' : inside ? 'in' : 'out';
    if (mode !== shadowMode) {
      shadowMode = mode;
      if (mode === 'in') setShadowBox(V3(1.6, 1.0, -1.0), 4.6, 40);
      else if (mode === 'out') setShadowBox(V3(9, 0, -18), 30, 160);
      else setShadowBox(V3(4, 0, -8), 18, 120);
    }
    fireKey.castShadow = inside;
    hemi.intensity = (inside ? 0.16 : 0.34) + 0.16 * nova; hemi.color.set('#34446a').lerp(new THREE.Color('#7d93c8'), 0.5 * nova);
    snowU.uNova.value = nova; snowU.uCamQ.value.set(Math.floor(C.x * 6), Math.floor(C.y * 6), Math.floor((C.yaw + C.pitch) * 40));
    // the fire: flicker on every light and flame, from one noise
    const fl = 0.82 + 0.12 * U.snoise(s * 7.1) + 0.07 * U.snoise(s * 17.3 + 4) + 0.04 * Math.sin(s * 31);
    fireKey.intensity = 9 * fl; fireFill.intensity = 2.2 * (0.9 + 0.1 * fl); fireLow.intensity = 1.6 * fl;
    fireKey.position.x = 0.4 + 0.03 * U.snoise(s * 5.3 + 9);
    logMat.emissiveIntensity = 0.75 + 0.35 * U.snoise(s * 2.1 + 3); coalMat.emissiveIntensity = 1.0 + 0.4 * U.snoise(s * 1.7 + 8);
    fireMats.forEach((m, i) => { m.uniforms.uT.value = s; m.uniforms.uBright.value = fireCards[i].userData.b * (0.85 + 0.2 * U.snoise(s * 3.3 + i * 5)); });
    fireCards.forEach((m) => { m.rotation.y = Math.atan2(C.x - m.position.x, C.z - m.position.z); });
    glowMats.forEach((m) => { m.uniforms.uB.value = fl; });
    emberMat.uniforms.uT.value = s; emberMat.uniforms.uScale.value = HT / (2 * Math.tan(C.fov * D2R / 2)) * 0.022;
    lampLight.intensity = 1.3 * (0.97 + 0.03 * Math.sin(s * 11)); lampFlame.scale.y = 2.2 + 0.2 * Math.sin(s * 9);
    smokeMat.uniforms.uT.value = s; smokeMat.uniforms.uNova.value = nova; smoke.rotation.y = Math.atan2(C.x - smoke.position.x, C.z - smoke.position.z);
    outWarm.intensity = 1.6; northWarm.intensity = C.wide ? 2.2 : 0;
    door.rotation.y = -TL.door(s);
    // fog: none to speak of indoors; a cold blue haze over the valley
    fog.color.set('#0a1322').lerp(new THREE.Color('#2a3a5c'), 0.6 * nova);

    // ---------- you ----------
    const bodyQ = new THREE.Quaternion().setFromAxisAngle(UPY, C.yaw);
    const bodyAt = (x, y, z) => V3(x, y, z).applyQuaternion(bodyQ).add(V3(C.x, C.y, C.z));
    const fwd = V3(0, 0, -1).applyQuaternion(bodyQ), right = V3(1, 0, 0).applyQuaternion(bodyQ), up = V3(0, 1, 0);
    const walkBob = TL.pos(s).moving * 0.01 * Math.sin(TL.pos(s).walked / 0.72 * Math.PI);
    const showPov = !C.wide;
    setPersonVisible(heroFig, C.wide); povLegs.visible = showPov; povArms.forEach((a) => { a.up.visible = false; a.fore.visible = a.el.visible = showPov; });
    povLegs.position.set(C.x, C.y, C.z); povLegs.quaternion.copy(bodyQ); if (s < 12.0) povLegs.visible = false;
    // the mug: in both hands, then carried to the sill
    const held = bodyAt(0.03, -0.3 + walkBob, -0.46), sill = V3(2.42, 0.8, -2.91), mk = TL.mugSet(s);
    let mugP = held.clone().lerp(sill, U.easeInOut(mk)); if (mk > 0 && mk < 1) mugP.y += 0.05 * Math.sin(Math.PI * mk);
    heroMug.position.copy(mugP); heroMug.quaternion.copy(new THREE.Quaternion().setFromAxisAngle(UPY, C.yaw + (mk > 0.5 ? 0.6 : 0)));
    heroMug.visible = !C.wide;
    steam.position.copy(mugP); steam.rotation.y = Math.atan2(C.x - mugP.x, C.z - mugP.z); steamMat.uniforms.uT.value = s; steamMat.uniforms.uA.value = 1 - U.smooth(26, 29, s);
    const hands = [0, 1].map((i) => {
      const sg = i ? 1 : -1, rightH = i === 1;
      let P, Pn, F, curl = 1.05;
      const mugSide = mugP.clone().add(right.clone().multiplyScalar(sg * 0.052)).add(V3(0, 0.035, 0));
      const restP = bodyAt(sg * 0.24, -0.78, -0.08), restN = right.clone().multiplyScalar(-sg), restF = V3(0, -1, 0).addScaledVector(fwd, 0.2);
      if (s < 22.7 || (rightH && s < 23.6)) {             // round the mug (the right hand carries it to the sill)
        P = mugSide.clone().addScaledVector(fwd, 0.035); Pn = right.clone().multiplyScalar(-sg); F = fwd.clone().addScaledVector(right, -sg * 0.35); curl = 1.05;
        if (!rightH) {                                    // your left hand lets go when the mug goes on the sill
          if (s > 22.4) { const k = U.smooth(22.4, 23.2, s); P = P.clone().lerp(restP, k); Pn = Pn.clone().lerp(restN, k).normalize(); F = F.clone().lerp(restF, k).normalize(); }
        } else if (s > 23.2) { const k = U.smooth(23.2, 23.6, s); P = P.clone().lerp(restP, k); Pn = Pn.clone().lerp(restN, k).normalize(); F = F.clone().lerp(restF, k).normalize(); curl = U.lerp(1.05, 0.5, k); }
      } else { P = restP; Pn = restN; F = restF; curl = 0.5; }
      if (rightH) {
        const dk = TL.doorTouch(s);
        if (dk > 0) {                                     // flat on the open door's inside face as you go past it
          door.updateMatrixWorld(true);
          const L = V3(-0.42, 1.12, 0.055).applyMatrix4(door.matrixWorld), dn = V3(0, 0, 1).transformDirection(door.matrixWorld);
          P = P.clone().lerp(L.addScaledVector(dn, 0.02), U.easeInOut(dk)); Pn = Pn.clone().lerp(dn.clone().negate(), dk).normalize(); F = F.clone().lerp(V3(0, 1, 0).addScaledVector(fwd, 0.5).normalize(), dk).normalize(); curl = U.lerp(curl, 0.15, dk);
        }
        const pk = TL.palm(s);
        if (pk > 0) { const pp = bodyAt(0.05, -0.22, -0.36); P = P.clone().lerp(pp, U.easeInOut(pk)); Pn = Pn.clone().lerp(V3(0, 1, 0), pk).normalize(); F = F.clone().lerp(fwd.clone().addScaledVector(right, -0.25), pk).normalize(); curl = U.lerp(curl, 0.35, pk); }
      }
      return { P, Pn, F, curl };
    });
    hands.forEach((hh, i) => {
      const h = heroHands[i], rightH = i === 1;
      h.visible = showPov;
      placeHand(h, hh.P, hh.Pn, hh.F, rightH); setCurl(h, hh.curl, 0.6); h.updateMatrixWorld(true);
      const Wr = h.localToWorld(V3(0, 0.004, 0.1)), sg = rightH ? 1 : -1;
      const S = bodyAt(sg * 0.19, -0.27, 0.04), E = ik(S, Wr, 0.31, 0.3, right.clone().multiplyScalar(sg * 0.8).add(V3(0, -0.7, 0)).addScaledVector(fwd, 0.15));
      setLimb(povArms[i].up, S, E); setLimb(povArms[i].fore, E, Wr); povArms[i].el.position.copy(E);
    });
    if (C.wide) {                                         // in the wide shot you are a figure in the snow
      heroFig.position.set(TL.OUT[0], GROUND, TL.OUT[2]); heroFig.rotation.y = -TL.BETEL.az * D2R; heroFig.userData.head.rotation.x = 0.35;
      heroFig.updateMatrixWorld(true);
      heroHands.forEach((h, i) => { const S = heroFig.localToWorld(heroFig.userData.shoulders[i].clone()), Wr = heroFig.localToWorld(V3(i ? 0.2 : -0.2, 0.92, -0.04)); h.visible = true; placeHand(h, Wr.clone().add(V3(0, -0.07, 0)), V3(i ? -1 : 1, 0, 0).applyQuaternion(heroFig.quaternion), V3(0, -1, 0), i === 1); h.updateMatrixWorld(true); poseArm(heroFig, i, S, ik(S, Wr, 0.31, 0.3, V3(0, -0.2, 0.6).applyQuaternion(heroFig.quaternion)), Wr); });
    }

    // ---------- your friend ----------
    const out = TL.friendOut(s) || C.wide;
    setPersonVisible(friend, !TL.friendGone(s) || C.wide); friendHands.forEach((h) => { h.visible = friend.visible; }); friendMug.visible = friend.visible;
    if (!out) {
      const F0 = TL.FRIEND_IN, turn = TL.friendTurn(s);
      friend.position.set(F0[0], 0, F0[2]); friend.rotation.y = 2.8 + 1.25 * U.easeInOut(U.smooth(8.45, 9.6, s));
      friend.userData.head.rotation.set(0.04 + 0.12 * turn, 1.2 * U.easeInOut(turn), 0);
    } else {
      const F1 = TL.FRIEND_OUT, pk = TL.point(s);
      friend.position.set(F1[0], F1[1], F1[2]); friend.rotation.y = -TL.BETEL.az * D2R + 0.05;
      friend.userData.head.rotation.set(0.42 + 0.1 * pk, 0.1, 0);
    }
    friend.updateMatrixWorld(true);
    const fq = friend.quaternion, fR = V3(1, 0, 0).applyQuaternion(fq), fF = V3(0, 0, -1).applyQuaternion(fq);
    // left arm (index 0): his mug at his chest indoors; relaxed outdoors
    {
      const S = friend.localToWorld(friend.userData.shoulders[0].clone());
      let Wr, Pn, F;
      if (!out) { Wr = friend.localToWorld(V3(-0.06, 1.18, -0.24)); friendMug.position.copy(Wr).add(V3(0, -0.06, 0)).addScaledVector(fR, 0.06); Pn = fR.clone(); F = fF.clone(); }
      else { Wr = friend.localToWorld(V3(-0.21, 0.9, -0.02)); friendMug.visible = false; Pn = fR.clone(); F = V3(0, -1, 0); }
      placeHand(friendHands[0], Wr.clone().addScaledVector(F, 0.07), Pn, F, false); setCurl(friendHands[0], out ? 0.5 : 1.05); friendHands[0].updateMatrixWorld(true);
      const Wj = friendHands[0].localToWorld(V3(0, 0.004, 0.1));
      poseArm(friend, 0, S, ik(S, Wj, 0.31, 0.3, fR.clone().multiplyScalar(-0.8).add(V3(0, -0.6, 0))), Wj);
    }
    // right arm (index 1): on the mantel, then down; outside, it rises and points exactly at the star
    {
      const S = friend.localToWorld(friend.userData.shoulders[1].clone());
      let Wr, Pn, F, curl = 0.4, point = 0;
      if (!out) {
        const off = U.smooth(8.4, 9.2, s), mantel = V3(1.32, 1.375, -2.42), rest = friend.localToWorld(V3(0.21, 0.9, -0.02));
        Wr = mantel.clone().lerp(rest, U.easeInOut(off)); Pn = V3(0, -1, 0).lerp(fR.clone().negate(), off).normalize(); F = V3(-0.3, 0, -1).normalize().lerp(V3(0, -1, 0), off).normalize(); curl = U.lerp(0.25, 0.5, off);
      } else {
        const pk = U.easeInOut(TL.point(s)), rest = friend.localToWorld(V3(0.21, 0.9, -0.02)), aim = S.clone().addScaledVector(SDIR, 0.6);
        Wr = rest.lerp(aim, pk); Pn = fR.clone().negate().lerp(V3(0, -1, 0).addScaledVector(SDIR, 0.2), pk).normalize(); F = V3(0, -1, 0).lerp(SDIR, pk).normalize(); curl = U.lerp(0.5, 1.15, pk); point = pk;
      }
      placeHand(friendHands[1], Wr.clone().addScaledVector(F, point > 0.5 ? 0.0 : 0.07), Pn, F, true); setCurl(friendHands[1], curl);
      if (point > 0.5) { const f = friendHands[1].userData.fingers[3]; f.f.rotation.x = f.mid.rotation.x = f.tip.rotation.x = 0; }   // the index finger, straight
      friendHands[1].updateMatrixWorld(true);
      const Wj = friendHands[1].localToWorld(V3(0, 0.004, 0.1));
      poseArm(friend, 1, S, point > 0.5 ? S.clone().addScaledVector(SDIR, 0.3).add(V3(0, -0.02, 0)) : ik(S, Wj, 0.31, 0.3, fR.clone().multiplyScalar(0.8).add(V3(0, -0.6, 0))), Wj);
    }
    friendMug.quaternion.copy(fq);
  }

  function prepare(t) { init(); update(t); }
  function draw() { renderer.render(scene, camera); return canvas; }
  function render(t) { prepare(t); return draw(); }
  const v3 = new THREE.Vector3();
  function project(x, y, z) { init(); v3.set(x, y, z).project(camera); return { x: (v3.x * 0.5 + 0.5) * W, y: (-v3.y * 0.5 + 0.5) * HT, d: camera.position.distanceTo(new THREE.Vector3(x, y, z)), vis: v3.z < 1 && v3.z > -1 }; }
  g.World = { init, prepare, draw, render, project };
})(window);

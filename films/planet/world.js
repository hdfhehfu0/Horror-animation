/* =========================================================================
   ROGUE PLANET (first person) — world.js
   three.js (r170, vendored). A rooftop at a harbour city's waterfront,
   the sea to the east. The sky follows the owner's approved recipe
   (.claude/skills/mad-space/references/space_look_spec.md): a deep
   midnight-blue dome; five star populations with random^9 brightness,
   gaussian cores and colour only in the bright few percent; a patchy density
   mask; a designed Milky Way (ivory-gold cloud, forked ragged dust lane, rose
   wisps, lavender-to-blue far end) -- baked once into cube textures, then
   gated per frame. The giant: a banded globe and C/B/A rings with the
   Cassini and Encke gaps, lit from one sun direction, with the ring shadow on
   the globe and the globe's shadow on the rings. The sea drains from the
   harbour and then surges in. World.render(t) is a pure function of t.
   ========================================================================= */
(function (g) {
  'use strict';
  const { U, TL, THREE } = g;
  const W = TL.W, HT = TL.H, D2R = Math.PI / 180;
  const rnd = U.mulberry32(20261125);
  const R = (a, b) => a + (b - a) * rnd();
  const dirAzEl = (az, el) => new THREE.Vector3(Math.sin(az * D2R) * Math.cos(el * D2R), Math.sin(el * D2R), -Math.cos(az * D2R) * Math.cos(el * D2R));

  let renderer, scene, camera, canvas, hemi, key, dusk, fog;
  let skyMat, globe, rings, globeMat, ringMat, moonMesh, seaMat, cubes = {};
  const uniformsCity = [], lampHeads = [], boats = [];
  let friend, friendArm, heroFig, handsGrp, flag;

  /* ------------------------------ helpers ------------------------------ */
  const matCache = new Map();
  function lam(color) { if (!matCache.has(color)) matCache.set(color, new THREE.MeshLambertMaterial({ color })); return matCache.get(color); }
  function mesh(geo, mat, x = 0, y = 0, z = 0, o = {}) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
    if (o.rx) m.rotation.x = o.rx; if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz;
    m.castShadow = o.cast !== false; m.receiveShadow = o.recv !== false; return m;
  }
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  function slab(x0, y0, z0, x1, y1, z1, mat, o) { return mesh(box(x1 - x0, y1 - y0, z1 - z0), mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, o); }

  /* ------------------------------ shared GLSL: hashes and noise ------------------------------ */
  const NOISE = `
    float h1(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    vec3 h3(vec3 p){ return vec3(h1(p), h1(p + 17.31), h1(p + 41.77)); }
    float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(h1(i), h1(i + vec3(1,0,0)), f.x), mix(h1(i + vec3(0,1,0)), h1(i + vec3(1,1,0)), f.x), f.y),
                 mix(mix(h1(i + vec3(0,0,1)), h1(i + vec3(1,0,1)), f.x), mix(h1(i + vec3(0,1,1)), h1(i + vec3(1,1,1)), f.x), f.y), f.z); }
    float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * n3(p); p = p * 2.03 + 1.7; a *= 0.5; } return s; }
  `;

  /* ------------------------------ the sky, baked once (spec §3, §4) ------------------------------ */
  // star_layer(scale, keep, gain, rad_px, seed): Voronoi point stars in 3D, brightness random^9 x gain, gaussian cores,
  // colour from the temperature ramp only for the brightest few percent; uPx = radians per texel of the cube face.
  const BAKE_FS = `
    uniform float uPx; uniform float uLayer; uniform vec3 uMWa; uniform vec3 uMWb; uniform vec3 uMWc;
    uniform vec3 uHero1; uniform vec3 uHero2;
    varying vec3 vDir;
    ${NOISE}
    vec3 tempCol(float k){
      vec3 c[7]; c[0]=vec3(1.0,0.45,0.25); c[1]=vec3(1.0,0.62,0.32); c[2]=vec3(1.0,0.82,0.55); c[3]=vec3(1.0,0.92,0.80);
      c[4]=vec3(0.70,0.82,1.0); c[5]=vec3(0.55,0.68,1.0); c[6]=vec3(0.45,0.58,1.0);
      float x = clamp(k, 0.0, 0.9999) * 6.0; int i = int(floor(x)); return mix(c[i], c[min(i + 1, 6)], fract(x));
    }
    vec3 starLayer(vec3 d, float scale, float keep, float gain, float rad, float seed){
      vec3 p = d * scale, c0 = floor(p), f = p - c0, o = step(0.5, f) - 1.0, acc = vec3(0.0);
      for (int i = 0; i < 8; i++) {
        float fi = float(i); vec3 c = c0 + o + vec3(mod(fi, 2.0), mod(floor(fi / 2.0), 2.0), floor(fi / 4.0));
        vec3 hh = h3(c + seed);
        if (hh.x > keep) continue;
        vec3 sp = c + 0.5 + (h3(c + seed + 7.13) - 0.5) * 0.7;
        float ang = length(d - normalize(sp)), px = ang / uPx;
        float b = pow(hh.y, 9.0) * gain, gg = exp(-px * px / (2.0 * rad * rad));
        vec3 col = mix(vec3(1.0), tempCol(hh.z), smoothstep(0.80, 0.97, hh.y));
        acc += col * b * gg;
      }
      return acc;
    }
    // band coordinates: ll along the Milky Way (0 at the gold cloud), bb across it (radians)
    void band(vec3 d, out float ll, out float bb){
      vec3 n = normalize(cross(uMWa, uMWb)), u1 = normalize(uMWc - n * dot(uMWc, n)), u2 = cross(n, u1);
      bb = asin(clamp(dot(d, n), -1.0, 1.0)); ll = atan(dot(d, u2), dot(d, u1));
    }
    float gauss(float x, float s){ return exp(-x * x / (2.0 * s * s)); }
    vec3 spot(vec3 d, vec3 s, vec3 col, float core, float halo){
      float a = degrees(length(d - s));
      return col * (core * exp(-a * a / (2.0 * 0.15 * 0.15 * 0.25)) + halo * exp(-a * a / (2.0 * 0.9 * 0.9 * 0.25)));
    }
    void main(){
      vec3 d = normalize(vDir);
      float ll, bb; band(d, ll, bb);
      float inBand = gauss(bb, 0.16) * smoothstep(-1.6, -0.9, ll) * (1.0 - smoothstep(1.2, 1.9, ll));
      float patchM = smoothstep(0.32, 0.68, n3(d * 2.6) + 0.35 * inBand);
      vec3 col = vec3(0.0);
      if (uLayer < 0.5) {            // A: the bright population and the named stars
        col += starLayer(d, 70.0, 0.10, 6.5, 1.1, 0.0);
        col += spot(d, uHero1, vec3(0.66, 0.80, 1.0), 16.0, 0.38) + spot(d, uHero2, vec3(1.0, 0.62, 0.26), 13.0, 0.32);
      } else if (uLayer < 1.5) {     // B: medium, faint, very faint (patchy) and the star cloud inside the band
        col += starLayer(d, 190.0, 0.12, 2.8, 0.9, 31.0) * patchM;
        col += starLayer(d, 420.0, 0.14, 1.3, 0.85, 77.0) * patchM;
        col += starLayer(d, 640.0, 0.12, 0.9, 0.8, 151.0) * patchM;
        col += starLayer(d, 760.0, 0.30, 1.5, 0.8, 113.0) * inBand;
      } else {                        // C: the Milky Way's light (body, gold cloud, forked dust lane, rose wisps, far end)
        float body = gauss(bb, 0.12) * (0.45 + 0.55 * fbm(d * 3.0)) * (0.7 + 0.6 * fbm(d * 9.0 + 4.0));
        body *= smoothstep(-1.6, -0.8, ll) * (1.0 - smoothstep(1.1, 1.8, ll));
        float cloud = gauss(ll, 0.30) * gauss(bb, 0.10) * 4.2;
        float lum = body + cloud * (0.6 + 0.4 * fbm(d * 6.0));
        float f0 = 0.06, kk = 0.21, ragged = 0.6 * fbm(d * 14.0) + 0.4 * fbm(d * 40.0);
        float w = 0.018 + 0.012 * max(ll - f0, 0.0);
        float lane1 = ll < f0 ? gauss(bb - 0.01 * sin(ll * 9.0), w) : gauss(bb - kk * (ll - f0) * 0.6, w);
        float lane2 = ll < f0 ? 0.0 : gauss(bb + kk * (ll - f0) * 0.35, w * 0.8);
        float lanes = max(lane1, lane2) * smoothstep(-1.2, -0.3, ll) * (1.0 - smoothstep(0.9, 1.4, ll));
        lum *= 1.0 - 0.88 * lanes * (0.55 + 0.45 * ragged);
        float k = clamp((ll + 0.4) / 1.7, 0.0, 1.0);
        vec3 tone = k < 0.2 ? mix(vec3(1.0, 0.70, 0.36), vec3(1.0, 0.78, 0.46), k / 0.2)
                  : k < 0.45 ? mix(vec3(1.0, 0.78, 0.46), vec3(0.98, 0.90, 0.78), (k - 0.2) / 0.25)
                  : k < 0.7 ? mix(vec3(0.98, 0.90, 0.78), vec3(0.80, 0.70, 1.0), (k - 0.45) / 0.25)
                  : mix(vec3(0.80, 0.70, 1.0), vec3(0.45, 0.60, 1.0), (k - 0.7) / 0.3);
        col = tone * lum * 0.24;
        float rose = smoothstep(0.0, 0.08, bb) * gauss(bb - 0.14, 0.08) * gauss(ll - 0.1, 0.35) * (0.5 * fbm(d * 7.0) + 0.5 * fbm(d * 18.0 + 3.0));
        col += vec3(0.95, 0.36, 0.50) * 0.95 * rose * 0.24 * 1.6;
      }
      gl_FragColor = vec4(col, 1.0);
    }`;
  function bakeSky() {
    const P = TL.PLANET, mw = { a: dirAzEl(-58, 3), b: dirAzEl(38, 66), c: dirAzEl(-30, 26) };
    const bakeMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { uPx: { value: 0 }, uLayer: { value: 0 }, uMWa: { value: mw.a }, uMWb: { value: mw.b }, uMWc: { value: mw.c },
        uHero1: { value: dirAzEl(21, 32) }, uHero2: { value: dirAzEl(-36, 44) } },
      vertexShader: 'varying vec3 vDir;\nvoid main(){\n vDir = position;\n gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n}',
      fragmentShader: BAKE_FS,
    });
    const bs = new THREE.Scene(); bs.add(new THREE.Mesh(new THREE.SphereGeometry(10, 96, 48), bakeMat));
    for (const [name, layer, size] of [['A', 0, 1536], ['B', 1, 1536], ['C', 2, 512]]) {
      const rt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
      const cc = new THREE.CubeCamera(0.1, 100, rt);
      bakeMat.uniforms.uLayer.value = layer; bakeMat.uniforms.uPx.value = (Math.PI / 2) / size;
      cc.update(renderer, bs); cubes[name] = rt.texture;
    }
    bakeMat.dispose();
  }
  // the dome, every frame: base midnight blue, horizon lift, airglow, dusk, light pollution, then the gated layers
  function makeDome() {
    skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uA: { value: cubes.A }, uB: { value: cubes.B }, uC: { value: cubes.C }, uVisB: { value: 0 }, uVisF: { value: 0 }, uVisMW: { value: 0 },
        uDusk: { value: 1 }, uLP: { value: 1 }, uSun: { value: new THREE.Vector3() } },
      vertexShader: 'varying vec3 vDir;\nvoid main(){\n vDir = position;\n vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n gl_Position = p.xyww;\n}',
      fragmentShader: `uniform samplerCube uA; uniform samplerCube uB; uniform samplerCube uC; uniform float uVisB; uniform float uVisF; uniform float uVisMW;
        uniform float uDusk; uniform float uLP; uniform vec3 uSun; varying vec3 vDir;
        ${NOISE}
        void main(){
          vec3 d = normalize(vDir); float el = max(d.y, 0.0);
          vec3 col = mix(vec3(0.014, 0.021, 0.042), vec3(0.0030, 0.0050, 0.0140), pow(el, 0.6));
          col += vec3(0.008, 0.013, 0.012) * (1.0 - smoothstep(0.0, 0.18, el));
          col += vec3(0.004, 0.011, 0.006) * smoothstep(0.02, 0.08, el) * (1.0 - smoothstep(0.1, 0.26, el)) * (0.6 + 0.4 * n3(d * 6.0));
          // dusk: the sun just set behind you (west); a warm band over the west, a cooler blue lifting the east
          float toSun = max(dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(uSun.x, 0.0, uSun.z))), 0.0);
          vec3 duskC = mix(vec3(0.060, 0.085, 0.170), vec3(0.012, 0.024, 0.065), pow(el, 0.5)) + vec3(0.55, 0.22, 0.08) * pow(toSun, 3.0) * exp(-el * 9.0);
          col = mix(col, duskC, uDusk);
          // the city's glow: warm, low, behind you and to the sides
          float dome = pow(1.0 - el, 1.35) * smoothstep(-0.2, 0.6, d.z + 0.3 * abs(d.x));
          col += vec3(0.50, 0.29, 0.14) * 0.09 * dome * uLP;
          vec3 st = textureCube(uA, d).rgb * uVisB + textureCube(uB, d).rgb * uVisF;
          st *= (1.0 - 0.75 * uLP * dome) * smoothstep(0.0, 0.05, d.y);
          st = st / (1.0 + 0.35 * st);                            // glowing things keep their structure
          vec3 mw = textureCube(uC, d).rgb * uVisMW * smoothstep(0.0, 0.16, d.y) * (1.0 - 0.6 * uLP);
          col += st + mw;
          if (d.y < 0.0) col = mix(col, vec3(0.010, 0.016, 0.030), smoothstep(0.0, -0.05, d.y));
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    const s = new THREE.Mesh(new THREE.SphereGeometry(15000, 64, 32), skyMat); s.frustumCulled = false; s.renderOrder = -10; scene.add(s);
    return s;
  }

  /* ------------------------------ the giant (spec §5) ------------------------------ */
  const RING_GLSL = `
    float ringOp(float r){
      float c = smoothstep(1.24, 1.26, r) * (1.0 - smoothstep(1.52, 1.53, r)) * 0.16;
      float b = smoothstep(1.53, 1.56, r) * (1.0 - smoothstep(1.94, 1.95, r)) * (0.72 + 0.2 * smoothstep(1.6, 1.85, r));
      float a = smoothstep(2.03, 2.035, r) * (1.0 - smoothstep(2.26, 2.27, r)) * 0.55;
      float encke = 1.0 - 0.92 * (1.0 - smoothstep(0.0, 0.006, abs(r - 2.212)));
      float lets = 0.82 + 0.18 * sin(r * 480.0) * sin(r * 137.0);
      return (c + b + a * encke) * lets;
    }
    vec3 ringCol(float r){
      vec3 cc = vec3(0.50, 0.46, 0.40), bc = vec3(0.86, 0.78, 0.62), ac = vec3(0.74, 0.68, 0.56);
      return r < 1.53 ? cc : r < 1.95 ? mix(bc, bc * 1.05, smoothstep(1.6, 1.9, r)) : ac;
    }`;
  function makePlanet() {
    const P = TL.PLANET;
    const common = { uC: { value: new THREE.Vector3() }, uR: { value: 1 }, uAxis: { value: new THREE.Vector3(0, 1, 0) }, uL: { value: new THREE.Vector3() }, uExp: { value: 1.4 } };
    globeMat = new THREE.ShaderMaterial({
      fog: false, uniforms: { ...common },
      vertexShader: 'varying vec3 vW;\nvoid main(){\n vec4 w = modelMatrix * vec4(position, 1.0);\n vW = w.xyz;\n gl_Position = projectionMatrix * viewMatrix * w;\n}',
      fragmentShader: `uniform vec3 uC; uniform float uR; uniform vec3 uAxis; uniform vec3 uL; uniform float uExp; varying vec3 vW;
        ${NOISE}
        ${RING_GLSL}
        vec3 bandRamp(float y){
          vec3 c[13];
          c[0]=vec3(0.52,0.40,0.26); c[1]=vec3(0.66,0.53,0.36); c[2]=vec3(0.80,0.68,0.48); c[3]=vec3(0.90,0.80,0.60); c[4]=vec3(0.96,0.90,0.74);
          c[5]=vec3(0.84,0.70,0.48); c[6]=vec3(0.72,0.58,0.38); c[7]=vec3(0.88,0.78,0.58); c[8]=vec3(0.95,0.87,0.70); c[9]=vec3(0.78,0.64,0.44);
          c[10]=vec3(0.62,0.49,0.32); c[11]=vec3(0.82,0.70,0.50); c[12]=vec3(0.92,0.84,0.66);
          float x = clamp(y, 0.0, 0.9999) * 12.0; int i = int(floor(x)); return mix(c[i], c[min(i + 1, 12)], smoothstep(0.0, 1.0, fract(x)));
        }
        void main(){
          vec3 n = normalize(vW - uC), v = normalize(cameraPosition - vW);
          float lat = asin(clamp(dot(n, uAxis), -1.0, 1.0));
          vec3 e1 = normalize(cross(uAxis, vec3(0.0, 0.0, 1.0))), e2 = cross(uAxis, e1);
          float lon = atan(dot(n, e2), dot(n, e1));
          vec3 q = vec3(cos(lon) * 2.0, sin(lon) * 2.0, lat * 9.0);
          float y = lat / 1.5708 * 0.5 + 0.5 + 0.018 * (fbm(q * 1.5) - 0.5) + 0.006 * sin(lon * 9.0 + lat * 40.0);
          vec3 base = bandRamp(fract(y * 1.7 + 0.12));
          base *= 0.92 + 0.16 * fbm(vec3(lon * 6.0, lat * 60.0, 1.0));
          float belt = exp(-pow((lat + 0.42) / 0.05, 2.0)) * (0.6 + 0.4 * fbm(vec3(lon * 8.0, lat * 30.0, 3.0)));
          base = mix(base, vec3(0.44, 0.32, 0.66), 0.55 * belt);
          float ov = exp(-(pow((lon - 0.6) / 0.16, 2.0) + pow((lat + 0.47) / 0.045, 2.0)));
          base = mix(base, vec3(0.66, 0.50, 0.72), 0.7 * ov);
          float ndl = max(dot(n, uL), 0.0), ndv = max(dot(n, v), 0.0);
          float lit = pow(ndl, 0.85) * pow(ndv, 0.25);
          float sh = 1.0, den = dot(uL, uAxis);
          if (abs(den) > 1e-4) { float tt = -dot(vW - uC, uAxis) / den; if (tt > 0.0) { float r = length(vW + uL * tt - uC) / uR; sh = 1.0 - 0.95 * clamp(ringOp(r), 0.0, 1.0); } }
          vec3 col = base * lit * sh * uExp * 0.62 + vec3(0.010, 0.0066, 0.0062) * (1.0 - ndl);
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    ringMat = new THREE.ShaderMaterial({
      fog: false, transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { ...common },
      vertexShader: 'varying vec3 vW;\nvoid main(){\n vec4 w = modelMatrix * vec4(position, 1.0);\n vW = w.xyz;\n gl_Position = projectionMatrix * viewMatrix * w;\n}',
      fragmentShader: `uniform vec3 uC; uniform float uR; uniform vec3 uAxis; uniform vec3 uL; uniform float uExp; varying vec3 vW;
        ${RING_GLSL}
        void main(){
          float r = length(vW - uC) / uR, op = clamp(ringOp(r), 0.0, 1.0);
          if (op < 0.004) discard;
          vec3 oc = vW - uC; float b = dot(oc, uL), c = dot(oc, oc) - uR * uR, disc = b * b - c;
          float sh = (disc > 0.0 && -b - sqrt(disc) > 0.0) ? 0.08 : 1.0;          // the globe's shadow on the rings
          float side = abs(dot(uAxis, uL));
          vec3 col = ringCol(r) * (0.3 + 0.85 * side) * sh * uExp * 0.6;
          gl_FragColor = vec4(col, op);
          #include <colorspace_fragment>
        }`,
    });
    globe = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), globeMat); globe.frustumCulled = false; globe.renderOrder = -5;
    rings = new THREE.Mesh(new THREE.RingGeometry(P.ringIn, P.ringOut, 256, 1), ringMat); rings.frustumCulled = false; rings.renderOrder = -4;
    scene.add(globe, rings);
    // the real Moon, for scale
    moonMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.MeshBasicMaterial({ color: '#e9e6dc', fog: false }));
    const md = dirAzEl(TL.MOON.az, TL.MOON.el), MD = 12000; moonMesh.position.copy(md.multiplyScalar(MD)); moonMesh.scale.setScalar(MD * Math.tan(TL.MOON.radiusDeg * D2R)); moonMesh.renderOrder = -6;
    scene.add(moonMesh);
  }
  function placePlanet(s) {
    const P = TL.PLANET, el = TL.planetEl(s), DIST = 9000;
    const dir = dirAzEl(P.az, el), C = dir.clone().multiplyScalar(DIST).add(new THREE.Vector3(0, 0, 0)), Rr = DIST * Math.tan(P.radiusDeg * D2R);
    // the ring plane opens toward you (and toward the sun), its long axis tilted
    const a = P.open + el * D2R, axis = new THREE.Vector3(0, Math.cos(a), Math.sin(a)).applyAxisAngle(dir.clone().negate(), P.tilt).normalize();
    const L = dirAzEl(TL.SUN.az, TL.SUN.el).normalize();
    for (const m of [globeMat, ringMat]) { m.uniforms.uC.value.copy(C); m.uniforms.uR.value = Rr; m.uniforms.uAxis.value.copy(axis); m.uniforms.uL.value.copy(L); }
    globe.position.copy(C); globe.scale.setScalar(Rr);
    rings.position.copy(C); rings.scale.setScalar(Rr); rings.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis);
    return { dir, C, Rr };
  }

  /* ------------------------------ the sea: drains, then surges (vertex-displaced) ------------------------------ */
  function makeSea() {
    seaMat = new THREE.ShaderMaterial({
      fog: false,
      uniforms: { uT: { value: 0 }, uLevel: { value: 0 }, uFront: { value: -12000 }, uH: { value: 0 }, uPlanet: { value: new THREE.Vector3(0, 0, -1) }, uPR: { value: 0.15 },
        uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uGlow: { value: 1 } },
      vertexShader: `uniform float uT; uniform float uLevel; uniform float uFront; uniform float uH; varying vec3 vW; varying float vFoam;
        void main(){
          vec3 p = (modelMatrix * vec4(position, 1.0)).xyz;
          float near = 1.0 - smoothstep(-900.0, -300.0, -p.z * -1.0 + 0.0);
          float harb = smoothstep(-2600.0, -500.0, p.z);                 // the drawdown is deepest near the shore
          float dd = p.z - uFront;
          float wall = uH * (1.0 - smoothstep(-500.0, 40.0, dd));
          float crest = uH * 0.22 * exp(-pow((dd + 90.0) / 110.0, 2.0));
          float waves = 0.25 * sin(p.x * 0.05 + uT * 1.3) * sin(p.z * 0.043 - uT * 0.9) + 0.12 * sin(p.x * 0.17 - p.z * 0.11 + uT * 2.1);
          p.y = uLevel * harb + wall + crest + waves * (1.0 + uH * 0.02);
          vFoam = exp(-pow((dd + 60.0) / 85.0, 2.0)) * smoothstep(1.0, 12.0, uH);
          vW = p; gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `uniform float uT; uniform vec3 uPlanet; uniform float uPR; uniform vec3 uZen; uniform vec3 uHor; uniform float uGlow; varying vec3 vW; varying float vFoam;
        ${NOISE}
        void main(){
          vec3 n = normalize(cross(dFdx(vW), dFdy(vW))); if (n.y < 0.0) n = -n;
          n = normalize(n + vec3(n3(vW * 0.08 + uT * 0.3) - 0.5, 0.0, n3(vW * 0.08 + 9.0 - uT * 0.25) - 0.5) * 0.18);
          vec3 v = normalize(cameraPosition - vW), r = reflect(-v, n);
          float fr = 0.02 + 0.98 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
          vec3 sky = mix(uHor, uZen, pow(max(r.y, 0.0), 0.5));
          float pd = dot(r, uPlanet);
          vec3 glint = vec3(0.95, 0.85, 0.66) * (smoothstep(cos(uPR * 1.3), cos(uPR * 0.6), pd) * 0.55 + pow(max(pd, 0.0), 900.0) * 1.2) * uGlow;
          vec3 deep = vec3(0.006, 0.012, 0.022);
          vec3 col = mix(deep, sky, fr) + glint * (0.35 + fr);
          col = mix(col, vec3(0.75, 0.78, 0.8), clamp(vFoam * (0.6 + 0.4 * n3(vW * 0.05 + uT)), 0.0, 1.0));
          float fogK = 1.0 - exp(-length(vW - cameraPosition) / 9000.0);
          col = mix(col, uHor, fogK * 0.6);
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    const geo = new THREE.PlaneGeometry(16000, 12000, 260, 220); geo.rotateX(-Math.PI / 2); geo.translate(0, 0, -6060);
    const m = new THREE.Mesh(geo, seaMat); m.frustumCulled = false; scene.add(m);
    // the harbour floor, uncovered as the water goes out
    scene.add(slab(-900, -7.2, -1400, 900, -6.6, -60, lam('#4a4237'), { cast: false }));
    for (let i = 0; i < 80; i++) scene.add(mesh(new THREE.IcosahedronGeometry(R(0.6, 2.2), 0), lam(i % 2 ? '#3b352d' : '#5a5045'), R(-300, 300), -6.6, R(-500, -70), { cast: false }));
  }

  /* ------------------------------ the city, the waterfront and your roof ------------------------------ */
  const WIN = `
    float side = step(abs(vON.y), 0.5);
    vec2 gp = vec2(abs(vON.x) > 0.5 ? vOP.z : vOP.x, vOP.y);
    vec2 cs = vec2(3.3, 3.7); vec4 wr = vec4(0.24, 0.76, 0.26, 0.86);
    vec2 wid = floor(gp / cs); vec2 fc = fract(gp / cs);
    float win = side * step(wr.x, fc.x) * step(fc.x, wr.y) * step(wr.z, fc.y) * step(fc.y, wr.w) * step(4.5, vOP.y);
    float hh = fract(sin(dot(wid + vec2(floor(vOP.x * 0.031) * 7.0, floor(vOP.z * 0.031) * 13.0), vec2(12.9898, 78.233))) * 43758.5453);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.10, 0.12, 0.16), win);
    float off = step(uPower, fract(hh * 3.7));
    vec3 litC = vec3(0.95, 0.66, 0.34) * win * step(1.0 - uLit, hh) * (0.3 + 0.35 * fract(hh * 7.31)) * (1.0 - off);
  `;
  function cityMat() {
    const m = new THREE.MeshLambertMaterial({ vertexColors: true });
    const u = { uLit: { value: 0.3 }, uPower: { value: 1 } }; uniformsCity.push(u);
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aW;\nvarying vec3 vOP;\nvarying vec3 vON;')
        .replace('#include <fog_vertex>', '#include <fog_vertex>\nvOP = aW;\nvON = normal;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP;\nvarying vec3 vON;\nuniform float uLit;\nuniform float uPower;')
        .replace('#include <color_fragment>', '#include <color_fragment>\n' + WIN)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += litC;');
    };
    m.customProgramCacheKey = () => 'planet-city';
    return m;
  }
  function Builder() { this.p = []; this.n = []; this.c = []; this.w = []; }
  Builder.prototype.box = function (cx, y0, cz, w, h, d, color) {
    const geo = new THREE.BoxGeometry(w, h, d).toNonIndexed(), P = geo.attributes.position, N = geo.attributes.normal, col = new THREE.Color(color);
    for (let i = 0; i < P.count; i++) { const x = P.getX(i) + cx, y = P.getY(i) + y0 + h / 2, z = P.getZ(i) + cz; this.p.push(x, y, z); this.n.push(N.getX(i), N.getY(i), N.getZ(i)); this.c.push(col.r, col.g, col.b); this.w.push(x, y, z); }
  };
  Builder.prototype.geo = function () {
    const g2 = new THREE.BufferGeometry();
    g2.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g2.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g2.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3)); g2.setAttribute('aW', new THREE.Float32BufferAttribute(this.w, 3)); return g2;
  };
  const STONE = ['#bdb3a2', '#a9a49c', '#c8bfae', '#8f8b86', '#9c8f7e', '#b4aa98', '#7f848a', '#a69a88'];
  function city() {
    const b = new Builder();
    // your building: roof at y = 42 (x -15..15, z -5..25)
    b.box(0, 0, 10, 30, 42, 30, '#a39b8e');
    // the waterfront row either side, then blocks behind
    for (const s of [-1, 1]) for (let x = 22; x < 700; x += R(24, 40)) { const w = R(18, 30), h = R(22, 95); b.box(s * (x + w / 2), 0, R(-30, -10) + 22, w, h, R(26, 40), STONE[(rnd() * 8) | 0]); }
    for (let z = 45; z < 1400; z += R(40, 70)) for (let x = -900; x < 900; x += R(30, 55)) { if (Math.abs(x) < 25 && z < 60) continue; const h = R(20, 70) + (rnd() < 0.15 ? R(60, 160) : 0); b.box(x, 0, z, R(20, 34), h, R(22, 36), STONE[(rnd() * 8) | 0]); }
    const m = new THREE.Mesh(b.geo(), cityMat()); m.castShadow = m.receiveShadow = true; scene.add(m);
    // ground: streets and the promenade, the quay wall
    scene.add(slab(-1200, -0.2, -60, 1200, 0, 1600, lam('#3c3e42'), { cast: false }));
    scene.add(slab(-1200, -8, -62, 1200, 0, -60, lam('#6c675e'), { cast: false }));
    scene.add(slab(-1200, 0, -60, 1200, 0.6, -58.6, lam('#8a857b'), { cast: false }));   // the edge kerb
    // promenade lamps (their glow is added in 2D)
    for (let x = -600; x <= 600; x += 32) { scene.add(mesh(new THREE.CylinderGeometry(0.1, 0.14, 5, 6), lam('#2b2d30'), x, 2.5, -55, { cast: false })); const hd = new THREE.Vector3(x, 5.1, -55); lampHeads.push(hd); }
    // piers and moored boats
    for (const x of [-140, 60, 230]) { scene.add(slab(x - 3, -0.4, -260, x + 3, 0.6, -62, lam('#5b4a3a'), { cast: false })); for (let z = -250; z < -62; z += 12) for (const s of [-1, 1]) scene.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 9, 6), lam('#3a3027'), x + s * 2.8, -4.4, z, { cast: false })); }
    for (let i = 0; i < 14; i++) {
      const grp = new THREE.Group(), L = R(7, 16), hull = lam(['#e7e4dc', '#c8432f', '#2f4f6e', '#e9e2c8'][i % 4]);
      grp.add(mesh(box(L * 0.32, 1.2, L), hull, 0, 0.6, 0)); grp.add(mesh(box(L * 0.22, 1.0, L * 0.35), lam('#d8d4ca'), 0, 1.7, L * 0.1));
      const x = [-140, 60, 230][i % 3] + (i % 2 ? 7 : -7) + R(-1, 1), z = -90 - (i / 3 | 0) * 38 - R(0, 10);
      grp.position.set(x, 0, z); grp.rotation.y = R(-0.08, 0.08); scene.add(grp); boats.push({ grp, tilt: R(-0.4, 0.4), roll: R(-0.25, 0.25) });
    }
  }
  function roof() {
    const conc = lam('#8f8a82'), dark = lam('#4b4d51');
    // the parapet you stand at, and a short railing on it
    scene.add(slab(-15, 42, -5.35, 15, 43.05, -5.0, conc)); scene.add(slab(-15.35, 42, -5.35, -15, 43.05, 25, conc)); scene.add(slab(15, 42, -5.35, 15.35, 43.05, 25, conc));
    for (let x = -14.5; x <= 14.5; x += 1.5) scene.add(mesh(box(0.05, 0.5, 0.05), dark, x, 43.3, -5.18, { cast: false }));
    scene.add(slab(-14.6, 43.52, -5.22, 14.6, 43.58, -5.14, dark, { cast: false }));
    // a water tank on legs, units, vents, an antenna, a flag
    const tank = new THREE.Group(); tank.position.set(8, 42, 14);
    for (const [x, z] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) tank.add(mesh(box(0.25, 4, 0.25), dark, x, 2, z));
    tank.add(mesh(new THREE.CylinderGeometry(2.4, 2.4, 4.2, 18), lam('#7a5b3e'), 0, 6.1, 0)); tank.add(mesh(new THREE.ConeGeometry(2.6, 1.5, 18), lam('#5d4530'), 0, 8.95, 0));
    scene.add(tank);
    for (const [x, z] of [[-7, 4], [-3, 10], [3, 20], [-10, 16]]) scene.add(mesh(box(2.4, 1.6, 1.8), lam('#9da2a6'), x, 42.8, z));
    scene.add(mesh(new THREE.CylinderGeometry(0.06, 0.09, 9, 6), dark, -9, 46.5, 20, { cast: false }));
    scene.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, 6, 6), lam('#c9c6be'), 11.5, 45, -3.5, { cast: false }));
    const fg = new THREE.PlaneGeometry(1.8, 1.1, 12, 4); flag = mesh(fg, new THREE.MeshLambertMaterial({ color: '#2a5d8a', side: THREE.DoubleSide }), 12.4, 47.4, -3.5, { cast: false });
    flag.userData.base = Float32Array.from(fg.attributes.position.array); scene.add(flag);
    scene.add(slab(-15, 41.9, -5, 15, 42, 25, lam('#6d6a64'), { cast: false }));     // roof deck
  }

  /* ------------------------------ the two of you (men; coats, beanies, balaclavas, goggles; no eyes anywhere) ------------------------------ */
  const COAT = '#2f3a2e', TROUS = '#26292e', GLOVE = '#2a2c30';
  function person(coat) {
    const grp = new THREE.Group(), c = lam(coat), t = lam(TROUS), k = lam('#1c1d20');
    for (const s of [-1, 1]) grp.add(mesh(new THREE.CapsuleGeometry(0.09, 0.8, 4, 8), t, s * 0.12, 0.5, 0));
    grp.add(mesh(new THREE.CapsuleGeometry(0.24, 0.55, 4, 10), c, 0, 1.25, 0));                // quilted down coat
    for (const y of [1.05, 1.25, 1.45]) grp.add(mesh(new THREE.TorusGeometry(0.245, 0.012, 4, 16), lam('#252e24'), 0, y, 0, { rx: Math.PI / 2, cast: false }));
    grp.add(mesh(new THREE.SphereGeometry(0.13, 12, 10), k, 0, 1.72, 0));                       // balaclava
    grp.add(mesh(new THREE.SphereGeometry(0.135, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), lam('#7a2c22'), 0, 1.75, 0)); // beanie
    grp.add(mesh(box(0.2, 0.055, 0.06), lam('#3b3f8a'), 0, 1.72, -0.11, { cast: false }));     // goggles: mirrored blue-violet
    return grp;
  }
  function people() {
    friend = person(COAT); friend.position.set(-1.05, 42, -4.45); scene.add(friend);
    // his pointing arm: a sleeve and a gloved hand with the index finger out
    friendArm = new THREE.Group(); const sl = lam(COAT), gl = lam(GLOVE);
    friendArm.add(mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.62, 10), sl, 0, 0, -0.31, { rx: Math.PI / 2, cast: false }));
    friendArm.add(mesh(box(0.08, 0.05, 0.1), gl, 0, 0, -0.66, { cast: false }));
    friendArm.add(mesh(new THREE.CapsuleGeometry(0.012, 0.075, 3, 6), gl, 0.012, 0.01, -0.75, { rx: Math.PI / 2, cast: false }));   // index finger
    for (let i = 0; i < 3; i++) friendArm.add(mesh(new THREE.SphereGeometry(0.018, 6, 4), gl, -0.02 + i * 0.012, -0.012, -0.69, { cast: false }));
    scene.add(friendArm);
    heroFig = person('#3a3f4a'); heroFig.position.set(0, 42, -4.45); heroFig.visible = false; scene.add(heroFig);
    // your gloved hands resting on the parapet
    handsGrp = new THREE.Group(); const glv = lam(GLOVE), sleeve = lam('#3a3f4a');
    for (const s of [-1, 1]) {
      const h = new THREE.Group(); h.position.set(s * 0.24, 43.1, -5.12); h.rotation.y = -s * 0.25;
      h.add(mesh(box(0.09, 0.035, 0.11), glv, 0, 0, 0, { cast: false }));
      for (let i = 0; i < 4; i++) h.add(mesh(new THREE.CapsuleGeometry(0.01, 0.05, 3, 6), glv, -0.033 + i * 0.022, -0.012, -0.075, { rx: Math.PI / 2 + 0.5, cast: false }));
      h.add(mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.75, 10), sleeve, s * 0.04, -0.05, 0.38, { rx: Math.PI / 2 - 0.35, cast: false }));
      handsGrp.add(h);
    }
    scene.add(handsGrp);
  }

  /* ------------------------------ build ------------------------------ */
  function init() {
    if (renderer) return;
    canvas = document.createElement('canvas'); canvas.width = W; canvas.height = HT;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1); renderer.setSize(W, HT, false);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0; renderer.outputColorSpace = THREE.SRGBColorSpace;
    scene = new THREE.Scene(); fog = new THREE.Fog('#1a2236', 300, 5000); scene.fog = fog;
    camera = new THREE.PerspectiveCamera(70, W / HT, 0.05, 40000); camera.rotation.order = 'YXZ'; scene.add(camera);
    hemi = new THREE.HemisphereLight('#6a7aa8', '#2a2a30', 0.6); scene.add(hemi);
    key = new THREE.DirectionalLight('#f1e2c2', 1.0); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0005; key.shadow.normalBias = 0.03; Object.assign(key.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 400 });
    scene.add(key, key.target);
    dusk = new THREE.DirectionalLight('#ffb27a', 0.8); scene.add(dusk, dusk.target);
    bakeSky(); makeDome(); makePlanet(); makeSea(); city(); roof(); people();
  }

  /* ------------------------------ per frame ------------------------------ */
  const tmpC = new THREE.Color();
  function update(t) {
    const s = TL.sceneT(t), C = TL.cam(t), dk = TL.dusk(s), power = TL.power(s);
    camera.position.set(C.x, C.y, C.z); camera.rotation.set(C.pitch, C.yaw, C.roll); camera.fov = C.fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    const pl = placePlanet(s);
    // sky gating (spec §2): bright stars, then the faint populations, then the band
    const sun = dirAzEl(TL.SUN.az, TL.SUN.el);
    Object.assign(skyMat.uniforms, {}); skyMat.uniforms.uVisB.value = TL.visBright(s); skyMat.uniforms.uVisF.value = TL.visFaint(s); skyMat.uniforms.uVisMW.value = TL.visMW(s);
    skyMat.uniforms.uDusk.value = dk; skyMat.uniforms.uLP.value = TL.lightPollution(s); skyMat.uniforms.uSun.value.copy(sun);
    // light: the last of the dusk from behind you; then the planet's own reflected light from the east
    const rise = U.smooth(-6, 10, TL.planetEl(s));
    dusk.position.copy(sun).multiplyScalar(200).add(new THREE.Vector3(0, 60, 0)); dusk.target.position.set(0, 40, 0); dusk.intensity = 1.1 * dk;
    key.target.position.set(C.x, 40, C.z); key.position.copy(key.target.position).addScaledVector(pl.dir, 220); key.intensity = 1.5 * rise; key.color.set('#f2e3c4');
    hemi.color.set('#7f8fc0').lerp(tmpC.set('#a7a2c8'), dk * 0.3); hemi.groundColor.set('#2b2b31'); hemi.intensity = 0.32 + 0.45 * dk + 0.25 * rise;
    fog.color.set('#2a3550').lerp(tmpC.set('#0c1424'), 1 - dk);
    for (const u of uniformsCity) { u.uPower.value = power; u.uLit.value = 0.32; }
    // the sea
    const zen = new THREE.Color().setRGB(0.008, 0.013, 0.03).lerp(new THREE.Color(0.05, 0.08, 0.16), dk);
    const hor = new THREE.Color().setRGB(0.02, 0.035, 0.07).lerp(new THREE.Color(0.12, 0.13, 0.22), dk);
    Object.assign(seaMat.uniforms.uZen.value, zen); Object.assign(seaMat.uniforms.uHor.value, hor);
    seaMat.uniforms.uT.value = s; seaMat.uniforms.uLevel.value = TL.harbour(s); seaMat.uniforms.uFront.value = TL.surgeFront(s); seaMat.uniforms.uH.value = TL.surgeH(s);
    seaMat.uniforms.uPlanet.value.copy(pl.dir); seaMat.uniforms.uPR.value = TL.PLANET.radiusDeg * D2R; seaMat.uniforms.uGlow.value = rise;
    // boats settle on the mud as the harbour drains
    const dr = U.clamp(-TL.harbour(s) / 5.5);
    for (const B of boats) { B.grp.position.y = Math.max(TL.harbour(s), -6.0) + 0.1 * Math.sin(s * 1.3 + B.tilt * 9) * (1 - dr); B.grp.rotation.x = B.tilt * dr * 0.35; B.grp.rotation.z = B.roll * dr; }
    // the flag
    const P = flag.geometry.attributes.position, b0 = flag.userData.base, wind = 1 + 2 * TL.shake(s);
    for (let i = 0; i < P.count; i++) { const x = b0[i * 3], y = b0[i * 3 + 1], k = (x + 0.9) / 1.8; P.setZ(i, Math.sin(x * 4 - s * 6 * wind + y) * 0.12 * k * wind); }
    P.needsUpdate = true; flag.geometry.computeVertexNormals();
    // people: in POV you see your hands and your friend; in the wide shot, both of you, small
    heroFig.visible = C.wide; handsGrp.visible = !C.wide;
    const pt = TL.point(s), sh = new THREE.Vector3(-0.85, 43.42, -4.42);
    const target = pl.dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -14 * D2R).add(new THREE.Vector3(0, 0.02, 0)).normalize();   // the ring's right ansa
    const rest = new THREE.Vector3(0.05, -1, -0.15).normalize(), dir = rest.clone().lerp(target, U.easeInOut(pt)).normalize();
    friendArm.position.copy(sh); friendArm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
    friendArm.visible = !C.wide || true;
  }

  function prepare(t) { init(); update(t); }
  function draw() { renderer.render(scene, camera); return canvas; }
  function render(t) { prepare(t); return draw(); }
  const v3 = new THREE.Vector3();
  function project(x, y, z) { init(); v3.set(x, y, z).project(camera); return { x: (v3.x * 0.5 + 0.5) * W, y: (-v3.y * 0.5 + 0.5) * HT, d: camera.position.distanceTo(new THREE.Vector3(x, y, z)), vis: v3.z < 1 && v3.z > -1 }; }
  g.World = { init, prepare, draw, render, project, lamps: () => lampHeads };
})(window);

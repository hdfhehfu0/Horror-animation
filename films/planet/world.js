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

  let renderer, scene, camera, canvas, hemi, key, dusk, fill, fog;
  let skyMat, globe, rings, globeMat, ringMat, moonMesh, seaMat, cubes = {};
  const uniformsCity = [], lampHeads = [], boats = [];
  let friend, heroFig, handsGrp, flag;

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
      float clumps = 0.25 + 0.75 * smoothstep(0.35, 0.72, fbm(d * 5.0 + 2.0));
      float f0 = 0.06, kk = 0.21, ragged = 0.6 * fbm(d * 14.0) + 0.4 * fbm(d * 40.0);
      float w = 0.018 + 0.012 * max(ll - f0, 0.0);
      float lane1 = ll < f0 ? gauss(bb - 0.01 * sin(ll * 9.0), w) : gauss(bb - kk * (ll - f0) * 0.6, w);
      float lane2 = ll < f0 ? 0.0 : gauss(bb + kk * (ll - f0) * 0.35, w * 0.8);
      float lanes = max(lane1, lane2) * smoothstep(-1.2, -0.3, ll) * (1.0 - smoothstep(0.9, 1.4, ll));
      float dust = 1.0 - 0.88 * lanes * (0.55 + 0.45 * ragged);
      vec3 col = vec3(0.0);
      if (uLayer < 0.5) {            // A: the bright population and the named stars
        col += starLayer(d, 70.0, 0.10, 6.5, 1.1, 0.0);
        col += spot(d, uHero1, vec3(0.66, 0.80, 1.0), 16.0, 0.38) + spot(d, uHero2, vec3(1.0, 0.62, 0.26), 13.0, 0.32);
      } else if (uLayer < 1.5) {     // B: medium, faint, very faint (patchy) and the star cloud inside the band
        col += starLayer(d, 190.0, 0.12, 2.8, 0.9, 31.0) * patchM;
        col += starLayer(d, 420.0, 0.14, 1.3, 0.85, 77.0) * patchM;
        col += starLayer(d, 640.0, 0.12, 0.9, 0.8, 151.0) * patchM;
        col += starLayer(d, 760.0, 0.30, 1.5, 0.8, 113.0) * inBand * clumps * dust * 0.55;
      } else {                        // C: the Milky Way's light (body, gold cloud, forked dust lane, rose wisps, far end)
        float body = gauss(bb, 0.12) * (0.45 + 0.55 * fbm(d * 3.0)) * (0.7 + 0.6 * fbm(d * 9.0 + 4.0));
        body *= smoothstep(-1.6, -0.8, ll) * (1.0 - smoothstep(1.1, 1.8, ll));
        float cloud = gauss(ll, 0.30) * gauss(bb, 0.10) * 4.2;
        float lum = body + cloud * (0.6 + 0.4 * fbm(d * 6.0));
        lum *= dust * (0.6 + 0.4 * clumps);
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
    const mw = { a: dirAzEl(-74, 2), b: dirAzEl(62, 58), c: dirAzEl(-15, 37) };   // the band rises from the lower left, the gold cloud up-left of the planet
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
          st = max(st - 0.010, 0.0) * 1.03;                    // the faintest grain sinks into the navy
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
      vec3 cc = vec3(0.52, 0.47, 0.40), bc = vec3(0.93, 0.82, 0.62), ac = vec3(0.80, 0.71, 0.56);
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
          base = mix(base, vec3(0.44, 0.32, 0.66), 0.75 * belt);
          float ov = exp(-(pow((lon - 0.6) / 0.16, 2.0) + pow((lat + 0.47) / 0.045, 2.0)));
          base = mix(base, vec3(0.66, 0.50, 0.72), 0.85 * ov);
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
          vec3 col = ringCol(r) * (0.5 + 0.6 * side) * sh * uExp * 0.62;
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
    return { dir, C, Rr, axis };
  }

  /* ------------------------------ the sea: drains, then surges (vertex-displaced) ------------------------------ */
  // the harbour floor: shallow at the quay, shelving away; uncovered as the water goes out
  const floorY = (z) => -2.6 - 11 * U.smooth(-22, -860, z);
  function makeSea() {
    seaMat = new THREE.ShaderMaterial({
      fog: false,
      uniforms: { uT: { value: 0 }, uLevel: { value: 0 }, uFront: { value: -12000 }, uH: { value: 0 }, uPlanet: { value: new THREE.Vector3(0, 0, -1) }, uPR: { value: 0.15 },
        uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uGlow: { value: 1 } },
      vertexShader: `uniform float uT; uniform float uLevel; uniform float uFront; uniform float uH; varying vec3 vW; varying float vFoam;
        void main(){
          vec3 p = (modelMatrix * vec4(position, 1.0)).xyz;
          float harb = smoothstep(-2600.0, -500.0, p.z);                 // the drawdown is deepest near the shore
          float dd = p.z - uFront;
          float wall = uH * (1.0 - smoothstep(-0.75 * uH - 120.0, 30.0, dd));
          float crest = uH * 0.12 * exp(-pow((dd + 0.62 * uH + 80.0) / (0.16 * uH + 50.0), 2.0));
          float waves = 0.25 * sin(p.x * 0.05 + uT * 1.3) * sin(p.z * 0.043 - uT * 0.9) + 0.12 * sin(p.x * 0.17 - p.z * 0.11 + uT * 2.1);
          p.y = uLevel * harb + wall + crest + waves * (1.0 + uH * 0.02);
          vFoam = (exp(-pow((dd + 0.66 * uH + 90.0) / (0.05 * uH + 30.0), 2.0)) + 0.6 * exp(-pow((dd - 10.0) / 45.0, 2.0))) * smoothstep(4.0, 40.0, uH);
          vW = p; gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `uniform float uT; uniform vec3 uPlanet; uniform float uPR; uniform vec3 uZen; uniform vec3 uHor; uniform float uGlow; varying vec3 vW; varying float vFoam;
        ${NOISE}
        void main(){
          vec3 n = normalize(cross(dFdx(vW), dFdy(vW))); if (n.y < 0.0) n = -n;
          float dist = length(vW - cameraPosition), lod = exp(-dist / 600.0);
          vec2 q = vW.xz;
          float r1 = n3(vec3(q.x * 0.21, uT * 0.5, q.y * 0.55)) - 0.5, r2 = n3(vec3(q.x * 0.9 + 5.0, uT * 0.9, q.y * 2.2)) - 0.5;
          n = normalize(n + vec3(r1 * 0.5 + r2 * 0.3, 0.0, r1 * 0.8 + r2 * 0.5) * (0.12 + 0.2 * lod));
          vec3 v = normalize(cameraPosition - vW), r = reflect(-v, n);
          float fr = 0.02 + 0.98 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
          vec3 sky = mix(uHor, uZen, pow(max(r.y, 0.0), 0.5));
          // the planet's glitter path: the mirror direction against the disc, spread vertically by the waves
          vec3 rf = reflect(-v, vec3(0.0, 1.0, 0.0)), pd = normalize(uPlanet);
          float daz = atan(rf.x, -rf.z) - atan(pd.x, -pd.z); daz = mod(daz + 3.14159, 6.28318) - 3.14159;
          float del = asin(clamp(rf.y, -1.0, 1.0)) - asin(clamp(pd.y, -1.0, 1.0));
          float env = exp(-pow(daz / (uPR * 0.85), 2.0)) * exp(-pow(del / (uPR * 1.3 + 0.12), 2.0));
          float sp = smoothstep(0.52, 0.78, n3(vec3(q.x * 0.7, uT * 1.4, q.y * 2.6)) + 0.25 * r2);
          float glit = env * mix(0.42, 1.6 * sp, lod * 0.8 + 0.2) * smoothstep(0.86, 0.98, normalize(cross(dFdx(vW), dFdy(vW))).y * sign(normalize(cross(dFdx(vW), dFdy(vW))).y));
          vec3 col = mix(vec3(0.004, 0.008, 0.016), sky, fr) + vec3(0.96, 0.86, 0.66) * glit * 0.55 * uGlow;
          col = mix(col, vec3(0.50, 0.54, 0.58), clamp(vFoam * (0.45 + 0.55 * n3(vW * 0.03 + uT * 0.5)), 0.0, 0.85));
          col = mix(col, uHor, (1.0 - exp(-dist / 7000.0)) * 0.7);
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    const geo = new THREE.PlaneGeometry(16000, 12000, 260, 220); geo.rotateX(-Math.PI / 2); geo.translate(0, 0, -6022);
    const m = new THREE.Mesh(geo, seaMat); m.frustumCulled = false; scene.add(m);
    // the harbour floor: mud and stones, with a concrete apron at the quay foot
    const fg = new THREE.PlaneGeometry(2000, 1400, 80, 120); fg.rotateX(-Math.PI / 2); fg.translate(0, 0, -722);
    const P = fg.attributes.position; for (let i = 0; i < P.count; i++) P.setY(i, floorY(P.getZ(i)) + 0.25 * Math.sin(P.getX(i) * 0.09) * Math.sin(P.getZ(i) * 0.07));
    fg.computeVertexNormals();
    scene.add(mesh(fg, new THREE.MeshStandardMaterial({ roughness: 0.82, map: canvasTex(512, (x, n) => { concrete(x, n, '#6a6152', 41); const r = U.mulberry32(8); for (let i = 0; i < 60; i++) { const px = r() * n, py = r() * n, rr = 15 + r() * 60; for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) { const g2 = x.createRadialGradient(px + ox, py + oy, 1, px + ox, py + oy, rr); g2.addColorStop(0, 'rgba(30,34,40,0.45)'); g2.addColorStop(1, 'rgba(30,34,40,0)'); x.fillStyle = g2; x.fillRect(px + ox - rr, py + oy - rr, 2 * rr, 2 * rr); } } x.strokeStyle = 'rgba(40,36,30,0.25)'; x.lineWidth = 2; for (let y = 6; y < n; y += 11) { x.beginPath(); for (let k = 0; k <= n; k += 16) x.lineTo(k, y + 3 * Math.sin(k * 0.05 + y)); x.stroke(); } }, [40, 28]) }), 0, 0, 0, { cast: false }));
    for (let i = 0; i < 160; i++) { const z = R(-380, -26); scene.add(mesh(new THREE.IcosahedronGeometry(R(0.3, 1.4), 0), lam(['#2f2c27', '#4b463d', '#5d564b'][i % 3]), R(-320, 320), floorY(z) + 0.1, z, { cast: false })); }
    for (let i = 0; i < 26; i++) { const z = R(-260, -32); scene.add(mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.25, 8), lam('#2a2622'), R(-300, 300), floorY(z) + 0.08, z, { cast: false })); }   // tyres, junk
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
    b.box(0, 0, 9.75, 30.8, 42, 30.5, '#a39b8e');
    // the waterfront row either side, then blocks behind
    for (const s of [-1, 1]) for (let x = 17; x < 700; x += R(24, 40)) { const w = R(18, 30), h = x < 160 ? R(15, 34) : R(22, 95), d = R(26, 40); b.box(s * (x + w / 2), 0, -5.5 + d / 2 + R(-1.5, 1.5), w, h, d, STONE[(rnd() * 8) | 0]); }
    for (let z = 45; z < 1400; z += R(40, 70)) for (let x = -900; x < 900; x += R(30, 55)) { if (Math.abs(x) < 25 && z < 60) continue; const h = R(20, 70) + (rnd() < 0.15 ? R(60, 160) : 0); b.box(x, 0, z, R(20, 34), h, R(22, 36), STONE[(rnd() * 8) | 0]); }
    const m = new THREE.Mesh(b.geo(), cityMat()); m.castShadow = m.receiveShadow = true; scene.add(m);
    // ground: streets and the promenade, the quay wall
    const pave = canvasTex(512, (x, n) => { concrete(x, n, '#8d8a83', 21); x.strokeStyle = 'rgba(40,38,34,0.45)'; x.lineWidth = 2; for (let k = 0; k <= n; k += n / 4) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k, n); x.moveTo(0, k); x.lineTo(n, k); x.stroke(); } }, [600, 40]);
    scene.add(slab(-1200, -0.2, -22, 1200, 0, 1600, new THREE.MeshStandardMaterial({ map: pave, roughness: 0.9 }), { cast: false }));
    scene.add(slab(-1200, -14, -24, 1200, 0, -22, lam('#7a756b'), { cast: false }));               // the quay wall
    scene.add(slab(-1200, 0, -22.4, 1200, 0.5, -21.6, lam('#a29d92'), { cast: false }));   // the edge kerb
    for (let x = -300; x <= 300; x += 9) scene.add(mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.6, 10), lam('#2c2d30'), x, 0.3, -21.2, { cast: false }));   // bollards
    // promenade lamps (their glow is added in 2D)
    for (let x = -600; x <= 600; x += 24) { scene.add(mesh(new THREE.CylinderGeometry(0.1, 0.14, 5, 6), lam('#2b2d30'), x, 2.5, -19, { cast: false })); scene.add(mesh(box(0.5, 0.18, 0.3), lam('#1e1f22'), x, 5.05, -19, { cast: false })); lampHeads.push(new THREE.Vector3(x, 4.9, -19)); }
    // piers (off to the sides) and boats: alongside the piers, and moored to buoys in the middle of the harbour
    for (const x of [-210, 150, 330]) { scene.add(slab(x - 3, -0.4, -222, x + 3, 0.6, -24, lam('#5b4a3a'), { cast: false })); for (let z = -212; z < -24; z += 12) for (const s of [-1, 1]) scene.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 9, 6), lam('#3a3027'), x + s * 2.8, -4.4, z, { cast: false })); }
    const spots = [];
    for (let i = 0; i < 9; i++) spots.push([[-210, 150, 330][i % 3] + (i % 2 ? 7 : -7) + R(-1, 1), -52 - (i / 3 | 0) * 48 - R(0, 10), R(-0.08, 0.08)]);
    for (let i = 0; i < 12; i++) spots.push([R(-70, 70), R(-50, -200), R(-1.2, 1.2)]);
    spots.forEach(([x, z, yaw], i) => {
      const grp = new THREE.Group(), L = R(7, 15), Wd = L * R(0.3, 0.36), Hh = R(1.3, 1.9);
      const hullC = ['#e7e4dc', '#b8402e', '#2f4f6e', '#e9e2c8', '#3c6b58'][i % 5];
      const sh = new THREE.Shape(); sh.moveTo(-Wd / 2, L / 2); sh.lineTo(Wd / 2, L / 2); sh.lineTo(Wd / 2, -L * 0.08); sh.quadraticCurveTo(Wd / 2, -L * 0.4, 0, -L / 2); sh.quadraticCurveTo(-Wd / 2, -L * 0.4, -Wd / 2, -L * 0.08); sh.closePath();
      const hg = new THREE.ExtrudeGeometry(sh, { depth: Hh, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 2, curveSegments: 10 }); hg.rotateX(-Math.PI / 2);
      grp.add(mesh(hg, new THREE.MeshStandardMaterial({ color: hullC, roughness: 0.5 }), 0, 0, 0));
      grp.add(mesh(box(Wd * 0.92, 0.06, L * 0.9), lam('#8a7458'), 0, Hh + 0.02, 0.02 * L, { cast: false }));           // deck
      grp.add(mesh(box(Wd * 0.94, 0.16, L * 0.96), lam('#1f2a33'), 0, 0.55, 0, { cast: false }));                      // boot stripe
      if (i % 3 !== 2) { grp.add(mesh(box(Wd * 0.62, 1.1, L * 0.3), lam('#d9d5cb'), 0, Hh + 0.55, L * 0.12)); grp.add(mesh(box(Wd * 0.64, 0.08, L * 0.32), lam('#4d5258'), 0, Hh + 1.14, L * 0.12, { cast: false })); }
      else grp.add(mesh(new THREE.CylinderGeometry(0.06, 0.08, L * 0.9, 6), lam('#c8c4ba'), 0, Hh + L * 0.45, -L * 0.1, { cast: false }));   // a mast
      grp.position.set(x, 0, z); grp.rotation.y = yaw; scene.add(grp);
      const shd = new THREE.Mesh(new THREE.PlaneGeometry(Wd * 2.0, L * 1.35), shadowMat()); shd.rotation.set(-Math.PI / 2, 0, -yaw); shd.position.set(x, floorY(z) + 0.06, z); shd.renderOrder = 1; scene.add(shd);
      boats.push({ grp, shd, tilt: R(-0.35, 0.35), roll: (i % 2 ? 1 : -1) * R(0.12, 0.3) });
    });
  }

  let SHADOWM;
  function shadowMat() { if (!SHADOWM) SHADOWM = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, fog: false, map: canvasTex(128, (x, n) => { const g2 = x.createRadialGradient(n / 2, n / 2, 2, n / 2, n / 2, n / 2); g2.addColorStop(0, 'rgba(0,0,0,0.7)'); g2.addColorStop(0.55, 'rgba(0,0,0,0.45)'); g2.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g2; x.fillRect(0, 0, n, n); }) }); return SHADOWM; }
  // procedural surfaces: weathered concrete, roof gravel, quilted jacket nylon
  function canvasTex(n, paint, rep = [1, 1]) {
    const c = document.createElement('canvas'); c.width = c.height = n; paint(c.getContext('2d'), n);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  }
  function concrete(x, n, base, seed) {
    const r = U.mulberry32(seed); x.fillStyle = base; x.fillRect(0, 0, n, n);
    for (let i = 0; i < 46; i++) { const px = r() * n, py = r() * n, rr = 20 + r() * 110, a = 0.05 + 0.08 * r(); for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) { const g2 = x.createRadialGradient(px + ox, py + oy, 1, px + ox, py + oy, rr); g2.addColorStop(0, `rgba(28,26,22,${a})`); g2.addColorStop(1, 'rgba(28,26,22,0)'); x.fillStyle = g2; x.fillRect(px + ox - rr, py + oy - rr, 2 * rr, 2 * rr); } }
    for (let i = 0; i < 14000; i++) { x.fillStyle = r() > 0.5 ? `rgba(255,255,255,${0.03 + 0.05 * r()})` : `rgba(0,0,0,${0.05 + 0.08 * r()})`; const s2 = 1 + r() * 2.2; x.fillRect(r() * n, r() * n, s2, s2); }
    for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(20,20,18,${0.25 + 0.3 * r()})`; x.beginPath(); x.arc(r() * n, r() * n, 0.8 + r() * 2.2, 0, Math.PI * 2); x.fill(); }   // pits
    x.strokeStyle = 'rgba(22,22,20,0.32)'; x.lineWidth = 1;
    for (let i = 0; i < 6; i++) if (base !== '#6a6152') { let px = r() * n, py = r() * n; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 14; k++) { px += (r() - 0.5) * 34; py += (r() - 0.5) * 34; x.lineTo(px, py); } x.stroke(); }
  }
  let TEX;
  function textures() {
    if (TEX) return TEX;
    TEX = {
      coping: canvasTex(512, (x, n) => concrete(x, n, '#9a958b', 3)),
      wall: canvasTex(512, (x, n) => { concrete(x, n, '#8c877d', 9); x.fillStyle = 'rgba(30,30,28,0.18)'; for (let y = 0; y < n; y += 64) x.fillRect(0, y, n, 3); }, [12, 1]),
      deck: canvasTex(512, (x, n) => { const r = U.mulberry32(5); x.fillStyle = '#77746e'; x.fillRect(0, 0, n, n); for (let i = 0; i < 30000; i++) { const v = 85 + r() * 70 | 0; x.fillStyle = `rgb(${v},${v - 2},${v - 5})`; x.fillRect(r() * n, r() * n, 1.5 + r() * 2, 1.5 + r() * 2); } }, [10, 10]),
      lens: canvasTex(128, (x, n) => { const g2 = x.createLinearGradient(0, 0, 0, n); g2.addColorStop(0, '#1d2a6e'); g2.addColorStop(0.45, '#6a4aa8'); g2.addColorStop(0.62, '#e08a3a'); g2.addColorStop(1, '#3a1d4a'); x.fillStyle = g2; x.fillRect(0, 0, n, n); x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(0, n * 0.3, n, n * 0.05); }),
      knit: canvasTex(128, (x, n) => { x.fillStyle = '#9a9a9a'; x.fillRect(0, 0, n, n); for (let k = 0; k < n; k += 4) { x.fillStyle = 'rgba(0,0,0,0.22)'; x.fillRect(k, 0, 1.5, n); } }, [6, 3]),
      quilt: canvasTex(256, (x, n) => { x.fillStyle = '#d0d0d0'; x.fillRect(0, 0, n, n); for (let y = 0; y < n; y += n / 6) { const g2 = x.createLinearGradient(0, y, 0, y + n / 6); g2.addColorStop(0, 'rgba(0,0,0,0.55)'); g2.addColorStop(0.12, 'rgba(255,255,255,0.10)'); g2.addColorStop(0.5, 'rgba(255,255,255,0.22)'); g2.addColorStop(0.88, 'rgba(0,0,0,0.05)'); g2.addColorStop(1, 'rgba(0,0,0,0.55)'); x.fillStyle = g2; x.fillRect(0, y, n, n / 6); } }),
    };
    return TEX;
  }
  function roof() {
    const T = textures(), dark = lam('#3f4246');
    // the parapet you lean on: precast coping slabs on a rendered wall (front), and the side walls
    const copeM = new THREE.MeshStandardMaterial({ map: T.coping, roughness: 0.92, color: '#ffffff' }), wallM = new THREE.MeshStandardMaterial({ map: T.wall, roughness: 0.95 });
    for (let x = -15.4; x < 15.4; x += 1.2) scene.add(slab(x + 0.006, 42.93, -5.62, Math.min(x + 1.2, 15.4) - 0.006, 43.07, -4.97, copeM));
    scene.add(slab(-15.4, 42, -5.56, 15.4, 42.93, -5.03, wallM));
    for (const s of [-1, 1]) { scene.add(slab(s > 0 ? 15 : -15.4, 42, -5.0, s > 0 ? 15.4 : -15, 43.0, 25, wallM)); }
    scene.add(slab(-15.4, 42, 24.6, 15.4, 43.0, 25, wallM));
    // the roof deck: gravel, a drain, a hatch
    scene.add(slab(-15, 41.9, -5.03, 15, 42.0, 24.6, new THREE.MeshStandardMaterial({ map: T.deck, roughness: 1 }), { cast: false }));
    scene.add(mesh(box(1.4, 0.7, 1.4), lam('#6d7076'), 4, 42.35, 6));
    // a water tank on legs, units, vents, an antenna, a flag
    const tank = new THREE.Group(); tank.position.set(8, 42, 14);
    for (const [x, z] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) tank.add(mesh(box(0.25, 4, 0.25), dark, x, 2, z));
    tank.add(mesh(new THREE.CylinderGeometry(2.4, 2.4, 4.2, 24), lam('#6e5640'), 0, 6.1, 0)); tank.add(mesh(new THREE.ConeGeometry(2.6, 1.5, 24), lam('#55412f'), 0, 8.95, 0));
    for (const y of [4.6, 6.1, 7.6]) tank.add(mesh(new THREE.TorusGeometry(2.42, 0.05, 4, 32), dark, 0, y, 0, { rx: Math.PI / 2, cast: false }));
    scene.add(tank);
    for (const [x, z] of [[-7, 4], [-3, 10], [3, 20], [-10, 16]]) { scene.add(mesh(box(2.4, 1.6, 1.8), lam('#8d9296'), x, 42.8, z)); scene.add(mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.06, 18), dark, x, 43.63, z, { cast: false })); }
    scene.add(mesh(new THREE.CylinderGeometry(0.06, 0.09, 9, 6), dark, -9, 46.5, 20, { cast: false }));
    scene.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, 6, 6), lam('#c9c6be'), 11.5, 45, 2.5, { cast: false }));
    const fg = new THREE.PlaneGeometry(1.8, 1.1, 12, 4); flag = mesh(fg, new THREE.MeshLambertMaterial({ color: '#2a5d8a', side: THREE.DoubleSide }), 12.4, 47.4, 2.5, { cast: false });
    flag.userData.base = Float32Array.from(fg.attributes.position.array); scene.add(flag);
  }

  /* ------------------------------ the two of you (men; quilted coats, beanies, balaclavas, mirrored goggles; no eyes anywhere) ------------------------------ */
  const GLOVE = '#4a3e34';   // brown leather
  const matStd = new Map();
  function std(color, rough = 0.8, map = null) { const k = color + rough + (map ? 'm' : ''); if (!matStd.has(k)) matStd.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough, map })); return matStd.get(k); }
  // a tapered segment between two world points (scaled unit cylinder)
  function limb(mat, rA, rB) { const g2 = new THREE.CylinderGeometry(rB, rA, 1, 12, 1); g2.translate(0, 0.5, 0); const m = new THREE.Mesh(g2, mat); m.castShadow = true; m.frustumCulled = false; scene.add(m); return m; }
  const UPY = new THREE.Vector3(0, 1, 0);
  function setLimb(m, A, B) { const d = B.clone().sub(A); m.position.copy(A); m.scale.set(1, d.length(), 1); m.quaternion.setFromUnitVectors(UPY, d.normalize()); }
  // a gloved hand; local -z is along the fingers; curl bends them down (-y)
  function hand(curl, point = false) {
    const grp = new THREE.Group(), glove = std(GLOVE, 0.5), fingers = [];
    grp.add(mesh(new THREE.BoxGeometry(0.088, 0.032, 0.098, 2, 1, 2), glove, 0, 0, 0, { cast: false }));
    { const m = mesh(new THREE.SphereGeometry(0.046, 10, 6), glove, 0, 0.004, 0.012, { cast: false }); m.scale.set(1, 0.42, 1.1); grp.add(m); }
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Group(); f.position.set(-0.033 + i * 0.022, 0, -0.048); grp.add(f);
      f.add(mesh(new THREE.CapsuleGeometry(0.0098, 0.046 - Math.abs(i - 1.5) * 0.006, 3, 8), glove, 0, 0, -0.028, { rx: Math.PI / 2, cast: false }));
      const tip = new THREE.Group(); tip.position.z = -0.054; f.add(tip);
      tip.add(mesh(new THREE.CapsuleGeometry(0.0092, 0.028, 3, 8), glove, 0, 0, -0.018, { rx: Math.PI / 2, cast: false }));
      fingers.push({ f, tip, ext: point && i === 3 });
    }
    grp.add(mesh(new THREE.CapsuleGeometry(0.011, 0.045, 3, 8), glove, 0.054, -0.006, -0.012, { rx: Math.PI / 2, ry: -0.7, cast: false }));
    grp.add(mesh(new THREE.CylinderGeometry(0.043, 0.047, 0.08, 12), std('#1d1e21', 0.6), 0, 0, 0.07, { rx: Math.PI / 2, cast: false }));   // cuff
    grp.userData.fingers = fingers; setCurl(grp, curl); return grp;
  }
  function setCurl(h, curl) { h.userData.fingers.forEach(({ f, tip, ext }, i) => { const c = ext ? 0.05 : curl; f.rotation.x = -c * (0.9 + 0.1 * i); tip.rotation.x = -c * 1.1; }); }
  function person(coat, cap) {
    const T = textures(), grp = new THREE.Group(), cm = std(coat, 0.72, T.quilt), trous = std('#2e3238', 0.9), knit = std('#34363c', 1.0, T.knit);
    for (const s of [-1, 1]) { grp.add(mesh(new THREE.CapsuleGeometry(0.085, 0.78, 4, 10), trous, s * 0.11, 0.5, 0)); grp.add(mesh(box(0.12, 0.08, 0.27), std('#151516', 0.6), s * 0.11, 0.04, -0.05)); }
    // the jacket: a lathed, slightly flattened body with baffles; a high zipped collar
    const prof = [[0.0, 0.0], [0.205, 0.0], [0.225, 0.12], [0.24, 0.34], [0.245, 0.52], [0.235, 0.62], [0.19, 0.69], [0.11, 0.72], [0.0, 0.72]].map(([r, y]) => new THREE.Vector2(r, y));
    const body = mesh(new THREE.LatheGeometry(prof, 28), cm, 0, 0.86, 0); body.scale.set(1.12, 1, 0.78); grp.add(body);
    grp.add(mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.13, 16), cm, 0, 1.62, 0));
    grp.add(mesh(box(0.012, 0.68, 0.01), std('#111', 0.4), 0, 1.24, -0.188, { cast: false }));   // zip
    for (const s of [-1, 1]) grp.add(mesh(new THREE.SphereGeometry(0.095, 14, 10), cm, s * 0.215, 1.5, 0));   // shoulders
    // the head: knit balaclava, a beanie with a turned cuff, mirrored goggles on a strap
    const head = mesh(new THREE.SphereGeometry(0.105, 18, 14), knit, 0, 1.79, 0); head.scale.set(0.95, 1.16, 1.05); grp.add(head);
    grp.add(mesh(new THREE.SphereGeometry(0.112, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), std(cap, 0.95), 0, 1.84, 0));
    grp.add(mesh(new THREE.TorusGeometry(0.108, 0.024, 8, 24), std(cap, 0.95), 0, 1.845, 0, { rx: Math.PI / 2 }));
    grp.add(mesh(new THREE.TorusGeometry(0.104, 0.009, 6, 24), std('#202022', 0.6), 0, 1.805, 0, { rx: Math.PI / 2, cast: false }));
    { const m = mesh(new THREE.SphereGeometry(0.03, 10, 8), knit, 0, 1.765, -0.112, { cast: false }); m.scale.set(0.8, 1.1, 0.9); grp.add(m); }   // nose, under the knit
    { const m = mesh(new THREE.SphereGeometry(0.06, 12, 8), knit, 0, 1.71, -0.07, { cast: false }); m.scale.set(1.2, 0.8, 0.9); grp.add(m); }     // chin and mouth
    grp.add(mesh(new THREE.CylinderGeometry(0.116, 0.116, 0.074, 24, 1, true, Math.PI * 0.62, Math.PI * 0.76), std('#141416', 0.5), 0, 1.81, 0, { cast: false }));   // goggle frame
    const gog = mesh(new THREE.CylinderGeometry(0.119, 0.119, 0.058, 24, 1, true, Math.PI * 0.66, Math.PI * 0.68), new THREE.MeshPhongMaterial({ color: '#30347a', specular: '#c8d0ff', shininess: 110, emissive: '#ffffff', emissiveMap: T.lens, emissiveIntensity: 0.55 }), 0, 1.81, 0, { cast: false });
    grp.add(gog);
    grp.userData.shoulders = [new THREE.Vector3(-0.235, 1.49, 0.0), new THREE.Vector3(0.235, 1.49, 0.0)];
    grp.userData.arms = [0, 1].map(() => ({ up: limb(cm, 0.07, 0.062), fore: limb(cm, 0.06, 0.05), elbow: (() => { const m = mesh(new THREE.SphereGeometry(0.062, 10, 8), cm); scene.add(m); return m; })() }));
    return grp;
  }
  // pose one arm in world space: shoulder -> elbow -> wrist, the hand at the wrist pointing along dir
  function poseArm(P, i, S, E, Wr, hand, dir) {
    const a = P.userData.arms[i]; setLimb(a.up, S, E); setLimb(a.fore, E, Wr); a.elbow.position.copy(E);
    if (hand) { hand.position.copy(Wr).addScaledVector(dir, 0.075); hand.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir); }
  }
  function setPersonVisible(P, v) { P.visible = v; P.userData.arms.forEach((a) => { a.up.visible = a.fore.visible = a.elbow.visible = v; }); }
  let heroHands = [], friendHands = [], povArms = [];
  const HERO_COAT = '#4a5c82';
  // two-bone IK: the elbow for a shoulder S and wrist Wp, bending toward `hint`
  function ik(S, Wp, L1, L2, hint) {
    const d = Wp.clone().sub(S), dl = Math.min(d.length(), L1 + L2 - 1e-4), u = d.clone().normalize();
    const a = (L1 * L1 - L2 * L2 + dl * dl) / (2 * dl), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    const b = hint.clone().addScaledVector(u, -hint.dot(u)).normalize();
    return S.clone().addScaledVector(u, a).addScaledVector(b, h);
  }
  function people() {
    friend = person('#7a845a', '#9a4430'); friend.position.set(-1.22, 42, -4.78); friend.rotation.y = 0.2; scene.add(friend);
    friendHands = [hand(0.9, true), hand(0.85)]; friendHands[1].scale.x = -1; friendHands.forEach((h) => scene.add(h));
    heroFig = person(HERO_COAT, '#3a3a3e'); heroFig.position.set(0, 42, -4.62 + 0.16); scene.add(heroFig);
    // your own gloved hands, resting at the coping's outer edge, fingers over it; your forearms along the slab
    // (left hand: thumb on +x; right hands are mirrored)
    heroHands = [-1, 1].map((s) => { const h = hand(0.2); h.position.set(s * 0.15, 43.087, -5.46); h.rotation.y = s * 0.3; if (s > 0) h.scale.x = -1; scene.add(h); return h; });
    const sleeveM = std(HERO_COAT, 0.72, textures().quilt);
    handsGrp = new THREE.Group(); povArms = [];
    for (let i = 0; i < 2; i++) {
      const fore = limb(sleeveM, 0.066, 0.05), up = limb(sleeveM, 0.075, 0.068), el = mesh(new THREE.SphereGeometry(0.068, 12, 8), sleeveM); scene.add(el);
      handsGrp.add(fore, up, el); povArms.push({ fore, up, el });
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
    fill = new THREE.DirectionalLight('#a9b8dc', 0.95); scene.add(fill, fill.target);
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
    dusk.position.copy(sun).multiplyScalar(200).setY(30); dusk.target.position.set(0, 20, 0); dusk.intensity = 0.55 * dk; dusk.color.set('#e8a6a0');
    key.target.position.set(C.x, 40, C.z); key.position.copy(key.target.position).addScaledVector(pl.dir, 220); key.intensity = 1.5 * rise; key.color.set('#f2e3c4');
    hemi.color.set('#7f8fc0').lerp(tmpC.set('#a7a2c8'), dk * 0.3); hemi.groundColor.set('#2b2b31'); hemi.intensity = 0.5 + 0.35 * dk + 0.3 * rise;
    const fwd = new THREE.Vector3(-Math.sin(C.yaw) * Math.cos(C.pitch), Math.sin(C.pitch), -Math.cos(C.yaw) * Math.cos(C.pitch));
    fill.position.set(C.x, C.y + 2, C.z).addScaledVector(fwd, -3); fill.target.position.set(C.x, C.y, C.z).addScaledVector(fwd, 3);
    fog.color.set('#2a3550').lerp(tmpC.set('#0c1424'), 1 - dk);
    for (const u of uniformsCity) { u.uPower.value = power; u.uLit.value = 0.32; }
    // the sea
    const zen = new THREE.Color().setRGB(0.006, 0.010, 0.025).lerp(new THREE.Color(0.03, 0.045, 0.11), dk);
    const hor = new THREE.Color().setRGB(0.018, 0.027, 0.043).lerp(new THREE.Color(0.048, 0.068, 0.136), dk);
    Object.assign(seaMat.uniforms.uZen.value, zen); Object.assign(seaMat.uniforms.uHor.value, hor);
    seaMat.uniforms.uT.value = s; seaMat.uniforms.uLevel.value = TL.harbour(s); seaMat.uniforms.uFront.value = TL.surgeFront(s); seaMat.uniforms.uH.value = TL.surgeH(s);
    seaMat.uniforms.uPlanet.value.copy(pl.dir); seaMat.uniforms.uPR.value = TL.PLANET.radiusDeg * D2R; seaMat.uniforms.uGlow.value = rise;
    // boats float, then settle on the mud and lean as the harbour drains
    const lvl = TL.harbour(s);
    for (const B of boats) {
      const fz = floorY(B.grp.position.z), wy = lvl - 0.4, grd = U.clamp((fz - wy) / 0.8);
      B.grp.position.y = Math.max(wy, fz) + 0.08 * Math.sin(s * 1.3 + B.tilt * 9) * (1 - grd); B.grp.rotation.x = B.tilt * grd * 0.3; B.grp.rotation.z = B.roll * grd; B.shd.visible = grd > 0.05;
    }
    // the flag
    const P = flag.geometry.attributes.position, b0 = flag.userData.base, wind = 1 + 2 * TL.shake(s);
    for (let i = 0; i < P.count; i++) { const x = b0[i * 3], y = b0[i * 3 + 1], k = (x + 0.9) / 1.8; P.setZ(i, Math.sin(x * 4 - s * 6 * wind + y) * 0.12 * k * wind); }
    P.needsUpdate = true; flag.geometry.computeVertexNormals();
    // you: hands resting on the coping; they slide to its edge and grip when the building shakes or you lean over
    const gk = Math.max(U.clamp(TL.shake(s) * 3.2), TL.lean(s));
    handsGrp.visible = !C.wide; setPersonVisible(heroFig, C.wide); heroFig.updateMatrixWorld(true);
    heroHands.forEach((h, i) => {
      const sg = i ? 1 : -1; h.position.set(sg * 0.15, 43.087, -5.46 - 0.075 * gk); setCurl(h, 0.2 + 0.85 * gk); h.updateMatrixWorld(true);
      const Wr = h.localToWorld(new THREE.Vector3(0, 0.004, 0.105));
      const S = C.wide ? heroFig.localToWorld(heroFig.userData.shoulders[i].clone()) : new THREE.Vector3(C.x + sg * 0.2, C.y - 0.26, C.z + 0.03);
      const E = ik(S, Wr, 0.4, 0.44, new THREE.Vector3(sg * 0.8, -0.6, 0.1));
      if (C.wide) poseArm(heroFig, i, S, E, Wr, null);
      else { setLimb(povArms[i].up, S, E); setLimb(povArms[i].fore, E, Wr); povArms[i].el.position.copy(E); }
    });
    // your friend: right arm down; his left arm rises and points exactly at the rings' left ansa (the B ring)
    friend.updateMatrixWorld(true);
    const ansa = ansaOf(pl);
    const k = U.easeInOut(TL.point(s));
    {
      const S = friend.localToWorld(friend.userData.shoulders[1].clone()), E = S.clone().add(new THREE.Vector3(0.03, -0.3, -0.02)), Wr = E.clone().add(new THREE.Vector3(-0.01, -0.27, -0.05));
      poseArm(friend, 1, S, E, Wr, friendHands[1], Wr.clone().sub(E).normalize());
    }
    {
      const S = friend.localToWorld(friend.userData.shoulders[0].clone()), d = ansa.clone().sub(S).normalize();
      const E0 = S.clone().add(new THREE.Vector3(-0.03, -0.3, -0.02)), W0 = E0.clone().add(new THREE.Vector3(0.01, -0.27, -0.05));
      const E = E0.lerp(S.clone().addScaledVector(d, 0.29), k), Wr = W0.lerp(S.clone().addScaledVector(d, 0.56), k);
      friendHands[0].userData.fingers[3].ext = k > 0.5; setCurl(friendHands[0], 0.9);   // the index finger is beside the thumb
      poseArm(friend, 0, S, E, Wr, friendHands[0], Wr.clone().sub(E).normalize());
    }
  }
  // the left ansa of the rings (on the B ring), in world space
  function ansaOf(pl) { const node = new THREE.Vector3().crossVectors(pl.axis, pl.dir).normalize(); if (node.x > 0) node.negate(); return pl.C.clone().addScaledVector(node, pl.Rr * 1.8); }

  // is the straight line from the camera to a point blocked by your own building (roof, parapet)?
  function occluded(x, y, z) {
    const o = camera.position, d = [x - o.x, y - o.y, z - o.z], lo = [-15.4, 0, -5.62], hi = [15.4, 43.07, 25], oo = [o.x, o.y, o.z];
    let t0 = 0, t1 = 1;
    for (let i = 0; i < 3; i++) {
      if (Math.abs(d[i]) < 1e-9) { if (oo[i] < lo[i] || oo[i] > hi[i]) return false; continue; }
      let a = (lo[i] - oo[i]) / d[i], b = (hi[i] - oo[i]) / d[i]; if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) return false;
    }
    return true;
  }

  function prepare(t) { init(); update(t); }
  function draw() { renderer.render(scene, camera); return canvas; }
  function render(t) { prepare(t); return draw(); }
  const v3 = new THREE.Vector3();
  function project(x, y, z) { init(); v3.set(x, y, z).project(camera); return { x: (v3.x * 0.5 + 0.5) * W, y: (-v3.y * 0.5 + 0.5) * HT, d: camera.position.distanceTo(new THREE.Vector3(x, y, z)), vis: v3.z < 1 && v3.z > -1 }; }
  g.World = { init, prepare, draw, render, project, occluded, lamps: () => lampHeads, ansa: ansaOf,
    ansaDir(t) { init(); const pl = placePlanet(TL.sceneT(t)), a = ansaOf(pl).normalize(); return [Math.atan2(-a.x, -a.z), Math.asin(a.y)]; } };
})(window);

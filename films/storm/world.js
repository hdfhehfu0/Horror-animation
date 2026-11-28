/* =========================================================================
   SOLAR STORM (first person) — world.js
   three.js (r170, vendored). Your rooftop (the same one as the rogue planet
   film), now looking north over a city at night. The sky follows the owner's
   approved recipe (.claude/skills/mad-space/references/space_look_spec.md):
   crisp per-pixel stars, the designed Milky Way baked once, and on top of it
   the aurora of a Carrington-class storm -- vertical curtains with a pink
   fringe, green lower bands and a high red glow, sweeping south over you.
   Transformers blow one after another and each takes its part of the city
   dark, lamps and windows flickering out block by block. Your phone loses
   signal. World.render(t) is a pure function of t.
   ========================================================================= */
(function (g) {
  'use strict';
  const { U, TL, THREE } = g;
  const W = TL.W, HT = TL.H, D2R = Math.PI / 180;
  const rnd = U.mulberry32(20261126);
  const R = (a, b) => a + (b - a) * rnd();
  const dirAzEl = (az, el) => new THREE.Vector3(Math.sin(az * D2R) * Math.cos(el * D2R), Math.sin(el * D2R), -Math.cos(az * D2R) * Math.cos(el * D2R));

  let renderer, scene, camera, canvas, hemi, auroraLight, fill, fog;
  let skyMat, cubes = {}, lampMat, arcMat, arcs, popLight, phone, phoneCanvas, phoneTex, phoneHand;
  const uniformsCity = [];
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

  /* ------------------------------ the sky (spec §3, §4) ------------------------------
     Point stars are drawn per screen pixel in the dome shader, so every star is a crisp gaussian core rad_px screen
     pixels wide at any lens: star_layer(scale, keep, gain, rad_px, seed), brightness random^9 x gain, colour from the
     temperature ramp only for the brightest few percent. The brightest also carry a faint bloom and scintillate a
     little, more near the horizon. The Milky Way's unresolved light (gold cloud, forked ragged dust lane, rose wisps,
     emission nebulae, lavender-to-blue far end) and the density masks are baked once into cube textures. A few
     meteors cross the sky during the long holds. */
  const SKYLIB = `
    uniform vec3 uMWa; uniform vec3 uMWb; uniform vec3 uMWc;
    vec3 tempCol(float k){
      vec3 c[7]; c[0]=vec3(1.0,0.45,0.25); c[1]=vec3(1.0,0.62,0.32); c[2]=vec3(1.0,0.82,0.55); c[3]=vec3(1.0,0.92,0.80);
      c[4]=vec3(0.70,0.82,1.0); c[5]=vec3(0.55,0.68,1.0); c[6]=vec3(0.45,0.58,1.0);
      float x = clamp(k, 0.0, 0.9999) * 6.0; int i = int(floor(x)); return mix(c[i], c[min(i + 1, 6)], fract(x));
    }
    // band coordinates: ll along the Milky Way (0 at the gold cloud), bb across it (radians)
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
      if (uLayer < 0.5) {             // M: density masks for the per-pixel stars
        gl_FragColor = vec4(patchM, inBand * clumps * dust, dust, 1.0);
        return;
      }
      // C: the Milky Way's light
      float body = gauss(bb, 0.12) * (0.45 + 0.55 * fbm(d * 3.0)) * (0.7 + 0.6 * fbm(d * 9.0 + 4.0));
      body *= smoothstep(-1.6, -0.8, ll) * (1.0 - smoothstep(1.1, 1.8, ll));
      float cloud = gauss(ll, 0.30) * gauss(bb, 0.10) * 4.2;
      float lum = body + cloud * (0.6 + 0.4 * fbm(d * 6.0));
      lum *= 0.75 + 0.5 * fbm(d * 24.0 + 9.0);                         // the unresolved star clouds are mottled, not smooth
      lum *= dust * (0.6 + 0.4 * clumps);
      float k = clamp((ll + 0.4) / 1.7, 0.0, 1.0);
      vec3 tone = k < 0.2 ? mix(vec3(1.0, 0.70, 0.36), vec3(1.0, 0.78, 0.46), k / 0.2)
                : k < 0.45 ? mix(vec3(1.0, 0.78, 0.46), vec3(0.98, 0.90, 0.78), (k - 0.2) / 0.25)
                : k < 0.7 ? mix(vec3(0.98, 0.90, 0.78), vec3(0.80, 0.70, 1.0), (k - 0.45) / 0.25)
                : mix(vec3(0.80, 0.70, 1.0), vec3(0.45, 0.60, 1.0), (k - 0.7) / 0.3);
      vec3 col = tone * lum * 0.24;
      float rose = smoothstep(0.0, 0.08, bb) * gauss(bb - 0.14, 0.08) * gauss(ll - 0.1, 0.35) * (0.5 * fbm(d * 7.0) + 0.5 * fbm(d * 18.0 + 3.0));
      col += vec3(0.95, 0.36, 0.50) * 0.95 * rose * 0.24 * 1.6;
      // emission nebulae strung along the band: hydrogen-red knots with fine filaments, one bluer reflection haze
      float e = neb(d, ll, bb, -0.30, 0.012, 0.035, 1.0) + 0.8 * neb(d, ll, bb, 0.34, -0.035, 0.028, 5.0) + 0.6 * neb(d, ll, bb, 0.66, 0.045, 0.04, 9.0) + 0.5 * neb(d, ll, bb, -0.62, -0.02, 0.03, 13.0);
      col += vec3(0.95, 0.28, 0.36) * e * 0.11 * dust;
      col += vec3(0.40, 0.55, 1.0) * neb(d, ll, bb, 0.20, 0.13, 0.03, 17.0) * 0.035;
      gl_FragColor = vec4(col, 1.0);
    }`;
  let MW;
  function bakeSky() {
    MW = { a: dirAzEl(-74, 2), b: dirAzEl(62, 58), c: dirAzEl(-15, 37) };   // the band rises from the lower left, the gold cloud up-left of the planet
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
  /* ------------------------------ the dome: sky, stars, Milky Way, the aurora, transformer flashes ------------------------------
     The aurora is a set of vertical east-west sheets (km above a flat ground). Each pixel's ray meets each sheet once:
     the altitude of that crossing picks the emission (pink fringe ~96 km, green 100-150 km with a sharp lower edge,
     red 200-400 km), the sheet's folds make the bright edge-on curtains, striations along the field lines are the
     rays, and the whole oval sweeps south over you as the storm grows. A broad high red glow fills the north. */
  const AURORA = `
    uniform float uAur; uniform float uAurR; uniform float uAurG; uniform float uSouth; uniform float uAZ[5];
    float n1(float x){ float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h1(vec3(i, 0.0, 0.0)), h1(vec3(i + 1.0, 0.0, 0.0)), f); }
    float sheetZ(float Z0, float x, float fi){
      return Z0 + 62.0 * sin(x / 190.0 + uS * 0.10 * (1.0 + fi * 0.3) + fi * 1.7) + 34.0 * sin(x / 61.0 - uS * 0.21 + fi * 2.3)
                + 26.0 * (n1(x / 37.0 + uS * 0.09 + fi * 10.0) - 0.5);
    }
    vec3 aurora(vec3 d){
      if (d.y < 0.004 || uAur <= 0.001) return vec3(0.0);
      vec3 acc = vec3(0.0);
      for (int i = 0; i < 5; i++) {
        float fi = float(i), Z0 = uAZ[i] + uSouth, z = Z0, x = 0.0, tc = -1.0;
        for (int k = 0; k < 3; k++) { if (abs(d.z) < 1e-4) break; tc = z / d.z; x = d.x * tc; z = sheetZ(Z0, x, fi); }
        if (tc <= 0.0) continue;
        float h = d.y * tc;
        if (h < 85.0 || h > 520.0) continue;
        float green = smoothstep(93.0, 103.0, h) * exp(-max(h - 107.0, 0.0) / 34.0);
        float pink = exp(-pow((h - 96.5) / 4.5, 2.0));
        float red = smoothstep(160.0, 240.0, h) * exp(-pow((h - 280.0) / 105.0, 2.0));
        float far = smoothstep(2600.0, 350.0, tc);
        float rays = mix(1.0, 0.3 + 0.7 * pow(n1(x * 0.85 + fi * 31.0 + uS * 0.55), 1.6) * (0.55 + 0.45 * n1(x * 3.3 - uS * 1.9 + fi * 7.0)), far);
        float patchy = 0.25 + 0.75 * smoothstep(0.25, 0.8, n1(x / 85.0 + uS * 0.12 + fi * 5.0));
        float ends = smoothstep(1900.0, 900.0, abs(x));
        float dzdx = (sheetZ(Z0, x + 0.6, fi) - sheetZ(Z0, x - 0.6, fi)) / 1.2;
        vec3 nrm = normalize(vec3(-dzdx, 0.0, 1.0));
        float lane = 1.0 / max(abs(dot(d, nrm)), 0.14);
        float sg = (i == 0 ? 1.0 : i == 1 ? 0.8 : i == 2 ? 0.65 : i == 3 ? 0.5 : 0.4);
        vec3 em = vec3(0.22, 1.0, 0.42) * green * uAurG * 1.9 + vec3(0.9, 0.25, 0.75) * pink * uAurG * 0.9 + vec3(1.0, 0.13, 0.17) * red * uAurR * 0.42;
        acc += em * rays * patchy * ends * lane * sg * 0.09;
      }
      // the broad, high red glow over the north (and later overhead)
      float front = uAZ[0] + uSouth;
      for (int k = 0; k < 4; k++) {
        float h = 210.0 + 60.0 * float(k), t = h / max(d.y, 0.04);
        vec2 P = d.xz * t;
        float wgt = smoothstep(front - 60.0, front - 240.0, P.y) * smoothstep(front - 2300.0, front - 1100.0, P.y);
        float m = 0.25 + 0.75 * smoothstep(0.25, 0.8, n3(vec3(P * 0.0035, uS * 0.04 + float(k))));
        float prof = exp(-pow((h - 290.0) / 120.0, 2.0));
        acc += vec3(1.0, 0.12, 0.16) * uAurR * wgt * m * prof * (60.0 / max(d.y, 0.06)) * 0.0003;
      }
      return acc * uAur;
    }
  `;
  function makeDome() {
    skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uM: { value: cubes.M }, uC: { value: cubes.C }, uVisB: { value: 0 }, uVisF: { value: 0 }, uVisMW: { value: 0 },
        uLP: { value: 1 }, uPx: { value: 0.0006 }, uS: { value: 0 },
        uMWa: { value: MW.a }, uMWb: { value: MW.b }, uMWc: { value: MW.c }, uHero1: { value: dirAzEl(21, 32) }, uHero2: { value: dirAzEl(-36, 44) },
        uAur: { value: 0 }, uAurR: { value: 0 }, uAurG: { value: 0 }, uSouth: { value: 0 }, uAZ: { value: TL.AURORA_Z.slice() },
        uPopD: { value: [0, 1, 2, 3, 4, 5, 6, 7].map(() => new THREE.Vector4()) } },
      vertexShader: 'varying vec3 vDir;\nvoid main(){\n vDir = position;\n vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n gl_Position = p.xyww;\n}',
      fragmentShader: `uniform samplerCube uM; uniform samplerCube uC; uniform float uVisB; uniform float uVisF; uniform float uVisMW;
        uniform float uLP; uniform float uPx; uniform float uS; uniform vec3 uHero1; uniform vec3 uHero2; uniform vec4 uPopD[8];
        varying vec3 vDir;
        ${NOISE}
        ${SKYLIB}
        ${AURORA}
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
        vec3 spot(vec3 d, vec3 s, vec3 col, float core, float halo){
          float a = degrees(length(d - s));
          return col * (core * exp(-a * a / (2.0 * 0.15 * 0.15 * 0.25)) + halo * exp(-a * a / (2.0 * 0.9 * 0.9 * 0.25)));
        }
        void main(){
          vec3 d = normalize(vDir); float el = max(d.y, 0.0);
          vec3 col = mix(vec3(0.014, 0.021, 0.042), vec3(0.0030, 0.0050, 0.0140), pow(el, 0.6));
          col += vec3(0.008, 0.013, 0.012) * (1.0 - smoothstep(0.0, 0.18, el));
          col += vec3(0.004, 0.011, 0.006) * smoothstep(0.02, 0.08, el) * (1.0 - smoothstep(0.1, 0.26, el)) * (0.6 + 0.4 * n3(d * 6.0));
          // the city's glow: warm and low all round, strongest over the city in front of you
          float dome = pow(1.0 - el, 1.6) * (0.55 + 0.45 * smoothstep(-0.4, 0.8, -d.z));
          col += vec3(0.50, 0.29, 0.14) * 0.11 * dome * uLP;
          // transformers blowing light up the low sky toward them: blue-white
          for (int i = 0; i < 8; i++) { if (uPopD[i].w <= 0.0) continue; float a = acos(clamp(dot(d, uPopD[i].xyz), -1.0, 1.0)); col += vec3(0.45, 0.7, 1.0) * uPopD[i].w * exp(-a * a / (2.0 * 0.32 * 0.32)) * (0.35 + 0.65 * (1.0 - smoothstep(0.0, 0.45, d.y))) * 0.5; }
          if (d.y > -0.01) {
            vec3 m = textureCube(uM, d).rgb;
            float tw = 0.12 + 0.4 * (1.0 - smoothstep(0.04, 0.5, d.y));
            vec3 st = starLayer(d, 70.0, 0.10, 6.5, 1.1, 0.0, tw, 1.0) * uVisB;
            st += spot(d, uHero1, vec3(0.66, 0.80, 1.0), 16.0, 0.38) * uVisB + spot(d, uHero2, vec3(1.0, 0.62, 0.26), 13.0, 0.32) * uVisB;
            if (uVisF > 0.003) {
              vec3 f = starLayer(d, 190.0, 0.12, 2.8, 0.9, 31.0, tw * 0.6, 0.0) * m.r;
              f += starLayer(d, 420.0, 0.14, 1.3, 0.85, 77.0, 0.0, 0.0) * m.r;
              f += starLayer(d, 640.0, 0.12, 0.9, 0.8, 151.0, 0.0, 0.0) * m.r;
              if (m.g > 0.01) f += starLayer(d, 760.0, 0.30, 1.5, 0.8, 113.0, 0.0, 0.0) * m.g * 0.32;
              st += f * uVisF;
            }
            st = max(st - 0.006, 0.0);
            st *= (1.0 - 0.8 * uLP * dome) * smoothstep(0.0, 0.05, d.y);
            float pk = max(st.r, max(st.g, st.b));
            st *= 1.25 / (1.0 + 0.4 * pk);
            vec3 mw = textureCube(uC, d).rgb * uVisMW * smoothstep(0.0, 0.16, d.y) * (1.0 - 0.7 * uLP);
            vec3 au = aurora(d);
            au = au / (1.0 + 0.55 * max(au.r, max(au.g, au.b)));            // bright folds keep their colour and structure
            col += st + mw + au * smoothstep(0.0, 0.03, d.y);
          }
          if (d.y < 0.0) col = mix(col, vec3(0.010, 0.016, 0.030), smoothstep(0.0, -0.05, d.y));
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    const s = new THREE.Mesh(new THREE.SphereGeometry(15000, 64, 32), skyMat); s.frustumCulled = false; s.renderOrder = 10; scene.add(s);
    return s;
  }

  /* ------------------------------ the city in front of you (north), and its blackout ------------------------------ */
  // every lit window and lamp goes dark at TL.cutTime(x, z) (mirrored here in GLSL), flickering for a moment first
  const CUT = `
    uniform vec4 uPops[8]; uniform float uS;
    float hcell(vec2 c){ return fract(sin(dot(c, vec2(7.31, 13.17))) * 43758.5453); }
    float cutTime(vec2 xz){
      float h = hcell(floor(vec2(xz.x + 3000.0, 3000.0 - xz.y) / 140.0)), m = 1e9;
      for (int i = 0; i < 8; i++) m = min(m, uPops[i].w + length(xz - uPops[i].xz) / 220.0 + h * 1.2);
      return max(m, 29.25);
    }
    float powerOn(vec2 xz, float seed){
      float c = cutTime(xz), dt = c - uS;
      if (dt < 0.0) return 0.0;
      if (dt > 0.6) return 1.0;
      return step(0.45, fract(sin(seed * 91.7 + floor(uS * 24.0) * 3.7) * 43758.5)) * (0.4 + 0.6 * dt / 0.6);   // the brownout flicker
    }
  `;
  const WIN = `
    float side = step(abs(vON.y), 0.5);
    vec2 gp = vec2(abs(vON.x) > 0.5 ? vOP.z : vOP.x, vOP.y);
    vec2 cs = vec2(3.3, 3.6); vec4 wr = vec4(0.22, 0.78, 0.25, 0.85);
    vec2 wid = floor(gp / cs); vec2 fc = fract(gp / cs);
    float win = side * step(wr.x, fc.x) * step(fc.x, wr.y) * step(wr.z, fc.y) * step(fc.y, wr.w) * step(4.0, vOP.y);
    float hh = fract(sin(dot(wid + vec2(floor(vOP.x * 0.031) * 7.0, floor(vOP.z * 0.031) * 13.0), vec2(12.9898, 78.233))) * 43758.5453);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.08, 0.09, 0.11), win);
    float on = powerOn(vOP.xz, hh);
    vec3 tint = mix(vec3(1.0, 0.70, 0.40), vec3(0.85, 0.90, 1.0), step(0.7, fract(hh * 5.3)));
    vec3 litC = tint * win * step(1.0 - uLit, hh) * (0.25 + 0.4 * fract(hh * 7.31)) * on;
  `;
  function cityMat() {
    const m = new THREE.MeshLambertMaterial({ vertexColors: true });
    const u = { uLit: { value: 0.36 }, uPops: popUniform, uS: sUniform }; uniformsCity.push(u);
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aW;\nvarying vec3 vOP;\nvarying vec3 vON;')
        .replace('#include <fog_vertex>', '#include <fog_vertex>\nvOP = aW;\nvON = normal;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP;\nvarying vec3 vON;\nuniform float uLit;\n' + CUT)
        .replace('#include <color_fragment>', '#include <color_fragment>\n' + WIN)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += litC;');
    };
    m.customProgramCacheKey = () => 'storm-city';
    return m;
  }
  const popUniform = { value: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const p = TL.POPS[i]; return new THREE.Vector4(p.x, p.y, p.z, p.t); }) };
  const sUniform = { value: 0 };
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
  const STONE = ['#8d8578', '#7f7a73', '#958d7f', '#6c6965', '#776c5f', '#857d70', '#5f6469', '#7d7366', '#56595e'];
  const AVE = 92, STREET = 74;                 // block pitch in x (avenues run north) and in z (cross streets)
  function city() {
    const b = new Builder();
    // your building: roof at y = 42
    b.box(0, 0, 9.75, 30.8, 42, 30.5, '#a39b8e');
    // the blocks: lower near you so the view opens over them; a skyline of towers further out
    for (let bz = -24; bz > -1900; bz -= STREET) for (let bx = -1700; bx < 1700; bx += AVE) {
      const x0 = bx + 10, x1 = bx + AVE - 10, z0 = bz - 2 - 8, z1 = bz - STREET + 8;   // the block, inside its streets
      const dist = Math.hypot((x0 + x1) / 2, (z0 + z1) / 2), n = 1 + (rnd() * 3 | 0);
      if (z0 > -175 && Math.abs((x0 + x1) / 2) < 330) continue;                         // the square below you
      for (let k = 0; k < n; k++) {
        const w = (x1 - x0) / n, cx = x0 + w * (k + 0.5), d = (z0 - z1) * R(0.7, 0.95);
        let h = dist < 360 ? R(10, 26) : dist < 700 ? R(18, 60) : R(24, 90);
        if (rnd() < (dist < 300 ? 0.03 : 0.12)) h += R(40, dist > 600 ? 190 : 70);
        b.box(cx, 0, (z0 + z1) / 2, w * R(0.82, 0.96), h, d, STONE[(rnd() * STONE.length) | 0]);
      }
    }
    const m = new THREE.Mesh(b.geo(), cityMat()); scene.add(m);
    // the ground: asphalt and pavements
    scene.add(slab(-4000, -0.2, -4000, 4000, 0, 60, lam('#2c2d30'), { cast: false }));
    scene.add(slab(-320, 0, -170, 320, 0.15, -24, lam('#3b3a36'), { cast: false }));                 // the square's paving
    for (let i = 0; i < 90; i++) { const x = R(-300, 300), z = R(-160, -34), hgt = R(5, 9); scene.add(mesh(new THREE.CylinderGeometry(0.18, 0.25, hgt * 0.45, 6), lam('#2a231d'), x, hgt * 0.22, z, { cast: false })); scene.add(mesh(new THREE.IcosahedronGeometry(R(2.2, 3.6), 1), lam(['#23301f', '#2b3a25', '#1f2a1c'][i % 3]), x, hgt * 0.6, z, { cast: false })); }   // trees
    // street lamps (drawn as depth-tested glowing points; each goes out with its block)
    const P = [], C = [];
    const add = (x, z) => { P.push(x, 5.2, z); C.push(TL.cutTime(x, z), rnd()); };
    for (let x = -60; x <= 60; x += 24) add(x, -19);                                   // your own street
    for (let z = -40; z > -170; z -= 26) for (let x = -300; x <= 300; x += 60) add(x + (z % 52 ? 0 : 30), z);   // the square's paths
    for (let bx = -1700; bx < 1700; bx += AVE) for (let z = -30; z > -1900; z -= 32) { add(bx + 3, z); add(bx - 3, z - 16); }
    for (let bz = -24; bz > -1900; bz -= STREET) for (let x = -1700; x < 1700; x += 34) { add(x, bz - 3); add(x + 17, bz - 13); }
    const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g2.setAttribute('aCut', new THREE.Float32BufferAttribute(C, 2));
    lampMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      uniforms: { uS: sUniform, uScale: { value: 1 } },
      vertexShader: `uniform float uS; uniform float uScale; attribute vec2 aCut; varying float vOn; varying float vD;
        void main(){
          vec4 mv = modelViewMatrix * vec4(position, 1.0); vD = -mv.z;
          float dt = aCut.x - uS;
          vOn = dt < 0.0 ? 0.0 : dt > 0.6 ? 1.0 : step(0.45, fract(sin(aCut.y * 91.7 + floor(uS * 24.0) * 3.7) * 43758.5)) * (0.4 + 0.6 * dt / 0.6);
          gl_PointSize = clamp(uScale * 900.0 / vD, 1.6, 28.0) * (vOn > 0.0 ? 1.0 : 0.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `varying float vOn; varying float vD;
        void main(){
          vec2 q = gl_PointCoord - 0.5; float r2 = dot(q, q) * 4.0;
          float a = exp(-r2 * 7.0) + 0.18 * exp(-r2 * 1.6);
          gl_FragColor = vec4(vec3(1.0, 0.74, 0.42) * a * vOn * mix(1.0, 0.45, smoothstep(200.0, 1600.0, vD)), 1.0);
          #include <colorspace_fragment>
        }`,
    });
    const pts = new THREE.Points(g2, lampMat); pts.frustumCulled = false; pts.renderOrder = 5; scene.add(pts);
    // the transformers: blue-white arcs where they blow
    const PP = []; TL.POPS.forEach((p) => PP.push(p.x, p.y, p.z));
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(PP, 3)); pg.setAttribute('aW', new THREE.Float32BufferAttribute(new Float32Array(TL.POPS.length), 1));
    arcMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, uniforms: { uS: sUniform },
      vertexShader: `attribute float aW; varying float vW; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vW = aW; gl_PointSize = clamp(26000.0 / -mv.z, 6.0, 160.0) * step(0.001, aW); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uS; varying float vW;
        float hs(float x){ return fract(sin(x * 12.9898) * 43758.5453); }
        void main(){
          vec2 q = gl_PointCoord - 0.5; float r = length(q) * 2.0, a = atan(q.y, q.x);
          float core = exp(-r * r * 60.0), glow = exp(-r * r * 6.0) * 0.35;
          float spikes = 0.0; for (int k = 0; k < 5; k++) { float ak = hs(float(k) + floor(uS * 30.0)) * 6.2832; spikes += exp(-pow((a - ak) * 9.0 * r, 2.0)) * exp(-r * 3.0); }
          vec3 c = vec3(0.75, 0.88, 1.0) * (core * 3.0 + glow + spikes * 0.35);
          gl_FragColor = vec4(c * vW, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    arcs = new THREE.Points(pg, arcMat); arcs.frustumCulled = false; arcs.renderOrder = 6; scene.add(arcs);
    popLight = new THREE.PointLight('#a9c8ff', 0, 420, 1.4); scene.add(popLight);
  }
  // how hard each transformer is arcing at scene time s (0 = not)
  function popW(p, s) {
    const k = s - p.t; if (k < 0 || k > 1.6) return 0;
    const f = 0.55 + 0.45 * Math.sin(k * 61 + p.x) * Math.sin(k * 23 + p.z);
    return p.big * (k < 0.03 ? k / 0.03 : 1) * Math.exp(-k * 2.6) * f + p.big * 0.6 * Math.max(0, 1 - Math.abs(k - 0.42) / 0.07);
  }

  /* ------------------------------ your phone ------------------------------ */
  function phoneScreen(noSignal) {
    const c = phoneCanvas, x = c.getContext('2d'), w = c.width, h = c.height;
    const g2 = x.createLinearGradient(0, 0, 0, h); g2.addColorStop(0, '#0b1830'); g2.addColorStop(0.55, '#123a3a'); g2.addColorStop(1, '#2a1030');
    x.fillStyle = g2; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(255,255,255,0.92)'; x.font = '600 22px Inter, Arial, sans-serif'; x.textBaseline = 'top';
    if (noSignal) { x.fillText('No Service', 22, 16); } else { x.fillText('23:47', 22, 16); for (let i = 0; i < 4; i++) x.fillRect(w - 86 + i * 12, 34 - (i + 1) * 5, 8, (i + 1) * 5); }
    x.fillRect(w - 44, 20, 26, 13); x.fillStyle = '#0b1830'; x.fillRect(w - 42, 22, 16, 9);
    x.fillStyle = 'rgba(255,255,255,0.95)'; x.font = '300 96px Inter, Arial, sans-serif'; x.textAlign = 'center'; x.fillText('23:47', w / 2, 120);
    x.font = '500 22px Inter, Arial, sans-serif'; x.fillText('Thursday', w / 2, 236);
    if (noSignal) {
      x.fillStyle = 'rgba(255,255,255,0.16)'; x.beginPath(); x.roundRect(24, 300, w - 48, 92, 18); x.fill();
      x.fillStyle = 'rgba(255,255,255,0.95)'; x.font = '600 21px Inter, Arial, sans-serif'; x.fillText('No Service', w / 2, 318);
      x.font = '400 18px Inter, Arial, sans-serif'; x.fillStyle = 'rgba(255,255,255,0.75)'; x.fillText('Emergency calls only', w / 2, 352);
    }
    x.textAlign = 'left'; phoneTex.needsUpdate = true;
  }
  function makePhone() {
    phone = new THREE.Group(); camera.add(phone);
    phoneCanvas = document.createElement('canvas'); phoneCanvas.width = 288; phoneCanvas.height = 600;
    phoneTex = new THREE.CanvasTexture(phoneCanvas); phoneTex.colorSpace = THREE.SRGBColorSpace; phoneScreen(false);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.074, 0.154, 0.009), new THREE.MeshStandardMaterial({ color: '#1b1c1f', roughness: 0.35, metalness: 0.4 }));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.068, 0.146), new THREE.MeshBasicMaterial({ map: phoneTex, toneMapped: false }));
    scr.position.z = 0.0047; phone.add(body, scr);
    const pl = new THREE.PointLight('#cfe0ff', 0.25, 0.7, 2); pl.position.set(0, 0, 0.05); phone.add(pl);
    // your right hand round it: palm behind, thumb on the left edge, fingers curled round the right edge
    phoneHand = hand(1.15);
    { const M = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0)); phoneHand.quaternion.setFromRotationMatrix(M); }
    phoneHand.position.set(0.028, -0.04, -0.022); phone.add(phoneHand);
    phone.visible = false;
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
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0; renderer.outputColorSpace = THREE.SRGBColorSpace;
    scene = new THREE.Scene(); fog = new THREE.Fog('#141a28', 400, 4200); scene.fog = fog;
    camera = new THREE.PerspectiveCamera(70, W / HT, 0.05, 40000); camera.rotation.order = 'YXZ'; scene.add(camera);
    hemi = new THREE.HemisphereLight('#4a5470', '#3a2a22', 0.6); scene.add(hemi);
    auroraLight = new THREE.DirectionalLight('#7dffb0', 0); scene.add(auroraLight, auroraLight.target);
    fill = new THREE.PointLight('#a9b8dc', 2.2, 7, 2); scene.add(fill);
    bakeSky(); makeDome(); city(); roof(); people(); makePhone();
  }

  /* ------------------------------ per frame ------------------------------ */
  const tmpC = new THREE.Color(), tmpV = new THREE.Vector3();
  let lastNoSignal = null;
  function update(t) {
    const s = TL.sceneT(t), C = TL.cam(t), aur = TL.aurora(s), aG = TL.auroraGreen(s), aR = TL.auroraRed(s), lit = TL.lit(s);
    camera.position.set(C.x, C.y, C.z); camera.rotation.set(C.pitch, C.yaw, C.roll); camera.fov = C.fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    sUniform.value = s;
    // the sky
    const U2 = skyMat.uniforms;
    U2.uVisB.value = TL.visBright(s); U2.uVisF.value = TL.visFaint(s); U2.uVisMW.value = TL.visMW(s); U2.uLP.value = TL.lightPollution(s);
    U2.uPx.value = 2 * Math.tan(C.fov * D2R / 2) / HT; U2.uS.value = s;
    U2.uAur.value = aur; U2.uAurR.value = aR; U2.uAurG.value = aG; U2.uSouth.value = TL.auroraSouth(s);
    // transformers: arcs, the sky flash toward them, and their light on the buildings around
    let best = 0, bestP = null;
    const aw = arcs.geometry.attributes.aW;
    TL.POPS.forEach((p, i) => {
      const w = popW(p, s); aw.setX(i, w);
      const dir = tmpV.set(p.x - C.x, p.y + 30 - C.y, p.z - C.z).normalize();
      U2.uPopD.value[i].set(dir.x, dir.y, dir.z, w * (1.2 - Math.min(1, Math.hypot(p.x - C.x, p.z - C.z) / 2500)));
      if (w > best) { best = w; bestP = p; }
    });
    aw.needsUpdate = true;
    if (bestP) { popLight.position.set(bestP.x, bestP.y + 6, bestP.z); popLight.intensity = 2600 * best; } else popLight.intensity = 0;
    // light: the aurora from the north (green, red-tinged), the sky, the city's glow from below while it lasts
    const ac = tmpC.setRGB(0.25 + 0.75 * aR * (1 - 0.6 * aG), 0.35 + 0.65 * aG, 0.45 + 0.1 * aG);
    auroraLight.color.copy(ac); auroraLight.intensity = 0.32 * aur;
    auroraLight.position.set(C.x, C.y + 160, C.z - 220); auroraLight.target.position.set(C.x, C.y, C.z);
    hemi.color.set('#46506c').lerp(tmpC.setRGB(0.32, 0.62, 0.48), 0.45 * aur * aG); hemi.groundColor.set('#22201f').lerp(tmpC.set('#6a4a32'), 0.8 * lit);
    hemi.intensity = 0.22 + 0.22 * aur;
    const fwd = new THREE.Vector3(-Math.sin(C.yaw) * Math.cos(C.pitch), Math.sin(C.pitch), -Math.cos(C.yaw) * Math.cos(C.pitch));
    fill.position.set(C.x, C.y + 0.6, C.z).addScaledVector(fwd, -0.8); fill.intensity = C.wide ? 0 : 2.2;
    fog.color.set('#1a2030').lerp(tmpC.set('#3a2a24'), 0.5 * lit);
    // the flag
    const P = flag.geometry.attributes.position, b0 = flag.userData.base;
    for (let i = 0; i < P.count; i++) { const x = b0[i * 3], y = b0[i * 3 + 1], k = (x + 0.9) / 1.8; P.setZ(i, Math.sin(x * 4 - s * 4 + y) * 0.1 * k); }
    P.needsUpdate = true; flag.geometry.computeVertexNormals();
    // you: hands on the coping (they grip at the bang); your right hand goes to your phone
    const gk = U.clamp(TL.shake(s) * 3), ph = TL.phone(s);
    handsGrp.visible = !C.wide; setPersonVisible(heroFig, C.wide); heroFig.updateMatrixWorld(true);
    phone.visible = ph > 0.01 && !C.wide;
    if (phone.visible) {
      phone.position.set(0.07 - 0.025 * ph, -0.62 + 0.48 * U.easeOut(ph), -0.36); phone.rotation.set(0.3, -0.12, 0.05);
      const ns = TL.noSignal(s); if (ns !== lastNoSignal) { phoneScreen(ns); lastNoSignal = ns; }
      phone.updateMatrixWorld(true);
    }
    heroHands.forEach((h, i) => {
      const sg = i ? 1 : -1, onPhone = i === 1 && phone.visible;
      h.visible = !onPhone; h.position.set(sg * 0.15, 43.087, -5.46 - 0.075 * gk); setCurl(h, 0.2 + 0.85 * gk); h.updateMatrixWorld(true);
      const Wr = onPhone ? phoneHand.localToWorld(new THREE.Vector3(0, 0.004, 0.105)) : h.localToWorld(new THREE.Vector3(0, 0.004, 0.105));
      const S = C.wide ? heroFig.localToWorld(heroFig.userData.shoulders[i].clone()) : new THREE.Vector3(C.x + sg * 0.2, C.y - 0.26, C.z + 0.03);
      const E = ik(S, Wr, 0.4, 0.44, new THREE.Vector3(sg * 0.8, -0.6, 0.1));
      if (C.wide) poseArm(heroFig, i, S, E, Wr, null);
      else { setLimb(povArms[i].up, S, E); setLimb(povArms[i].fore, E, Wr); povArms[i].el.position.copy(E); }
    });
    // your friend: right arm down; his left arm rises and points exactly at the red glow
    friend.updateMatrixWorld(true);
    const k = U.easeInOut(TL.point(s));
    {
      const S = friend.localToWorld(friend.userData.shoulders[1].clone()), E = S.clone().add(new THREE.Vector3(0.03, -0.3, -0.02)), Wr = E.clone().add(new THREE.Vector3(-0.01, -0.27, -0.05));
      poseArm(friend, 1, S, E, Wr, friendHands[1], Wr.clone().sub(E).normalize());
    }
    {
      const S = friend.localToWorld(friend.userData.shoulders[0].clone()), d = dirAzEl(TL.POINT_AT.az, TL.POINT_AT.el);
      const E0 = S.clone().add(new THREE.Vector3(-0.03, -0.3, -0.02)), W0 = E0.clone().add(new THREE.Vector3(0.01, -0.27, -0.05));
      const E = E0.lerp(S.clone().addScaledVector(d, 0.29), k), Wr = W0.lerp(S.clone().addScaledVector(d, 0.56), k);
      friendHands[0].userData.fingers[3].ext = k > 0.5; setCurl(friendHands[0], 0.9);
      poseArm(friend, 0, S, E, Wr, friendHands[0], Wr.clone().sub(E).normalize());
    }
    lampMat.uniforms.uScale.value = 70 / C.fov;
  }

  function prepare(t) { init(); update(t); }
  function draw() { renderer.render(scene, camera); return canvas; }
  function render(t) { prepare(t); return draw(); }
  const v3 = new THREE.Vector3();
  function project(x, y, z) { init(); v3.set(x, y, z).project(camera); return { x: (v3.x * 0.5 + 0.5) * W, y: (-v3.y * 0.5 + 0.5) * HT, d: camera.position.distanceTo(new THREE.Vector3(x, y, z)), vis: v3.z < 1 && v3.z > -1 }; }
  g.World = { init, prepare, draw, render, project };
})(window);

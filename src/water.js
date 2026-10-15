// Original, dependency-free water distortion. The photograph supplies the fine
// foam detail; independent wave fields deform it and move the reflected light.
// At most 30 frames/s and 1 million pixels, regardless of display pixel density.
const vertexSource = `
attribute vec2 position;
varying vec2 uv;
void main() {
  uv = position * .5 + .5;
  gl_Position = vec4(position, 0., 1.);
}`;
const fragmentSource = `
precision mediump float;
varying vec2 uv;
uniform sampler2D sea;
uniform vec2 cover;
uniform float aspect;
uniform vec4 phase;

void main() {
  vec2 p = vec2(uv.x * aspect, uv.y);
  // Nonparallel swell, cross-sea and finer ripples never move as one flat sheet.
  float a = dot(p, vec2(9.2, 12.4)) - phase.x;
  float b = dot(p, vec2(-15.8, 8.3)) - phase.y;
  float c = dot(p, vec2(27.3, 19.1)) - phase.z;
  float d = dot(p, vec2(-43.1, 31.7)) - phase.w;
  vec2 flow = vec2(
    sin(a) * .010 + sin(b) * .007 + sin(c) * .002,
    cos(a) * .014 + cos(b) * .009 + sin(d) * .0015
  );
  vec2 sampleUV = (uv - .5) * cover * .93 + .5;
  vec3 water = texture2D(sea, sampleUV + flow * cover).rgb;
  vec2 slope = vec2(
    cos(a) * .30 - cos(b) * .22 + cos(c) * .12,
    cos(a) * .40 + cos(b) * .18 + cos(d) * .08
  );
  vec3 normal = normalize(vec3(-slope.x, 1., -slope.y));
  float shimmer = pow(max(dot(normal, normalize(vec3(.18, 1., .35))), 0.), 32.);
  float crest = sin(a) * .45 + sin(b) * .3 + sin(c) * .12;
  water *= .89 + .16 * crest;
  water += vec3(.30, .48, .48) * shimmer * .13;
  // Cooler, deeper water toward the horizon; avoid a bright wash behind names.
  water = mix(water, vec3(.025, .13, .17), smoothstep(.28, 1., uv.y) * .22);
  gl_FragColor = vec4(water, 1.);
}`;

export function initWater() {
  const canvas = document.getElementById("caspian-canvas");
  if (!canvas) return;
  const root = document.documentElement;
  let gl, program, texture, buffer, locations;
  let frame = 0;
  let previous = 0;
  let elapsed = 0;
  let ready = false;
  let failed = false;
  let image;
  let loading = false;
  const enabled = () =>
    !root.classList.contains("motion-paused") && !document.hidden;
  function resize() {
    if (!gl || !ready) return;
    const scale = Math.min(
      1,
      Math.sqrt(1_000_000 / (innerWidth * innerHeight)),
    );
    canvas.width = Math.max(1, Math.round(innerWidth * scale));
    canvas.height = Math.max(1, Math.round(innerHeight * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
    const aspect = canvas.width / canvas.height;
    const imageAspect = image.width / image.height;
    gl.uniform1f(locations.aspect, aspect);
    gl.uniform2f(
      locations.cover,
      Math.min(1, aspect / imageAspect),
      Math.min(1, imageAspect / aspect),
    );
    draw();
  }
  function draw() {
    // Bounded phases retain mediump precision even during all-day kiosk use.
    const cycle = Math.PI * 2;
    gl.uniform4f(
      locations.phase,
      (elapsed * 0.64) % cycle,
      (elapsed * 0.47) % cycle,
      (elapsed * 1.12) % cycle,
      (elapsed * 1.38) % cycle,
    );
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  function animate(now) {
    frame = 0;
    if (!ready || !enabled()) return;
    if (!previous) previous = now;
    if (now - previous >= 1000 / 30) {
      elapsed += Math.min((now - previous) / 1000, 0.1);
      previous = now;
      draw();
    }
    frame = requestAnimationFrame(animate);
  }
  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    previous = 0;
  }
  function fallback() {
    stop();
    ready = false;
    canvas.dataset.renderer = "fallback";
    canvas.classList.remove("water-ready");
  }
  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      throw new Error("Water shader unavailable");
    }
    return shader;
  }
  function setup() {
    try {
      gl = canvas.getContext("webgl", {
        alpha: false,
        antialias: false,
        depth: false,
        powerPreference: "low-power",
      });
      if (!gl) throw new Error("WebGL unavailable");
      program = gl.createProgram();
      const shaders = [
        compile(gl.VERTEX_SHADER, vertexSource),
        compile(gl.FRAGMENT_SHADER, fragmentSource),
      ];
      for (const shader of shaders) gl.attachShader(program, shader);
      gl.linkProgram(program);
      for (const shader of shaders) gl.deleteShader(shader);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        throw new Error("Water program unavailable");
      gl.useProgram(program);
      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW,
      );
      const position = gl.getAttribLocation(program, "position");
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
      locations = Object.fromEntries(
        ["phase", "cover", "aspect"].map((name) => [
          name,
          gl.getUniformLocation(program, name),
        ]),
      );
      ready = true;
      resize();
      canvas.dataset.renderer = "webgl";
      canvas.classList.add("water-ready");
      sync();
    } catch {
      failed = true;
      fallback();
      if (gl && !gl.isContextLost()) {
        gl.deleteTexture(texture);
        gl.deleteBuffer(buffer);
        gl.deleteProgram(program);
      }
    }
  }
  function sync() {
    stop();
    if (!enabled() || failed) return;
    if (ready) frame = requestAnimationFrame(animate);
    else if (!loading) {
      loading = true;
      image = new Image();
      image.onload = setup;
      image.onerror = () => {
        failed = true;
        fallback();
      };
      image.src = new URL("../assets/caspian-water.webp", import.meta.url).href;
    }
  }
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    fallback();
  });
  canvas.addEventListener("webglcontextrestored", () => {
    failed = false;
    setup();
  });
  document.addEventListener("shtil-motion-change", sync);
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("resize", resize);
  window.addEventListener("pagehide", stop);
  window.addEventListener("pageshow", sync);
  canvas.dataset.renderer = "fallback";
  sync();
}

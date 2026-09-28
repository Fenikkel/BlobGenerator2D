const defaults = {
  seed: 48291,
  points: 7,
  noise: 36,
  roundness: 78,
  scale: 82,
  rotation: 0,
  colorA: "#92c39d",
  colorB: "#deefe1",
  gradientAngle: 135,
  fillMode: "solid",
};

const state = { ...defaults };

const elements = {
  path: document.querySelector("#blobPath"),
  gradient: document.querySelector("#blobGradient"),
  gradientStart: document.querySelector("#gradientStart"),
  gradientEnd: document.querySelector("#gradientEnd"),
  randomize: document.querySelector("#randomizeButton"),
  reset: document.querySelector("#resetButton"),
  download: document.querySelector("#downloadButton"),
  exportSize: document.querySelector("#exportSize"),
  toast: document.querySelector("#toast"),
  colorBField: document.querySelector("#colorBField"),
  seed: document.querySelector("#seed"),
  shuffleSeed: document.querySelector("#shuffleSeed"),
};

const rangeConfig = {
  points: { suffix: "" },
  noise: { suffix: "%" },
  roundness: { suffix: "%" },
  scale: { suffix: "%" },
  rotation: { suffix: "°" },
  gradientAngle: { suffix: "°" },
};

function mulberry32(seed) {
  return function random() {
    let value = seed += 0x6D2B79F5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function getBlobPoints() {
  const random = mulberry32(Number(state.seed));
  const count = Number(state.points);
  const baseRadius = 365 * (Number(state.scale) / 100);
  const variance = Number(state.noise) / 100;
  const rotation = Number(state.rotation) * Math.PI / 180;
  const raw = [];

  for (let i = 0; i < count; i += 1) raw.push(random() * 2 - 1);

  // Smooth adjacent random radii so the silhouette stays organic, not spiky.
  return raw.map((value, index) => {
    const previous = raw[(index - 1 + count) % count];
    const next = raw[(index + 1) % count];
    const softened = value * .58 + previous * .21 + next * .21;
    // Keep even the most extreme combinations inside the square export area.
    const radius = Math.min(440, baseRadius * (1 + softened * variance));
    const angle = (Math.PI * 2 * index / count) - Math.PI / 2 + rotation;
    return { x: 500 + Math.cos(angle) * radius, y: 500 + Math.sin(angle) * radius };
  });
}

function buildPath(points) {
  const tension = Number(state.roundness) / 100 * 1.34;
  const count = points.length;
  const parts = [`M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`];

  for (let i = 0; i < count; i += 1) {
    const p0 = points[(i - 1 + count) % count];
    const p1 = points[i];
    const p2 = points[(i + 1) % count];
    const p3 = points[(i + 2) % count];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6 * tension, y: p1.y + (p2.y - p0.y) / 6 * tension };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6 * tension, y: p2.y - (p3.y - p1.y) / 6 * tension };
    parts.push(`C ${c1.x.toFixed(2)} ${c1.y.toFixed(2)}, ${c2.x.toFixed(2)} ${c2.y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`);
  }
  return `${parts.join(" ")} Z`;
}

function gradientCoordinates(angle) {
  const radians = (angle - 90) * Math.PI / 180;
  const x = Math.cos(radians) * .5;
  const y = Math.sin(radians) * .5;
  return { x1: .5 - x, y1: .5 - y, x2: .5 + x, y2: .5 + y };
}

function updateRangeAppearance(input) {
  const percent = (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100;
  input.style.setProperty("--range-progress", `${percent}%`);
}

function render() {
  const pathData = buildPath(getBlobPoints());
  const coordinates = gradientCoordinates(Number(state.gradientAngle));
  elements.path.setAttribute("d", pathData);
  elements.path.setAttribute("fill", state.fillMode === "gradient" ? "url(#blobGradient)" : state.colorA);
  elements.gradientStart.setAttribute("stop-color", state.colorA);
  elements.gradientEnd.setAttribute("stop-color", state.colorB);
  Object.entries(coordinates).forEach(([key, value]) => elements.gradient.setAttribute(key, value));

  Object.entries(rangeConfig).forEach(([id, config]) => {
    const input = document.querySelector(`#${id}`);
    document.querySelector(`#${id}Value`).textContent = `${input.value}${config.suffix}`;
    updateRangeAppearance(input);
  });
  document.querySelector("#colorAValue").textContent = state.colorA.toUpperCase();
  document.querySelector("#colorBValue").textContent = state.colorB.toUpperCase();
}

Object.keys(rangeConfig).forEach((id) => {
  const input = document.querySelector(`#${id}`);
  input.addEventListener("input", () => {
    state[id] = Number(input.value);
    render();
  });
});

["colorA", "colorB"].forEach((id) => {
  const input = document.querySelector(`#${id}`);
  input.addEventListener("input", () => {
    state[id] = input.value;
    render();
  });
});

document.querySelectorAll(".fill-mode").forEach((button) => {
  button.addEventListener("click", () => {
    state.fillMode = button.dataset.mode;
    document.querySelectorAll(".fill-mode").forEach((item) => item.classList.toggle("active", item === button));
    elements.colorBField.classList.toggle("disabled", state.fillMode === "solid");
    document.querySelector("#gradientAngle").disabled = state.fillMode === "solid";
    render();
  });
});

function setValues(values) {
  Object.assign(state, values);
  Object.keys(rangeConfig).forEach((id) => { document.querySelector(`#${id}`).value = state[id]; });
  document.querySelector("#colorA").value = state.colorA;
  document.querySelector("#colorB").value = state.colorB;
  elements.seed.value = state.seed;
  document.querySelectorAll(".fill-mode").forEach((item) => item.classList.toggle("active", item.dataset.mode === state.fillMode));
  elements.colorBField.classList.toggle("disabled", state.fillMode === "solid");
  document.querySelector("#gradientAngle").disabled = state.fillMode === "solid";
  render();
}

elements.randomize.addEventListener("click", () => {
  const hue = Math.floor(Math.random() * 360);
  setValues({
    seed: Math.floor(10000 + Math.random() * 89999),
    points: Math.floor(5 + Math.random() * 6),
    noise: Math.floor(22 + Math.random() * 35),
    roundness: Math.floor(62 + Math.random() * 35),
    rotation: Math.floor(Math.random() * 360),
    gradientAngle: Math.floor(Math.random() * 360),
    colorA: hslToHex(hue, 78, 62),
    colorB: hslToHex((hue + 45 + Math.random() * 90) % 360, 82, 68),
  });
});

function makeSeed() {
  return Math.floor(10000 + Math.random() * 989999);
}

elements.seed.addEventListener("input", () => {
  const nextSeed = Math.max(1, Math.min(999999, Number(elements.seed.value) || 1));
  state.seed = nextSeed;
  render();
});

elements.seed.addEventListener("blur", () => { elements.seed.value = state.seed; });
elements.shuffleSeed.addEventListener("click", () => setValues({ seed: makeSeed() }));

elements.reset.addEventListener("click", () => setValues({ ...defaults }));

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const section = h / 60;
  const second = chroma * (1 - Math.abs(section % 2 - 1));
  const lightness = l - chroma / 2;
  const pairs = section < 1 ? [chroma, second, 0] : section < 2 ? [second, chroma, 0] : section < 3 ? [0, chroma, second] : section < 4 ? [0, second, chroma] : section < 5 ? [second, 0, chroma] : [chroma, 0, second];
  return `#${pairs.map((channel) => Math.round((channel + lightness) * 255).toString(16).padStart(2, "0")).join("")}`;
}

function drawBlobToCanvas(context, size) {
  const ratio = size / 1000;
  const path = new Path2D(buildPath(getBlobPoints()));
  context.save();
  context.scale(ratio, ratio);

  if (state.fillMode === "gradient") {
    const coords = gradientCoordinates(Number(state.gradientAngle));
    const gradient = context.createLinearGradient(coords.x1 * 1000, coords.y1 * 1000, coords.x2 * 1000, coords.y2 * 1000);
    gradient.addColorStop(0, state.colorA);
    gradient.addColorStop(1, state.colorB);
    context.fillStyle = gradient;
  } else {
    context.fillStyle = state.colorA;
  }
  context.fill(path);
  context.restore();
}

elements.download.addEventListener("click", () => {
  const size = Number(elements.exportSize.value);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, size, size);
  drawBlobToCanvas(context, size);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `blob-${state.seed}-${size}x${size}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    elements.toast.textContent = `${size} px downloaded`;
    elements.toast.classList.add("show");
    setTimeout(() => elements.toast.classList.remove("show"), 2400);
  }, "image/png");
});

render();

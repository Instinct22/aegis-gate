const header = document.querySelector(".site-header");
const onScroll = () => {
  if (!header) return;
  header.style.borderBottomColor =
    window.scrollY > 12 ? "rgba(100, 200, 230, 0.28)" : "rgba(100, 200, 230, 0.16)";
};
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

const canvas = document.getElementById("net");
if (canvas) {
  const ctx = canvas.getContext("2d");
  const params = new URLSearchParams(location.search);
  const forceStill = params.get("motion") === "0";
  const preferReduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const reduceMotion = forceStill;
  const slowMotion = !forceStill && preferReduce;

  /**
   * Реальные rough-размеры (угловой размах, °) — масштаб на экране
   * пропорционален sizeDeg / REF_DEG.
   */
  const REF_DEG = 25; // Большая Медведица как эталон «крупного»
  const CATALOG = [
    {
      id: "ursa-major",
      sizeDeg: 25,
      // Ковш Большой Медведицы
      anchors: [
        [-0.42, -0.08],
        [-0.18, -0.04],
        [0.05, 0.0],
        [0.32, 0.05],
        [0.42, 0.28],
        [0.18, 0.38],
        [-0.05, 0.3],
      ],
      edges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 5],
        [5, 6],
        [6, 3],
      ],
    },
    {
      id: "orion",
      sizeDeg: 20,
      anchors: [
        [-0.28, -0.38],
        [0.3, -0.34],
        [-0.16, -0.02],
        [0.0, 0.02],
        [0.16, -0.02],
        [-0.22, 0.4],
        [0.24, 0.42],
      ],
      edges: [
        [0, 1],
        [0, 2],
        [1, 4],
        [2, 3],
        [3, 4],
        [2, 5],
        [4, 6],
      ],
    },
    {
      id: "cassiopeia",
      sizeDeg: 15,
      anchors: [
        [-0.48, 0.18],
        [-0.22, -0.28],
        [0.0, 0.12],
        [0.24, -0.28],
        [0.48, 0.18],
      ],
      edges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
      ],
    },
    {
      id: "cygnus",
      sizeDeg: 22,
      anchors: [
        [0.0, -0.48],
        [0.0, -0.12],
        [0.0, 0.36],
        [-0.4, 0.0],
        [0.4, 0.0],
      ],
      edges: [
        [0, 1],
        [1, 2],
        [1, 3],
        [1, 4],
      ],
    },
    {
      id: "leo",
      sizeDeg: 24,
      anchors: [
        [-0.1, -0.4],
        [0.18, -0.28],
        [0.38, -0.08],
        [0.22, 0.12],
        [-0.05, 0.18],
        [-0.35, 0.05],
        [-0.42, -0.2],
        [0.05, 0.4],
      ],
      edges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 5],
        [5, 6],
        [6, 0],
        [4, 7],
      ],
    },
    {
      id: "scorpius",
      sizeDeg: 30,
      anchors: [
        [-0.08, -0.42],
        [0.08, -0.36],
        [0.0, -0.18],
        [-0.05, 0.0],
        [-0.12, 0.18],
        [-0.02, 0.32],
        [0.18, 0.4],
        [0.32, 0.28],
      ],
      edges: [
        [0, 1],
        [0, 2],
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 5],
        [5, 6],
        [6, 7],
      ],
    },
    {
      id: "lyra",
      sizeDeg: 7,
      anchors: [
        [0.0, -0.35],
        [-0.28, 0.05],
        [-0.12, 0.35],
        [0.18, 0.32],
        [0.32, 0.0],
      ],
      edges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 0],
        [1, 4],
      ],
    },
    {
      id: "crux",
      sizeDeg: 6,
      anchors: [
        [0.0, -0.42],
        [0.0, 0.42],
        [-0.38, 0.05],
        [0.36, -0.08],
      ],
      edges: [
        [0, 1],
        [2, 3],
      ],
    },
    {
      id: "delphinus",
      sizeDeg: 5,
      anchors: [
        [-0.15, -0.35],
        [0.2, -0.2],
        [0.28, 0.15],
        [-0.05, 0.35],
        [-0.35, 0.05],
      ],
      edges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 0],
      ],
    },
    {
      id: "aquila",
      sizeDeg: 18,
      anchors: [
        [0.0, -0.4],
        [-0.22, -0.05],
        [0.0, 0.05],
        [0.22, -0.05],
        [0.0, 0.42],
      ],
      edges: [
        [0, 2],
        [1, 2],
        [2, 3],
        [2, 4],
      ],
    },
  ];

  /** @type {{x:number,y:number,homeX:number,homeY:number,r:number,twinkle:number,phase:number,brightness:number}[]} */
  let stars = [];
  /** @type {{cx:number,cy:number,slot:number}[]} */
  let zones = [];
  /**
   * Активные формации: у каждой свой набор уникальных звёзд (без пересечений).
   * @type {{catalogId:string,zone:number,nodes:number[],edges:[number,number][],targets:{x:number,y:number}[],weight:number,born:number,life:number}[]}
   */
  let formations = [];
  /**
   * Редкие пролёты: meteors (быстрые с хвостом) и wanderers (яркие «звёзды»).
   * @type {{kind:'meteor'|'wanderer', x:number, y:number, vx:number, vy:number, life:number, age:number, len:number, width:number, hue:number}[]}
   */
  let flyers = [];
  let w = 0;
  let h = 0;
  let raf = 0;
  let t0 = performance.now();
  let nextReshuffleAt = 0;
  let nextMeteorAt = 0;
  let nextWandererAt = 0;

  const EPOCH_MS = 14000;
  const FADE_MS = 2200;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const buildZones = () => {
    // Разные области экрана — созвездия не собираются в одной куче.
    const layout =
      w < 720
        ? [
            [0.5, 0.22],
            [0.28, 0.55],
            [0.72, 0.58],
            [0.5, 0.82],
          ]
        : [
            [0.2, 0.22],
            [0.78, 0.2],
            [0.18, 0.7],
            [0.82, 0.72],
            [0.5, 0.45],
          ];
    zones = layout.map(([nx, ny], slot) => ({
      cx: nx * w,
      cy: ny * h,
      slot,
    }));
  };

  const buildStars = () => {
    const count = clamp(Math.floor((w * h) / 9000), 80, 160);
    stars = Array.from({ length: count }, (_, i) => {
      const homeX = Math.random() * w;
      const homeY = Math.random() * h;
      return {
        x: homeX,
        y: homeY,
        homeX,
        homeY,
        r: i % 11 === 0 ? 2.3 : i % 5 === 0 ? 1.55 : 0.95 + Math.random() * 0.55,
        twinkle: Math.random() * Math.PI * 2,
        phase: Math.random() * Math.PI * 2,
        brightness: 0.45 + Math.random() * 0.55,
      };
    });
  };

  const baseScaleFor = (sizeDeg) => {
    const span = Math.min(w, h);
    // Крупные (~25–30°) ≈ 28% меньшей стороны; мелкие (Crux 6°) ≈ 7%.
    return span * 0.28 * (sizeDeg / REF_DEG);
  };

  const pickNearestFree = (tx, ty, used) => {
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < stars.length; i++) {
      if (used.has(i)) continue;
      const s = stars[i];
      // Берём звёзды из «домашней» позиции — они разбросаны по всему экрану.
      const d = Math.hypot(s.homeX - tx, s.homeY - ty);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  };

  const reshuffle = (now) => {
    const picks = shuffle(CATALOG).slice(0, zones.length);
    const used = new Set();
    const next = [];

    for (let z = 0; z < zones.length; z++) {
      const catalog = picks[z];
      if (!catalog) break;
      const zone = zones[z];
      // Лёгкий дрейф центра зоны, чтобы картина не была жёсткой сеткой.
      const jitterX = (Math.random() - 0.5) * w * 0.06;
      const jitterY = (Math.random() - 0.5) * h * 0.06;
      const cx = clamp(zone.cx + jitterX, w * 0.12, w * 0.88);
      const cy = clamp(zone.cy + jitterY, h * 0.12, h * 0.88);
      const scale = baseScaleFor(catalog.sizeDeg);
      const rot = (Math.random() - 0.5) * 0.5;
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);

      const targets = catalog.anchors.map(([ax, ay]) => {
        const rx = ax * cos - ay * sin;
        const ry = ax * sin + ay * cos;
        return { x: cx + rx * scale, y: cy + ry * scale };
      });

      const nodes = [];
      for (const t of targets) {
        const idx = pickNearestFree(t.x, t.y, used);
        if (idx < 0) break;
        used.add(idx);
        nodes.push(idx);
      }
      if (nodes.length !== catalog.anchors.length) continue;

      next.push({
        catalogId: catalog.id,
        zone: z,
        nodes,
        edges: catalog.edges,
        targets,
        weight: 0,
        born: now,
        life: EPOCH_MS,
      });
    }

    formations = next;
    nextReshuffleAt = now + EPOCH_MS;
  };

  const formationWeight = (f, now) => {
    const age = now - f.born;
    if (age < FADE_MS) return smooth(age / FADE_MS);
    if (age > f.life - FADE_MS) return smooth((f.life - age) / FADE_MS);
    return 1;
  };

  const updateStars = (now) => {
    /** @type {Map<number, {x:number,y:number,w:number}>} */
    const pulls = new Map();

    for (const f of formations) {
      const weight = formationWeight(f, now);
      f.weight = weight;
      if (weight < 0.02) continue;
      f.nodes.forEach((starIndex, i) => {
        const t = f.targets[i];
        pulls.set(starIndex, { x: t.x, y: t.y, w: weight });
      });
    }

    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const driftX = Math.sin(now * 0.00012 + s.phase) * 8;
      const driftY = Math.cos(now * 0.0001 + s.twinkle) * 6;
      const home = { x: s.homeX + driftX, y: s.homeY + driftY };
      const pull = pulls.get(i);
      let tx = home.x;
      let ty = home.y;
      if (pull) {
        tx = lerp(home.x, pull.x, clamp(pull.w, 0, 1));
        ty = lerp(home.y, pull.y, clamp(pull.w, 0, 1));
      }
      const ease = reduceMotion ? 1 : slowMotion ? 0.025 : 0.05;
      s.x = lerp(s.x, tx, ease);
      s.y = lerp(s.y, ty, ease);
    }
  };

  const spawnMeteor = () => {
    // Старт у края экрана, диагональный пролёт.
    const fromTop = Math.random() < 0.55;
    const x = fromTop ? Math.random() * w * 0.85 : -40;
    const y = fromTop ? -30 : Math.random() * h * 0.55;
    const speed = (slowMotion ? 0.35 : 0.55) + Math.random() * 0.55;
    const angle = Math.PI * (0.12 + Math.random() * 0.28); // вниз-вправо
    flyers.push({
      kind: "meteor",
      x,
      y,
      vx: Math.cos(angle) * speed * (10 + Math.random() * 10),
      vy: Math.sin(angle) * speed * (10 + Math.random() * 10),
      life: 700 + Math.random() * 900,
      age: 0,
      len: 55 + Math.random() * 90,
      width: 1.2 + Math.random() * 1.4,
      hue: Math.random() < 0.35 ? 200 : 175,
    });
  };

  const spawnWanderer = () => {
    // Медленная яркая «звезда» / болид без длинного хвоста.
    const left = Math.random() < 0.5;
    const y = h * (0.12 + Math.random() * 0.7);
    const speed = (slowMotion ? 0.08 : 0.14) + Math.random() * 0.12;
    flyers.push({
      kind: "wanderer",
      x: left ? -20 : w + 20,
      y,
      vx: (left ? 1 : -1) * speed * (4 + Math.random() * 5),
      vy: (Math.random() - 0.5) * 0.6,
      life: 4500 + Math.random() * 3500,
      age: 0,
      len: 18 + Math.random() * 22,
      width: 2 + Math.random() * 1.5,
      hue: Math.random() < 0.5 ? 185 : 210,
    });
  };

  const updateFlyers = (dt) => {
    if (reduceMotion) {
      flyers = [];
      return;
    }
    for (const f of flyers) {
      f.age += dt;
      f.x += f.vx * (dt / 16.7);
      f.y += f.vy * (dt / 16.7);
    }
    flyers = flyers.filter(
      (f) =>
        f.age < f.life &&
        f.x > -120 &&
        f.x < w + 120 &&
        f.y > -120 &&
        f.y < h + 120,
    );
  };

  const maybeSpawnFlyers = (now) => {
    if (reduceMotion) return;
    if (now >= nextMeteorAt) {
      // Изредка: обычно 1 метеор, иногда короткий «дождь» из 2–3.
      const burst = Math.random() < 0.18 ? 2 + Math.floor(Math.random() * 2) : 1;
      for (let i = 0; i < burst; i++) {
        setTimeout(() => spawnMeteor(), i * (180 + Math.random() * 220));
      }
      nextMeteorAt = now + 2800 + Math.random() * 6500;
    }
    if (now >= nextWandererAt) {
      spawnWanderer();
      nextWandererAt = now + 7000 + Math.random() * 12000;
    }
  };

  const drawFlyers = () => {
    for (const f of flyers) {
      const fadeIn = clamp(f.age / 120, 0, 1);
      const fadeOut = clamp((f.life - f.age) / 220, 0, 1);
      const alpha = fadeIn * fadeOut;
      if (alpha < 0.02) continue;

      const speed = Math.hypot(f.vx, f.vy) || 1;
      const ux = f.vx / speed;
      const uy = f.vy / speed;
      const tailX = f.x - ux * f.len;
      const tailY = f.y - uy * f.len;

      if (f.kind === "meteor") {
        const grad = ctx.createLinearGradient(tailX, tailY, f.x, f.y);
        grad.addColorStop(0, `hsla(${f.hue}, 90%, 70%, 0)`);
        grad.addColorStop(0.55, `hsla(${f.hue}, 95%, 72%, ${0.35 * alpha})`);
        grad.addColorStop(1, `hsla(${f.hue + 20}, 100%, 88%, ${0.95 * alpha})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = f.width;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(f.x, f.y);
        ctx.stroke();

        ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * alpha})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.width * 1.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowColor = `hsla(${f.hue}, 100%, 70%, ${0.6 * alpha})`;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        // Яркая медленная звезда с коротким шлейфом.
        const grad = ctx.createLinearGradient(tailX, tailY, f.x, f.y);
        grad.addColorStop(0, `hsla(${f.hue}, 80%, 65%, 0)`);
        grad.addColorStop(1, `hsla(${f.hue}, 90%, 80%, ${0.45 * alpha})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = f.width * 0.7;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(f.x, f.y);
        ctx.stroke();

        const glow = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 10);
        glow.addColorStop(0, `rgba(255, 255, 255, ${0.95 * alpha})`);
        glow.addColorStop(0.35, `hsla(${f.hue}, 100%, 70%, ${0.55 * alpha})`);
        glow.addColorStop(1, "rgba(47, 125, 255, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(f.x, f.y, 10, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  const drawLinks = () => {
    for (const f of formations) {
      if (f.weight < 0.03) continue;
      const alpha = 0.18 + f.weight * 0.65;
      ctx.lineWidth = 1 + f.weight * 0.85;
      ctx.strokeStyle = `rgba(160, 240, 255, ${alpha})`;
      ctx.shadowColor = `rgba(47, 227, 208, ${0.3 * f.weight})`;
      ctx.shadowBlur = 12 * f.weight;
      ctx.beginPath();
      for (const [a, b] of f.edges) {
        const sa = stars[f.nodes[a]];
        const sb = stars[f.nodes[b]];
        if (!sa || !sb) continue;
        ctx.moveTo(sa.x, sa.y);
        ctx.lineTo(sb.x, sb.y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  };

  const drawStars = (now) => {
    const claimed = new Set();
    for (const f of formations) {
      if (f.weight > 0.15) f.nodes.forEach((i) => claimed.add(i));
    }

    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const tw = 0.55 + 0.45 * Math.sin(now * 0.002 + s.twinkle);
      const boost = claimed.has(i) ? 1.25 : 1;
      const a = s.brightness * tw * boost;
      const r = s.r * (0.85 + 0.2 * tw) * (claimed.has(i) ? 1.15 : 1);

      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 4);
      g.addColorStop(0, `rgba(232, 248, 255, ${0.5 * a})`);
      g.addColorStop(0.4, `rgba(47, 227, 208, ${0.2 * a})`);
      g.addColorStop(1, "rgba(47, 125, 255, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r * 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(235, 250, 255, ${0.5 + 0.5 * Math.min(a, 1)})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  let lastFrame = performance.now();

  const frame = (now) => {
    const dt = clamp(now - lastFrame, 0, 48);
    lastFrame = now;
    const clock = slowMotion ? t0 + (now - t0) * 0.5 : now;
    if (clock >= nextReshuffleAt || !formations.length) reshuffle(clock);
    maybeSpawnFlyers(clock);
    updateFlyers(dt);
    ctx.clearRect(0, 0, w, h);
    updateStars(clock);
    drawLinks();
    drawStars(clock);
    drawFlyers();
    raf = requestAnimationFrame(frame);
  };

  const drawStill = () => {
    reshuffle(performance.now());
    for (const f of formations) f.weight = 1;
    updateStars(performance.now());
    ctx.clearRect(0, 0, w, h);
    drawLinks();
    drawStars(performance.now());
  };

  const resize = () => {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    buildZones();
    buildStars();
    formations = [];
    flyers = [];
    nextReshuffleAt = 0;
    nextMeteorAt = performance.now() + 800;
    nextWandererAt = performance.now() + 2500;
  };

  resize();
  if (reduceMotion) drawStill();
  else raf = requestAnimationFrame(frame);

  window.addEventListener("resize", () => {
    cancelAnimationFrame(raf);
    resize();
    if (reduceMotion) drawStill();
    else raf = requestAnimationFrame(frame);
  });
}

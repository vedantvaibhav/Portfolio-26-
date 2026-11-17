/**
 * Builds the wormhole's point cloud. This is the slow part (a noise pattern
 * tested against a couple of million candidate points), so it runs once, in
 * a Web Worker, and the scene fades the cloud in when it arrives.
 *
 * generateCloud must stay self contained: it is turned into text and run
 * inside the worker, so it cannot call anything defined outside itself.
 */
export type Cloud = {
  /** start, turn, height: three 16 bit values per point. */
  flow: Uint16Array;
  /** vary, dunes, glint, kind: four 8 bit values per point. */
  look: Uint8Array;
  count: number;
};

export function generateCloud(count: number): Cloud {
  let seed = 8128;
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // Value noise that repeats every `period` cells in x, so the pattern joins up around the hole.
  const cell = (ix: number, iy: number, period: number) => {
    ix = ((ix % period) + period) % period;
    let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const noise = (x: number, y: number, period: number) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    let fx = x - ix;
    let fy = y - iy;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    const a = cell(ix, iy, period);
    const b = cell(ix + 1, iy, period);
    const c = cell(ix, iy + 1, period);
    const d = cell(ix + 1, iy + 1, period);
    return a + (b - a) * fx + (c - a + (a - b - c + d) * fx) * fy;
  };
  const fbm = (x: number, y: number, period: number) => {
    let amplitude = 0.5;
    let sum = 0;
    for (let i = 0; i < 4; i++) {
      sum += amplitude * noise(x, y, period);
      x *= 2;
      y = y * 2 + 17.3;
      period *= 2;
      amplitude *= 0.5;
    }
    return sum;
  };
  const smooth = (a: number, b: number, v: number) => {
    const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };

  const flow = new Uint16Array(count * 3);
  const look = new Uint8Array(count * 4);
  let made = 0;
  // Each point picks a spiral (turn) and a place along it (start). The pattern
  // decides whether matter is there: long streaks along the flow, slow dunes
  // across it, and a fine hair of lines. Points that land in a gap are dropped.
  for (let tries = 0; made < count && tries < count * 8; tries++) {
    const pop = random();
    const start = random();
    const turn = random();
    const spray = pop > 0.94;
    const dunes = fbm(turn * 3, start * 7 + 5, 3);
    if (!spray) {
      const lines = fbm(turn * 26, start * 4.5, 26);
      const hair = noise(turn * 230, start * 2.2, 230);
      const density = (0.04 + 0.96 * smooth(0.34, 0.62, lines * 0.6 + dunes * 0.4)) * (0.3 + 1.4 * hair);
      if (random() > density) continue;
    }
    // A bell curve from four rolls, good to about three widths either side.
    const gauss = (random() + random() + random() + random() - 2) * 0.87;
    flow[made * 3] = Math.round(start * 65535);
    flow[made * 3 + 1] = Math.round(turn * 65535);
    flow[made * 3 + 2] = Math.round(Math.min(1, Math.max(0, gauss / 6 + 0.5)) * 65535);
    look[made * 4] = Math.round(random() * 255);
    look[made * 4 + 1] = Math.round(dunes * 255);
    look[made * 4 + 2] = Math.round(Math.pow(random(), 12) * 255);   // one in a few hundred catches the light
    look[made * 4 + 3] = spray ? 255 : pop < 0.5 ? 128 : 0;          // loose, crowding the hole, or spread wide
    made++;
  }
  return { flow, look, count: made };
}

/** Run generateCloud off the main thread. Falls back to running it here if workers are not available. */
export function requestCloud(count: number): Promise<Cloud> {
  return new Promise((resolve) => {
    try {
      const source = `const generateCloud = ${generateCloud.toString()};
        onmessage = (event) => { const cloud = generateCloud(event.data); postMessage(cloud, [cloud.flow.buffer, cloud.look.buffer]); };`;
      const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
      const worker = new Worker(url);
      const finish = (cloud: Cloud) => {
        worker.terminate();
        URL.revokeObjectURL(url);
        resolve(cloud);
      };
      worker.onmessage = (event: MessageEvent<Cloud>) => finish(event.data);
      worker.onerror = () => finish(generateCloud(count));
      worker.postMessage(count);
    } catch {
      resolve(generateCloud(count));
    }
  });
}

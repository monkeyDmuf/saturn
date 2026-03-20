'use strict';

// --- AUDIO ENGINE (Spatial Resonance) ---
let audioCtx = null;
let mainGain = null;
let isAudioEnabled = false;
let lastAudioTime = 0;

const FREQS = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(v => v * 15 * 4);
const ANT_VOICES = ['sine', 'triangle', 'sawtooth', 'square', 'sine'];

function toggleAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    mainGain = audioCtx.createGain();
    mainGain.gain.value = 0.3; 
    mainGain.connect(audioCtx.destination);
  }
  
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  isAudioEnabled = !isAudioEnabled;
  const btn = document.getElementById('audio-toggle');
  if (btn) {
    if (isAudioEnabled) {
      btn.innerHTML = '&#128266; Disable Sound';
      btn.style.backgroundColor = 'rgb(135, 180, 225)';
    } else {
      btn.innerHTML = '&#128263; Enable Sound';
      btn.style.backgroundColor = '';
    }
  }
}

function playTone(val, antIdx = 0, dur = 0.15, vol = 0.1) {
  if (!isAudioEnabled || !audioCtx) return;
  
  const now = performance.now();
  if (dur < 1.0 && now - lastAudioTime < 25) return; 
  if (dur < 1.0) lastAudioTime = now;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.type = ANT_VOICES[antIdx % ANT_VOICES.length];
  osc.frequency.setValueAtTime(FREQS[val - 1], audioCtx.currentTime);
  
  if (osc.type === 'sawtooth' || osc.type === 'square') {
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    osc.connect(filter);
    filter.connect(gain);
  } else {
    osc.connect(gain);
  }
  
  gain.gain.setValueAtTime(0, audioCtx.currentTime);
  gain.gain.linearRampToValueAtTime(vol, audioCtx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  
  gain.connect(mainGain);
  
  osc.start();
  osc.stop(audioCtx.currentTime + dur);
}

function playConvergenceSequence() {
  if (!isAudioEnabled || !audioCtx) return;

  const coords = new Array(9);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      coords[colony.grid[r][c] - 1] = { x: c, y: r };
    }
  }

  let delay = 0;
  const baseTime = audioCtx.currentTime;

  const CHIME_FREQS = [240, 360, 480, 600, 720, 960, 1080, 1200, 1440];
  const PHI = 1.61803398875; 

  for (let i = 0; i < 9; i++) {
    let dist = 0;
    if (i > 0) {
      const dx = coords[i].x - coords[i-1].x;
      const dy = coords[i].y - coords[i-1].y;
      dist = Math.sqrt(dx*dx + dy*dy);
    }

    delay += dist * 0.35; 
    
    // "As Above, So Below" Octave Mapping
    const yOctave = Math.pow(2, 1 - coords[i].y);
    const baseFreq = CHIME_FREQS[i] * yOctave;

    const osc1 = audioCtx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(baseFreq, baseTime + delay);

    const osc2 = audioCtx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(baseFreq * PHI, baseTime + delay);

    const envNode = audioCtx.createGain();
    envNode.gain.setValueAtTime(0, baseTime + delay);
    envNode.gain.linearRampToValueAtTime(0.12, baseTime + delay + 0.03);
    envNode.gain.exponentialRampToValueAtTime(0.001, baseTime + delay + 3.5);

    const shimmerLfo = audioCtx.createOscillator();
    shimmerLfo.type = 'sine';
    shimmerLfo.frequency.value = 4 + (i % 3); 
    
    const shimmerGain = audioCtx.createGain();
    shimmerGain.gain.setValueAtTime(0.7, baseTime + delay);
    shimmerLfo.connect(shimmerGain.gain);

    osc1.connect(envNode);
    osc2.connect(envNode);
    envNode.connect(shimmerGain);

    let panner;
    if (audioCtx.createStereoPanner) {
      panner = audioCtx.createStereoPanner();
      panner.pan.value = coords[i].x - 1; 
      shimmerGain.connect(panner);
      panner.connect(mainGain);
    } else {
      shimmerGain.connect(mainGain);
    }

    osc1.start(baseTime + delay);
    osc2.start(baseTime + delay);
    shimmerLfo.start(baseTime + delay);
    
    osc1.stop(baseTime + delay + 3.6);
    osc2.stop(baseTime + delay + 3.6);
    shimmerLfo.stop(baseTime + delay + 3.6);
  }

  const finalDelay = delay + 1.0;
  
  const centerPillar = [
    { val: colony.grid[0][1], y: 0 },
    { val: colony.grid[1][1], y: 1 },
    { val: colony.grid[2][1], y: 2 }
  ];
  
  centerPillar.forEach((node, idx) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine'; 
    
    const yOctave = Math.pow(2, 1 - node.y);
    const rootFreq = FREQS[node.val - 1] * 0.5 * yOctave; 
    osc.frequency.setValueAtTime(rootFreq, baseTime + finalDelay); 

    const breathLfo = audioCtx.createOscillator();
    breathLfo.type = 'sine';
    breathLfo.frequency.value = 0.15 + (idx * 0.05); 
    
    const breathDepth = audioCtx.createGain();
    breathDepth.gain.value = 1.5; 
    
    breathLfo.connect(breathDepth);
    breathDepth.connect(osc.frequency);

    gain.gain.setValueAtTime(0, baseTime + finalDelay);
    gain.gain.linearRampToValueAtTime(0.18, baseTime + finalDelay + 1.0); 
    gain.gain.exponentialRampToValueAtTime(0.001, baseTime + finalDelay + 8.0);

    osc.connect(gain);
    gain.connect(mainGain);

    breathLfo.start(baseTime + finalDelay);
    osc.start(baseTime + finalDelay);
    
    breathLfo.stop(baseTime + finalDelay + 8.5);
    osc.stop(baseTime + finalDelay + 8.5);
  });
}
// ------------------------------------------------------

const ESCAPE_AFTER = 225; // 15 squared
const DIRS = ['NORTH','EAST','SOUTH','WEST'];

const ANT_COLORS = [
  [60, 135, 30],
  [45, 75, 105],
  [120, 15, 90],
  [60, 45, 120],
  [30, 105, 90]
];

function getAntColorStr(antIdx, intensity) {
  const base = ANT_COLORS[antIdx % 5];
  const lit = 0.2 + (intensity * 0.8); 
  return `rgba(${base[0]}, ${base[1]}, ${base[2]}, ${lit})`;
}

const VALID_PAIR_CONFIGS = [
  [[2,8],[3,7],[4,6],[1,9],[1,9],[4,6],[3,7],[2,8]],
  [[2,8],[1,9],[4,6],[3,7],[3,7],[4,6],[1,9],[2,8]],
  [[4,6],[3,7],[2,8],[1,9],[1,9],[2,8],[3,7],[4,6]],
  [[4,6],[1,9],[2,8],[3,7],[3,7],[2,8],[1,9],[4,6]],
];

const SATURN_SOLUTIONS = [
  [[4,9,2],[3,5,7],[8,1,6]], [[2,9,4],[7,5,3],[6,1,8]],
  [[8,1,6],[3,5,7],[4,9,2]], [[6,1,8],[7,5,3],[2,9,4]],
  [[4,3,8],[9,5,1],[2,7,6]], [[8,3,4],[1,5,9],[6,7,2]],
  [[2,7,6],[9,5,1],[4,3,8]], [[6,7,2],[1,5,9],[8,3,4]],
];

const SIZE = 270, MARGIN = 15, STRIDE = 90, CHALF = 35;
const FIELD_SIZE = 27, FIELD_CELL = SIZE / FIELD_SIZE;
const MAX_ANTS = 5;

let edgeState=[], edgeScore=[], edgeCross=[], nodeCounts=[], fieldState=[], visualAnts=[];
let sigilRunCount = 0;
let loomHistory = [];

function resetCounts() {
  edgeState = Array.from({length: MAX_ANTS}, () => Array.from({length: 9}, () => new Array(9).fill(false)));
  edgeScore = Array.from({length: MAX_ANTS}, () => Array.from({length: 9}, () => new Array(9).fill(0)));
  edgeCross = Array.from({length: MAX_ANTS}, () => Array.from({length: 9}, () => new Array(9).fill(0)));
  nodeCounts = Array.from({length: MAX_ANTS}, () => new Array(9).fill(0));
  fieldState = Array.from({length: FIELD_SIZE}, () => Array.from({length: FIELD_SIZE}, () => ({ heat: 0, owner: -1 })));
  visualAnts = [];
}

function cellPt(r, c) { return { x: MARGIN + c * STRIDE + CHALF, y: MARGIN + r * STRIDE + CHALF }; }
function cellId(r, c) { return r * 3 + c; }

let offscreen = null;
function makeOffscreen() {
  const dpr = window.devicePixelRatio || 1;
  try { offscreen = new OffscreenCanvas(SIZE*dpr, SIZE*dpr); } 
  catch(_) { offscreen = document.createElement('canvas'); offscreen.width = SIZE*dpr; offscreen.height = SIZE*dpr; }
}
function clearOffscreen() {
  const ctx = offscreen.getContext('2d');
  ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,offscreen.width,offscreen.height); ctx.restore();
}

const ARC_CURVE = 0.28, WRAP_BOW = 22;
function isWrapEdge(a, b) { return Math.hypot(b.x - a.x, b.y - a.y) > 100; }
function arcCtrl(a, b) {
  const dx = b.x-a.x, dy = b.y-a.y, len = Math.hypot(dx,dy)||1;
  return { x: (a.x+b.x)/2 - (dy/len)*(len*ARC_CURVE), y: (a.y+b.y)/2 + (dx/len)*(len*ARC_CURVE) };
}

function sampleBezier(a, cp, b, n) {
  const pts = [];
  for (let i=0; i<=n; i++) {
    const t = i/n, mt = 1-t;
    pts.push({ x: mt*mt*a.x + 2*mt*t*cp.x + t*t*b.x, y: mt*mt*a.y + 2*mt*t*cp.y + t*t*b.y });
  }
  return pts;
}

function arcPoints(a, b) {
  if (isWrapEdge(a, b)) {
    const dx = b.x-a.x, dy = b.y-a.y, len = Math.hypot(dx,dy)||1;
    const bx = -dy/len*WRAP_BOW, by = dx/len*WRAP_BOW;
    let ex1, ey1, ex2, ey2;
    if (Math.abs(dx) > Math.abs(dy)) {
      ex1 = dx>0?SIZE:0; ey1 = a.y; ex2 = dx>0?0:SIZE; ey2 = b.y;
    } else {
      ex1 = a.x; ey1 = dy>0?SIZE:0; ex2 = b.x; ey2 = dy>0?0:SIZE;
    }
    const h = 10;
    return [ ...sampleBezier(a, {x:(a.x+ex1)/2+bx,y:(a.y+ey1)/2+by}, {x:ex1,y:ey1}, h), 
             ...sampleBezier({x:ex2,y:ey2}, {x:(ex2+b.x)/2+bx,y:(ey2+b.y)/2+by}, b, h) ];
  }
  return sampleBezier(a, arcCtrl(a,b), b, 20);
}

function drawPixel(ctx, px, py, sz, colorStr, diamond) {
  ctx.fillStyle = colorStr;
  if (diamond) {
    const h = sz * 0.75;
    ctx.beginPath(); ctx.moveTo(px, py-h); ctx.lineTo(px+h, py); ctx.lineTo(px, py+h); ctx.lineTo(px-h, py); ctx.fill();
  } else {
    ctx.fillRect(px - sz/2, py - sz/2, sz, sz);
  }
}

function arrowTip(ctx, a, b, colorStr, alpha, size) {
  let tx, ty;
  if (isWrapEdge(a, b)) {
    const dx=b.x-a.x, dy=b.y-a.y, len=Math.hypot(dx,dy)||1; tx=dx/len; ty=dy/len;
  } else {
    const cp=arcCtrl(a,b), dx=b.x-cp.x, dy=b.y-cp.y, len=Math.hypot(dx,dy)||1; tx=dx/len; ty=dy/len;
  }
  const wing = size * 0.45;
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = colorStr;
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(b.x - tx*size + ty*wing, b.y - ty*size - tx*wing);
  ctx.lineTo(b.x - tx*size - ty*wing, b.y - ty*size + tx*wing);
  ctx.fill(); ctx.restore();
}

function drawDisplay() {
  const canvas = document.getElementById('trail-canvas'), ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,SIZE,SIZE);
  ctx.fillStyle = 'rgb(240, 240, 255)'; 
  ctx.fillRect(0,0,SIZE,SIZE);

  ctx.strokeStyle = 'rgb(135, 135, 135)'; 
  ctx.lineWidth = 1;
  for (let r=0; r<3; r++) for (let c=0; c<3; c++) {
    const {x, y} = cellPt(r, c);
    ctx.strokeRect(x - CHALF + 0.5, y - CHALF + 0.5, CHALF*2, CHALF*2);
  }

  ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.drawImage(offscreen, 0,0, offscreen.width, offscreen.height); ctx.restore();

  for (let ai=0; ai<MAX_ANTS; ai++) {
    for (let f=0; f<9; f++) for (let t=0; t<9; t++) {
      if (!edgeState[ai][f][t]) continue;
      const baseScore = edgeScore[ai][f][t], crosses = edgeCross[ai][f][t];
      const jitterAmp = 0.18 * Math.min(crosses/12, 1);
      const fr=Math.floor(f/3), fc=f%3, tr=Math.floor(t/3), tc=t%3;
      const pts = arcPoints(cellPt(fr,fc), cellPt(tr,tc)), n = pts.length;

      pts.forEach((pt, idx) => {
        const progress = idx/(n-1), wave = Math.sin(progress*Math.PI*2 + crosses*1.3) * jitterAmp;
        const score = Math.max(0, Math.min(1, baseScore + wave));
        const color = getAntColorStr(ai, score);
        ctx.globalAlpha = 0.5 + progress * 0.5;
        drawPixel(ctx, pt.x, pt.y, 1.8 + progress*2.7, color, idx%2===0);
      });
      ctx.globalAlpha = 1;
      arrowTip(ctx, cellPt(fr,fc), cellPt(tr,tc), `rgb(${ANT_COLORS[ai%5].join(',')})`, 1.0, 6.0);
    }
  }

  let maxNode = Math.max(1, ...nodeCounts.flat());
  for (let r=0; r<3; r++) for (let c=0; c<3; c++) {
    const id = cellId(r, c), pt = cellPt(r, c);
    let totalV = 0;
    for (let ai=0; ai<MAX_ANTS; ai++) totalV += nodeCounts[ai][id];
    if (!totalV) continue;
    const norm = totalV/(maxNode*MAX_ANTS||1), radius = 2.5 + norm*8;
    ctx.globalAlpha = 0.30 + norm*0.60;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, radius, 0, Math.PI*2);
    ctx.fillStyle = 'rgb(75, 75, 75)'; ctx.fill();
    ctx.strokeStyle = 'rgb(255, 255, 255)'; ctx.lineWidth = 1; ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 16px "Times New Roman"';
  ctx.fillStyle = 'rgb(15, 15, 15)';
  for (let r=0; r<3; r++) for (let c=0; c<3; c++) ctx.fillText(colony.grid[r][c], cellPt(r,c).x, cellPt(r,c).y);
}

// --- HYPERCUBE SYNC UTILITY (Projects to 60 canvases simultaneously) ---
function syncCubeFaces(sourceCanvas) {
  const drawFace = (canvasId, degrees, mirrorX, mirrorY, canvasSize) => {
    const cvs = document.getElementById(canvasId);
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvasSize, canvasSize);
    
    ctx.translate(canvasSize / 2, canvasSize / 2);
    ctx.rotate(degrees * Math.PI / 180);
    ctx.scale(mirrorX ? -1 : 1, mirrorY ? -1 : 1);
    
    ctx.drawImage(sourceCanvas, -canvasSize / 2, -canvasSize / 2, canvasSize, canvasSize);
    ctx.restore();
  };

  const facesConf = [
    {f:'front',  mx:false, my:false},
    {f:'right',  mx:true,  my:false},
    {f:'back',   mx:false, my:false},
    {f:'left',   mx:true,  my:false},
    {f:'top',    mx:false, my:true},
    {f:'bottom', mx:false, my:true}
  ];

  // Map to the 6 Outer Macro Faces (270x270)
  facesConf.forEach(conf => {
    drawFace(`macro-${conf.f}`, 0, conf.mx, conf.my, 270);
  });

  // Map to the 54 Inner Mini Faces (80x80)
  for (let i = 0; i < 9; i++) {
    facesConf.forEach(conf => {
      drawFace(`cube-${i}-${conf.f}`, 0, conf.mx, conf.my, 80);
    });
  }
}

// ==========================================
// COMPOSITED FIELD RENDERER
// ==========================================
function drawLangtonField() {
  const symMode = +document.getElementById('symmetry-mode').value;
  
  // 1. RENDER TRANSPARENT SHADOWS TO HIDDEN LAYER
  const hiddenCanvas = document.getElementById('hidden-shadow-canvas');
  const hCtx = hiddenCanvas.getContext('2d');
  hCtx.clearRect(0,0,SIZE,SIZE); 
  
  hCtx.strokeStyle = 'rgba(195, 195, 195, 0.15)'; 
  hCtx.lineWidth = 1;
  for (let i=0; i<=FIELD_SIZE; i++) {
    const p = i * FIELD_CELL;
    hCtx.beginPath(); hCtx.moveTo(p, 0); hCtx.lineTo(p, SIZE); hCtx.stroke();
    hCtx.beginPath(); hCtx.moveTo(0, p); hCtx.lineTo(SIZE, p); hCtx.stroke();
  }

  for (let fy=0; fy<FIELD_SIZE; fy++) {
    for (let fx=0; fx<FIELD_SIZE; fx++) {
      const cell = fieldState[fy][fx];
      if (cell.heat > 0.005) {
        hCtx.globalAlpha = cell.heat;
        hCtx.fillStyle = `rgb(${ANT_COLORS[cell.owner % 5].join(',')})`;
        const radius = Math.max(0.5, (FIELD_CELL/2 - 1) * Math.pow(cell.heat, 0.6));
        hCtx.beginPath(); hCtx.arc(fx*FIELD_CELL + FIELD_CELL/2, fy*FIELD_CELL + FIELD_CELL/2, radius, 0, Math.PI*2); hCtx.fill();
      }
    }
  }
  hCtx.globalAlpha = 1;

  visualAnts.forEach((a, i) => {
    const fx = a.fx, fy = a.fy, rx = (FIELD_SIZE-1)-fx, ry = (FIELD_SIZE-1)-fy;
    let positions = [{x:fx, y:fy}];
    if (symMode === 2) positions.push({x:rx, y:ry});
    else if (symMode === 4) positions.push({x:rx, y:fy}, {x:fx, y:ry}, {x:rx, y:ry});
    else if (symMode === 8) positions.push({x:rx, y:fy}, {x:fx, y:ry}, {x:rx, y:ry}, {x:fy, y:fx}, {x:ry, y:fx}, {x:fy, y:rx}, {x:ry, y:rx});

    positions.forEach(pos => {
      hCtx.beginPath(); 
      hCtx.rect(pos.x*FIELD_CELL + FIELD_CELL/2 - 2, pos.y*FIELD_CELL + FIELD_CELL/2 - 2, 4, 4);
      hCtx.fillStyle = `rgb(${ANT_COLORS[i%5].join(',')})`; hCtx.fill();
      hCtx.strokeStyle = 'rgba(15, 15, 15, 0.5)'; 
      hCtx.lineWidth = 1; hCtx.stroke();
    });
  });

  // -> SEND TRANSPARENT ART TO ALL 3D CUBES AND MODULATE GEAR SPEED
  syncCubeFaces(hiddenCanvas);
  const flatGrid = colony.grid.flat();
  for (let i = 0; i < 9; i++) {
    const cube = document.getElementById(`mini-cube-${i}`);
    if (cube) {
      // The larger the matrix value, the faster the cube spins!
      cube.style.animationDuration = (26 - (flatGrid[i] * 2)) + 's';
    }
  }

  // 2. RENDER SOLID COLOR GRADIENT TO VISIBLE 2D CANVAS
  const canvas = document.getElementById('langton-field');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,SIZE,SIZE);
  
  const g = colony.grid;
  const rawScore = calcMagicScore(g);
  const safeScore = Math.max(0, Math.min(1, rawScore));

  const rSum = g[0][0] + g[0][1] + g[0][2];
  const gSum = g[1][0] + g[1][1] + g[1][2];
  const bSum = g[2][0] + g[2][1] + g[2][2];

  const baseR = 235 + (rSum - 15) * 8;
  const baseG = 235 + (gSum - 15) * 8;
  const baseB = 245 + (bSum - 15) * 8;

  let bestDist = Infinity, bestIdx = 0;
  SATURN_SOLUTIONS.forEach((cand, idx) => { 
    let d=0; for(let r=0;r<3;r++)for(let c=0;c<3;c++)d+=Math.abs(g[r][c]-cand[r][c]); 
    if(d<bestDist){bestDist=d; bestIdx=idx;} 
  });

  const RESOLVED_COLORS = [
    { c1: [255, 218, 185], c2: [230, 230, 250] },
    { c1: [189, 252, 201], c2: [173, 216, 230] },
    { c1: [255, 204, 204], c2: [255, 253, 208] },
    { c1: [221, 240, 204], c2: [255, 250, 205] },
    { c1: [255, 223, 186], c2: [220, 208, 255] },
    { c1: [224, 176, 255], c2: [175, 238, 238] },
    { c1: [253, 253, 255], c2: [176, 224, 230] },
    { c1: [255, 183, 178], c2: [204, 204, 255] }
  ];

  const target = RESOLVED_COLORS[bestIdx];
  const pull = Math.pow(safeScore, 8); 
  const clamp = (val) => Math.max(0, Math.min(255, Math.round(val)));

  const r1 = clamp(baseR * (1 - pull) + target.c1[0] * pull);
  const g1 = clamp(baseG * (1 - pull) + target.c1[1] * pull);
  const b1 = clamp(baseB * (1 - pull) + target.c1[2] * pull);

  const r2 = clamp(baseR * (1 - pull) + target.c2[0] * pull);
  const g2 = clamp(baseG * (1 - pull) + target.c2[1] * pull);
  const b2 = clamp(baseB * (1 - pull) + target.c2[2] * pull);

  const angle = (bestIdx * Math.PI / 4); 
  const cx = SIZE/2, cy = SIZE/2, rad = (SIZE/2) * 1.414;
  
  const x1 = cx - Math.cos(angle)*rad;
  const y1 = cy - Math.sin(angle)*rad;
  const x2 = cx + Math.cos(angle)*rad;
  const y2 = cy + Math.sin(angle)*rad;

  const grad = ctx.createLinearGradient(x1, y1, x2, y2);
  grad.addColorStop(0, `rgb(${r1}, ${g1}, ${b1})`);
  grad.addColorStop(1, `rgb(${r2}, ${g2}, ${b2})`);

  ctx.fillStyle = grad;
  ctx.fillRect(0,0,SIZE,SIZE);
  
  // 3. COMPOSITE TRANSPARENT LAYER OVER GRADIENT BASE
  ctx.save();
  ctx.setTransform(1,0,0,1,0,0);
  ctx.drawImage(hiddenCanvas, 0, 0);
  ctx.restore();
}

let antPrevCell = [];
function initAntPrev(ants) {
  antPrevCell = ants.map(a => cellId(a.y, a.x));
  ants.forEach((a, i) => { nodeCounts[i][cellId(a.y, a.x)]++; });
  visualAnts = ants.map((a, i) => ({ fx: (Math.floor(FIELD_SIZE/2)+i)%FIELD_SIZE, fy: (Math.floor(FIELD_SIZE/2)+Math.floor(i/2))%FIELD_SIZE, direction: a.direction }));
  visualAnts.forEach((a, i) => { fieldState[a.fy][a.fx].heat = 1.0; fieldState[a.fy][a.fx].owner = i; });
}

function paintStep(ants, currentScore) {
  const symMode = +document.getElementById('symmetry-mode').value;

  for (let fy=0; fy<FIELD_SIZE; fy++) {
    for (let fx=0; fx<FIELD_SIZE; fx++) {
      if (fieldState[fy][fx].heat > 0) {
        fieldState[fy][fx].heat *= 0.985;
        if (fieldState[fy][fx].heat < 0.005) fieldState[fy][fx].heat = 0;
      }
    }
  }

  ants.forEach((a, i) => {
    const cur = cellId(a.y, a.x), prev = antPrevCell[i];
    nodeCounts[i][cur]++;
    if (cur !== prev) {
      edgeCross[i][prev][cur]++;
      const wasOn = edgeState[i][prev][cur];
      edgeState[i][prev][cur] = !wasOn;
      if (!wasOn) edgeScore[i][prev][cur] = currentScore;
    }
    antPrevCell[i] = cur;

    if (!visualAnts[i]) return;
    visualAnts[i].direction = a.direction;
    switch (a.direction) {
      case 'NORTH': visualAnts[i].fy = (visualAnts[i].fy - 1 + FIELD_SIZE) % FIELD_SIZE; break;
      case 'EAST':  visualAnts[i].fx = (visualAnts[i].fx + 1) % FIELD_SIZE; break;
      case 'SOUTH': visualAnts[i].fy = (visualAnts[i].fy + 1) % FIELD_SIZE; break;
      case 'WEST':  visualAnts[i].fx = (visualAnts[i].fx - 1 + FIELD_SIZE) % FIELD_SIZE; break;
    }
    
    const fx = visualAnts[i].fx, fy = visualAnts[i].fy, rx = (FIELD_SIZE-1)-fx, ry = (FIELD_SIZE-1)-fy;
    let positions = [{x:fx, y:fy}];
    if (symMode === 2) positions.push({x:rx, y:ry});
    else if (symMode === 4) positions.push({x:rx, y:fy}, {x:fx, y:ry}, {x:rx, y:ry});
    else if (symMode === 8) positions.push({x:rx, y:fy}, {x:fx, y:ry}, {x:rx, y:ry}, {x:fy, y:fx}, {x:ry, y:fx}, {x:fy, y:rx}, {x:ry, y:rx});

    positions.forEach(pos => { fieldState[pos.y][pos.x].heat = 1.0; fieldState[pos.y][pos.x].owner = i; });
  });
}

function randomStartGrid() {
  const c = VALID_PAIR_CONFIGS[Math.floor(Math.random()*4)], pairMap = {};
  c.forEach((p, i) => { const k=p[0]+','+p[1]; if(!pairMap[k]) pairMap[k]={pair:p, slots:[]}; pairMap[k].slots.push(i); });
  const assign = new Array(8);
  Object.values(pairMap).forEach(({pair, slots}) => {
    if(Math.random()<0.5){assign[slots[0]]=pair[0]; assign[slots[1]]=pair[1];}
    else{assign[slots[0]]=pair[1]; assign[slots[1]]=pair[0];}
  });
  const f=[]; let si=0; for(let i=0; i<9; i++) f.push(i===4?5:assign[si++]);
  return [f.slice(0,3), f.slice(3,6), f.slice(6,9)];
}

function calcMagicScore(g) {
  const T=15; let s=0;
  for(let i=0;i<3;i++){s+=1-Math.abs(g[i].reduce((a,b)=>a+b,0)-T)/T; s+=1-Math.abs(g[0][i]+g[1][i]+g[2][i]-T)/T;}
  s+=1-Math.abs(g[0][0]+g[1][1]+g[2][2]-T)/T; s+=1-Math.abs(g[0][2]+g[1][1]+g[2][0]-T)/T;
  return s/8;
}

function isValid(g) {
  const T=15, s=[...g.flat()].sort((a,b)=>a-b);
  if(!s.every((v,i)=>v===i+1)) return false;
  for(let i=0;i<3;i++) if(g[i].reduce((a,b)=>a+b,0)!==T || g[0][i]+g[1][i]+g[2][i]!==T) return false;
  return g[0][0]+g[1][1]+g[2][2]===T && g[0][2]+g[1][1]+g[2][0]===T;
}

function calcImp(g, x, y) {
  const T=15, ov=g[y][x], nv=10-ov, rs=g[y].reduce((a,b)=>a+b,0), cs=g[0][x]+g[1][x]+g[2][x];
  let imp=(Math.abs(rs-T)-Math.abs(rs-ov+nv-T))+(Math.abs(cs-T)-Math.abs(cs-ov+nv-T));
  if(x===y){const d=g[0][0]+g[1][1]+g[2][2]; imp+=Math.abs(d-T)-Math.abs(d-ov+nv-T);}
  if(x+y===2){const d=g[0][2]+g[1][1]+g[2][0]; imp+=Math.abs(d-T)-Math.abs(d-ov+nv-T);}
  return imp;
}

class AntAgent {
  constructor(x,y,dir){this.x=x;this.y=y;this.direction=dir;this._stag=0;}
  escape(){this.x=Math.floor(Math.random()*3);this.y=Math.floor(Math.random()*3);this.direction=DIRS[Math.floor(Math.random()*4)];this._stag=0;}
  move(){
    switch(this.direction){
      case 'NORTH':this.y=(this.y-1+3)%3;break; case 'EAST':this.x=(this.x+1)%3;break;
      case 'SOUTH':this.y=(this.y+1)%3;break; case 'WEST':this.x=(this.x-1+3)%3;break;
    }
  }
  turn(imp){const i=DIRS.indexOf(this.direction); this.direction=imp>0?DIRS[(i+3)%4]:DIRS[(i+1)%4];}
}

class Colony {
  constructor(n){
    this.grid=randomStartGrid();
    this.ants=Array.from({length:n},()=>new AntAgent(Math.floor(Math.random()*3),Math.floor(Math.random()*3),DIRS[Math.floor(Math.random()*4)]));
    this.steps=0;this._best=0;
  }
  step(escapeOn){
    const g=this.grid, imps=this.ants.map(a=>calcImp(g,a.x,a.y)), cc={};
    for(const a of this.ants) cc[a.x+','+a.y]=(cc[a.x+','+a.y]||0)+1;
    const contested=new Set(Object.keys(cc).filter(k=>cc[k]>1)), flipped=new Set();
    for(let i=0; i<this.ants.length; i++){
      const a = this.ants[i];
      const k=a.x+','+a.y;
      if(!contested.has(k)&&!flipped.has(k)){
        g[a.y][a.x]=10-g[a.y][a.x]; 
        flipped.add(k);
        if (typeof playTone === 'function') playTone(g[a.y][a.x], i);
      }
    }
    this.ants.forEach((a,i)=>{a.turn(imps[i]);a.move();});
    this.steps++; const sc=calcMagicScore(g);
    if(sc>this._best){this._best=sc;this.ants.forEach(a=>a._stag=0);} else this.ants.forEach(a=>a._stag++);
    if(escapeOn) for(const a of this.ants) if(a._stag>=ESCAPE_AFTER) a.escape();
    return sc;
  }
}

let sigilAnim = null;
let gifRecorder = null;
let gifFrames = [];
let isRecordingGif = false;

function clearSigil() {
  if (sigilAnim) return;
  const sc = document.getElementById('sigil-canvas'), ctx = sc.getContext('2d');
  ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,sc.width,sc.height); ctx.restore();
}
function stampSigilToOffscreen() {
  const sc = document.getElementById('sigil-canvas'), octx = offscreen.getContext('2d');
  octx.save(); octx.setTransform(1,0,0,1,0,0); octx.drawImage(sc, 0,0, sc.width, sc.height); octx.restore();
}

function makePRNG(seed) {
  let s = seed >>> 0;
  return function() {
    s += 0x6d2b79f5; let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleSegment(a, b, n) {
  const pts = []; for (let i=0; i<=n; i++) pts.push({ x: a.x+(b.x-a.x)*(i/n), y: a.y+(b.y-a.y)*(i/n) }); return pts;
}

function drawProtoSigil(hidden) {
  const sc = document.getElementById('sigil-canvas'), sctx = sc.getContext('2d'), dist = hidden.saturnDistance;
  if (sigilAnim || dist > 4 || hidden.tension === 0) return;
  const square = SATURN_SOLUTIONS[Math.max(0, Math.min(SATURN_SOLUTIONS.length-1, hidden.saturnOrientation-1))], pts = [];
  for (let v=1; v<=9; v++) for (let r=0; r<3; r++) for (let c=0; c<3; c++) if(square[r][c]===v) pts.push(cellPt(r,c));
  const closeness = Math.max(0, (4-dist)/4), visibleSegments = Math.max(1, Math.floor(closeness*(pts.length-1)));
  sctx.save(); sctx.strokeStyle = 'rgba(135,135,135,0.4)'; sctx.lineWidth = 1;
  for (let i=0; i<visibleSegments; i++) { sctx.beginPath(); sctx.moveTo(pts[i].x, pts[i].y); sctx.lineTo(pts[i+1].x, pts[i+1].y); sctx.stroke(); }
  sctx.fillStyle = 'rgba(135,135,135,0.6)';
  for (let i=0; i<=visibleSegments; i++) { sctx.beginPath(); sctx.arc(pts[i].x, pts[i].y, 2, 0, Math.PI*2); sctx.fill(); }
  sctx.restore();
}

function drawSaturnSigil() {
  clearSigil(); sigilRunCount++;
  const sc = document.getElementById('sigil-canvas'), sctx = sc.getContext('2d');
  const trailCanvas = document.getElementById('trail-canvas');
  
  gifFrames = [];
  isRecordingGif = true;
  
  let bestDist = Infinity, bestIdx = 0;
  SATURN_SOLUTIONS.forEach((cand, idx) => { 
    let d=0; for(let r=0;r<3;r++)for(let c=0;c<3;c++)d+=Math.abs(colony.grid[r][c]-cand[r][c]); 
    if(d<bestDist){bestDist=d; bestIdx=idx;} 
  });
  const square = SATURN_SOLUTIONS[bestIdx], pts = [];
  for (let v=1; v<=9; v++) for (let r=0; r<3; r++) for (let c=0; c<3; c++) if(square[r][c]===v) pts.push(cellPt(r,c));

  const SEGS = pts.length - 1, DRAW_MS = 1800, t0 = performance.now();
  const lineCol = 'rgb(135, 75, 15)', nodeCol = 'rgb(240, 240, 255)', lblCol = 'rgb(15, 15, 15)';
  
  const rng = makePRNG(sigilRunCount * 0x9e3779b9 + 0xdeadbeef), segPixels = [];
  for (let si=0; si<SEGS; si++) {
    const segPts = sampleSegment(pts[si], pts[si+1], 24), row = [];
    segPts.forEach((_, idx) => {
      const skip = rng()<0.2, t=idx/(segPts.length-1), bell=Math.sin(t*Math.PI);
      row.push({ skip, sz: 1.4 + bell*2.4, col: lineCol, diamond: idx%2===0, shimmer: 0.6+rng()*0.4 });
    });
    segPixels.push({ pts: segPts, pixels: row });
  }

  function captureFrame() {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = SIZE;
    tempCanvas.height = SIZE;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(trailCanvas, 0, 0, SIZE, SIZE);
    tempCtx.drawImage(sc, 0, 0, SIZE, SIZE);
    return tempCanvas;
  }

  function frame(now) {
    const progress = Math.min((now-t0)/DRAW_MS, 1), full = Math.floor(progress*SEGS), frac = (progress*SEGS)-full;
    sctx.save(); sctx.setTransform(1,0,0,1,0,0); sctx.clearRect(0,0,sc.width,sc.height); sctx.restore();
    
    sctx.save(); sctx.strokeStyle = lineCol; sctx.lineWidth = 1.5;
    for (let i=0; i<full; i++) { sctx.beginPath(); sctx.moveTo(pts[i].x, pts[i].y); sctx.lineTo(pts[i+1].x, pts[i+1].y); sctx.stroke(); }
    if (full<SEGS) { sctx.beginPath(); sctx.moveTo(pts[full].x, pts[full].y); sctx.lineTo(pts[full].x+(pts[full+1].x-pts[full].x)*frac, pts[full].y+(pts[full+1].y-pts[full].y)*frac); sctx.stroke(); }
    sctx.restore();

    for (let si=0; si<full; si++) segPixels[si].pixels.forEach((px, idx) => { if(!px.skip){ sctx.globalAlpha=px.shimmer; drawPixel(sctx, segPixels[si].pts[idx].x, segPixels[si].pts[idx].y, px.sz, px.col, px.diamond); }});
    if (full<SEGS) segPixels[full].pixels.slice(0, Math.floor(frac*segPixels[full].pixels.length)).forEach((px, idx) => { if(!px.skip){ sctx.globalAlpha=px.shimmer*frac; drawPixel(sctx, segPixels[full].pts[idx].x, segPixels[full].pts[idx].y, px.sz, px.col, px.diamond); }});
    
    sctx.globalAlpha = 1;
    for (let i=0; i<=full && i<pts.length; i++) {
      sctx.save(); sctx.globalAlpha = i<full ? 1 : frac;
      sctx.beginPath(); sctx.arc(pts[i].x, pts[i].y, 7, 0, Math.PI*2); sctx.fillStyle = nodeCol; sctx.fill();
      sctx.strokeStyle = lineCol; sctx.lineWidth = 1; sctx.stroke();
      sctx.fillStyle = lblCol; sctx.font = 'bold 10px "Times New Roman"'; sctx.textAlign = 'center'; sctx.textBaseline = 'middle'; sctx.fillText(i+1, pts[i].x, pts[i].y+1); sctx.restore();
    }

    if (isRecordingGif) {
      gifFrames.push(captureFrame());
    }

    if (progress >= 1) {
      sctx.save(); sctx.beginPath(); sctx.arc(pts[0].x, pts[0].y, 11, 0, Math.PI*2); sctx.strokeStyle = lineCol; sctx.lineWidth = 2.0; sctx.stroke();
      const last=pts[pts.length-1], prev2=pts[pts.length-2], ang=Math.atan2(last.y-prev2.y, last.x-prev2.x)+Math.PI/2;
      sctx.beginPath(); sctx.moveTo(last.x+Math.cos(ang)*8, last.y+Math.sin(ang)*8); sctx.lineTo(last.x-Math.cos(ang)*8, last.y-Math.sin(ang)*8);
      sctx.strokeStyle = lineCol; sctx.lineWidth = 2.5; sctx.stroke(); sctx.restore();
      
      if (isRecordingGif) {
        gifFrames.push(captureFrame());
        for (let i = 0; i < 15; i++) {
          gifFrames.push(captureFrame());
        }
      }
      
      stampSigilToOffscreen(); sctx.save(); sctx.setTransform(1,0,0,1,0,0); sctx.clearRect(0,0,sc.width,sc.height); sctx.restore();
      drawDisplay(); sigilAnim = null; 
      isRecordingGif = false;
      document.getElementById('download-btn').disabled = false;
      if (document.getElementById('auto-restart-toggle').checked) setTimeout(startAnimation, 2500);
      return;
    }
    sigilAnim = requestAnimationFrame(frame);
  }
  sigilAnim = requestAnimationFrame(frame);
}

let colony = new Colony(5), animationId = null, lastFrameTime = null, stepsPerFrame = 1;
let scoreData=[], tensionData=[], prevErrors=null, history=[];
let stateMap=new Map(), loopEcho={l:0, r:0};

function setSpeed(v) { animationSpeed = Math.round(800/Math.pow(v,1.5)); document.getElementById('speed-label').textContent = v; }
let animationSpeed = Math.round(800/Math.pow(5,1.5));

function toggleHelp() {
  const helpBox = document.getElementById('help-legend');
  if (helpBox.style.display === 'none') {
    helpBox.style.display = 'block';
  } else {
    helpBox.style.display = 'none';
  }
}

function updateDisplay() {
  const g = colony.grid, sc = calcMagicScore(g);
  drawDisplay(); drawLangtonField(); clearSigil();
  
  const vals = [g[0][0]+g[0][1]+g[0][2], g[1][0]+g[1][1]+g[1][2], g[2][0]+g[2][1]+g[2][2], g[0][0]+g[1][0]+g[2][0], g[0][1]+g[1][1]+g[2][1], g[0][2]+g[1][2]+g[2][2], g[0][0]+g[1][1]+g[2][2], g[0][2]+g[1][1]+g[2][0]];
  const errors = vals.map(v=>v-15), tens = errors.reduce((s,e)=>s+Math.abs(e),0), exact = vals.filter(v=>v===15).length, near = vals.filter(v=>Math.abs(v-15)===1).length;
  
  let bDist=Infinity, bOri=0;
  SATURN_SOLUTIONS.forEach((c,i)=>{ let d=0;for(let r=0;r<3;r++)for(let c2=0;c2<3;c2++)d+=Math.abs(g[r][c2]-c[r][c2]); if(d<bDist){bDist=d;bOri=i+1;} });
  drawProtoSigil({saturnDistance: bDist, saturnOrientation: bOri, tension: tens});

  const sig=g.flat().join(''), seen=stateMap.get(sig);
  if(seen){loopEcho={l:colony.steps-seen.ls, r:seen.c+1}; seen.ls=colony.steps; seen.c++;}
  else{stateMap.set(sig,{fs:colony.steps, ls:colony.steps, c:1}); loopEcho={l:0,r:0};}

  const valid = isValid(g);

  // --- AS ABOVE, SO BELOW: UI Aura Mapping ---
  const root = document.documentElement;
  const esotericPalette = [
    [15,15,15], [45,75,105], [60,135,30], [120,15,90], [60,45,120],
    [135,75,15], [180,120,60], [210,150,90], [105,150,180], [195,195,195]
  ];
  
  g.flat().forEach((val, i) => {
    if (valid) {
       root.style.setProperty(`--grid-color-${i}`, (i % 2 === 0) ? 'rgb(135, 75, 15)' : 'rgb(240, 240, 255)');
    } else {
       const rgb = esotericPalette[val];
       root.style.setProperty(`--grid-color-${i}`, `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`);
    }
  });
  // -------------------------------------------

  document.getElementById('step-count').textContent = colony.steps;
  document.getElementById('position').textContent = colony.ants.map((a,i)=>`A${i+1}:(${a.x},${a.y})`).join(' ');
  document.getElementById('direction').textContent = colony.ants.map(a=>a.direction[0]).join(' ');
  document.getElementById('magic-score').textContent = (sc*100).toFixed(1)+'%';
  document.getElementById('system-tension').textContent = tens;
  document.getElementById('constraint-lock').textContent = exact+' / 8';
  document.getElementById('constraint-lock-note').textContent = exact+' exact, '+near+' near';
  document.getElementById('saturn-distance').textContent = bDist;
  document.getElementById('loop-echo').textContent = loopEcho.r ? 'L'+loopEcho.l+' x'+loopEcho.r : 'None';
  document.getElementById('valid-status').innerHTML = valid ? '\u2713 YES' : '\u2717 NO';
  document.getElementById('valid-status').style.color = valid ? 'rgb(135, 75, 15)' : 'rgb(45, 45, 45)';

  // 1. Update the Pattern Watch (Loop Alert)
  const loopAlertEl = document.getElementById('loop-alert-text');
  if (loopEcho.r) {
    loopAlertEl.textContent = `Loop of ${loopEcho.l} steps detected (x${loopEcho.r}).`;
    loopAlertEl.parentElement.style.backgroundColor = 'rgb(255, 240, 240)'; 
  } else {
    loopAlertEl.textContent = 'No recurrence detected.';
    loopAlertEl.parentElement.style.backgroundColor = 'rgb(255, 255, 255)';
  }

  // 2. Update the Convergence Basin Alert
  const basinAlertEl = document.getElementById('basin-alert-text');
  if (valid) {
    basinAlertEl.textContent = 'Perfect symmetry achieved!';
    basinAlertEl.parentElement.style.backgroundColor = 'rgb(240, 255, 240)';
  } else if (bDist <= 2) {
    basinAlertEl.textContent = `Deep in convergence basin (Distance: ${bDist})`;
    basinAlertEl.parentElement.style.backgroundColor = 'rgb(255, 255, 225)';
  } else if (bDist <= 6) {
    basinAlertEl.textContent = `Approaching symmetry (Distance: ${bDist})`;
    basinAlertEl.parentElement.style.backgroundColor = 'rgb(240, 240, 255)';
  } else {
    basinAlertEl.textContent = 'Not near symmetry.';
    basinAlertEl.parentElement.style.backgroundColor = 'rgb(255, 255, 255)';
  }

  const fillDivs = document.querySelectorAll('.constraint-fill');
  if(!fillDivs.length) {
    const div=document.getElementById('constraints'); div.replaceChildren();
    ['R1','R2','R3','C1','C2','C3','D1','D2'].forEach((n,i)=>{
      div.insertAdjacentHTML('beforeend',`<div class="constraint-bar"><span class="constraint-label">${n}</span><div class="constraint-track"><div class="constraint-fill" id="c-fill-${i}"></div></div></div>`);
    });
  }
  vals.forEach((v,i)=>{
    const el=document.getElementById('c-fill-'+i), perf=v===15;
    el.className='constraint-fill'+(perf?' perfect':''); el.style.width=Math.max(0,Math.min(100,(1-Math.abs(v-15)/15)*100))+'%'; el.textContent=v;
  });

  scoreData.push(sc); if(scoreData.length>150) scoreData.shift();
  tensionData.push({t:tens, l:exact, d:bDist}); if(tensionData.length>150) tensionData.shift();
  
  loomHistory.unshift(g.flat());
  if(loomHistory.length > 90) loomHistory.pop();
  
  drawChart(); drawHiddenChart(); drawLoom();

  const stat = valid ? {l:'Valid',c:'valid'} : bDist<=2 ? {l:'Near',c:'near'} : {l:'Search',c:'search'};
  history.push({s:colony.steps, g:g.map(r=>r.slice()), t:tens, ex:exact, d:bDist, st:stat});
  if(history.length>15) history.shift();
  
  // ANTI-FLICKER OPTIMIZATION TRIGGER
  renderHistory();
  
  colony.ants.forEach((a,i) => {
    const dot = document.getElementById('trail-ant-'+i); 
    if(dot) { const pt=cellPt(a.y,a.x); dot.style.left=pt.x+'px'; dot.style.top=pt.y+'px'; }
  });
}

function drawLoom() {
  const c = document.getElementById('abyss-footer');
  if (!c) return;
  const ctx = c.getContext('2d');
  const W = c.width / (window.devicePixelRatio || 1);
  const H = c.height / (window.devicePixelRatio || 1);
  ctx.clearRect(0, 0, W, H);
  
  const cols = 18;
  const cellW = W / cols;
  const cellH = H / 90; 
  
  const baseColors = [
    [15,15,15], [45,75,105], [60,135,30], [120,15,90], [60,45,120],
    [135,75,15], [180,120,60], [210,150,90], [105,150,180], [195,195,195]
  ];
  
  loomHistory.forEach((flat, rowIdx) => {
    const pattern = [...flat, ...[...flat].reverse()];
    const isPerfect = isValid([flat.slice(0,3), flat.slice(3,6), flat.slice(6,9)]);
    
    for(let i=0; i<cols; i++) {
      const val = pattern[i];
      if (isPerfect) {
         ctx.fillStyle = (i%2===0) ? 'rgb(135, 75, 15)' : 'rgb(240, 240, 255)';
      } else {
         const rgb = baseColors[val];
         ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
      }
      ctx.fillRect(i * cellW, rowIdx * cellH, Math.ceil(cellW), Math.ceil(cellH));
    }
  });
}

// ANTI-FLICKER OPTIMIZED FUNCTION
function renderHistory() {
  const strip = document.getElementById('pre-convergence-strip');
  
  // Construct and cache DOM elements to prevent querySelector layout thrashing
  while(strip.children.length < history.length) {
    const div = document.createElement('div');
    div.innerHTML = `<div class="history-head"><span class="h-step"></span><span class="h-rem"></span></div><div class="history-status"></div><div class="history-grid">${'<div class="history-cell"></div>'.repeat(9)}</div><div class="history-meta"></div>`;
    // Cache references directly on the element
    div._step = div.querySelector('.h-step');
    div._rem = div.querySelector('.h-rem');
    div._status = div.querySelector('.history-status');
    div._cells = div.querySelectorAll('.history-cell');
    div._meta = div.querySelector('.history-meta');
    strip.appendChild(div);
  }
  while(strip.children.length > history.length) strip.removeChild(strip.lastChild);
  
  // Lightning-fast updates with no searching
  history.forEach((snap, idx) => {
    const card = strip.children[idx];
    const rem = history.length - 1 - idx;
    const isFin = idx === history.length - 1 && snap.d === 0 && snap.ex === 8;
    
    card.className = 'history-card' + (rem <= 3 ? ' final-window' : '') + (isFin ? ' resolved-card' : '');
    card._step.textContent = `Step ${snap.s}`;
    card._rem.textContent = isFin ? 'Solved' : `-${rem}`;
    card._status.className = 'history-status ' + snap.st.c;
    card._status.textContent = snap.st.l;
    
    const f = snap.g.flat(); 
    for(let i=0; i<9; i++) card._cells[i].textContent = f[i];
    
    card._meta.textContent = `T ${snap.t} · L ${snap.ex}/8 | D ${snap.d}`;
  });
}

function resizeCharts() {
  const dpr=window.devicePixelRatio||1;
  ['scoreChart','constraint-phase-chart','abyss-footer'].forEach(id=>{
    const c=document.getElementById(id);
    if(!c) return;
    const w=c.parentElement.clientWidth-20;
    c.style.width=w+'px'; 
    c.width=w*dpr; 
    c.height=(id==='scoreChart'?180:id==='abyss-footer'?90:190)*dpr; 
    c.getContext('2d').setTransform(dpr,0,0,dpr,0,0);
    if(id==='abyss-footer' && loomHistory.length) drawLoom();
  });
}

function drawChart() {
  const c=document.getElementById('scoreChart'), ctx=c.getContext('2d'), W=c.width/(window.devicePixelRatio||1), H=c.height/(window.devicePixelRatio||1);
  ctx.clearRect(0,0,W,H); ctx.fillStyle='rgb(255, 255, 255)'; ctx.fillRect(0,0,W,H);
  const pw=W-46, ph=H-38;
  ctx.strokeStyle='rgb(195, 195, 195)'; ctx.lineWidth=1; [0,.25,.5,.75,1].forEach(v=>{ctx.beginPath();ctx.moveTo(38,10+ph*(1-v));ctx.lineTo(38+pw,10+ph*(1-v));ctx.stroke();});
  ctx.fillStyle='rgb(45, 45, 45)'; ctx.font='12px "Times New Roman"'; ctx.textAlign='right'; ['100%','75%','50%','25%','0%'].forEach((l,i)=>ctx.fillText(l,34,14+ph*(i/4)));
  if(scoreData.length<2) return;
  const xs=pw/Math.max(scoreData.length-1,1);
  ctx.beginPath(); ctx.strokeStyle='rgb(45, 75, 105)'; ctx.lineWidth=2;
  scoreData.forEach((s,i)=>i===0?ctx.moveTo(38,10+ph*(1-s)):ctx.lineTo(38+i*xs,10+ph*(1-s))); ctx.stroke();
}

function drawHiddenChart() {
  const c=document.getElementById('constraint-phase-chart'), ctx=c.getContext('2d'), W=c.width/(window.devicePixelRatio||1), H=c.height/(window.devicePixelRatio||1);
  ctx.clearRect(0,0,W,H); ctx.fillStyle='rgb(255, 255, 255)'; ctx.fillRect(0,0,W,H);
  const pw=W-54, ph=H-44;
  ctx.strokeStyle='rgb(195, 195, 195)'; ctx.lineWidth=1; [0,.25,.5,.75,1].forEach(v=>{ctx.beginPath();ctx.moveTo(42,14+ph*(1-v));ctx.lineTo(42+pw,14+ph*(1-v));ctx.stroke();});
  if(tensionData.length<2) return;
  const xs=pw/Math.max(tensionData.length-1,1), mt=Math.max(1,...tensionData.map(d=>d.t)), md=Math.max(1,...tensionData.map(d=>d.d));
  ctx.beginPath(); ctx.strokeStyle='rgb(135, 135, 135)'; ctx.lineWidth=2; tensionData.forEach((d,i)=>i===0?ctx.moveTo(42,14+ph*(d.t/mt)):ctx.lineTo(42+i*xs,14+ph*(d.t/mt))); ctx.stroke();
  ctx.beginPath(); ctx.strokeStyle='rgb(135, 75, 15)'; ctx.lineWidth=2; tensionData.forEach((d,i)=>i===0?ctx.moveTo(42,14+ph*(d.d/md)):ctx.lineTo(42+i*xs,14+ph*(d.d/md))); ctx.stroke();
}

function animate(now) {
  if (animationId === null) return;
  if (!lastFrameTime) lastFrameTime = now;
  if (now - lastFrameTime >= animationSpeed) {
    lastFrameTime = now - ((now - lastFrameTime) % animationSpeed);
    const esc = document.getElementById('escape-toggle').checked;
    let converged = false;
    for (let i=0; i<stepsPerFrame; i++) {
      paintStep(colony.ants, colony.step(esc));
      if (isValid(colony.grid)) { converged=true; break; }
    }
    updateDisplay();
    if (converged) {
      document.getElementById('convergence-banner').style.display='block';
      if (typeof playConvergenceSequence === 'function') playConvergenceSequence(); 
      drawSaturnSigil(); return;
    }
  }
  animationId = requestAnimationFrame(animate);
}

function startAnimation() {
  stopAnimation();
  const n = +document.getElementById('ant-count').value;
  if (isValid(colony.grid) || colony.ants.length !== n) {
    if (sigilAnim) { cancelAnimationFrame(sigilAnim); sigilAnim = null; clearSigil(); }
    colony = new Colony(n); scoreData=[]; tensionData=[]; history=[]; stateMap=new Map(); loopEcho={l:0,r:0}; loomHistory=[];
    document.getElementById('convergence-banner').style.display='none';
    const w=document.getElementById('trail-canvas-wrap'); w.querySelectorAll('.trail-ant').forEach(e=>e.remove());
    colony.ants.forEach((_,i)=>{w.insertAdjacentHTML('beforeend',`<div class="trail-ant trail-ant-${i}" id="trail-ant-${i}"></div>`);});
    const leg=document.getElementById('ant-legend'); leg.replaceChildren();
    colony.ants.forEach((_,i)=>{leg.insertAdjacentHTML('beforeend',`<div class="legend-item"><div class="legend-color" style="background:rgb(${ANT_COLORS[i%5].join(',')})"></div><span>Ant ${i+1}</span></div>`);});
    leg.insertAdjacentHTML('beforeend',`<div class="legend-item"><div class="legend-color" style="background:rgb(135, 75, 15)"></div><span>Saturn Sigil</span></div>`);
  }
  lastFrameTime = null; animationId = requestAnimationFrame(animate); initAntPrev(colony.ants);
}

function stopAnimation() { if(animationId!==null) { cancelAnimationFrame(animationId); animationId=null; } }

function resetSimulation() {
  stopAnimation(); clearSigil(); clearOffscreen(); resetCounts();
  colony = new Colony(+document.getElementById('ant-count').value);
  scoreData=[]; tensionData=[]; history=[]; stateMap=new Map(); loopEcho={l:0,r:0}; loomHistory=[];
  document.getElementById('convergence-banner').style.display='none';
  document.getElementById('download-btn').disabled = true;
  const w=document.getElementById('trail-canvas-wrap'); w.querySelectorAll('.trail-ant').forEach(e=>e.remove());
  colony.ants.forEach((_,i)=>{w.insertAdjacentHTML('beforeend',`<div class="trail-ant trail-ant-${i}" id="trail-ant-${i}"></div>`);});
  const leg=document.getElementById('ant-legend'); leg.replaceChildren();
  colony.ants.forEach((_,i)=>{leg.insertAdjacentHTML('beforeend',`<div class="legend-item"><div class="legend-color" style="background:rgb(${ANT_COLORS[i%5].join(',')})"></div><span>Ant ${i+1}</span></div>`);});
  leg.insertAdjacentHTML('beforeend',`<div class="legend-item"><div class="legend-color" style="background:rgb(135, 75, 15)"></div><span>Saturn Sigil</span></div>`);
  initAntPrev(colony.ants); updateDisplay();
}

function downloadImage(gridSize) {
  if (gifFrames.length === 0 && gridSize === 3) {
    alert('No image available. Run the simulation until convergence first.');
    return;
  }
  
  const downloadBtn = gridSize === 3 ? 
    document.getElementById('download-btn') : 
    document.querySelectorAll('button[onclick^="downloadImage(27)"]')[0];
  
  downloadBtn.disabled = true;
  downloadBtn.textContent = 'Saving...';
  
  let canvas;
  if (gridSize === 3) {
    canvas = gifFrames[gifFrames.length - 1];
  } else {
    canvas = document.getElementById('langton-field');
  }
  
  const link = document.createElement('a');
  link.download = `saturn-sigil-${gridSize}x${gridSize}-${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  
  downloadBtn.disabled = false;
  downloadBtn.innerHTML = '&#11015; Download ' + (gridSize === 3 ? 'Saturn Magic Square' : 'Shadow');
}

// 1. GENERATE THE 9 CUBES IN THE DOM
const tessArray = document.getElementById('tesseract-array');
if (tessArray) {
  const faces = ['front','back','right','left','top','bottom'];
  let html = '';
  for(let i=0; i<9; i++) {
     html += `<div class="mini-cube anim-${i%4}" id="mini-cube-${i}">`;
     faces.forEach(f => {
       html += `<div class="face mini-face ${f}"><canvas id="cube-${i}-${f}"></canvas></div>`;
     });
     html += `</div>`;
  }
  tessArray.innerHTML = html;
}

// 2. SET UP HI-RES CANVAS RENDERERS (Outer & Inner Faces)
const dpr = window.devicePixelRatio || 1;
['trail-canvas','sigil-canvas','langton-field','hidden-shadow-canvas'].forEach(id=>{
  const e=document.getElementById(id); 
  if(e) { e.width=SIZE*dpr; e.height=SIZE*dpr; e.getContext('2d').setTransform(dpr,0,0,dpr,0,0); }
});

['macro-front','macro-back','macro-right','macro-left','macro-top','macro-bottom'].forEach(id=>{
  const e = document.getElementById(id);
  if(e) { e.width=SIZE*dpr; e.height=SIZE*dpr; e.getContext('2d').setTransform(dpr,0,0,dpr,0,0); }
});

for(let i=0; i<9; i++) {
  ['front','back','right','left','top','bottom'].forEach(f => {
    const e = document.getElementById(`cube-${i}-${f}`);
    // 80x80 logic size matching CSS
    if(e) { e.width=80*dpr; e.height=80*dpr; e.getContext('2d').setTransform(dpr,0,0,dpr,0,0); } 
  });
}

makeOffscreen(); resizeCharts(); resetCounts();
window.addEventListener('resize', ()=>{ resizeCharts(); drawChart(); drawHiddenChart(); });
resetSimulation();

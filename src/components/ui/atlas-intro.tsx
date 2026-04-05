import { useState, useEffect, useRef, useCallback } from "react";
import atlasLogo from "@/assets/atlas-logo.png";
import { TypingText } from "./typing-text";

interface AtlasIntroProps {
  onComplete: () => void;
}

interface Node {
  lat: number;
  lng: number;
  size: number;
  pulsePhase: number;
  pulseSpeed: number;
}

interface Signal {
  fromNode: number;
  toNode: number;
  progress: number;
  speed: number;
  color: string;
  width: number;
}

// Project 3D sphere point to 2D
function project(
  lat: number,
  lng: number,
  rotation: number,
  tilt: number,
  radius: number,
  cx: number,
  cy: number
): { x: number; y: number; z: number; visible: boolean } {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + rotation) * (Math.PI / 180);

  const x3d = radius * Math.sin(phi) * Math.cos(theta);
  const y3d = radius * Math.cos(phi);
  const z3d = radius * Math.sin(phi) * Math.sin(theta);

  const cosT = Math.cos(tilt);
  const sinT = Math.sin(tilt);
  const y3dTilted = y3d * cosT - z3d * sinT;
  const z3dTilted = y3d * sinT + z3d * cosT;

  return {
    x: cx + x3d,
    y: cy + y3dTilted,
    z: z3dTilted,
    visible: z3dTilted > -radius * 0.1,
  };
}

// Simplified continent outlines as [lat, lng] arrays
const continents: [number, number][][] = [
  // North America
  [
    [60,-140],[65,-168],[72,-168],[71,-155],[60,-140],[58,-137],[55,-132],[50,-127],
    [48,-123],[40,-124],[35,-120],[32,-117],[28,-115],[24,-110],[20,-105],[18,-97],
    [20,-87],[22,-85],[25,-80],[30,-82],[28,-77],[35,-75],[38,-76],[40,-74],
    [42,-70],[44,-67],[47,-67],[47,-60],[50,-57],[52,-56],[55,-60],[58,-64],
    [60,-65],[62,-75],[58,-78],[56,-80],[53,-82],[50,-85],[50,-90],[52,-95],
    [55,-100],[58,-110],[60,-120],[62,-130],[60,-140],
  ],
  // South America
  [
    [12,-72],[10,-75],[8,-77],[5,-77],[2,-80],[0,-80],[-5,-81],[-7,-80],
    [-10,-77],[-15,-75],[-18,-70],[-22,-70],[-25,-65],[-28,-65],[-30,-60],
    [-33,-58],[-35,-57],[-38,-58],[-40,-62],[-43,-65],[-46,-68],[-50,-70],
    [-53,-72],[-55,-68],[-55,-65],[-52,-68],[-48,-66],[-45,-64],[-42,-60],
    [-38,-55],[-35,-53],[-30,-50],[-28,-48],[-25,-45],[-22,-40],[-18,-38],
    [-15,-39],[-10,-37],[-5,-35],[-2,-50],[0,-50],[2,-60],[5,-62],[8,-63],
    [10,-68],[12,-72],
  ],
  // Europe
  [
    [36,-10],[37,-5],[38,0],[40,0],[43,3],[43,5],[44,8],[46,6],[47,7],
    [48,2],[49,0],[50,-5],[52,-6],[54,-8],[56,-7],[58,-5],[59,-3],[58,5],
    [57,8],[56,10],[55,12],[55,15],[57,18],[60,20],[62,22],[64,25],[66,25],
    [68,20],[70,25],[70,30],[68,35],[65,30],[62,28],[60,25],[58,22],[56,20],
    [55,18],[53,15],[52,14],[50,14],[48,17],[47,15],[45,14],[44,12],[42,13],
    [41,15],[40,18],[38,24],[36,28],[38,28],[40,26],[42,28],[40,30],[38,26],
    [36,22],[36,15],[38,10],[36,5],[36,-5],[36,-10],
  ],
  // Africa
  [
    [37,-5],[36,0],[35,10],[33,10],[30,10],[28,12],[25,15],[22,17],[18,16],
    [15,18],[12,15],[10,10],[5,10],[2,10],[0,10],[-3,12],[-5,12],[-8,14],
    [-10,15],[-12,18],[-15,20],[-18,22],[-20,25],[-22,28],[-25,28],[-28,30],
    [-30,30],[-32,28],[-33,27],[-34,25],[-34,18],[-30,17],[-25,15],[-20,12],
    [-15,12],[-10,13],[-5,10],[-3,8],[0,5],[2,2],[5,1],[5,-5],[7,-10],
    [10,-15],[12,-17],[15,-17],[17,-16],[20,-17],[22,-15],[25,-15],[28,-10],
    [30,-10],[33,-8],[35,-5],[37,-5],
  ],
  // Asia (simplified)
  [
    [42,28],[45,30],[48,35],[50,40],[52,45],[55,50],[57,55],[60,60],[62,65],
    [65,70],[67,75],[68,80],[66,90],[64,100],[62,110],[60,120],[58,130],
    [55,135],[52,140],[50,140],[48,135],[45,130],[42,132],[38,128],[35,130],
    [33,132],[30,122],[28,120],[25,120],[22,115],[18,108],[15,105],[12,105],
    [10,100],[8,98],[5,100],[2,104],[1,105],[-2,106],[-5,106],[-8,108],
    [-8,115],[-5,118],[-2,117],[0,115],[2,110],[5,108],[5,115],[2,120],
    [5,120],[8,118],[10,115],[12,120],[18,120],[22,120],[25,118],[28,115],
    [30,110],[28,105],[25,100],[22,95],[20,90],[18,82],[15,75],[18,72],
    [20,70],[22,68],[25,65],[28,60],[30,50],[32,48],[35,45],[38,40],
    [40,35],[42,28],
  ],
  // Australia
  [
    [-12,132],[-14,127],[-16,123],[-20,118],[-23,114],[-25,113],[-28,114],
    [-30,115],[-32,116],[-33,118],[-35,117],[-37,140],[-38,145],[-37,148],
    [-35,150],[-33,152],[-30,153],[-28,153],[-25,152],[-22,150],[-20,148],
    [-18,146],[-15,145],[-14,142],[-13,136],[-12,132],
  ],
];

export function AtlasIntro({ onComplete }: AtlasIntroProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<"globe" | "zoom" | "logo" | "text">("globe");
  const [fadeOut, setFadeOut] = useState(false);
  const [showLogo, setShowLogo] = useState(false);
  const [showText, setShowText] = useState(false);
  const phaseRef = useRef(phase);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Timeline
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setPhase("zoom"), 2500));
    timers.push(setTimeout(() => { setPhase("logo"); setShowLogo(true); }, 3700));
    timers.push(setTimeout(() => { setPhase("text"); setShowText(true); }, 4400));
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  // Canvas animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio;
    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const cx = W / 2;
    const cy = H / 2;
    const baseRadius = Math.min(W, H) * 0.28;

    // Nodes
    const nodes: Node[] = [
      { lat: 40, lng: -100, size: 4, pulsePhase: 0, pulseSpeed: 2 },
      { lat: 52, lng: 10, size: 4.5, pulsePhase: 1, pulseSpeed: 2.2 },
      { lat: 35, lng: 105, size: 3.5, pulsePhase: 2, pulseSpeed: 1.8 },
      { lat: -25, lng: 135, size: 3, pulsePhase: 0.5, pulseSpeed: 2.5 },
      { lat: 5, lng: 25, size: 2.5, pulsePhase: 1.5, pulseSpeed: 2.1 },
      { lat: -15, lng: -55, size: 2.5, pulsePhase: 3, pulseSpeed: 1.9 },
      { lat: 60, lng: 30, size: 3, pulsePhase: 0.8, pulseSpeed: 2.3 },
      { lat: 25, lng: 55, size: 2.8, pulsePhase: 2.5, pulseSpeed: 2 },
      { lat: 1, lng: 103, size: 3, pulsePhase: 1.2, pulseSpeed: 2.4 },
      { lat: 37, lng: -122, size: 3.5, pulsePhase: 0.3, pulseSpeed: 2.1 },
      { lat: 51, lng: -0.1, size: 3.8, pulsePhase: 1.8, pulseSpeed: 1.7 },
      { lat: 35, lng: 139, size: 3.2, pulsePhase: 2.8, pulseSpeed: 2.2 },
      { lat: -34, lng: 18, size: 2.5, pulsePhase: 0.7, pulseSpeed: 2.6 },
      { lat: 55, lng: -3, size: 2.8, pulsePhase: 1.1, pulseSpeed: 2 },
      { lat: 48, lng: 2, size: 3, pulsePhase: 2.2, pulseSpeed: 1.9 },
    ];

    const signals: Signal[] = [];
    let lastSignalTime = 0;

    const stars = Array.from({ length: 150 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      size: Math.random() * 1.5,
      brightness: 0.3 + Math.random() * 0.7,
      twinkleSpeed: 1 + Math.random() * 3,
    }));

    let animId: number;
    const startTime = performance.now();

    // Helper to draw a continent
    const drawContinent = (
      coords: [number, number][],
      rotation: number,
      tilt: number,
      radius: number
    ) => {
      // Build projected points, splitting at visibility boundaries
      const segments: { x: number; y: number }[][] = [];
      let currentSeg: { x: number; y: number }[] = [];

      for (const [lat, lng] of coords) {
        const p = project(lat, lng, rotation, tilt, radius, cx, cy);
        if (p.visible) {
          currentSeg.push({ x: p.x, y: p.y });
        } else {
          if (currentSeg.length > 2) segments.push(currentSeg);
          currentSeg = [];
        }
      }
      if (currentSeg.length > 2) segments.push(currentSeg);

      for (const seg of segments) {
        ctx.beginPath();
        ctx.moveTo(seg[0].x, seg[0].y);
        for (let i = 1; i < seg.length; i++) {
          ctx.lineTo(seg[i].x, seg[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = "rgba(0, 210, 170, 0.12)";
        ctx.fill();
        ctx.strokeStyle = "rgba(0, 230, 190, 0.35)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    };

    const animate = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      const currentPhase = phaseRef.current;

      if (currentPhase === "logo" || currentPhase === "text") {
        ctx.fillStyle = "hsl(220, 25%, 6%)";
        ctx.fillRect(0, 0, W, H);
        return;
      }

      ctx.fillStyle = "hsl(220, 25%, 6%)";
      ctx.fillRect(0, 0, W, H);

      let zoomProgress = 0;
      if (elapsed > 2.5) {
        zoomProgress = Math.min((elapsed - 2.5) / 1.2, 1);
        zoomProgress = zoomProgress * zoomProgress * (3 - 2 * zoomProgress);
      }

      const scale = 1 + zoomProgress * 8;
      const radius = baseRadius * scale;
      const rotation = elapsed * 25;
      const tilt = 0.35;
      const globeAlpha = 1 - zoomProgress * zoomProgress;

      // Stars
      stars.forEach((s) => {
        const alpha = s.brightness * (0.6 + Math.sin(elapsed * s.twinkleSpeed) * 0.4) * globeAlpha;
        if (alpha > 0.05) {
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${alpha})`;
          ctx.fill();
        }
      });

      if (globeAlpha < 0.02) {
        animId = requestAnimationFrame(animate);
        return;
      }

      ctx.globalAlpha = globeAlpha;

      // Globe fill (dark ocean)
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(10, 20, 35, 0.6)";
      ctx.fill();

      // Subtle grid lines (latitude)
      for (let lat = -60; lat <= 60; lat += 30) {
        ctx.beginPath();
        let first = true;
        for (let lng = 0; lng <= 360; lng += 4) {
          const p = project(lat, lng, rotation, tilt, radius, cx, cy);
          if (p.visible) {
            if (first) { ctx.moveTo(p.x, p.y); first = false; }
            else ctx.lineTo(p.x, p.y);
          } else { first = true; }
        }
        ctx.strokeStyle = "rgba(0, 210, 170, 0.06)";
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // Subtle grid lines (longitude)
      for (let lng = 0; lng < 360; lng += 30) {
        ctx.beginPath();
        let first = true;
        for (let lat = -80; lat <= 80; lat += 4) {
          const p = project(lat, lng, rotation, tilt, radius, cx, cy);
          if (p.visible) {
            if (first) { ctx.moveTo(p.x, p.y); first = false; }
            else ctx.lineTo(p.x, p.y);
          } else { first = true; }
        }
        ctx.strokeStyle = "rgba(0, 210, 170, 0.06)";
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // Draw continents
      for (const continent of continents) {
        drawContinent(continent, rotation, tilt, radius);
      }

      // Globe outline glow
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0, 210, 170, 0.25)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Atmosphere glow
      const atmosGrad = ctx.createRadialGradient(cx, cy, radius * 0.92, cx, cy, radius * 1.2);
      atmosGrad.addColorStop(0, "rgba(0, 210, 170, 0.1)");
      atmosGrad.addColorStop(0.5, "rgba(0, 210, 170, 0.04)");
      atmosGrad.addColorStop(1, "transparent");
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.2, 0, Math.PI * 2);
      ctx.fillStyle = atmosGrad;
      ctx.fill();

      // Spawn signals between random node pairs
      if (elapsed - lastSignalTime > 0.12 && elapsed < 2.5) {
        const from = Math.floor(Math.random() * nodes.length);
        let to = Math.floor(Math.random() * nodes.length);
        while (to === from) to = Math.floor(Math.random() * nodes.length);
        signals.push({
          fromNode: from,
          toNode: to,
          progress: 0,
          speed: 0.6 + Math.random() * 0.5,
          color: Math.random() > 0.3 ? "0, 210, 170" : "0, 180, 220",
          width: 1 + Math.random() * 1.5,
        });
        lastSignalTime = elapsed;
      }

      // Draw signals (node to node)
      for (let i = signals.length - 1; i >= 0; i--) {
        const sig = signals[i];
        sig.progress += sig.speed * 0.016;
        if (sig.progress >= 1) { signals.splice(i, 1); continue; }

        const fromNode = nodes[sig.fromNode];
        const toNode = nodes[sig.toNode];
        const fp = project(fromNode.lat, fromNode.lng, rotation, tilt, radius, cx, cy);
        const tp = project(toNode.lat, toNode.lng, rotation, tilt, radius, cx, cy);
        if (!fp.visible && !tp.visible) continue;

        const t = sig.progress;
        const headX = fp.x + (tp.x - fp.x) * t;
        const headY = fp.y + (tp.y - fp.y) * t;
        const tailT = Math.max(0, t - 0.25);
        const tailX = fp.x + (tp.x - fp.x) * tailT;
        const tailY = fp.y + (tp.y - fp.y) * tailT;

        const sigGrad = ctx.createLinearGradient(tailX, tailY, headX, headY);
        sigGrad.addColorStop(0, `rgba(${sig.color}, 0)`);
        sigGrad.addColorStop(0.6, `rgba(${sig.color}, ${0.5 * (1 - t * 0.4)})`);
        sigGrad.addColorStop(1, `rgba(${sig.color}, ${0.85 * (1 - t * 0.2)})`);

        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(headX, headY);
        ctx.strokeStyle = sigGrad;
        ctx.lineWidth = sig.width;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(headX, headY, 2 + sig.width, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${sig.color}, ${0.4 * (1 - t)})`;
        ctx.fill();
      }

      // Draw persistent mesh connections between nearby nodes
      const meshThreshold = radius * 1.2; // max distance for a connection line
      for (let i = 0; i < nodes.length; i++) {
        const pi = project(nodes[i].lat, nodes[i].lng, rotation, tilt, radius, cx, cy);
        if (!pi.visible) continue;
        for (let j = i + 1; j < nodes.length; j++) {
          const pj = project(nodes[j].lat, nodes[j].lng, rotation, tilt, radius, cx, cy);
          if (!pj.visible) continue;
          const dx = pi.x - pj.x;
          const dy = pi.y - pj.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < meshThreshold) {
            const depthI = 0.3 + (pi.z / radius + 1) * 0.35;
            const depthJ = 0.3 + (pj.z / radius + 1) * 0.35;
            const alpha = Math.min(depthI, depthJ) * (1 - dist / meshThreshold) * 0.18;
            if (alpha > 0.01) {
              ctx.beginPath();
              ctx.moveTo(pi.x, pi.y);
              ctx.lineTo(pj.x, pj.y);
              ctx.strokeStyle = `rgba(0, 210, 170, ${alpha})`;
              ctx.lineWidth = 0.7;
              ctx.stroke();
            }
          }
        }
      }

      // Draw nodes (on top of continents, rotating with globe)
      nodes.forEach((node) => {
        const np = project(node.lat, node.lng, rotation, tilt, radius, cx, cy);
        if (!np.visible) return;

        const depthAlpha = 0.3 + (np.z / radius + 1) * 0.35;
        const pulse = 0.6 + Math.sin(elapsed * node.pulseSpeed + node.pulsePhase) * 0.4;

        // Outer glow
        const nodeGrad = ctx.createRadialGradient(np.x, np.y, 0, np.x, np.y, node.size * 5);
        nodeGrad.addColorStop(0, `rgba(0, 210, 170, ${0.5 * pulse * depthAlpha})`);
        nodeGrad.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(np.x, np.y, node.size * 5, 0, Math.PI * 2);
        ctx.fillStyle = nodeGrad;
        ctx.fill();

        // Dot
        ctx.beginPath();
        ctx.arc(np.x, np.y, node.size * (0.8 + pulse * 0.3), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 255, 210, ${depthAlpha * pulse})`;
        ctx.fill();

        // White core
        ctx.beginPath();
        ctx.arc(np.x, np.y, node.size * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${depthAlpha * pulse * 0.8})`;
        ctx.fill();

        // Pulse ring
        const ringPhase = (elapsed * node.pulseSpeed + node.pulsePhase) % (Math.PI * 2);
        const ringScale = ringPhase / (Math.PI * 2);
        if (ringScale < 0.7) {
          ctx.beginPath();
          ctx.arc(np.x, np.y, node.size * (1 + ringScale * 6), 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(0, 210, 170, ${(1 - ringScale / 0.7) * 0.35 * depthAlpha})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      });

      ctx.globalAlpha = 1;
      animId = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(animId);
  }, []);

  const handleTypingComplete = useCallback(() => {
    setTimeout(() => {
      setFadeOut(true);
      setTimeout(onComplete, 1000);
    }, 800);
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[100] transition-opacity duration-1000 ease-in-out ${
        fadeOut ? "opacity-0" : "opacity-100"
      }`}
      style={{ background: "hsl(220, 25%, 6%)" }}
    >
      <canvas ref={canvasRef} className="absolute inset-0" style={{ width: "100%", height: "100%" }} />

      <div
        className={`absolute inset-0 flex items-center justify-center transition-opacity duration-700 ease-out ${
          showLogo ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="relative flex flex-col items-center">
          <div
            className={`relative transition-all duration-700 ${
              showLogo ? "scale-100 opacity-100" : "scale-[0.3] opacity-0"
            }`}
            style={{ transitionTimingFunction: "cubic-bezier(0.175, 0.885, 0.32, 1.275)" }}
          >
            <div
              className={`absolute inset-0 -m-20 rounded-full blur-3xl transition-all duration-1000 ${
                showLogo ? "opacity-80 scale-110" : "opacity-0 scale-50"
              }`}
              style={{ background: "radial-gradient(circle, rgba(0,210,170,0.3), transparent 70%)" }}
            />
            <div
              className={`absolute inset-0 -m-10 rounded-full blur-2xl transition-all duration-700 delay-100 ${
                showLogo ? "opacity-100" : "opacity-0"
              }`}
              style={{ background: "radial-gradient(circle, rgba(0,210,170,0.25), transparent 60%)" }}
            />

            <div
              className={`absolute inset-0 -m-28 transition-all duration-1000 ${
                showLogo ? "scale-[2.5] opacity-0" : "scale-75 opacity-60"
              }`}
            >
              <div className="w-full h-full rounded-full border-2" style={{ borderColor: "rgba(0,210,170,0.5)" }} />
            </div>
            <div
              className={`absolute inset-0 -m-20 transition-all duration-800 delay-100 ${
                showLogo ? "scale-[2] opacity-0" : "scale-75 opacity-40"
              }`}
            >
              <div className="w-full h-full rounded-full border" style={{ borderColor: "rgba(0,180,220,0.4)" }} />
            </div>

            <img
              src={atlasLogo}
              alt="AtlasPool"
              className="w-28 h-28 md:w-36 md:h-36 object-contain relative z-10"
              style={{ filter: "drop-shadow(0 0 40px rgba(0,210,170,0.6))" }}
            />
          </div>

          <div
            className={`mt-8 transition-all duration-700 ${
              showText ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
            style={{ transitionTimingFunction: "cubic-bezier(0.175, 0.885, 0.32, 1.275)" }}
          >
            <h1
              className="text-3xl md:text-5xl lg:text-6xl font-bold tracking-wider text-center atlas-neon-text font-mono"
              style={{ filter: "drop-shadow(0 0 20px rgba(0,210,170,0.5))" }}
            >
              {showText ? (
                <TypingText
                  text="ATLAS POOL"
                  onComplete={handleTypingComplete}
                  typingSpeed={65}
                  deletingSpeed={0}
                  pauseDuration={600}
                  loop={false}
                  completeOnType
                />
              ) : (
                <span aria-hidden="true">&nbsp;</span>
              )}
            </h1>
            <p
              className={`text-center text-sm md:text-base mt-3 tracking-[0.25em] font-light font-mono transition-all duration-500 delay-300 ${
                showText ? "opacity-100" : "opacity-0"
              }`}
              style={{ color: "rgba(0,210,170,0.7)" }}
            >
              Reliable. Performant. Global.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

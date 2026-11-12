"use client";

/**
 * SwarmCanvas — one <canvas>, requestAnimationFrame, DPR-aware, ~250 lines of
 * plain canvas. No WebGL, no d3, no force-graph library (§11.10).
 *
 * Draw order: background → grid → cluster halos → agent edges → hub edges →
 * agents → pulses → labels → legend.
 */
import { useEffect, useRef } from "react";
import type { Persona } from "@/domain/swarm/personas";
import { ARCH_COLORS, type ArchetypeKey } from "@/domain/swarm/archetypes";

const POS = "#7FB069";
const NEG = "#C2410C";
const NEU = "#9C9484";

export interface CanvasNode {
  i: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  cluster: number;
  hub: boolean;
}

export interface SwarmCanvasProps {
  personas: Persona[];
  /** stance per agent on the selected dimension at the current round, 0..1 */
  stance: number[];
  /** rounds of exposure per agent; 0 = not yet reached by any event */
  seen: number[];
  /** neighbours[i] ids */
  neighbours: number[][];
  clusters: ArchetypeKey[];
  decisionLine: number;
  selectedDim: string;
  running: boolean;
  pulse: { a: number; b: number; t0: number } | null;
  ghost: number[] | null;
  onPick: (i: number) => void;
  onFps?: (fps: number) => void;
  highlightId: string | null;
  /** UI label drawn on the canvas; the caller passes the active language. */
  decisionLabel: string;
}

function lerpColor(a: [number, number, number], b: [number, number, number], t: number): string {
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

const hex = (h: string): [number, number, number] => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

export function SwarmCanvas(props: SwarmCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const nodesRef = useRef<CanvasNode[]>([]);
  const alphaRef = useRef(1);
  const propsRef = useRef(props);
  propsRef.current = props;
  const fpsRef = useRef({ frames: 0, t0: 0 });
  const hoverRef = useRef<number | null>(null);

  // build / rebuild the graph layout when the population changes
  useEffect(() => {
    const n = props.personas.length;
    const clusters = props.clusters;
    const R = 0.34;
    const nodes: CanvasNode[] = props.personas.map((p, i) => {
      const c = clusters.indexOf(p.archetype);
      const angle = (c / clusters.length) * Math.PI * 2 - Math.PI / 2;
      const cx = 0.5 + Math.cos(angle) * R;
      const cy = 0.5 + Math.sin(angle) * R;
      const spread = 0.085;
      const a2 = (i * 2.399963) % (Math.PI * 2);
      const r2 = Math.sqrt(((i * 37) % 97) / 97) * spread;
      return {
        i,
        x: cx + Math.cos(a2) * r2,
        y: cy + Math.sin(a2) * r2,
        vx: 0,
        vy: 0,
        cluster: c,
        hub: false,
      };
    });
    // one hub per cluster, the most "vocal" agent
    for (let c = 0; c < clusters.length; c++) {
      let best = -1;
      let bestVoice = -1;
      props.personas.forEach((p, i) => {
        if (p.archetype === clusters[c] && p.behav.voice > bestVoice) {
          bestVoice = p.behav.voice;
          best = i;
        }
      });
      if (best >= 0) nodes[best].hub = true;
    }
    nodesRef.current = nodes;
    alphaRef.current = 1;
    void n;
  }, [props.personas, props.clusters]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let dpr = Math.min(2, window.devicePixelRatio || 1);
    let W = 0;
    let H = 0;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      W = Math.max(320, rect.width);
      H = Math.max(320, rect.height);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const draw = (ts: number) => {
      const p = propsRef.current;
      const nodes = nodesRef.current;
      const alpha = alphaRef.current;

      // ---- physics ----
      for (const nd of nodes) {
        const cx = (nd.cluster + 0.5) / p.clusters.length;
        void cx;
      }
      const centres = p.clusters.map((_, c) => {
        const angle = (c / p.clusters.length) * Math.PI * 2 - Math.PI / 2;
        return { x: 0.5 + Math.cos(angle) * 0.34, y: 0.5 + Math.sin(angle) * 0.34 };
      });

      for (const nd of nodes) {
        const c = centres[nd.cluster];
        // centre attraction
        const pull = nd.hub ? 0.03 : 0.012;
        nd.vx += (c.x - nd.x) * pull * alpha;
        nd.vy += (c.y - nd.y) * pull * alpha;
      }

      // pairwise repulsion, bucketed to keep it O(n) in practice
      const cell = 0.055;
      const buckets = new Map<string, CanvasNode[]>();
      for (const nd of nodes) {
        const key = `${Math.floor(nd.x / cell)}:${Math.floor(nd.y / cell)}`;
        const list = buckets.get(key) ?? [];
        list.push(nd);
        buckets.set(key, list);
      }
      for (const nd of nodes) {
        const gx = Math.floor(nd.x / cell);
        const gy = Math.floor(nd.y / cell);
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const list = buckets.get(`${gx + dx}:${gy + dy}`);
            if (!list) continue;
            for (const o of list) {
              if (o.i <= nd.i) continue;
              const ddx = o.x - nd.x;
              const ddy = o.y - nd.y;
              const d2 = ddx * ddx + ddy * ddy + 1e-6;
              const r = nd.hub || o.hub ? 0.038 : 0.02;
              if (d2 > r * r * 4) continue;
              const f = ((r * r) / d2) * 0.35 * alpha * 0.00025;
              const d = Math.sqrt(d2);
              nd.vx -= (ddx / d) * f;
              nd.vy -= (ddy / d) * f;
              o.vx += (ddx / d) * f;
              o.vy += (ddy / d) * f;
            }
          }
        }
      }

      // springs on edges
      for (let i = 0; i < nodes.length; i++) {
        const nbrs = p.neighbours[i] ?? [];
        for (const j of nbrs) {
          if (j <= i) continue;
          const a = nodes[i];
          const b = nodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.sqrt(dx * dx + dy * dy) + 1e-6;
          const rest = a.hub || b.hub ? 0.12 : 0.034;
          const k = a.hub || b.hub ? 0.0012 : 0.01;
          const f = (d - rest) * k * alpha;
          a.vx += (dx / d) * f;
          a.vy += (dy / d) * f;
          b.vx -= (dx / d) * f;
          b.vy -= (dy / d) * f;
        }
      }

      // integrate with damping, clamp to the canvas with a 12 px margin
      const m = 0.012;
      for (const nd of nodes) {
        nd.vx *= 0.84;
        nd.vy *= 0.84;
        nd.x += nd.vx;
        nd.y += nd.vy;
        nd.x = Math.min(1 - m, Math.max(m, nd.x));
        nd.y = Math.min(1 - m, Math.max(m, nd.y));
      }
      alphaRef.current = Math.max(0.08, alpha * 0.992);

      // ---- draw ----
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#1D1C19";
      ctx.fillRect(0, 0, W, H);

      // grid, 48 px, 2.5% white
      ctx.strokeStyle = "rgba(255,255,255,0.025)";
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 48) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, H);
        ctx.stroke();
      }
      for (let y = 0; y < H; y += 48) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(W, y + 0.5);
        ctx.stroke();
      }

      const px = (v: number) => v * W;
      const py = (v: number) => v * H;

      // cluster halos
      centres.forEach((c, idx) => {
        const key = p.clusters[idx];
        const col = hex(ARCH_COLORS[key]);
        const g = ctx.createRadialGradient(px(c.x), py(c.y), 0, px(c.x), py(c.y), 92);
        g.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},0.16)`);
        g.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px(c.x), py(c.y), 92, 0, Math.PI * 2);
        ctx.fill();
      });

      // agent edges then hub edges
      ctx.lineWidth = 0.6;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (const j of p.neighbours[i] ?? []) {
          const b = nodes[j];
          if (a.hub && b.hub) continue;
          if (a.hub || b.hub) continue;
          ctx.strokeStyle = "rgba(215,206,188,0.055)";
          ctx.beginPath();
          ctx.moveTo(px(a.x), py(a.y));
          ctx.lineTo(px(b.x), py(b.y));
          ctx.stroke();
        }
      }
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (const j of p.neighbours[i] ?? []) {
          const b = nodes[j];
          if (!(a.hub || b.hub)) continue;
          ctx.strokeStyle = "rgba(215,206,188,0.11)";
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(px(a.x), py(a.y));
          ctx.lineTo(px(b.x), py(b.y));
          ctx.stroke();
        }
      }

      // ghost of the previous run's final camps
      if (p.ghost) {
        ctx.save();
        ctx.globalAlpha = 0.28;
        ctx.strokeStyle = "rgba(210,200,180,0.7)";
        ctx.setLineDash([3, 3]);
        for (let i = 0; i < nodes.length; i++) {
          const nd = nodes[i];
          ctx.beginPath();
          ctx.arc(px(nd.x), py(nd.y), 4 + p.ghost[i] * 6, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      // agents: fill = stance colour on the selected dimension
      for (let i = 0; i < nodes.length; i++) {
        const nd = nodes[i];
        const s = p.stance[i] ?? 0.5;
        const reached = (p.seen[i] ?? 0) > 0;
        const t = Math.min(1, Math.abs(s - 0.5) * 4.2);
        const col = s >= 0.5 ? lerpColor(hex(NEU), hex(POS), t) : lerpColor(hex(NEU), hex(NEG), t);
        const r = nd.hub ? 4.4 : 2.6;
        ctx.globalAlpha = reached ? 1 : 0.28;
        if (p.highlightId && p.personas[i].id === p.highlightId) {
          ctx.strokeStyle = "#F7F3EA";
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(px(nd.x), py(nd.y), r + 4, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (hoverRef.current === i) {
          ctx.strokeStyle = "rgba(247,243,234,0.85)";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(px(nd.x), py(nd.y), r + 3, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(px(nd.x), py(nd.y), r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // pulse along the edge, 380 ms
      if (p.pulse) {
        const a = nodes[p.pulse.a];
        const b = nodes[p.pulse.b];
        if (a && b) {
          const t = Math.min(1, (ts - p.pulse.t0) / 380);
          if (t < 1) {
            const x = a.x + (b.x - a.x) * t;
            const y = a.y + (b.y - a.y) * t;
            ctx.fillStyle = "rgba(247,243,234,0.92)";
            ctx.beginPath();
            ctx.arc(px(x), py(y), 2.6, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // labels
      ctx.font = "500 10px ui-monospace, monospace";
      ctx.fillStyle = "rgba(233,226,211,0.72)";
      ctx.textAlign = "center";
      p.clusters.forEach((key, idx) => {
        const c = centres[idx];
        const label = key.replace("hh_", "hh·").replace("_", " ");
        ctx.fillText(label.toUpperCase(), px(c.x), py(c.y) - 62);
      });

      // legend: decision line
      const dx = px(0.06) + (px(0.94) - px(0.06)) * p.decisionLine;
      ctx.strokeStyle = "rgba(226,196,120,0.55)";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(dx, 8);
      ctx.lineTo(dx, H - 8);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(226,196,120,0.85)";
      ctx.font = "500 9.5px ui-monospace, monospace";
      ctx.textAlign = "left";
      ctx.fillText(`${p.decisionLabel} ${p.decisionLine.toFixed(2)}`, dx + 5, 18);

      // fps
      const f = fpsRef.current;
      f.frames++;
      if (ts - f.t0 > 500) {
        const fps = (f.frames * 1000) / (ts - f.t0);
        p.onFps?.(fps);
        f.frames = 0;
        f.t0 = ts;
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    // interaction
    const toIdx = (ev: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = (ev.clientX - rect.left) / rect.width;
      const my = (ev.clientY - rect.top) / rect.height;
      let best = -1;
      let bd = 0.02;
      for (const nd of nodesRef.current) {
        const d = Math.hypot(nd.x - mx, nd.y - my);
        if (d < bd) {
          bd = d;
          best = nd.i;
        }
      }
      return best;
    };
    const onMove = (ev: MouseEvent) => {
      hoverRef.current = toIdx(ev);
      canvas.style.cursor = hoverRef.current >= 0 ? "pointer" : "default";
    };
    const onClick = (ev: MouseEvent) => {
      const i = toIdx(ev);
      if (i >= 0) propsRef.current.onPick(i);
    };
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("click", onClick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("click", onClick);
    };
  }, []);

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", height: "100%" }}>
      <canvas ref={canvasRef} aria-label="Force-directed visualisatie van 240 synthetische agenten" />
    </div>
  );
}

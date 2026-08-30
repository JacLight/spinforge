/**
 * SpinForge — Platform. The infrastructure story, on the shared design shell.
 * Copyright (c) 2025 Jacob Ajiboye — MIT.
 */
import { ArrowRight, Boxes, GitBranch, Globe, HardDrive, Server, ShieldCheck, Sparkles, Terminal, Zap, Check } from "lucide-react";
import { SiteShell } from "@/components/site/Site";

const CAPS = [
  { I: Sparkles, t: "AI configuration", p: "SpinForge reads your project, infers the framework, install and build commands, and runtime — then writes the pipeline for you." },
  { I: GitBranch, t: "Reproducible builds", p: "Every build runs in isolated, cached stages with named, versioned artifacts. Same input, same output, every time." },
  { I: Boxes, t: "Isolated containers", p: "Each app runs sandboxed in its own network namespace with private networking. No noisy neighbors, ever." },
  { I: Server, t: "Nomad orchestration", p: "A Nomad + Consul cluster schedules every app across nodes, self-heals failed allocations, and rolls deploys with zero downtime." },
  { I: HardDrive, t: "Durable Ceph storage", p: "Workspaces, artifacts, and volumes live on a replicated Ceph filesystem — readable from any node, resilient to host loss." },
  { I: Globe, t: "Edge routing + TLS", p: "Requests are routed to the nearest healthy region, with certificates issued and renewed automatically on every domain." },
];

export default function PlatformPage() {
  return (
    <SiteShell active="platform">
      <style dangerouslySetInnerHTML={{ __html: `
        .sf .nrow{display:flex;align-items:center;gap:12px;padding:12px;border:1px solid var(--line);border-radius:11px;margin-bottom:8px}
        .sf .nrow .nn{font-family:var(--mono);font-size:12px;font-weight:600;width:74px}
        .sf .nrow .nallocs{font-size:12px;color:var(--ink2);flex:1}
        .sf .nrow .nbar{width:88px;height:6px;border-radius:3px;background:var(--paper2);overflow:hidden}
        .sf .nrow .nbar i{display:block;height:100%;background:linear-gradient(90deg,var(--forge),var(--ember));border-radius:3px}
        .sf .nrow .nok{width:8px;height:8px;border-radius:50%;background:var(--ok);box-shadow:0 0 0 3px var(--ok-soft)}
        .sf .clbody{padding:16px}
      `}} />

      {/* Hero */}
      <section className="hero wrap">
        <span className="eyebrow" data-reveal="1">The platform</span>
        <h1 data-reveal="1">The infrastructure behind <span className="fg">zero-config</span> hosting</h1>
        <p className="sub" data-reveal="1">Under one command sits a real platform: AI detection, staged reproducible builds, per-app container isolation, Nomad-orchestrated nodes, Ceph-backed storage, and edge routing with automatic TLS. You never touch any of it.</p>
        <div className="cta-row" data-reveal="1">
          <a className="btn-forge lg" href="/signup">Start building <ArrowRight size={16} strokeWidth={2.4} /></a>
          <a className="btn-out" href="/docs"><Terminal size={16} /> Read the docs</a>
        </div>
      </section>

      {/* Pipeline */}
      <section className="blk wrap" id="pipeline">
        <div className="shead center"><span className="eyebrow" data-reveal="1">The deploy path</span><h2 data-reveal="1">Source to edge, in one motion</h2><p data-reveal="1">Every deploy walks the same five stages — detected, built, containerized, secured, and shipped — with logs streaming the whole way.</p></div>
        <div className="pipe" data-reveal="1" id="pipe">
          <div className="line" />
          <div className="track">
            {[
              { t: "Source", s: "repo · zip · CLI", d: "M4 4h7l2 2h7v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" },
              { t: "Detect", s: "framework found", d: "m12 3 1.9 4.6L18.5 9l-4.6 1.9L12 15l-1.9-4.1L5.5 9l4.6-1.4z" },
              { t: "Build", s: "staged · cached", d: "m7 8-4 4 4 4M17 8l4 4-4 4M14 4l-4 16" },
              { t: "Containerize", s: "isolated netns", d: "M21 8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" },
              { t: "Live · TLS", s: "on the edge", d: "M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18" },
            ].map((p) => (
              <div className="pstage" key={p.t}>
                <div className="pnode">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    {p.t === "Live · TLS" ? (<><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d={p.d} /></>) : <path d={p.d} />}
                  </svg>
                  <span className="tick"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg></span>
                </div>
                <div className="pt">{p.t}</div><div className="ps">{p.s}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="blk wrap" id="capabilities">
        <div className="shead"><span className="eyebrow" data-reveal="1">What powers it</span><h2 data-reveal="1">Six systems, one platform</h2><p data-reveal="1">Each piece is production infrastructure — orchestrated together so a single command does the work of a whole platform team.</p></div>
        <div className="grid3">
          {CAPS.map(({ I, t, p }) => (
            <div className="fcard" data-reveal="1" key={t}>
              <span className="ic"><I size={20} /></span>
              <h4>{t}</h4>
              <p>{p}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Edge network */}
      <section className="blk wrap" id="edge">
        <div className="shead"><span className="eyebrow" data-reveal="1">Global edge</span><h2 data-reveal="1">Every request meets the nearest node</h2><p data-reveal="1">Apps and assets are served from the region closest to each visitor, with automatic TLS and health-checked failover between regions.</p></div>
        <div className="edge">
          <div className="map" data-reveal="1">
            <div className="dots" />
            <svg viewBox="0 0 600 380" preserveAspectRatio="none">
              <path className="arcbg" d="M120,150 Q300,20 470,120" /><path className="arcbg" d="M120,150 Q250,300 330,300" /><path className="arcbg" d="M470,120 Q520,240 330,300" />
              <path className="arc" d="M120,150 Q300,20 470,120" />
              <path className="arc a2" d="M120,150 Q250,300 330,300" />
              <path className="arc a3" d="M470,120 Q520,240 330,300" />
            </svg>
            <div className="cnode user" style={{ left: "20%", top: "39%" }}><span className="dot" /><span className="lbl">you</span></div>
            <div className="cnode" style={{ left: "78%", top: "31%" }}><span className="dot" /><span className="lbl">fra1</span></div>
            <div className="cnode" style={{ left: "55%", top: "79%" }}><span className="dot" /><span className="lbl">sin1</span></div>
            <div className="cnode" style={{ left: "36%", top: "22%" }}><span className="dot" /><span className="lbl">iad1</span></div>
          </div>
          <div className="reglist" data-reveal="1">
            <div className="rl-h">Live regions</div>
            <div className="rl-s">p95 latency · updated 3s ago</div>
            {[["iad1", "Washington", "32%", "21ms"], ["sfo1", "San Francisco", "44%", "29ms"], ["fra1", "Frankfurt", "58%", "38ms"], ["sin1", "Singapore", "72%", "47ms"]].map(([c, n, w, ms]) => (
              <div className="rrow" key={c}><span className="rd" /><span className="rc">{c}</span><span className="rn">{n}</span><span className="rl-bar"><i style={{ width: w }} /></span><span className="rms">{ms}</span></div>
            ))}
          </div>
        </div>
      </section>

      {/* Orchestrated split */}
      <section className="blk wrap" id="orchestration">
        <div className="split">
          <div>
            <span className="eyebrow" data-reveal="1">Orchestration</span>
            <h3 data-reveal="1">Orchestrated, not babysat</h3>
            <p data-reveal="1">A Nomad + Consul cluster places every app, watches its health, and reschedules it the instant a node or allocation fails — no pager, no manual intervention.</p>
            <div className="checks">
              {[["Self-healing allocations", "failed apps are rescheduled automatically"], ["Zero-downtime rollouts", "new versions roll in, old ones drain out"], ["Bin-packed across nodes", "capacity is used, not stranded"], ["One-click rollback", "any previous build is a revert away"]].map(([b, s]) => (
                <div className="check" data-reveal="1" key={b}><Check size={18} strokeWidth={2.6} /><div><b>{b}</b> <span>— {s}</span></div></div>
              ))}
            </div>
          </div>
          <div className="sp-media" data-reveal="1">
            <div className="panel">
              <div className="win-bar"><span className="tl tlr" /><span className="tl tly" /><span className="tl tlg" /><span className="urlbar"><Server size={12} /> nomad · spinforge-dc1</span></div>
              <div className="clbody">
                {[["node-01", "18 allocs", "62%"], ["node-02", "16 allocs", "54%"], ["node-03", "17 allocs", "58%"]].map(([n, a, w]) => (
                  <div className="nrow" key={n}><span className="nok" /><span className="nn">{n}</span><span className="nallocs">{a} running</span><span className="nbar"><i style={{ width: w }} /></span></div>
                ))}
                <div className="nrow" style={{ borderStyle: "dashed", background: "var(--paper2)" }}><Zap size={15} color="var(--forge)" /><span className="nallocs" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>rescheduling builder-dev → node-02 · 0.4s</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Metrics band */}
      <section className="wrap" style={{ paddingBottom: 40 }}>
        <div className="mband" data-reveal="1">
          <div className="mgrain" />
          <div className="marea"><svg viewBox="0 0 1000 200" preserveAspectRatio="none"><defs><linearGradient id="mgp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f2551d" stopOpacity=".38" /><stop offset="1" stopColor="#f2551d" stopOpacity="0" /></linearGradient></defs><path d="M0,170 C120,150 180,120 280,130 C380,140 440,90 560,96 C680,102 740,60 860,52 C940,46 980,40 1000,36 L1000,200 L0,200 Z" fill="url(#mgp)" /><path d="M0,170 C120,150 180,120 280,130 C380,140 440,90 560,96 C680,102 740,60 860,52 C940,46 980,40 1000,36" fill="none" stroke="#f2551d" strokeWidth="2" opacity=".7" /></svg></div>
          <div className="mgrid">
            <div className="mstat"><div className="k" data-count="4" data-suffix="+">4<span className="u">+</span></div><div className="v">Edge regions, health-checked</div></div>
            <div className="mstat"><div className="k" data-count="99.9" data-suffix="%">99.9<span className="u">%</span></div><div className="v">Platform uptime</div></div>
            <div className="mstat"><div className="k">1<span className="u">netns</span></div><div className="v">Isolated per app</div></div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="wrap" style={{ paddingBottom: 110 }}>
        <div className="cta" data-reveal="1">
          <div className="cgrain" />
          <h2>Put the platform to work</h2>
          <p>You bring the code. SpinForge brings detection, builds, isolation, and the edge.</p>
          <div className="cta-row"><a className="btn-white" href="/signup">Get started free <ArrowRight size={16} strokeWidth={2.4} /></a><a className="btn-clear" href="/product">See the product</a></div>
        </div>
      </section>
    </SiteShell>
  );
}

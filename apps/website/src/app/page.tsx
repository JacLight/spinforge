/**
 * SpinForge — home. Uses the shared marketing shell (nav/footer/atmosphere/
 * interactions) so it matches every other page.
 * Copyright (c) 2025 Jacob Ajiboye — MIT.
 */
import { ArrowRight, BarChart3, Check, Eye, Globe, KeyRound, LayoutGrid, Lock, Plus, RotateCcw, Terminal, Users, Zap } from "lucide-react";
import { SiteShell, Rocket } from "@/components/site/Site";

export default function HomePage() {
  return (
    <SiteShell active="home">
      {/* Hero */}
      <section className="hero wrap">
        <span className="tagpill" data-reveal="1"><span className="new">New</span> AI writes your deploy pipeline · <b>zero config</b></span>
        <h1 data-reveal="1">Deploy anything.<br />Configure <span className="fg">nothing.</span></h1>
        <p className="sub" data-reveal="1">SpinForge is the first AI-native host. It reads your project, writes the pipeline, builds it, and serves it on isolated containers at the edge — from a repo, a command, or a zip.</p>

        <div className="cmd" data-reveal="1">
          <div className="seg" id="seg">
            <span className="glider" id="glider" />
            <button className="on" data-cmd="spinforge deploy ./my-app">Git</button>
            <button data-cmd="spinforge deploy app.zip">Zip</button>
            <button data-cmd="spinforge up --watch">CLI</button>
          </div>
          <div className="cmdbar"><span className="pr">$</span><span className="tx" id="typer" /><span className="run">↵ deploy</span></div>
        </div>

        <div className="cta-row" data-reveal="1">
          <a className="btn-forge lg" href="/signup">Deploy your first app <ArrowRight size={16} strokeWidth={2.4} /></a>
          <a className="btn-out" href="/docs"><Terminal size={16} /> Read the docs</a>
        </div>

        <div className="stage" id="stage" data-reveal="1">
          <div className="panel-wrap" id="pw">
            <div className="panel">
              <div className="win-bar">
                <span className="tl tlr" /><span className="tl tly" /><span className="tl tlg" />
                <span className="urlbar"><Lock size={12} /> app.spinforge.dev/deployments</span>
              </div>
              <div className="app">
                <aside className="side">
                  <div className="sbrand"><span className="mk"><Rocket /></span><b>SpinForge</b></div>
                  <div className="slabel">Workspace</div>
                  <div className="sitem"><LayoutGrid size={15} /> Apps</div>
                  <div className="sitem active"><Zap size={15} /> Deployments</div>
                  <div className="sitem"><Globe size={15} /> Domains</div>
                  <div className="suser"><span className="av" /><div><div className="un">Fundu Labs</div><div className="ue">Pro plan</div></div></div>
                </aside>
                <div className="mn">
                  <div className="mtop"><div><h4>Deployments</h4><div className="sub2">6 apps · 4 regions</div></div><span className="newbtn"><Plus size={13} /> New</span></div>
                  <div className="row"><div className="rname"><span className="rdot live" /><div><div className="nm">appengine</div><div className="dm">appengine.spinforge.app</div></div></div><span className="chip2">Next.js</span><span className="pill live">Live</span><span className="reg">iad1</span><svg className="spark" viewBox="0 0 66 22"><polyline points="0,16 9,14 18,15 28,9 37,11 46,6 56,8 66,4" fill="none" stroke="#26935f" strokeWidth="1.6" /></svg><span className="tm">2m</span></div>
                  <div className="row"><div className="rname"><span className="rdot build" /><div><div className="nm">builder-dev</div><div className="dm">builder-dev.spinforge.app</div></div></div><span className="chip2">Vite</span><span className="pill build">Building</span><span className="reg">sfo1</span><svg className="spark" viewBox="0 0 66 22"><polyline points="0,12 9,13 18,10 28,12 37,8 46,10 56,7 66,9" fill="none" stroke="#c99a2b" strokeWidth="1.6" /></svg><span className="tm">now</span></div>
                  <div className="buildrow"><span className="ar">▸</span> build stage 2/3 · bundling<div className="prog"><i /></div></div>
                  <div className="row"><div className="rname"><span className="rdot live" /><div><div className="nm">businessmade</div><div className="dm">businessmade.io</div></div></div><span className="chip2">Docker</span><span className="pill live">Live</span><span className="reg">fra1</span><svg className="spark" viewBox="0 0 66 22"><polyline points="0,10 9,12 18,8 28,9 37,7 46,9 56,5 66,6" fill="none" stroke="#26935f" strokeWidth="1.6" /></svg><span className="tm">1h</span></div>
                </div>
              </div>
            </div>
            <div className="float f-deploy" data-depth="26"><span className="ck"><Check size={14} strokeWidth={3} /></span><div><div className="t1">Deployed</div><div className="t2">appengine · 9.2s</div></div></div>
            <div className="float f-lat" data-depth="18"><div className="lh">p95 latency <b>38ms</b></div><svg viewBox="0 0 160 40" preserveAspectRatio="none" style={{ width: "100%", height: 40 }}><polyline points="0,30 20,26 40,28 60,18 80,22 100,12 120,16 140,8 160,11" fill="none" stroke="var(--forge)" strokeWidth="2" /></svg></div>
          </div>
        </div>
      </section>

      {/* Pipeline */}
      <section className="blk wrap" id="pipeline">
        <div className="shead center"><span className="eyebrow" data-reveal="1">The deploy, visualized</span><h2 data-reveal="1">One command runs the whole pipeline</h2><p data-reveal="1">You type <code className="mono" style={{ color: "var(--forge2)" }}>deploy</code>. SpinForge detects, builds, containerizes, secures, and ships — while you watch each stage go green.</p></div>
        <div className="pipe" data-reveal="1" id="pipe">
          <div className="line" />
          <div className="track">
            {[
              { t: "Source", s: "repo · zip · CLI", d: "M4 4h7l2 2h7v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" },
              { t: "Detect", s: "Next.js found", d: "m12 3 1.9 4.6L18.5 9l-4.6 1.9L12 15l-1.9-4.1L5.5 9l4.6-1.4z" },
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

      {/* Edge network */}
      <section className="blk wrap" id="edge">
        <div className="shead"><span className="eyebrow" data-reveal="1">Global edge</span><h2 data-reveal="1">Every request meets the nearest node</h2><p data-reveal="1">Apps and assets are served from the region closest to each visitor, with automatic TLS and health-checked failover.</p></div>
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

      {/* Kill the config */}
      <section className="blk wrap" id="config">
        <div className="shead center"><span className="eyebrow" data-reveal="1">Kill the config</span><h2 data-reveal="1">Delete the YAML. Keep the app.</h2><p data-reveal="1">The old way meant a Dockerfile, a CI pipeline, and an ingress you hand-tuned. SpinForge writes all of it, from one command.</p></div>
        <div className="versus">
          <div className="vcard v-old" data-reveal="1">
            <div className="vh"><span>the old way</span><span className="tag"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M18 6 6 18M6 6l12 12" /></svg>74 lines of config</span></div>
            <div className="codeblk"><div className="fade" />
              <span className="k">FROM</span> node:20-alpine <span className="k">AS</span> build<br />
              <span className="k">WORKDIR</span> /app<br />
              <span className="k">COPY</span> package*.json ./<br />
              <span className="k">RUN</span> npm ci<br />
              <span className="k">COPY</span> . .<br />
              <span className="k">RUN</span> npm run build<br />
              <span className="k">FROM</span> nginx:alpine<br />
              <span className="k">COPY</span> --from=build /app/dist ...<br />
              <span className="s"># .github/workflows/deploy.yml</span><br />
              <span className="k">on:</span> [push]<br />
              <span className="k">jobs:</span> build-and-push-and-...<br />
            </div>
          </div>
          <div className="vcard v-new" data-reveal="1">
            <div className="vh"><span>with spinforge</span><span className="tag"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>0 lines of config</span></div>
            <div className="body">
              <div className="cmdline"><span className="pr">$</span> spinforge deploy</div>
              <div className="genline">↳ generated automatically:</div>
              <div className="autochips">
                {["Dockerfile", "build pipeline", "container spec", "ingress + TLS", "health checks"].map((a) => (
                  <span className="ac" key={a}><span className="g">✓</span> {a}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="blk wrap" id="features">
        <div className="shead center"><span className="eyebrow" data-reveal="1">Everything included</span><h2 data-reveal="1">Everything you'd expect, nothing to wire up</h2><p data-reveal="1">The whole workflow after you push — no add-ons, no glue code.</p></div>
        <div className="grid3" style={{ marginTop: 48 }}>
          {[
            { i: <Zap size={20} />, t: "One-command deploy", d: "Push, drop a zip, or run the CLI — a live URL comes back in seconds." },
            { i: <RotateCcw size={20} />, t: "Instant rollbacks", d: "Promote any previous build the moment something looks wrong." },
            { i: <Eye size={20} />, t: "Preview URLs", d: "Every build gets its own shareable, TLS-secured preview link." },
            { i: <KeyRound size={20} />, t: "Env & secrets", d: "Encrypted variables per app and environment, injected at runtime." },
            { i: <Users size={20} />, t: "Team roles", d: "Invite your team with scoped access to apps and deployments." },
            { i: <BarChart3 size={20} />, t: "Usage metrics", d: "Requests, latency, and build minutes — visible per app." },
          ].map((f) => (
            <div className="fcard" data-reveal="1" key={f.t}>
              <span className="ic">{f.i}</span>
              <h4>{f.t}</h4>
              <p>{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Metrics band */}
      <section className="wrap" style={{ paddingBottom: 40 }}>
        <div className="mband" data-reveal="1">
          <div className="mgrain" />
          <div className="marea"><svg viewBox="0 0 1000 200" preserveAspectRatio="none"><defs><linearGradient id="mg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f2551d" stopOpacity=".38" /><stop offset="1" stopColor="#f2551d" stopOpacity="0" /></linearGradient></defs><path d="M0,170 C120,150 180,120 280,130 C380,140 440,90 560,96 C680,102 740,60 860,52 C940,46 980,40 1000,36 L1000,200 L0,200 Z" fill="url(#mg)" /><path d="M0,170 C120,150 180,120 280,130 C380,140 440,90 560,96 C680,102 740,60 860,52 C940,46 980,40 1000,36" fill="none" stroke="#f2551d" strokeWidth="2" opacity=".7" /></svg></div>
          <div className="mgrid">
            <div className="mstat"><div className="k" data-count="10" data-suffix="s" data-prefix="<">&lt;10<span className="u">s</span></div><div className="v">Median deploy time</div></div>
            <div className="mstat"><div className="k" data-count="99.9" data-suffix="%">99.9<span className="u">%</span></div><div className="v">Platform uptime</div></div>
            <div className="mstat"><div className="k">1<span className="u">cmd</span></div><div className="v">Folder to live URL</div></div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="wrap" style={{ paddingBottom: 110 }}>
        <div className="cta" data-reveal="1">
          <div className="cgrain" />
          <h2>Ship your first app in minutes</h2>
          <p>Bring Git or a zip. SpinForge configures, builds, and serves the rest.</p>
          <div className="cta-row"><a className="btn-white" href="/signup">Get started free <ArrowRight size={16} strokeWidth={2.4} /></a><a className="btn-clear" href="/contact">Book a demo</a></div>
        </div>
      </section>
    </SiteShell>
  );
}

/**
 * SpinForge — Product. A guided tour of the console: deployments, pipelines
 * (git & zip), domains + TLS, logs and rollbacks. Uses the shared marketing
 * shell so it matches every other page.
 * Copyright (c) 2025 Jacob Ajiboye — MIT.
 */
import {
  ArrowRight,
  Check,
  Globe,
  LayoutGrid,
  Lock,
  Plus,
  RotateCcw,
  Terminal,
  Zap,
} from "lucide-react";
import { SiteShell, Rocket } from "@/components/site/Site";

const PAGE_CSS = `
.sf .pmock{border:1px solid var(--line2);border-radius:16px;background:#fff;overflow:hidden;box-shadow:0 30px 70px -50px rgba(23,18,14,.4)}
.sf .pmock .pbar{display:flex;align-items:center;gap:8px;padding:11px 14px;border-bottom:1px solid var(--line);background:var(--paper2)}
.sf .pmock .pbar .lbl{margin-left:6px;font-family:var(--mono);font-size:11px;color:var(--ink3)}
.sf .pdark{background:#1b1611;border-color:#2a231c}
.sf .pdark .pbar{background:#211c18;border-bottom-color:#2c251f}
.sf .pdark .pbar .lbl{color:#9a8f83}
.sf .plog{padding:16px 18px;font-family:var(--mono);font-size:12px;line-height:1.95}
.sf .plog .mut{color:#8a8078}.sf .plog .ok{color:#5fd39a}.sf .plog .fg{color:#ff7a4d}.sf .plog .wt{color:#e8e2da}.sf .plog .cy{color:#54cfe0}
.sf .stagebars{display:flex;gap:6px;padding:0 18px 18px}
.sf .stagebars .stg{flex:1;height:5px;border-radius:3px;background:#332c26}
.sf .stagebars .stg.done{background:#5fd39a}.sf .stagebars .stg.run{background:var(--forge)}
.sf .domlist{padding:8px}
.sf .domrow{display:flex;align-items:center;gap:12px;padding:13px 12px;border-radius:10px}
.sf .domrow+.domrow{border-top:1px solid var(--line)}
.sf .domrow .dg{width:30px;height:30px;border-radius:9px;background:var(--forge-soft);display:grid;place-items:center;flex:none}
.sf .domrow .dg svg{width:15px;height:15px;color:var(--forge)}
.sf .domrow .dn{font-family:var(--mono);font-size:13px;font-weight:600;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sf .dchip{font-size:10.5px;font-weight:600;padding:3px 8px;border-radius:20px;border:1px solid var(--line2);color:var(--ink2);background:var(--paper2);white-space:nowrap}
.sf .dchip.pri{border-color:var(--forge);color:var(--forge2);background:var(--forge-soft)}
.sf .dchip.tls{border-color:#bfe4cd;color:var(--ok);background:var(--ok-soft);display:inline-flex;align-items:center;gap:5px}
.sf .dchip.tls svg{width:12px;height:12px}
.sf .rollbar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-top:1px solid #2c251f}
.sf .rollbar .rb-t{font-family:var(--mono);font-size:11.5px;color:#9a8f83}
.sf .rollbtn{display:inline-flex;align-items:center;gap:7px;border:1px solid #3a322b;color:#f3ede4;font-weight:600;font-size:12.5px;padding:9px 14px;border-radius:10px;background:transparent}
.sf .rollbtn svg{width:14px;height:14px;color:var(--ember)}
@media(max-width:720px){.sf .dchip.pri{display:none}}
`;

export default function ProductPage() {
  return (
    <SiteShell active="product">
      {/* Hero */}
      <section className="hero wrap">
        <span className="eyebrow" data-reveal="1">The product</span>
        <h1 data-reveal="1">Your whole deploy, <span className="fg">in one place</span></h1>
        <p className="sub" data-reveal="1">One console for everything after you push: live deployments, streaming build logs, git &amp; zip pipelines, domains with automatic TLS, searchable logs, and one-click rollbacks. No dashboards to stitch together.</p>
        <div className="cta-row" data-reveal="1">
          <a className="btn-forge lg" href="/signup">Open the console <ArrowRight size={16} strokeWidth={2.4} /></a>
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

      {/* Split 1 — Pipelines (git & zip) */}
      <section className="blk wrap">
        <div className="split">
          <div data-reveal="1">
            <span className="eyebrow">Pipelines</span>
            <h3>Git or zip — the same reproducible build</h3>
            <p>Connect a repo or upload an archive; SpinForge runs the identical staged pipeline either way, with logs streaming live and every artifact named and versioned.</p>
            <div className="checks">
              <div className="check"><Check size={18} strokeWidth={2.6} /><div><b>Auto-detected stages</b> <span>— install, build, containerize, deploy.</span></div></div>
              <div className="check"><Check size={18} strokeWidth={2.6} /><div><b>Cached layers</b> <span>— rebuilds finish in seconds.</span></div></div>
              <div className="check"><Check size={18} strokeWidth={2.6} /><div><b>Zip uploads</b> <span>— drag an archive, trigger a build, done.</span></div></div>
            </div>
          </div>
          <div className="sp-media" data-reveal="1">
            <div className="pmock pdark">
              <div className="pbar"><span className="tl tlr" /><span className="tl tly" /><span className="tl tlg" /><span className="lbl">build · builder-dev</span></div>
              <div className="plog">
                <div><span className="mut">$</span> <span className="wt">spinforge deploy app.zip</span></div>
                <div className="mut">→ extracted archive · detected <span className="cy">Vite + React</span></div>
                <div className="ok">✓ install <span className="mut">(3.1s)</span></div>
                <div className="ok">✓ build <span className="mut">(6.0s)</span> → dist/ 2.4 MB</div>
                <div className="fg">▸ containerize · issuing TLS…</div>
              </div>
              <div className="stagebars"><span className="stg done" /><span className="stg done" /><span className="stg run" /></div>
            </div>
          </div>
        </div>
      </section>

      {/* Split 2 — Domains & TLS */}
      <section className="blk wrap" style={{ paddingTop: 0 }}>
        <div className="split rev">
          <div data-reveal="1">
            <span className="eyebrow">Domains &amp; TLS</span>
            <h3>Point a domain. Get a certificate.</h3>
            <p>Attach any domain and SpinForge provisions and renews TLS automatically, routes it to the nearest edge, and grades A+ out of the box — no cert files, no cron jobs.</p>
            <div className="checks">
              <div className="check"><Check size={18} strokeWidth={2.6} /><div><b>Automatic certificates</b> <span>— issued and renewed for you.</span></div></div>
              <div className="check"><Check size={18} strokeWidth={2.6} /><div><b>Apex &amp; wildcard</b> <span>— primary and preview domains.</span></div></div>
              <div className="check"><Check size={18} strokeWidth={2.6} /><div><b>Edge routing</b> <span>— every domain served from the nearest region.</span></div></div>
            </div>
          </div>
          <div className="sp-media" data-reveal="1">
            <div className="pmock">
              <div className="pbar"><span className="tl tlr" /><span className="tl tly" /><span className="tl tlg" /><span className="lbl">domains</span></div>
              <div className="domlist">
                <div className="domrow"><span className="dg"><Globe size={15} /></span><span className="dn">appmint.io</span><span className="dchip pri">primary</span><span className="dchip tls"><Lock size={12} />TLS · A+</span></div>
                <div className="domrow"><span className="dg"><Globe size={15} /></span><span className="dn">www.appmint.io</span><span className="dchip tls"><Lock size={12} />TLS · A+</span></div>
                <div className="domrow"><span className="dg"><Globe size={15} /></span><span className="dn">builder-dev.appmint.app</span><span className="dchip tls"><Lock size={12} />TLS · A+</span></div>
                <div className="domrow"><span className="dg"><Globe size={15} /></span><span className="dn">preview-142.spinforge.app</span><span className="dchip">preview</span><span className="dchip tls"><Lock size={12} />TLS</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Split 3 — Logs & rollback */}
      <section className="blk wrap" style={{ paddingTop: 0 }}>
        <div className="split">
          <div data-reveal="1">
            <span className="eyebrow">Logs &amp; rollback</span>
            <h3>Search the logs. Undo in one click.</h3>
            <p>Every deploy streams structured logs you can search and follow live. Something off? Roll back to any previous build instantly — the last-good version is always one click away.</p>
            <div className="checks">
              <div className="check"><Check size={18} strokeWidth={2.6} /><div><b>Live + historical</b> <span>— follow a deploy or scroll back.</span></div></div>
              <div className="check"><Check size={18} strokeWidth={2.6} /><div><b>Instant rollback</b> <span>— promote a previous build in seconds.</span></div></div>
              <div className="check"><Check size={18} strokeWidth={2.6} /><div><b>Per-app history</b> <span>— every build kept and diffable.</span></div></div>
            </div>
          </div>
          <div className="sp-media" data-reveal="1">
            <div className="pmock pdark">
              <div className="pbar"><span className="tl tlr" /><span className="tl tly" /><span className="tl tlg" /><span className="lbl">logs · appengine</span></div>
              <div className="plog">
                <div className="mut">12:04:07 <span className="wt">GET /health 200</span> 6ms</div>
                <div className="mut">12:04:07 <span className="wt">GET / 200</span> 11ms</div>
                <div className="mut">12:04:08 <span className="cy">info</span> cache warmed · 1.2k keys</div>
                <div className="mut">12:04:09 <span className="wt">POST /api/deploy 201</span> 34ms</div>
                <div className="ok">12:04:09 ✓ build #142 promoted</div>
              </div>
              <div className="rollbar"><span className="rb-t">current: build #142 · 2m ago</span><button className="rollbtn"><RotateCcw size={14} /> Rollback to #141</button></div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="wrap" style={{ paddingBottom: 110 }}>
        <div className="cta" data-reveal="1">
          <div className="cgrain" />
          <h2>See it with your own app</h2>
          <p>Connect a repo or upload a zip. The console does the rest.</p>
          <div className="cta-row"><a className="btn-white" href="/signup">Get started free <ArrowRight size={16} strokeWidth={2.4} /></a><a className="btn-clear" href="/pricing">See pricing</a></div>
        </div>
      </section>

      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />
    </SiteShell>
  );
}

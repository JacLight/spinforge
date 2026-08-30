/**
 * SpinForge marketing design system — shared shell used by every marketing
 * page (home, platform, product, pricing, docs) so the site is ONE design,
 * not a page-by-page Frankenstein.
 *
 *   <SiteShell active="platform"> ...page sections... </SiteShell>
 *
 * SiteShell injects the shared stylesheet (scoped under `.sf`), the ambient
 * atmosphere, the nav + footer, and wires every interaction (sticky nav,
 * scroll reveals, the hero command switcher, 3D tilt, the pipeline sequence,
 * count-ups) — all guarded, so a page only renders the markup it needs.
 *
 * Copyright (c) 2025 Jacob Ajiboye — MIT.
 */
"use client";

import { useEffect } from "react";

/* Brand mark (the forge spark). */
export const Rocket = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M13 2 4.5 12.5c-.3.4 0 .9.5.9H10l-1.2 7.8c-.1.6.7 1 1.1.5L20 10.4c.3-.4 0-.9-.5-.9H14l1.2-7.1c.1-.6-.7-1-1.1-.5z" />
  </svg>
);

const NAV = [
  { href: "/platform", label: "Platform", key: "platform" },
  { href: "/product", label: "Product", key: "product" },
  { href: "/docs", label: "Docs", key: "docs" },
  { href: "/pricing", label: "Pricing", key: "pricing" },
];

function SiteNav({ active }: { active?: string }) {
  return (
    <header id="sf-hdr">
      <nav className="wrap">
        <a className="brand" href="/"><span className="mark"><Rocket /></span><span className="name">SpinForge</span></a>
        <div className="nav-links">
          {NAV.map((n) => (
            <a key={n.key} href={n.href} className={active === n.key ? "on" : ""}>{n.label}</a>
          ))}
        </div>
        <div className="nav-cta">
          <span className="kbd">⌘K</span>
          <a className="ghost" href="/login">Sign in</a>
          <a className="btn-forge" href="/signup">Start free</a>
        </div>
      </nav>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer>
      <div className="wrap foot">
        <div className="about">
          <a className="brand" href="/"><span className="mark sm"><Rocket /></span><span className="name">SpinForge</span></a>
          <p>The first AI-native hosting platform with zero configuration.</p>
        </div>
        <div className="cols">
          <div><div className="colt">Product</div><a href="/platform">Platform</a><a href="/product">Product</a><a href="/pricing">Pricing</a></div>
          <div><div className="colt">Resources</div><a href="/docs">Docs</a><a href="/blog">Blog</a><a href="/changelog">Changelog</a></div>
          <div><div className="colt">Legal</div><a href="/privacy">Privacy</a><a href="/terms">Terms</a></div>
        </div>
      </div>
      <div className="wrap foot-bot"><span>© {new Date().getFullYear()} SpinForge</span><span>Forged to ship.</span></div>
    </footer>
  );
}

export function SiteShell({ active, children }: { active?: string; children: React.ReactNode }) {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".sf");
    if (!root) return;
    const cleanups: Array<() => void> = [];
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // sticky nav
    const hdr = root.querySelector("#sf-hdr");
    const onScroll = () => hdr?.classList.toggle("stuck", window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    cleanups.push(() => window.removeEventListener("scroll", onScroll));

    // reveals
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }),
      { threshold: 0.12 }
    );
    root.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));
    cleanups.push(() => io.disconnect());

    // hero command switcher + typing
    const seg = root.querySelector<HTMLElement>("#seg");
    const glider = root.querySelector<HTMLElement>("#glider");
    const typer = root.querySelector<HTMLElement>("#typer");
    if (seg && typer) {
      const btns = Array.from(seg.querySelectorAll("button"));
      let tt: ReturnType<typeof setTimeout>;
      const mg = (b: HTMLElement) => { if (glider) { glider.style.width = b.offsetWidth + "px"; glider.style.transform = "translateX(" + (b.offsetLeft - 4) + "px)"; } };
      const type = (txt: string) => { clearTimeout(tt); let i = 0; const s = () => { typer.innerHTML = txt.slice(0, i) + '<span class="cur"></span>'; if (i++ <= txt.length) tt = setTimeout(s, 34); }; s(); };
      const hs: Array<() => void> = [];
      btns.forEach((b) => { const h = () => { btns.forEach((x) => x.classList.remove("on")); b.classList.add("on"); mg(b); type(b.dataset.cmd || ""); }; hs.push(h); b.addEventListener("click", h); });
      const k = setTimeout(() => { if (btns[0]) { mg(btns[0]); type(btns[0].dataset.cmd || ""); } }, 60);
      cleanups.push(() => { clearTimeout(tt); clearTimeout(k); btns.forEach((b, i) => b.removeEventListener("click", hs[i])); });
    }

    // 3D tilt + parallax floats
    const stage = root.querySelector<HTMLElement>("#stage");
    const pw = root.querySelector<HTMLElement>("#pw");
    if (stage && pw && !reduce) {
      const floats = Array.from(root.querySelectorAll<HTMLElement>(".float"));
      const onMove = (e: PointerEvent) => {
        const r = stage.getBoundingClientRect();
        const dx = (e.clientX - r.left) / r.width - 0.5, dy = (e.clientY - r.top) / r.height - 0.5;
        pw.style.transform = `rotateX(${(-dy * 6).toFixed(2)}deg) rotateY(${(dx * 8).toFixed(2)}deg)`;
        floats.forEach((f) => { const d = Number(f.dataset.depth); f.style.transform = `translate(${(-dx * d).toFixed(1)}px,${(-dy * d).toFixed(1)}px)`; });
      };
      const onLeave = () => { pw.style.transform = ""; floats.forEach((f) => (f.style.transform = "")); };
      stage.addEventListener("pointermove", onMove);
      stage.addEventListener("pointerleave", onLeave);
      cleanups.push(() => { stage.removeEventListener("pointermove", onMove); stage.removeEventListener("pointerleave", onLeave); });
    }

    // pipeline stage sequence
    const pipe = root.querySelector<HTMLElement>("#pipe");
    if (pipe) {
      const stages = Array.from(pipe.querySelectorAll<HTMLElement>(".pstage"));
      let timer: ReturnType<typeof setTimeout>;
      const run = () => { let i = 0; const step = () => { if (i > 0) stages[i - 1].classList.add("done"); if (i < stages.length) { stages.forEach((s) => s.classList.remove("lit")); stages[i].classList.add("lit"); i++; timer = setTimeout(step, 700); } else { timer = setTimeout(() => { stages.forEach((s) => { s.classList.remove("lit"); s.classList.remove("done"); }); i = 0; timer = setTimeout(step, 600); }, 1400); } }; step(); };
      const pio = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { run(); pio.unobserve(e.target); } }), { threshold: 0.4 });
      pio.observe(pipe);
      cleanups.push(() => { pio.disconnect(); clearTimeout(timer); });
    }

    // count ups
    const cio = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target.querySelector<HTMLElement>("[data-count]");
      if (el && !el.dataset.done) {
        el.dataset.done = "1";
        const to = Number(el.dataset.count), suf = el.dataset.suffix || "", pre = el.dataset.prefix || "";
        let s = 0; const t = setInterval(() => { s += to / 28; if (s >= to) { s = to; clearInterval(t); } el.innerHTML = pre + (to % 1 ? s.toFixed(1) : Math.round(s)) + '<span class="u">' + suf + "</span>"; }, 22);
      }
      cio.unobserve(e.target);
    }), { threshold: 0.5 });
    root.querySelectorAll(".mstat,.metric").forEach((m) => cio.observe(m));
    cleanups.push(() => cio.disconnect());

    return () => cleanups.forEach((c) => c());
  }, []);

  return (
    <div className="sf js">
      <style dangerouslySetInnerHTML={{ __html: SITE_CSS }} />
      <div className="atmos"><span className="blob b1" /><span className="blob b2" /></div>
      <div className="grain" />
      <SiteNav active={active} />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}

export const SITE_CSS = `
.sf{
  --paper:#fbfaf8;--paper2:#f5f2ec;--ink:#17120e;--ink2:#5f564d;--ink3:#9c9389;
  --line:#ece7de;--line2:#ded7cb;--glass:rgba(255,255,255,.66);
  --forge:#f2551d;--forge2:#cf3d0c;--forge-soft:#feeee7;--ember:#ffab3d;--coral:#ff8a5b;
  --ok:#26935f;--ok-soft:#e6f3ec;--cy:#1fb6c9;--red:#d64545;
  --disp:var(--font-display),'Bricolage Grotesque',ui-sans-serif,system-ui,sans-serif;
  --sans:var(--font-sans),'Hanken Grotesk',ui-sans-serif,system-ui,sans-serif;
  --mono:var(--font-mono),'IBM Plex Mono',ui-monospace,Menlo,monospace;--max:1160px;
  position:relative;font-family:var(--sans);color:var(--ink);line-height:1.5;
}
.sf ::selection{background:#ffd9c8;color:var(--forge2)}
.sf .wrap{max-width:var(--max);margin:0 auto;padding:0 24px}
.sf h1,.sf h2,.sf h3,.sf h4{font-family:var(--disp);font-weight:800;letter-spacing:-.035em;line-height:1.0}
.sf .mono{font-family:var(--mono)}
.sf .eyebrow{display:inline-flex;align-items:center;gap:9px;font-family:var(--mono);font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:.16em;color:var(--forge2)}
.sf .eyebrow::before{content:"";width:6px;height:6px;background:var(--forge);border-radius:1px;transform:rotate(45deg);box-shadow:0 0 12px var(--forge)}

.sf .atmos{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}
.sf .blob{position:absolute;border-radius:50%;filter:blur(80px);opacity:.5;mix-blend-mode:multiply}
.sf .b1{width:640px;height:640px;left:-8%;top:-18%;background:radial-gradient(circle,#ffd9b0,transparent 68%);animation:sfDrift1 22s ease-in-out infinite}
.sf .b2{width:560px;height:560px;right:-6%;top:-10%;background:radial-gradient(circle,#ffc7bd,transparent 66%);animation:sfDrift2 26s ease-in-out infinite}
.sf .grain{position:fixed;inset:0;z-index:1;pointer-events:none;opacity:.4;mix-blend-mode:multiply;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")}
.sf main,.sf header{position:relative;z-index:2}

.sf header{position:sticky;top:0;z-index:60;border-bottom:1px solid transparent;transition:border-color .3s,background .3s}
.sf header.stuck{border-color:var(--line);background:rgba(251,250,248,.72);backdrop-filter:blur(18px) saturate(1.4)}
.sf nav{display:flex;align-items:center;justify-content:space-between;height:66px}
.sf .brand{display:flex;align-items:center;gap:10px}
.sf .brand .name{font-family:var(--disp);font-weight:800;font-size:18px;letter-spacing:-.04em}
.sf .mark{display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:linear-gradient(150deg,var(--forge),var(--forge2));box-shadow:0 3px 12px -2px rgba(242,85,29,.6),inset 0 1px 0 rgba(255,255,255,.4)}
.sf .mark svg{width:15px;height:15px;color:#fff}.sf .mark.sm{width:28px;height:28px}
.sf .nav-links{display:flex;gap:28px;font-size:14px;color:var(--ink2)}
.sf .nav-links a{transition:color .15s}.sf .nav-links a:hover,.sf .nav-links a.on{color:var(--ink)}
.sf .nav-cta{display:flex;align-items:center;gap:8px}
.sf .kbd{font-family:var(--mono);font-size:11px;color:var(--ink3);border:1px solid var(--line2);border-radius:5px;padding:2px 6px;background:var(--glass)}
.sf .ghost{padding:8px 12px;font-size:14px;font-weight:500;color:var(--ink2)}.sf .ghost:hover{color:var(--ink)}
.sf .btn-forge{display:inline-flex;align-items:center;gap:6px;background:var(--ink);color:#fff;font-weight:600;font-size:14px;padding:9px 16px;border-radius:10px;transition:transform .15s,box-shadow .15s;box-shadow:0 2px 8px -2px rgba(23,18,14,.4)}
.sf .btn-forge:hover{transform:translateY(-1px);box-shadow:0 8px 20px -6px rgba(23,18,14,.5)}
@media(max-width:860px){.sf .nav-links,.sf .ghost,.sf .kbd{display:none}}

.sf .hero{padding-top:64px;padding-bottom:40px;text-align:center}
.sf .hero.left{text-align:left}
.sf .tagpill{display:inline-flex;align-items:center;gap:8px;font-family:var(--mono);font-size:12px;color:var(--ink2);background:var(--glass);border:1px solid var(--line);border-radius:100px;padding:6px 8px 6px 12px;backdrop-filter:blur(8px)}
.sf .tagpill b{color:var(--forge2)}
.sf .tagpill .new{background:var(--forge);color:#fff;font-weight:600;font-size:10px;letter-spacing:.04em;padding:2px 7px;border-radius:100px;text-transform:uppercase}
.sf h1{font-size:clamp(44px,8vw,100px);margin-top:26px;text-wrap:balance;letter-spacing:-.045em}
.sf .hero h1{max-width:16ch;margin-left:auto;margin-right:auto}
.sf .hero.left h1{margin-left:0}
.sf h1 .fg{background:linear-gradient(100deg,var(--forge2),var(--forge) 40%,var(--ember) 75%,var(--forge));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;background-size:220% 100%;animation:sfSheen 6s linear infinite}
.sf .sub{max-width:56ch;margin:26px auto 0;font-size:clamp(17px,1.7vw,20px);color:var(--ink2);line-height:1.6}
.sf .hero.left .sub{margin-left:0}
.sf .cmd{max-width:600px;margin:34px auto 0}
.sf .hero.left .cmd{margin-left:0}
.sf .seg{display:inline-flex;background:var(--paper2);border:1px solid var(--line2);border-radius:12px;padding:4px;gap:2px;position:relative}
.sf .seg button{position:relative;z-index:2;font-family:var(--mono);font-size:12.5px;font-weight:500;color:var(--ink2);background:none;border:0;padding:7px 16px;border-radius:9px;cursor:pointer;transition:color .2s}
.sf .seg button.on{color:var(--ink)}
.sf .seg .glider{position:absolute;z-index:1;top:4px;height:calc(100% - 8px);background:#fff;border-radius:9px;box-shadow:0 2px 6px -2px rgba(23,18,14,.18);transition:transform .28s cubic-bezier(.4,1.2,.4,1),width .28s}
.sf .cmdbar{margin-top:12px;display:flex;align-items:center;gap:12px;background:#1b1611;border:1px solid #2a231c;border-radius:13px;padding:15px 18px;box-shadow:0 20px 44px -24px rgba(23,18,14,.55);text-align:left}
.sf .cmdbar .pr{font-family:var(--mono);color:var(--ember);font-size:14px}
.sf .cmdbar .tx{font-family:var(--mono);color:#f3ede4;font-size:14px;flex:1;white-space:nowrap;overflow:hidden}
.sf .cmdbar .tx .cur{display:inline-block;width:8px;height:16px;background:var(--forge);vertical-align:-3px;margin-left:1px;animation:sfBlink 1s step-end infinite}
.sf .cmdbar .run{font-family:var(--mono);font-size:11px;color:#8f857a;border:1px solid #37302a;border-radius:6px;padding:4px 8px}
.sf .cta-row{display:flex;gap:12px;margin-top:28px;justify-content:center;flex-wrap:wrap}
.sf .hero.left .cta-row{justify-content:flex-start}
.sf .btn-forge.lg{background:linear-gradient(150deg,var(--forge),var(--forge2));padding:14px 24px;border-radius:12px;font-size:15px;box-shadow:0 10px 26px -8px rgba(242,85,29,.6),inset 0 1px 0 rgba(255,255,255,.3)}
.sf .btn-out{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line2);background:var(--glass);color:var(--ink);font-weight:600;font-size:15px;padding:14px 24px;border-radius:12px;backdrop-filter:blur(8px);transition:border-color .15s,transform .15s}
.sf .btn-out:hover{border-color:var(--ink3);transform:translateY(-1px)}.sf .btn-out svg{color:var(--forge)}

.sf .stage{margin:70px auto 0;max-width:1000px;perspective:1800px}
.sf .panel-wrap{position:relative;transform-style:preserve-3d;transition:transform .3s ease-out}
.sf .panel{position:relative;border:1px solid var(--line2);border-radius:16px;background:#fff;overflow:hidden;box-shadow:0 2px 4px rgba(23,18,14,.04),0 50px 90px -50px rgba(23,18,14,.4),0 20px 44px -30px rgba(23,18,14,.3)}
.sf .win-bar{display:flex;align-items:center;gap:8px;padding:12px 15px;border-bottom:1px solid var(--line);background:var(--paper2)}
.sf .tl{width:11px;height:11px;border-radius:50%}
.sf .tlr{background:#ff5f57}.sf .tly{background:#febc2e}.sf .tlg{background:#28c840}
.sf .urlbar{margin:0 auto;display:inline-flex;align-items:center;gap:7px;background:#fff;border:1px solid var(--line);border-radius:8px;padding:5px 16px;font-family:var(--mono);font-size:12px;color:var(--ink2)}
.sf .urlbar svg{width:12px;height:12px;color:var(--ok)}
.sf .app{display:grid;grid-template-columns:200px 1fr;min-height:400px}
.sf .side{border-right:1px solid var(--line);background:var(--paper2);padding:16px 12px;display:flex;flex-direction:column;gap:2px}
.sf .sbrand{display:flex;align-items:center;gap:8px;padding:2px 8px 14px}
.sf .sbrand .mk{width:22px;height:22px;border-radius:7px;background:linear-gradient(150deg,var(--forge),var(--forge2));display:grid;place-items:center}
.sf .sbrand .mk svg{width:11px;height:11px;color:#fff}
.sf .sbrand b{font-family:var(--disp);font-size:14px;letter-spacing:-.03em}
.sf .slabel{font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink3);padding:10px 8px 4px}
.sf .sitem{display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:8px;font-size:13px;color:var(--ink2);font-weight:500}
.sf .sitem svg{width:15px;height:15px;opacity:.75}
.sf .sitem.active{background:#fff;color:var(--forge2);box-shadow:0 1px 3px rgba(23,18,14,.06)}
.sf .sitem.active svg{opacity:1;color:var(--forge)}
.sf .suser{margin-top:auto;display:flex;align-items:center;gap:9px;padding:8px;border-top:1px solid var(--line)}
.sf .suser .av{width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,var(--forge),var(--ember))}
.sf .suser .un{font-size:12px;font-weight:600}.sf .suser .ue{font-size:11px;color:var(--ink3)}
.sf .mn{padding:18px 20px}
.sf .mtop{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.sf .mtop h4{font-size:19px;letter-spacing:-.03em}
.sf .mtop .sub2{font-size:12px;color:var(--ink3);margin-top:2px;font-family:var(--mono)}
.sf .newbtn{display:inline-flex;align-items:center;gap:6px;background:var(--ink);color:#fff;font-size:12.5px;font-weight:600;padding:8px 13px;border-radius:9px}
.sf .newbtn svg{width:13px;height:13px}
.sf .row{display:grid;grid-template-columns:1.7fr .7fr .7fr 66px 46px;align-items:center;gap:12px;padding:13px 12px;border:1px solid var(--line);border-radius:11px;margin-bottom:8px;transition:border-color .2s,transform .2s}
.sf .row:hover{border-color:var(--line2);transform:translateX(2px)}
.sf .rname{display:flex;align-items:center;gap:11px;min-width:0}
.sf .rdot{width:8px;height:8px;border-radius:50%;flex:none}
.sf .rdot.live{background:var(--ok);box-shadow:0 0 0 3px var(--ok-soft)}
.sf .rdot.build{background:var(--ember);box-shadow:0 0 0 3px #fdf1dc;animation:sfPulse 1.4s ease-in-out infinite}
.sf .rname .nm{font-size:13.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sf .rname .dm{font-family:var(--mono);font-size:11px;color:var(--ink3)}
.sf .chip2{justify-self:start;font-size:11px;font-weight:600;padding:3px 9px;border-radius:20px;border:1px solid var(--line2);color:var(--ink2);background:var(--paper2)}
.sf .pill{justify-self:start;font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px}
.sf .pill.live{background:var(--ok-soft);color:var(--ok)}.sf .pill.build{background:#fdf1dc;color:#a9700c}
.sf .reg{font-family:var(--mono);font-size:11px;color:var(--ink2)}
.sf .spark{width:66px;height:22px}.sf .tm{font-family:var(--mono);font-size:11px;color:var(--ink3);text-align:right}
.sf .buildrow{grid-column:1/-1;margin:-3px 0 8px;padding:9px 14px;border:1px dashed var(--line2);border-radius:11px;background:var(--paper2);font-family:var(--mono);font-size:11px;color:var(--ink2);display:flex;align-items:center;gap:10px}
.sf .buildrow .ar{color:var(--forge)}
.sf .prog{flex:1;height:4px;border-radius:3px;background:#e6ded2;overflow:hidden}
.sf .prog i{display:block;height:100%;background:linear-gradient(90deg,var(--forge),var(--ember));border-radius:3px;width:20%;animation:sfFill 3.4s ease-in-out infinite}
.sf .float{position:absolute;background:var(--glass);backdrop-filter:blur(14px) saturate(1.3);border:1px solid var(--line2);border-radius:14px;box-shadow:0 20px 44px -22px rgba(23,18,14,.4);padding:12px 14px;transition:transform .4s ease-out}
.sf .f-deploy{top:-26px;right:-30px;display:flex;align-items:center;gap:10px}
.sf .f-deploy .ck{width:26px;height:26px;border-radius:8px;background:var(--ok-soft);display:grid;place-items:center}
.sf .f-deploy .ck svg{width:14px;height:14px;color:var(--ok)}
.sf .f-deploy .t1{font-size:12px;font-weight:700}.sf .f-deploy .t2{font-size:11px;color:var(--ink3);font-family:var(--mono)}
.sf .f-lat{bottom:-28px;left:-34px;width:190px}
.sf .f-lat .lh{display:flex;justify-content:space-between;font-size:11px;color:var(--ink2);margin-bottom:8px;font-family:var(--mono)}
.sf .f-lat .lh b{color:var(--ink);font-size:14px;font-family:var(--disp);letter-spacing:-.02em}
@media(max-width:720px){.sf .app{grid-template-columns:1fr}.sf .side{display:none}.sf .row{grid-template-columns:1.4fr 46px}.sf .chip2,.sf .spark,.sf .reg,.sf .pill{display:none}.sf .float{display:none}}

.sf .blk{padding:120px 0}
.sf.js [data-reveal]{opacity:0;transform:translateY(24px);transition:opacity .8s cubic-bezier(.22,1,.36,1),transform .8s cubic-bezier(.22,1,.36,1)}
.sf.js [data-reveal].in{opacity:1;transform:none}
.sf .shead{max-width:640px}
.sf .shead.center{text-align:center;margin-left:auto;margin-right:auto}
.sf .shead h2{font-size:clamp(32px,4.6vw,56px);text-wrap:balance;margin-top:16px}
.sf .shead p{margin-top:16px;color:var(--ink2);font-size:17px;line-height:1.6;max-width:52ch}
.sf .shead.center p{margin-left:auto;margin-right:auto}

.sf .pipe{position:relative;margin-top:56px;border:1px solid var(--line);border-radius:20px;background:linear-gradient(180deg,#fff,#fffdfa);box-shadow:0 30px 70px -50px rgba(23,18,14,.4);padding:44px 32px 36px;overflow:hidden}
.sf .pipe .track{position:relative;display:grid;grid-template-columns:repeat(5,1fr);align-items:start}
.sf .pipe .line{position:absolute;left:9%;right:9%;top:29px;height:2px;background:var(--line2);border-radius:2px;overflow:hidden}
.sf .pipe .line::after{content:"";position:absolute;top:0;left:0;height:100%;width:40px;border-radius:2px;background:linear-gradient(90deg,transparent,var(--forge),transparent);animation:sfTravel 3.4s linear infinite}
.sf .pstage{position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;padding:0 8px}
.sf .pnode{width:58px;height:58px;border-radius:16px;background:#fff;border:1px solid var(--line2);display:grid;place-items:center;box-shadow:0 6px 18px -10px rgba(23,18,14,.3);position:relative;transition:border-color .4s,box-shadow .4s,transform .4s}
.sf .pnode svg{width:24px;height:24px;color:var(--ink2);transition:color .4s}
.sf .pstage.lit .pnode{border-color:var(--forge);box-shadow:0 10px 26px -10px rgba(242,85,29,.5);transform:translateY(-3px)}
.sf .pstage.lit .pnode svg{color:var(--forge)}
.sf .pnode .tick{position:absolute;right:-5px;bottom:-5px;width:20px;height:20px;border-radius:50%;background:var(--ok);display:grid;place-items:center;opacity:0;transform:scale(.4);transition:opacity .3s,transform .3s}
.sf .pnode .tick svg{width:11px;height:11px;color:#fff}
.sf .pstage.done .pnode .tick{opacity:1;transform:scale(1)}
.sf .pstage .pt{font-family:var(--disp);font-size:15px;font-weight:700;margin-top:16px}
.sf .pstage .ps{font-family:var(--mono);font-size:11px;color:var(--ink3);margin-top:4px;min-height:14px}
.sf .pstage.lit .ps{color:var(--forge2)}
@media(max-width:820px){.sf .pipe .track{grid-template-columns:1fr;gap:22px;text-align:left}.sf .pstage{flex-direction:row;gap:16px;align-items:center;text-align:left}.sf .pipe .line{display:none}.sf .pstage .pt{margin-top:0}.sf .pstage .ps{margin-top:2px}}

.sf .edge{margin-top:56px;display:grid;grid-template-columns:1.5fr 1fr;gap:24px;align-items:stretch}
.sf .map{position:relative;border:1px solid var(--line);border-radius:20px;background:radial-gradient(120% 120% at 30% 10%,#fffaf4,#fff 60%);overflow:hidden;min-height:380px;box-shadow:0 30px 70px -50px rgba(23,18,14,.4)}
.sf .map .dots{position:absolute;inset:0;background-image:radial-gradient(circle,rgba(23,18,14,.09) 1px,transparent 1.4px);background-size:20px 20px;-webkit-mask-image:radial-gradient(ellipse 75% 70% at 50% 45%,#000,transparent 78%);mask-image:radial-gradient(ellipse 75% 70% at 50% 45%,#000,transparent 78%)}
.sf .map svg{position:absolute;inset:0;width:100%;height:100%}
.sf .arc{fill:none;stroke:var(--forge);stroke-width:1.6;stroke-linecap:round;stroke-dasharray:6 220;opacity:.85;animation:sfDash 3s linear infinite}
.sf .arc.a2{animation-delay:1s;stroke:var(--ember)}.sf .arc.a3{animation-delay:2s}
.sf .arcbg{fill:none;stroke:var(--forge);stroke-width:1.2;opacity:.14}
.sf .cnode{position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:6px}
.sf .cnode .dot{position:relative;width:10px;height:10px;border-radius:50%;background:var(--forge);box-shadow:0 0 0 4px rgba(242,85,29,.18)}
.sf .cnode .dot::after{content:"";position:absolute;inset:-4px;border-radius:50%;border:1.5px solid var(--forge);opacity:.5;animation:sfPing 2.2s ease-out infinite}
.sf .cnode .lbl{font-family:var(--mono);font-size:10px;color:var(--ink2);background:var(--glass);border:1px solid var(--line);border-radius:6px;padding:2px 6px;backdrop-filter:blur(4px)}
.sf .cnode.user .dot{background:var(--ink)}.sf .cnode.user .dot::after{border-color:var(--ink)}
.sf .reglist{border:1px solid var(--line);border-radius:20px;background:#fff;padding:22px;display:flex;flex-direction:column}
.sf .reglist .rl-h{font-family:var(--disp);font-size:16px;font-weight:700}
.sf .reglist .rl-s{font-family:var(--mono);font-size:11px;color:var(--ink3);margin-top:4px;margin-bottom:14px}
.sf .rrow{display:flex;align-items:center;gap:12px;padding:11px 0;border-top:1px solid var(--line)}
.sf .rrow .rd{width:7px;height:7px;border-radius:50%;background:var(--ok);box-shadow:0 0 0 3px var(--ok-soft)}
.sf .rrow .rc{font-family:var(--mono);font-size:12px;font-weight:600;width:42px}
.sf .rrow .rn{font-size:13px;color:var(--ink2);flex:1}
.sf .rrow .rl-bar{width:70px;height:5px;border-radius:3px;background:var(--paper2);overflow:hidden}
.sf .rrow .rl-bar i{display:block;height:100%;background:linear-gradient(90deg,var(--forge),var(--ember));border-radius:3px}
.sf .rrow .rms{font-family:var(--mono);font-size:12px;color:var(--ink);width:44px;text-align:right;font-variant-numeric:tabular-nums}
@media(max-width:820px){.sf .edge{grid-template-columns:1fr}}

.sf .versus{margin-top:56px;display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:stretch}
.sf .vcard{border-radius:18px;overflow:hidden;border:1px solid var(--line2);display:flex;flex-direction:column}
.sf .vcard .vh{display:flex;align-items:center;justify-content:space-between;padding:13px 16px;font-family:var(--mono);font-size:12px}
.sf .v-old{background:#fff}
.sf .v-old .vh{border-bottom:1px solid var(--line);color:var(--ink3)}
.sf .v-old .tag{color:var(--red);font-weight:600;display:inline-flex;align-items:center;gap:6px}
.sf .codeblk{padding:16px;font-family:var(--mono);font-size:11.5px;line-height:1.75;color:#9a9089;flex:1;position:relative;overflow:hidden}
.sf .codeblk .k{color:#b06a3a}.sf .codeblk .s{color:#7a9a5a}
.sf .codeblk::after{content:"";position:absolute;left:0;right:0;top:50%;height:2px;background:var(--red);transform:rotate(-4deg);opacity:.55}
.sf .codeblk .fade{position:absolute;inset:0;background:linear-gradient(180deg,transparent 55%,#fff)}
.sf .v-new{background:#1b1611;color:#f3ede4}
.sf .v-new .vh{border-bottom:1px solid #2c251f;color:#9a8f83}
.sf .v-new .tag{color:#5fd39a;font-weight:600;display:inline-flex;align-items:center;gap:6px}
.sf .v-new .body{padding:22px 18px;flex:1;display:flex;flex-direction:column;justify-content:center;gap:16px}
.sf .v-new .cmdline{font-family:var(--mono);font-size:14px}
.sf .v-new .cmdline .pr{color:var(--ember)}
.sf .v-new .autochips{display:flex;flex-wrap:wrap;gap:7px}
.sf .v-new .ac{font-family:var(--mono);font-size:11px;border:1px solid #37302a;border-radius:7px;padding:5px 10px;color:#cfc6bb;display:inline-flex;align-items:center;gap:6px}
.sf .v-new .ac .g{color:#5fd39a}
.sf .v-new .genline{font-family:var(--mono);font-size:11px;color:#8f857a}
@media(max-width:720px){.sf .versus{grid-template-columns:1fr}}

.sf .mband{position:relative;border-radius:24px;overflow:hidden;background:#17120e;padding:56px 40px}
.sf .mband .mgrain{position:absolute;inset:0;opacity:.5;mix-blend-mode:overlay;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
.sf .mband .marea{position:absolute;left:0;right:0;bottom:0;height:60%}
.sf .mband .marea svg{width:100%;height:100%}
.sf .mgrid{position:relative;display:grid;grid-template-columns:repeat(3,1fr);gap:28px}
.sf .mstat{border-left:2px solid rgba(242,85,29,.6);padding-left:18px}
.sf .mstat .k{font-family:var(--disp);font-size:clamp(38px,5vw,60px);letter-spacing:-.045em;color:#fff;font-variant-numeric:tabular-nums;font-weight:800;line-height:1}
.sf .mstat .k .u{color:var(--forge)}
.sf .mstat .v{margin-top:8px;color:#c7bfb6;font-size:14px}
@media(max-width:640px){.sf .mgrid{grid-template-columns:1fr;gap:22px}}

.sf .split{margin-top:56px;display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:center}
.sf .split.rev>.sp-media{order:-1}
.sf .split h3{font-size:clamp(24px,3vw,34px);margin-top:14px}
.sf .split p{margin-top:14px;color:var(--ink2);font-size:16px;line-height:1.65;max-width:44ch}
.sf .checks{margin-top:20px;display:flex;flex-direction:column;gap:11px}
.sf .check{display:flex;gap:11px;align-items:flex-start;font-size:14.5px}
.sf .check svg{width:18px;height:18px;color:var(--forge);flex:none;margin-top:1px}
.sf .check b{font-weight:600}.sf .check span{color:var(--ink2)}
@media(max-width:820px){.sf .split{grid-template-columns:1fr;gap:32px}.sf .split.rev>.sp-media{order:0}}

.sf .grid3{margin-top:48px;display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.sf .fcard{border:1px solid var(--line);background:#fff;border-radius:16px;padding:26px;transition:border-color .2s,box-shadow .2s,transform .2s}
.sf .fcard:hover{border-color:var(--line2);box-shadow:0 20px 44px -28px rgba(23,18,14,.35);transform:translateY(-3px)}
.sf .fcard .ic{display:inline-grid;place-items:center;width:42px;height:42px;border-radius:12px;background:var(--forge-soft);margin-bottom:16px}
.sf .fcard .ic svg{width:20px;height:20px;color:var(--forge)}
.sf .fcard h4{font-size:17px}.sf .fcard p{margin-top:7px;font-size:14px;color:var(--ink2);line-height:1.6}
@media(max-width:820px){.sf .grid3{grid-template-columns:1fr}}

.sf .prices{margin-top:56px;display:grid;grid-template-columns:repeat(4,1fr);gap:16px;align-items:stretch}
.sf .tier{border:1px solid var(--line);background:#fff;border-radius:18px;padding:26px;display:flex;flex-direction:column}
.sf .tier.pop{border-color:var(--forge);box-shadow:0 24px 50px -30px rgba(242,85,29,.4);position:relative}
.sf .tier.pop .poptag{position:absolute;top:-11px;left:26px;background:var(--forge);color:#fff;font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:.1em;padding:3px 9px;border-radius:20px}
.sf .tier .tn{font-family:var(--disp);font-size:18px;font-weight:700}
.sf .tier .tp{margin-top:12px;font-family:var(--disp);font-size:38px;font-weight:800;letter-spacing:-.03em}
.sf .tier .tp .per{font-family:var(--sans);font-size:14px;font-weight:400;color:var(--ink3)}
.sf .tier .td{margin-top:8px;font-size:13px;color:var(--ink2);min-height:38px}
.sf .tier .tbtn{margin-top:18px;display:inline-flex;justify-content:center;padding:11px;border-radius:10px;font-weight:600;font-size:14px;border:1px solid var(--line2);color:var(--ink)}
.sf .tier.pop .tbtn{background:var(--forge);color:#fff;border-color:var(--forge)}
.sf .tier .tf{margin-top:20px;display:flex;flex-direction:column;gap:10px;font-size:13.5px}
.sf .tier .tf div{display:flex;gap:9px;align-items:flex-start;color:var(--ink2)}
.sf .tier .tf svg{width:16px;height:16px;color:var(--ok);flex:none;margin-top:1px}
@media(max-width:900px){.sf .prices{grid-template-columns:1fr 1fr}}
@media(max-width:560px){.sf .prices{grid-template-columns:1fr}}

.sf .cta{position:relative;border-radius:26px;padding:88px 32px;text-align:center;overflow:hidden;background:linear-gradient(160deg,#f2551d,#cf3d0c)}
.sf .cta .cgrain{position:absolute;inset:0;opacity:.35;mix-blend-mode:overlay;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
.sf .cta h2{position:relative;font-size:clamp(34px,5vw,60px);color:#fff;text-wrap:balance;max-width:16ch;margin:0 auto}
.sf .cta p{position:relative;margin:16px auto 0;max-width:38ch;color:rgba(255,255,255,.9);font-size:18px}
.sf .cta .cta-row{position:relative;margin-top:32px}
.sf .btn-white{display:inline-flex;align-items:center;gap:8px;background:#fff;color:var(--forge2);font-weight:600;font-size:15px;padding:14px 26px;border-radius:12px;transition:transform .15s}
.sf .btn-white:hover{transform:translateY(-2px)}
.sf .btn-clear{display:inline-flex;align-items:center;gap:8px;border:1px solid rgba(255,255,255,.4);color:#fff;font-weight:600;font-size:15px;padding:14px 26px;border-radius:12px}
.sf .btn-clear:hover{background:rgba(255,255,255,.12)}

.sf footer{border-top:1px solid var(--line);padding:56px 0 40px;position:relative;z-index:2}
.sf .foot{display:flex;justify-content:space-between;gap:32px;flex-wrap:wrap}
.sf .foot .about{max-width:290px}
.sf .foot .about p{margin-top:16px;font-size:14px;color:var(--ink2);line-height:1.6}
.sf .cols{display:grid;grid-template-columns:repeat(3,auto);gap:14px 60px;font-size:14px}
.sf .cols .colt{font-family:var(--mono);font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:var(--ink3);margin-bottom:12px}
.sf .cols a{display:block;color:var(--ink2);margin-top:10px}.sf .cols a:hover{color:var(--ink)}
.sf .foot-bot{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:44px;padding-top:26px;border-top:1px solid var(--line);font-family:var(--mono);font-size:12px;color:var(--ink3)}

@keyframes sfSheen{to{background-position:220% 0}}
@keyframes sfBlink{50%{opacity:0}}
@keyframes sfPulse{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes sfFill{0%{width:8%}55%{width:74%}100%{width:96%}}
@keyframes sfDrift1{0%,100%{transform:translate(0,0)}50%{transform:translate(40px,30px)}}
@keyframes sfDrift2{0%,100%{transform:translate(0,0)}50%{transform:translate(-36px,26px)}}
@keyframes sfTravel{0%{left:-40px}100%{left:100%}}
@keyframes sfDash{to{stroke-dashoffset:-226}}
@keyframes sfPing{0%{transform:scale(1);opacity:.6}100%{transform:scale(2.6);opacity:0}}
@media(prefers-reduced-motion:reduce){.sf *{animation:none!important;transition:none!important}.sf.js [data-reveal]{opacity:1;transform:none}}
`;

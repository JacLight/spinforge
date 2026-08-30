/**
 * SpinForge — pricing. Uses the shared marketing shell so it matches the
 * rest of the site.
 * Copyright (c) 2025 Jacob Ajiboye — MIT.
 */
import { ArrowRight, Check, GitBranch, Globe, RotateCcw, ShieldCheck } from "lucide-react";
import { SiteShell } from "@/components/site/Site";

const tiers = [
  {
    name: "Starter",
    price: "$0",
    per: "/mo",
    desc: "For side projects and first deploys.",
    cta: "Start free",
    features: ["1 project", "3 deploys / day", "spinforge.app subdomain", "Automatic TLS", "Community support"],
  },
  {
    name: "Core",
    price: "$20",
    per: "/mo",
    desc: "For indie devs shipping real apps.",
    cta: "Start free",
    features: ["5 projects", "Unlimited deploys", "Custom domains", "2 edge regions", "Email support"],
  },
  {
    name: "Pro",
    price: "$60",
    per: "/mo",
    desc: "For teams shipping fast, together.",
    cta: "Start free",
    pop: true,
    features: [
      "Everything in Core",
      "Unlimited projects",
      "All edge regions",
      "Larger CPU / RAM containers",
      "Preview URLs per branch",
      "Team roles & members",
      "Priority support",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    per: "",
    desc: "For scale, security, and compliance.",
    cta: "Contact sales",
    features: ["SSO / SAML", "Dedicated nodes", "Uptime SLA", "Audit logs", "VPC peering", "White-glove onboarding"],
  },
];

const included = [
  { icon: ShieldCheck, title: "Automatic TLS", body: "Certificates issued and renewed on every domain, on every plan." },
  { icon: GitBranch, title: "Git & zip deploys", body: "Point at a repo or upload an archive — the same pipeline either way." },
  { icon: RotateCcw, title: "One-command rollbacks", body: "Every build is versioned. Roll back to any previous deploy instantly." },
  { icon: Globe, title: "Edge routing", body: "Requests are served from the region nearest each visitor by default." },
];

export default function PricingPage() {
  return (
    <SiteShell active="pricing">
      {/* Hero */}
      <section className="hero wrap">
        <span className="eyebrow" data-reveal="1">Pricing</span>
        <h1 data-reveal="1">Simple pricing that <span className="fg">scales with you</span></h1>
        <p className="sub" data-reveal="1">Start free. Pay for what you ship. No per-seat tax, no surprise egress bills.</p>
      </section>

      {/* Tiers */}
      <section className="wrap" style={{ paddingBottom: 24 }}>
        <div className="prices">
          {tiers.map((t) => (
            <div className={`tier${t.pop ? " pop" : ""}`} key={t.name} data-reveal="1">
              {t.pop && <span className="poptag">Most popular</span>}
              <div className="tn">{t.name}</div>
              <div className="tp">{t.price}{t.per && <span className="per">{t.per}</span>}</div>
              <div className="td">{t.desc}</div>
              <a className="tbtn" href={t.name === "Enterprise" ? "/contact" : "/signup"}>{t.cta}</a>
              <div className="tf">
                {t.features.map((f) => (
                  <div key={f}><Check size={16} /> {f}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Included on every plan */}
      <section className="blk wrap">
        <div className="shead center"><span className="eyebrow" data-reveal="1">On every plan</span><h2 data-reveal="1">The essentials are never an upsell</h2><p data-reveal="1">TLS, versioned deploys, and edge routing come standard — from the free tier up.</p></div>
        <div className="grid3" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
          {included.map((f) => (
            <div className="fcard" key={f.title} data-reveal="1">
              <span className="ic"><f.icon size={20} /></span>
              <h4>{f.title}</h4>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="wrap" style={{ paddingBottom: 110 }}>
        <div className="cta" data-reveal="1">
          <div className="cgrain" />
          <h2>Ship your first app free</h2>
          <p>No credit card required. Upgrade only when you outgrow the free tier.</p>
          <div className="cta-row">
            <a className="btn-white" href="/signup">Get started free <ArrowRight size={16} strokeWidth={2.4} /></a>
            <a className="btn-clear" href="/contact">Talk to sales</a>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

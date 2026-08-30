/**
 * SpinForge - AI-Native Zero Configuration Hosting & Application Infrastructure
 * Copyright (c) 2025 Jacob Ajiboye
 *
 * This software is licensed under the MIT License.
 * See the LICENSE file in the root directory for details.
 */
import {
  ArrowRight,
  Boxes,
  Code,
  FileArchive,
  GitBranch,
  Globe,
  Lock,
  RotateCcw,
  Rocket,
  Terminal,
  Workflow,
} from "lucide-react";
import { SiteShell } from "@/components/site/Site";

const CSS = `
.sf .qs{margin:44px auto 0;max-width:640px;border-radius:16px;overflow:hidden;border:1px solid #2a231c;background:#1b1611;box-shadow:0 30px 70px -50px rgba(23,18,14,.5)}
.sf .qs .qbar{display:flex;align-items:center;gap:8px;padding:12px 15px;border-bottom:1px solid #2c251f;background:#211c18}
.sf .qs .qbar .tl{width:11px;height:11px;border-radius:50%}
.sf .qs .qbar .lbl{margin-left:6px;font-family:var(--mono);font-size:11px;color:#9a8f83}
.sf .qs .qbody{padding:20px 22px;font-family:var(--mono);font-size:13.5px;line-height:2;text-align:left}
.sf .qs .qbody .pr{color:var(--ember)}
.sf .qs .qbody .cm{color:#8a8078}
.sf .qs .qbody .wt{color:#f3ede4}
.sf .qs .qbody .ok{color:#5fd39a}
.sf .qs .qbody .url{color:var(--forge)}
.sf .doclead{font-family:var(--mono);font-size:11px;text-transform:uppercase;letter-spacing:.14em;color:var(--ink3);margin:0 0 18px}
`;

const CATS = [
  { icon: Rocket, t: "Quickstart", d: "Install the CLI, log in, and deploy your first app in one command.", href: "/docs/quick-start" },
  { icon: GitBranch, t: "Deploy from Git", d: "Connect a repo — SpinForge detects the framework and builds it.", href: "/docs/deployment/manifest" },
  { icon: FileArchive, t: "Deploy from Zip", d: "Upload an archive of your project or built assets. Same pipeline.", href: "/docs/deployment/static-sites" },
  { icon: Terminal, t: "CLI reference", d: "Every command, flag, and workflow for deploying from your terminal.", href: "/docs/cli" },
  { icon: Globe, t: "Custom domains & TLS", d: "Point a domain at your app; certificates are issued automatically.", href: "/docs/deployment/custom-domains" },
  { icon: Lock, t: "Environment & secrets", d: "Manage runtime environment variables and encrypted secrets.", href: "/docs/deployment/env-vars" },
  { icon: Workflow, t: "Build pipelines", d: "Stages, caching, and reproducible builds from Git or a zip.", href: "/docs/pipelines" },
  { icon: Boxes, t: "Containers", d: "Run your own image on isolated containers with private networking.", href: "/docs/deployment/containers" },
  { icon: RotateCcw, t: "Rollbacks & previews", d: "Versioned artifacts, one-click rollback, and preview deploys.", href: "/docs/rollbacks" },
  { icon: Code, t: "API reference", d: "Drive deployments, sites, and containers over the REST API.", href: "/docs/api" },
];

export default function DocsPage() {
  return (
    <SiteShell active="docs">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* Docs index */}
      <section className="blk wrap" style={{ paddingTop: 104 }}>
        <span className="eyebrow" data-reveal="1">Documentation</span>
        <h2 data-reveal="1" style={{ fontSize: "clamp(30px,4vw,46px)", marginTop: 14 }}>Browse the docs</h2>
        <div className="grid3" style={{ marginTop: 36 }}>
          {CATS.map((c) => (
            <a className="fcard" href={c.href} key={c.t} data-reveal="1">
              <span className="ic"><c.icon size={20} /></span>
              <h4>{c.t}</h4>
              <p>{c.d}</p>
            </a>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="wrap" style={{ paddingBottom: 110 }}>
        <div className="cta" data-reveal="1">
          <div className="cgrain" />
          <h2>Nothing to configure. Just deploy.</h2>
          <p>Create an account and push your first app — the docs are here when you need them.</p>
          <div className="cta-row">
            <a className="btn-white" href="/signup">Get started free <ArrowRight size={16} strokeWidth={2.4} /></a>
            <a className="btn-clear" href="/docs/quick-start">Read the quickstart</a>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

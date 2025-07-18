# SpinForge Documentation

## 🧩 Overview

**SpinForge** is a modular system designed to run dynamic, isolated runtimes — called **Spinlets** — for AI-generated apps, tools, and workflows.

Whether it's a Remix site, an Express API, or a Next.js SSR project, SpinForge can build, deploy, and route them on-demand. It supports forked processes and container-based runtimes.

---

## 🧠 Concept Terminology

| Term            | Description                                                                             |
| --------------- | --------------------------------------------------------------------------------------- |
| **Spinlet**     | A runtime instance of a customer’s app (forked process or K8s pod)                      |
| **Forge**       | The engine that builds and configures Spinlets                                          |
| **SpinHub**     | Smart router/orchestrator that maps requests to Spinlets and triggers runtime if needed |
| **SpinCore**    | Lifecycle manager that spawns, monitors, and shuts down Spinlets                        |
| **Spinfile**    | Optional config per Spinlet (like Dockerfile but higher level)                          |
| **SpinClient**  | Shared control interface for interacting with the system (UI or CLI)                    |
| **SpinUI**      | Web-based SpinClient implementation for visual control                                  |
| **SpinCLI**     | Terminal-based SpinClient implementation                                                |
| **SpinBuilder** | Builds Remix/Next.js/etc. projects into deployable format                               |
| **SpinStorage** | Optional persistent storage layer (local or remote)                                     |

---

## 🗂️ Repository Structure

```
SpinForge/
├── spinlet-core/        # Manages runtime lifecycle (fork/spawn/kill)
├── spinlet-hub/         # Maps domains → Spinlets and initiates startup if needed
├── spinlet-builder/     # Handles Next.js/Remix builds
├── spinlet-storage/     # Persistent store for built apps (optional)
├── spinlet-cli/         # CLI-based SpinClient implementation
├── spinlet-ui/          # Web-based SpinClient implementation
└── docs/                # Landing page, architecture diagrams, API docs
```

---

## ⚙️ Core Concepts

### 🔹 Spinlet

A **Spinlet** is a lightweight runtime instance, isolated per user, session, or process. Each Spinlet:

* Runs independently (one crash doesn’t affect others)
* Can be forked on-demand and shut down when idle
* May be a Node.js server, CLI app, or SSR function
* Supports Remix, Next.js, Express, etc.

### 🔹 SpinHub

**SpinHub** is not just a reverse proxy. It's a smart orchestrator that:

* Maps domains or routes to Spinlets
* Launches Spinlets if not running
* Maintains routing registry
* Forwards requests with optional metadata/auth headers

### 🔹 SpinCore

SpinCore manages the Spinlet lifecycle:

* Forks processes or spawns containers
* Assigns ports
* Checks health & resource usage
* Kills or sleeps idle processes
* Notifies SpinHub about available endpoints

### 🔹 SpinBuilder

* Transforms source code into optimized, executable runtime
* May detect framework (e.g., Remix vs Next.js)
* Supports caching, code patching, dependency install

### 🔹 SpinClient (SpinUI / SpinCLI)

Interfaces for users or admins to:

* Deploy apps
* Monitor Spinlets
* Start/stop/redeploy runtimes
* View logs and metrics

---

## 🏗 Architecture

```
                       +------------------+
                       |  User Web Client |
                       +--------+---------+
                                |
                         Domain Request
                                |
+----------------+     +--------v--------+     +-----------------+
|   SpinClient   | --> |    SpinHub      | --> |    SpinCore     |
| (UI or CLI)    |     | (Routing Layer) |     |  (Runtime Mgr)  |
+----------------+     +--------+--------+     +--------+--------+
                                |                       |
                                |             +---------v---------+
                                |             |      Spinlets     |
                                |             | (Runtime per app) |
                                |             +---------+---------+
                                |                       |
                       +--------v--------+     +--------v--------+
                       |  Spinlet A      |     |   Spinlet B     |
                       +-----------------+     +-----------------+
```

---

## 🚀 Features

* 🌀 Dynamic Spinlet provisioning
* 🔒 Full isolation per customer/project
* ♻️ Reuse instances or auto-teardown
* 🌐 Smart domain mapping (via SpinHub)
* 📦 Framework-aware builds (Next.js, Remix, etc.)
* 🖥 GUI + CLI support

---

## 🔧 Use Cases

* AI-generated project preview and hosting
* SaaS builders with per-user backend/runtime
* One-off test apps or workflows
* Hot-swappable isolated backend tasks

---

## 🔜 Roadmap

* [ ] CLI deployment tooling
* [ ] Persistent volume handling
* [ ] Auto-suspend + resume
* [ ] Multi-runtime support (Python, Deno)
* [ ] Centralized logs/telemetry
* [ ] Prebuild caching

---

## 🏁 Getting Started

Coming soon: installation guide, Docker images, deployment templates.

---

## ✨ License

MIT

---

## 💡 Inspiration

Built for [MintFlow.ai](https://mintflow.ai), SpinForge powers AI-generated apps by safely executing logic per user — fast, isolated, and efficient.

---

## 📫 Contributing

PRs welcome. Full contribution guide coming soon.

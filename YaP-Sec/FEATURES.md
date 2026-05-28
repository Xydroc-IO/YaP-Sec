# YaPsec Features

## Platform & UX

- 32:9 triptych dashboard optimized for ultrawide operation
- Cyberpunk dark interface with compact, high-density controls
- Mode switching:
  - Defensive
  - Offensive
  - Audit
- One-place startup scripts for backend + frontend

## Realtime Operations

- Live WebSocket feed for events and status
- War Room terminal with bounded output and internal scrolling
- Feed filters:
  - All
  - Healer-only
  - Critical-only

## Offensive Tooling

- Ops Orchestrator panel for quick-start automation
- Metasploit RPC panel:
  - daemon start/stop
  - RPC connect
  - exploit search
  - handler launch
  - module run
- YaPMetasploit panel:
  - CLI status + run
  - preset args + custom args
  - stdout/stderr viewer
  - desktop GUI start/stop/status bridge
- Nmap panel:
  - profiles
  - extra args
  - status checks
- SQLMap panel:
  - risk/level
  - extra args
  - status checks
- Nuclei panel:
  - severity selection
  - stream runner
  - extra args
- Aircrack panel:
  - interface management
  - monitor mode controls
  - passive scan + extra args

## Intel Context Automation

- Shared context state for:
  - targets
  - URLs
  - interfaces
  - open ports
  - event history
- Intel Quick Fill strip with one-click prefill chips
- Cross-tool information reuse to reduce repeated operator input

## Audit & Compliance

- Integrated Lynis, OpenSCAP, and Checkov execution
- Parsed hardening checklist from audit outputs
- Hardening Index scoring
- Policy result table (pass/fail/unknown)
- Executive summary generation (deterministic + optional LLM)

## Report Access

- OpenSCAP HTML report endpoint and UI opener
- Checkov JSON report endpoint and UI opener
- Lynis log-tail endpoint and UI opener
- Report status refresh and availability indicators

## Self-Healing / Remediation

- Healer module with:
  - dry-run script preview
  - apply mode
  - snapshot backups
  - rollback controls
- One-click low-risk hardening pass
- Progress tracking in compliance UI
- Healer step-by-step realtime events in War Room

## Dependency & Installation System

- Backend installer API for tool-by-tool and full stack install
- `setup.sh` bootstrap for host preparation
- `install_dependencies.py` JSON-friendly installer mode
- Fallback strategies for problematic packages (AUR/pipx paths)
- YaPMetasploit GitHub installer integration:
  - clone/pull from upstream repo
  - installed-state detection by alias/entrypoint

## Security Controls

- Localhost-first API usage model
- Optional API key requirement for non-local API/WS access (`YAPSEC_API_KEY`)
- Privileged operation gates:
  - `YAPSEC_ALLOW_SUDO_INSTALL`
  - `YAPSEC_ALLOW_AUTO_FIX`
- Safer launcher host defaults bound to localhost

## Environment & Config

- `.env.example` with documented runtime/config variables:
  - backend/frontend host/port
  - API/WS URL overrides
  - API key guard
  - OpenAI key
  - privileged operation toggles
  - YaPMetasploit CLI/GUI location options

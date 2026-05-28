# YaPsec Build Summary

## Overview

YaPsec is a modular full-stack security operations platform that combines offensive tooling, audit/compliance visibility, live telemetry, and automated remediation inside one UI.

## Stack & Architecture

- Frontend: React + Vite + TypeScript + Tailwind CSS
- Backend: FastAPI with modular routes and service modules
- Realtime: WebSocket stream at `/ws/feed`
- Layout model: 32:9 triptych workflow
  - Left: tools/dependency health/pulse
  - Center: war room + offensive workspace
  - Right: intelligence/compliance
- Launch model: one-place scripts (`run.sh`, `auto_setup_and_launch.sh`)

## Core Platform Capabilities

### Offensive Workspace

Tabbed center workspace with integrated modules:

- Ops Orchestrator
- Metasploit RPC
- YaPMetasploit
- Nmap
- Nuclei
- SQLMap
- Aircrack

Each module supports status checks, advanced argument input, run actions, and output views.

### Intel Context Automation

- Shared backend Intel context for targets, URLs, interfaces, open ports, and events
- Intel Quick Fill strip in Offensive workspace for one-click prefill
- Cross-tool data sharing so output from one tool can be used by another

### War Room Terminal

- Real-time WebSocket event feed
- Internal scrolling and output containment for ultrawide layouts
- Filters for triage:
  - `All`
  - `Healer`
  - `Critical`

## Audit, Compliance, and Reporting

### Audit Stack

Integrated:

- Lynis
- OpenSCAP
- Checkov

Outputs:

- Hardening checklist (parsed findings)
- Policy pass/fail/unknown panel
- Hardening Index score
- Executive summary (deterministic + optional LLM)

### Report Viewer

API and GUI support for viewing reports:

- OpenSCAP HTML
- Checkov JSON
- Lynis log tail

## Self-Healing Layer

### Healer Module

Implemented remediation system includes:

- Dry-run preview of remediation script
- Apply mode
- Pre-change snapshots
- Rollback by snapshot ID
- One-click low-risk hardening pass

### Realtime Hardening Telemetry

Healer progress broadcasts to War Room:

- start events
- per-step progress and status
- failure events
- completion events
- rollback events

## Installer & Dependency System

### Installation Paths

- API-driven installer (`/api/tools/install`, `/api/tools/install-stack`)
- `setup.sh` for system bootstrap
- `install_dependencies.py` for structured install flow and JSON output

### YaPMetasploit Install from GitHub

Since YaPMetasploit is not pacman-native, installer now supports:

- clone/pull from `https://github.com/Xydroc-IO/YaP-Metasploit-GUI.git`
- installed-state detection via binary aliases or GUI entry path
- pentest dependency category inclusion

## YaPMetasploit Integration

### Native Module Tab

The YaPMSF tab includes:

- status checks
- preset + custom argument runs
- timeout control
- stdout/stderr output panes
- Intel target push when `--target/-t` is used

### Desktop GUI Bridge

Integrated backend and UI controls for external YaP-Metasploit-GUI process:

- GUI status
- start GUI
- stop GUI
- entry/log path display

## Security Hardening Applied

- API guard middleware added:
  - localhost allowed by default
  - non-local API/WS requires `YAPSEC_API_KEY`
- safer localhost-first host binding defaults in launcher
- reduced Metasploit credential exposure via API behavior changes
- privileged flows gated by environment toggles

## Environment Support

Added `.env.example` covering:

- host/port runtime settings
- API key guard
- installer/autofix toggles
- OpenAI key
- YaPMetasploit CLI + GUI path variables

## Current Result

YaPsec now functions as a single-pane SecOps platform that unifies offensive operations, audit/compliance reporting, automated hardening, and external module integration in a modular architecture.

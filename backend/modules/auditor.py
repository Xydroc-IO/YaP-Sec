"""
Audit brain for YaPsec:
- Runs Lynis and parses warnings/suggestions into a JSON checklist.
- Wraps OpenSCAP and Checkov scans.
- Computes hardening score and 3-bullet executive summary.
- Supports curated one-click remediations with config backup first.
"""

from __future__ import annotations

import asyncio
import datetime as dt
import json
import os
import re
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

Severity = Literal["warning", "suggestion"]

LYNIS_LOG = Path("/var/log/lynis.log")
YAPSEC_AUDIT_DIR = Path("/tmp/yapsec-audit")
YAPSEC_AUDIT_DIR.mkdir(parents=True, exist_ok=True)
OPENSCAP_XML = YAPSEC_AUDIT_DIR / "openscap-results.xml"
OPENSCAP_HTML = YAPSEC_AUDIT_DIR / "openscap-report.html"
CHECKOV_JSON = YAPSEC_AUDIT_DIR / "checkov.json"


@dataclass(frozen=True)
class AuditFinding:
    id: str
    severity: Severity
    policy_name: str
    description: str
    raw: str
    fix_id: str | None
    source: str = "lynis"
    passed: bool = False


_SUGGEST_RE = re.compile(r"\bSuggestion\b[:\]]?\s*(.*)", re.IGNORECASE)
_WARNING_RE = re.compile(r"\bWarning\b[:\]]?\s*(.*)", re.IGNORECASE)
_POLICY_HINT_RE = re.compile(r"\[([A-Z0-9_]{3,})\]")


def _tool_path(bin_name: str) -> str | None:
    return shutil.which(bin_name)


def _now_stamp() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def parse_lynis_log(path: Path = LYNIS_LOG) -> list[AuditFinding]:
    if not path.exists():
        return []
    findings: list[AuditFinding] = []
    for idx, line in enumerate(path.read_text(errors="replace").splitlines()):
        if "Suggestion" not in line and "Warning" not in line:
            continue
        sev: Severity
        body: str
        m_warn = _WARNING_RE.search(line)
        m_sug = _SUGGEST_RE.search(line)
        if m_warn:
            sev = "warning"
            body = m_warn.group(1).strip() or line.strip()
        elif m_sug:
            sev = "suggestion"
            body = m_sug.group(1).strip() or line.strip()
        else:
            continue

        policy = "General Hardening"
        hint = _POLICY_HINT_RE.search(line)
        if hint:
            policy = hint.group(1).replace("_", " ").title()
        elif "ssh" in body.lower():
            policy = "SSH Hardening"
        elif "password" in body.lower():
            policy = "Password Complexity"
        elif "firewall" in body.lower():
            policy = "Firewall Enforcement"
        elif "kernel" in body.lower():
            policy = "Kernel Security"

        finding = AuditFinding(
            id=f"lynis-{idx}",
            severity=sev,
            policy_name=policy,
            description=body,
            raw=line.strip(),
            fix_id=suggest_fix_id(body),
            source="lynis",
            passed=False,
        )
        findings.append(finding)
    return findings


def suggest_fix_id(description: str) -> str | None:
    d = description.lower()
    if "permitrootlogin" in d or ("root" in d and "ssh" in d):
        return "ssh_disable_root_login"
    if "password" in d and ("complex" in d or "pam" in d):
        return "pam_enable_pwquality"
    if "ufw" in d or "firewall" in d:
        return "ufw_enable_default_deny"
    if "x11forwarding" in d:
        return "ssh_disable_x11_forwarding"
    return None


def hardening_index(findings: list[AuditFinding]) -> int:
    if not findings:
        return 100
    penalty = 0
    for f in findings:
        penalty += 6 if f.severity == "warning" else 3
    score = max(0, 100 - penalty)
    return score


def executive_summary(findings: list[AuditFinding]) -> list[str]:
    if not findings:
        return [
            "Current host baseline appears healthy with no parsed Lynis warnings/suggestions.",
            "Continue periodic auditing and keep packages/services updated.",
            "Validate OpenSCAP and IaC scans to maintain compliance coverage.",
        ]

    warnings = [f for f in findings if f.severity == "warning"]
    suggestions = [f for f in findings if f.severity == "suggestion"]
    top_policies: dict[str, int] = {}
    for f in findings:
        top_policies[f.policy_name] = top_policies.get(f.policy_name, 0) + 1
    ordered = sorted(top_policies.items(), key=lambda kv: kv[1], reverse=True)
    focus = ", ".join([name for name, _ in ordered[:3]]) or "general hardening"

    return [
        f"Security posture is moderate risk: {len(warnings)} high-priority warnings and {len(suggestions)} hardening suggestions were identified.",
        f"Most findings cluster around {focus}; addressing these domains first gives the largest risk reduction.",
        "Immediate action should prioritize SSH hardening, credential policy controls, and baseline firewall controls where applicable.",
    ]


async def llm_executive_summary(findings: list[AuditFinding]) -> list[str]:
    """
    Optional LLM summary path. Falls back to deterministic summary when OPENAI_API_KEY
    is not configured or SDK call fails.
    """
    if not os.environ.get("OPENAI_API_KEY"):
        return executive_summary(findings)
    try:
        from openai import OpenAI

        client = OpenAI()
        payload = [
            {
                "policy_name": f.policy_name,
                "severity": f.severity,
                "description": f.description,
                "source": f.source,
            }
            for f in findings[:80]
        ]
        prompt = (
            "Summarize these technical findings into exactly 3 short bullet points for a non-technical CEO. "
            "Focus on risk, business impact, and next steps. Findings JSON:\n"
            + json.dumps(payload)
        )
        completion = client.responses.create(
            model="gpt-4.1-mini",
            input=prompt,
            max_output_tokens=220,
        )
        text = completion.output_text.strip()
        lines = [ln.strip("- ").strip() for ln in text.splitlines() if ln.strip()]
        bullets = [ln for ln in lines if ln][:3]
        if len(bullets) == 3:
            return bullets
    except Exception:
        pass
    return executive_summary(findings)


async def run_lynis_audit(quick: bool = True) -> dict[str, Any]:
    exe = _tool_path("lynis")
    if not exe:
        return {"ok": False, "error": "lynis not found in PATH"}
    cmd = [exe, "audit", "system"]
    if quick:
        cmd.append("--quick")
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    out_b, err_b = await proc.communicate()
    findings = parse_lynis_log()
    return {
        "ok": proc.returncode == 0,
        "returncode": proc.returncode,
        "stdout_tail": (out_b or b"").decode(errors="replace")[-4000:],
        "stderr_tail": (err_b or b"").decode(errors="replace")[-4000:],
        "log_path": str(LYNIS_LOG),
        "finding_count": len(findings),
        "hardening_index": hardening_index(findings),
        "executive_summary": executive_summary(findings),
        "timestamp": _now_stamp(),
    }


def _mk_finding_row(fid: AuditFinding) -> dict[str, Any]:
    return {
        "id": fid.id,
        "source": fid.source,
        "severity": fid.severity,
        "policy_name": fid.policy_name,
        "description": fid.description,
        "raw": fid.raw,
        "fix_id": fid.fix_id,
        "passed": fid.passed,
    }


def get_hardening_checklist() -> dict[str, Any]:
    findings = parse_lynis_log()
    rows = [_mk_finding_row(f) for f in findings]
    return {
        "ok": True,
        "log_path": str(LYNIS_LOG),
        "hardening_index": hardening_index(findings),
        "findings": rows,
        "policy_results": build_policy_results(rows),
        "executive_summary": executive_summary(findings),
        "timestamp": _now_stamp(),
    }


def build_policy_results(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not rows:
        return baseline_policy_results()
    grouped: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        grouped.setdefault(row["policy_name"], []).append(row)
    out: list[dict[str, Any]] = []
    for name, items in grouped.items():
        has_warning = any(i["severity"] == "warning" for i in items)
        status = "fail" if has_warning else "pass"
        out.append({"policy_name": name, "status": status, "count": len(items)})
    rank = {"fail": 0, "unknown": 1, "pass": 2}
    out.sort(key=lambda x: (rank.get(x["status"], 1), x["policy_name"]))
    return out


def _read_text(path: str) -> str:
    try:
        return Path(path).read_text(errors="replace")
    except Exception:
        return ""


def baseline_policy_results() -> list[dict[str, Any]]:
    """
    Fallback policy table when Lynis findings are empty or logs are unavailable.
    Keeps UI populated with actionable baseline checks.
    """
    out: list[dict[str, Any]] = []

    sshd = _read_text("/etc/ssh/sshd_config")
    if not sshd:
        out.append({"policy_name": "SSH Hardening", "status": "unknown", "count": 0})
    elif re.search(r"^\s*PermitRootLogin\s+no\b", sshd, re.IGNORECASE | re.MULTILINE):
        out.append({"policy_name": "SSH Hardening", "status": "pass", "count": 1})
    else:
        out.append({"policy_name": "SSH Hardening", "status": "fail", "count": 1})

    pwq = _read_text("/etc/security/pwquality.conf")
    if not pwq:
        out.append({"policy_name": "Password Complexity", "status": "unknown", "count": 0})
    elif re.search(r"^\s*minlen\s*=\s*(1[2-9]|[2-9]\d)\b", pwq, re.IGNORECASE | re.MULTILINE):
        out.append({"policy_name": "Password Complexity", "status": "pass", "count": 1})
    else:
        out.append({"policy_name": "Password Complexity", "status": "fail", "count": 1})

    ufw = _read_text("/etc/ufw/ufw.conf")
    if not ufw:
        out.append({"policy_name": "Firewall Enforcement", "status": "unknown", "count": 0})
    elif re.search(r"^\s*ENABLED\s*=\s*yes\b", ufw, re.IGNORECASE | re.MULTILINE):
        out.append({"policy_name": "Firewall Enforcement", "status": "pass", "count": 1})
    else:
        out.append({"policy_name": "Firewall Enforcement", "status": "fail", "count": 1})

    auditd_exists = Path("/etc/audit/auditd.conf").exists()
    out.append(
        {
            "policy_name": "Audit Logging",
            "status": "pass" if auditd_exists else "unknown",
            "count": 1 if auditd_exists else 0,
        }
    )

    rank = {"fail": 0, "unknown": 1, "pass": 2}
    out.sort(key=lambda x: (rank.get(x["status"], 1), x["policy_name"]))
    return out


FIX_SNIPPETS: dict[str, list[str]] = {
    "ssh_disable_root_login": [
        "sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak.$(date +%s)",
        "sudo sed -i 's/^#\\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config",
        "sudo systemctl restart sshd || sudo systemctl restart ssh",
    ],
    "ssh_disable_x11_forwarding": [
        "sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak.$(date +%s)",
        "sudo sed -i 's/^#\\?X11Forwarding.*/X11Forwarding no/' /etc/ssh/sshd_config",
        "sudo systemctl restart sshd || sudo systemctl restart ssh",
    ],
    "pam_enable_pwquality": [
        "sudo cp /etc/security/pwquality.conf /etc/security/pwquality.conf.bak.$(date +%s)",
        "sudo bash -lc \"grep -q '^minlen' /etc/security/pwquality.conf && sed -i 's/^minlen.*/minlen = 14/' /etc/security/pwquality.conf || echo 'minlen = 14' >> /etc/security/pwquality.conf\"",
    ],
    "ufw_enable_default_deny": [
        "sudo ufw default deny incoming",
        "sudo ufw default allow outgoing",
        "sudo ufw --force enable",
    ],
}


async def apply_fix(fix_id: str) -> dict[str, Any]:
    cmds = FIX_SNIPPETS.get(fix_id)
    if not cmds:
        return {"ok": False, "error": f"unknown fix_id: {fix_id}"}
    if os.environ.get("YAPSEC_ALLOW_AUTO_FIX", "").strip().lower() not in ("1", "true", "yes"):
        return {
            "ok": False,
            "error": "auto-fix disabled",
            "hint": "export YAPSEC_ALLOW_AUTO_FIX=1",
            "preview": cmds,
        }

    outputs: list[dict[str, Any]] = []
    for cmd in cmds:
        proc = await asyncio.create_subprocess_shell(
            cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        out_b, err_b = await proc.communicate()
        outputs.append(
            {
                "command": cmd,
                "returncode": proc.returncode,
                "stdout_tail": (out_b or b"").decode(errors="replace")[-3000:],
                "stderr_tail": (err_b or b"").decode(errors="replace")[-3000:],
            }
        )
        if proc.returncode != 0:
            return {"ok": False, "fix_id": fix_id, "steps": outputs}
    return {"ok": True, "fix_id": fix_id, "steps": outputs}


async def run_openscap(profile: str | None = None) -> dict[str, Any]:
    exe = _tool_path("oscap")
    if not exe:
        return {"ok": False, "error": "oscap not found in PATH"}
    target_profile = profile or "xccdf_org.ssgproject.content_profile_pci-dss"
    datastream = Path("/usr/share/xml/scap/ssg/content/ssg-archlinux-ds.xml")
    if not datastream.exists():
        datastream = Path("/usr/share/xml/scap/ssg/content/ssg-arch-ds.xml")
    if not datastream.exists():
        return {
            "ok": False,
            "error": "SCAP datastream not found",
            "hint": "install scap-security-guide package",
        }

    proc = await asyncio.create_subprocess_exec(
        exe,
        "xccdf",
        "eval",
        "--profile",
        target_profile,
        "--results",
        str(OPENSCAP_XML),
        "--report",
        str(OPENSCAP_HTML),
        str(datastream),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    out_b, err_b = await proc.communicate()
    return {
        "ok": proc.returncode == 0,
        "returncode": proc.returncode,
        "profile": target_profile,
        "report_html": str(OPENSCAP_HTML),
        "results_xml": str(OPENSCAP_XML),
        "stdout_tail": (out_b or b"").decode(errors="replace")[-4000:],
        "stderr_tail": (err_b or b"").decode(errors="replace")[-4000:],
    }


async def run_checkov(path: str = ".") -> dict[str, Any]:
    exe = _tool_path("checkov")
    if not exe:
        return {"ok": False, "error": "checkov not found in PATH"}
    proc = await asyncio.create_subprocess_exec(
        exe,
        "-d",
        path,
        "--quiet",
        "--output",
        "json",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    out_b, err_b = await proc.communicate()
    text = (out_b or b"").decode(errors="replace")
    CHECKOV_JSON.write_text(text or "{}", encoding="utf-8")
    parsed: dict[str, Any] = {}
    try:
        parsed = json.loads(text) if text.strip() else {}
    except json.JSONDecodeError:
        parsed = {}
    failed = len((parsed.get("results") or {}).get("failed_checks") or [])
    passed = len((parsed.get("results") or {}).get("passed_checks") or [])
    return {
        "ok": proc.returncode == 0,
        "returncode": proc.returncode,
        "failed_checks": failed,
        "passed_checks": passed,
        "json_path": str(CHECKOV_JSON),
        "stderr_tail": (err_b or b"").decode(errors="replace")[-4000:],
    }

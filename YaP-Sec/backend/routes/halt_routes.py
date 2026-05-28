from fastapi import APIRouter
import subprocess
from services.feed_hub import feed_hub, iso_now

router = APIRouter(tags=["halt"])

@router.post("/halt")
async def halt_all():
    tools = ["nmap", "sqlmap", "nuclei", "aircrack-ng", "airodump-ng", "oscap", "lynis"]
    killed = []
    for tool in tools:
        # Pkill processes exactly named like the tool, or their command line contains the tool
        res = subprocess.run(["pkill", "-9", "-f", f"/{tool}| {tool} |^{tool}"], capture_output=True)
        if res.returncode == 0:
            killed.append(tool)
            
    await feed_hub.broadcast({
        "module": "orchestrator",
        "type": "log",
        "severity": "critical",
        "message": f"KILL SWITCH ACTIVATED. Killed: {', '.join(killed) if killed else 'None'}",
        "timestamp": iso_now()
    })
    
    return {"ok": True, "killed": killed}

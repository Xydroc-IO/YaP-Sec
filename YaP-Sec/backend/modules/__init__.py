"""YaPsec tool plugins — one module per external integration."""

from __future__ import annotations

import importlib
from typing import Any


def safe_import(name: str) -> tuple[Any | None, str | None]:
    try:
        return importlib.import_module(f"{__name__}.{name}"), None
    except Exception as e:
        return None, str(e)

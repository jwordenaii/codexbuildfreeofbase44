"""
os_ability_service.py

Agentic tool-discovery engine for the J.A.R.V.I.S. gateway.

Exposes search_os_abilities() and execute_os_ability() over the pre-built
jarvis_os_registry.json index, so registered abilities under abilities/ are
reachable by module_id instead of requiring a hand-written import and
endpoint for each one.

Serves POST /api/v1/abilities/execute, which is now authenticated at router
level (it dynamically imports and runs modules by id).

WHAT THE REGISTRY ACTUALLY CONTAINS — measured, not assumed:

  162 registered   109 real implementations   53 unimplemented

52 of the 53 are generated scaffolds sharing one signature: they import psutil, report host CPU and
memory percentages in place of any domain logic, and interpolate an
undefined `class_name` into their output (so calling one raises NameError).
`escrow_engine`, `ai_brain`, `cognitive_twin`, `stripe_connect_payout` and
48 others are in this group. The 53rd is tenant_isolator, a different
kind of fake — see that module's own docstring — the names promise domain engines, the bodies
are machine telemetry. Their docstrings claim "no-placeholder concrete
logic", which is the opposite of what they contain; do not trust that string.

They are tagged `implemented: false` at registry load, surfaced as such in
search results, and rejected by execute_os_ability() with an explanation
rather than the confusing NameError. Replacing one with real logic is all
it takes to flip the flag — the detection reads the source, not a list.

PARAMETER POLICY — read before changing:

The previous version of this file fabricated values for any required parameter the caller omits
(missing password/token/key -> "secret_token_123", missing price/amount ->
100.0, anything else -> "default"), then returns the result as if it were
real. For a finance or bid engine that produces confident, fabricated
numbers rather than an error.

Here, strict=True is the default: a missing required parameter is an error.
Callers who want the exploratory behavior pass strict=False, and then every
fabricated value is listed in the response under "defaulted_params" so a
synthesised result can never be mistaken for a computed one.

Search uses simple keyword scoring — no external dependencies.
"""
from __future__ import annotations

import asyncio
import importlib
import inspect
import json
import logging
import pathlib
import re
from functools import lru_cache
from typing import Any

logger = logging.getLogger(__name__)

_REGISTRY_PATH = pathlib.Path(__file__).parent.parent / "jarvis_os" / "jarvis_os_registry.json"
_ABILITIES_PKG = "app.jarvis_os.abilities"


class MissingParameterError(ValueError):
    """Raised in strict mode when a required parameter was not supplied."""


@lru_cache(maxsize=1)
def _load_registry() -> list[dict]:
    """Load and cache the ability registry JSON, tagging unimplemented shells."""
    try:
        data = json.loads(_REGISTRY_PATH.read_text(encoding="utf-8"))
    except Exception as exc:
        logger.error("[OS-ABILITY] Failed to load registry: %s", exc)
        return []

    for entry in data:
        entry["implemented"] = not _is_template_shell(entry)

    shells = sum(1 for e in data if not e["implemented"])
    logger.info(
        "[OS-ABILITY] Registry loaded: %d abilities (%d implemented, %d unimplemented scaffolds)",
        len(data), len(data) - shells, shells,
    )
    return data


def _source_path(entry: dict) -> pathlib.Path:
    """Resolve an ability's source file. The registry's own 'file' field holds
    Windows-style backslash paths and is deliberately ignored."""
    return (
        _REGISTRY_PATH.parent
        / "abilities"
        / entry.get("category", "")
        / (entry.get("module_id", "").split(".")[-1] + ".py")
    )


@lru_cache(maxsize=512)
def _shell_check(path_str: str) -> bool:
    try:
        src = pathlib.Path(path_str).read_text(encoding="utf-8")
    except Exception:
        return False
    # Two ways a module declares itself unimplemented:
    #
    # 1. Explicit opt-out — the class sets `self.implemented = False`. Any module
    #    can use this to mark itself as a placeholder (see tenant_isolator).
    # 2. Generated scaffolds — they report host CPU/memory telemetry in place of
    #    any domain logic and interpolate an undefined `class_name` into their
    #    output string, so execute() raises NameError.
    if "self.implemented = False" in src:
        return True
    return "psutil.cpu_percent" in src and "Host CPU Allocation" in src


def _is_template_shell(entry: dict) -> bool:
    return _shell_check(str(_source_path(entry)))


def _score(ability: dict, tokens: list[str]) -> float:
    """Score an ability record against a list of query tokens."""
    text = " ".join([
        ability.get("module_id", ""),
        ability.get("category", ""),
        ability.get("class_name", ""),
        ability.get("description", ""),
        " ".join(ability.get("tags", [])),
    ]).lower()

    score = 0.0
    for token in tokens:
        count = text.count(token)
        if count:
            if token in ability.get("module_id", "").lower():
                score += count * 3.0
            elif token in ability.get("category", "").lower():
                score += count * 2.0
            else:
                score += count * 1.0
    return score


def search_os_abilities(query: str, top_k: int = 6) -> dict:
    """Search the ability registry by keyword relevance."""
    registry = _load_registry()
    if not query:
        # An empty query lists the catalogue rather than erroring, so the UI
        # can render "all abilities" without a special case.
        return {
            "ok": True,
            "total_abilities": len(registry),
            "results": [
                {
                    "module_id": a.get("module_id"),
                    "category": a.get("category"),
                    "description": a.get("description"),
                    "params": a.get("params", []),
                    "implemented": a.get("implemented", True),
                }
                for a in registry[:top_k]
            ],
        }

    tokens = [t for t in re.split(r"\W+", query.lower()) if t]
    scored = [(a, _score(a, tokens)) for a in registry]
    hits = sorted([s for s in scored if s[1] > 0], key=lambda s: s[1], reverse=True)[:top_k]

    return {
        "ok": True,
        "query": query,
        "total_abilities": len(registry),
        "results": [
            {
                "module_id": a.get("module_id"),
                "category": a.get("category"),
                "class_name": a.get("class_name"),
                "description": a.get("description"),
                "params": a.get("params", []),
                "implemented": a.get("implemented", True),
                "score": round(s, 2),
            }
            for a, s in hits
        ],
    }


def list_ability_categories() -> dict:
    """Group the registry by category, for building a catalogue UI."""
    registry = _load_registry()
    buckets: dict[str, list[str]] = {}
    for a in registry:
        buckets.setdefault(a.get("category", "Uncategorised"), []).append(a.get("module_id", ""))
    return {
        "ok": True,
        "total_abilities": len(registry),
        "total_categories": len(buckets),
        "categories": {k: sorted(v) for k, v in sorted(buckets.items())},
    }


# --- parameter synthesis (only used when strict=False) -----------------------

def _synthesise(param_name: str) -> Any:
    """Best-effort placeholder for a required parameter the caller omitted."""
    lowered = param_name.lower()
    if lowered in ("image_bytes", "image_data", "b64_image", "image"):
        return b"MOCK_IMAGE_BYTES_FOR_INSPECTION"
    if lowered in ("session", "db"):
        return None
    if lowered in ("transit_minutes", "time", "duration"):
        return 30.0
    if lowered in ("ambient_temp", "start_temp", "temp"):
        return 70.0
    if lowered in ("wind_speed_mph", "wind"):
        return 5.0
    if lowered in ("task_id", "id", "code"):
        return "TASK-001"
    if lowered in ("description", "reason"):
        return "Operational dispatch check"
    if "email" in lowered:
        return "ops@thewordenstandard.com"
    if any(k in lowered for k in ("volatility", "drift")):
        return 0.2
    if any(k in lowered for k in ("price", "amount", "count", "num", "min", "max",
                                  "limit", "sqft", "tonnage", "year", "depth",
                                  "width", "length", "speed", "score", "yield", "val")):
        return 100
    return "default"


def _resolve_params(
    sig: inspect.Signature,
    supplied: dict,
    strict: bool,
    defaulted: list[str],
    skip: tuple[str, ...] = ("self", "args", "kwargs"),
) -> dict:
    """Map supplied params onto a signature, recording anything synthesised."""
    resolved: dict[str, Any] = {}
    missing: list[str] = []

    for name, param in sig.parameters.items():
        if name in skip:
            continue
        if name in supplied:
            resolved[name] = supplied[name]
        elif param.default is not inspect.Parameter.empty:
            continue
        elif strict:
            missing.append(name)
        else:
            resolved[name] = _synthesise(name)
            defaulted.append(name)

    if missing:
        raise MissingParameterError(
            "Missing required parameter(s): "
            + ", ".join(sorted(missing))
            + ". Supply them, or pass strict=false to run with placeholder values "
              "(results will be flagged as synthesised)."
        )
    return resolved


def execute_os_ability(module_id: str, params: dict | None = None, strict: bool = True) -> dict:
    """
    Dynamically import and execute an ability by module_id.

    strict=True  (default) -> missing required params raise a clear error.
    strict=False           -> placeholders are synthesised and every one of
                              them is listed in "defaulted_params".
    """
    if not module_id:
        return {"ok": False, "error": "No module_id provided"}

    registry = _load_registry()
    entry = next((a for a in registry if a.get("module_id") == module_id), None)
    if entry is None:
        return {"ok": False, "error": f"module_id '{module_id}' not found in registry."}

    if not entry.get("implemented", True):
        # Fail with the real reason rather than the NameError the scaffold raises.
        return {
            "ok": False,
            "implemented": False,
            "module_id": module_id,
            "error": (
                f"'{module_id}' is a generated scaffold, not a working ability. It reports "
                f"host CPU/memory telemetry instead of {entry.get('category', 'domain')} logic, "
                f"and its output string interpolates an undefined 'class_name'. It needs a real "
                f"implementation before it can be called."
            ),
        }

    # Import path is derived from module_id + category. The registry's "file"
    # field holds Windows-style backslash paths from the machine that generated
    # it and is deliberately NOT used here — it does not resolve on Linux.
    category = entry["category"]
    file_stem = module_id.split(".")[-1]
    import_path = f"{_ABILITIES_PKG}.{category}.{file_stem}"

    try:
        mod = importlib.import_module(import_path)
    except Exception as exc:
        return {"ok": False, "error": f"Could not import module '{import_path}': {exc}"}

    class_name = entry.get("class_name")
    cls = getattr(mod, class_name, None) if class_name else None
    if cls is None:
        classes = [
            obj for _, obj in inspect.getmembers(mod, inspect.isclass)
            if obj.__module__ == import_path
        ]
        if not classes:
            return {"ok": False, "error": f"No class found in '{import_path}'"}
        cls = classes[0]
        class_name = cls.__name__

    params = params or {}
    defaulted: list[str] = []

    # --- instantiate ---------------------------------------------------------
    try:
        init_args = _resolve_params(inspect.signature(cls.__init__), params, strict, defaulted)
        engine = cls(**init_args)
    except MissingParameterError as exc:
        return {"ok": False, "error": f"{class_name}.__init__: {exc}"}
    except Exception:
        try:
            engine = cls()
        except Exception as exc2:
            return {"ok": False, "error": f"Failed to instantiate {class_name}: {exc2}"}

    # --- find entry point ----------------------------------------------------
    method = None
    target_method_name = ""
    for candidate_name in ("execute", "calculate_decay", "run", "analyze", "process",
                           "predict", "inspect", "score"):
        candidate = getattr(engine, candidate_name, None)
        if callable(candidate):
            method, target_method_name = candidate, candidate_name
            break

    if method is None:
        public = [
            (name, m) for name, m in inspect.getmembers(engine, callable)
            if not name.startswith("_")
        ]
        if not public:
            return {"ok": False, "error": f"No callable entry-point found on {class_name}."}
        target_method_name, method = public[0]

    # --- invoke --------------------------------------------------------------
    try:
        sig = inspect.signature(method)
        param_names = [p for p in sig.parameters if p not in ("self", "args", "kwargs")]

        call_args: list[Any] = []
        call_kwargs: dict[str, Any] = {}

        if not param_names:
            pass
        elif len(param_names) == 1 and param_names[0] in ("params", "kwargs", "data", "payload", "config"):
            call_args.append(params)
        elif len(param_names) == 1 and param_names[0] in ("query", "text", "prompt", "input_data",
                                                          "url", "email", "address", "location"):
            single = param_names[0]
            value = (params.get(single) or params.get("query") or params.get("text")
                     or params.get("prompt") or params.get("location"))
            if value is None:
                if strict:
                    return {
                        "ok": False,
                        "error": f"{class_name}.{target_method_name}: missing required parameter "
                                 f"'{single}'. Supply it, or pass strict=false.",
                    }
                value = "asphalt paving operations inspection"
                defaulted.append(single)
            call_args.append(value)
        else:
            try:
                call_kwargs = _resolve_params(sig, params, strict, defaulted)
            except MissingParameterError as exc:
                return {"ok": False, "error": f"{class_name}.{target_method_name}: {exc}"}

        if inspect.iscoroutinefunction(method):
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = None
            if loop is not None:
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as pool:
                    result = pool.submit(lambda: asyncio.run(method(*call_args, **call_kwargs))).result()
            else:
                result = asyncio.run(method(*call_args, **call_kwargs))
        else:
            result = method(*call_args, **call_kwargs)

        response = {
            "ok": True,
            "module_id": module_id,
            "class_name": class_name,
            "method": target_method_name,
            "result": result if isinstance(result, (dict, list)) else {"output": str(result)},
        }
        if defaulted:
            # Loud on purpose: this result is partly synthetic.
            response["synthesised"] = True
            response["defaulted_params"] = sorted(set(defaulted))
            response["warning"] = (
                "One or more required parameters were not supplied and were filled with "
                "placeholder values. This result is NOT computed from real inputs."
            )
        return response

    except Exception as exc:
        logger.warning("[OS-ABILITY] Execution error for %s: %s", module_id, exc)
        return {
            "ok": False,
            "error": f"Execution failed for {class_name}.{target_method_name}: {exc}",
        }

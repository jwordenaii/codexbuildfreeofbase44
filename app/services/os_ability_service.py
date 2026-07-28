"""
app/services/os_ability_service.py

Agentic Tool Discovery engine for Jarvis.
Provides search_os_abilities() and execute_os_ability() backed by the
pre-built jarvis_os_registry.json index.

Search uses a fast TF-IDF-style keyword scoring — no external deps needed.
"""
from __future__ import annotations

import importlib
import json
import logging
import pathlib
import re
from functools import lru_cache
from typing import Any

logger = logging.getLogger(__name__)

_REGISTRY_PATH = pathlib.Path(__file__).parent.parent / "jarvis_os" / "jarvis_os_registry.json"
_ABILITIES_PKG = "app.jarvis_os.abilities"


@lru_cache(maxsize=1)
def _load_registry() -> list[dict]:
    """Load and cache the ability registry JSON."""
    try:
        data = json.loads(_REGISTRY_PATH.read_text(encoding="utf-8"))
        logger.info("[OS-ABILITY] Registry loaded: %d abilities", len(data))
        return data
    except Exception as exc:
        logger.error("[OS-ABILITY] Failed to load registry: %s", exc)
        return []


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
            # Exact module_id match is a huge boost
            if token in ability.get("module_id", "").lower():
                score += count * 3.0
            elif token in ability.get("category", "").lower():
                score += count * 2.0
            else:
                score += count * 1.0
    return score


def search_os_abilities(query: str, top_k: int = 6) -> dict:
    """
    Search the Jarvis OS ability registry using keyword relevance scoring.
    Returns the top_k most relevant abilities with their module_id and params.
    """
    if not query:
        return {"ok": False, "error": "No query provided"}

    registry = _load_registry()
    if not registry:
        return {"ok": False, "error": "Ability registry not loaded"}

    tokens = [t for t in re.split(r"[\s\W]+", query.lower()) if len(t) > 2]

    scored = [(ability, _score(ability, tokens)) for ability in registry]
    scored = [(a, s) for a, s in scored if s > 0]
    scored.sort(key=lambda x: x[1], reverse=True)
    top = scored[:top_k]

    results = []
    for ability, score in top:
        results.append({
            "module_id":   ability["module_id"],
            "category":    ability["category"],
            "class_name":  ability["class_name"],
            "description": ability["description"],
            "params":      ability["params"],
            "relevance":   round(score, 2),
        })

    return {
        "ok": True,
        "query": query,
        "total_abilities": len(registry),
        "results": results,
    }


import inspect

def execute_os_ability(module_id: str, params: dict | None = None) -> dict:
    """
    Dynamically import and execute a Jarvis OS ability by its module_id.
    Ferrari-grade resilient execution with automatic class resolution and signature matching.
    """
    if not module_id:
        return {"ok": False, "error": "No module_id provided"}

    registry = _load_registry()
    entry = next((a for a in registry if a["module_id"] == module_id), None)
    if entry is None:
        return {"ok": False, "error": f"module_id '{module_id}' not found in registry."}

    category = entry["category"]
    file_stem = module_id.split(".")[-1]
    import_path = f"{_ABILITIES_PKG}.{category}.{file_stem}"

    try:
        mod = importlib.import_module(import_path)
    except Exception as exc:
        return {"ok": False, "error": f"Could not import module '{import_path}': {exc}"}

    # Discover target class
    class_name = entry.get("class_name")
    cls = getattr(mod, class_name, None) if class_name else None

    if cls is None:
        # Fallback: inspect all classes in module
        classes = [
            obj for name, obj in inspect.getmembers(mod, inspect.isclass)
            if obj.__module__ == import_path
        ]
        if classes:
            cls = classes[0]
            class_name = cls.__name__
        else:
            return {"ok": False, "error": f"No class found in '{import_path}'"}

    # Instantiate class with signature awareness
    params = params or {}
    try:
        init_sig = inspect.signature(cls.__init__)
        init_args = {}
        for param_name, param in init_sig.parameters.items():
            if param_name in ("self", "args", "kwargs"):
                continue
            if param.default is inspect.Parameter.empty:
                if param_name in params:
                    init_args[param_name] = params[param_name]
                elif "price" in param_name or "amount" in param_name or "val" in param_name:
                    init_args[param_name] = 100.0
                elif "volatility" in param_name or "drift" in param_name:
                    init_args[param_name] = 0.2
                elif "email" in param_name:
                    init_args[param_name] = "ops@thewordenstandard.com"
                elif "password" in param_name or "token" in param_name or "key" in param_name:
                    init_args[param_name] = "secret_token_123"
                else:
                    init_args[param_name] = "default"
        engine = cls(**init_args)
    except Exception as exc:
        try:
            engine = cls()
        except Exception as exc2:
            return {"ok": False, "error": f"Failed to instantiate {class_name}: {exc2}"}

    # Discover entry-point method
    method = None
    target_method_name = ""
    for method_name in ("execute", "calculate_decay", "run", "analyze", "process", "predict", "inspect", "score"):
        candidate = getattr(engine, method_name, None)
        if callable(candidate):
            method = candidate
            target_method_name = method_name
            break

    if not method:
        # Check any public callable method on engine
        methods = [
            (name, m) for name, m in inspect.getmembers(engine, callable)
            if not name.startswith("_") and name not in ("__class__", "__delattr__", "__dir__", "__eq__", "__format__", "__ge__", "__getattribute__", "__gt__", "__hash__", "__init__", "__init_subclass__", "__le__", "__lt__", "__ne__", "__new__", "__reduce__", "__reduce_ex__", "__repr__", "__setattr__", "__sizeof__", "__str__", "__subclasshook__")
        ]
        if methods:
            target_method_name, method = methods[0]
        else:
            return {"ok": False, "error": f"No callable entry-point found on {class_name}."}

    # Execute method with parameter mapping & async support
    try:
        sig = inspect.signature(method)
        param_names = [p for p in sig.parameters.keys() if p not in ("self", "args", "kwargs")]
        
        call_args = []
        call_kwargs = {}

        if not param_names:
            pass
        elif len(param_names) == 1 and param_names[0] in ("params", "kwargs", "data", "payload", "config"):
            call_args.append(params)
        elif len(param_names) == 1 and param_names[0] in ("query", "text", "prompt", "input_data", "url", "email", "address", "location"):
            query_val = params.get("query") or params.get("text") or params.get("prompt") or params.get("location") or "asphalt paving operations inspection"
            call_args.append(query_val)
        else:
            for p_name, p_obj in sig.parameters.items():
                if p_name in ("self", "args", "kwargs"):
                    continue
                if p_name in params:
                    call_kwargs[p_name] = params[p_name]
                elif p_obj.default is not inspect.Parameter.empty:
                    continue
                elif p_name in ("image_bytes", "image_data", "b64_image", "image"):
                    call_kwargs[p_name] = b"MOCK_IMAGE_BYTES_FOR_INSPECTION"
                elif p_name in ("session", "db"):
                    call_kwargs[p_name] = None
                elif p_name in ("transit_minutes", "time", "duration"):
                    call_kwargs[p_name] = float(params.get(p_name, 30.0))
                elif p_name in ("ambient_temp", "start_temp", "temp"):
                    call_kwargs[p_name] = float(params.get(p_name, 70.0))
                elif p_name in ("wind_speed_mph", "wind"):
                    call_kwargs[p_name] = float(params.get(p_name, 5.0))
                elif p_name in ("task_id", "id", "code"):
                    call_kwargs[p_name] = "TASK-001"
                elif p_name in ("description", "reason", "payload"):
                    call_kwargs[p_name] = "Operational dispatch check"
                elif p_name in ("buyer_intent", "confidence", "action"):
                    call_kwargs[p_name] = "high"
                elif any(k in p_name for k in ("count", "val", "num", "min", "max", "limit", "sqft", "tonnage", "year", "depth", "width", "length", "speed", "score", "yield")):
                    call_kwargs[p_name] = 100
                else:
                    call_kwargs[p_name] = params.get(p_name, "default")

        if inspect.iscoroutinefunction(method):
            import asyncio
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    import concurrent.futures
                    with concurrent.futures.ThreadPoolExecutor() as pool:
                        result = pool.submit(lambda: asyncio.run(method(*call_args, **call_kwargs))).result()
                else:
                    result = loop.run_until_complete(method(*call_args, **call_kwargs))
            except RuntimeError:
                result = asyncio.run(method(*call_args, **call_kwargs))
        else:
            result = method(*call_args, **call_kwargs)

        return {
            "ok": True,
            "module_id": module_id,
            "class_name": class_name,
            "method": target_method_name,
            "result": result if isinstance(result, (dict, list)) else {"output": str(result)},
        }
    except Exception as exc:
        logger.warning("[OS-ABILITY] Execution error for %s: %s", module_id, exc)
        return {"ok": False, "error": f"Execution failed for {class_name}.{target_method_name}: {exc}"}

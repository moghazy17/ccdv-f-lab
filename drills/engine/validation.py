"""Practice-item schema and cross-field validation."""

from __future__ import annotations

import json
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml
from jsonschema import Draft202012Validator, FormatChecker

from drills.engine.blueprint import Blueprint

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_BANK_PATH = REPOSITORY_ROOT / "drills" / "bank"
SCHEMA_PATH = REPOSITORY_ROOT / "drills" / "schema.json"


@dataclass(frozen=True)
class BankItem:
    """A parsed bank item and the file that defines it."""

    path: Path
    item: dict[str, Any]


def load_schema(path: Path = SCHEMA_PATH) -> dict[str, Any]:
    """Read the versioned JSON Schema used for practice-item structure."""
    return json.loads(path.read_text(encoding="utf-8"))


def _format_error(error_path: Iterable[object], message: str) -> str:
    location = ".".join(str(part) for part in error_path) or "item"
    return f"{location}: {message}"


def item_validation_errors(item: Any, blueprint: Blueprint) -> list[str]:
    """Return JSON-Schema and blueprint-derived errors for one practice item."""
    schema_validator = Draft202012Validator(load_schema(), format_checker=FormatChecker())
    errors = [
        _format_error(error.absolute_path, error.message)
        for error in sorted(
            schema_validator.iter_errors(item), key=lambda error: list(error.absolute_path)
        )
    ]

    if not isinstance(item, Mapping):
        return errors

    domain_name = item.get("domain")
    domain = blueprint.domain(domain_name) if isinstance(domain_name, str) else None
    if isinstance(domain_name, str) and domain is None:
        errors.append(f"domain: {domain_name!r} is not defined in BLUEPRINT.md")

    sub_skill = item.get("sub_skill")
    if domain is not None and isinstance(sub_skill, str) and sub_skill not in domain.sub_skills:
        errors.append(
            f"sub_skill: {sub_skill!r} does not belong to domain {domain.name!r} in BLUEPRINT.md"
        )

    select = item.get("select")
    options = item.get("options")
    if isinstance(select, int) and not isinstance(select, bool) and isinstance(options, list):
        correct_count = sum(
            option.get("correct") is True for option in options if isinstance(option, Mapping)
        )
        if correct_count != select:
            errors.append(f"select: {select} does not equal the {correct_count} correct option(s)")

    return errors


def load_item(path: Path) -> dict[str, Any]:
    """Load one YAML item, rejecting an empty document or non-object root."""
    parsed = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(parsed, dict):
        raise ValueError("YAML document must have an object at its root")
    return parsed


def find_bank_items(bank_path: Path = DEFAULT_BANK_PATH) -> list[BankItem]:
    """Load every YAML item in deterministic path order."""
    if not bank_path.exists():
        return []

    items: list[BankItem] = []
    for path in sorted(bank_path.rglob("*.yaml")):
        try:
            items.append(BankItem(path=path, item=load_item(path)))
        except (OSError, ValueError, yaml.YAMLError) as error:
            items.append(BankItem(path=path, item={"_load_error": str(error)}))
    return items


def bank_validation_errors(
    bank_path: Path = DEFAULT_BANK_PATH, *, blueprint: Blueprint
) -> list[str]:
    """Return validation errors for every bank item, including bank-wide unique IDs."""
    errors: list[str] = []
    seen_ids: dict[str, Path] = {}

    for bank_item in find_bank_items(bank_path):
        relative_path = bank_item.path.relative_to(bank_path)
        load_error = bank_item.item.get("_load_error")
        if isinstance(load_error, str):
            errors.append(f"{relative_path}: could not load YAML: {load_error}")
            continue

        for error in item_validation_errors(bank_item.item, blueprint):
            errors.append(f"{relative_path}: {error}")

        item_id = bank_item.item.get("id")
        if isinstance(item_id, str):
            first_path = seen_ids.get(item_id)
            if first_path is None:
                seen_ids[item_id] = bank_item.path
            else:
                first_relative_path = first_path.relative_to(bank_path)
                errors.append(f"{relative_path}: id {item_id!r} duplicates {first_relative_path}")

    return errors


def require_valid_bank(bank_path: Path, blueprint: Blueprint) -> list[BankItem]:
    """Return bank items or raise one readable error containing all validation failures."""
    errors = bank_validation_errors(bank_path, blueprint=blueprint)
    if errors:
        raise ValueError("Bank validation failed:\n" + "\n".join(f"- {error}" for error in errors))
    return find_bank_items(bank_path)

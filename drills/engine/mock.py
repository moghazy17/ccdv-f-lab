"""Weighted mock generation and its portable YAML storage format."""

from __future__ import annotations

import random
from collections import defaultdict
from dataclasses import dataclass
from decimal import ROUND_FLOOR, Decimal
from pathlib import Path
from typing import Any

import yaml

from drills.engine.blueprint import Blueprint, Domain
from drills.engine.validation import BankItem

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MOCKS_PATH = REPOSITORY_ROOT / "drills" / "mocks"


@dataclass(frozen=True)
class GeneratedMock:
    """The selected items, target quotas, and explicit capacity warnings for one mock."""

    quotas: dict[str, int]
    items: tuple[dict[str, Any], ...]
    warnings: tuple[str, ...]


def apportion_items(blueprint: Blueprint, size: int) -> dict[str, int]:
    """Allocate a mock size with largest-remainder apportionment of blueprint weights."""
    if size < 1:
        raise ValueError("Mock size must be at least 1")

    total_weight = sum((domain.weight for domain in blueprint.domains), start=Decimal("0"))
    if total_weight <= 0:
        raise ValueError("Blueprint domain weights must sum to a positive value")

    exact_quotas = [
        (domain, Decimal(size) * domain.weight / total_weight) for domain in blueprint.domains
    ]
    quotas = {
        domain.name: int(exact_quota.to_integral_value(rounding=ROUND_FLOOR))
        for domain, exact_quota in exact_quotas
    }
    remaining = size - sum(quotas.values())
    remainders = sorted(
        (
            (exact_quota - quotas[domain.name], domain.number, domain.name)
            for domain, exact_quota in exact_quotas
        ),
        key=lambda remainder: (-remainder[0], remainder[1]),
    )
    for _, _, domain_name in remainders[:remaining]:
        quotas[domain_name] += 1
    return quotas


def generate_weighted_mock(
    bank_items: list[BankItem], blueprint: Blueprint, size: int, seed: int | None
) -> GeneratedMock:
    """Select unique items by quota and retain clear warnings for undersupplied domains."""
    quotas = apportion_items(blueprint, size)
    items_by_domain: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for bank_item in bank_items:
        items_by_domain[bank_item.item["domain"]].append(bank_item.item)

    randomizer = random.Random(seed)
    selected_items: list[dict[str, Any]] = []
    warnings: list[str] = []
    for domain in blueprint.domains:
        target = quotas[domain.name]
        candidates = items_by_domain[domain.name]
        selected_count = min(target, len(candidates))
        if selected_count < target:
            warnings.append(
                f"{domain.name}: need {target} item(s), but the bank has {len(candidates)}; "
                f"included {selected_count}."
            )
        selected_items.extend(randomizer.sample(candidates, selected_count))

    return GeneratedMock(quotas=quotas, items=tuple(selected_items), warnings=tuple(warnings))


def mock_id(size: int, seed: int | None) -> str:
    """Return a reproducible mock identifier when a seed is supplied."""
    return f"mock-{size}-seed-{seed}" if seed is not None else f"mock-{size}-random"


def mock_document(generated: GeneratedMock, size: int, seed: int | None) -> dict[str, Any]:
    """Create the YAML-ready mock record, embedding immutable item snapshots for scoring."""
    return {
        "format_version": 1,
        "id": mock_id(size, seed),
        "requested_size": size,
        "seed": seed,
        "quotas": generated.quotas,
        "warnings": list(generated.warnings),
        "items": list(generated.items),
    }


def default_mock_path(size: int, seed: int | None, mocks_path: Path = DEFAULT_MOCKS_PATH) -> Path:
    """Return the standard output location for a generated mock."""
    return mocks_path / f"{mock_id(size, seed)}.yaml"


def write_yaml(path: Path, document: dict[str, Any]) -> None:
    """Write a portable YAML document, creating the scoped output directory when needed."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(yaml.safe_dump(document, sort_keys=False, allow_unicode=True), encoding="utf-8")


def read_yaml(path: Path) -> dict[str, Any]:
    """Read a generated mock or completed attempt with an object document root."""
    parsed = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(parsed, dict):
        raise ValueError(f"{path} must contain a YAML object")
    return parsed


def domain_quota_difference(domain: Domain, blueprint: Blueprint, size: int, quota: int) -> Decimal:
    """Return the absolute difference from the domain's exact weighted quota."""
    total_weight = sum((entry.weight for entry in blueprint.domains), start=Decimal("0"))
    exact_quota = Decimal(size) * domain.weight / total_weight
    return abs(Decimal(quota) - exact_quota)

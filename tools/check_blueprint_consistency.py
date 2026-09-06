"""Guard the repository's blueprint-derived structure against silent drift."""

from __future__ import annotations

import argparse
import json
import sys
from decimal import Decimal
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
if str(REPOSITORY_ROOT) not in sys.path:
    sys.path.insert(0, str(REPOSITORY_ROOT))

from drills.engine.blueprint import (  # noqa: E402
    DEFAULT_BLUEPRINT_PATH,
    Blueprint,
    load_blueprint,
    parse_domains,
    parse_sub_skills,
    slugify,
)
from drills.engine.mock import apportion_items, domain_quota_difference  # noqa: E402
from drills.engine.validation import find_bank_items  # noqa: E402
from tools.export_site_data import BlueprintExportError, export_blueprint_data  # noqa: E402

_TOLERANCE = Decimal("0.000001")


class ConsistencyError(ValueError):
    """A precise first inconsistency between repository structure and the blueprint."""


def check_consistency(root: Path, blueprint_path: Path) -> None:
    """Raise ``ConsistencyError`` for the first blueprint-derived invariant that does not hold."""
    blueprint = load_blueprint(blueprint_path)
    blueprint_text = blueprint_path.read_text(encoding="utf-8")
    parsed_domains = parse_domains(blueprint_text)
    _check_weights(parsed_domains, blueprint_text)
    _check_notes(root / "notes", parsed_domains)
    _check_drills(root / "drills" / "bank", blueprint)
    _check_readme(root / "README.md", parsed_domains)
    _check_mock_quotas(blueprint)
    check_site_blueprint_data(
        blueprint_path, root / "notes", root / "site" / "src" / "data" / "blueprint.json"
    )


def check_site_blueprint_data(blueprint_path: Path, notes_path: Path, data_path: Path) -> None:
    """Require committed site data to equal a fresh export from the current blueprint."""
    if not data_path.is_file():
        raise ConsistencyError(f"Derived site blueprint data is missing: {data_path}.")
    try:
        actual = json.loads(data_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ConsistencyError(
            f"Derived site blueprint data cannot be read: {data_path}."
        ) from error
    try:
        expected = export_blueprint_data(blueprint_path, notes_path)
    except BlueprintExportError as error:
        raise ConsistencyError(
            f"Derived site blueprint data cannot be generated: {error}"
        ) from error
    if actual != expected:
        raise ConsistencyError("Derived site blueprint data is stale against BLUEPRINT.md.")


def _check_weights(parsed_domains: list[tuple[int, str, str]], blueprint_text: str) -> None:
    """Verify total domain weight and every domain's published sub-skill total."""
    domain_total = sum((_as_decimal(weight) for _, _, weight in parsed_domains), start=Decimal("0"))
    if abs(domain_total - Decimal("100.0")) > _TOLERANCE:
        raise ConsistencyError(f"Domain weights sum to {domain_total}%, expected 100.0%.")

    for number, name, weight in parsed_domains:
        sub_skill_total = sum(
            (_as_decimal(sub_weight) for _, sub_weight in parse_sub_skills(blueprint_text, number)),
            start=Decimal("0"),
        )
        domain_weight = _as_decimal(weight)
        if abs(sub_skill_total - domain_weight) > _TOLERANCE:
            raise ConsistencyError(
                f"Sub-skill weights for {name!r} sum to {sub_skill_total}%, "
                f"expected {domain_weight}%."
            )


def _as_decimal(weight: str) -> Decimal:
    """Convert the parser's percentage string without silently accepting another unit."""
    if not weight.endswith("%"):
        raise ConsistencyError(f"Blueprint weight is not a percentage: {weight!r}.")
    return Decimal(weight.removesuffix("%"))


def _check_notes(notes_path: Path, parsed_domains: list[tuple[int, str, str]]) -> None:
    """Require an exact one-to-one match between note directories and blueprint domains."""
    expected = {f"{number:02d}-{slugify(name)}" for number, name, _ in parsed_domains}
    actual = (
        {path.name for path in notes_path.iterdir() if path.is_dir()}
        if notes_path.exists()
        else set()
    )
    unexpected = sorted(actual - expected)
    if unexpected:
        raise ConsistencyError(
            f"Notes directory {unexpected[0]!r} does not match a domain in BLUEPRINT.md."
        )
    missing = sorted(expected - actual)
    if missing:
        raise ConsistencyError(f"BLUEPRINT.md domain is missing notes directory {missing[0]!r}.")


def _check_drills(bank_path: Path, blueprint: Blueprint) -> None:
    """Confirm every parsed drill uses exact domain and sub-skill strings from the blueprint."""
    for bank_item in find_bank_items(bank_path):
        relative_path = bank_item.path.relative_to(bank_path)
        load_error = bank_item.item.get("_load_error")
        if isinstance(load_error, str):
            raise ConsistencyError(f"Drill item {relative_path} could not be read: {load_error}.")
        domain_name = bank_item.item.get("domain")
        domain = blueprint.domain(domain_name) if isinstance(domain_name, str) else None
        if domain is None:
            raise ConsistencyError(
                f"Drill item {relative_path} has domain {domain_name!r}, not an exact BLUEPRINT.md "
                "domain."
            )
        sub_skill = bank_item.item.get("sub_skill")
        if not isinstance(sub_skill, str) or sub_skill not in domain.sub_skills:
            raise ConsistencyError(
                f"Drill item {relative_path} has sub_skill {sub_skill!r}, which does not belong to "
                f"{domain.name!r} in BLUEPRINT.md."
            )


def _check_readme(readme_path: Path, parsed_domains: list[tuple[int, str, str]]) -> None:
    """Compare the README exam-weight table, including order and published percentage spelling."""
    text = readme_path.read_text(encoding="utf-8")
    try:
        table = text.split("## Exam weighting", maxsplit=1)[1].split("##", maxsplit=1)[0]
    except IndexError as error:
        raise ConsistencyError("README.md has no 'Exam weighting' table.") from error

    rows: list[tuple[int, str, str]] = []
    for line in table.splitlines():
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if len(cells) < 3 or not cells[0].isdigit():
            continue
        rows.append((int(cells[0]), cells[1], cells[2]))

    if rows != parsed_domains:
        for index, expected in enumerate(parsed_domains):
            actual = rows[index] if index < len(rows) else None
            if actual != expected:
                raise ConsistencyError(
                    f"README.md exam-weight row {index + 1} is {actual!r}, expected {expected!r} "
                    "from BLUEPRINT.md."
                )
        raise ConsistencyError(
            f"README.md exam-weight table has {len(rows)} domain rows, "
            f"expected {len(parsed_domains)} from BLUEPRINT.md."
        )


def _check_mock_quotas(blueprint: Blueprint) -> None:
    """Ensure the engine's representative 53-item allocation stays within one item per domain."""
    quotas = apportion_items(blueprint, blueprint.exam_item_count)
    if sum(quotas.values()) != blueprint.exam_item_count:
        raise ConsistencyError(
            f"Generated mock quotas total {sum(quotas.values())}, expected "
            f"{blueprint.exam_item_count} items."
        )
    for domain in blueprint.domains:
        difference = domain_quota_difference(
            domain, blueprint, blueprint.exam_item_count, quotas[domain.name]
        )
        if difference > Decimal("1"):
            raise ConsistencyError(
                f"Generated mock quota for {domain.name!r} differs from its blueprint weight by "
                f"{difference} item(s), exceeding one item."
            )


def main(argv: list[str] | None = None) -> int:
    """Run the anti-drift gate and return a shell-compatible status."""
    parser = argparse.ArgumentParser(description="Check blueprint-derived repository consistency.")
    parser.add_argument("--root", type=Path, default=REPOSITORY_ROOT)
    parser.add_argument("--blueprint", type=Path, default=DEFAULT_BLUEPRINT_PATH)
    arguments = parser.parse_args(argv)
    try:
        check_consistency(arguments.root.resolve(), arguments.blueprint.resolve())
    except (ConsistencyError, OSError, ValueError) as error:
        print(f"Blueprint consistency check failed: {error}")
        return 1
    print("Blueprint consistency check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

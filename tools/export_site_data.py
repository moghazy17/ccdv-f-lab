"""Export the study site's immutable blueprint data from the repository source of truth."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from decimal import ROUND_FLOOR, Decimal
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
_DOMAIN_ROW = re.compile(r"^\|\s*(\d+)\s*\|\s*(.*?)\s*\|\s*(\d+(?:\.\d+)?)%\s*\|\s*~(\d+)\s*\|$")
_SUB_SKILL_ROW = re.compile(
    r"^\|\s*(.*?)\s*\|\s*(\d+(?:\.\d+)?)%\s*\|\s*~(\d+(?:\.\d+)?)\s*\|\s*(.*?)\s*\|$"
)
_DOMAIN_HEADING = re.compile(r"^### Domain (\d+) ")


class BlueprintExportError(ValueError):
    """The published blueprint cannot be safely exported into the site artifact."""


def export_blueprint_data(blueprint_path: Path, notes_path: Path) -> dict[str, object]:
    """Return validated site data parsed from ``BLUEPRINT.md`` and matching note directories."""
    source = blueprint_path.read_bytes()
    text = source.decode("utf-8")
    exam_facts = _parse_exam_facts(text)
    domains = _parse_domains(text, exam_facts["items"])
    _validate_domains(domains, notes_path, exam_facts["items"])

    return {
        # Hash the newline-normalized text, not the raw bytes. A CRLF checkout on Windows and an
        # LF one on a Linux runner hold the same blueprint, and a byte hash would call them stale.
        "sourceDigest": hashlib.sha256(text.replace("\r\n", "\n").encode("utf-8")).hexdigest(),
        "generatedFrom": "BLUEPRINT.md",
        "examFacts": exam_facts,
        "domains": domains,
    }


def write_blueprint_data(blueprint_path: Path, notes_path: Path, output_path: Path) -> None:
    """Generate deterministic UTF-8 JSON for the site without hand-editing derived data."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(export_blueprint_data(blueprint_path, notes_path), ensure_ascii=False, indent=2)
        + "\n",
        encoding="utf-8",
    )


def _parse_domains(text: str, mock_item_total: int) -> list[dict[str, object]]:
    """Parse domains in their published order and attach their published sub-skills."""
    rows: list[tuple[int, str, Decimal, int]] = []
    for line in _domain_table(text):
        match = _DOMAIN_ROW.fullmatch(line.replace("**", ""))
        if match is None:
            continue
        number, name, weight, approximate_items = match.groups()
        rows.append((int(number), _plain_text(name), Decimal(weight), int(approximate_items)))

    if len(rows) != 8:
        raise BlueprintExportError(f"Expected 8 domain rows in BLUEPRINT.md, found {len(rows)}.")

    domains: list[dict[str, object]] = []
    for number, name, weight, approximate_items in rows:
        domains.append(
            {
                "number": number,
                "slug": f"{number:02d}-{_slugify(name)}",
                "name": name,
                "weight": float(weight),
                "approximateItems": approximate_items,
                "mockItems": 0,
                "subSkills": _parse_sub_skills(text, number),
            }
        )

    for domain, mock_items in zip(
        domains, _largest_remainder(domains, mock_item_total), strict=True
    ):
        domain["mockItems"] = mock_items
    return domains


def _domain_table(text: str) -> list[str]:
    """Extract only the published domain table, excluding later allocation tables."""
    try:
        section = text.split("## Domains", maxsplit=1)[1].split("## Sub-skills", maxsplit=1)[0]
    except IndexError as error:
        raise BlueprintExportError("BLUEPRINT.md has no complete Domains section.") from error
    return section.splitlines()


def _parse_sub_skills(text: str, domain_number: int) -> list[dict[str, object]]:
    """Read the published sub-skill table for one domain without recomputing item counts."""
    lines = text.splitlines()
    section_lines: list[str] = []
    collecting = False
    for line in lines:
        heading = _DOMAIN_HEADING.match(line)
        if heading:
            if collecting:
                break
            collecting = int(heading.group(1)) == domain_number
            continue
        if collecting:
            section_lines.append(line)

    if not section_lines:
        raise BlueprintExportError(
            f"BLUEPRINT.md has no sub-skill section for domain {domain_number}."
        )

    sub_skills: list[dict[str, object]] = []
    for line in section_lines:
        match = _SUB_SKILL_ROW.fullmatch(line.replace("**", ""))
        if match is None:
            continue
        name, weight, approximate_items, measured = match.groups()
        sub_skills.append(
            {
                "name": _plain_text(name),
                "weight": float(Decimal(weight)),
                "approximateItems": float(Decimal(approximate_items)),
                "measured": _plain_text(measured),
            }
        )
    if not sub_skills:
        raise BlueprintExportError(
            f"BLUEPRINT.md has no sub-skill rows for domain {domain_number}."
        )
    return sub_skills


def _parse_exam_facts(text: str) -> dict[str, int]:
    """Read only the exam facts that the site contract exposes."""
    facts = {
        "items": _fact_number(text, "Items"),
        "timeLimitMinutes": _fact_number(text, "Time limit"),
        "passingScore": _fact_number(text, "Passing score"),
        "feeUsd": _fact_number(text, "Fee"),
        "validityMonths": _fact_number(text, "Validity"),
    }
    scale_match = re.search(r"scaled range of \*\*(\d+)[–-](\d+)\*\*", text)
    if scale_match is None:
        raise BlueprintExportError("BLUEPRINT.md has no published scaled score range.")
    facts["scaleMin"] = int(scale_match.group(1))
    facts["scaleMax"] = int(scale_match.group(2))
    return facts


def _fact_number(text: str, label: str) -> int:
    """Read the leading published integer from one fact-table value."""
    match = re.search(rf"^\| {re.escape(label)} \| \*\*\$?(\d+)", text, re.MULTILINE)
    if match is None:
        raise BlueprintExportError(f"BLUEPRINT.md has no numeric {label!r} fact.")
    return int(match.group(1))


def _largest_remainder(domains: list[dict[str, object]], total_item_count: int) -> list[int]:
    """Allocate the published item total using stable largest-remainder apportionment."""
    total_items = Decimal(total_item_count)
    quotas = [Decimal(str(domain["weight"])) * total_items / Decimal("100") for domain in domains]
    allocation = [int(quota.to_integral_value(rounding=ROUND_FLOOR)) for quota in quotas]
    remainder_count = int(total_items) - sum(allocation)
    ranked = sorted(range(len(quotas)), key=lambda index: (-_fraction(quotas[index]), index))
    for index in ranked[:remainder_count]:
        allocation[index] += 1
    return allocation


def _fraction(value: Decimal) -> Decimal:
    """Return the fractional part used to rank a quota."""
    return value - value.to_integral_value(rounding=ROUND_FLOOR)


def _validate_domains(
    domains: list[dict[str, object]], notes_path: Path, mock_item_total: int
) -> None:
    """Reject structural or arithmetic drift before it reaches the generated artifact."""
    weights = sum((Decimal(str(domain["weight"])) for domain in domains), start=Decimal("0"))
    if weights != Decimal("100.0"):
        raise BlueprintExportError(f"Domain weights sum to {weights}, expected 100.0.")
    if sum(int(domain["mockItems"]) for domain in domains) != mock_item_total:
        raise BlueprintExportError(
            "Largest-remainder allocation does not sum to the published item count "
            f"{mock_item_total}."
        )
    if sum(len(domain["subSkills"]) for domain in domains) != 25:
        raise BlueprintExportError("Expected 25 sub-skills in BLUEPRINT.md.")

    expected = {str(domain["slug"]) for domain in domains}
    actual = (
        {path.name for path in notes_path.iterdir() if path.is_dir()}
        if notes_path.exists()
        else set()
    )
    missing = sorted(expected - actual)
    unexpected = sorted(actual - expected)
    if missing:
        raise BlueprintExportError(f"BLUEPRINT.md domain has no notes directory: {missing[0]}.")
    if unexpected:
        raise BlueprintExportError(f"Notes directory has no BLUEPRINT.md domain: {unexpected[0]}.")


def _plain_text(value: str) -> str:
    """Remove Markdown emphasis markers while retaining the published visible wording."""
    return value.strip().replace("**", "").replace("`", "")


def _slugify(name: str) -> str:
    """Derive the repository's ASCII directory slug from an exact domain name."""
    return re.sub(r"[^a-z0-9]+", "-", name.casefold()).strip("-")


def main(argv: list[str] | None = None) -> int:
    """Write the generated site data and return a shell-compatible status."""
    parser = argparse.ArgumentParser(description="Export BLUEPRINT.md into site blueprint data.")
    parser.add_argument("--blueprint", type=Path, default=REPOSITORY_ROOT / "BLUEPRINT.md")
    parser.add_argument("--notes", type=Path, default=REPOSITORY_ROOT / "notes")
    parser.add_argument(
        "--output", type=Path, default=REPOSITORY_ROOT / "site" / "src" / "data" / "blueprint.json"
    )
    arguments = parser.parse_args(argv)
    try:
        write_blueprint_data(
            arguments.blueprint.resolve(), arguments.notes.resolve(), arguments.output.resolve()
        )
    except (BlueprintExportError, OSError, UnicodeDecodeError) as error:
        print(f"Blueprint site-data export failed: {error}")
        return 1
    print(f"Wrote {arguments.output}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

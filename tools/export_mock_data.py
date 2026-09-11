"""Export the mock exam's size, time limit, and per-domain quotas for the study site.

The site never computes an apportionment. This tool imports the repository's own
``drills.engine.mock.apportion_items`` and writes what it returns, so the site's quotas *are* the
drill engine's rather than a second implementation of the same arithmetic (FR-024).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
if str(REPOSITORY_ROOT) not in sys.path:
    sys.path.insert(0, str(REPOSITORY_ROOT))

from drills.engine.blueprint import load_blueprint  # noqa: E402
from drills.engine.mock import apportion_items  # noqa: E402


class MockDataExportError(ValueError):
    """The published blueprint cannot be safely exported into the site's mock data."""


def export_mock_data(blueprint_path: Path) -> dict[str, object]:
    """Return the site's mock contract, every figure derived from ``BLUEPRINT.md``."""
    text = blueprint_path.read_text(encoding="utf-8")
    blueprint = load_blueprint(blueprint_path)

    full_mock_size = blueprint.exam_item_count
    quotas = apportion_items(blueprint, full_mock_size)
    if sum(quotas.values()) != full_mock_size:
        raise MockDataExportError(
            f"Apportioned quotas sum to {sum(quotas.values())}, expected {full_mock_size}."
        )
    if {domain.name for domain in blueprint.domains} != set(quotas):
        raise MockDataExportError("Apportioned quotas do not cover every blueprint domain.")

    return {
        # The same digest discipline as blueprint.json: hash the newline-normalized text so a CRLF
        # working copy and an LF checkout agree.
        "sourceDigest": hashlib.sha256(text.replace("\r\n", "\n").encode("utf-8")).hexdigest(),
        "generatedFrom": "BLUEPRINT.md",
        "fullMockSize": full_mock_size,
        "timeLimitMinutes": blueprint.time_limit_minutes,
        "passingScore": blueprint.passing_score,
        "scaleMinimum": blueprint.scale_minimum,
        "scaleMaximum": blueprint.scale_maximum,
        # Emitted in published domain order so the file is stable across regenerations.
        "quotas": {domain.name: quotas[domain.name] for domain in blueprint.domains},
    }


def write_mock_data(blueprint_path: Path, output_path: Path) -> None:
    """Write deterministic UTF-8 JSON the site reads at build time."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(export_mock_data(blueprint_path), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main(argv: list[str] | None = None) -> int:
    """Write the generated mock data and return a shell-compatible status."""
    parser = argparse.ArgumentParser(description="Export BLUEPRINT.md into site mock data.")
    parser.add_argument("--blueprint", type=Path, default=REPOSITORY_ROOT / "BLUEPRINT.md")
    parser.add_argument(
        "--output", type=Path, default=REPOSITORY_ROOT / "site" / "src" / "data" / "mock.json"
    )
    arguments = parser.parse_args(argv)
    try:
        write_mock_data(arguments.blueprint.resolve(), arguments.output.resolve())
    except (MockDataExportError, ValueError, OSError, UnicodeDecodeError) as error:
        print(f"Mock site-data export failed: {error}")
        return 1
    print(f"Wrote {arguments.output}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

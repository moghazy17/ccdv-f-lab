"""Export the practice-item bank into the shape the study site reads at build time.

The export runs the repository's own bank validation first, so a malformed item blocks publication
rather than reaching a candidate (FR-021). Items flagged ``format_demonstration`` are dropped here,
which is what keeps them out of every learner-facing surface without each surface having to
remember (FR-022).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
if str(REPOSITORY_ROOT) not in sys.path:
    sys.path.insert(0, str(REPOSITORY_ROOT))

from drills.engine.blueprint import DEFAULT_BLUEPRINT_PATH, load_blueprint  # noqa: E402
from drills.engine.validation import (  # noqa: E402
    DEFAULT_BANK_PATH,
    BankItem,
    require_valid_bank,
)


class ItemBankExportError(ValueError):
    """The bank cannot be safely exported into the site artifact."""


def is_format_demonstration(item: dict[str, Any]) -> bool:
    """Whether this item exists to show the format and must reach no learner surface."""
    return item.get("format_demonstration") is True


def export_item_bank(bank_path: Path, blueprint_path: Path) -> dict[str, object]:
    """Return the validated bank as site data, excluding every format demonstration."""
    blueprint = load_blueprint(blueprint_path)
    bank_items = require_valid_bank(bank_path, blueprint)

    published = [
        bank_item for bank_item in bank_items if not is_format_demonstration(bank_item.item)
    ]
    available = {domain.name: 0 for domain in blueprint.domains}
    for bank_item in published:
        domain_name = bank_item.item["domain"]
        if domain_name not in available:
            raise ItemBankExportError(f"Item {bank_item.item['id']!r} names an unknown domain.")
        available[domain_name] += 1

    return {
        "generatedFrom": "drills/bank/",
        "available": available,
        "items": [_export_item(bank_item) for bank_item in published],
    }


def _export_item(bank_item: BankItem) -> dict[str, object]:
    """Convert one validated item to the site's camel-cased shape."""
    item = bank_item.item
    return {
        "id": item["id"],
        "domain": item["domain"],
        "subSkill": item["sub_skill"],
        "difficulty": item["difficulty"],
        "select": item["select"],
        "stem": item["stem"],
        "options": [_export_option(option) for option in item["options"]],
        "sources": [
            {
                "title": source["title"],
                "url": source["url"],
                "verifiedOn": source["verified_on"],
            }
            for source in item["sources"]
        ],
    }


def _export_option(option: dict[str, Any]) -> dict[str, object]:
    """Convert one option, carrying its trap type only where the schema allows one."""
    exported: dict[str, object] = {
        "id": option["id"],
        "text": option["text"],
        "correct": option["correct"],
        "rationale": option["rationale"],
    }
    if "trap_type" in option:
        exported["trapType"] = option["trap_type"]
    return exported


def write_item_bank(bank_path: Path, blueprint_path: Path, output_path: Path) -> None:
    """Write deterministic UTF-8 JSON the site reads at build time."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(export_item_bank(bank_path, blueprint_path), ensure_ascii=False, indent=2)
        + "\n",
        encoding="utf-8",
    )


def main(argv: list[str] | None = None) -> int:
    """Write the generated item bank and return a shell-compatible status."""
    parser = argparse.ArgumentParser(description="Export drills/bank into site item data.")
    parser.add_argument("--bank", type=Path, default=DEFAULT_BANK_PATH)
    parser.add_argument("--blueprint", type=Path, default=DEFAULT_BLUEPRINT_PATH)
    parser.add_argument(
        "--output", type=Path, default=REPOSITORY_ROOT / "site" / "src" / "data" / "items.json"
    )
    arguments = parser.parse_args(argv)
    try:
        write_item_bank(
            arguments.bank.resolve(), arguments.blueprint.resolve(), arguments.output.resolve()
        )
    except (ItemBankExportError, ValueError, OSError, UnicodeDecodeError) as error:
        print(f"Item bank export failed: {error}")
        return 1
    print(f"Wrote {arguments.output}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

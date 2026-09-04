"""Command-line entry point for the CCDV-F drill engine."""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any

import yaml

from drills.engine.blueprint import DEFAULT_BLUEPRINT_PATH, load_blueprint
from drills.engine.mock import (
    DEFAULT_MOCKS_PATH,
    default_mock_path,
    generate_weighted_mock,
    mock_document,
    read_yaml,
    write_yaml,
)
from drills.engine.scoring import format_score_report, score_attempt
from drills.engine.validation import (
    DEFAULT_BANK_PATH,
    bank_validation_errors,
    require_valid_bank,
)


def _path_argument(value: str) -> Path:
    return Path(value)


def build_parser() -> argparse.ArgumentParser:
    """Build the public command-line interface."""
    parser = argparse.ArgumentParser(
        description="Validate, generate, take, and score CCDV-F drills."
    )
    subcommands = parser.add_subparsers(dest="command", required=True)

    validate = subcommands.add_parser("validate", help="Validate every item in the drill bank.")
    validate.add_argument("--bank", type=_path_argument, default=DEFAULT_BANK_PATH)
    validate.add_argument("--blueprint", type=_path_argument, default=DEFAULT_BLUEPRINT_PATH)

    generate = subcommands.add_parser("generate", help="Build a weighted mock from the drill bank.")
    generate.add_argument("--seed", type=int, help="Seed item selection for reproducible mocks.")
    generate.add_argument(
        "--size", type=int, help="Mock size; default is the blueprint exam item count."
    )
    generate.add_argument("--bank", type=_path_argument, default=DEFAULT_BANK_PATH)
    generate.add_argument("--mocks-dir", type=_path_argument, default=DEFAULT_MOCKS_PATH)
    generate.add_argument("--output", type=_path_argument, help="Override the generated mock path.")
    generate.add_argument("--blueprint", type=_path_argument, default=DEFAULT_BLUEPRINT_PATH)

    take = subcommands.add_parser("take", help="Run a generated mock in the terminal.")
    take.add_argument("mock", type=_path_argument, help="Path to the generated mock YAML file.")
    take.add_argument(
        "--output", type=_path_argument, help="Path for the completed attempt YAML file."
    )

    score = subcommands.add_parser("score", help="Score a completed attempt and print its report.")
    score.add_argument(
        "attempt", type=_path_argument, help="Path to the completed attempt YAML file."
    )
    score.add_argument(
        "--mock", type=_path_argument, help="Override the mock path stored in the attempt."
    )
    score.add_argument(
        "--score-anchor",
        "--cut-score",
        type=int,
        dest="score_anchor",
        help="Scaled-score comparison anchor; default is the passing score in BLUEPRINT.md.",
    )
    score.add_argument("--blueprint", type=_path_argument, default=DEFAULT_BLUEPRINT_PATH)
    return parser


def _take_mock(mock_path: Path, output_path: Path | None) -> Path:
    mock = read_yaml(mock_path)
    items = mock.get("items")
    if not isinstance(items, list):
        raise ValueError("Mock has no item list")

    answers: list[dict[str, Any]] = []
    for item_number, item in enumerate(items, start=1):
        if not isinstance(item, dict):
            raise ValueError("Mock contains a non-object item")
        item_id = item.get("id")
        options = item.get("options")
        select = item.get("select")
        if (
            not isinstance(item_id, str)
            or not isinstance(options, list)
            or not isinstance(select, int)
        ):
            raise ValueError("Mock contains an incomplete item")

        print(f"\n{item_number}. {item.get('stem', '')}")
        option_ids: set[str] = set()
        for option in options:
            if not isinstance(option, dict) or not isinstance(option.get("id"), str):
                raise ValueError(f"Mock item {item_id!r} has an invalid option")
            option_ids.add(option["id"])
            print(f"  {option['id']}. {option.get('text', '')}")

        while True:
            raw_answer = input(f"Select {select} option ID(s), separated by commas: ").strip()
            selected = [answer.strip() for answer in raw_answer.split(",") if answer.strip()]
            if (
                len(selected) == select
                and len(set(selected)) == select
                and set(selected) <= option_ids
            ):
                break
            print(f"Enter exactly {select} distinct listed option ID(s).")
        answers.append({"item_id": item_id, "selected_option_ids": selected})

    destination = output_path or mock_path.with_name(f"{mock_path.stem}-attempt.yaml")
    write_yaml(
        destination,
        {
            "format_version": 1,
            "mock_id": mock.get("id"),
            "mock_path": str(mock_path),
            "answers": answers,
        },
    )
    return destination


def _score_attempt(
    attempt_path: Path, mock_path: Path | None, score_anchor: int | None, blueprint_path: Path
) -> str:
    attempt = read_yaml(attempt_path)
    stored_mock_path = attempt.get("mock_path")
    source_path = mock_path or (
        Path(stored_mock_path) if isinstance(stored_mock_path, str) else None
    )
    if source_path is None:
        raise ValueError("Attempt does not record a mock_path; provide --mock")
    report = score_attempt(
        read_yaml(source_path),
        attempt,
        load_blueprint(blueprint_path),
        score_anchor=score_anchor,
    )
    return format_score_report(report)


def main(argv: list[str] | None = None) -> int:
    """Run a drill-engine command and return a shell-compatible exit status."""
    args = build_parser().parse_args(argv)
    try:
        if args.command == "validate":
            errors = bank_validation_errors(args.bank, blueprint=load_blueprint(args.blueprint))
            if errors:
                print("Validation failed:")
                print("\n".join(f"- {error}" for error in errors))
                return 1
            item_count = len(require_valid_bank(args.bank, load_blueprint(args.blueprint)))
            print(f"Validated {item_count} item(s).")
            return 0

        if args.command == "generate":
            blueprint = load_blueprint(args.blueprint)
            size = blueprint.exam_item_count if args.size is None else args.size
            bank_items = require_valid_bank(args.bank, blueprint)
            generated = generate_weighted_mock(bank_items, blueprint, size, args.seed)
            destination = args.output or default_mock_path(size, args.seed, args.mocks_dir)
            write_yaml(destination, mock_document(generated, size, args.seed))
            print(f"Generated {len(generated.items)}/{size} item(s): {destination}")
            for warning in generated.warnings:
                print(f"Warning: {warning}")
            return 0

        if args.command == "take":
            destination = _take_mock(args.mock, args.output)
            print(f"Saved attempt: {destination}")
            return 0

        if args.command == "score":
            print(_score_attempt(args.attempt, args.mock, args.score_anchor, args.blueprint))
            return 0
    except (OSError, ValueError, yaml.YAMLError) as error:
        print(f"Error: {error}")
        return 1
    raise AssertionError(f"Unhandled command: {args.command}")


if __name__ == "__main__":
    raise SystemExit(main())

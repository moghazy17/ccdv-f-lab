"""Generate the scoring fixtures the site's TypeScript scorer is pinned against.

`site/src/lib/scoring.ts` exists because scoring has to run in the browser as a candidate answers,
and the mock exam deliberately carries no Python runtime (plan.md, Complexity Tracking). That is a
second implementation of one closed rule, so it is pinned rather than trusted: this module computes
every case with `drills/engine/scoring.py` and writes the answers to a committed fixture, and it
fails if the committed file has drifted from what the engine now produces. The Vitest in
`site/tests/unit/scoring.test.ts` replays the same cases through the TypeScript.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from drills.engine.blueprint import load_blueprint
from drills.engine.scoring import (
    READINESS_DOMAIN_FRACTION,
    READINESS_OVERALL_FRACTION,
    ScoreReport,
    score_attempt,
)

ROOT = Path(__file__).resolve().parents[1]
BLUEPRINT_PATH = ROOT / "BLUEPRINT.md"
FIXTURE_PATH = ROOT / "site" / "tests" / "fixtures" / "scoring-cases.json"

#: Two named domains exercise per-domain tallies and the unassessed-domain rule; a case covering
#: every domain exercises readiness. All names are read from the blueprint rather than typed.
_BLUEPRINT = load_blueprint(BLUEPRINT_PATH)
_FIRST_DOMAIN = _BLUEPRINT.domains[0].name
_SECOND_DOMAIN = _BLUEPRINT.domains[1].name


def _item(item_id: str, domain: str, correct_option_ids: tuple[str, ...]) -> dict[str, Any]:
    """One four-option item whose correct set is exactly ``correct_option_ids``."""
    return {
        "id": item_id,
        "domain": domain,
        "options": [
            {"id": option_id, "correct": option_id in correct_option_ids}
            for option_id in ("a", "b", "c", "d")
        ],
    }


def _answer(item_id: str, selected: tuple[str, ...]) -> dict[str, Any]:
    return {"item_id": item_id, "selected_option_ids": list(selected)}


def build_cases() -> list[dict[str, Any]]:
    """Return the scoring cases both implementations must agree on."""
    single = [
        _item("s1", _FIRST_DOMAIN, ("a",)),
        _item("s2", _FIRST_DOMAIN, ("b",)),
        _item("s3", _SECOND_DOMAIN, ("c",)),
    ]
    multi = [
        _item("m1", _FIRST_DOMAIN, ("a", "c")),
        _item("m2", _SECOND_DOMAIN, ("b", "d")),
    ]
    # Readiness is withheld while any domain is unassessed, so only a mock that touches every
    # blueprint domain can demonstrate it.
    every_domain = [
        _item(f"d{index}", domain.name, ("a",))
        for index, domain in enumerate(_BLUEPRINT.domains, start=1)
    ]

    return [
        {
            "name": "every blueprint domain assessed and answered correctly",
            "mock": {"items": every_domain},
            "attempt": {"answers": [_answer(item["id"], ("a",)) for item in every_domain]},
        },
        {
            "name": "every domain assessed but one answered wrongly",
            "mock": {"items": every_domain},
            "attempt": {
                "answers": [
                    _answer(item["id"], ("a",) if index > 0 else ("b",))
                    for index, item in enumerate(every_domain)
                ]
            },
        },
        {
            "name": "every answer correct in every assessed domain",
            "mock": {"items": single},
            "attempt": {
                "answers": [_answer("s1", ("a",)), _answer("s2", ("b",)), _answer("s3", ("c",))]
            },
        },
        {
            "name": "one domain below the per-domain bar",
            "mock": {"items": single},
            "attempt": {
                "answers": [_answer("s1", ("a",)), _answer("s2", ("b",)), _answer("s3", ("a",))]
            },
        },
        {
            "name": "a multi-select item needs the exact set, so a subset is wrong",
            "mock": {"items": multi},
            "attempt": {"answers": [_answer("m1", ("a",)), _answer("m2", ("b", "d"))]},
        },
        {
            "name": "a multi-select item with a superset selected is wrong",
            "mock": {"items": multi},
            "attempt": {"answers": [_answer("m1", ("a", "c", "d")), _answer("m2", ("b", "d"))]},
        },
        {
            "name": "an unanswered item counts as wrong rather than as unassessed",
            "mock": {"items": single},
            "attempt": {"answers": [_answer("s1", ("a",))]},
        },
        {
            "name": "no answers at all",
            "mock": {"items": single},
            "attempt": {"answers": []},
        },
        {
            "name": "an empty mock scores zero without dividing by zero",
            "mock": {"items": []},
            "attempt": {"answers": []},
        },
    ]


def _expected(report: ScoreReport) -> dict[str, Any]:
    """Convert one engine report into the camel-cased shape the site's scorer returns."""
    return {
        "correct": report.correct,
        "itemCount": report.item_count,
        "fractionCorrect": report.fraction_correct,
        "domains": [
            {"name": domain.name, "correct": domain.correct, "itemCount": domain.item_count}
            for domain in report.domains
        ],
        "estimatedScaledScore": report.estimated_scaled_score,
        "scoreAnchor": report.score_anchor,
        "scaleMinimum": report.scale_minimum,
        "scaleMaximum": report.scale_maximum,
        "unassessedDomains": list(report.unassessed_domains),
        "lowDomains": list(report.low_domains),
        "ready": report.ready,
    }


def build_fixture() -> dict[str, Any]:
    """Score every case with the repository's engine and return the fixture document."""
    return {
        "generatedFrom": "drills/engine/scoring.py",
        "readiness": {
            "overallFraction": READINESS_OVERALL_FRACTION,
            "domainFraction": READINESS_DOMAIN_FRACTION,
        },
        "domainNames": [domain.name for domain in _BLUEPRINT.domains],
        "scale": {
            "minimum": _BLUEPRINT.scale_minimum,
            "maximum": _BLUEPRINT.scale_maximum,
            "passingScore": _BLUEPRINT.passing_score,
        },
        "cases": [
            {
                "name": case["name"],
                "mock": case["mock"],
                "attempt": case["attempt"],
                "expected": _expected(score_attempt(case["mock"], case["attempt"], _BLUEPRINT)),
            }
            for case in build_cases()
        ],
    }


def _serialise(fixture: dict[str, Any]) -> str:
    return json.dumps(fixture, ensure_ascii=False, indent=2) + "\n"


def test_scoring_fixture_is_current() -> None:
    """Regenerating must be a no-op; if it is not, the committed fixture has drifted."""
    expected = _serialise(build_fixture())
    if not FIXTURE_PATH.exists() or FIXTURE_PATH.read_text(encoding="utf-8") != expected:
        FIXTURE_PATH.parent.mkdir(parents=True, exist_ok=True)
        FIXTURE_PATH.write_text(expected, encoding="utf-8")
        raise AssertionError(
            f"{FIXTURE_PATH.relative_to(ROOT)} was stale and has been regenerated. "
            "Re-run the site's unit tests and commit the updated fixture."
        )


def test_fixture_covers_the_behaviour_the_typescript_must_reproduce() -> None:
    """The cases are not decorative: each distinguishing rule has at least one case."""
    fixture = build_fixture()
    expectations = [case["expected"] for case in fixture["cases"]]

    assert any(case["ready"] for case in expectations), "No case demonstrates readiness."
    assert any(case["lowDomains"] for case in expectations), "No case has a low domain."
    assert any(case["unassessedDomains"] for case in expectations), (
        "No case has an unassessed domain."
    )
    assert any(case["correct"] < case["itemCount"] for case in expectations)
    assert {domain["name"] for case in expectations for domain in case["domains"]} == set(
        fixture["domainNames"]
    )


def test_exact_set_matching_is_what_the_engine_does() -> None:
    """A subset and a superset of the correct options are both wrong, not partially right."""
    fixture = build_fixture()
    by_name = {case["name"]: case["expected"] for case in fixture["cases"]}

    subset = by_name["a multi-select item needs the exact set, so a subset is wrong"]
    superset = by_name["a multi-select item with a superset selected is wrong"]

    assert subset["correct"] == 1
    assert superset["correct"] == 1

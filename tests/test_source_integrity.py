"""The source-record parser reads rows a line at a time, and both failure kinds are reported."""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

from tools.check_source_integrity import (
    SourceIntegrityError,
    check_source_integrity,
    citation_problems,
    read_source_record,
)

RECORD = """# Sources

## Primary — the technology

| Source | What it establishes | Verified |
|---|---|---|
| [Models overview][models] — Anthropic | The lineup and its pricing | 2026-09-05 |
| [Streaming][streaming] — Anthropic | That a long request streams | 2026-09-09 |
| [Errors](https://example.test/errors) — Anthropic | The HTTP error taxonomy | 2026-09-09 |

## Primary — this repository

| Source | What it establishes | Verified |
|---|---|---|
| [`lab/output.py`][lab-output] — this repository | How validation routes to a person | 2026-09-17 |

[models]: https://example.test/models
[streaming]: https://example.test/streaming
[lab-output]: https://example.test/lab/output.py
"""


def _write_item(bank: Path, item_id: str, sources: list[dict[str, str]]) -> Path:
    path = bank / "01-agents-and-workflows" / f"{item_id}.yaml"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        yaml.safe_dump(
            {
                "id": item_id,
                "domain": "Agents and Workflows",
                "sub_skill": "Agent Architecture",
                "difficulty": "application",
                "select": 1,
                "stem": "A stem.",
                "options": [],
                "sources": sources,
            },
            sort_keys=False,
        ),
        encoding="utf-8",
    )
    return path


@pytest.fixture
def record(tmp_path: Path) -> Path:
    path = tmp_path / "SOURCES.md"
    path.write_text(RECORD, encoding="utf-8")
    return path


def test_every_row_is_read_rather_than_swallowed_by_its_neighbour(record: Path):
    """A whole-document match loses rows to a neighbour; a line-at-a-time read does not."""
    parsed = read_source_record(record)

    assert parsed == {
        "https://example.test/models": "2026-09-05",
        "https://example.test/streaming": "2026-09-09",
        "https://example.test/errors": "2026-09-09",
        "https://example.test/lab/output.py": "2026-09-17",
    }


def test_reference_and_inline_citations_both_resolve(record: Path):
    parsed = read_source_record(record)

    assert "https://example.test/models" in parsed
    assert "https://example.test/errors" in parsed


def test_the_separator_row_contributes_nothing(record: Path):
    assert all(url.startswith("https://") for url in read_source_record(record))


def test_a_citation_with_no_row_is_reported(tmp_path: Path, record: Path):
    bank = tmp_path / "bank"
    _write_item(
        bank,
        "unrecorded-citation",
        [{"title": "Nowhere", "url": "https://example.test/absent", "verified_on": "2026-09-17"}],
    )

    problems = citation_problems(bank, record)

    assert len(problems) == 1
    assert "has no row in SOURCES.md" in problems[0].message
    assert "https://example.test/absent" in problems[0].message


def test_an_item_claiming_a_check_older_than_the_record_is_reported(tmp_path: Path, record: Path):
    bank = tmp_path / "bank"
    _write_item(
        bank,
        "stale-citation",
        [
            {
                "title": "Repo file",
                "url": "https://example.test/lab/output.py",
                "verified_on": "2026-09-01",
            }
        ],
    )

    problems = citation_problems(bank, record)

    assert len(problems) == 1
    assert "is earlier than the SOURCES.md row's" in problems[0].message


def test_reading_a_page_more_recently_than_the_record_is_fine(tmp_path: Path, record: Path):
    bank = tmp_path / "bank"
    _write_item(
        bank,
        "freshly-read-citation",
        [{"title": "Models", "url": "https://example.test/models", "verified_on": "2026-09-17"}],
    )

    assert citation_problems(bank, record) == []


def test_each_unsupported_citation_of_a_multi_source_item_is_reported(tmp_path: Path, record: Path):
    bank = tmp_path / "bank"
    _write_item(
        bank,
        "two-citations-one-unrecorded",
        [
            {"title": "Models", "url": "https://example.test/models", "verified_on": "2026-09-17"},
            {"title": "Absent", "url": "https://example.test/absent", "verified_on": "2026-09-17"},
        ],
    )

    problems = citation_problems(bank, record)

    assert len(problems) == 1
    assert "https://example.test/absent" in problems[0].message


def test_the_failure_names_the_item_file(tmp_path: Path, record: Path):
    bank = tmp_path / "bank"
    path = _write_item(
        bank,
        "named-in-the-failure",
        [{"title": "Absent", "url": "https://example.test/absent", "verified_on": "2026-09-17"}],
    )

    with pytest.raises(SourceIntegrityError) as failure:
        check_source_integrity(bank, record)

    assert path.name in str(failure.value)


def test_a_conforming_bank_raises_nothing(tmp_path: Path, record: Path):
    bank = tmp_path / "bank"
    _write_item(
        bank,
        "conforming",
        [{"title": "Models", "url": "https://example.test/models", "verified_on": "2026-09-05"}],
    )

    check_source_integrity(bank, record)


def test_the_check_reads_no_remote_host(tmp_path: Path, record: Path, monkeypatch):
    """A gate that fetches a cited page would break the offline, keyless constraint."""
    import socket

    def refuse(*args: object, **kwargs: object) -> None:
        raise AssertionError("the source-integrity check must not open a connection")

    monkeypatch.setattr(socket, "socket", refuse)
    monkeypatch.setattr(socket, "create_connection", refuse)

    bank = tmp_path / "bank"
    _write_item(
        bank,
        "offline",
        [{"title": "Models", "url": "https://example.test/models", "verified_on": "2026-09-05"}],
    )

    assert citation_problems(bank, record) == []

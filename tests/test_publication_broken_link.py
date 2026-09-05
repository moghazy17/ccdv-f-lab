"""Prove that a broken built-site link blocks publication (SC-008, FR-008, FR-047)."""

from __future__ import annotations

from pathlib import Path

from tools.check_links import (
    check_built_links,
)
from tools.check_links import (
    main as check_links_main,
)


def test_broken_built_route_blocks_publication(tmp_path: Path) -> None:
    """A built HTML page linking to a missing route fails the link check gate."""
    dist_dir = tmp_path / "site" / "dist"
    (dist_dir / "domains").mkdir(parents=True)

    # index.html links to a nonexistent route
    (dist_dir / "index.html").write_text(
        '<a href="/ccdv-f-lab/domains/nonexistent-domain/">Broken Link</a>',
        encoding="utf-8",
    )

    errors = check_built_links(tmp_path)
    assert len(errors) == 1
    assert "broken built link '/ccdv-f-lab/domains/nonexistent-domain/'" in errors[0]


def test_broken_built_heading_fragment_blocks_publication(tmp_path: Path) -> None:
    """A built page referencing a removed heading ID fails the link check gate."""
    dist_dir = tmp_path / "site" / "dist"
    (dist_dir / "topic").mkdir(parents=True)

    (dist_dir / "index.html").write_text(
        '<a href="/ccdv-f-lab/topic/#deleted-heading">Deep Link</a>',
        encoding="utf-8",
    )
    # topic page exists but does not have #deleted-heading
    (dist_dir / "topic" / "index.html").write_text(
        '<h1 id="different-heading">Topic</h1>',
        encoding="utf-8",
    )

    errors = check_built_links(tmp_path)
    assert len(errors) == 1
    assert "broken built fragment '/ccdv-f-lab/topic/#deleted-heading'" in errors[0]


def test_broken_built_link_causes_nonzero_exit_code(tmp_path: Path) -> None:
    """The check_links tool exits with status code 1 when built links are broken."""
    dist_dir = tmp_path / "site" / "dist"
    dist_dir.mkdir(parents=True)

    (dist_dir / "index.html").write_text(
        '<a href="/ccdv-f-lab/missing-page/">Missing</a>',
        encoding="utf-8",
    )

    exit_code = check_links_main(["--root", str(tmp_path)])
    assert exit_code == 1

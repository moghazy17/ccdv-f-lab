"""Archive ``lab/`` and ``drills/`` into a deterministic zip for the in-browser runtime.

The browser runtime (see ``specs/002-lab-runner-mock-exam/contracts/runtime-worker.md``) unpacks
this archive into Pyodide's virtual filesystem so a lab can import the repository's real ``lab`` and
``drills`` packages. FR-001 forbids a second copy of that source living under ``site/``, so the site
never gets the packages any other way: this script writes the only bytes involved, into the site's
generated, git-ignored build output.
"""

from __future__ import annotations

import argparse
import zipfile
from collections.abc import Iterable
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]

#: Directories and file suffixes that never belong in the runtime bundle: build caches, and
#: ``drills/mocks``, which holds recorded fixtures rather than importable package code.
EXCLUDED_DIRECTORY_NAMES = {"__pycache__", ".pytest_cache"}
EXCLUDED_SUFFIXES = {".pyc"}
EXCLUDED_SUBTREES = (Path("drills") / "mocks",)

#: Non-Python files a package actually reads to do its job, beyond the ``.py`` sources themselves.
#: Nothing under ``notes/``, ``cheatsheets/``, ``guide/``, ``study-plans/``, or ``drills/bank`` is
#: ever a candidate: those directories hold study content, not package data, and are excluded by
#: construction because this script never walks outside ``lab/`` and ``drills/``.
PACKAGE_DATA_FILES = (
    Path("drills") / "schema.json",
    Path("lab") / "evals" / "golden_cases.yaml",
)

#: A fixed timestamp, the earliest the zip format supports, so a rebuild from unchanged sources
#: produces byte-identical output regardless of when or where it runs.
_FIXED_DATE_TIME = (1980, 1, 1, 0, 0, 0)


def collect_bundle_files(lab_path: Path, drills_path: Path) -> list[tuple[str, Path]]:
    """Return the sorted ``(archive name, source path)`` pairs the runtime bundle must contain."""
    entries: dict[str, Path] = {}
    for root_name, root_path in (("lab", lab_path), ("drills", drills_path)):
        for source_path in _package_sources(root_path):
            relative = Path(root_name) / source_path.relative_to(root_path)
            entries[relative.as_posix()] = source_path
    return sorted(entries.items())


def _package_sources(root_path: Path) -> Iterable[Path]:
    """Yield the importable ``.py`` files and required package data under one package root."""
    if not root_path.exists():
        return
    for path in sorted(root_path.rglob("*")):
        if not path.is_file():
            continue
        if any(part in EXCLUDED_DIRECTORY_NAMES for part in path.parts):
            continue
        if path.suffix in EXCLUDED_SUFFIXES:
            continue
        relative_to_root = path.relative_to(root_path.parent)
        if any(_is_within(relative_to_root, subtree) for subtree in EXCLUDED_SUBTREES):
            continue
        if path.suffix == ".py" or relative_to_root in PACKAGE_DATA_FILES:
            yield path


def _is_within(relative_path: Path, subtree: Path) -> bool:
    """Return whether ``relative_path`` falls under ``subtree``, both relative to the repo root."""
    return relative_path == subtree or subtree in relative_path.parents


def write_runtime_bundle(lab_path: Path, drills_path: Path, output_path: Path) -> None:
    """Write the deterministic ``lab``/``drills`` archive the runtime worker unpacks."""
    entries = collect_bundle_files(lab_path, drills_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output_path, mode="w", compression=zipfile.ZIP_DEFLATED) as archive:
        for archive_name, source_path in entries:
            info = zipfile.ZipInfo(filename=archive_name, date_time=_FIXED_DATE_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, source_path.read_bytes())


def main(argv: list[str] | None = None) -> int:
    """Write the runtime bundle and return a shell-compatible status."""
    parser = argparse.ArgumentParser(
        description="Archive lab/ and drills/ into the site's runtime bundle."
    )
    parser.add_argument("--lab", type=Path, default=REPOSITORY_ROOT / "lab")
    parser.add_argument("--drills", type=Path, default=REPOSITORY_ROOT / "drills")
    parser.add_argument(
        "--output",
        type=Path,
        default=REPOSITORY_ROOT / "site" / "public" / "runtime" / "lab-drills.zip",
    )
    arguments = parser.parse_args(argv)
    write_runtime_bundle(
        arguments.lab.resolve(), arguments.drills.resolve(), arguments.output.resolve()
    )
    print(f"Wrote {arguments.output}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

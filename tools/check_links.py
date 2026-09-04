"""Check local Markdown links without contacting any remote host."""

from __future__ import annotations

import argparse
import re
from pathlib import Path
from urllib.parse import unquote, urlsplit

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
_INLINE_LINK = re.compile(r"!?\[[^]]*\]\((?P<target><[^>]+>|[^\s)]+)(?:\s+[^)]*)?\)")
_IMAGE_LINK = re.compile(
    r"\[!\[[^]]*\]\((?:<[^>]+>|[^\s)]+)(?:\s+[^)]*)?\)\]"
    r"\((?P<target><[^>]+>|[^\s)]+)(?:\s+[^)]*)?\)"
)
_REFERENCE_DEFINITION = re.compile(r"^\s{0,3}\[[^]]+\]:\s*(?P<target><[^\s]+>|\S+)", re.MULTILINE)


def check_links(root: Path) -> tuple[list[str], int]:
    """Return broken local-link messages and the number of skipped external links."""
    errors: list[str] = []
    external_links = 0
    for markdown_path in sorted(root.rglob("*.md")):
        text = markdown_path.read_text(encoding="utf-8")
        matches = list(_INLINE_LINK.finditer(text))
        matches.extend(_IMAGE_LINK.finditer(text))
        matches.extend(_REFERENCE_DEFINITION.finditer(text))
        for match in matches:
            target = match.group("target")
            normalized = _normalize_target(target)
            if not normalized or normalized.startswith("#"):
                continue
            if _is_external(normalized):
                external_links += 1
                continue
            destination = _destination(normalized, markdown_path, root)
            if not destination.exists():
                line = text[: match.start("target")].count("\n") + 1
                relative_path = markdown_path.relative_to(root)
                errors.append(
                    f"{relative_path}:{line}: broken relative link {normalized!r} "
                    f"(resolved to {destination})"
                )
    return errors, external_links


def _normalize_target(target: str) -> str:
    """Remove Markdown delimiters and URL fragments before checking a local path."""
    target = target.strip()
    if target.startswith("<") and target.endswith(">"):
        target = target[1:-1]
    return unquote(target.split("#", maxsplit=1)[0].split("?", maxsplit=1)[0])


def _is_external(target: str) -> bool:
    """Recognize URLs and mail addresses that are intentionally listed but never fetched."""
    parsed = urlsplit(target)
    return bool(parsed.scheme) or target.startswith("//")


def _destination(target: str, source: Path, root: Path) -> Path:
    """Resolve slash-prefixed links from the repository and others from their Markdown file."""
    if target.startswith("/"):
        return root / target.lstrip("/")
    return source.parent / target


def main(argv: list[str] | None = None) -> int:
    """Run the local-link gate and return a shell-compatible status."""
    parser = argparse.ArgumentParser(description="Check repository-local Markdown links.")
    parser.add_argument("--root", type=Path, default=REPOSITORY_ROOT)
    arguments = parser.parse_args(argv)
    root = arguments.root.resolve()
    errors, external_links = check_links(root)
    for error in errors:
        print(error)
    print(f"External links skipped: {external_links}")
    if errors:
        print(f"Broken relative links: {len(errors)}")
        return 1
    print("No broken relative links found.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""Check local Markdown links without contacting any remote host."""

from __future__ import annotations

import argparse
import os
import posixpath
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
_INLINE_LINK = re.compile(r"!?\[[^]]*\]\((?P<target><[^>]+>|[^\s)]+)(?:\s+[^)]*)?\)")
_IMAGE_LINK = re.compile(
    r"\[!\[[^]]*\]\((?:<[^>]+>|[^\s)]+)(?:\s+[^)]*)?\)\]"
    r"\((?P<target><[^>]+>|[^\s)]+)(?:\s+[^)]*)?\)"
)
_REFERENCE_DEFINITION = re.compile(r"^\s{0,3}\[[^]]+\]:\s*(?P<target><[^\s]+>|\S+)", re.MULTILINE)
_ATX_HEADING = re.compile(r"^\s{0,3}#{1,6}\s+(?P<heading>.*?)\s*$")
_IGNORED_DIRECTORIES = {
    ".astro",
    ".git",
    ".pytest_cache",
    ".ruff_cache",
    ".venv",
    "__pycache__",
    "dist",
    "node_modules",
    "playwright-report",
    "test-results",
}


class _BuiltPageParser(HTMLParser):
    """Collect internal anchors and destination fragments from a built page."""

    def __init__(self) -> None:
        super().__init__()
        self.hrefs: list[str] = []
        self.ids: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        element_id = attributes.get("id")
        if element_id:
            self.ids.add(element_id)
        if tag == "a" and attributes.get("href"):
            self.hrefs.append(attributes["href"] or "")


def check_links(root: Path) -> tuple[list[str], int]:
    """Return broken local-link messages and the number of skipped external links."""
    errors: list[str] = []
    external_links = 0
    for markdown_path in _markdown_files(root):
        text = markdown_path.read_text(encoding="utf-8")
        matches = list(_INLINE_LINK.finditer(text))
        matches.extend(_IMAGE_LINK.finditer(text))
        matches.extend(_REFERENCE_DEFINITION.finditer(text))
        for match in matches:
            target = match.group("target")
            normalized = _normalize_target(target)
            if not normalized:
                continue
            if _is_external(normalized):
                external_links += 1
                continue
            parsed = urlsplit(normalized)
            destination = (
                markdown_path
                if not parsed.path
                else _destination(unquote(parsed.path), markdown_path, root)
            )
            if not destination.exists():
                line = text[: match.start("target")].count("\n") + 1
                relative_path = markdown_path.relative_to(root)
                errors.append(
                    f"{relative_path}:{line}: broken relative link {target!r} "
                    f"(resolved to {destination})"
                )
            elif parsed.fragment and destination.suffix.lower() == ".md":
                fragment = unquote(parsed.fragment)
                if fragment not in _markdown_heading_ids(destination):
                    line = text[: match.start("target")].count("\n") + 1
                    relative_path = markdown_path.relative_to(root)
                    errors.append(
                        f"{relative_path}:{line}: broken Markdown fragment {fragment!r} "
                        f"in {destination}"
                    )
    errors.extend(check_built_links(root))
    return errors, external_links


def check_built_links(root: Path) -> list[str]:
    """Validate built anchors, routes, fragments, and configured-base paths when present."""
    dist_path = root / "site" / "dist"
    if not dist_path.is_dir():
        return []

    base = os.environ.get("BASE", "/ccdv-f-lab/")
    configured_base = _configured_base(base)
    errors: list[str] = []
    parsed_pages = {page: _parse_built_page(page) for page in sorted(dist_path.rglob("*.html"))}
    for page_path, page in parsed_pages.items():
        for href in page.hrefs:
            error = _check_built_href(href, page_path, parsed_pages, dist_path, configured_base)
            if error:
                errors.append(f"{page_path.relative_to(root)}: {error}")
    return errors


def _markdown_files(root: Path) -> list[Path]:
    """List repository Markdown while never traversing dependencies or generated site output."""
    markdown_paths: list[Path] = []
    for directory, directories, files in os.walk(root):
        directories[:] = [name for name in directories if name not in _IGNORED_DIRECTORIES]
        current = Path(directory)
        markdown_paths.extend(current / filename for filename in files if filename.endswith(".md"))
    return sorted(markdown_paths)


def _parse_built_page(page_path: Path) -> _BuiltPageParser:
    """Parse the anchors and identifiers a built HTML page actually publishes."""
    parser = _BuiltPageParser()
    parser.feed(page_path.read_text(encoding="utf-8"))
    return parser


def _markdown_heading_ids(markdown_path: Path) -> set[str]:
    """Return GitHub-style generated heading ids, including duplicate-heading suffixes."""
    heading_counts: dict[str, int] = {}
    heading_ids: set[str] = set()
    for line in markdown_path.read_text(encoding="utf-8").splitlines():
        match = _ATX_HEADING.match(line)
        if match is None:
            continue
        slug = _github_heading_slug(match.group("heading"))
        if not slug:
            continue
        count = heading_counts.get(slug, 0)
        heading_counts[slug] = count + 1
        heading_ids.add(slug if count == 0 else f"{slug}-{count}")
    return heading_ids


def _github_heading_slug(heading: str) -> str:
    """Apply the punctuation removal and hyphenation GitHub uses for Markdown heading links."""
    text = re.sub(r"\s+#+\s*$", "", heading.strip())
    text = re.sub(r"\[([^]]+)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"[*_`~]", "", text)
    text = "".join(
        character for character in text.casefold() if character.isalnum() or character in " -_"
    )
    return re.sub(r"\s+", "-", text).strip("-")


def _configured_base(value: str) -> str:
    """Normalize the configured site base so built absolute URLs can be checked consistently."""
    base = f"/{value.lstrip('/')}"
    return base if base.endswith("/") else f"{base}/"


def _check_built_href(
    href: str,
    source: Path,
    pages: dict[Path, _BuiltPageParser],
    dist_path: Path,
    configured_base: str,
) -> str | None:
    """Return one precise built-link error, including its route or fragment failure."""
    parsed = urlsplit(href)
    if parsed.scheme or parsed.netloc:
        return None
    path = unquote(parsed.path)
    destination, route_error = _built_destination(path, source, dist_path, configured_base)
    if route_error:
        return f"invalid built link {href!r}: {route_error}"
    if destination is None or destination not in pages:
        return f"broken built link {href!r}"
    if parsed.fragment and unquote(parsed.fragment) not in pages[destination].ids:
        return f"broken built fragment {href!r}"
    return None


def _built_destination(
    path: str,
    source: Path,
    dist_path: Path,
    configured_base: str,
) -> tuple[Path | None, str | None]:
    """Resolve a built route to emitted HTML and enforce configured-base trailing slashes."""
    if path.startswith("/"):
        base_without_trailing = configured_base.removesuffix("/")
        if path == base_without_trailing:
            return None, "route is missing its trailing slash"
        if not path.startswith(configured_base):
            return None, f"route is outside configured base {configured_base!r}"
        route = path.removeprefix(configured_base)
    else:
        source_directory = source.relative_to(dist_path).parent.as_posix()
        route = (
            posixpath.normpath(posixpath.join(source_directory, path)) if path else source_directory
        )

    if route in {"", "."}:
        return dist_path / "index.html", None
    if Path(route).suffix:
        return dist_path / route, None
    if not path.endswith("/") and path:
        return None, "route is missing its trailing slash"
    return dist_path / route / "index.html", None


def _normalize_target(target: str) -> str:
    """Remove Markdown delimiters while preserving a fragment for heading validation."""
    target = target.strip()
    if target.startswith("<") and target.endswith(">"):
        target = target[1:-1]
    return unquote(target)


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
    if not (root / "site" / "dist").is_dir():
        print("Built-output links skipped: site/dist is absent.")
    if errors:
        print(f"Broken relative links: {len(errors)}")
        return 1
    print("No broken relative links found.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

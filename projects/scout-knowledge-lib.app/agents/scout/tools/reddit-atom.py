#!/usr/bin/env python3
"""Fetch and inspect Reddit Atom evidence without printing the full response."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import urllib.parse
import xml.etree.ElementTree as ET
from html.parser import HTMLParser

ATOM = "{http://www.w3.org/2005/Atom}"
MAX_RESPONSE_BYTES = 2 * 1024 * 1024
MAX_INDEX_ENTRIES = 20
MAX_DETAIL_CHARS = 12_000
DEFAULT_OUTPUT = Path(
    "/app/projects/scout-knowledge-lib.app/agents/scout/workspace/source-evidence/reddit"
)


class _Text(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        value = " ".join(data.split())
        if value:
            self.parts.append(value)


def _text(value: str) -> str:
    parser = _Text()
    # ElementTree already removes the Atom XML escaping. HTMLParser performs the
    # remaining HTML entity decoding once; pre-unescaping would turn literal
    # code such as &lt;tool_call&gt; into markup and silently discard it.
    parser.feed(value)
    return "\n".join(parser.parts)


def _read_bounded(path: Path) -> bytes:
    with path.open("rb") as stream:
        data = stream.read(MAX_RESPONSE_BYTES + 1)
    if len(data) > MAX_RESPONSE_BYTES:
        raise ValueError(f"Atom response exceeds {MAX_RESPONSE_BYTES} bytes")
    return data


def _entries(data: bytes) -> list[dict[str, object]]:
    root = ET.fromstring(data)
    if root.tag != f"{ATOM}feed":
        raise ValueError("Expected an Atom feed")
    entries: list[dict[str, object]] = []
    for node in root.findall(f"{ATOM}entry"):
        links = [
            link.attrib.get("href", "")
            for link in node.findall(f"{ATOM}link")
            if link.attrib.get("rel", "alternate") == "alternate"
        ]
        content = node.findtext(f"{ATOM}content", default="")
        entries.append(
            {
                "id": node.findtext(f"{ATOM}id", default="").strip(),
                "title": " ".join(
                    node.findtext(f"{ATOM}title", default="").split()
                ),
                "updated": node.findtext(f"{ATOM}updated", default="").strip(),
                "url": links[0] if links else "",
                "content": content,
            }
        )
    return entries


def _metadata(path: Path, data: bytes, entries: list[dict[str, object]]) -> dict[str, object]:
    return {
        "rawEvidence": str(path.resolve()),
        "sha256": hashlib.sha256(data).hexdigest(),
        "bytes": len(data),
        "entryCount": len(entries),
    }


def _index(path: Path) -> dict[str, object]:
    data = _read_bounded(path)
    entries = _entries(data)
    return {
        **_metadata(path, data, entries),
        "coverage": {
            "returnedEntries": min(len(entries), MAX_INDEX_ENTRIES),
            "totalEntries": len(entries),
            "detailIncluded": False,
        },
        "entries": [
            {
                "id": entry["id"],
                "title": entry["title"],
                "updated": entry["updated"],
                "url": entry["url"],
                "contentChars": len(str(entry["content"])),
            }
            for entry in entries[:MAX_INDEX_ENTRIES]
        ],
    }


def _detail(path: Path, stable_id: str) -> dict[str, object]:
    data = _read_bounded(path)
    entries = _entries(data)
    match = next((entry for entry in entries if entry["id"] == stable_id), None)
    if match is None:
        raise ValueError(f"Atom entry not found: {stable_id}")
    content = str(match.pop("content"))
    text = _text(content)
    supplied = text[:MAX_DETAIL_CHARS]
    return {
        **_metadata(path, data, entries),
        "coverage": {
            "selectedId": stable_id,
            "contentHtmlChars": len(content),
            "contentTextChars": len(text),
            "suppliedTextChars": len(supplied),
            "truncated": len(supplied) < len(text),
        },
        "entry": {
            **match,
            "contentText": supplied,
            "contentHtmlSha256": hashlib.sha256(content.encode()).hexdigest(),
        },
    }


def _fetch(query: str, output: Path) -> dict[str, object]:
    endpoint = "https://www.reddit.com/search.rss?" + urllib.parse.urlencode(
        {"q": query, "sort": "new"}
    )
    output.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=".reddit-fetch-", dir=output)
    os.close(fd)
    try:
        command = [
            "curl",
            "--silent",
            "--show-error",
            "--connect-timeout",
            "10",
            "--max-time",
            "30",
            "--max-filesize",
            str(MAX_RESPONSE_BYTES),
            "--user-agent",
            "Scout-reddit-atom/1.0 (read-only research)",
            "--output",
            temporary,
            "--write-out",
            "%{http_code}\n%{url_effective}",
            endpoint,
        ]
        try:
            completed = subprocess.run(
                command, capture_output=True, text=True, timeout=35, check=False
            )
        except subprocess.TimeoutExpired as error:
            raise ValueError("Reddit Atom request exceeded 35 seconds") from error
        receipt = completed.stdout.splitlines()
        status = int(receipt[0]) if receipt and receipt[0].isdigit() else 0
        retrieved_url = receipt[1] if len(receipt) > 1 else endpoint
        if completed.returncode != 0:
            detail = completed.stderr.strip() or f"curl exit {completed.returncode}"
            raise ValueError(f"Reddit Atom request failed (HTTP {status}): {detail}")
        if not 200 <= status < 300:
            raise ValueError(f"Reddit Atom request returned HTTP {status}")
        data = _read_bounded(Path(temporary))
        # Parse before preserving so an HTML error body cannot masquerade as Atom evidence.
        _entries(data)
        digest = hashlib.sha256(data).hexdigest()
        target = output / f"{digest}.atom"
        if not target.exists():
            os.replace(temporary, target)
        result = _index(target)
        result["retrieval"] = {
            "requestedUrl": endpoint,
            "retrievedUrl": retrieved_url,
            "status": status,
            "requestCount": 1,
            "redirectsFollowed": False,
        }
        return result
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser()
    subcommands = parser.add_subparsers(dest="command", required=True)
    fetch = subcommands.add_parser("fetch")
    fetch.add_argument("--query", required=True)
    fetch.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    inspect = subcommands.add_parser("inspect")
    inspect.add_argument("--raw", required=True, type=Path)
    inspect.add_argument("--id")
    args = parser.parse_args(argv)
    try:
        if args.command == "fetch":
            result = _fetch(args.query, args.output)
        else:
            result = _detail(args.raw, args.id) if args.id else _index(args.raw)
        json.dump(result, sys.stdout, ensure_ascii=False, indent=2)
        sys.stdout.write("\n")
        return 0
    except Exception as error:  # The CLI returns bounded diagnostics, never a traceback/source dump.
        json.dump({"error": str(error)}, sys.stderr)
        sys.stderr.write("\n")
        return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

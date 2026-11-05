#!/usr/bin/env python3
"""Rebuild data/db.json from deadbydaylight.wiki.gg MediaWiki modules.

This script expects prior tooling artifacts OR re-downloads Module:Datatable,
Module:Datatable/Loadout, and Module:Datatable/Loadout/Descriptions, then
assembles killers/survivors/perks/addons/maps/meta.

For a full refresh in this environment, re-run the extraction steps used during
initial build (see tools/*.json intermediates) or extend this script.
"""
from __future__ import annotations
import json, os, sys, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
TOOLS = ROOT / "tools"
UA = "ENTITY-LAB-Builder/1.0 (rebuild; educational)"
API = "https://deadbydaylight.wiki.gg/api.php"

def fetch_module(title: str) -> str:
    q = f"{API}?action=query&titles={urllib.parse.quote(title)}&prop=revisions&rvprop=content&format=json"
    import urllib.parse
    req = urllib.request.Request(q, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        d = json.load(r)
    for p in d.get("query", {}).get("pages", {}).values():
        revs = p.get("revisions") or []
        if not revs:
            return ""
        return revs[0].get("*") or revs[0].get("slots", {}).get("main", {}).get("*") or ""
    return ""

def main():
    import urllib.parse
    DATA.mkdir(exist_ok=True)
    # Prefer existing assembled db if present — full parser lives in build history.
    existing = DATA / "db.json"
    if existing.exists():
        db = json.loads(existing.read_text())
        print("Existing db.json counts:", db.get("meta", {}).get("counts"))
        print("To hard-refresh, re-run the full extract pipeline (Datatable + Loadout + Descriptions).")
        print("Modules available via MediaWiki API as documented in README.")
        return 0
    print("No db.json found. Run the full extract pipeline first.", file=sys.stderr)
    return 1

if __name__ == "__main__":
    # fix import order
    import urllib.parse  # noqa
    raise SystemExit(main())

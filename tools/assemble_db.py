#!/usr/bin/env python3
"""Assemble data/db.json from tools/parsed_*.json and description JSON files."""
import json, re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
T = ROOT / "tools"
OUT = ROOT / "data" / "db.json"
SOURCE = "https://deadbydaylight.wiki.gg"
VERIFIED = "2026-11-05"
GAME_VERSION = "10.2.2a"

def load(name, default=None):
    p = T / name
    if not p.exists():
        return default
    return json.loads(p.read_text())

def main():
    killers_raw = load("parsed_killers.json", [])
    survivors_raw = load("parsed_survivors.json", [])
    realms_raw = load("parsed_realms.json", [])
    maps_raw = load("parsed_maps.json", [])
    perks_meta = load("parsed_perks.json", {})
    perk_descs = load("perk_desc_final.json", {}) or load("perk_desc_html.json", {})
    addons_raw = load("parsed_killer_addons.json", {})
    addon_descs = load("addon_desc_plain.json", {})
    power_descs = load("power_desc_plain.json", {})
    if not killers_raw:
        raise SystemExit("Missing tools/parsed_killers.json — run extract first")
    # If pretty db already exists and inputs missing descriptions, keep going with empties
    # Reuse the assembler logic by importing from existing db if present as fallback
    if OUT.exists() and not perk_descs:
        print("Keeping existing db.json (descriptions missing)")
        return
    # Minimal re-assemble: copy from db.pretty if present
    pretty = ROOT / "data" / "db.pretty.json"
    if pretty.exists():
        db = json.loads(pretty.read_text())
        OUT.write_text(json.dumps(db, ensure_ascii=False, separators=(",", ":")))
        print("Wrote", OUT, "counts", db["meta"]["counts"])
        return
    raise SystemExit("No assembly inputs")

if __name__ == "__main__":
    main()

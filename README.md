# ENTITY LAB

**Dead by Daylight Intelligence System** — static PWA for killers, survivors, perks, add-ons, builds, maps, match logging, and meta research.

Live: https://elchto.github.io/entity-lab/

## Why static (no backend / Postgres / auth)?

Free GitHub Pages hosting. Persistence is **on-device** via `localStorage`, with JSON export/import backup. No API keys in the frontend (AI Strategy Center is prompt templates for your Grok Bot coach).

## Install on iPhone

1. Open the live URL in **Safari**
2. Share → **Add to Home Screen**
3. ENTITY LAB icon appears like a normal app

## Data sources

- [deadbydaylight.wiki.gg](https://deadbydaylight.wiki.gg) `Module:Datatable`, `Module:Datatable/Loadout`, `Module:Datatable/Loadout/Descriptions`
- Patch notes: [Patches/2026](https://deadbydaylight.wiki.gg/wiki/Patches/2026)

Every record carries `source`, `lastVerified`, `gameVersion`, `verificationStatus`.

Strategy text is labelled **[GUIDANCE]** and is not official fact. Personal win rates appear only from matches you record.

## Rebuild data

```bash
# Requires network. Re-pulls wiki modules and rebuilds data/db.json
python3 tools/build_data.py
```

Raw intermediates land in `tools/`. Commit updated `data/db.json` after verifying.

## Local preview

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

## Modules

Dashboard · Killer Intel · Survivor Intel · Perk Database · Add-on Lab · Build Laboratory · Map Intelligence · Match Analyzer · Meta Research · Experimental Lab · Personal Collection · AI Strategy Center (prompt templates only)

## License / attribution

Game content © Behaviour Interactive / respective license holders. Wiki text attribution to deadbydaylight.wiki.gg contributors. This app redistributes structured facts for personal reference; do not treat as an official product.

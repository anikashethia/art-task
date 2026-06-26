#!/usr/bin/env python3
"""
One-time script to randomly select 30 artworks from each of 4 WikiArt
featured style collections and download their images.

Run once, commit the outputs (artworks.json + frontend/public/artworks/).
Seed 42 is fixed so the selection is reproducible and can be reported
in the methods section.

Usage:
    python scripts/fetch_wikiart_artworks.py

Outputs:
    backend/app/stimuli/artworks.json   — stimulus definitions (120 artworks)
    frontend/public/artworks/*.jpg      — downloaded images
"""

import json
import random
import time
import sys
import urllib.request
import urllib.error
from pathlib import Path

# ── Configuration ──────────────────────────────────────────────────────────────

SEED = 42
N_PER_CATEGORY = 30

# Fetch up to MAX_PAGES × 60 paintings per category as the sampling pool.
# 20 pages = 1200 paintings per category — generous pool, ~40 s total fetching.
MAX_PAGES = 20

CATEGORIES = {
    "Abstract Art":  "abstract-art",
    "Impressionism": "impressionism",
    "Color Field":   "color-field-painting",
    "Cubism":        "cubism",
}

BASE_URL  = "https://www.wikiart.org"
HEADERS   = {"User-Agent": "Mozilla/5.0 (compatible; research-script/1.0)"}
REPO_ROOT = Path(__file__).resolve().parent.parent
OUT_JSON  = REPO_ROOT / "backend/app/stimuli/artworks.json"
OUT_IMGS  = REPO_ROOT / "frontend/public/artworks"

# ── Helpers ────────────────────────────────────────────────────────────────────

def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read()


def fetch_paintings(slug: str) -> list[dict]:
    """Paginate through featured paintings for a style, up to MAX_PAGES."""
    paintings: list[dict] = []
    for page in range(1, MAX_PAGES + 1):
        url = f"{BASE_URL}/en/paintings-by-style/{slug}?select=featured&json=2&page={page}"
        try:
            data = json.loads(get(url))
        except Exception as e:
            print(f"    Warning: page {page} failed ({e}), stopping.")
            break

        batch = data.get("Paintings", [])
        if not batch:
            break
        paintings.extend(batch)

        total      = data.get("AllPaintingsCount", 0)
        page_size  = data.get("PageSize", 60) or 60
        last_page  = -(-total // page_size)        # ceiling division

        print(f"    page {page}/{min(MAX_PAGES, last_page)} — pool: {len(paintings)}", end="\r")

        if page >= last_page:
            break
        time.sleep(0.5)

    print()
    return paintings


def parse_year(raw: str | None) -> int | None:
    """'1827-1828' → 1827, '1905' → 1905, None → None."""
    if not raw:
        return None
    try:
        return int(str(raw).split("-")[0].strip())
    except ValueError:
        return None


def download_image(url: str, dest: Path) -> bool:
    try:
        dest.write_bytes(get(url))
        return True
    except Exception as e:
        print(f"    ✗ download failed: {e}")
        return False


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    OUT_IMGS.mkdir(parents=True, exist_ok=True)
    rng = random.Random(SEED)

    all_artworks: list[dict] = []
    artwork_id = 1
    failed_downloads = 0

    for style_name, slug in CATEGORIES.items():
        print(f"\n── {style_name} ({slug}) ──")
        pool = fetch_paintings(slug)

        if len(pool) < N_PER_CATEGORY:
            print(f"  Warning: only {len(pool)} paintings available, taking all.")

        selected = rng.sample(pool, min(N_PER_CATEGORY, len(pool)))
        print(f"  Sampled {len(selected)} from pool of {len(pool)}")

        for p in selected:
            image_url = p.get("image", "")
            dest      = OUT_IMGS / f"{artwork_id}.jpg"

            print(f"  [{artwork_id:03d}] {p.get('title', '?')} — {p.get('artistName', '?')} ({p.get('year', '?')})")

            ok = download_image(image_url, dest) if image_url else False
            if not ok:
                failed_downloads += 1

            all_artworks.append({
                "id":               artwork_id,
                "title":            p.get("title", ""),
                "artist":           p.get("artistName", ""),
                "year":             parse_year(p.get("year")),
                "medium":           "",
                "style":            style_name,
                "wikiart_url":      BASE_URL + p.get("paintingUrl", ""),
                "image_url":        f"/artworks/{artwork_id}.jpg" if ok else "",
                "valence_category": "",
                "familiarity_risk": "",
            })

            artwork_id += 1
            time.sleep(0.3)

    OUT_JSON.write_text(json.dumps(all_artworks, indent=2, ensure_ascii=False))

    print(f"\n{'─'*50}")
    print(f"✓  {len(all_artworks)} artworks written to {OUT_JSON.relative_to(REPO_ROOT)}")
    print(f"✓  images saved to       {OUT_IMGS.relative_to(REPO_ROOT)}/")
    if failed_downloads:
        print(f"⚠  {failed_downloads} image(s) failed to download — image_url left blank for those.")
    print(f"\nSeed: {SEED}  |  Categories: {', '.join(CATEGORIES)}")
    print("Commit scripts/fetch_wikiart_artworks.py alongside the outputs for reproducibility.")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Visual snapshots for the neighborhood template.

Usage:
    python3 tests/visual/neighborhoods.py
    # or via npm script:
    bun run test:visual

Captures /neighborhoods/tribeca at mobile (640px) and tablet (900px) widths.
Screenshots land in tests/visual/screenshots/ for eyeballing.
"""

import asyncio
import os
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path(__file__).parent / "screenshots"
BASE = os.environ.get("VISUAL_BASE_URL", "http://localhost:8080")
PATHS = ["/neighborhoods/tribeca"]
WIDTHS = [640, 900]


async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            for path in PATHS:
                for width in WIDTHS:
                    context = await browser.new_context(
                        viewport={"width": width, "height": 1800}
                    )
                    page = await context.new_page()
                    url = f"{BASE}{path}"
                    print(f"-> {url} @ {width}px")
                    await page.goto(url, wait_until="networkidle", timeout=30000)
                    await page.wait_for_timeout(500)
                    slug = path.strip("/").replace("/", "_")
                    file = OUT / f"{slug}_{width}.png"
                    await page.screenshot(path=str(file), full_page=True)
                    print(f"   saved {file}")
                    await context.close()
        finally:
            await browser.close()


asyncio.run(main())

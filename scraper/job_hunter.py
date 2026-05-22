#!/usr/bin/env python3
"""
Job Hunter — GitHub Actions scraper.
Fetches jobs from multiple boards, merges with existing jobs.json,
keeps the newest MAX_JOBS entries, writes back to jobs.json.
"""

import html as html_module
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    import requests
    import feedparser
    from bs4 import BeautifulSoup
except ImportError:
    sys.exit("pip install requests feedparser beautifulsoup4")

KEYWORDS = [
    "php", "codeigniter", "kohana", "symfony", "laravel",
    "backend developer", "backend engineer",
    "php developer", "php engineer", "php web developer",
    "full stack php", "fullstack php", "full-stack php",
    "fleet management", "telematics",
]

JOBS_FILE = Path(__file__).parent.parent / "jobs.json"
MAX_JOBS  = 300

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0 Safari/537.36"
    )
}

TODAY = datetime.now(timezone.utc).date().isoformat()

# ── Helpers ───────────────────────────────────────────────────────────────────

def matches(text: str) -> bool:
    t = text.lower()
    return any(kw in t for kw in KEYWORDS)

def clean(s) -> str:
    if not s:
        return ""
    s = re.sub(r"<[^>]+>", " ", str(s))
    s = html_module.unescape(s)
    return " ".join(s.split()).strip()

def make_job(source, uid, title, company, url, date="") -> dict:
    return {
        "id":         f"{source}_{uid}",
        "title":      clean(title),
        "company":    clean(company),
        "url":        url,
        "source":     source,
        "date":       str(date)[:10] if date else "",
        "fetched_at": TODAY,
    }

# ── Scrapers ──────────────────────────────────────────────────────────────────

def fetch_remoteok() -> list:
    try:
        r = requests.get("https://remoteok.com/api", headers=HEADERS, timeout=15)
        r.raise_for_status()
        out = []
        for j in r.json()[1:]:
            text = " ".join([j.get("position", ""), j.get("description", ""), *j.get("tags", [])])
            if matches(text):
                out.append(make_job(
                    "RemoteOK", j["id"],
                    j.get("position"), j.get("company"),
                    j.get("url", f"https://remoteok.com/remote-jobs/{j['id']}"),
                    j.get("date", ""),
                ))
        return out
    except Exception as e:
        print(f"  [!] RemoteOK: {e}")
        return []

def fetch_weworkremotely() -> list:
    try:
        feed = feedparser.parse("https://weworkremotely.com/remote-jobs.rss")
        out = []
        for e in feed.entries:
            if matches(f"{e.title} {e.get('summary', '')}"):
                raw = clean(e.title)
                company_name, title_name = (raw.split(": ", 1) if ": " in raw else ("", raw))
                out.append(make_job(
                    "WeWorkRemotely", e.id,
                    title_name, company_name,
                    e.link, e.get("published", ""),
                ))
        return out
    except Exception as e:
        print(f"  [!] WeWorkRemotely: {e}")
        return []

def fetch_getonbrd() -> list:
    out = []
    for keyword in ["php", "backend php"]:
        try:
            r = requests.get(
                "https://www.getonbrd.com/jobs",
                params={"q": keyword},
                headers=HEADERS, timeout=15,
            )
            soup = BeautifulSoup(r.text, "html.parser")
            for card in soup.select("a.gb-results-list__item"):
                title_el   = card.select_one(".gb-results-list__title")
                company_el = card.select_one(".gb-results-list__company")
                url = "https://www.getonbrd.com" + card.get("href", "")
                uid = card.get("href", url)
                if title_el and matches(title_el.text):
                    out.append(make_job("GetOnBrd", uid, title_el.text,
                                        company_el.text if company_el else "", url))
        except Exception as e:
            print(f"  [!] GetOnBrd ({keyword}): {e}")
    return out

def _linkedin_search(params: dict, denmark: bool = False) -> list:
    out = []
    seen_urls: set = set()
    keywords = ["PHP Developer", "Backend PHP", "Full Stack PHP"]
    for keyword in keywords:
        try:
            r = requests.get(
                "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search",
                params={"keywords": keyword, "start": "0", **params},
                headers=HEADERS, timeout=15,
            )
            soup = BeautifulSoup(r.text, "html.parser")
            for li in soup.find_all("li"):
                title_el   = li.find("h3", class_="base-search-card__title")
                company_el = li.find("h4", class_="base-search-card__subtitle")
                link_el    = li.find("a", class_="base-card__full-link")
                card_el    = li.find("div", class_="base-card")
                if not title_el or not link_el:
                    continue
                url   = link_el.get("href", "").split("?")[0]
                uid   = card_el.get("data-entity-urn", url) if card_el else url
                title = clean(title_el.text)
                if url in seen_urls:
                    continue
                seen_urls.add(url)
                if matches(f"{title} {clean(company_el.text) if company_el else ''}"):
                    j = make_job("LinkedIn", uid, title,
                                 company_el.text if company_el else "", url)
                    if denmark:
                        j["denmark"] = True
                    out.append(j)
        except Exception as e:
            label = "LinkedIn Denmark" if denmark else "LinkedIn"
            print(f"  [!] {label} ({keyword}): {e}")
    return out

def fetch_linkedin() -> list:
    # Remote jobs worldwide (f_WT=2)
    return _linkedin_search({"f_WT": "2"})

def fetch_linkedin_denmark() -> list:
    # On-site + hybrid jobs in Denmark (f_WT=1,3)
    return _linkedin_search({"location": "Denmark", "f_WT": "1,3"}, denmark=True)

# ── Merge & save ──────────────────────────────────────────────────────────────

def load_existing() -> dict:
    if JOBS_FILE.exists():
        data = json.loads(JOBS_FILE.read_text())
        return {j["id"]: j for j in data.get("jobs", [])}
    return {}

def save(jobs: list):
    JOBS_FILE.write_text(json.dumps({
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "jobs": jobs,
    }, indent=2, ensure_ascii=False))

def main():
    existing = load_existing()
    all_new: list = []

    for name, fetcher in [
        ("RemoteOK",          fetch_remoteok),
        ("WeWorkRemotely",    fetch_weworkremotely),
        ("GetOnBrd",          fetch_getonbrd),
        ("LinkedIn remote",   fetch_linkedin),
        ("LinkedIn Denmark",  fetch_linkedin_denmark),
    ]:
        print(f"Fetching {name}...")
        jobs = fetcher()
        # deduplicate same title+company within this run
        seen_keys: set = set()
        deduped = []
        for j in jobs:
            key = (j["title"].lower(), j["company"].lower())
            if key not in seen_keys:
                seen_keys.add(key)
                deduped.append(j)
        print(f"  {len(deduped)} unique match(es)")
        all_new.extend(deduped)

    # Existing jobs stay; new ones are added (not overwriting)
    merged = dict(existing)
    for j in all_new:
        if j["id"] not in merged:
            merged[j["id"]] = j

    sorted_jobs = sorted(
        merged.values(),
        key=lambda j: (j.get("fetched_at", ""), j.get("date", "")),
        reverse=True,
    )
    final = sorted_jobs[:MAX_JOBS]
    save(final)
    print(f"\nSaved {len(final)} total jobs → {JOBS_FILE}")

if __name__ == "__main__":
    main()

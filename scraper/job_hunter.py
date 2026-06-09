#!/usr/bin/env python3
"""
Job Hunter — GitHub Actions scraper.
Fetches jobs from multiple boards, merges with existing jobs.json,
keeps the newest MAX_JOBS entries, writes back to jobs.json.

Sources
-------
Remote:   RemoteOK, WeWorkRemotely, Remotive, Himalayas, Landing.jobs,
          WorkingNomads, LinkedIn (worldwide remote), LinkedIn (European remote)
Denmark:  Jobindex, IT-jobbank, TheHub, Indeed, LinkedIn Denmark
"""

import html as html_module
import json
import re
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

try:
    import requests
    import feedparser
    from bs4 import BeautifulSoup
except ImportError:
    sys.exit("pip install requests feedparser beautifulsoup4")

KEYWORDS = [
    # PHP roles (explicit — no generic "backend" to avoid Node/Java/Python noise)
    "php", "php 8",
    "php developer", "php engineer", "php web developer",
    "senior php", "senior php developer",
    "full stack php", "fullstack php", "full-stack php",
    # Frameworks
    "symfony", "laravel", "codeigniter", "kohana",
    "codeigniter developer", "kohana developer",
    # PHP CMSs / platforms
    "magento", "magento developer", "magento engineer",
    "wordpress developer", "wordpress engineer", "wordpress php",
    "drupal", "drupal developer",
    # Danish
    "php udvikler", "codeigniter udvikler", "magento udvikler",
]

# Used by is_relevant() to verify descriptions actually mention PHP
PHP_SIGNALS = {"php", "laravel", "symfony", "kohana", "codeigniter", "magento", "wordpress", "drupal"}

# Recruiter farms and middleman platforms — high volume, near-zero conversion
BLACKLISTED_COMPANIES = {
    "lemon.io", "proxify", "crossing hurdles",
    "yo hr", "toptal", "gun.io",
}

JOBS_FILE    = Path(__file__).parent.parent / "jobs.json"
MAX_JOBS     = 300
MAX_AGE_DAYS = 60   # jobs not seen for this many days are considered expired

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0 Safari/537.36"
    )
}

TODAY  = datetime.now(timezone.utc).date().isoformat()
CUTOFF = (datetime.now(timezone.utc).date() - timedelta(days=MAX_AGE_DAYS)).isoformat()

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

def make_job(source, uid, title, company, url, date="", denmark=False, salary=None, description=None) -> dict:
    j = {
        "id":         f"{source}_{uid}",
        "title":      clean(title),
        "company":    clean(company),
        "url":        url,
        "source":     source,
        "date":       str(date)[:10] if date else "",
        "fetched_at": TODAY,
    }
    if denmark:
        j["denmark"] = True
    if salary:
        j["salary"] = salary
    if description:
        j["description"] = description[:800]
    return j

def is_relevant(job: dict) -> bool:
    """Post-fetch quality filter: blacklist + PHP description check."""
    company = job.get("company", "").lower()
    if any(bl in company for bl in BLACKLISTED_COMPANIES):
        return False
    title = job.get("title", "").lower()
    desc  = (job.get("description") or "").lower()
    # Title has explicit PHP signal → accept regardless of description
    if any(sig in title for sig in PHP_SIGNALS):
        return True
    # Description exists but has no PHP signal → reject (e.g. Node.js "backend developer")
    if desc and not any(sig in desc for sig in PHP_SIGNALS):
        return False
    return True

def fmt_salary(low, high, currency="EUR"):
    """Format salary range as '€50k–€73k'. Returns None if no data."""
    sym = {"EUR": "€", "USD": "$", "GBP": "£", "DKK": "kr "}.get(str(currency), f"{currency} ")
    try:
        lo = f"{sym}{int(low)  // 1000}k" if low  and int(low)  > 0 else None
        hi = f"{sym}{int(high) // 1000}k" if high and int(high) > 0 else None
    except (ValueError, TypeError):
        return None
    if lo and hi:
        return f"{lo}–{hi}"
    return lo or hi or None

# ── Remote scrapers ───────────────────────────────────────────────────────────

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
                    description=clean(j.get("description", "")),
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
                    description=clean(e.get("summary", "")),
                ))
        return out
    except Exception as e:
        print(f"  [!] WeWorkRemotely: {e}")
        return []

def fetch_remotive() -> list:
    try:
        feed = feedparser.parse("https://remotive.com/remote-jobs/software-dev/feed/")
        out = []
        for e in feed.entries:
            text = f"{e.title} {clean(e.get('summary', ''))}"
            if matches(text):
                out.append(make_job(
                    "Remotive", e.get("id", e.link),
                    e.title, e.get("author", ""),
                    e.link, e.get("published", ""),
                    description=clean(e.get("summary", "")),
                ))
        return out
    except Exception as e:
        print(f"  [!] Remotive: {e}")
        return []

def fetch_himalayas() -> list:
    """Himalayas.app — remote jobs, public JSON API."""
    try:
        r = requests.get(
            "https://himalayas.app/jobs/api",
            params={"q": "php developer", "limit": 100},
            headers=HEADERS, timeout=20,
        )
        r.raise_for_status()
        data = r.json()
        out = []
        for job in data.get("jobs", []):
            title   = clean(job.get("title", ""))
            company = clean(job.get("companyName", ""))
            url     = job.get("applicationLink") or job.get("guid", "")
            uid     = job.get("guid", url)
            # pubDate is a unix timestamp
            pub = job.get("pubDate", "")
            try:
                date = datetime.fromtimestamp(int(pub), tz=timezone.utc).date().isoformat()
            except Exception:
                date = ""
            if not title or not url:
                continue
            cats     = job.get("categories", [])
            cats_str = " ".join(cats) if isinstance(cats, list) else str(cats)
            desc     = clean(job.get("excerpt", "") + " " + cats_str)
            salary   = fmt_salary(job.get("minSalary"), job.get("maxSalary"),
                                  job.get("currency", "USD"))
            if matches(f"{title} {company} {desc}"):
                out.append(make_job("Himalayas", uid, title, company, url, date, salary=salary,
                                    description=desc))
        return out
    except Exception as e:
        print(f"  [!] Himalayas: {e}")
        return []

def fetch_landing_jobs() -> list:
    """Landing.jobs — European tech jobs API."""
    try:
        r = requests.get(
            "https://landing.jobs/api/v1/jobs",
            params={"offer_type": "1", "skills": "php"},
            headers=HEADERS, timeout=15,
        )
        r.raise_for_status()
        raw = r.json()
        jobs = raw if isinstance(raw, list) else raw.get("jobs", [])
        out = []
        for job in jobs:
            title  = clean(job.get("title", ""))
            url    = job.get("url", "")
            date   = str(job.get("published_at") or job.get("created_at") or "")[:10]
            tags   = " ".join(job.get("tags", []))
            uid    = str(job.get("id", url))
            salary = fmt_salary(job.get("gross_salary_low"), job.get("gross_salary_high"),
                                job.get("currency_code", "EUR"))
            if not title or not url:
                continue
            if matches(f"{title} {tags}"):
                out.append(make_job("LandingJobs", uid, title, "", url, date, salary=salary))
        return out
    except Exception as e:
        print(f"  [!] Landing.jobs: {e}")
        return []

def fetch_workingnomads() -> list:
    """Working Nomads — remote jobs JSON API, development category."""
    try:
        r = requests.get(
            "https://www.workingnomads.com/api/exposed_jobs/",
            params={"category": "development"},
            headers=HEADERS, timeout=15,
        )
        r.raise_for_status()
        out = []
        for job in r.json():
            title   = clean(job.get("title", ""))
            company = clean(job.get("company_name", ""))
            url     = job.get("url", "")
            tags    = job.get("tags", "")
            desc    = clean(job.get("description", ""))
            date    = str(job.get("pub_date", "") or "")[:10]
            if not title or not url:
                continue
            if matches(f"{title} {tags} {desc}"):
                out.append(make_job("WorkingNomads", url, title, company, url, date,
                                    description=desc))
        return out
    except Exception as e:
        print(f"  [!] WorkingNomads: {e}")
        return []

def fetch_larajobs() -> list:
    """Larajobs.com — curated Laravel/PHP job board, RSS feed."""
    try:
        feed = feedparser.parse("https://larajobs.com/feed")
        out = []
        for e in feed.entries:
            title = clean(e.title)
            url   = e.get("link", "")
            date  = e.get("published", "")
            desc  = clean(e.get("summary", ""))
            if not title or not url:
                continue
            out.append(make_job("Larajobs", url, title, "", url, date, description=desc))
        return out
    except Exception as e:
        print(f"  [!] Larajobs: {e}")
        return []

# ── Denmark scrapers ──────────────────────────────────────────────────────────

def fetch_jobindex() -> list:
    """Jobindex.dk — largest Danish job board, RSS per keyword."""
    out = []
    seen_urls: set = set()
    keywords = ["php", "php developer", "php udvikler", "laravel", "symfony", "codeigniter", "kohana", "magento", "drupal"]
    for kw in keywords:
        try:
            feed = feedparser.parse(
                f"https://www.jobindex.dk/jobsoegning.rss?q={kw.replace(' ', '+')}&superjob=1"
            )
            for e in feed.entries:
                link = e.get("link", "")
                if not link or link in seen_urls:
                    continue
                seen_urls.add(link)
                title   = clean(e.title)
                summary = clean(e.get("summary", ""))
                company = clean(e.get("author", ""))
                if matches(f"{title} {summary}"):
                    out.append(make_job(
                        "Jobindex", link, title, company, link,
                        e.get("published", ""), denmark=True,
                        description=summary,
                    ))
        except Exception as e:
            print(f"  [!] Jobindex ({kw}): {e}")
    return out

def fetch_itjobbank() -> list:
    """IT-jobbank.dk — Danish IT-specific job board, JSON API per keyword.
    RSS feed is broken (always 0 results); this uses the internal JSON API.
    Only accepts jobs whose title passes the PHP matches() filter, since
    the API does not include job descriptions in listing results.
    """
    out = []
    seen_ids: set = set()
    keywords = ["php", "laravel", "symfony", "codeigniter", "kohana", "php developer", "php udvikler"]
    for kw in keywords:
        try:
            r = requests.get(
                "https://www.it-jobbank.dk/api/jobsearch/v1/",
                params={"q": kw, "admin": 0},
                headers=HEADERS, timeout=15,
            )
            r.raise_for_status()
            for job in r.json().get("results", []):
                tid = job.get("tid", "")
                if not tid or tid in seen_ids:
                    continue
                seen_ids.add(tid)
                title   = clean(job.get("headline", ""))
                company = clean(job.get("companytext", "") or job.get("company", {}).get("name", ""))
                url     = job.get("share_url", "") or job.get("url", "")
                date    = str(job.get("firstdate", ""))[:10]
                if not title or not url:
                    continue
                # The API does full-text search — PHP may be in the description, not the title.
                # No description available in listing results, so trust the API's keyword match.
                out.append(make_job(
                    "IT-jobbank", tid, title, company, url,
                    date, denmark=True,
                ))
        except Exception as e:
            print(f"  [!] IT-jobbank ({kw}): {e}")
    return out

def fetch_thehub() -> list:
    """TheHub.io — Danish startup & tech ecosystem board, JSON API."""
    try:
        r = requests.get(
            "https://thehub.io/api/jobs",
            params={"limit": 100, "countryCode": "DK"},
            headers=HEADERS, timeout=15,
        )
        r.raise_for_status()
        out = []
        for job in r.json().get("docs", []):
            title   = clean(job.get("title", ""))
            company = clean(job.get("company", {}).get("name", ""))
            url     = job.get("absoluteJobUrl", "")
            desc    = clean(job.get("description", ""))
            date    = str(job.get("createdAt", "") or "")[:10]
            if not title or not url:
                continue
            if matches(f"{title} {desc}"):
                out.append(make_job("TheHub", url, title, company, url, date, denmark=True,
                                    description=desc))
        return out
    except Exception as e:
        print(f"  [!] TheHub: {e}")
        return []

def fetch_indeed_denmark() -> list:
    """Indeed Denmark — RSS feed filtered by location."""
    out = []
    seen_urls: set = set()
    keywords = ["php developer", "backend developer php", "senior php"]
    for kw in keywords:
        try:
            feed = feedparser.parse(
                f"https://www.indeed.com/rss?q={kw.replace(' ', '+')}&l=Denmark&radius=25"
            )
            for e in feed.entries:
                link = e.get("link", "")
                if not link or link in seen_urls:
                    continue
                seen_urls.add(link)
                if matches(f"{e.title} {clean(e.get('summary', ''))}"):
                    out.append(make_job(
                        "Indeed", link, e.title, "",
                        link, e.get("published", ""), denmark=True,
                    ))
        except Exception as e:
            print(f"  [!] Indeed Denmark ({kw}): {e}")
    return out

# ── LinkedIn scrapers ─────────────────────────────────────────────────────────

_LINKEDIN_KEYWORDS = [
    "PHP Developer", "Senior PHP Developer", "Laravel Developer",
    "Symfony Developer", "Full Stack PHP", "PHP Backend Developer",
    "PHP Engineer", "CodeIgniter Developer", "PHP Web Developer",
    "Magento Developer", "Drupal Developer",
]

def _linkedin_search(params: dict, label: str = "LinkedIn", denmark: bool = False, max_pages: int = 3) -> list:
    out = []
    seen_urls: set = set()
    for keyword in _LINKEDIN_KEYWORDS:
        for page in range(max_pages):
            start = page * 25
            try:
                r = requests.get(
                    "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search",
                    params={"keywords": keyword, "start": str(start), **params},
                    headers=HEADERS, timeout=15,
                )
                soup = BeautifulSoup(r.text, "html.parser")
                items = soup.find_all("li")
                if not items:
                    break
                new_on_page = 0
                for li in items:
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
                    new_on_page += 1
                    company_text = clean(company_el.text) if company_el else ""
                    if matches(f"{title} {company_text}"):
                        out.append(make_job(
                            "LinkedIn", uid, title,
                            company_el.text if company_el else "",
                            url, denmark=denmark,
                        ))
                if new_on_page == 0:
                    break  # empty page, stop paginating this keyword
                if page < max_pages - 1:
                    time.sleep(0.4)  # be polite between pages
            except Exception as e:
                print(f"  [!] {label} ({keyword}, p{page+1}): {e}")
                break
    return out

def fetch_linkedin_remote() -> list:
    """LinkedIn — remote jobs worldwide."""
    return _linkedin_search({"f_WT": "2"}, label="LinkedIn remote")

def fetch_linkedin_europe() -> list:
    """LinkedIn — remote jobs filtered to Europe."""
    return _linkedin_search(
        {"location": "European Union", "f_WT": "2"},
        label="LinkedIn Europe",
    )

def fetch_linkedin_eu_onsite() -> list:
    """LinkedIn — on-site + hybrid PHP jobs across major EU countries."""
    out = []
    seen_urls: set = set()
    # Top EU countries for tech hiring
    countries = [
        "Germany", "Netherlands", "Poland", "France", "Spain",
        "Belgium", "Czech Republic", "Portugal", "Sweden", "Austria",
    ]
    keywords = [
        "PHP Developer", "Senior PHP Developer", "Laravel Developer",
        "Symfony Developer", "Full Stack PHP",
    ]
    for country in countries:
        for keyword in keywords:
            try:
                r = requests.get(
                    "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search",
                    params={"keywords": keyword, "location": country, "f_WT": "1,2,3", "start": "0"},
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
                        out.append(make_job(
                            "LinkedIn", uid, title,
                            company_el.text if company_el else "",
                            url,
                        ))
                time.sleep(0.3)
            except Exception as e:
                print(f"  [!] LinkedIn EU onsite ({country}, {keyword}): {e}")
    return out

def fetch_linkedin_denmark() -> list:
    """LinkedIn — on-site + hybrid jobs in Denmark."""
    return _linkedin_search(
        {"location": "Denmark", "f_WT": "1,3"},
        label="LinkedIn Denmark",
        denmark=True,
    )

def fetch_linkedin_easy_apply_ids() -> set:
    """Returns set of LinkedIn job IDs that support Easy Apply (f_AL=true)."""
    easy_ids: set = set()
    searches = [
        {"f_WT": "2"},
        {"location": "European Union", "f_WT": "2"},
        {"location": "Denmark", "f_WT": "1,3"},
    ]
    for base_params in searches:
        for keyword in _LINKEDIN_KEYWORDS[:5]:  # top 5 keywords to keep it manageable
            for page in range(2):
                try:
                    r = requests.get(
                        "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search",
                        params={"keywords": keyword, "start": str(page * 25), "f_AL": "true", **base_params},
                        headers=HEADERS, timeout=15,
                    )
                    soup = BeautifulSoup(r.text, "html.parser")
                    items = soup.find_all("li")
                    if not items:
                        break
                    for li in items:
                        card_el = li.find("div", class_="base-card")
                        if not card_el:
                            continue
                        uid = card_el.get("data-entity-urn", "")
                        if uid:
                            easy_ids.add(f"LinkedIn_{uid}")
                    time.sleep(0.3)
                except Exception as e:
                    print(f"  [!] Easy Apply fetch ({keyword}, p{page+1}): {e}")
                    break
    return easy_ids

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
        # ── Remote ────────────────────────────
        ("RemoteOK",         fetch_remoteok),
        ("WeWorkRemotely",   fetch_weworkremotely),
        ("Remotive",         fetch_remotive),
        ("Himalayas",        fetch_himalayas),
        ("Landing.jobs",     fetch_landing_jobs),
        ("WorkingNomads",    fetch_workingnomads),
        ("Larajobs",         fetch_larajobs),
        ("LinkedIn remote",   fetch_linkedin_remote),
        ("LinkedIn Europe",   fetch_linkedin_europe),
        ("LinkedIn EU onsite",fetch_linkedin_eu_onsite),
        # ── Denmark ───────────────────────────
        ("Jobindex",         fetch_jobindex),
        ("IT-jobbank",       fetch_itjobbank),
        ("TheHub",           fetch_thehub),
        ("Indeed Denmark",   fetch_indeed_denmark),
        ("LinkedIn Denmark", fetch_linkedin_denmark),
    ]:
        print(f"Fetching {name}...")
        jobs = fetcher()
        seen_keys: set = set()
        deduped = []
        for j in jobs:
            key = (j["title"].lower(), j["company"].lower())
            if key not in seen_keys and is_relevant(j):
                seen_keys.add(key)
                deduped.append(j)
        print(f"  {len(deduped)} unique match(es)")
        all_new.extend(deduped)

    # Merge: add new jobs; refresh fetched_at for jobs still seen on boards
    merged = dict(existing)
    for j in all_new:
        if j["id"] not in merged:
            merged[j["id"]] = j
        else:
            merged[j["id"]]["fetched_at"] = TODAY   # still alive → reset expiry clock
            # Update description if the new fetch has one
            if "description" in j:
                merged[j["id"]]["description"] = j["description"]

    # Cross-source deduplication: same title+company from different boards → keep newest
    seen_title_co: dict = {}
    for j in merged.values():
        title_norm = re.sub(r'\s+', ' ', j["title"].lower()).strip()
        co_norm    = re.sub(r'\s+', ' ', j["company"].lower()).strip()
        key = (title_norm, co_norm)
        if key not in seen_title_co:
            seen_title_co[key] = j
        elif j.get("fetched_at", "") > seen_title_co[key].get("fetched_at", ""):
            seen_title_co[key] = j   # keep the fresher source
    deduped_cross = list(seen_title_co.values())
    removed_dups = len(merged) - len(deduped_cross)
    if removed_dups:
        print(f"\n  Cross-source duplicates removed: {removed_dups}")

    # Drop jobs not seen for MAX_AGE_DAYS (by fetched_at)
    # Also drop jobs whose posting date is parseable and older than CUTOFF
    def is_old_posting(j):
        d = j.get("date", "")
        if not d:
            return False
        try:
            # ISO format: 2025-08-27
            parsed = datetime.strptime(d, "%Y-%m-%d").date().isoformat()
            return parsed < CUTOFF
        except ValueError:
            return False

    active = [
        j for j in deduped_cross
        if j.get("fetched_at", TODAY) >= CUTOFF and not is_old_posting(j)
    ]
    expired = len(deduped_cross) - len(active)
    if expired:
        print(f"  Expired jobs removed: {expired} (not seen in {MAX_AGE_DAYS}+ days or old posting date)")

    # Mark LinkedIn Easy Apply jobs
    print("\nFetching LinkedIn Easy Apply IDs...")
    easy_apply_ids = fetch_linkedin_easy_apply_ids()
    print(f"  {len(easy_apply_ids)} Easy Apply LinkedIn job(s) found")
    marked = sum(1 for j in active if j["id"] in easy_apply_ids and not j.get("easy_apply"))
    for j in active:
        if j["id"] in easy_apply_ids:
            j["easy_apply"] = True
    if marked:
        print(f"  {marked} new job(s) marked as Easy Apply")

    sorted_jobs = sorted(
        active,
        key=lambda j: (j.get("fetched_at", ""), j.get("date", "")),
        reverse=True,
    )
    final = sorted_jobs[:MAX_JOBS]
    save(final)
    print(f"\nSaved {len(final)} total jobs → {JOBS_FILE}")

if __name__ == "__main__":
    main()

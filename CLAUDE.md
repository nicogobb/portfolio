# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal portfolio and job-search toolkit for Nicolas Gobbi — Full Stack Developer / PHP Backend, 10+ years experience, based in Copenhagen. Hosted on GitHub Pages at `nicogobb.github.io/portfolio/`.

Vanilla static site (no build tools, no package manager, no framework). Changes take effect immediately in the browser.

## Development

Open `index.html` directly in a browser, or serve it with any simple HTTP server:

```bash
python3 -m http.server 8000
```

No lint, test, or build commands.

## Architecture

### Frontend (static site)

- **`index.html`** — single-page structure. Section order: Hero → About → Experience → Projects → Skills → Contact → (Jobs — password-gated, not in nav)
- **`css/styles.css`** — all styling. Terminal/hacker aesthetic: `--primary-color: #00ff00` (Matrix green). Uses `--primary-rgb: 0, 255, 0` for `rgba()` values so a palette change only requires editing two variables in `:root`. BEM naming (`.nav__logo`, `.hero__title`, `.skill__card`).
- **`js/main.js`** — all interactivity: mobile nav, scroll animations via `IntersectionObserver` (`animate-hidden` / `animate-in`), active nav tracking, job board logic, cover letter modal.

### Skills hierarchy

Skills use a two-tier CSS system:
- `.skill__tag` — secondary skills (toned down, low opacity)
- `.skill__tag--core` — primary skills (bright green, bold, subtle glow)

### Job Board (`#jobs`)

Password-gated section (not in nav — accessed via `/#jobs`). Password hash stored in `JOBS_HASH` constant in `main.js` (SHA-256). After unlock, the session hash is held in `sessionToken` (in-memory only, cleared on lock).

Features: remote/denmark tabs, filter by status (all/pending/applied/no visa), search, AI match scores, cover letter generation.

### Cover Letter (browser → Cloudflare Worker → Groq)

Each job card with a description shows a `✉ letter` button. On click:
1. Browser POSTs to the Cloudflare Worker at `https://cover-letter-worker.nicogobb-letter.workers.dev/`
2. Auth via `Authorization: Bearer <sessionToken>` (the board password hash)
3. Worker validates token against `AUTH_TOKEN` secret, calls Groq API with `LETTER_API_KEY` secret
4. Returns generated cover letter — displayed in a modal with a copy button

No API keys stored in the browser or localStorage. Worker code lives in `worker/index.js`.

### Scraper (GitHub Actions, daily)

`scraper/` contains three Python scripts:
- **`job_hunter.py`** — scrapes job listings, writes to `jobs.json`
- **`job_scorer.py`** — scores each job's fit via Groq API (`GROQ_API_KEY` GitHub secret, free tier)
- **`cover_letter.py`** — CLI cover letter generator (uses `LETTER_API_KEY` env var)

```bash
# CLI usage:
python3 scraper/cover_letter.py --job-id "Jobindex_https://..."
python3 scraper/cover_letter.py --desc "job description..." --company "Acme" --title "Senior PHP Dev"
python3 scraper/cover_letter.py --job-id "..." --out carta.txt
```

Workflow: `.github/workflows/job_scraper.yml` — runs daily, commits updated `jobs.json`.

### Cloudflare Worker

`worker/index.js` — deployed to Cloudflare Workers (free tier, 100k req/day).

```bash
cd worker
wrangler deploy
wrangler secret put LETTER_API_KEY   # Groq API key
wrangler secret put AUTH_TOKEN       # SHA-256 of board password (same as JOBS_HASH)
wrangler secret list                 # verify secrets exist (values not shown)
wrangler secret delete <NAME>        # remove a secret
```

## Other files

- **`GITHUB_PROFILE_README.md`** — ready-to-deploy GitHub profile README for `nicogobb/nicogobb` repo. Deploy instructions inside the file.
- **`CV_NicolasGobbi.pdf`** — linked from hero CTA and nav.
- **`jobs.json`** — auto-updated daily by the scraper workflow.

## Design decisions (context for future sessions)

- **Color:** `#00ff00` Matrix green was tested against `#0dbc79` (VS Code) and `#00e676` (Material) — user preferred the original. When trying new colors, change only `--primary-color` and `--primary-rgb` in `:root`.
- **Hero:** "Hello, World!" removed (cliché). Terminal `const developer = {}` block removed (duplicated About). Stats (10k vehicles, etc.) moved to About text. Tagline added.
- **Sections removed:** "Now" section (nownownow concept, broke recruiter flow).
- **Projects:** Private work → `🔒 Private codebase` badge instead of broken GitHub root link. Portfolio project keeps its real link.
- **Footer:** Simplified to copyright only — contact info lives in the `#contact` section.

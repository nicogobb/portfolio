// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Mobile Menu Toggle
    const navToggle = document.querySelector('.nav__toggle');
    const navMenu = document.querySelector('.nav__menu');
    const body = document.body;
    
    if (navToggle && navMenu) {
        navToggle.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event from bubbling
            navToggle.classList.toggle('active');
            navMenu.classList.toggle('active');
            body.classList.toggle('menu-open'); // Prevent scrolling when menu is open
        });
    }

    // Close mobile menu when clicking outside
    document.addEventListener('click', (e) => {
        if (navMenu && navMenu.classList.contains('active')) {
            if (!navToggle.contains(e.target) && !navMenu.contains(e.target)) {
                navToggle.classList.remove('active');
                navMenu.classList.remove('active');
                body.classList.remove('menu-open');
            }
        }
    });

    // Close menu when clicking a link
    const navLinks = document.querySelectorAll('.nav__menu a');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navToggle.classList.remove('active');
            navMenu.classList.remove('active');
            body.classList.remove('menu-open');
        });
    });

    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                // Close mobile menu when clicking a link
                navToggle.classList.remove('active');
                navMenu.classList.remove('active');
                
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Navbar scroll behavior
    const nav = document.querySelector('.nav');

    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 50) {
            nav.style.backgroundColor = 'rgba(10, 10, 10, 0.95)';
        } else {
            nav.style.backgroundColor = 'rgba(10, 10, 10, 0.9)';
        }
    });

    // Add transition effect for navbar
    nav.style.transition = 'all 0.3s ease-in-out';

    // Form submission handling
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            // Add your form submission logic here
            alert('Thank you for your message! I will get back to you soon.');
            contactForm.reset();
        });
    }

    // Animate elements on scroll
    const observerOptions = {
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
            }
        });
    }, observerOptions);

    // Observe all sections and project cards
    document.querySelectorAll('.section, .project__card, .skill__card').forEach(el => {
        el.classList.add('animate-hidden');
        observer.observe(el);
    });

    // ── Active nav link on scroll ─────────────────────────────────────────────
    const navAnchors = document.querySelectorAll('.nav__menu a[href^="#"]');
    const pageSections = document.querySelectorAll('section[id]');

    const activeSectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                navAnchors.forEach(a => {
                    a.classList.toggle('active', a.getAttribute('href') === '#' + entry.target.id);
                });
            }
        });
    }, { threshold: 0.25, rootMargin: '-70px 0px -55% 0px' });

    pageSections.forEach(s => activeSectionObserver.observe(s));

    // ── Scroll to top button ──────────────────────────────────────────────────
    const scrollTopBtn = document.getElementById('scrollTop');

    window.addEventListener('scroll', () => {
        scrollTopBtn.classList.toggle('visible', window.pageYOffset > 400);
    });

    scrollTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });




    // ── Jobs Section (password-gated) ─────────────────────────────────────────
    //
    // Password hash — SHA-256 of your chosen passphrase.
    // To set your password, run:
    //   python3 -c "import hashlib; print(hashlib.sha256(b'YOUR_PASSWORD').hexdigest())"
    // Then replace the string below with the output.
    const JOBS_HASH = '3200a02125577bd480a8d07e60594d898e35a20e7834056150dccf335244de99';

    const jobsGate    = document.getElementById('jobs-gate');
    const jobsContent = document.getElementById('jobs-content');

    if (!jobsGate) return; // jobs section not present

    async function sha256(str) {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // ── Cover Letter ─────────────────────────────────────────────────────────────

    const GROQ_URL    = 'https://api.groq.com/openai/v1/chat/completions';
    const GROQ_MODEL  = 'llama-3.1-8b-instant';
    const LETTER_KEY  = 'letter_api_key';

    const YOUR_PROFILE = `PHP Backend / Full-Stack Developer, 10+ years experience.

Career:
- Software Engineer at Maxtracker (Aug 2025–present): fleet telematics platform, 10,000+ vehicles, PHP/Kohana/PostgreSQL, real-time data pipelines.
- PHP Web Developer at mydigitalnomads (Apr 2022–Aug 2025): large-scale SaaS, fully remote, PHP/MySQL/TypeScript/Docker.
- Web Developer at OSPL (Nov 2019–present, part-time): health insurance system, 20,000+ affiliates, PHP/MySQL.
- DBA at Mutual Senderos (2014–2019): started career in database administration, grew into full-stack web development.

Core skills: PHP 8, Laravel, Symfony, Kohana, CodeIgniter, MySQL, PostgreSQL, MongoDB, REST APIs, JavaScript, TypeScript, Git, Docker, GitHub Actions, Linux/Shell, Web Scraping.
Location: Copenhagen, Denmark — open to remote or on-site. Languages: Spanish (native), English (professional), Danish (learning).`;

    function getApiKey() { return localStorage.getItem(LETTER_KEY) || ''; }

    // API key modal
    const apikeyOverlay = document.getElementById('apikey-overlay');
    document.getElementById('jobs-apikey-btn').addEventListener('click', () => {
        document.getElementById('apikey-input').value = getApiKey();
        apikeyOverlay.classList.add('visible');
        setTimeout(() => document.getElementById('apikey-input').focus(), 50);
    });
    document.getElementById('apikey-close').addEventListener('click', () => apikeyOverlay.classList.remove('visible'));
    document.getElementById('apikey-save').addEventListener('click', () => {
        const val = document.getElementById('apikey-input').value.trim();
        if (val) localStorage.setItem(LETTER_KEY, val);
        else localStorage.removeItem(LETTER_KEY);
        apikeyOverlay.classList.remove('visible');
    });
    apikeyOverlay.addEventListener('click', e => { if (e.target === apikeyOverlay) apikeyOverlay.classList.remove('visible'); });

    // Cover letter modal
    const clOverlay = document.getElementById('cl-overlay');
    const clBody    = document.getElementById('cl-body');
    document.getElementById('cl-close').addEventListener('click', () => clOverlay.classList.remove('visible'));
    clOverlay.addEventListener('click', e => { if (e.target === clOverlay) clOverlay.classList.remove('visible'); });
    document.getElementById('cl-copy').addEventListener('click', () => {
        navigator.clipboard.writeText(clBody.textContent).then(() => {
            const btn = document.getElementById('cl-copy');
            btn.textContent = '✓ copied!';
            setTimeout(() => { btn.textContent = 'copy'; }, 2000);
        });
    });

    async function generateCoverLetter(job) {
        const apiKey = getApiKey();
        if (!apiKey) {
            document.getElementById('apikey-input').value = '';
            apikeyOverlay.classList.add('visible');
            setTimeout(() => document.getElementById('apikey-input').focus(), 50);
            return;
        }

        clBody.textContent   = 'Generating…';
        clBody.dataset.state = 'loading';
        clOverlay.classList.add('visible');

        const prompt = `Write a professional cover letter for the job posting below, tailored to the candidate's profile.

## Candidate profile
${YOUR_PROFILE}

## Job posting
Role: ${job.title || '(not specified)'}
Company: ${job.company || '(not specified)'}
Description: ${job.description}

## Instructions
- 3–4 paragraphs, no salutation header, no sign-off/closing line — body paragraphs only.
- Opening: do NOT use "I am writing to express my interest". Start with a direct statement of fit or value.
- Reference specific numbers from the candidate's background (10,000+ vehicles, 20,000+ affiliates, 10+ years).
- Mention 2–3 technologies from the job description that the candidate actually has.
- Tone: direct, confident, professional — not generic or boilerplate.
- If the company name is known, use it naturally — no placeholders like [Company Name].
- Write in English. Output ONLY the cover letter body — no intro, no commentary.`;

        try {
            const resp = await fetch(GROQ_URL, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: GROQ_MODEL,
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 800,
                    temperature: 0.7,
                }),
            });
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                throw new Error(err?.error?.message || `HTTP ${resp.status}`);
            }
            const data   = await resp.json();
            const letter = data.choices[0].message.content.trim();
            clBody.textContent   = letter;
            clBody.dataset.state = 'done';
        } catch (err) {
            clBody.textContent   = `[!] Error: ${err.message}`;
            clBody.dataset.state = 'error';
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────

    function showJobs() {
        jobsGate.style.display    = 'none';
        jobsContent.classList.add('visible');
        loadJobs();
    }

    function lockJobs() {
        jobsGate.style.display = '';
        jobsContent.classList.remove('visible');
        document.getElementById('jobs-password').value = '';
        document.getElementById('jobs-error').classList.remove('visible');
    }

    const APPLIED_KEY = 'jobs_applied_v1';
    const NOVISA_KEY  = 'jobs_novisa_v1';
    let appliedJobs   = new Set(JSON.parse(localStorage.getItem(APPLIED_KEY) || '[]'));
    let noVisaJobs    = new Set(JSON.parse(localStorage.getItem(NOVISA_KEY)  || '[]'));
    let allJobsData   = [];
    let currentView   = 'remote';   // 'remote' | 'denmark'
    let currentFilter = 'all';      // 'all' | 'pending' | 'applied' | 'no visa'
    let searchQuery   = '';         // free-text search

    function saveApplied() {
        localStorage.setItem(APPLIED_KEY, JSON.stringify([...appliedJobs]));
        localStorage.setItem(NOVISA_KEY,  JSON.stringify([...noVisaJobs]));
    }

    function renderJobs(jobs) {
        allJobsData = jobs;
        const meta      = document.getElementById('jobs-meta');
        const list      = document.getElementById('jobs-list');
        const filtersEl = document.getElementById('jobs-filters');

        const byRemote  = jobs.filter(j => !j.denmark);
        const byDenmark = jobs.filter(j =>  j.denmark);
        const byView    = currentView === 'denmark' ? byDenmark : byRemote;

        const byStatus  = currentFilter === 'applied'  ? byView.filter(j =>  appliedJobs.has(j.id))
                        : currentFilter === 'no visa'  ? byView.filter(j =>  noVisaJobs.has(j.id))
                        : currentFilter === 'pending'   ? byView.filter(j => !appliedJobs.has(j.id) && !noVisaJobs.has(j.id))
                        : byView;

        const q        = searchQuery.trim().toLowerCase();
        const filtered = (q
            ? byStatus.filter(j =>
                j.title.toLowerCase().includes(q) ||
                (j.company || '').toLowerCase().includes(q) ||
                (j.source  || '').toLowerCase().includes(q))
            : byStatus)
            .slice()
            .sort((a, b) => (b.match_score || 0) - (a.match_score || 0));

        const nApplied = byView.filter(j =>  appliedJobs.has(j.id)).length;
        const nNoVisa  = byView.filter(j =>  noVisaJobs.has(j.id)).length;
        const nPending = byView.length - nApplied - nNoVisa;
        const parts    = [`${nPending} pending`];
        if (nApplied) parts.push(`${nApplied} applied`);
        if (nNoVisa)  parts.push(`${nNoVisa} no visa`);
        meta.textContent = `$ jobs --${currentView} · ${parts.join(' · ')}`;

        filtersEl.innerHTML = `
            <div class="jobs__views">
                <button class="jobs__view${currentView === 'remote'  ? ' jobs__view--active' : ''}" data-view="remote">remote <span class="jobs__view-count">(${byRemote.length})</span></button>
                <button class="jobs__view${currentView === 'denmark' ? ' jobs__view--active' : ''}" data-view="denmark">denmark <span class="jobs__view-count">(${byDenmark.length})</span></button>
            </div>
            <div class="jobs__search-wrap">
                <input class="jobs__search" id="jobs-search" type="text" placeholder="$ search title, company, source..." value="${searchQuery.replace(/"/g, '&quot;')}">
            </div>
            <div class="jobs__statuses">
                ${['all', 'pending', 'applied', 'no visa'].map(f =>
                    `<button class="jobs__filter${f === currentFilter ? ' jobs__filter--active' : ''}" data-filter="${f}">${f}</button>`
                ).join('')}
            </div>`;

        if (!filtered.length) {
            list.innerHTML = `<p style="font-family:var(--font-main);color:var(--light-text);padding:1rem 0">No ${currentFilter} listings.</p>`;
            return;
        }

        function jobMatchBar(j) {
            const score = j.match_score;
            if (score == null) return '';
            const conf  = j.match_confidence || 'low';
            const tier  = score >= 75 ? 'high' : score >= 50 ? 'medium' : 'low';
            const label = conf === 'low' ? `~${score}%` : `${score}%`;
            const cls   = conf === 'low' ? ' jobs__match--uncertain' : '';
            const pros  = (j.match_pros || []).map(p => `<span class="jobs__hint jobs__hint--pro">✓ ${p}</span>`).join('');
            const cons  = (j.match_cons || []).map(c => `<span class="jobs__hint jobs__hint--con">✗ ${c}</span>`).join('');
            const hints = pros || cons ? `<div class="jobs__match-hints">${pros}${cons}</div>` : '';
            return `<div class="jobs__match${cls}">
                <div class="jobs__match-track">
                    <div class="jobs__match-fill jobs__match-fill--${tier}" style="width:${score}%"></div>
                </div>
                <span class="jobs__match-label jobs__match-label--${tier}">${label}</span>
            </div>${hints}`;
        }

        list.innerHTML = filtered.map(j => {
            const applied = appliedJobs.has(j.id);
            const novisa  = noVisaJobs.has(j.id);
            const cardCls = applied ? ' jobs__card--applied' : novisa ? ' jobs__card--novisa' : '';
            return `
            <div class="jobs__card${cardCls}">
                <a class="jobs__card-title" href="${j.url}" target="_blank" rel="noopener noreferrer">${j.title}</a>
                <span class="jobs__card-company">${j.company || '—'}${j.salary ? ` <span class="jobs__salary">${j.salary}</span>` : ''}</span>
                <div class="jobs__card-meta">
                    <span class="jobs__badge jobs__badge--${j.source}">${j.source}</span>
                    ${j.date ? `<span class="jobs__date">${j.date}</span>` : ''}
                    <button class="jobs__apply-btn${applied ? ' jobs__apply-btn--done' : ''}" data-id="${j.id}" data-action="apply">
                        ${applied ? '✓ applied' : '+ apply'}
                    </button>
                    <button class="jobs__novisa-btn${novisa ? ' jobs__novisa-btn--on' : ''}" data-id="${j.id}" data-action="novisa">
                        ${novisa ? '⊘ no visa' : '⊘ visa req.'}
                    </button>
                    ${j.description ? `<button class="jobs__letter-btn" data-id="${j.id}" data-action="letter">✉ letter</button>` : ''}
                </div>
                ${jobMatchBar(j)}
            </div>`;
        }).join('');
    }

    function showUpdateStatus(updatedAt) {
        const el = document.getElementById('jobs-updated');
        if (!el || !updatedAt) return;

        const diffMs = Date.now() - new Date(updatedAt).getTime();
        const diffH  = Math.floor(diffMs / 36e5);
        const diffD  = Math.floor(diffH / 24);

        let dot, label;
        if (diffH < 24) {
            dot   = '●';
            label = diffH < 1 ? 'updated just now' : `updated ${diffH}h ago`;
            el.style.color = 'var(--primary-color)';
        } else if (diffD === 1) {
            dot   = '●';
            label = 'updated yesterday';
            el.style.color = '#ffbd2e';
        } else {
            dot   = '⚠';
            label = `last update ${diffD}d ago — scraper may have failed`;
            el.style.color = '#ff5f56';
        }

        el.textContent = `${dot} ${label}`;
    }

    async function loadJobs() {
        const list = document.getElementById('jobs-list');
        list.innerHTML = '<p style="font-family:var(--font-main);color:var(--light-text);padding:1rem 0">Loading...</p>';
        try {
            const r    = await fetch('jobs.json?t=' + Date.now());
            const data = await r.json();
            showUpdateStatus(data.updated_at);
            renderJobs(data.jobs || []);
        } catch {
            list.innerHTML = '<p style="font-family:var(--font-main);color:#ff4444;padding:1rem 0">[!] Could not load jobs.json</p>';
        }
    }

    async function tryUnlock() {
        const pw = document.getElementById('jobs-password').value;
        const errEl = document.getElementById('jobs-error');
        if (!pw) return;
        const hash = await sha256(pw);
        if (hash === JOBS_HASH) {
            errEl.classList.remove('visible');
            showJobs();
        } else {
            errEl.classList.add('visible');
            document.getElementById('jobs-password').value = '';
        }
    }

    // Apply / no-visa toggle (event delegation)
    document.getElementById('jobs-list').addEventListener('click', e => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const id     = btn.dataset.id;
        const action = btn.dataset.action;

        if (action === 'apply') {
            if (appliedJobs.has(id)) {
                appliedJobs.delete(id);          // undo applied
            } else {
                appliedJobs.add(id);
                noVisaJobs.delete(id);           // exclusive: clear no-visa
            }
        } else if (action === 'novisa') {
            if (noVisaJobs.has(id)) {
                noVisaJobs.delete(id);           // undo no-visa
            } else {
                noVisaJobs.add(id);
                appliedJobs.delete(id);          // exclusive: clear applied
            }
        } else if (action === 'letter') {
            const job = allJobsData.find(j => j.id === id);
            if (job) generateCoverLetter(job);
            return;
        }

        saveApplied();
        renderJobs(allJobsData);
    });

    // View + filter toggles (event delegation)
    document.getElementById('jobs-filters').addEventListener('click', e => {
        const viewBtn   = e.target.closest('.jobs__view');
        const filterBtn = e.target.closest('.jobs__filter');
        if (viewBtn)   { currentView   = viewBtn.dataset.view;     renderJobs(allJobsData); }
        if (filterBtn) { currentFilter = filterBtn.dataset.filter; renderJobs(allJobsData); }
    });

    // Search input (event delegation — input is re-rendered on each renderJobs)
    document.getElementById('jobs-filters').addEventListener('input', e => {
        if (e.target.id === 'jobs-search') {
            searchQuery = e.target.value;
            renderJobs(allJobsData);
        }
    });

    document.getElementById('jobs-submit').addEventListener('click', tryUnlock);
    document.getElementById('jobs-password').addEventListener('keydown', e => {
        if (e.key === 'Enter') tryUnlock();
    });
    document.getElementById('jobs-lock').addEventListener('click', lockJobs);
});

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

    // ── Typewriter effect for hero terminal ───────────────────────────────────
    (function runTypewriter() {
        const terminal = document.getElementById('hero-terminal');
        if (!terminal) return;

        const lines = terminal.querySelectorAll('.terminal__line');
        if (!lines.length) return;

        const texts = Array.from(lines).map(el => el.textContent);

        const CHAR_DELAY = 22;   // ms per character
        const LINE_PAUSE = 130;  // ms pause between lines

        // Wait for fonts so offsetHeight is accurate, then lock size and start
        document.fonts.ready.then(() => {
            terminal.style.minHeight = terminal.offsetHeight + 'px';
            terminal.style.width     = terminal.offsetWidth  + 'px';
            lines.forEach(el => { el.textContent = ''; });

            let lineIdx = 0;
            let charIdx = 0;

            function tick() {
                if (lineIdx >= lines.length) {
                    // Typing complete — append blinking cursor to last line
                    const cursor = document.createElement('span');
                    cursor.className = 'typewriter-cursor';
                    cursor.textContent = '▋';
                    lines[lines.length - 1].appendChild(cursor);
                    return;
                }
                const line = lines[lineIdx];
                const text = texts[lineIdx];

                if (charIdx < text.length) {
                    line.textContent = text.substring(0, charIdx + 1);
                    charIdx++;
                    setTimeout(tick, CHAR_DELAY);
                } else {
                    lineIdx++;
                    charIdx = 0;
                    setTimeout(tick, LINE_PAUSE);
                }
            }

            setTimeout(tick, 500);
        });
    })();

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
        const filtered = q
            ? byStatus.filter(j =>
                j.title.toLowerCase().includes(q) ||
                (j.company || '').toLowerCase().includes(q) ||
                (j.source  || '').toLowerCase().includes(q))
            : byStatus;

        meta.textContent = `$ jobs --${currentView} · ${filtered.length} listing(s)`;

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

        list.innerHTML = filtered.map(j => {
            const applied = appliedJobs.has(j.id);
            const novisa  = noVisaJobs.has(j.id);
            const cardCls = applied ? ' jobs__card--applied' : novisa ? ' jobs__card--novisa' : '';
            return `
            <div class="jobs__card${cardCls}">
                <a class="jobs__card-title" href="${j.url}" target="_blank" rel="noopener noreferrer">${j.title}</a>
                <span class="jobs__card-company">${j.company || '—'}</span>
                <div class="jobs__card-meta">
                    <span class="jobs__badge jobs__badge--${j.source}">${j.source}</span>
                    ${j.date ? `<span class="jobs__date">${j.date}</span>` : ''}
                    <button class="jobs__apply-btn${applied ? ' jobs__apply-btn--done' : ''}" data-id="${j.id}" data-action="apply">
                        ${applied ? '✓ applied' : '+ apply'}
                    </button>
                    <button class="jobs__novisa-btn${novisa ? ' jobs__novisa-btn--on' : ''}" data-id="${j.id}" data-action="novisa">
                        ${novisa ? '⊘ no visa' : '⊘ visa req.'}
                    </button>
                </div>
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

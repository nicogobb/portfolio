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
    const jobsGate    = document.getElementById('jobs-gate');
    const jobsContent = document.getElementById('jobs-content');

    if (!jobsGate) return; // jobs section not present

    // ── Cover Letter ─────────────────────────────────────────────────────────────
    // Auth: uses the board password hash as Bearer token (set during unlock).
    // Key stays in Cloudflare secrets — nothing stored in localStorage or the browser.

    const WORKER_URL  = 'https://cover-letter-worker.nicogobb-letter.workers.dev/';
    const WORKER_AUTH = 'https://cover-letter-worker.nicogobb-letter.workers.dev/auth';
    let   sessionToken = '';   // set on board unlock, cleared on lock

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
        clBody.textContent   = 'Generating…';
        clBody.dataset.state = 'loading';
        clOverlay.classList.add('visible');

        try {
            const resp = await fetch(WORKER_URL, {
                method:  'POST',
                headers: {
                    'Authorization': `Bearer ${sessionToken}`,
                    'Content-Type':  'application/json',
                },
                body: JSON.stringify({
                    description: job.description,
                    title:       job.title   || '',
                    company:     job.company || '',
                }),
            });
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                throw new Error(err?.error || `HTTP ${resp.status}`);
            }
            const { letter } = await resp.json();
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
        sessionToken           = '';
        jobsGate.style.display = '';
        jobsContent.classList.remove('visible');
        document.getElementById('jobs-password').value = '';
        document.getElementById('jobs-error').classList.remove('visible');
    }

    const APPLIED_KEY     = 'jobs_applied_v2';  // {id: ISO timestamp}
    const APPLIED_KEY_OLD = 'jobs_applied_v1';  // legacy: array of IDs
    const NOVISA_KEY      = 'jobs_novisa_v1';
    const CLOSED_KEY      = 'jobs_closed_v1';
    const REJECTED_KEY    = 'jobs_rejected_v1';

    // Migrate v1 → v2 (Set of IDs → Map of {id: timestamp})
    const _v2 = localStorage.getItem(APPLIED_KEY);
    const _v1 = JSON.parse(localStorage.getItem(APPLIED_KEY_OLD) || '[]');
    let appliedJobs;
    if (_v2 !== null) {
        appliedJobs = new Map(Object.entries(JSON.parse(_v2)));
    } else if (_v1.length) {
        appliedJobs = new Map(_v1.map(id => [id, '']));
        localStorage.setItem(APPLIED_KEY, JSON.stringify(Object.fromEntries(appliedJobs)));
        localStorage.removeItem(APPLIED_KEY_OLD);
    } else {
        appliedJobs = new Map();
    }

    let noVisaJobs    = new Set(JSON.parse(localStorage.getItem(NOVISA_KEY)   || '[]'));
    let closedJobs    = new Set(JSON.parse(localStorage.getItem(CLOSED_KEY)   || '[]'));
    let rejectedJobs  = new Set(JSON.parse(localStorage.getItem(REJECTED_KEY) || '[]'));
    let allJobsData   = [];
    let currentView   = 'remote';   // 'remote' | 'hybrid' | 'onsite'
    let currentFilter = 'all';      // 'all' | 'pending' | 'applied' | 'no visa'
    let searchQuery   = '';         // free-text search
    let currentPage   = 1;
    const PAGE_SIZE   = 15;

    function saveApplied() {
        localStorage.setItem(APPLIED_KEY, JSON.stringify(Object.fromEntries(appliedJobs)));
        localStorage.setItem(NOVISA_KEY,   JSON.stringify([...noVisaJobs]));
        localStorage.setItem(CLOSED_KEY,   JSON.stringify([...closedJobs]));
        localStorage.setItem(REJECTED_KEY, JSON.stringify([...rejectedJobs]));
    }

    function formatAppliedAt(iso) {
        if (!iso) return '✓ applied';
        const diff = Math.floor((Date.now() - new Date(iso)) / 864e5);
        if (diff === 0) return '✓ today';
        if (diff === 1) return '✓ yesterday';
        if (diff <  7) return `✓ ${diff}d ago`;
        const d = new Date(iso);
        return `✓ ${d.toLocaleDateString('en', { month: 'short', day: 'numeric' })}`;
    }

    function renderJobs(jobs) {
        allJobsData = jobs;
        const meta      = document.getElementById('jobs-meta');
        const list      = document.getElementById('jobs-list');
        const filtersEl = document.getElementById('jobs-filters');

        const byRemote  = jobs.filter(j => j.work_type === 'remote'  || (!j.work_type && !j.denmark));
        const byHybrid  = jobs.filter(j => j.work_type === 'hybrid');
        const byOnsite  = jobs.filter(j => j.work_type === 'onsite'  || (!j.work_type && j.denmark));
        const byView    = currentView === 'hybrid' ? byHybrid : currentView === 'onsite' ? byOnsite : byRemote;

        const byStatus  = currentFilter === 'applied'    ? byView.filter(j =>  appliedJobs.has(j.id))
                        : currentFilter === 'no visa'   ? byView.filter(j =>  noVisaJobs.has(j.id))
                        : currentFilter === 'closed'    ? byView.filter(j =>  closedJobs.has(j.id))
                        : currentFilter === 'rejected'  ? byView.filter(j =>  rejectedJobs.has(j.id))
                        : currentFilter === 'pending'   ? byView.filter(j => !appliedJobs.has(j.id) && !noVisaJobs.has(j.id) && !closedJobs.has(j.id) && !rejectedJobs.has(j.id))
                        : currentFilter === 'easy apply'? byView.filter(j =>  j.easy_apply && !appliedJobs.has(j.id) && !noVisaJobs.has(j.id) && !closedJobs.has(j.id) && !rejectedJobs.has(j.id))
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

        const nApplied   = byView.filter(j =>  appliedJobs.has(j.id)).length;
        const nNoVisa    = byView.filter(j =>  noVisaJobs.has(j.id)).length;
        const nClosed    = byView.filter(j =>  closedJobs.has(j.id)).length;
        const nRejected  = byView.filter(j =>  rejectedJobs.has(j.id)).length;
        const nEasyApply = byView.filter(j =>  j.easy_apply && !appliedJobs.has(j.id) && !noVisaJobs.has(j.id) && !closedJobs.has(j.id) && !rejectedJobs.has(j.id)).length;
        const nPending   = byView.length - nApplied - nNoVisa - nClosed - nRejected;
        const parts      = [`${nPending} pending`];
        if (nEasyApply) parts.push(`${nEasyApply} easy apply`);
        if (nApplied)   parts.push(`${nApplied} applied`);
        if (nRejected)  parts.push(`${nRejected} rejected`);
        if (nNoVisa)    parts.push(`${nNoVisa} no visa`);
        if (nClosed)    parts.push(`${nClosed} closed`);
        meta.textContent = `$ jobs --${currentView} · ${parts.join(' · ')}`;

        const searchWasFocused = document.activeElement?.id === 'jobs-search';
        const searchCursor     = searchWasFocused ? document.getElementById('jobs-search')?.selectionStart : null;

        filtersEl.innerHTML = `
            <div class="jobs__views">
                <button class="jobs__view${currentView === 'remote'  ? ' jobs__view--active' : ''}" data-view="remote">remote <span class="jobs__view-count">(${byRemote.length})</span></button>
                <button class="jobs__view${currentView === 'hybrid'  ? ' jobs__view--active' : ''}" data-view="hybrid">hybrid <span class="jobs__view-count">(${byHybrid.length})</span></button>
                <button class="jobs__view${currentView === 'onsite'  ? ' jobs__view--active' : ''}" data-view="onsite">onsite <span class="jobs__view-count">(${byOnsite.length})</span></button>
            </div>
            <div class="jobs__search-wrap">
                <input class="jobs__search" id="jobs-search" type="text" placeholder="$ search title, company, source..." value="${searchQuery.replace(/"/g, '&quot;')}">
            </div>
            <div class="jobs__statuses">
                ${['all', 'pending', 'easy apply', 'applied', 'rejected', 'no visa', 'closed'].map(f =>
                    `<button class="jobs__filter${f === currentFilter ? ' jobs__filter--active' : ''}" data-filter="${f}">${f === 'easy apply' ? '⚡ easy apply' : f}</button>`
                ).join('')}
            </div>`;

        if (searchWasFocused) {
            const el = document.getElementById('jobs-search');
            el.focus();
            el.setSelectionRange(searchCursor, searchCursor);
        }

        if (!filtered.length) {
            list.innerHTML = `<p style="font-family:var(--font-main);color:var(--light-text);padding:1rem 0">No ${currentFilter} listings.</p>`;
            document.getElementById('jobs-pagination').innerHTML = '';
            return;
        }

        const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
        if (currentPage > totalPages) currentPage = totalPages;
        const paginated  = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

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

        list.innerHTML = paginated.map(j => {
            const applied   = appliedJobs.has(j.id);
            const novisa    = noVisaJobs.has(j.id);
            const closed    = closedJobs.has(j.id);
            const rejected  = rejectedJobs.has(j.id);
            const cardCls   = closed ? ' jobs__card--closed' : rejected ? ' jobs__card--rejected' : applied ? ' jobs__card--applied' : novisa ? ' jobs__card--novisa' : '';
            return `
            <div class="jobs__card${cardCls}">
                <a class="jobs__card-title" href="${j.url}" target="_blank" rel="noopener noreferrer">${j.title}</a>
                <span class="jobs__card-company">${j.company || '—'}${j.salary ? ` <span class="jobs__salary">${j.salary}</span>` : ''}${j.location ? ` <span class="jobs__location">${j.location}</span>` : ''}</span>
                <div class="jobs__card-meta">
                    <span class="jobs__badge jobs__badge--${j.source}">${j.source}</span>
                    ${j.easy_apply ? `<span class="jobs__badge jobs__badge--easy-apply">⚡ easy</span>` : ''}
                    ${j.date ? `<span class="jobs__date">${j.date}</span>` : ''}
                    <button class="jobs__apply-btn${applied ? ' jobs__apply-btn--done' : ''}" data-id="${j.id}" data-action="apply">
                        ${applied ? formatAppliedAt(appliedJobs.get(j.id)) : '+ apply'}
                    </button>
                    <button class="jobs__novisa-btn${novisa ? ' jobs__novisa-btn--on' : ''}" data-id="${j.id}" data-action="novisa">
                        ${novisa ? '⊘ no visa' : '⊘ visa req.'}
                    </button>
                    <button class="jobs__closed-btn${closed ? ' jobs__closed-btn--on' : ''}" data-id="${j.id}" data-action="closed">
                        ${closed ? '✕ closed' : '✕ close'}
                    </button>
                    ${applied ? `<button class="jobs__rejected-btn${rejected ? ' jobs__rejected-btn--on' : ''}" data-id="${j.id}" data-action="rejected">${rejected ? '✗ rejected' : '✗ reject'}</button>` : ''}
                    ${j.description ? `<button class="jobs__letter-btn" data-id="${j.id}" data-action="letter">✉ letter</button>` : ''}
                </div>
                ${jobMatchBar(j)}
            </div>`;
        }).join('');

        const pag = document.getElementById('jobs-pagination');
        if (totalPages <= 1) {
            pag.innerHTML = '';
        } else {
            pag.innerHTML = `
                <button class="jobs__page-btn" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>← prev</button>
                <span class="jobs__page-info">${currentPage} / ${totalPages}</span>
                <button class="jobs__page-btn" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>next →</button>`;
        }
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
        const pw    = document.getElementById('jobs-password').value;
        const errEl = document.getElementById('jobs-error');
        if (!pw) return;
        try {
            const resp = await fetch(WORKER_AUTH, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ password: pw }),
            });
            if (resp.ok) {
                const { token } = await resp.json();
                sessionToken = token;
                errEl.classList.remove('visible');
                showJobs();
            } else {
                errEl.classList.add('visible');
                document.getElementById('jobs-password').value = '';
            }
        } catch {
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
                appliedJobs.set(id, new Date().toISOString());
                noVisaJobs.delete(id);           // exclusive: clear no-visa
            }
        } else if (action === 'novisa') {
            if (noVisaJobs.has(id)) {
                noVisaJobs.delete(id);           // undo no-visa
            } else {
                noVisaJobs.add(id);
                appliedJobs.delete(id);          // exclusive: clear applied
            }
        } else if (action === 'closed') {
            if (closedJobs.has(id)) {
                closedJobs.delete(id);
            } else {
                closedJobs.add(id);
            }
        } else if (action === 'rejected') {
            if (rejectedJobs.has(id)) {
                rejectedJobs.delete(id);
            } else {
                rejectedJobs.add(id);
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
        if (viewBtn)   { currentView   = viewBtn.dataset.view;     currentPage = 1; renderJobs(allJobsData); }
        if (filterBtn) { currentFilter = filterBtn.dataset.filter; currentPage = 1; renderJobs(allJobsData); }
    });

    // Search input (event delegation — input is re-rendered on each renderJobs)
    document.getElementById('jobs-filters').addEventListener('input', e => {
        if (e.target.id === 'jobs-search') {
            searchQuery = e.target.value;
            currentPage = 1;
            renderJobs(allJobsData);
        }
    });

    document.getElementById('jobs-pagination').addEventListener('click', e => {
        const btn = e.target.closest('.jobs__page-btn');
        if (!btn || btn.disabled) return;
        currentPage = parseInt(btn.dataset.page, 10);
        renderJobs(allJobsData);
        document.getElementById('jobs').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    document.getElementById('jobs-submit').addEventListener('click', tryUnlock);
    document.getElementById('jobs-password').addEventListener('keydown', e => {
        if (e.key === 'Enter') tryUnlock();
    });
    document.getElementById('jobs-lock').addEventListener('click', lockJobs);
});

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

    // ── Jobs Section (password-gated) ─────────────────────────────────────────
    //
    // Password hash — SHA-256 of your chosen passphrase.
    // To set your password, run:
    //   python3 -c "import hashlib; print(hashlib.sha256(b'YOUR_PASSWORD').hexdigest())"
    // Then replace the string below with the output.
    const JOBS_HASH = '3200a02125577bd480a8d07e60594d898e35a20e7834056150dccf335244de99';
    const LS_KEY    = 'jobs_auth_v1';

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
        localStorage.removeItem(LS_KEY);
        jobsGate.style.display = '';
        jobsContent.classList.remove('visible');
        document.getElementById('jobs-password').value = '';
        document.getElementById('jobs-error').classList.remove('visible');
    }

    const APPLIED_KEY  = 'jobs_applied_v1';
    let appliedJobs    = new Set(JSON.parse(localStorage.getItem(APPLIED_KEY) || '[]'));
    let allJobsData    = [];
    let currentFilter  = 'all';

    function saveApplied() {
        localStorage.setItem(APPLIED_KEY, JSON.stringify([...appliedJobs]));
    }

    function renderJobs(jobs) {
        allJobsData = jobs;
        const meta      = document.getElementById('jobs-meta');
        const list      = document.getElementById('jobs-list');
        const filtersEl = document.getElementById('jobs-filters');

        meta.textContent = `$ jobs --list · ${jobs.length} listing(s)`;

        // Filter buttons
        filtersEl.innerHTML = ['all', 'pending', 'applied'].map(f =>
            `<button class="jobs__filter${f === currentFilter ? ' jobs__filter--active' : ''}" data-filter="${f}">${f}</button>`
        ).join('');

        const filtered = currentFilter === 'applied' ? jobs.filter(j =>  appliedJobs.has(j.id))
                       : currentFilter === 'pending'  ? jobs.filter(j => !appliedJobs.has(j.id))
                       : jobs;

        if (!filtered.length) {
            list.innerHTML = `<p style="font-family:var(--font-main);color:var(--light-text);padding:1rem 0">No ${currentFilter} listings.</p>`;
            return;
        }

        list.innerHTML = filtered.map(j => {
            const done = appliedJobs.has(j.id);
            return `
            <div class="jobs__card${done ? ' jobs__card--applied' : ''}">
                <a class="jobs__card-title" href="${j.url}" target="_blank" rel="noopener noreferrer">${j.title}</a>
                <span class="jobs__card-company">${j.company || '—'}</span>
                <div class="jobs__card-meta">
                    <span class="jobs__badge jobs__badge--${j.source}">${j.source}</span>
                    ${j.date ? `<span class="jobs__date">${j.date}</span>` : ''}
                    <button class="jobs__apply-btn${done ? ' jobs__apply-btn--done' : ''}" data-id="${j.id}">
                        ${done ? '✓ applied' : '+ apply'}
                    </button>
                </div>
            </div>`;
        }).join('');
    }

    async function loadJobs() {
        const list = document.getElementById('jobs-list');
        list.innerHTML = '<p style="font-family:var(--font-main);color:var(--light-text);padding:1rem 0">Loading...</p>';
        try {
            const r    = await fetch('jobs.json?t=' + Date.now());
            const data = await r.json();
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
            localStorage.setItem(LS_KEY, JOBS_HASH);
            errEl.classList.remove('visible');
            showJobs();
        } else {
            errEl.classList.add('visible');
            document.getElementById('jobs-password').value = '';
        }
    }

    // Apply / unapply toggle (event delegation)
    document.getElementById('jobs-list').addEventListener('click', e => {
        const btn = e.target.closest('.jobs__apply-btn');
        if (!btn) return;
        const id = btn.dataset.id;
        appliedJobs.has(id) ? appliedJobs.delete(id) : appliedJobs.add(id);
        saveApplied();
        renderJobs(allJobsData);
    });

    // Filter toggle (event delegation)
    document.getElementById('jobs-filters').addEventListener('click', e => {
        const btn = e.target.closest('.jobs__filter');
        if (!btn) return;
        currentFilter = btn.dataset.filter;
        renderJobs(allJobsData);
    });

    // Auto-unlock if already authenticated in this browser
    if (localStorage.getItem(LS_KEY) === JOBS_HASH) showJobs();

    document.getElementById('jobs-submit').addEventListener('click', tryUnlock);
    document.getElementById('jobs-password').addEventListener('keydown', e => {
        if (e.key === 'Enter') tryUnlock();
    });
    document.getElementById('jobs-lock').addEventListener('click', lockJobs);
});

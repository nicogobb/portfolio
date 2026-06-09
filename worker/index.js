/**
 * Cover Letter Worker — Cloudflare Worker
 *
 * Proxies cover letter generation requests to Groq API.
 * Secrets (set via `wrangler secret put`):
 *   LETTER_API_KEY — Groq API key
 *   AUTH_TOKEN     — SHA-256 hash of your jobs board password
 *
 * Deploy:
 *   npm install -g wrangler
 *   cd worker
 *   wrangler deploy
 *   wrangler secret put LETTER_API_KEY   # paste your Groq key
 *   wrangler secret put AUTH_TOKEN       # paste the SHA-256 of your board password
 *     → compute it: echo -n "yourpassword" | shasum -a 256
 */

const GROQ_URL   = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

const YOUR_PROFILE = `PHP Backend / Full-Stack Developer, 10+ years experience. Currently available for new roles.

Career (most recent first):
- Software Engineer at Maxtracker [PAST — ended Jun 2026]: fleet telematics platform, 10,000+ vehicles, PHP/Kohana/PostgreSQL, real-time data pipelines.
- PHP Web Developer at mydigitalnomads (Apr 2022–Aug 2025) [PAST]: large-scale SaaS, fully remote, PHP/MySQL/TypeScript/Docker.
- Web Developer at OSPL (Nov 2019–present, part-time): health insurance system, 20,000+ affiliates, PHP/MySQL.
- DBA at Mutual Senderos (2014–2019) [PAST]: database administration, grew into full-stack web development.

Core skills: PHP 8, Laravel, Symfony, Kohana, CodeIgniter, MySQL, PostgreSQL, MongoDB, REST APIs, JavaScript, TypeScript, Git, Docker, GitHub Actions, Linux/Shell, Web Scraping.
Location: Copenhagen, Denmark — open to remote or on-site. Languages: Spanish (native), English (professional), Danish (learning).`;

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin':  origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function buildPrompt(description, title, company) {
  return `You are Nicolas Gobbi, a PHP backend developer with 10+ years of experience. Write your own cover letter for this job — in your voice, as if you typed it yourself.

## Your profile
${YOUR_PROFILE}

## The job
Role: ${title || '(not specified)'}
Company: ${company || '(not specified)'}
Description: ${description}

## How to write this

Write 3 paragraphs. No greeting, no sign-off. Output only the paragraph body.

**Paragraph 1 — why you fit this specific role:**
Open with a concrete statement about your fit. Mention the role and, if known, the company by name. Reference a specific number from your background (10,000+ vehicles, 20,000+ affiliates) if it connects to the job. Don't start with "I am writing" or "I am excited". Start with the substance.

**Paragraph 2 — your most relevant experience:**
Pick 1–2 things from your actual background that map directly to what the job is asking for. Be specific — tech stack, what you built, what scale it ran at. Mention 1–2 technologies from the job description that you genuinely have experience with.

**Paragraph 3 — why this makes sense now:**
Connect your background to what this company or role offers. Brief and direct — one or two sentences about why this is the right fit. Do NOT mention leaving a previous job, end dates, or that you are currently searching.

## Style rules
- Write like a person, not a template. Vary sentence length. Use "I" naturally, not obsessively.
- Avoid: "I am passionate", "I am excited", "I am writing to express", "dynamic", "leverage", "synergy", "team player", "results-driven", "looking forward to discussing".
- Avoid hollow phrases like "I believe I would be a great fit" — show it instead.
- If the company name is not known, don't use a placeholder — just omit it.
- Confident but not arrogant. Specific over vague.

Output only the cover letter body. No commentary, no subject line, no "Dear..." or "Sincerely...".`;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url    = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // POST /auth — validate password server-side, return session token
    // Password hash never lives in frontend source code.
    if (url.pathname === '/auth') {
      let password;
      try {
        ({ password } = await request.json());
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        });
      }
      const token = await sha256(password || '');
      if (token !== env.AUTH_TOKEN) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        });
      }
      return new Response(JSON.stringify({ token }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    // POST / — generate cover letter
    // Validate auth token
    const authHeader = request.headers.get('Authorization') || '';
    const token      = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token || token !== env.AUTH_TOKEN) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    // Parse request body
    let description, title, company;
    try {
      ({ description, title, company } = await request.json());
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    if (!description) {
      return new Response(JSON.stringify({ error: 'description is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    // Call Groq
    const groqResp = await fetch(GROQ_URL, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${env.LETTER_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model:       GROQ_MODEL,
        messages:    [{ role: 'user', content: buildPrompt(description, title, company) }],
        max_tokens:  900,
        temperature: 0.75,
      }),
    });

    if (!groqResp.ok) {
      const err = await groqResp.json().catch(() => ({}));
      return new Response(JSON.stringify({ error: err?.error?.message || `Groq error ${groqResp.status}` }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    const data   = await groqResp.json();
    const letter = data.choices?.[0]?.message?.content?.trim() || '';

    return new Response(JSON.stringify({ letter }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  },
};

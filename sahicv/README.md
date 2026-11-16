# SahiCV

A free ATS resume builder with paid AI tools for job seekers, built for India first.

- **Free forever:** resume builder (6 templates, live preview), PDF / Word / text / Markdown downloads, 16-point resume check, job-description match score, application tracker. No sign-up; data stays in the visitor's browser.
- **Paid, one-time pass (₹99 / ₹249 / ₹499 for 7 / 30 / 90 days):** tailor the resume to a job description, rewrite bullets and summary, cover letters, likely interview questions, mock interview with feedback, company briefing, LinkedIn / Naukri headline kit, import an existing resume.
- Payments by UPI, card or netbanking through Razorpay. Nothing renews automatically.

"SahiCV" is a working name. It lives in one place (`shared/plans.ts`), so renaming is a one-line change.

## Run it on your computer

Needs Node.js 22 or newer.

```bash
cd sahicv
npm install
cp .dev.vars.example .dev.vars
npm run dev          # http://localhost:5173
```

With the example settings the site runs in **demo mode**: AI answers are labelled placeholders and payments are simulated, so every screen can be tried without any account or key.

Other commands:

| Command | What it does |
| --- | --- |
| `npm test` | 41 automated tests (layout engine, resume check, job match, passes, payments, AI allowance) |
| `npm run build` | Type-checks and builds the site into `dist/` |
| `npm run preview` | Runs the built site on Cloudflare's local runtime (`http://localhost:8787`) |
| `npm run deploy` | Builds and publishes to Cloudflare |

## Go live: step by step

Total fixed cost: a domain name (roughly ₹700–1,000 a year). Hosting, the database and the starter AI keys are on free tiers.

### 1. Make it yours (10 minutes)

Edit `shared/plans.ts`:

- `BRAND.name`, `BRAND.legalName`, `BRAND.city`
- `BRAND.supportEmail` (currently a placeholder; Razorpay and your customers need a real one)
- prices in `PLANS`, if you want different ones (amounts are in paise and cents)

Then read the four policy pages in `src/pages/Legal.tsx` (privacy, terms, refunds, contact). They are written to match how the app works, with a 3-day refund window. Change anything you do not want to promise, and update the `UPDATED` date.

In `index.html`, change the `og:image` address to your full domain once you have it (for example `https://yourdomain.in/img/og.png`), so link previews work on WhatsApp and LinkedIn.

### 2. Put it on Cloudflare (free)

1. Create a free account at cloudflare.com.
2. In the dashboard open **Workers & Pages → Create → Import a repository**, and choose this GitHub repository.
3. Set **Root directory** to `sahicv`, **Build command** to `npm run build`, **Deploy command** to `npx wrangler deploy`.
4. Deploy. You get an address like `sahicv.<your-name>.workers.dev`.

(From a terminal instead: `npx wrangler login`, then `npm run deploy`.)

Why Cloudflare: its free plan allows commercial sites. Vercel's free plan does not.

### 3. Add the settings

In the Worker's **Settings → Variables and Secrets**, add each of these with type **Secret** (or run `npx wrangler secret put NAME`):

| Name | Value |
| --- | --- |
| `LICENSE_SECRET` | Any long random text, 32+ characters. Signs the passes. Keep it private and never change it after launch, or existing passes stop working. |
| `ADMIN_TOKEN` | Another random text. Protects your setup-check page. |
| `GEMINI_API_KEY` and/or `GROQ_API_KEY` | See step 4. |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | See step 5. |

Do **not** set `ALLOW_MOCK` on the live site. It is what enables the placeholder AI and fake payments.

### 4. Switch on the AI

Add at least one key. If you add several, they are tried in order and the next one takes over when one is busy or over its limit.

| Provider | Where to get a key | Notes |
| --- | --- | --- |
| Google Gemini | aistudio.google.com → Get API key | Free tier, no card. Small daily limits. |
| Groq | console.groq.com → API Keys | Free tier, no card. Fast. |
| OpenRouter | openrouter.ai → Keys | Set `OPENROUTER_MODEL` to the model you want. |
| Anthropic (Claude) | console.anthropic.com | Paid, best writing quality. See below. |

Things to know:

- **Model names change.** The defaults are in `worker/ai/providers.ts`. If a provider retires a model, set `GEMINI_MODEL`, `GROQ_MODEL` and so on to a current name from that provider's model list. No code change needed.
- **Free tiers are thin.** They are enough to launch and get your first buyers, not to serve hundreds of people a day. When passes start selling, add a paid key; a pass costs you a few rupees of AI at most.
- **Privacy on free tiers.** Some providers may use text sent on their free tier to improve their products. Resumes contain personal details, so move to a paid tier (or a provider that does not train on API data) once you have revenue. The privacy page already tells visitors that AI requests go to a third-party provider.
- **Anthropic settings.** The default model is `claude-opus-5-5`. For much lower cost set `ANTHROPIC_MODEL=claude-haiku-5-5`. `ANTHROPIC_EFFORT` (default `low`) controls how hard the model thinks. The request opts in to Anthropic's server-side fallback, so if the model declines a request the API can answer with its default fallback model instead of failing.
- To choose the order yourself, set `AI_PROVIDERS`, for example `groq,gemini`.

### 5. Switch on payments (Razorpay)

1. Sign up at razorpay.com and complete KYC (PAN, bank account, and your website address). Individuals can register.
2. Razorpay reviews the website before activating live payments. It looks for the policy pages, which are already built in at `/privacy`, `/terms`, `/refunds` and `/contact`, plus visible pricing (on the home page).
3. While you wait, use **test keys** (`rzp_test_…`) from **Account & Settings → API Keys** to try the whole flow with Razorpay's test cards and test UPI.
4. Once approved, replace them with the **live keys**.

How a purchase works: the server creates a Razorpay order, the visitor pays in Razorpay's window, the server checks Razorpay's signature and confirms with Razorpay that the payment was captured for the right amount, and only then issues a signed pass that is stored in the visitor's browser. A buyer who changes phone or clears the browser can restore the pass with the payment ID from the Razorpay receipt.

Payments from outside India need "International payments" enabled by Razorpay on your account. After that, set `ENABLE_USD=true` to show dollar prices.

Refunds are made by you from the Razorpay dashboard.

### 6. Free daily AI tries (recommended)

Letting visitors try the AI a few times a day before paying is the main way people decide to buy. It needs a small free database to count usage:

```bash
npx wrangler d1 create sahicv
```

Paste the `database_id` it prints into `wrangler.jsonc` (the line is there, commented out) and deploy again. Visitors then get 3 free AI actions a day, and pass holders a fair-use limit of 150 a day. Both numbers are in `shared/plans.ts`.

Without the database, AI features are simply pass-only.

### 7. Check everything

Open `https://your-site/api/health?token=YOUR_ADMIN_TOKEN&test=1`. It shows whether payments, the signing secret and the database are set up, and sends a tiny test request to each AI provider so you can see which ones answer.

Then make one real purchase of the cheapest pass yourself, use an AI feature, and refund yourself from the Razorpay dashboard.

### 8. Your own domain

Buy a domain from any registrar, add it to Cloudflare, and attach it under the Worker's **Settings → Domains & Routes**.

## How it is built

```
shared/      Plans, prices, limits and data types used by both sides
src/         The website (React + TypeScript, built with Vite)
  resume/      Templates, the page-layout engine, PDF / Word / text export
  analysis/    Resume check and job-description matching (run in the browser, free)
  pages/       Landing page, builder, tailor, cover letter, interview, kit, tracker, policies
worker/      The server (Cloudflare Worker): AI, payments, passes, usage limits
  ai/          Prompts for each AI feature, provider fallback chain, stand-in AI for demo mode
tests/       Automated tests
```

A few design decisions worth knowing:

- **The PDF is real text, not a picture.** A small layout engine positions every line using the font's actual measurements, and the same instructions draw both the on-screen preview and the PDF. That is why the download always matches the preview and why applicant tracking systems can read it.
- **No accounts and no resume storage.** Resumes live in the visitor's browser. The server only sees text when an AI feature is used and does not keep it.
- **The AI is not allowed to invent.** Prompts forbid adding employers, skills or numbers. The server also checks tailoring results: skills that were not in the resume are dropped, and any rewrite containing a number that was not in the resume is flagged and left unticked. Every change is shown as before/after for approval.
- **Passes need no database.** A pass is a signed token. The server can verify it without looking anything up. The trade-off: a buyer could share a pass with a friend. The daily fair-use limit (with the database from step 6) caps the damage.

To add or change a template, see `src/resume/templates.ts`. To refresh the gallery pictures after changing one:

```bash
node scripts/render-samples.ts out
for t in modern classic crisp executive compact sidebar; do pdftoppm -r 46 -png -singlefile out/$t.pdf public/img/tpl-$t; done
pdftoppm -r 96 -png -singlefile out/modern.pdf public/img/hero-modern
```

## Before you take money: a short checklist

- [ ] Real support email, name and city in `shared/plans.ts`
- [ ] Policy pages read and agreed with (especially the refund window)
- [ ] `LICENSE_SECRET` set; `ALLOW_MOCK` not set
- [ ] At least one AI key works on the health page
- [ ] A test purchase and a live purchase both activate a pass
- [ ] Ask a chartered accountant how to report this income and whether GST registration applies to you

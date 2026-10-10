# Summit: Reverse-Engineered Career Roadmapper

> Type a dream job. Get the trail map.

**Problem statement 1.** A student types a hyper-specific dream job (for example "Full Stack Developer at a climate tech startup"). An AI engine works backwards from that job and returns real roles, certifications, skills and side projects. Summit draws them as an interactive trail map you can pan, zoom and click. Clicking a step generates tailored advice: a weekend project, a repo to study and interview questions. Marking a skill as known re-routes the map.

Accounts are required: sign up, log in, and your routes and progress are saved.

**Live demo:** add your deployed link here (or delete this line)

## Features

- **Reverse-engineered routes.** Starts from one specific job and works back to real roles, official certifications, skills and projects.
- **Interactive trail map.** Hand-written SVG with pan, zoom (wheel, buttons, pinch), minimap, keyboard control and click-to-open steps.
- **Per-step AI advice.** A weekend project, a repo to study, 5 interview questions, a "done when" checklist and pitfalls. Cached per step, with Regenerate.
- **Live re-routing.** Mark a step known or done and the map updates. Steps you no longer need become skippable, with hours saved.
- **Honest time budget.** Hours per week and months give a live hours-left and on-track / over-budget readout.
- **Re-plan.** Change your time limits and the AI redraws the route, skipping what you finished.
- **Compare two dream jobs.** Overlapping steps are highlighted with the share of prep that carries over.
- **Share and export.** A public read-only link (map only) and PNG export.
- **People who took this path.** Example journeys, clearly labelled as AI-written composites.
- **Progress and celebrations.** Progress is saved, with camp-cleared and summit moments.

## Quick start

Requires **Node 22.5 or newer**. There is nothing to install: the app has no npm dependencies.

**1. Create a file named `.env` in the project root** (next to `package.json`) with your AI settings. Example using Groq, which has a free tier:

```env
PORT=3000
AI_PROVIDER=groq
GROQ_API_KEY=gsk_your_real_key_here
GROQ_MODEL=openai/gpt-oss-120b
COOKIE_SECURE=0
```

Get a Groq key at https://console.groq.com/keys. It starts with `gsk_`. Do not add quotes or spaces around it. `.env` is listed in `.gitignore`, so your key is never pushed to GitHub.

**2. Start the app:**

```bash
npm start        # http://localhost:3000
```

**3. Use it.** Open http://localhost:3000, click **Create account**, then **Plot a new route**. No test login is shipped, so create your own account in 10 seconds.

Other commands:

```bash
npm test         # API + logic tests, no network or key needed
```

`AI_PROVIDER=mock npm run dev` runs the UI with **placeholder** roadmaps for development only. Do not use it for judging: it is not AI output, and the UI labels it clearly.

## AI provider settings

Set **one** provider in `.env`. Set `AI_PROVIDER` explicitly so the one you want is used even if other keys are present.

| Provider | `AI_PROVIDER` | Key | Model variable (default) |
|---|---|---|---|
| Groq | `groq` | `GROQ_API_KEY` | `GROQ_MODEL` (`openai/gpt-oss-120b`) |
| Anthropic (Claude) | `anthropic` | `ANTHROPIC_API_KEY` | `ANTHROPIC_MODEL` (`claude-sonnet-4-5`) |
| Google Gemini | `gemini` | `GEMINI_API_KEY` | `GEMINI_MODEL` (`gemini-2.5-flash`) |
| OpenAI-compatible | `openai` | `OPENAI_API_KEY` | `OPENAI_MODEL` (`gpt-4o-mini`), `OPENAI_BASE_URL` |

Other settings: `PORT` (default 3000) and `COOKIE_SECURE=1` when served over HTTPS.

**Groq notes**

- Groq retires models from time to time. If you see "model does not exist", list the models your key can use and put one in `GROQ_MODEL`:
  `curl https://api.groq.com/openai/v1/models -H "Authorization: Bearer $GROQ_API_KEY"`
- On a rate-limit (429) reply the app waits as long as Groq asks and retries once. If Groq rejects a reply with `json_validate_failed`, it retries once.
- Free-tier limits apply. If you hit a rate or "request too large" error, wait a minute, or try `GROQ_MODEL=openai/gpt-oss-20b`.
- If the chosen provider has no key, the app shows "No AI provider is configured" instead of failing with a confusing error.

## Deploy

```bash
docker build -t summit .
docker run -p 3000:3000 \
  -e AI_PROVIDER=groq -e GROQ_API_KEY=gsk_... -e GROQ_MODEL=openai/gpt-oss-120b \
  -e COOKIE_SECURE=1 -v summit-data:/app/data summit
```

Works on any host that runs Docker or Node 22 (Render, Railway, Fly.io).

- Set `COOKIE_SECURE=1` behind HTTPS.
- Mount a volume at `/app/data` so accounts survive restarts. Hosts without a persistent disk (for example the Render free tier) reset the database on restart.
- Set the API key as an environment variable on the host. Never commit it. `.env` is git-ignored.
- The Docker image defaults to `COOKIE_SECURE=1`. To test it over plain http (for example `http://localhost:3000` in Safari), add `-e COOKIE_SECURE=0`.

## Architecture and why

- **Server:** plain Node.js (22+) with the built-in `http` and `node:sqlite` modules. No framework and **no npm dependencies**, so `node server/index.js` runs anywhere with nothing to install.
- **Data store:** SQLite file (`data/app.db`): users, sessions, roadmaps (JSON), per-step advice cache. One file is easy to back up and enough for this scale.
- **AI engine (`server/ai.js`, `prompts.js`):** a provider-agnostic caller. Supports Groq, Anthropic (Claude), Google Gemini and any OpenAI-compatible endpoint. The prompt demands real job titles and official certification names, a branching DAG, exactly one goal node, and composite example paths. The roadmap always comes from the model's response; nothing is pre-written.
- **Trusting model output (`server/roadmap.js`):** every response is parsed, retried once on invalid JSON, then normalised: unknown ids dropped, cycles broken, one goal node enforced, hours clamped, phases ordered by dependency. The UI never receives a broken graph.
- **Map (`public/js/layout.js`, `graph.js`):** hand-written SVG. Layout puts nodes in columns by dependency depth, grouped into phase "camps", and reduces edge crossings with barycenter sweeps. Pan/zoom uses pointer events, so mouse, touch and pinch all work. PNG export serialises the same SVG, so the image matches the screen.
- **Re-routing (`public/js/model.js`):** each step is `done`, `known`, `bypassed`, `available` or `locked`. A step becomes *bypassed* when everything it unlocks is already covered. Remaining hours are scheduled in dependency order against your weekly hours.
- **Why no framework or build step:** the sandbox this was built in could not reach npm, and a zero-dependency app is also the lowest-risk thing to demo on a laptop. The tradeoff is more hand-written DOM code.

## Security

CSP and other headers, parameterised SQL, per-user data isolation, scrypt password hashing, httpOnly session cookies, rate limits on login, sign-up and AI calls, and JSON-only mutating requests with `SameSite=Lax` cookies. Public share links expose only the map (no account, progress or advice). API keys stay on the server and are never sent to the browser.

## Tools and AI used

- Node.js 22 built-ins only (`http`, `crypto`, `node:sqlite`); no runtime dependencies
- AI: your choice of Groq, Claude (Anthropic API), Gemini, or any OpenAI-compatible model, set in `.env`
- Fonts: Bricolage Grotesque and Instrument Sans via Google Fonts (system fonts if offline)
- **AI disclosure:** the header of every route says "Made by AI" with the model name. Advice panels say they are written by AI and should be verified. "People who took this path" explains the journeys are AI-written composites, not real individuals. Repo suggestions link out so users can check them.

## Status

**Done**

- Accounts, sessions and saved progress
- AI roadmap generation from a goal, hours/week, months, background and known skills
- Interactive map, live re-routing, re-plan, progress tracking and celebrations
- Per-step AI advice with caching and Regenerate
- Compare two routes, example journeys, PNG export and public share link
- Groq support with a current model, rate-limit retry and JSON-error retry
- Mobile layout, keyboard and screen-reader basics, and automated tests

**Planned**

- Stream the roadmap node by node so the map builds while the AI is still writing
- Let the AI re-route a step's content (not just hide it) when a user marks a skill as partly known
- Persist comparison results and add a "shared skills" learning plan

## Who it is for

Students and career switchers aiming at a specific role who are tired of "learn React and build a portfolio". They come back to tick off steps, watch the map re-route, re-plan when their schedule changes, and compare an alternate target.

## Project layout

```
server/   index.js (routes, static), auth.js, db.js, ai.js, prompts.js, roadmap.js (validation)
public/   index.html, app.css, js/ (graph.js, layout.js, model.js, views/*)
scripts/  test.js, make-contours.mjs
```

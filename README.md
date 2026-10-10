# Summit: Reverse-Engineered Career Roadmapper

## What it does
**Problem statement 1.** A student types a hyper-specific dream job (for example "Full Stack Developer at a climate tech startup"). An AI engine works backwards from that job and returns real roles, certifications, skills and side projects. Summit draws them as an interactive trail map you can pan, zoom and click. Clicking a step generates tailored advice: a weekend project, a repo to study and interview questions. Marking a skill as known re-routes the map.

Accounts are required: sign up, log in, and your routes and progress are saved.

## Done / Left / Plan
**Done**
- Account creation, login, logout, sessions (scrypt password hashes, httpOnly cookie, rate limiting)
- AI roadmap generation from a free-text goal plus hours/week, months, background and known skills
- Interactive SVG map: pan, zoom (wheel, buttons, pinch), minimap, keyboard control, click-to-open steps
- Per-step AI advice (weekend project, repo, 5 interview questions, "done when", pitfalls), cached per step
- Dynamic re-routing when steps are marked known or done, with live hours-left and on-track/over-budget status
- Re-plan with new time limits (AI redraws, skipping what you finished), progress tracking, camp-cleared and summit celebrations
- "People who took this path" view, side-by-side compare of two routes, PNG export, public read-only share link
- Mobile layout, keyboard and screen-reader basics, API and logic tests (`npm test`)

**Left / Plan**
- Deploy to a public URL (Dockerfile included; see "How to run")
- Stream the roadmap node by node so the map builds while the AI is still writing
- Let the AI re-route a step's *content* (not just hide it) when a user marks a skill as partly known
- Persist comparison results and add a "shared skills" learning plan

## Architecture and why
- **Server:** plain Node.js (22+) with the built-in `http` and `node:sqlite` modules. No framework and **no npm dependencies**, so `node server/index.js` runs anywhere with nothing to install.
- **Data store:** SQLite file (`data/app.db`): users, sessions, roadmaps (JSON), per-step advice cache. One file is easy to back up and enough for this scale.
- **AI engine (`server/ai.js`, `prompts.js`):** a provider-agnostic caller. Supports Anthropic (Claude), Google Gemini, Groq and any OpenAI-compatible endpoint. The prompt demands real job titles and official certification names, a branching DAG, exactly one goal node, and composite example paths. The roadmap always comes from the model's response; nothing is pre-written.
- **Trusting model output (`server/roadmap.js`):** every response is parsed, retried once on invalid JSON, then normalised: unknown ids dropped, cycles broken, one goal node enforced, hours clamped, phases ordered by dependency. The UI never receives a broken graph.
- **Map (`public/js/layout.js`, `graph.js`):** hand-written SVG. Layout puts nodes in columns by dependency depth, grouped into phase "camps", and reduces edge crossings with barycenter sweeps. Pan/zoom uses pointer events, so mouse, touch and pinch all work. PNG export serialises the same SVG, so the image matches the screen.
- **Re-routing (`public/js/model.js`):** each step is `done`, `known`, `bypassed`, `available` or `locked`. A step becomes *bypassed* when everything it unlocks is already covered. Remaining hours are scheduled in dependency order against your weekly hours.
- **Why no framework or build step:** the sandbox this was built in could not reach npm, and a zero-dependency app is also the lowest-risk thing to demo on a laptop. The tradeoff is more hand-written DOM code.
- **Security:** CSP and other headers, parameterised SQL, per-user data isolation, rate limits on login/sign-up/AI calls, JSON-only mutating requests with `SameSite=Lax` cookies, public share links expose only the map (no account, progress or advice).

## What we added
- Hours-per-week and months limits that drive an honest "on track / over budget" readout and a Re-plan action
- "Skippable" steps: re-routing that removes work you no longer need, with hours saved
- Camp-cleared and summit celebrations
- Compare two dream jobs, with overlapping steps highlighted and "% of prep that carries over"
- Public share link and PNG export
- Advice cache and "Regenerate", so repeat clicks cost nothing

## How to run it
Requires **Node 22.5 or newer**.

```bash
cp .env.example .env      # then add ONE API key, e.g. GEMINI_API_KEY (free tier) or ANTHROPIC_API_KEY
npm start                 # http://localhost:3000
npm test                  # API + logic tests, no network or key needed
```

1. Open http://localhost:3000, click **Create account**, then **Plot a new route**.
2. No test login is shipped. Create your own account in 10 seconds.
3. `AI_PROVIDER=mock npm run dev` runs the UI with **placeholder** roadmaps for development only. Do not use it for judging: it is not AI output, and the UI labels it clearly.

**Deploy:** `docker build -t summit . && docker run -p 3000:3000 -e GEMINI_API_KEY=... -v summit-data:/app/data summit`. Works on any host that runs Docker or Node 22 (Render, Railway, Fly.io). Set `COOKIE_SECURE=1` behind HTTPS and mount a volume at `/app/data` so accounts survive restarts. **Live URL:** _add after deploying_.

## Tools and AI used
- Node.js 22 built-ins only (`http`, `crypto`, `node:sqlite`); no runtime dependencies
- AI: your choice of Claude (Anthropic API), Gemini, Groq, or any OpenAI-compatible model, set in `.env`
- Fonts: Bricolage Grotesque and Instrument Sans via Google Fonts (system fonts if offline)
- **AI disclosure:** the header of every route says "Made by AI" with the model name. Advice panels say they are written by AI and should be verified. "People who took this path" explains the journeys are AI-written composites, not real individuals. Repo suggestions link out so users can check them.
- API keys stay on the server and are never sent to the browser. `.env` is git-ignored.

## Who it is for
Students and career switchers aiming at a specific role who are tired of "learn React and build a portfolio". They come back to tick off steps, watch the map re-route, re-plan when their schedule changes, and compare an alternate target.

## Project layout
```
server/   index.js (routes, static), auth.js, db.js, ai.js, prompts.js, roadmap.js (validation)
public/   index.html, app.css, js/ (graph.js, layout.js, model.js, views/*)
scripts/  test.js, make-contours.mjs
```

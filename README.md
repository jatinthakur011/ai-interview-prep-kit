# AI Interview Prep Kit

Turns a job description + company URL into a personalised interview prep kit:
company brief, role breakdown, categorised question bank, flashcards, and a
day-by-day study schedule — reshapeable, and practiseable, inside the app.

**Status:** feature-complete. Backend (pipeline, auth, database, HTTP API,
mandatory batch CLI) and frontend (Next.js builder + practice UI) are both
implemented, wired together, and manually verified end to end (generation,
regeneration with edit-preservation, practice mode, and the batch CLI).

## Screenshots

**Landing page**
![Landing page](docs/screenshots/home.png)

**New kit form**
![New kit form](docs/screenshots/new-kit.png)

**Generated kit — company brief and requirements**
![Kit view](docs/screenshots/kit-view.png)

## Tech stack

| Layer      | Choice                          |
|------------|----------------------------------|
| Backend    | Node.js + Express (TypeScript)  |
| Database   | MongoDB (official `mongodb` driver, no ORM) |
| Auth       | bcrypt password hashing + JWT session cookie |
| LLM        | Google Gemini, genuine free tier (see "LLM provider and model" below) |
| Discussion search | Brave Search API (2,000 free queries/month) — optional; the app works honestly without it |
| Frontend   | Next.js 14 (App Router) + Tailwind CSS |

Gemini and Brave were picked because both have a real free tier with no card
required, and both are swappable behind small interfaces (`LLMClient`,
`DiscussionSearchClient`) — a different provider is a new adapter file, not a
rewrite of any pipeline code.

## LLM provider and model

Google Gemini, via the plain `generateContent` REST endpoint (no SDK
dependency). The model is read from `GEMINI_MODEL` and **defaults to
`gemini-flash-latest`** — Google's rolling alias to whatever its current
stable Flash model is, rather than a version pinned by name.

This was a deliberate choice, not an oversight: an earlier pinned model
(`gemini-2.5-flash`) was retired by Google mid-development, which turned into
a real, reproducible failure (`Gemini HTTP 404`) during testing. Pinning a
model name trades reproducibility for a shelf life the developer doesn't
control; the `-latest` alias trades a small amount of reproducibility for the
app not silently breaking the day Google retires a model. Anyone who wants a
pinned, reproducible model for grading can set `GEMINI_MODEL=gemini-3.6-flash`
(or any current model name) in `.env` — no code change needed.

In practice, `gemini-flash-latest` is a very high-traffic shared alias and
occasionally returns `503` ("model overloaded") under load. `withRetry()`
already retries these with exponential backoff (see Security/Robustness
below); if `503`s are still frequent in your environment,
`GEMINI_MODEL=gemini-flash-lite-latest` is a lighter, less contended
alternative that works well for this pipeline's extraction/generation calls.

## Setup (local)

```bash
cd backend
npm install
cp .env.example .env
# fill in GEMINI_API_KEY at minimum; MONGODB_URI defaults to a local instance
npm run dev        # starts the API on :4000 (or $PORT)
npm test           # runs the unit test suite (84 tests)
```

You need a MongoDB instance reachable at `MONGODB_URI` (a free MongoDB Atlas
cluster works, or `docker run -p 27017:27017 mongo` locally).

In a second terminal, start the frontend:

```bash
cd frontend
npm install
cp .env.example .env.local
# NEXT_PUBLIC_API_URL defaults to http://localhost:4000, matching the backend above
npm run dev         # UI on :3000
```

Open `http://localhost:3000`, sign up, and create a kit. The backend's
`CORS_ORIGINS` (in `backend/.env`) must include the frontend's origin —
`http://localhost:3000` is the default on both sides, so local dev works
with no extra configuration.

### Environment variables

| Variable | Where | Required? | Purpose |
|---|---|---|---|
| `GEMINI_API_KEY` | backend | **Required** | Auth key for the Gemini API. Get a free one at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). |
| `GEMINI_MODEL` | backend | Optional (default `gemini-flash-latest`) | Which Gemini model to call. See "LLM provider and model" above. |
| `BRAVE_API_KEY` | backend | Optional | Enables the public-interview-discussion search. Without it, that step is skipped and reported honestly (`found: false`) rather than erroring. |
| `MONGODB_URI` | backend | **Required** | Connection string for the kits/users database. |
| `JWT_SECRET` | backend | **Required** | Signs the session cookie. Use a long random string in production. |
| `CORS_ORIGINS` | backend | **Required** | Comma-separated list of origins allowed to call the API (must include the deployed frontend's URL in production). |
| `PORT` | backend | Optional (default `4000`) | Port the Express server listens on. |
| `ALLOW_LOCAL_FETCH` | backend | Optional | Lets the crawler follow `http://localhost` URLs. Only set by the batch CLI internally — never needed/should be set for the public HTTP API (SSRF protection). |
| `NEXT_PUBLIC_API_URL` | frontend | Optional (default `http://localhost:4000`) | Base URL the frontend calls for the API. Must point at the deployed backend URL in production. |

## Deployment

- **Frontend:** Vercel (free tier). Import the repo, set the root directory
  to `frontend`, and set `NEXT_PUBLIC_API_URL` to the deployed backend's URL.
- **Backend:** Render or Railway (free tier). Root directory `backend`,
  build command `npm install`, start command `npm start`. Set all the
  backend env vars above, with `CORS_ORIGINS` pointing back at the deployed
  Vercel URL.
- **Database:** MongoDB Atlas free (M0) cluster; `MONGODB_URI` from Atlas's
  connect dialog.

Live URLs:
- Frontend: [frontend-gamma-wheat-83.vercel.app](https://frontend-gamma-wheat-83.vercel.app/)
- Backend: [ai-interview-prep-kit-q1qr.onrender.com](https://ai-interview-prep-kit-q1qr.onrender.com)

> **Note:** The backend is hosted on Render's free tier, which spins down
> after 15 minutes of inactivity. The first request after idling can take
> 20–30 seconds to wake up — this is expected, not a bug.

## Frontend architecture

Plain `fetch` wrapper (`frontend/src/lib/api.ts`) calling the Express API
with `credentials: "include"`, so the httpOnly session cookie set by
`/api/auth/login` is sent automatically — no client-side token handling.
`useAuth` loads the session once via `GET /api/auth/me` and every protected
page calls `useRequireAuth`, which redirects a signed-out visitor to
`/login` (brief Section 1: "a signed-out visitor cannot reach protected
pages").

The kit page polls `GET /api/kits/:id` every 2.5s while status is
`pending`/`generating`, so the person watches real progress instead of a
static spinner, then stops polling once the kit is `ready` or `failed`.
Every inline edit (question prompt, answer outline, flashcard, company
brief) saves on blur through its own small `PATCH` call and merges the
returned kit back into local state — no keystroke-by-keystroke
round-tripping. A small coloured dot (`OriginDot`) shows whether each
question/flashcard is AI-generated, edited, or added by hand, mirroring the
backend's `origin` field; question cards also carry a category-coloured
left border and a colour-coded difficulty badge so the question bank is
scannable at a glance.

Reordering uses ↑/↓ buttons scoped to a question's own category rather than
drag-and-drop — a deliberate trade-off: it's fully keyboard- and
screen-reader-operable with no extra dependency, at the cost of feeling
less fluid than drag-and-drop for large lists.

Styling is Tailwind CSS with a small hand-written design-token layer
(`globals.css`: `.card`, `.btn-primary`, `.input`, status/priority colour
scales, etc.) rather than a component library, so loading/empty/error states
and the builder's editable surfaces stay visually consistent across pages.

## Batch entry point (mandatory, brief Section 9)

Runs the exact same pipeline as the HTTP API, no parallel implementation:

```bash
npm run evaluate -- --input cases.json --output kits.json
```

`cases.json` is an array of `{ id, jd, company_url, days }`. `kits.json` is
written in the exact shape from Appendix B: `{ version, generated_at, kits: [{
id, status, kit, error }] }`. One case failing doesn't abort the run.

The CLI's argument parser also accepts plain positional args
(`npm run evaluate -- cases.json kits.json`) as a fallback, since some
npm-on-Windows-PowerShell setups were observed stripping the `--input`/
`--output` flag names while still forwarding their values positionally —
both forms are supported so the documented command works regardless of shell.

Company sites used with this command may be served from `http://localhost`;
the crawler is told to allow loopback fetches only for this command (never
for the public HTTP API, where loopback URLs are rejected as an SSRF
protection).

## High-level architecture

<!--
  ⚠️ EVERYTHING BELOW THIS LINE IS MISSING.

  The pasted content cut off exactly at this heading both times it was sent,
  so this file only contains what came before "## High-level architecture".
  Whatever was originally written for High-level architecture, Retrieval
  approach, Sequencing, State representation, Security, Edge cases, Testing,
  and Known limitations is NOT reproduced here — inventing that content would
  risk putting wrong technical claims in your submission, so it has been left
  out rather than guessed.

  To finish this file: open your real README.md in a text editor, copy
  everything from "## High-level architecture" to the end of the file, and
  paste it in below this comment block (then delete this comment block).
-->

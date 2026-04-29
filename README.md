# Social Influence Task

Artwork rating task adapted from Welborn et al. (2016). Measures whether felt
social connection with an AI agent modulates social influence susceptibility.

Participants rate artworks before (Phase 1) and after (Phase 2) seeing each
agent's rating. Influence is operationalized as the shift toward the agent's
rating, normalised by the maximum possible shift.

## Structure

```
social-influence-task/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI routes
│   │   ├── models.py        # SQLAlchemy models (Session, Block, Rating, Event, Trigger)
│   │   ├── db.py            # DB engine / session
│   │   ├── stimuli.py       # Artwork loading & artwork-condition assignment
│   │   ├── pilot.py         # Participant counter (persistent, mirrors social connection task)
│   │   └── stimuli/
│   │       ├── artworks.json       # 75 artwork stimulus definitions + image_url
│   │       └── agent_ratings.json  # Pre-generated agent ratings per artwork (add before running)
│   ├── pyproject.toml
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── main.tsx          # Entry point — routes to PilotApp or dev App
    │   ├── App.tsx           # Dev landing screen
    │   ├── PilotApp.tsx      # Prolific participant orchestrator
    │   ├── timeline.ts       # jsPsych timeline (Phase 1 + Phase 2)
    │   ├── api.ts            # API client
    │   └── components/
    │       └── TimelineRunner.tsx
    ├── index.html
    └── package.json
```

## Task Design

**Phase 1 — Baseline rating** (pre-scan, lab computer)
- 75 artworks rated on a 0–100 continuous slider
- No agent information shown
- Duration: ~8 min

**Phase 2 — Influence task** (post-scan, lab computer)
- Same 75 artworks, randomly interleaved across agent conditions
- Trial structure per artwork:
  1. Artwork + agent rating reveal (4 s)
  2. Participant re-rates on 0–100 slider (self-paced, ≤8 s)
  3. ITI fixation cross (2–4 s jittered)
- Duration: ~18 min
- 5 conditions: Alex, Sam, Casey, Jordan (the 4 chat agents), + RNG control

**Counterbalancing**
- Each artwork appears in exactly one condition per participant
- Condition assignment: `(artwork_id − 1 + participant_index) mod 5`
- Every 5 participants = 1 complete rotation

**Influence score (computed at analysis time)**
```
Δ = phase2_rating − phase1_rating
normalised_influence = Δ / |agent_rating − phase1_rating|
```
Values: 0 = no influence, 1 = full conformity, negative = reactance.

## Setup

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env: add PROLIFIC_COMPLETION_URL
uv run fastapi dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on http://localhost:5174 (to avoid port conflict with social
connection task on 5173).

## Before Running Participants

### 1. Populate artworks.json

The `stimuli/artworks.json` file ships with 5 example entries. Add all 75
artworks from the stimulus spreadsheet. Each entry needs:

```json
{
  "id": 1,
  "title": "...",
  "artist": "...",
  "year": 1875,
  "medium": "...",
  "style": "...",
  "wikiart_url": "...",
  "image_url": "https://your-cdn.com/artworks/1.jpg",
  "expected_valence": 71,
  "valence_category": "Liked",
  "familiarity_risk": "Low"
}
```

`image_url` must point to a hosted image (see Image Hosting below).

### 2. Add agent_ratings.json

Create `backend/app/stimuli/agent_ratings.json` with pre-generated agent
ratings for each artwork. These are fixed per-artwork ratings that all
participants see for each agent condition. Format:

```json
{
  "Alex":   {"1": 72, "2": 45, "3": 68, ...},
  "Sam":    {"1": 60, "2": 38, "3": 55, ...},
  "Casey":  {"1": 65, "2": 50, "3": 60, ...},
  "Jordan": {"1": 58, "2": 42, "3": 52, ...}
}
```

Without this file, the backend uses deterministic placeholder ratings.

### 3. Image Hosting

Download images from WikiArt and host them. Options:
- **Local**: place in `frontend/public/artworks/1.jpg` and set
  `image_url` to `/artworks/1.jpg`
- **CDN**: upload to S3, Cloudflare R2, or similar and use full URL
- **Dev testing**: leave `image_url` blank — the frontend shows a placeholder

## Prolific Study URL

```
https://yourstudy.com/?mode=pilot&PROLIFIC_PID={{%PROLIFIC_PID%}}&identities=Alex,Sam,Casey,Jordan
```

The `identities` param should match the agent identities assigned to this
participant in the social connection task, so Phase 2 labels match the agents
they already interacted with.

## Data

All data is stored in SQLite (`social_influence.db`). Key tables:

| Table    | Contents |
|----------|----------|
| sessions | One row per participant visit |
| blocks   | One per phase (phase=1 baseline, phase=2 influence) |
| ratings  | Every artwork rating with timing |
| events   | jsPsych timeline events with ms timestamps |
| triggers | Scanner TR pulses (scanner mode only) |

Export ratings for analysis:
```sql
SELECT
  s.participant_id,
  s.condition_order,
  r.artwork_id,
  b.phase,
  r.rating,
  r.agent_condition,
  r.agent_rating,
  r.rating_rt_ms,
  r.trial_index
FROM ratings r
JOIN blocks b ON r.block_id = b.id
JOIN sessions s ON b.session_id = s.id
ORDER BY s.participant_id, b.phase, r.trial_index;
```

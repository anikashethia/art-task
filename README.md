# Art Task

Artwork rating task measuring susceptibility to social influence. Participants rate each artwork, see the average rating of two named agents, then re-rate. Influence is operationalised as the shift toward the agents' average, normalised by the maximum possible shift.

Runs **after** the chat task in the same lab session. Part of the Social Connection study (Mobbs Lab, Caltech).

- **Live app:** https://test-social-influence-task.fly.dev
- **Deployment:** Fly.io (`test-social-influence-task`, org `mobbs-lab`)
- **Stack:** React 19 / jsPsych 8 / Vite / TypeScript frontend · FastAPI + SQLAlchemy + SQLite backend

---

## Task Design

**Trial structure** (per artwork, self-paced):
1. **Initial rating** — participant rates artwork on 0–100 slider; Submit locked until slider is moved
2. **Feedback reveal** — artwork shown with two agent avatars and their average rating (5 s auto-advance)
3. **Re-rating** — participant re-rates; Submit locked until slider is moved or clicked
4. **Blank ITI** — 500 ms

**4 pair-conditions** (30 artworks each, 120 total):

| Condition | Agents |
|---|---|
| `friendly` | The 2 agents the participant chatted with in the friendly condition |
| `neutral` | The 2 agents the participant chatted with in the neutral condition |
| `friendly_control` | Same race + gender, never chatted with — matched to friendly pair |
| `neutral_control` | Same race + gender, never chatted with — matched to neutral pair |

Conditions are **interspersed** (randomly shuffled across the 120 trials).

**Counterbalancing (24 configs)**

Each config assigns one of the 16 named avatars (4 races × 2 genders × 2 exemplars) to each of 4 roles: friendly-male, friendly-female, neutral-male, neutral-female. All 4 are different races. Controls are the other exemplar of the same race and gender.

- 24 configs = 4! permutations of {r1, r2, r3, r4} across the 4 roles
- Every avatar appears as a social agent in exactly 6/24 configs and as a control in exactly 6/24
- Config is selected by participant number (1–24); cycles for larger samples

**Influence score** (computed at analysis time):
```
Δ = rerate − initial_rating
normalised_influence = Δ / |avg_agent_rating − initial_rating|
```
0 = no influence, 1 = full conformity, negative = contrast. NULL when initial rating equals agent average.

---

## Avatars

16 named avatars — balanced 4 races × 2 genders × 2 exemplars:

| | Female | Male |
|---|---|---|
| **r1 — white** | quinn, reese | alex, jordan |
| **r2 — east Asian** | jamie, parker | charlie, logan |
| **r3 — S. Asian / Hispanic** | morgan, taylor | casey, elliot |
| **r4 — black** | rowan, sam | blake, cameron |

Images live in `frontend/public/avatars/{id}.png` (e.g. `r1_m_alex.png`) and are served at `/avatars/{id}.png`.

---

## Running Locally

**Backend** (port 8001):
```bash
cd backend
cp .env.example .env
uv run uvicorn app.main:app --reload --port 8001
```

**Frontend** (port 5174):
```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5174** — the landing page has Test / Full study mode and In-person / Online start buttons.

Port 5174 avoids conflict with the chat task on 5173.

---

## Modes

| Mode | Trials | Use |
|---|---|---|
| `test` | 12 (3 per condition) | Setup, piloting, researcher checks |
| `full` | 120 (30 per condition) | Real data collection |

Mode is selected on the landing page and does not affect trial structure — only trial count.

---

## Entry Points

**Landing page** (`/`) — shown when no `PROLIFIC_PID` in the URL. Researcher selects Test/Full mode and enters participant number (1–24) for in-person or online launch.

**Prolific / online** (`/?PROLIFIC_PID=...`) — detected automatically; goes straight into the task using the auto-incremented participant index for counterbalancing.

Prolific study URL format:
```
https://test-social-influence-task.fly.dev/?PROLIFIC_PID={{%PROLIFIC_PID%}}
```

---

## Deployment

```bash
fly deploy --app test-social-influence-task
```

SQLite DB persists on a Fly volume (`/data/social_influence.db`). **Never scale to more than one machine** — each machine gets its own volume.

---

## Repository Structure

```
art-task/
├── backend/
│   └── app/
│       ├── main.py                  # FastAPI routes
│       ├── models.py                # ORM: Session, Block, Rating, Event
│       ├── db.py                    # DB engine / session factory
│       ├── stimuli.py               # Trial builder, counterbalancing lookup
│       ├── pilot.py                 # Participant index counter
│       ├── counterbalancing.json    # 24-config avatar assignment table
│       └── stimuli/
│           ├── artworks.json        # 120 artwork definitions + image URLs
│           └── agent_ratings.json   # Pre-generated agent ratings (optional)
├── frontend/
│   └── src/
│       ├── main.tsx                 # Entry: routes to LandingFlow or PilotApp
│       ├── LandingFlow.tsx          # Researcher landing page
│       ├── PilotApp.tsx             # Prolific / online flow
│       ├── timeline.ts              # jsPsych trial sequence
│       ├── api.ts                   # API client
│       └── components/
│           └── TimelineRunner.tsx
│   └── public/
│       └── avatars/                 # 16 avatar PNGs (r{race}_{gender}_{name}.png)
└── Dockerfile
```

---

## Data Schema

**`sessions`**

| Column | Description |
|---|---|
| `participant_id` | Prolific PID or `P{n}` for in-person |
| `mode` | `test` or `full` |
| `condition_order` | `si_p{index}` |
| `identity_order` | JSON: condition → [agent1_id, agent2_id] for all 4 pairs |
| `sc_session_id` | Chat task session ID for cross-task linkage (when available) |

**`ratings`** — two rows per artwork per participant

| Column | Initial | Re-rating |
|---|---|---|
| `rating_type` | `"initial"` | `"rerate"` |
| `rating` | participant's rating | participant's re-rating |
| `pair_condition` | null | `friendly` / `neutral` / `friendly_control` / `neutral_control` |
| `agent1_condition` | null | agent 1 avatar ID |
| `agent2_condition` | null | agent 2 avatar ID |
| `avg_rating` | null | average shown to participant |
| `rating_rt_ms` | RT from screen onset to submit | same |
| `trial_index` | position in randomised order | same |

**Core analysis query:**
```sql
SELECT
  s.participant_id,
  s.identity_order,
  i.artwork_id,
  i.trial_index,
  i.rating                                        AS initial_rating,
  i.rating_rt_ms                                  AS initial_rt_ms,
  r.rating                                        AS rerate,
  r.rating_rt_ms                                  AS rerate_rt_ms,
  r.pair_condition,
  r.agent1_condition,
  r.agent2_condition,
  r.avg_rating,
  (r.rating - i.rating)                           AS delta,
  (r.rating - i.rating)
    / NULLIF(ABS(r.avg_rating - i.rating), 0)     AS norm_influence
FROM ratings i
JOIN ratings r  ON i.block_id = r.block_id
                AND i.artwork_id = r.artwork_id
                AND i.rating_type = 'initial'
                AND r.rating_type = 'rerate'
JOIN blocks b   ON i.block_id = b.id
JOIN sessions s ON b.session_id = s.id
ORDER BY s.participant_id, i.trial_index;
```

# BhashaLens — Calm Light UI + User Portal + Admin Portal

> **⚠ DATA INTEGRITY & DISCLAIMER**
> • Baseline evaluation records in `demo_recordings.json` are **illustrative synthetic demonstration data** created for methodology benchmarking.
> • Community submissions are collected voluntarily under **Informed Consent Policy v2.0**.
> • Only **human-reviewed and approved** community records enter versioned, immutable benchmarks.
> • Synthetic baseline data and human-verified community data are **strictly separated** in the dashboard and API.

---

## 1. Product Overview

BhashaLens is a competition-ready speech intelligence and benchmark evaluation platform for regional Indian languages (Hindi, Marathi, Bhojpuri, Chhattisgarhi, Maithili).

This evolution delivers:
1. **Calm, Modern Light Theme**:
   - Palette: Soft off-white background (`#F8FAFC`), crisp white surfaces (`#FFFFFF`), deep navy typography (`#1F2937`), muted slate descriptions (`#64748B`), calm blue accents (`#2563EB`), and soft teal highlights (`#0D9488`).
   - High readability, accessible focus rings, subtle box-shadows, and support for `prefers-reduced-motion`.
2. **Dedicated User Portal**:
   - `/app` — Contributor Dashboard: greeting, "Submit New Input" primary CTA, submission counts (total, pending, approved, needs correction, withdrawn), recent submissions table.
   - `/app/submit` — Dedicated AI input submission: Mode A (Guided reading with regional prompts & TTS playback) and Mode B (Natural speech), Web Audio recording + file upload fallback, demographic slice, preview modal, real ASR response, deletion token, and immediate right-to-erasure withdrawal.
   - `/app/submissions` — User-specific submission history (strictly isolated from other users).
   - `/app/submissions/:id` — Individual submission details: audio playback, hypothesis vs reference diff, WER breakdown, and deletion token.
   - `/app/profile` — Contributor account profile and session logout.
3. **Dedicated Admin Portal**:
   - `/admin` — Governance Overview: registered user counts, submission status counters, quick review shortcuts, recent system activity.
   - `/admin/users` — User Management: search, filter by role/status, enable/disable accounts, change user roles with safeguards.
   - `/admin/submissions` — System-wide submissions view with filters (status, language, district) and audio inspection.
   - `/admin/review` — Human Review Queue: approve, reject, correct transcripts, exclude, and record append-only audit logs.
   - `/admin/coverage` — Evidence Coverage Matrix: District × Gender × Age Group with demographic filters and error decomposition.
   - `/admin/diagnostics` — System diagnostics, WER recognition chart, district cards, and mathematical formula modal.
   - `/admin/action-plan` — Recording collection priorities, community overrides with human sign-off, and UTF-8 BOM CSV manifest export.
   - `/admin/governance` — Benchmark datasets and candidate model evaluations.
   - `/admin/settings` — Threshold configuration, active data tier selector, and system health.
4. **Secure Role-Based Access Control**:
   - Cryptographically hashed passwords (PBKDF2-HMAC-SHA256 with 600,000 iterations).
   - Session tokens supporting both HTTP-only SameSite cookies and Bearer tokens.
   - Backend-enforced user isolation: regular contributors cannot view other contributors' private submissions or administrative endpoints.
5. **Competition Evaluator Quick-Access**:
   - 1-click evaluator buttons at the top of the app to switch instantly between **Demo User** and **Demo Admin** without typing passwords.

---

## 2. User & Admin Permissions Matrix

| Capability | USER (Contributor) | REVIEWER (Linguist) | ADMIN (Governance Lead) |
|---|---|---|---|
| View own Contributor Dashboard (`/app`) | ✅ Yes | ✅ Yes | ✅ Yes |
| Submit AI Voice / Speech (`/app/submit`) | ✅ Yes | ✅ Yes | ✅ Yes |
| View own submission history (`/app/submissions`) | ✅ Yes (Isolated) | ✅ Yes (Isolated) | ✅ Yes |
| View another user's private submissions | ❌ No (HTTP 403) | ✅ Authorized | ✅ Authorized |
| Delete/Withdraw own recording via token | ✅ Yes | ✅ Yes | ✅ Yes |
| Access Admin Overview (`/admin`) | ❌ No (Blocked) | ✅ Yes | ✅ Yes |
| Review Queue & Correct Transcripts (`/admin/review`) | ❌ No (HTTP 403) | ✅ Yes | ✅ Yes |
| Manage Registered Users (`/admin/users`) | ❌ No (HTTP 403) | ❌ No (HTTP 403) | ✅ Yes |
| Enable/Disable User Accounts | ❌ No (HTTP 403) | ❌ No (HTTP 403) | ✅ Yes |
| Promote or Change User Roles | ❌ No (HTTP 403) | ❌ No (HTTP 403) | ✅ Yes (Audited) |
| Freeze & Publish Versioned Benchmark Datasets | ❌ No (HTTP 403) | ❌ No (HTTP 403) | ✅ Yes |
| Promote Candidate Model to Active Baseline | ❌ No (HTTP 403) | ❌ No (HTTP 403) | ✅ Yes |
| Configure Global Thresholds & Data Tiers | ❌ No (HTTP 403) | ❌ No (HTTP 403) | ✅ Yes |

---

## 3. Demo Accounts & Local Credentials

Reproducible development seed accounts are automatically verified and seeded on startup:

| Account Type | Email Address | Password | Role | Access Scope |
|---|---|---|---|---|
| **Demo User** | `user@bhashalens.org` | `DemoUser123!` | `USER` | Dedicated User Portal (`/app`, `/app/submit`, `/app/submissions`, `/app/profile`) |
| **Demo Admin** | `admin@bhashalens.org` | `AdminPass123!` | `ADMIN` | Dedicated Admin Portal (`/admin`, `/admin/users`, `/admin/submissions`, `/admin/review`, etc.) |
| **Demo Reviewer** | `reviewer@bhashalens.org` | `ReviewerPass123!` | `REVIEWER` | Admin review queue and linguist transcript verification |

> **Evaluator Tip**: In the UI top navigation bar, click the **👤 Demo User** or **🛡️ Demo Admin** buttons to log in and switch roles in a single click.

---

## 4. Local Development Setup Instructions

### Prerequisites
- Python 3.10+ (Tested on Python 3.14)
- Node.js 18+ & npm (Tested on Node v24.19.0 / npm 11.17.0)

### Backend Setup
```bash
# Navigate to backend directory
cd backend

# Install dependencies (if not already installed)
pip install -r requirements.txt

# Run backend development server
python -m uvicorn app.main:app --reload --port 8000
```
Backend API will be accessible at: `http://localhost:8000/api`  
Interactive Swagger docs: `http://localhost:8000/docs`

### Frontend Setup
```bash
# In a new terminal, navigate to frontend directory
cd frontend

# Install npm dependencies (if not already installed)
npm install

# Start Vite development server
npm run dev
```
Frontend web application will run at: `http://localhost:5173`

---

## 5. Verification & Test Results

### Running Backend Tests
Execute pytest to run the comprehensive 112-test suite:
```bash
# From the project root
python -m pytest backend/tests -v
```

**Results:**
- **112 / 112 tests passing** (100% pass rate in ~1.7s)
  - `backend/tests/test_auth_and_portals.py`: 8 tests covering registration, login, role guards, user isolation, and stats.
  - `backend/tests/test_bhashalens_v2.py`: 20 tests covering all Phase 11 acceptance criteria.
  - `backend/tests/test_api.py`, `test_coverage.py`, `test_priorities.py`, `test_wer.py`, `test_language.py`: 84 tests covering analytical calculations and APIs.

### Running Frontend Checks
```bash
# Build TypeScript and Vite bundle
cd frontend
npm run build

# Run Oxlint
npm run lint
```
**Results:**
- `npm run build`: Successfully compiled `dist/` production assets with zero errors.
- `npm run lint`: 0 errors.

---

## 6. Backend Additions Summary

1. **Authentication Engine (`backend/app/auth.py`)**:
   - Cryptographic PBKDF2-HMAC-SHA256 password hashing.
   - Secure token session manager with `sessions` table.
   - FastAPI dependencies: `get_optional_current_user`, `get_required_current_user`, `require_role(["ADMIN"])`.
   - Automatic seeding of `user@bhashalens.org`, `admin@bhashalens.org`, and `reviewer@bhashalens.org`.
2. **Schema Migration (`backend/app/db.py`)**:
   - `users` table: `id`, `email`, `name`, `password_hash`, `salt`, `role`, `is_active`, `created_at`, `last_login_at`.
   - `sessions` table: `token`, `user_id`, `expires_at`, `created_at`.
   - Added `user_id` foreign key column and index to `submissions` table.
3. **New API Endpoints (`backend/app/main.py`)**:
   - `POST /api/auth/register` — Contributor registration (defaults strictly to USER).
   - `POST /api/auth/login` — Session authentication (sets HttpOnly cookie + Bearer token).
   - `POST /api/auth/logout` — Invalidate session and clear cookie.
   - `GET /api/auth/me` — Current authenticated user profile.
   - `GET /api/user/stats` — Contributor-specific counts (total, pending, approved, needs correction, withdrawn).
   - `GET /api/user/submissions` — Contributor-specific submission history.
   - `GET /api/admin/users` — Admin user management with search & filter.
   - `PATCH /api/admin/users/{user_id}/status` — Admin account activate/deactivate.
   - `PATCH /api/admin/users/{user_id}/role` — Admin role assignment with demotion protection.
   - Updated `GET /api/submissions` & `GET /api/submissions/{id}` to enforce user ownership isolation.

---

## 7. Known Limitations

- **Browser Microphone API**: Recording directly in browser requires a secure context (`localhost` or `https`). On environments where microphone permissions are denied, the system provides a file upload fallback supporting `.wav`, `.mp3`, `.ogg`, `.webm`, and `.m4a` files up to 15MB.
- **ASR Transcription Mode**: Defaults to `MockASRProvider` in local test environments so the application runs with zero external API key requirements. To connect live OpenAI Whisper or a local model, set `ASR_PROVIDER=whisper` and provide `ASR_API_KEY` in `backend/.env`.

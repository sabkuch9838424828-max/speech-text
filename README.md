# BhashaLens — District WER Dashboard

> **⚠ ILLUSTRATIVE DEMO DATA** — All recordings and WER scores in this repository are **synthetic and invented** for development and demonstration purposes. They do **not** represent real district ASR performance, real speakers, or real evaluation results.

Built for the **Bhasha & Bol Bharat Hackathon**.

---

## What it does

BhashaLens shows Word Error Rate (WER) broken down by **district, gender, and age group** — and crucially, it **distinguishes poor performance from missing evidence**. Every cell is in one of five states:

| State | Meaning |
|---|---|
| `no_data` | No recordings collected for this group |
| `insufficient` | Too few recordings/words for a reliable estimate |
| `cannot_calculate` | All recordings have zero reference words |
| `high_wer` | WER ≥ threshold (default 30%) |
| `ok` | Sufficient data, WER below threshold |

A missing group is **never** reported as 0% WER.

---

## WER Formula

```
WER = (Substitutions + Deletions + Insertions) / Reference Word Count × 100
```

Aggregation always **sums edit counts first**, then divides — never averages per-record percentages.

---

## Quick Start

### 1. Backend

```powershell
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
# → http://localhost:8000
# → http://localhost:8000/docs  (interactive API docs)
```

Or double-click **`start_backend.bat`**.

### 2. Frontend

```powershell
cd frontend
pnpm install   # first time only
pnpm dev
# → http://localhost:5173
```

Or double-click **`start_frontend.bat`**.

### 3. Tests

```powershell
cd backend
python -m pytest tests/ -v
```

Or double-click **`run_tests.bat`**.

---

## Project Structure

```
flux1/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI routes
│   │   ├── wer.py           # Pure WER logic (no side effects)
│   │   ├── aggregator.py    # Summed-edit-count aggregation
│   │   ├── coverage.py      # Evidence coverage matrix
│   │   ├── priorities.py    # Collection priority engine
│   │   ├── data_loader.py   # JSON loader + validation
│   │   └── models.py        # Pydantic schemas
│   ├── data/
│   │   └── demo_recordings.json   # ⚠ DEMO DATA
│   └── tests/
│       ├── test_wer.py
│       ├── test_api.py
│       ├── test_coverage.py
│       └── test_priorities.py
└── frontend/
    └── src/
        ├── components/      # DistrictCard, WerChart, CoverageMatrix, …
        ├── api/client.ts    # Typed fetch helpers
        ├── hooks/useAsync.ts
        ├── types/index.ts
        └── App.tsx
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Liveness + DEMO label |
| GET | `/api/districts` | List of districts |
| GET | `/api/wer/overview` | Aggregated WER per district |
| GET | `/api/wer/detail?district=&gender=&age_group=` | Filtered WER |
| GET | `/api/coverage/matrix` | District × gender × age evidence grid |
| GET | `/api/priorities` | Ranked collection gaps with explanations |
| POST | `/api/feedback` | Submit community review |

All threshold parameters (`min_recordings`, `min_reference_words`, `high_wer_threshold`) are configurable via query string.

---

## Data Integrity Rules

- ❌ Never invent or impute a WER score for a missing group  
- ❌ Never treat absent records as 0% WER  
- ❌ Never calculate WER when `reference_word_count = 0`  
- ❌ Never hide insufficient sample sizes behind aggregate scores  
- ✅ Always show recording count and reference-word count alongside WER  
- ✅ Always label synthetic data as ILLUSTRATIVE DEMO DATA  

---

## Thresholds (configurable)

| Parameter | Default | Meaning |
|---|---|---|
| `min_recordings` | 5 | Minimum recordings needed before computing WER |
| `min_reference_words` | 20 | Minimum reference words needed |
| `high_wer_threshold` | 30% | WER at or above this → `high_wer` status |

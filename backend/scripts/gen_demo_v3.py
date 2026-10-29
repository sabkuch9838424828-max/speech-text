"""
Regenerate demo_recordings.json with multi-language distribution per district/age group.
⚠ ALL DATA IS SYNTHETIC — for hackathon demo only.
"""
import json, random, math
from pathlib import Path

random.seed(42)

OUTPUT = Path(__file__).parent.parent / "data" / "demo_recordings.json"

# ── District → realistic language mix ────────────────────────────────────────
# Each district has a primary + possible secondary language
# Weights represent approximate speaker proportions in demo scenario
DISTRICT_LANGUAGES = {
    "Pune":       [("Marathi", 0.70), ("Hindi", 0.20), ("Urdu", 0.10)],
    "Nashik":     [("Marathi", 0.75), ("Hindi", 0.15), ("Ahirani", 0.10)],
    "Nagpur":     [("Marathi", 0.60), ("Hindi", 0.25), ("Gondi", 0.15)],
    "Aurangabad": [("Marathi", 0.55), ("Urdu", 0.30), ("Hindi", 0.15)],
    "Kolhapur":   [("Marathi", 0.80), ("Kannada", 0.12), ("Hindi", 0.08)],
    "Solapur":    [("Marathi", 0.65), ("Kannada", 0.20), ("Telugu", 0.15)],
    "Bhojpur":    [("Bhojpuri", 0.65), ("Hindi", 0.30), ("Maithili", 0.05)],
    "Bastar":     [("Chhattisgarhi", 0.55), ("Gondi", 0.35), ("Hindi", 0.10)],
    "Sambalpur":  [("Odia", 0.60), ("Sambalpuri", 0.25), ("Hindi", 0.15)],
    "Almora":     [("Garhwali", 0.50), ("Kumaoni", 0.35), ("Hindi", 0.15)],
    "Darbhanga":  [("Maithili", 0.55), ("Bhojpuri", 0.30), ("Hindi", 0.15)],
    "Varanasi":   [("Hindi", 0.60), ("Bhojpuri", 0.30), ("Urdu", 0.10)],
}

GENDERS     = ["female", "male"]
AGE_GROUPS  = ["18-30", "31-50", "51+"]
STATES = {
    "Pune": "Maharashtra", "Nashik": "Maharashtra", "Nagpur": "Maharashtra",
    "Aurangabad": "Maharashtra", "Kolhapur": "Maharashtra", "Solapur": "Maharashtra",
    "Bhojpur": "Bihar", "Bastar": "Chhattisgarh", "Sambalpur": "Odisha",
    "Almora": "Uttarakhand", "Darbhanga": "Bihar", "Varanasi": "Uttar Pradesh",
}

# How many recordings per district×gender×age cell (0 means missing)
# Designed for compelling demo: some blindspots, some insufficient, some high WER
CELL_COUNTS = {
    # district: {(gender, age_group): count}
    "Pune":       {("female","18-30"):18, ("female","31-50"):14, ("female","51+"):6,
                   ("male","18-30"):20,   ("male","31-50"):12,   ("male","51+"):4},
    "Nashik":     {("female","18-30"):15, ("female","31-50"):10, ("female","51+"):7,
                   ("male","18-30"):18,   ("male","31-50"):9,    ("male","51+"):5},
    "Nagpur":     {("female","18-30"):12, ("female","31-50"):8,  ("female","51+"):0,
                   ("male","18-30"):14,   ("male","31-50"):6,    ("male","51+"):5},
    "Aurangabad": {("female","18-30"):10, ("female","31-50"):7,  ("female","51+"):0,
                   ("male","18-30"):8,    ("male","31-50"):0,    ("male","51+"):0},
    "Kolhapur":   {("female","18-30"):9,  ("female","31-50"):6,  ("female","51+"):0,
                   ("male","18-30"):10,   ("male","31-50"):4,    ("male","51+"):0},
    "Solapur":    {("female","18-30"):2,  ("female","31-50"):0,  ("female","51+"):0,
                   ("male","18-30"):0,    ("male","31-50"):0,    ("male","51+"):0},
    "Bhojpur":    {("female","18-30"):12, ("female","31-50"):8,  ("female","51+"):7,
                   ("male","18-30"):14,   ("male","31-50"):6,    ("male","51+"):5},
    "Bastar":     {("female","18-30"):0,  ("female","31-50"):0,  ("female","51+"):0,
                   ("male","18-30"):3,    ("male","31-50"):0,    ("male","51+"):0},
    "Sambalpur":  {("female","18-30"):10, ("female","31-50"):6,  ("female","51+"):3,
                   ("male","18-30"):12,   ("male","31-50"):5,    ("male","51+"):4},
    "Almora":     {("female","18-30"):0,  ("female","31-50"):0,  ("female","51+"):0,
                   ("male","18-30"):2,    ("male","31-50"):0,    ("male","51+"):0},
    "Darbhanga":  {("female","18-30"):8,  ("female","31-50"):5,  ("female","51+"):0,
                   ("male","18-30"):10,   ("male","31-50"):4,    ("male","51+"):3},
    "Varanasi":   {("female","18-30"):10, ("female","31-50"):7,  ("female","51+"):4,
                   ("male","18-30"):12,   ("male","31-50"):6,    ("male","51+"):4},
}

# Base WER rates per district×age (approximate, high_wer showcase cells marked)
# Format: (sub_rate, del_rate, ins_rate) as fraction of ref words
WER_RATES = {
    # district: {age_group: (sub%, del%, ins%)} — higher for 51+ typically
    "Pune":       {"18-30":(0.05,0.03,0.02), "31-50":(0.08,0.04,0.03), "51+":(0.15,0.08,0.05)},
    "Nashik":     {"18-30":(0.06,0.04,0.02), "31-50":(0.10,0.05,0.03), "51+":(0.18,0.09,0.05)},
    "Nagpur":     {"18-30":(0.07,0.04,0.03), "31-50":(0.12,0.06,0.04), "51+":(0.22,0.10,0.06)},
    "Aurangabad": {"18-30":(0.09,0.05,0.03), "31-50":(0.14,0.07,0.04), "51+":(0.25,0.12,0.07)},
    "Kolhapur":   {"18-30":(0.07,0.04,0.02), "31-50":(0.11,0.06,0.03), "51+":(0.20,0.10,0.06)},
    "Solapur":    {"18-30":(0.10,0.06,0.03), "31-50":(0.15,0.08,0.05), "51+":(0.28,0.14,0.08)},
    "Bhojpur":    {"18-30":(0.08,0.05,0.03), "31-50":(0.14,0.07,0.04), "51+":(0.28,0.13,0.07)},  # ← high WER showcase
    "Bastar":     {"18-30":(0.12,0.07,0.04), "31-50":(0.18,0.09,0.05), "51+":(0.30,0.15,0.08)},
    "Sambalpur":  {"18-30":(0.08,0.05,0.03), "31-50":(0.13,0.07,0.04), "51+":(0.26,0.12,0.07)},
    "Almora":     {"18-30":(0.11,0.06,0.04), "31-50":(0.17,0.09,0.05), "51+":(0.32,0.16,0.09)},
    "Darbhanga":  {"18-30":(0.09,0.05,0.03), "31-50":(0.15,0.08,0.04), "51+":(0.24,0.11,0.06)},
    "Varanasi":   {"18-30":(0.06,0.04,0.02), "31-50":(0.10,0.05,0.03), "51+":(0.18,0.09,0.05)},
}

SAMPLE_REFS = [
    "आज मौसम बहुत अच्छा है", "मेरा नाम सुनो ध्यान से",
    "यह रास्ता कहाँ जाता है", "पानी लेकर आओ जल्दी",
    "बाजार में भीड़ बहुत थी", "खेत में काम हो रहा था",
    "बच्चे स्कूल गए हैं", "दवाई समय पर लेनी है",
    "बारिश आने वाली है", "गाँव में बिजली नहीं है",
    "मछली पकड़ने गए थे", "पहाड़ पर बर्फ है",
    "नदी का पानी साफ है", "सरकारी काम धीरे चलता है",
]

def pick_language(district, age_group):
    """Older speakers more likely to speak minority/regional language."""
    langs, weights = zip(*DISTRICT_LANGUAGES[district])
    weights = list(weights)
    # Shift weight toward secondary languages for older age groups
    if age_group == "51+" and len(langs) > 1:
        weights[0] *= 0.6
        for i in range(1, len(langs)):
            weights[i] *= 1.6
    total = sum(weights)
    weights = [w/total for w in weights]
    return random.choices(langs, weights=weights, k=1)[0]

def make_recording(idx, district, gender, age_group, lang):
    rates = WER_RATES[district][age_group]
    ref = random.choice(SAMPLE_REFS)
    ref_words = len(ref.split())
    # Add jitter
    jitter = lambda r: max(0, r + random.gauss(0, r * 0.3))
    s = round(jitter(rates[0]) * ref_words)
    d = round(jitter(rates[1]) * ref_words)
    i = round(jitter(rates[2]) * ref_words)
    return {
        "id": f"rec_{idx:04d}",
        "district": district,
        "state": STATES[district],
        "gender": gender,
        "age_group": age_group,
        "language": lang,
        "reference_text": ref,
        "hypothesis_text": ref,
        "substitutions": s,
        "deletions": d,
        "insertions": i,
        "reference_word_count": ref_words,
        "recorded_at": "2025-06-15T09:00:00Z",
    }

recordings = []
idx = 1
for district, cells in CELL_COUNTS.items():
    for (gender, age_group), count in cells.items():
        for _ in range(count):
            lang = pick_language(district, age_group)
            recordings.append(make_recording(idx, district, gender, age_group, lang))
            idx += 1

output = {
    "_meta": {
        "warning": "ILLUSTRATIVE DEMO DATA — These records are synthetic and invented for hackathon demonstration only. They do NOT represent real district performance, real speakers, or real ASR system evaluation.",
        "generated_for": "BhashaLens Hackathon MVP v0.3",
        "data_label": "DEMO",
    },
    "recordings": recordings,
}

OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Written {len(recordings)} recordings to {OUTPUT}")

# Summary
from collections import Counter
ld = Counter((r["district"], r["language"]) for r in recordings)
print("\nDistrict × Language counts:")
for (d, l), c in sorted(ld.items()):
    print(f"  {d:14s} / {l:16s}: {c}")

la = Counter((r["district"], r["age_group"], r["language"]) for r in recordings)
print("\nSample district × age × language:")
for (d, a, l), c in list(sorted(la.items()))[:30]:
    print(f"  {d:14s} / {a:6s} / {l:16s}: {c}")

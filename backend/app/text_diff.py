"""
Word-level alignment and text difference engine for BhashaLens.
Computes substitutions, deletions, insertions, and detailed token alignments.
Detects script mixing, potential code-switching, and dialect variations.
"""
from __future__ import annotations
import re
from typing import Any, Optional
from app.wer import calculate_wer, WerStatus

# Script regexes
DEVANAGARI_REGEX = re.compile(r'[\u0900-\u097F]')
LATIN_REGEX = re.compile(r'[a-zA-Z]')

def tokenize(text: str) -> list[str]:
    """Tokenize sentence into clean word tokens, stripping punctuation."""
    if not text:
        return []
    # Replace punctuation characters with whitespace
    cleaned = re.sub(r'[।॥,\.\?!;:"\'\(\)\[\]\{\}\<\>\\/\-_]', ' ', text)
    return [w.strip() for w in cleaned.split() if w.strip()]

def compute_alignment(
    ref_tokens: list[str],
    hyp_tokens: list[str]
) -> dict[str, Any]:
    """
    Standard dynamic programming Levenshtein algorithm at word level.
    Returns:
      - substitutions: int
      - deletions: int
      - insertions: int
      - alignment_ops: list of dicts {type: 'match'|'sub'|'del'|'ins', ref: str|None, hyp: str|None}
    """
    n = len(ref_tokens)
    m = len(hyp_tokens)

    # DP table: dp[i][j] = (cost, op, parent_i, parent_j)
    dp = [[0] * (m + 1) for _ in range(n + 1)]

    for i in range(1, n + 1):
        dp[i][0] = i  # deletions
    for j in range(1, m + 1):
        dp[0][j] = j  # insertions

    for i in range(1, n + 1):
        ref_word = ref_tokens[i - 1]
        for j in range(1, m + 1):
            hyp_word = hyp_tokens[j - 1]

            if ref_word == hyp_word:
                cost = 0
            else:
                cost = 1

            sub_cost = dp[i - 1][j - 1] + cost
            del_cost = dp[i - 1][j] + 1
            ins_cost = dp[i][j - 1] + 1

            dp[i][j] = min(sub_cost, del_cost, ins_cost)

    # Backtrack to obtain alignment operations
    i = n
    j = m
    ops: list[dict[str, Any]] = []
    subs = 0
    dels = 0
    inss = 0

    while i > 0 or j > 0:
        ref_word = ref_tokens[i - 1] if i > 0 else None
        hyp_word = hyp_tokens[j - 1] if j > 0 else None

        if i > 0 and j > 0 and dp[i][j] == dp[i - 1][j - 1] and ref_word == hyp_word:
            ops.append({"type": "match", "ref": ref_word, "hyp": hyp_word})
            i -= 1
            j -= 1
        elif i > 0 and j > 0 and dp[i][j] == dp[i - 1][j - 1] + 1:
            ops.append({"type": "substitution", "ref": ref_word, "hyp": hyp_word})
            subs += 1
            i -= 1
            j -= 1
        elif i > 0 and dp[i][j] == dp[i - 1][j] + 1:
            ops.append({"type": "deletion", "ref": ref_word, "hyp": None})
            dels += 1
            i -= 1
        else:
            ops.append({"type": "insertion", "ref": None, "hyp": hyp_word})
            inss += 1
            j -= 1

    ops.reverse()

    return {
        "substitutions": subs,
        "deletions": dels,
        "insertions": inss,
        "alignment_ops": ops,
    }

def analyze_transcript_differences(
    reference_text: Optional[str],
    hypothesis_text: str
) -> dict[str, Any]:
    """
    Compares reference and hypothesis.
    Handles empty reference as CANNOT_CALCULATE.
    """
    hyp_tokens = tokenize(hypothesis_text)

    # Detect code switching / script mixing in hypothesis
    has_devanagari = bool(DEVANAGARI_REGEX.search(hypothesis_text))
    has_latin = bool(LATIN_REGEX.search(hypothesis_text))
    code_switching_detected = has_devanagari and has_latin

    # Flag potential uncertainties
    uncertain_words = []
    for token in hyp_tokens:
        if LATIN_REGEX.search(token) and DEVANAGARI_REGEX.search(token):
            uncertain_words.append({"word": token, "reason": "mixed_script"})

    if not reference_text or not reference_text.strip():
        return {
            "status": WerStatus.CANNOT_CALCULATE.value,
            "wer_pct": None,
            "substitutions": 0,
            "deletions": 0,
            "insertions": len(hyp_tokens),
            "reference_word_count": 0,
            "alignment_ops": [{"type": "insertion", "ref": None, "hyp": w} for w in hyp_tokens],
            "code_switching_detected": code_switching_detected,
            "uncertain_words": uncertain_words,
        }

    ref_tokens = tokenize(reference_text)
    ref_word_count = len(ref_tokens)

    if ref_word_count == 0:
        return {
            "status": WerStatus.CANNOT_CALCULATE.value,
            "wer_pct": None,
            "substitutions": 0,
            "deletions": 0,
            "insertions": len(hyp_tokens),
            "reference_word_count": 0,
            "alignment_ops": [{"type": "insertion", "ref": None, "hyp": w} for w in hyp_tokens],
            "code_switching_detected": code_switching_detected,
            "uncertain_words": uncertain_words,
        }

    align = compute_alignment(ref_tokens, hyp_tokens)
    subs = align["substitutions"]
    dels = align["deletions"]
    inss = align["insertions"]

    # Calculate raw WER percentage (uncapped)
    raw_wer = (subs + dels + inss) / ref_word_count * 100.0
    status = WerStatus.HIGH_WER.value if raw_wer >= 25.0 else WerStatus.OK.value

    return {
        "status": status,
        "wer_pct": round(raw_wer, 2),
        "substitutions": subs,
        "deletions": dels,
        "insertions": inss,
        "reference_word_count": ref_word_count,
        "alignment_ops": align["alignment_ops"],
        "code_switching_detected": code_switching_detected,
        "uncertain_words": uncertain_words,
    }

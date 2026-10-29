"""
Database engine and schema management for BhashaLens 2.0.
Uses SQLite with WAL mode, foreign keys, and atomic transactions.
"""
from __future__ import annotations
import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

DB_PATH = Path(__file__).parent.parent / "data" / "bhashalens.db"
AUDIO_STORE_DIR = Path(__file__).parent.parent / "data" / "audio_store"

def get_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    AUDIO_STORE_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    return conn

def init_db() -> None:
    conn = get_connection()
    with conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS prompts (
            id TEXT PRIMARY KEY,
            language TEXT NOT NULL,
            dialect TEXT,
            text TEXT NOT NULL,
            difficulty TEXT DEFAULT 'medium',
            domain TEXT DEFAULT 'general'
        );

        CREATE TABLE IF NOT EXISTS submissions (
            id TEXT PRIMARY KEY,
            deletion_token TEXT NOT NULL,
            contribution_mode TEXT NOT NULL, -- 'guided' or 'natural'
            language TEXT NOT NULL,
            dialect TEXT,
            speech_context TEXT,
            prompt_id TEXT,
            reference_text TEXT,
            hypothesis_text TEXT,
            model_name TEXT,
            model_version TEXT,
            confidence_score REAL,
            uncertain_words_json TEXT DEFAULT '[]',
            audio_storage_path TEXT NOT NULL,
            audio_filename TEXT NOT NULL,
            audio_format TEXT NOT NULL,
            audio_size_bytes INTEGER NOT NULL,
            audio_duration_sec REAL DEFAULT 0.0,
            audio_sha256 TEXT NOT NULL,
            duplicate_of_id TEXT,
            quality_flags_json TEXT DEFAULT '[]',
            substitutions INTEGER DEFAULT 0,
            deletions INTEGER DEFAULT 0,
            insertions INTEGER DEFAULT 0,
            reference_word_count INTEGER DEFAULT 0,
            wer_pct REAL,
            wer_status TEXT NOT NULL,
            district TEXT,
            state TEXT,
            gender TEXT,
            age_group TEXT,
            consent_policy_version TEXT NOT NULL,
            consent_given INTEGER NOT NULL,
            age_verified INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'RECEIVED',
            review_priority INTEGER DEFAULT 3,
            is_excluded INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_sub_status ON submissions(status);
        CREATE INDEX IF NOT EXISTS idx_sub_sha256 ON submissions(audio_sha256);
        CREATE INDEX IF NOT EXISTS idx_sub_lang ON submissions(language);
        CREATE INDEX IF NOT EXISTS idx_sub_created ON submissions(created_at);

        CREATE TABLE IF NOT EXISTS review_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            submission_id TEXT NOT NULL,
            reviewer_name TEXT NOT NULL,
            reviewer_role TEXT NOT NULL,
            action TEXT NOT NULL,
            prior_status TEXT NOT NULL,
            new_status TEXT NOT NULL,
            prior_transcript TEXT,
            new_transcript TEXT,
            reason TEXT,
            notes TEXT,
            timestamp TEXT NOT NULL,
            FOREIGN KEY(submission_id) REFERENCES submissions(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_rev_sub ON review_history(submission_id);

        CREATE TABLE IF NOT EXISTS datasets (
            id TEXT PRIMARY KEY,
            version TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL,
            description TEXT,
            total_records INTEGER NOT NULL,
            language_breakdown_json TEXT NOT NULL,
            published_by TEXT NOT NULL,
            published_at TEXT NOT NULL,
            is_active_benchmark INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS dataset_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            dataset_id TEXT NOT NULL,
            submission_id TEXT NOT NULL,
            approved_text TEXT NOT NULL,
            split TEXT NOT NULL, -- 'train', 'validation', 'test'
            contributor_group_id TEXT,
            UNIQUE(dataset_id, submission_id),
            FOREIGN KEY(dataset_id) REFERENCES datasets(id) ON DELETE CASCADE,
            FOREIGN KEY(submission_id) REFERENCES submissions(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_ds_item ON dataset_items(dataset_id, split);

        CREATE TABLE IF NOT EXISTS model_evaluations (
            id TEXT PRIMARY KEY,
            candidate_model_name TEXT NOT NULL,
            candidate_model_version TEXT NOT NULL,
            dataset_id TEXT NOT NULL,
            split_evaluated TEXT NOT NULL,
            total_samples INTEGER NOT NULL,
            overall_wer REAL,
            baseline_wer REAL,
            wer_delta REAL,
            sample_limitation_warning TEXT,
            evaluation_metrics_json TEXT NOT NULL,
            evaluated_by TEXT NOT NULL,
            evaluated_at TEXT NOT NULL,
            is_promoted INTEGER DEFAULT 0,
            promoted_by TEXT,
            promoted_at TEXT,
            FOREIGN KEY(dataset_id) REFERENCES datasets(id)
        );

        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'USER',
            is_active INTEGER DEFAULT 1,
            created_at TEXT NOT NULL,
            last_login_at TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
        """)

        # Migration: Ensure user_id exists in submissions
        cur = conn.cursor()
        cur.execute("PRAGMA table_info(submissions);")
        cols = [c[1] for c in cur.fetchall()]
        if "user_id" not in cols:
            conn.execute("ALTER TABLE submissions ADD COLUMN user_id TEXT REFERENCES users(id);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_sub_user ON submissions(user_id);")

    # Seed default guided prompts if empty
    _seed_prompts(conn)
    conn.close()

def _seed_prompts(conn: sqlite3.Connection) -> None:
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM prompts;")
    count = cur.fetchone()[0]
    if count > 0:
        return

    default_prompts = [
        # Hindi
        ("hi_01", "Hindi", "Standard", "आज मौसम बहुत सुहावना है और शाम को हल्की बारिश हो सकती है।", "easy", "weather"),
        ("hi_02", "Hindi", "Standard", "कृपया नजदीकी प्राथमिक स्वास्थ्य केंद्र का रास्ता बताइए।", "medium", "navigation"),
        ("hi_03", "Hindi", "Standard", "किसानों को खरीफ की फसल के लिए न्यूनतम समर्थन मूल्य मिलेगा।", "hard", "agriculture"),
        ("hi_04", "Hindi", "Bhojpuri-influenced", "हम सब लोग मिलजुल कर गांव के विकास के लिए काम करेंगे।", "medium", "community"),
        # Marathi
        ("mr_01", "Marathi", "Standard", "आज संध्याकाळी पाऊस पडण्याची दाट शक्यता आहे.", "easy", "weather"),
        ("mr_02", "Marathi", "Deshi / Western", "गावातील सर्व शेतकऱ्यांनी उद्या ग्रामपंचायत कार्यालयात जमावे.", "medium", "governance"),
        ("mr_03", "Marathi", "Vidarbha", "शेतीसाठी पाणी आणि विजेची योग्य सोय झाली पाहिजे.", "medium", "agriculture"),
        # Bhojpuri
        ("bho_01", "Bhojpuri", "Standard", "हमनी के आज खेत में पानी देवे के बा अउर धान काटे के बा।", "medium", "agriculture"),
        ("bho_02", "Bhojpuri", "Standard", "रउवा कइसे बानी, घर-परिवार में सब ठीक ठाक बा? ", "easy", "conversation"),
        ("bho_03", "Bhojpuri", "Western", "गाँव के सड़क बन गईल बा त अब सहर जाये में आसानी होई।", "medium", "transport"),
        # Chhattisgarhi
        ("hne_01", "Chhattisgarhi", "Standard", "आज हमर पारा म बिहाव हे, सब झन ला नेवता हे।", "medium", "culture"),
        ("hne_02", "Chhattisgarhi", "Standard", "धान के मिंजाई हो गे हे, अब मंडी म बेचे बर ले जाना हे।", "hard", "agriculture"),
        # Maithili
        ("mai_01", "Maithili", "Standard", "अहां कतय जा रहल छी, किछ देर ठहरि कए गप करू।", "medium", "conversation"),
        ("mai_02", "Maithili", "Standard", "मिथिलाक कला आ संस्कृति पूरे संसार मे प्रसिद्ध अछि।", "medium", "culture"),
    ]
    cur.executemany(
        "INSERT INTO prompts (id, language, dialect, text, difficulty, domain) VALUES (?, ?, ?, ?, ?, ?);",
        default_prompts
    )
    conn.commit()

# Initialize immediately when module is loaded
init_db()

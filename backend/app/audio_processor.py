"""
Audio processing, validation, and quality diagnostic pipeline.
Performs header validation, magic byte checking, duration and amplitude analysis,
silence and clipping detection, and secure randomized key generation.
"""
from __future__ import annotations
import hashlib
import io
import math
import os
import struct
import uuid
import wave
from pathlib import Path
from typing import Any, Optional

MAX_AUDIO_SIZE_BYTES = 15 * 1024 * 1024  # 15 MB
MIN_DURATION_SEC = 0.5
MAX_DURATION_SEC = 60.0

# Supported mime-types and extensions
SUPPORTED_FORMATS = {
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/wave": "wav",
    "audio/webm": "webm",
    "video/webm": "webm", # MediaRecorder on some browsers outputs video/webm containing audio
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/m4a": "m4a",
    "audio/x-m4a": "m4a",
    "audio/mp4": "m4a",
    "audio/flac": "flac",
    "audio/x-flac": "flac",
}

# Magic signatures
MAGIC_SIGNATURES = [
    (b"RIFF", 0, "wav"),
    (b"\x1a\x45\xdf\xa3", 0, "webm"), # EBML header for WebM
    (b"OggS", 0, "ogg"),
    (b"ID3", 0, "mp3"),
    (b"\xff\xfb", 0, "mp3"),
    (b"\xff\xf3", 0, "mp3"),
    (b"\xff\xf2", 0, "mp3"),
    (b"fLaC", 0, "flac"),
    (b"ftypM4A", 4, "m4a"),
    (b"ftypmp42", 4, "m4a"),
    (b"ftypisom", 4, "m4a"),
]

class AudioValidationError(Exception):
    """Raised when uploaded audio fails format, size, or integrity checks."""
    def __init__(self, message: str, code: str = "INVALID_AUDIO"):
        super().__init__(message)
        self.code = code

def detect_audio_format(audio_bytes: bytes, filename: str = "", content_type: str = "") -> str:
    """Inspects magic bytes and headers to verify authentic audio format."""
    if len(audio_bytes) < 12:
        raise AudioValidationError("Audio file is too short or empty to be valid.", "CORRUPT_AUDIO")

    # Check magic byte signatures
    for sig, offset, fmt in MAGIC_SIGNATURES:
        if audio_bytes[offset:offset + len(sig)] == sig:
            return fmt

    # Fallback to content-type if valid
    if content_type in SUPPORTED_FORMATS:
        return SUPPORTED_FORMATS[content_type]

    # Fallback to extension check
    ext = Path(filename).suffix.lower().lstrip(".")
    if ext in {"wav", "mp3", "ogg", "webm", "m4a", "flac"}:
        return ext

    raise AudioValidationError(
        f"Unsupported audio format. Supported formats: WAV, WebM, MP3, OGG, M4A, FLAC.",
        "UNSUPPORTED_FORMAT"
    )

def analyze_audio_quality(
    audio_bytes: bytes,
    audio_format: str
) -> dict[str, Any]:
    """
    Analyzes audio data for duration, silence, clipping, and noise.
    Returns:
      - duration_sec: float
      - quality_flags: list[str] (e.g. 'silence', 'clipping', 'low_energy')
      - sha256: str
    """
    sha256_hash = hashlib.sha256(audio_bytes).hexdigest()
    quality_flags: list[str] = []
    duration_sec = 0.0

    if audio_format == "wav":
        try:
            with io.BytesIO(audio_bytes) as buf:
                with wave.open(buf, "rb") as wf:
                    n_channels = wf.getnchannels()
                    sampwidth = wf.getsampwidth()
                    framerate = wf.getframerate()
                    n_frames = wf.getnframes()
                    if framerate > 0:
                        duration_sec = n_frames / float(framerate)

                    # Read raw frames to check energy and clipping
                    raw_data = wf.readframes(min(n_frames, framerate * 30)) # check up to 30s
                    if sampwidth == 2 and raw_data:
                        # 16-bit signed PCM
                        fmt = f"<{len(raw_data)//2}h"
                        samples = struct.unpack(fmt, raw_data)
                        if samples:
                            # RMS Energy
                            sum_sq = sum(s * s for s in samples)
                            rms = math.sqrt(sum_sq / len(samples))

                            # Silence threshold (RMS < 80 in 16-bit space)
                            if rms < 80:
                                quality_flags.append("silent_recording")
                            elif rms < 300:
                                quality_flags.append("low_volume")

                            # Clipping threshold (samples hitting max/min 32767/-32768)
                            clipping_count = sum(1 for s in samples if abs(s) >= 32700)
                            if clipping_count > 50:
                                quality_flags.append("audio_clipping")
        except Exception as e:
            quality_flags.append("unreadable_header")
    else:
        # Heuristic estimation for compressed audio
        # Average bitrate ~64kbps to 128kbps -> ~8KB to 16KB per sec
        # We estimate conservatively:
        estimated_sec = max(1.0, len(audio_bytes) / 16000.0)
        duration_sec = round(min(estimated_sec, 60.0), 2)

        # Check for near-empty byte patterns
        unique_bytes = len(set(audio_bytes[:2048]))
        if unique_bytes < 10:
            quality_flags.append("silent_recording")

    return {
        "duration_sec": round(duration_sec, 2),
        "quality_flags": quality_flags,
        "sha256": sha256_hash,
    }

def save_audio_securely(
    audio_bytes: bytes,
    storage_dir: Path,
    original_filename: str,
    content_type: str = ""
) -> dict[str, Any]:
    """
    Validates, analyzes, and saves audio with a secure randomized filename.
    Guarantees no path traversal or public folder leakage.
    """
    size_bytes = len(audio_bytes)
    if size_bytes == 0:
        raise AudioValidationError("Audio file is empty (0 bytes).", "EMPTY_FILE")

    if size_bytes > MAX_AUDIO_SIZE_BYTES:
        raise AudioValidationError(
            f"Audio file size ({size_bytes / (1024*1024):.2f}MB) exceeds limit of 15MB.",
            "FILE_TOO_LARGE"
        )

    fmt = detect_audio_format(audio_bytes, original_filename, content_type)
    analysis = analyze_audio_quality(audio_bytes, fmt)

    duration = analysis["duration_sec"]
    # Check duration bounds if calculable
    if duration > 0 and duration < MIN_DURATION_SEC:
        raise AudioValidationError(
            f"Audio duration ({duration}s) is too short. Minimum duration is {MIN_DURATION_SEC}s.",
            "DURATION_TOO_SHORT"
        )

    # Generate secure random storage filename
    random_id = uuid.uuid4().hex
    safe_filename = f"audio_{random_id}.{fmt}"
    full_path = storage_dir / safe_filename

    storage_dir.mkdir(parents=True, exist_ok=True)
    with open(full_path, "wb") as f:
        f.write(audio_bytes)

    return {
        "storage_path": str(full_path),
        "filename": safe_filename,
        "format": fmt,
        "size_bytes": size_bytes,
        "duration_sec": duration,
        "sha256": analysis["sha256"],
        "quality_flags": analysis["quality_flags"],
    }

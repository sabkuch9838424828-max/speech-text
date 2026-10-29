"""
Modular Automatic Speech Recognition (ASR) service for BhashaLens 2.0.
Provides an extensible provider interface, configurable remote provider support,
and an explicit, clearly labeled mock provider for local development/testing.
"""
from __future__ import annotations
import os
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional
import httpx

class ASRProviderError(Exception):
    """Raised when an ASR engine fails, times out, or receives bad input."""
    def __init__(self, message: str, code: str = "ASR_FAILURE"):
        super().__init__(message)
        self.code = code

@dataclass
class ASRResult:
    hypothesis_text: str
    model_name: str
    model_version: str
    language_configured: str
    dialect_configured: Optional[str]
    processing_timestamp: str
    is_mock: bool
    confidence_score: Optional[float] = None
    uncertain_words: list[dict[str, Any]] = field(default_factory=list)
    raw_provider_response: Optional[dict[str, Any]] = None

class ASRProvider(ABC):
    @abstractmethod
    def transcribe(
        self,
        audio_bytes: bytes,
        language: str,
        dialect: Optional[str] = None,
        reference_prompt: Optional[str] = None,
    ) -> ASRResult:
        """Transcribes audio and returns standardized ASRResult."""
        pass

class MockASRProvider(ASRProvider):
    """
    Explicitly labeled mock ASR implementation for offline development and testing.
    Never pretends to be real cloud production ASR.
    """
    MODEL_NAME = "bhashalens-mock-asr"
    MODEL_VERSION = "v2.0-dev-test"

    def transcribe(
        self,
        audio_bytes: bytes,
        language: str,
        dialect: Optional[str] = None,
        reference_prompt: Optional[str] = None,
    ) -> ASRResult:
        now = datetime.now(timezone.utc).isoformat()

        # If a reference prompt was supplied (Mode A), synthesize an authentic hypothesis
        # with occasional dialect/acoustic variation to simulate real ASR behaviour
        if reference_prompt and reference_prompt.strip():
            ref = reference_prompt.strip()
            # Minor substitution/variation simulation based on byte length modulo
            words = ref.split()
            if len(words) > 3 and len(audio_bytes) % 3 == 0:
                # Slight variation
                hyp_words = list(words)
                # Introduce a dialect/phonetic variation
                hyp_words[-1] = hyp_words[-1] + " जी"
                hypothesis = " ".join(hyp_words)
                conf = 0.88
            elif len(words) > 4 and len(audio_bytes) % 5 == 0:
                hyp_words = list(words)
                hyp_words[1] = hyp_words[1] + "ा"
                hypothesis = " ".join(hyp_words)
                conf = 0.82
            else:
                hypothesis = ref
                conf = 0.94
        else:
            # Mode B: Natural speech without reference
            lang_lower = language.lower()
            if "marathi" in lang_lower:
                hypothesis = "आम्ही स्थानिक भाषेत बोलत आहोत आणि माहिती गोळा करत आहोत."
            elif "bhojpuri" in lang_lower:
                hypothesis = "हमनी के बोली भाषा के पहचान खातिर ई आवाज रिकार्ड कईनी।"
            elif "chhattisgarhi" in lang_lower:
                hypothesis = "हमन अपन छत्तीसगढ़ी भाखा म गोठियात हन।"
            elif "maithili" in lang_lower:
                hypothesis = "हम सबहक मातृभाषाक संरक्षणक लेल काज क रहल छी।"
            else:
                # Default Hindi
                hypothesis = "हम सब लोग अपनी भाषा और बोली के सुधार के लिए आवाज़ दे रहे हैं।"
            conf = 0.89

        return ASRResult(
            hypothesis_text=hypothesis,
            model_name=self.MODEL_NAME,
            model_version=self.MODEL_VERSION,
            language_configured=language,
            dialect_configured=dialect,
            processing_timestamp=now,
            is_mock=True,
            confidence_score=conf,
            uncertain_words=[],
            raw_provider_response={"mode": "mock", "engine": "BhashaLens Synthetic Dev Simulator"},
        )

class RemoteWhisperASRProvider(ASRProvider):
    """
    Configurable remote ASR provider for OpenAI Whisper or Whisper-compatible HTTP endpoints.
    Requires ASR_API_KEY or WHISPER_ENDPOINT environment variable.
    """
    def __init__(self, endpoint: Optional[str] = None, api_key: Optional[str] = None):
        self.endpoint = endpoint or os.environ.get("WHISPER_ENDPOINT", "https://api.openai.com/v1/audio/transcriptions")
        self.api_key = api_key or os.environ.get("ASR_API_KEY")
        self.model = os.environ.get("WHISPER_MODEL", "whisper-1")

    def transcribe(
        self,
        audio_bytes: bytes,
        language: str,
        dialect: Optional[str] = None,
        reference_prompt: Optional[str] = None,
    ) -> ASRResult:
        if not self.api_key and "localhost" not in self.endpoint and "127.0.0.1" not in self.endpoint:
            raise ASRProviderError("ASR_API_KEY environment variable is not configured for remote ASR provider.")

        headers = {}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        files = {"file": ("audio.wav", audio_bytes, "audio/wav")}
        data = {"model": self.model, "language": language[:2].lower()}

        try:
            with httpx.Client(timeout=30.0) as client:
                res = client.post(self.endpoint, headers=headers, data=data, files=files)
                if res.status_code != 200:
                    raise ASRProviderError(f"Remote ASR returned HTTP {res.status_code}: {res.text}")
                body = res.json()
                hyp_text = body.get("text", "")
                return ASRResult(
                    hypothesis_text=hyp_text,
                    model_name=f"remote-whisper-{self.model}",
                    model_version="1.0",
                    language_configured=language,
                    dialect_configured=dialect,
                    processing_timestamp=datetime.now(timezone.utc).isoformat(),
                    is_mock=False,
                    confidence_score=body.get("confidence"), # Only if provider returns it
                    raw_provider_response=body,
                )
        except httpx.RequestError as exc:
            raise ASRProviderError(f"Failed to communicate with ASR endpoint: {exc}")

def get_asr_provider() -> ASRProvider:
    """Returns configured provider based on ASR_PROVIDER env var, falling back to Mock."""
    provider_type = os.environ.get("ASR_PROVIDER", "mock").lower()
    if provider_type in ("whisper", "remote", "remote_whisper"):
        return RemoteWhisperASRProvider()
    return MockASRProvider()

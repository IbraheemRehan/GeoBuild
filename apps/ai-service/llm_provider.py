"""
GeoBuild AI — LLM Provider
Abstraction over Gemini API with caching, retry, and fallback parsing.
"""

import hashlib
import json
import os
import re
from typing import Type, TypeVar

from dotenv import load_dotenv
from pydantic import BaseModel
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

load_dotenv()

T = TypeVar("T", bound=BaseModel)

# Primary and fallback model names
MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
FALLBACK_MODELS = ["gemini-3.7-flash", "gemini-3.8-flash", "gemini-3.1-flash-lite"]

# In-memory cache (will be backed by DB later)
_cache: dict[str, str] = {}


def _hash_prompt(system: str, user: str) -> str:
    """Create a deterministic hash for caching LLM responses."""
    content = f"{system}|||{user}"
    return hashlib.sha256(content.encode()).hexdigest()


class GeminiProvider:
    """LLM provider using Google Gemini with structured JSON output."""

    def __init__(self):
        api_key = (os.getenv("GEMINI_API_KEY") or "").strip()
        if not api_key or api_key == "your_gemini_api_key_here" or api_key.startswith("your_"):
            raise ValueError("GEMINI_API_KEY environment variable is not configured with a valid key")

        from google import genai
        self.client = genai.Client(api_key=api_key)

    def generate_json(
        self,
        system: str,
        user: str,
        schema: Type[T],
        use_cache: bool = True,
        temperature: float = 0.2,
    ) -> T:
        """
        Generate structured JSON from Gemini, validated against a Pydantic schema.
        """
        cache_key = _hash_prompt(system, user)

        # Check cache
        if use_cache and cache_key in _cache:
            return schema.model_validate_json(_cache[cache_key])

        from google.genai import types

        models_to_try = [MODEL] + [m for m in FALLBACK_MODELS if m != MODEL]
        last_error = None

        for model_name in models_to_try:
            try:
                response = self.client.models.generate_content(
                    model=model_name,
                    contents=user,
                    config=types.GenerateContentConfig(
                        system_instruction=system,
                        response_mime_type="application/json",
                        response_schema=schema,
                        temperature=temperature,
                    ),
                )
                raw_text = response.text
                result = schema.model_validate_json(raw_text)

                if use_cache:
                    _cache[cache_key] = result.model_dump_json()

                return result
            except Exception as e:
                last_error = e
                continue

        if last_error:
            raise last_error


class FallbackParser:
    """
    Rule-based fallback parser for when the LLM is unavailable.
    Handles common commands with regex patterns.
    """

    # Pattern → (field_path, transform_fn)
    PATTERNS = [
        (r"(\d+)\s*(?:bed(?:room)?s?|kamr(?:e|ay|a)?)", "rooms.bedrooms", lambda m: int(m.group(1))),
        (r"(\d+)\s*(?:bath(?:room)?s?|washroom(?:s)?|ghusal\s*khan(?:e|a)?)", "rooms.bathrooms", lambda m: int(m.group(1))),
        (r"(\d+)\s*(?:floor|stor(?:e?y|ies)|manzil(?:a)?)", "floors", lambda m: int(m.group(1))),
        (r"(\d+)\s*(?:car|parking)", "parking.cars", lambda m: int(m.group(1))),
        (r"covered\s+parking", "parking.cars", lambda m: 1),
        (r"car\s*porch|garage", "parking.cars", lambda m: 1),
        (r"add\s+(?:a\s+)?floor", "floors", lambda m: "increment"),
        (r"add\s+(?:a\s+)?(?:bed(?:room)?|kamr(?:e|ay|a)?)", "rooms.bedrooms", lambda m: "increment"),
        (r"rooftop\s+terrace|chhat", "rooftopTerrace", lambda m: True),
        (r"basement|tehkhana", "basement", lambda m: True),
        (r"modern", "facade.style", lambda m: "modern_minimal"),
        (r"contemporary\s*pakistani", "facade.style", lambda m: "contemporary_pakistani"),
        (r"classical", "facade.style", lambda m: "classical"),
        (r"mughal", "facade.style", lambda m: "mughal_inspired"),
        (r"industrial|brick\s*house|loft", "facade.style", lambda m: "industrial_brick"),
        (r"spanish|mediterranean", "facade.style", lambda m: "spanish_villa"),
        (r"commercial|plaza|office\s*building", "facade.style", lambda m: "commercial_plaza"),
        (r"jali|jaali", "facade.hasJali", lambda m: True),
        (r"balcon(?:y|ies)", "facade.hasBalcony", lambda m: True),
        (r"servant\s*quarter", "rooms.servantQuarter", lambda m: True),
        (r"drawing\s*room|baithak", "rooms.drawingRoom", lambda m: True),
    ]

    @classmethod
    def parse_to_patches(cls, command: str) -> list[dict]:
        """Parse a natural language command into patch operations."""
        command_lower = command.lower()
        patches = []

        for pattern, path, transform in cls.PATTERNS:
            match = re.search(pattern, command_lower)
            if match:
                value = transform(match)
                if value == "increment":
                    patches.append({"op": "increment", "path": path, "value": 1})
                else:
                    patches.append({"op": "replace", "path": path, "value": value})

        return patches

    @classmethod
    def can_handle(cls, command: str) -> bool:
        """Check if the fallback parser can handle this command."""
        return len(cls.parse_to_patches(command)) > 0

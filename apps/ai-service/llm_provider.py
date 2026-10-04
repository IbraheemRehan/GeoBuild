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

# Model name — update if Gemini renames it
MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

# In-memory cache (will be backed by DB later)
_cache: dict[str, str] = {}


def _hash_prompt(system: str, user: str) -> str:
    """Create a deterministic hash for caching LLM responses."""
    content = f"{system}|||{user}"
    return hashlib.sha256(content.encode()).hexdigest()


class GeminiProvider:
    """LLM provider using Google Gemini with structured JSON output."""

    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable is required")

        from google import genai
        self.client = genai.Client(api_key=api_key)

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=30),
        retry=retry_if_exception_type((Exception,)),
        reraise=True,
    )
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
        
        Args:
            system: System instruction / prompt context
            user: User's natural language input
            schema: Pydantic model class for structured output
            use_cache: Whether to use prompt-level caching
            temperature: LLM temperature (lower = more deterministic)
        
        Returns:
            Validated Pydantic model instance
        """
        cache_key = _hash_prompt(system, user)

        # Check cache
        if use_cache and cache_key in _cache:
            return schema.model_validate_json(_cache[cache_key])

        from google.genai import types

        response = self.client.models.generate_content(
            model=MODEL,
            contents=user,
            config=types.GenerateContentConfig(
                system_instruction=system,
                response_mime_type="application/json",
                response_schema=schema,
                temperature=temperature,
            ),
        )

        raw_text = response.text

        # Always re-validate — structured output can still violate ranges
        result = schema.model_validate_json(raw_text)

        # Cache the validated result
        if use_cache:
            _cache[cache_key] = result.model_dump_json()

        return result


class FallbackParser:
    """
    Rule-based fallback parser for when the LLM is unavailable.
    Handles common commands with regex patterns.
    """

    # Pattern → (field_path, transform_fn)
    PATTERNS = [
        (r"(\d+)\s*(?:bed(?:room)?s?)", "rooms.bedrooms", lambda m: int(m.group(1))),
        (r"(\d+)\s*(?:bath(?:room)?s?)", "rooms.bathrooms", lambda m: int(m.group(1))),
        (r"(\d+)\s*(?:floor|stor(?:e?y|ies))", "floors", lambda m: int(m.group(1))),
        (r"(\d+)\s*(?:car|parking)", "parking.cars", lambda m: int(m.group(1))),
        (r"add\s+(?:a\s+)?floor", "floors", lambda m: "increment"),
        (r"add\s+(?:a\s+)?(?:bed(?:room)?)", "rooms.bedrooms", lambda m: "increment"),
        (r"rooftop\s+terrace", "rooftopTerrace", lambda m: True),
        (r"basement", "basement", lambda m: True),
        (r"modern", "facade.style", lambda m: "modern_minimal"),
        (r"contemporary\s*pakistani", "facade.style", lambda m: "contemporary_pakistani"),
        (r"classical", "facade.style", lambda m: "classical"),
        (r"mughal", "facade.style", lambda m: "mughal_inspired"),
        (r"jali|jaali", "facade.hasJali", lambda m: True),
        (r"balcon(?:y|ies)", "facade.hasBalcony", lambda m: True),
        (r"servant\s*quarter", "rooms.servantQuarter", lambda m: True),
        (r"drawing\s*room", "rooms.drawingRoom", lambda m: True),
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

"""
GeoBuild AI — Interpret Router
Converts natural-language building descriptions into BuildingSpec JSON.
"""

import logging
from fastapi import APIRouter, HTTPException
from models import InterpretRequest, InterpretResponse, BuildingSpec
from llm_provider import GeminiProvider, FallbackParser
from prompts import INTERPRET_SYSTEM

logger = logging.getLogger(__name__)
router = APIRouter()

_provider: GeminiProvider | None = None


def get_provider() -> GeminiProvider:
    """Lazy-init the Gemini provider."""
    global _provider
    if _provider is None:
        try:
            _provider = GeminiProvider()
        except ValueError as e:
            logger.warning(f"Gemini not available: {e}")
            raise HTTPException(503, "LLM service not configured")
    return _provider


@router.post("/interpret", response_model=InterpretResponse)
async def interpret_prompt(request: InterpretRequest):
    """
    Interpret a natural-language building description and return a BuildingSpec.
    
    Uses Gemini for AI interpretation with regex fallback if unavailable.
    """
    user_prompt = request.prompt
    if request.plot_area_sqm:
        user_prompt += f"\nPlot area: {request.plot_area_sqm:.1f} sqm ({request.plot_area_sqm / 25.2929:.1f} marla)"
    user_prompt += f"\nCity: {request.city}"

    try:
        provider = get_provider()
        result = provider.generate_json(
            system=INTERPRET_SYSTEM,
            user=user_prompt,
            schema=InterpretResponse,
        )
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Gemini failed, trying fallback parser: {e}")

        # Attempt fallback parsing
        if FallbackParser.can_handle(request.prompt):
            patches = FallbackParser.parse_to_patches(request.prompt)
            spec = BuildingSpec()  # Start from defaults
            for patch in patches:
                _apply_patch(spec, patch["path"], patch["value"], patch.get("op", "replace"))

            return InterpretResponse(
                spec=spec,
                assumptions=[
                    "Used fallback parser (AI was unavailable)",
                    "Applied defaults for unspecified fields",
                ],
                confidence=0.6,
            )

        raise HTTPException(
            503,
            detail="AI service temporarily unavailable and fallback parser could not handle this prompt.",
        )


def _apply_patch(spec: BuildingSpec, path: str, value, op: str = "replace"):
    """Apply a single patch to a BuildingSpec (supports dot-notation paths)."""
    parts = path.split(".")
    obj = spec

    for part in parts[:-1]:
        obj = getattr(obj, part)

    field = parts[-1]
    if op == "increment":
        current = getattr(obj, field)
        setattr(obj, field, current + value)
    elif op == "toggle":
        current = getattr(obj, field)
        setattr(obj, field, not current)
    else:
        setattr(obj, field, value)

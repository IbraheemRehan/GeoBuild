"""
GeoBuild AI — Patch Router
Modifies an existing BuildingSpec based on natural-language commands.
"""

import copy
import logging
from fastapi import APIRouter, HTTPException
from models import PatchRequest, PatchResponse, PatchOperation, BuildingSpec
from llm_provider import GeminiProvider, FallbackParser
from prompts import PATCH_SYSTEM

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


@router.post("/patch", response_model=PatchResponse)
async def patch_spec(request: PatchRequest):
    """
    Modify a BuildingSpec based on a natural-language command.
    
    Returns the list of operations applied and the updated spec.
    """
    user_prompt = f"Current spec:\n{request.current_spec.model_dump_json(indent=2)}\n\nCommand: {request.command}"

    try:
        provider = get_provider()
        result = provider.generate_json(
            system=PATCH_SYSTEM,
            user=user_prompt,
            schema=PatchResponse,
        )

        # Re-apply operations to validate the updated spec
        updated = copy.deepcopy(request.current_spec)
        for op in result.operations:
            _apply_patch(updated, op)

        result.updated_spec = updated
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Gemini failed, trying fallback: {e}")

        if FallbackParser.can_handle(request.command):
            patches = FallbackParser.parse_to_patches(request.command)
            updated = copy.deepcopy(request.current_spec)
            operations = []

            for patch in patches:
                op = PatchOperation(
                    op=patch["op"],
                    path=patch["path"],
                    value=patch["value"],
                )
                _apply_patch(updated, op)
                operations.append(op)

            return PatchResponse(
                operations=operations,
                updated_spec=updated,
                explanation="Applied via fallback parser (AI was unavailable).",
                assumptions=["Used regex-based parsing instead of AI"],
            )

        raise HTTPException(
            503,
            detail="AI service temporarily unavailable and fallback could not handle this command.",
        )


def _apply_patch(spec: BuildingSpec, operation: PatchOperation):
    """Apply a single PatchOperation to a BuildingSpec."""
    parts = operation.path.split(".")
    obj = spec

    for part in parts[:-1]:
        obj = getattr(obj, part)

    field = parts[-1]

    if operation.op == "increment":
        current = getattr(obj, field)
        setattr(obj, field, current + (operation.value or 1))
    elif operation.op == "toggle":
        current = getattr(obj, field)
        setattr(obj, field, not current)
    else:
        setattr(obj, field, operation.value)

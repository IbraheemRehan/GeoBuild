"""
GeoBuild AI — Analyze Router
Development feasibility analysis: coverage, FAR, cost estimates, compliance checks.
"""

import json
import os
from fastapi import APIRouter
from pydantic import BaseModel, Field
from models import BuildingSpec, AnalysisResult, CostEstimate, ComplianceIssue

router = APIRouter()

# Load cost rates
COST_RATES_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "..", "data", "rules", "cost_rates_pk.json"
)
REGULATIONS_DIR = os.path.join(
    os.path.dirname(__file__), "..", "..", "..", "data", "rules"
)


def _load_cost_rates() -> dict:
    """Load construction cost rates from JSON."""
    try:
        with open(COST_RATES_PATH, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return {"per_sqft_rates": {"total": {"economy": 3700, "standard": 5300, "premium": 7500}}}


def _load_regulations(city: str) -> dict | None:
    """Load building regulations for a city."""
    path = os.path.join(REGULATIONS_DIR, f"{city}_regulations.json")
    try:
        with open(path, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return None


class AnalyzeRequest(BaseModel):
    """Request for development analysis."""
    spec: BuildingSpec
    plot_area_sqm: float = Field(..., ge=50, le=10000)
    city: str = Field("lahore", pattern=r"^(lahore|islamabad|karachi)$")
    cost_tier: str = Field("standard", pattern=r"^(economy|standard|premium)$")


# 1 marla ≈ 25.2929 m²
MARLA_TO_SQM = 25.2929
SQM_TO_SQFT = 10.7639


@router.post("/analyze", response_model=AnalysisResult)
async def analyze_development(request: AnalyzeRequest):
    """
    Perform development feasibility analysis.
    
    Computes coverage ratio, FAR, cost estimate, and checks against
    local building regulations if available.
    """
    spec = request.spec
    plot_sqm = request.plot_area_sqm
    plot_marla = plot_sqm / MARLA_TO_SQM

    # Estimate building footprint (simplified — will use actual geometry later)
    # Assume 65% ground coverage as baseline
    footprint_sqm = plot_sqm * 0.65
    coverage_pct = round((footprint_sqm / plot_sqm) * 100, 1)

    # Total covered area
    floor_count = spec.floors + (1 if spec.basement else 0)
    total_covered_sqm = footprint_sqm * floor_count
    far_ratio = round(total_covered_sqm / plot_sqm, 2)

    # Height
    total_height_m = spec.floors * spec.floorHeightM
    if spec.rooftopTerrace:
        total_height_m += 1.2  # Parapet

    # Cost estimate
    cost_rates = _load_cost_rates()
    rates = cost_rates.get("per_sqft_rates", {}).get("total", {})
    rate_per_sqft = rates.get(request.cost_tier, 5300)
    total_sqft = total_covered_sqm * SQM_TO_SQFT

    cost_estimate = CostEstimate(
        grey_structure=int(total_sqft * cost_rates.get("per_sqft_rates", {}).get("grey_structure", {}).get(request.cost_tier, 2800)),
        finishing=int(total_sqft * cost_rates.get("per_sqft_rates", {}).get("finishing", {}).get(request.cost_tier, 2500)),
        total=int(total_sqft * rate_per_sqft),
        tier=request.cost_tier,
        rate_per_sqft=rate_per_sqft,
        total_sqft=total_sqft,
    )

    # Compliance checks
    issues = []
    regs = _load_regulations(request.city)
    if regs:
        # Find the matching zone based on plot size
        zone = _find_zone(regs, plot_marla)
        if zone:
            if coverage_pct > zone.get("max_coverage_pct", 100):
                issues.append(ComplianceIssue(
                    rule="Maximum ground coverage",
                    expected=f"≤ {zone['max_coverage_pct']}%",
                    actual=f"{coverage_pct:.1f}%",
                    severity="error",
                ))
            if far_ratio > zone.get("max_far", 10):
                issues.append(ComplianceIssue(
                    rule="Maximum FAR (Floor Area Ratio)",
                    expected=f"≤ {zone['max_far']}",
                    actual=f"{far_ratio:.2f}",
                    severity="error",
                ))
            if spec.floors > zone.get("max_floors", 10):
                issues.append(ComplianceIssue(
                    rule="Maximum number of floors",
                    expected=f"≤ {zone['max_floors']}",
                    actual=str(spec.floors),
                    severity="error",
                ))
            if total_height_m > zone.get("max_height_m", 100):
                issues.append(ComplianceIssue(
                    rule="Maximum building height",
                    expected=f"≤ {zone['max_height_m']} m",
                    actual=f"{total_height_m:.1f} m",
                    severity="error",
                ))
            min_parking = zone.get("min_parking_cars", 0)
            if spec.parking.cars < min_parking:
                issues.append(ComplianceIssue(
                    rule="Minimum parking spaces",
                    expected=f"≥ {min_parking}",
                    actual=str(spec.parking.cars),
                    severity="warning",
                ))

    return AnalysisResult(
        plot_area_sqm=plot_sqm,
        plot_area_marla=plot_marla,
        building_footprint_sqm=footprint_sqm,
        coverage_pct=coverage_pct,
        far_ratio=far_ratio,
        total_covered_area_sqm=total_covered_sqm,
        total_height_m=total_height_m,
        parking_spaces=spec.parking.cars,
        estimated_cost_pkr=cost_estimate,
        compliance_issues=issues,
    )


def _find_zone(regs: dict, plot_marla: float) -> dict | None:
    """Find the closest matching regulation zone for a plot size."""
    zones = regs.get("zones", {})
    best_zone = None
    best_diff = float("inf")

    for zone_name, zone_data in zones.items():
        zone_marla = zone_data.get("plot_size_marla", 0)
        diff = abs(zone_marla - plot_marla)
        if diff < best_diff:
            best_diff = diff
            best_zone = zone_data

    return best_zone

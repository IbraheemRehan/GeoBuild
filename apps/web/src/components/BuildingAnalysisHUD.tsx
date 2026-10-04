"use client";

import React, { useState } from "react";

interface BuildingAnalysisHUDProps {
  spec: any;
  generate: any;
  analysis: any;
  onFocusBuilding: () => void;
  onToggleOrbit: () => void;
  onToggleShadows: () => void;
  isOrbiting: boolean;
  onClose?: () => void;
  isSidebarOpen?: boolean;
}

export default function BuildingAnalysisHUD({
  spec,
  generate,
  analysis,
  onFocusBuilding,
  onToggleOrbit,
  onToggleShadows,
  isOrbiting,
  onClose,
  isSidebarOpen = true,
}: BuildingAnalysisHUDProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "costs" | "compliance">("overview");
  const [isMinimized, setIsMinimized] = useState(false);

  if (!generate) return null;

  const cost = analysis?.estimated_cost_pkr;
  const coveragePct = analysis?.coverage_pct ?? Math.round((Number(generate.building_footprint_sqm) / (Number(generate.plot_area_sqm) || 126)) * 100);
  const farRatio = analysis?.far_ratio ?? ((Number(generate.building_footprint_sqm) * (spec?.floors || 2)) / (Number(generate.plot_area_sqm) || 126));
  const heightM = Number(analysis?.total_height_m || generate.total_height_m || 7.0);
  const parkingSpaces = analysis?.parking_spaces ?? (spec?.parking?.cars || 1);
  const issues = analysis?.compliance_issues || [];

  const formatPKR = (num?: number) => {
    if (!num) return "—";
    if (num >= 10000000) return `Rs ${(num / 10000000).toFixed(2)} Crore`;
    if (num >= 100000) return `Rs ${(num / 100000).toFixed(2)} Lakh`;
    return `Rs ${num.toLocaleString()}`;
  };

  // Minimized state: sleek floating badge
  if (isMinimized) {
    return (
      <div className={`building-analysis-hud minimized ${isSidebarOpen ? "sidebar-open" : ""}`}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "1.1rem" }}>🏗️</span>
            <span style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--color-text-primary)" }}>
              {spec?.floors || 2}-Storey • {generate.plot_area_marla ? Number(generate.plot_area_marla).toFixed(1) : 5} Marla
            </span>
            <span style={{ color: "#fbbf24", fontWeight: 700, fontSize: "0.8rem", marginLeft: "4px" }}>
              {formatPKR(cost?.total || 7500000)}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button
              onClick={onFocusBuilding}
              className="plot-action-btn"
              style={{ padding: "3px 8px", fontSize: "0.72rem" }}
              title="Focus 3D Building"
            >
              🎥 Focus
            </button>
            <button
              onClick={() => setIsMinimized(false)}
              className="plot-action-btn"
              style={{ padding: "3px 8px", fontSize: "0.72rem", background: "var(--color-surface)", borderColor: "var(--color-surface-border)" }}
              title="Expand Full BIM Analysis"
            >
              ▲ Expand
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="plot-clear-btn"
                style={{ padding: "3px 6px", fontSize: "0.72rem" }}
                title="Close"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`building-analysis-hud ${isSidebarOpen ? "sidebar-open" : ""}`}>
      {/* Header bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
          borderBottom: "1px solid var(--color-surface-border)",
          paddingBottom: "8px",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "1.2rem" }}>🏗️</span>
          <div>
            <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, letterSpacing: "-0.01em", color: "var(--color-text-primary)" }}>
              {spec?.floors || 2}-Storey Building • {generate.plot_area_marla ? Number(generate.plot_area_marla).toFixed(1) : 5} Marla
            </h3>
            <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--color-text-secondary)" }}>
              {Number(generate.building_footprint_sqm).toFixed(1)} m² footprint • {heightM.toFixed(1)}m total height
            </p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div style={{ display: "flex", gap: "4px", background: "var(--color-surface-hover)", padding: "3px", borderRadius: "8px", border: "1px solid var(--color-surface-border)" }}>
          {(["overview", "costs", "compliance"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: activeTab === tab ? "var(--color-text-primary)" : "transparent",
                color: activeTab === tab ? "var(--color-bg-primary)" : "var(--color-text-secondary)",
                border: "none",
                borderRadius: "6px",
                padding: "4px 10px",
                fontSize: "0.72rem",
                fontWeight: 700,
                textTransform: "capitalize",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {tab === "overview" ? "Overview" : tab === "costs" ? "Cost Breakdown" : "LDA/CDA Compliance"}
            </button>
          ))}
        </div>

        {/* Action Controls */}
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <button
            onClick={onFocusBuilding}
            title="Focus camera on 3D building"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-surface-border)",
              color: "var(--color-text-primary)",
              borderRadius: "7px",
              padding: "4px 9px",
              fontSize: "0.72rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            🎥 Focus
          </button>

          <button
            onClick={onToggleOrbit}
            title="Toggle 360 cinematic orbit"
            style={{
              background: isOrbiting ? "#10b981" : "var(--color-surface)",
              border: `1px solid ${isOrbiting ? "#10b981" : "var(--color-surface-border)"}`,
              color: "white",
              borderRadius: "7px",
              padding: "4px 9px",
              fontSize: "0.72rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            🔄 {isOrbiting ? "Orbiting..." : "360° Orbit"}
          </button>

          <button
            onClick={onToggleShadows}
            title="Toggle sun shadows"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-surface-border)",
              color: "#fbbf24",
              borderRadius: "7px",
              padding: "4px 8px",
              fontSize: "0.72rem",
              cursor: "pointer",
            }}
          >
            ☀️
          </button>

          <button
            onClick={() => setIsMinimized(true)}
            title="Minimize HUD"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-surface-border)",
              color: "var(--color-text-secondary)",
              borderRadius: "7px",
              padding: "4px 8px",
              fontSize: "0.72rem",
              cursor: "pointer",
            }}
          >
            —
          </button>

          {onClose && (
            <button
              onClick={onClose}
              title="Close panel"
              style={{
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#f87171",
                borderRadius: "7px",
                padding: "4px 8px",
                fontSize: "0.72rem",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "8px" }}>
          <div style={{ background: "var(--color-surface)", padding: "8px 12px", borderRadius: "10px", border: "1px solid var(--color-surface-border)" }}>
            <span style={{ fontSize: "0.68rem", color: "var(--color-text-secondary)", textTransform: "uppercase", fontWeight: 700 }}>Ground Coverage</span>
            <div style={{ fontSize: "1.05rem", fontWeight: 800, color: coveragePct <= 80 ? "#34d399" : "#f87171" }}>
              {coveragePct}%
              <span style={{ fontSize: "0.68rem", color: "var(--color-text-muted)", fontWeight: 400, marginLeft: "4px" }}>
                (Max 80%)
              </span>
            </div>
          </div>

          <div style={{ background: "var(--color-surface)", padding: "8px 12px", borderRadius: "10px", border: "1px solid var(--color-surface-border)" }}>
            <span style={{ fontSize: "0.68rem", color: "var(--color-text-secondary)", textTransform: "uppercase", fontWeight: 700 }}>FAR Ratio</span>
            <div style={{ fontSize: "1.05rem", fontWeight: 800, color: Number(farRatio) <= 1.6 ? "var(--color-text-primary)" : "#f87171" }}>
              {Number(farRatio).toFixed(2)}
              <span style={{ fontSize: "0.68rem", color: "var(--color-text-muted)", fontWeight: 400, marginLeft: "4px" }}>
                (Max 1.6)
              </span>
            </div>
          </div>

          <div style={{ background: "var(--color-surface)", padding: "8px 12px", borderRadius: "10px", border: "1px solid var(--color-surface-border)" }}>
            <span style={{ fontSize: "0.68rem", color: "var(--color-text-secondary)", textTransform: "uppercase", fontWeight: 700 }}>Total Height</span>
            <div style={{ fontSize: "1.05rem", fontWeight: 800, color: heightM <= 12 ? "var(--color-text-primary)" : "#f87171" }}>
              {heightM.toFixed(1)}m
              <span style={{ fontSize: "0.68rem", color: "var(--color-text-muted)", fontWeight: 400, marginLeft: "4px" }}>
                ({spec?.floors || 2} Floors)
              </span>
            </div>
          </div>

          <div style={{ background: "var(--color-surface)", padding: "8px 12px", borderRadius: "10px", border: "1px solid var(--color-surface-border)" }}>
            <span style={{ fontSize: "0.68rem", color: "var(--color-text-secondary)", textTransform: "uppercase", fontWeight: 700 }}>Est. Total Cost</span>
            <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#fbbf24" }}>
              {formatPKR(cost?.total || 7500000)}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Costs */}
      {activeTab === "costs" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "8px" }}>
          <div style={{ background: "var(--color-surface)", padding: "8px 12px", borderRadius: "10px", border: "1px solid var(--color-surface-border)" }}>
            <span style={{ fontSize: "0.68rem", color: "var(--color-text-secondary)", textTransform: "uppercase", fontWeight: 700 }}>Grey Structure (Civil)</span>
            <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--color-text-primary)" }}>
              {formatPKR(cost?.grey_structure || ((cost?.total || 7500000) * 0.55))}
            </div>
            <span style={{ fontSize: "0.66rem", color: "var(--color-text-muted)" }}>Structure, brickwork, plumbing rough-in</span>
          </div>

          <div style={{ background: "var(--color-surface)", padding: "8px 12px", borderRadius: "10px", border: "1px solid var(--color-surface-border)" }}>
            <span style={{ fontSize: "0.68rem", color: "var(--color-text-secondary)", textTransform: "uppercase", fontWeight: 700 }}>Finishing Works</span>
            <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--color-text-primary)" }}>
              {formatPKR(cost?.finishing || ((cost?.total || 7500000) * 0.45))}
            </div>
            <span style={{ fontSize: "0.66rem", color: "var(--color-text-muted)" }}>Tiles, woodwork, fixtures, paint</span>
          </div>

          <div style={{ background: "var(--color-surface)", padding: "8px 12px", borderRadius: "10px", border: "1px solid rgba(245, 158, 11, 0.3)" }}>
            <span style={{ fontSize: "0.68rem", color: "#fbbf24", textTransform: "uppercase", fontWeight: 700 }}>Total Estimated (PKR)</span>
            <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#fbbf24" }}>
              {formatPKR(cost?.total || 7500000)}
            </div>
            <span style={{ fontSize: "0.66rem", color: "var(--color-text-secondary)" }}>
              @ Rs {cost?.rate_per_sqft || 5300}/sq ft ({cost?.total_sqft ? Math.round(cost.total_sqft) : "~2000"} sq ft)
            </span>
          </div>
        </div>
      )}

      {/* Tab 3: Compliance */}
      {activeTab === "compliance" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", fontWeight: 700 }}>Regulation Checks:</span>
            <span style={{ background: coveragePct <= 80 ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)", color: coveragePct <= 80 ? "#34d399" : "#f87171", padding: "2px 8px", borderRadius: "4px", fontSize: "0.72rem", fontWeight: 600 }}>
              {coveragePct <= 80 ? `✓ Ground Coverage (${coveragePct}%)` : `✕ Coverage Exceeded (${coveragePct}%)`}
            </span>
            <span style={{ background: heightM <= 12 ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)", color: heightM <= 12 ? "#34d399" : "#f87171", padding: "2px 8px", borderRadius: "4px", fontSize: "0.72rem", fontWeight: 600 }}>
              {heightM <= 12 ? `✓ Height (${heightM.toFixed(1)}m)` : `✕ Height Exceeded (${heightM.toFixed(1)}m)`}
            </span>
            <span style={{ background: Number(farRatio) <= 1.6 ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)", color: Number(farRatio) <= 1.6 ? "#34d399" : "#f87171", padding: "2px 8px", borderRadius: "4px", fontSize: "0.72rem", fontWeight: 600 }}>
              {Number(farRatio) <= 1.6 ? `✓ FAR (${Number(farRatio).toFixed(2)})` : `✕ FAR Exceeded (${Number(farRatio).toFixed(2)})`}
            </span>
            <span style={{ background: "rgba(16, 185, 129, 0.15)", color: "#34d399", padding: "2px 8px", borderRadius: "4px", fontSize: "0.72rem", fontWeight: 600 }}>
              ✓ Parking ({parkingSpaces} Car{parkingSpaces > 1 ? "s" : ""})
            </span>
          </div>
          {issues.length > 0 && (
            <div style={{ marginTop: "4px", fontSize: "0.72rem", color: "#f87171" }}>
              ⚠️ {issues.map((i: any) => i.rule || i.description || i.message || i).join(" • ")}
            </div>
          )}
          <div style={{ fontSize: "0.65rem", color: "var(--color-text-muted)", marginTop: "2px" }}>
            ⚖️ Disclaimer: Preliminary check — not legal or regulatory approval. Verify with local development authority before construction.
          </div>
        </div>
      )}
    </div>
  );
}

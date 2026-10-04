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
}: BuildingAnalysisHUDProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "costs" | "compliance">("overview");

  if (!generate) return null;

  const cost = analysis?.estimated_cost_pkr;
  const coveragePct = analysis?.coverage_pct ?? Math.round((generate.building_footprint_sqm / (generate.plot_area_sqm || 126)) * 100);
  const farRatio = analysis?.far_ratio ?? ((generate.building_footprint_sqm * (spec?.floors || 2)) / (generate.plot_area_sqm || 126));
  const heightM = analysis?.total_height_m || generate.total_height_m || 7.0;
  const parkingSpaces = analysis?.parking_spaces ?? (spec?.parking?.cars || 1);
  const issues = analysis?.compliance_issues || [];

  const formatPKR = (num?: number) => {
    if (!num) return "—";
    if (num >= 10000000) return `Rs ${(num / 10000000).toFixed(2)} Crore`;
    if (num >= 100000) return `Rs ${(num / 100000).toFixed(2)} Lakh`;
    return `Rs ${num.toLocaleString()}`;
  };

  return (
    <div
      style={{
        position: "absolute",
        bottom: "24px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "92%",
        maxWidth: "840px",
        background: "rgba(15, 23, 42, 0.92)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        borderRadius: "18px",
        padding: "16px 20px",
        zIndex: 250,
        boxShadow: "0 20px 50px rgba(0, 0, 0, 0.65), 0 0 30px rgba(99, 102, 241, 0.2)",
        color: "#f8fafc",
        animation: "slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          paddingBottom: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "1.2rem" }}>🏗️</span>
          <div>
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, letterSpacing: "-0.01em" }}>
              {spec?.floors || 2}-Storey Building • {generate.plot_area_marla || 5} Marla
            </h3>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "#94a3b8" }}>
              {generate.building_footprint_sqm} m² footprint • {heightM}m total height
            </p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div style={{ display: "flex", gap: "6px", background: "rgba(30, 41, 59, 0.7)", padding: "3px", borderRadius: "8px" }}>
          {(["overview", "costs", "compliance"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: activeTab === tab ? "#6366f1" : "transparent",
                color: activeTab === tab ? "#ffffff" : "#94a3b8",
                border: "none",
                borderRadius: "6px",
                padding: "4px 12px",
                fontSize: "0.75rem",
                fontWeight: 600,
                textTransform: "capitalize",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Action Controls */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            onClick={onFocusBuilding}
            title="Focus camera on 3D building"
            style={{
              background: "rgba(59, 130, 246, 0.2)",
              border: "1px solid rgba(59, 130, 246, 0.4)",
              color: "#60a5fa",
              borderRadius: "8px",
              padding: "5px 10px",
              fontSize: "0.75rem",
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
              background: isOrbiting ? "#10b981" : "rgba(30, 41, 59, 0.8)",
              border: `1px solid ${isOrbiting ? "#10b981" : "rgba(255, 255, 255, 0.1)"}`,
              color: "white",
              borderRadius: "8px",
              padding: "5px 10px",
              fontSize: "0.75rem",
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
              background: "rgba(30, 41, 59, 0.8)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "white",
              borderRadius: "8px",
              padding: "5px 10px",
              fontSize: "0.75rem",
              cursor: "pointer",
            }}
          >
            ☀️
          </button>

          {onClose && (
            <button
              onClick={onClose}
              title="Close panel"
              style={{
                background: "transparent",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                fontSize: "1rem",
                padding: "2px 6px",
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Content based on tab */}
      {activeTab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
          <div style={{ background: "rgba(30, 41, 59, 0.5)", padding: "8px 12px", borderRadius: "10px", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
            <span style={{ fontSize: "0.7rem", color: "#94a3b8", textTransform: "uppercase" }}>Ground Coverage</span>
            <div style={{ fontSize: "1.05rem", fontWeight: 700, color: coveragePct <= 80 ? "#34d399" : "#f87171" }}>
              {coveragePct}%
              <span style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 400, marginLeft: "4px" }}>
                (Max 80%)
              </span>
            </div>
          </div>

          <div style={{ background: "rgba(30, 41, 59, 0.5)", padding: "8px 12px", borderRadius: "10px", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
            <span style={{ fontSize: "0.7rem", color: "#94a3b8", textTransform: "uppercase" }}>FAR Ratio</span>
            <div style={{ fontSize: "1.05rem", fontWeight: 700, color: Number(farRatio) <= 1.6 ? "#38bdf8" : "#f87171" }}>
              {Number(farRatio).toFixed(2)}
              <span style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 400, marginLeft: "4px" }}>
                (Max 1.6)
              </span>
            </div>
          </div>

          <div style={{ background: "rgba(30, 41, 59, 0.5)", padding: "8px 12px", borderRadius: "10px", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
            <span style={{ fontSize: "0.7rem", color: "#94a3b8", textTransform: "uppercase" }}>Total Height</span>
            <div style={{ fontSize: "1.05rem", fontWeight: 700, color: heightM <= 12 ? "#a78bfa" : "#f87171" }}>
              {heightM}m
              <span style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 400, marginLeft: "4px" }}>
                ({spec?.floors || 2} Floors)
              </span>
            </div>
          </div>

          <div style={{ background: "rgba(30, 41, 59, 0.5)", padding: "8px 12px", borderRadius: "10px", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
            <span style={{ fontSize: "0.7rem", color: "#94a3b8", textTransform: "uppercase" }}>Est. Total Cost</span>
            <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#fbbf24" }}>
              {formatPKR(cost?.total || 7500000)}
            </div>
          </div>
        </div>
      )}

      {activeTab === "costs" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
          <div style={{ background: "rgba(30, 41, 59, 0.5)", padding: "8px 12px", borderRadius: "10px" }}>
            <span style={{ fontSize: "0.7rem", color: "#94a3b8", textTransform: "uppercase" }}>Grey Structure (Civil)</span>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#cbd5e1" }}>
              {formatPKR(cost?.grey_structure || ((cost?.total || 7500000) * 0.55))}
            </div>
            <span style={{ fontSize: "0.7rem", color: "#64748b" }}>Structure, brickwork, plumbing rough-in</span>
          </div>

          <div style={{ background: "rgba(30, 41, 59, 0.5)", padding: "8px 12px", borderRadius: "10px" }}>
            <span style={{ fontSize: "0.7rem", color: "#94a3b8", textTransform: "uppercase" }}>Finishing Works</span>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#cbd5e1" }}>
              {formatPKR(cost?.finishing || ((cost?.total || 7500000) * 0.45))}
            </div>
            <span style={{ fontSize: "0.7rem", color: "#64748b" }}>Tiles, woodwork, fixtures, paint</span>
          </div>

          <div style={{ background: "rgba(30, 41, 59, 0.5)", padding: "8px 12px", borderRadius: "10px", border: "1px solid rgba(245, 158, 11, 0.3)" }}>
            <span style={{ fontSize: "0.7rem", color: "#fbbf24", textTransform: "uppercase" }}>Total Estimated (PKR)</span>
            <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#fbbf24" }}>
              {formatPKR(cost?.total || 7500000)}
            </div>
            <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>@ Rs {cost?.rate_per_sqft || 5300}/sq ft ({cost?.total_sqft ? Math.round(cost.total_sqft) : "~2000"} sq ft)</span>
          </div>
        </div>
      )}

      {activeTab === "compliance" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Regulation Checks:</span>
            <span style={{ background: coveragePct <= 80 ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)", color: coveragePct <= 80 ? "#34d399" : "#f87171", padding: "2px 8px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 600 }}>
              {coveragePct <= 80 ? `✓ Ground Coverage (${coveragePct}%)` : `✕ Coverage Exceeded (${coveragePct}%)`}
            </span>
            <span style={{ background: heightM <= 12 ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)", color: heightM <= 12 ? "#34d399" : "#f87171", padding: "2px 8px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 600 }}>
              {heightM <= 12 ? `✓ Height (${heightM}m)` : `✕ Height Exceeded (${heightM}m)`}
            </span>
            <span style={{ background: Number(farRatio) <= 1.6 ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)", color: Number(farRatio) <= 1.6 ? "#34d399" : "#f87171", padding: "2px 8px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 600 }}>
              {Number(farRatio) <= 1.6 ? `✓ FAR (${Number(farRatio).toFixed(2)})` : `✕ FAR Exceeded (${Number(farRatio).toFixed(2)})`}
            </span>
            <span style={{ background: "rgba(16, 185, 129, 0.15)", color: "#34d399", padding: "2px 8px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 600 }}>
              ✓ Parking ({parkingSpaces} Car{parkingSpaces > 1 ? "s" : ""})
            </span>
          </div>
          {issues.length > 0 && (
            <div style={{ marginTop: "4px", fontSize: "0.75rem", color: "#f87171" }}>
              ⚠️ {issues.map((i: any) => i.rule || i.description || i.message || i).join(" • ")}
            </div>
          )}
          <div style={{ fontSize: "0.68rem", color: "#64748b", marginTop: "2px" }}>
            ⚖️ Disclaimer: Preliminary check — not legal or regulatory approval. Verify with local development authority before construction.
          </div>
        </div>
      )}
    </div>
  );
}

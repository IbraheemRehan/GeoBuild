"use client";

import React from "react";

export type PlotPresetKey = "5marla" | "10marla" | "1kanal" | "2kanal";

interface PlotSelectorProps {
  selectedPreset: PlotPresetKey | "custom" | null;
  onSelectPreset: (preset: PlotPresetKey) => void;
  onStartDrawing: () => void;
  onClearPlot: () => void;
  isDrawing: boolean;
  hasPlot: boolean;
  plotMarla?: number | null;
}

const PRESETS: { key: PlotPresetKey; label: string; desc: string }[] = [
  { key: "5marla", label: "5 Marla", desc: "25×45 ft (105 m²)" },
  { key: "10marla", label: "10 Marla", desc: "35×65 ft (211 m²)" },
  { key: "1kanal", label: "1 Kanal", desc: "50×90 ft (418 m²)" },
  { key: "2kanal", label: "2 Kanal", desc: "75×120 ft (836 m²)" },
];

export default function PlotSelector({
  selectedPreset,
  onSelectPreset,
  onStartDrawing,
  onClearPlot,
  isDrawing,
  hasPlot,
  plotMarla,
}: PlotSelectorProps) {
  return (
    <div
      style={{
        background: "rgba(17, 24, 39, 0.8)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "14px",
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "1rem" }}>📐</span>
          <span style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#cbd5e1" }}>
            Plot Boundary
          </span>
          {hasPlot && (
            <span
              style={{
                background: "rgba(56, 189, 248, 0.2)",
                color: "#38bdf8",
                border: "1px solid rgba(56, 189, 248, 0.4)",
                padding: "1px 6px",
                borderRadius: "4px",
                fontSize: "0.7rem",
                fontWeight: 600,
              }}
            >
              {plotMarla ? `${plotMarla.toFixed(1)} Marla` : "Selected"}
            </span>
          )}
        </div>

        {hasPlot && (
          <button
            onClick={onClearPlot}
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              fontSize: "0.75rem",
              textDecoration: "underline",
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Preset Plot Buttons */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "6px" }}>
        {PRESETS.map((p) => {
          const isSelected = selectedPreset === p.key;
          return (
            <button
              key={p.key}
              onClick={() => onSelectPreset(p.key)}
              style={{
                background: isSelected ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(30, 41, 59, 0.7)",
                border: `1px solid ${isSelected ? "#818cf8" : "rgba(255, 255, 255, 0.08)"}`,
                borderRadius: "8px",
                padding: "6px 8px",
                color: isSelected ? "#ffffff" : "#cbd5e1",
                cursor: "pointer",
                textAlign: "left",
                display: "flex",
                flexDirection: "column",
                transition: "all 0.15s ease",
              }}
            >
              <span style={{ fontSize: "0.8rem", fontWeight: 700 }}>{p.label}</span>
              <span style={{ fontSize: "0.65rem", color: isSelected ? "rgba(255, 255, 255, 0.8)" : "#64748b" }}>
                {p.desc}
              </span>
            </button>
          );
        })}
      </div>

      {/* Draw custom button */}
      <button
        onClick={onStartDrawing}
        style={{
          width: "100%",
          background: isDrawing ? "#f59e0b" : "rgba(30, 41, 59, 0.9)",
          border: `1px solid ${isDrawing ? "#fbbf24" : "rgba(255, 255, 255, 0.12)"}`,
          borderRadius: "8px",
          padding: "7px 12px",
          color: isDrawing ? "#000000" : "#f1f5f9",
          fontWeight: 600,
          fontSize: "0.8rem",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
          transition: "all 0.15s ease",
        }}
      >
        <span>✏️</span>
        <span>{isDrawing ? "Click on map to draw points..." : "Draw Custom Plot on Map"}</span>
      </button>
    </div>
  );
}

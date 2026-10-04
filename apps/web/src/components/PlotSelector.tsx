"use client";

import React from "react";
import type { MapStyleKey } from "./CesiumGlobe";

export type PlotPresetKey = "5marla" | "10marla" | "1kanal" | "2kanal";

interface PlotSelectorProps {
  selectedPreset: PlotPresetKey | "custom" | null;
  onSelectPreset: (preset: PlotPresetKey) => void;
  onStartDrawing: () => void;
  onStartPlacement: () => void;
  onClearPlot: () => void;
  isDrawing: boolean;
  isPlacing: boolean;
  hasPlot: boolean;
  plotMarla?: number | null;
  mapStyle: MapStyleKey;
  onSelectMapStyle: (style: MapStyleKey) => void;
  cameraMode: "2d" | "3d";
  onToggleCameraMode: (mode: "2d" | "3d") => void;
  plotRotation: number;
  onRotatePlot: (deg: number) => void;
}

const PRESETS: { key: PlotPresetKey; label: string; desc: string; dims: string }[] = [
  { key: "5marla", label: "5 Marla", desc: "105 m²", dims: "25×45 ft (7.6×13.7m)" },
  { key: "10marla", label: "10 Marla", desc: "211 m²", dims: "35×65 ft (10.7×19.8m)" },
  { key: "1kanal", label: "1 Kanal", desc: "418 m²", dims: "50×90 ft (15.2×27.4m)" },
  { key: "2kanal", label: "2 Kanal", desc: "836 m²", dims: "75×120 ft (22.8×36.5m)" },
];

export default function PlotSelector({
  selectedPreset,
  onSelectPreset,
  onStartDrawing,
  onStartPlacement,
  onClearPlot,
  isDrawing,
  isPlacing,
  hasPlot,
  plotMarla,
  mapStyle,
  onSelectMapStyle,
  cameraMode,
  onToggleCameraMode,
  plotRotation,
  onRotatePlot,
}: PlotSelectorProps) {
  const currentPresetData = PRESETS.find((p) => p.key === selectedPreset);

  return (
    <div
      style={{
        background: "rgba(17, 24, 39, 0.85)",
        backdropFilter: "blur(16px)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: "14px",
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      {/* Map Clarity & View Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#94a3b8" }}>
          Map Clarity & View
        </span>

        {/* 2D / 3D Toggle */}
        <div style={{ display: "flex", background: "rgba(30, 41, 59, 0.7)", borderRadius: "6px", padding: "2px" }}>
          <button
            onClick={() => onToggleCameraMode("2d")}
            style={{
              background: cameraMode === "2d" ? "#38bdf8" : "transparent",
              color: cameraMode === "2d" ? "#0f172a" : "#94a3b8",
              border: "none",
              borderRadius: "4px",
              padding: "2px 8px",
              fontSize: "0.7rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
            title="Top-Down 2D CAD Plan View"
          >
            📐 2D Lock
          </button>
          <button
            onClick={() => onToggleCameraMode("3d")}
            style={{
              background: cameraMode === "3d" ? "#6366f1" : "transparent",
              color: cameraMode === "3d" ? "#ffffff" : "#94a3b8",
              border: "none",
              borderRadius: "4px",
              padding: "2px 8px",
              fontSize: "0.7rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
            title="3D Perspective View"
          >
            🌐 3D
          </button>
        </div>
      </div>

      {/* Map Style Pills */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "4px" }}>
        {(
          [
            { id: "google_satellite", label: "HD Sat", icon: "🛰️" },
            { id: "streets", label: "Streets", icon: "🗺️" },
            { id: "blueprint", label: "Blueprint", icon: "📐" },
            { id: "studio", label: "Studio", icon: "🏛️" },
          ] as const
        ).map((m) => {
          const active = mapStyle === m.id;
          return (
            <button
              key={m.id}
              onClick={() => onSelectMapStyle(m.id)}
              style={{
                background: active ? "rgba(99, 102, 241, 0.25)" : "rgba(30, 41, 59, 0.6)",
                border: `1px solid ${active ? "#818cf8" : "rgba(255, 255, 255, 0.06)"}`,
                borderRadius: "6px",
                padding: "4px 2px",
                color: active ? "#ffffff" : "#94a3b8",
                fontSize: "0.68rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "2px",
                transition: "all 0.15s ease",
              }}
            >
              <span>{m.icon}</span>
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>

      <div style={{ height: "1px", background: "rgba(255, 255, 255, 0.06)" }} />

      {/* Plot Boundary Header */}
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
              {plotMarla ? `${plotMarla.toFixed(1)} Marla` : "Active"}
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 700 }}>{p.label}</span>
                <span style={{ fontSize: "0.65rem", color: isSelected ? "#e0e7ff" : "#64748b" }}>{p.desc}</span>
              </div>
              <span style={{ fontSize: "0.65rem", color: isSelected ? "rgba(255, 255, 255, 0.85)" : "#94a3b8" }}>
                {p.dims}
              </span>
            </button>
          );
        })}
      </div>

      {/* Actions: Click to Place or Draw */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
        <button
          onClick={onStartPlacement}
          style={{
            background: isPlacing ? "#0284c7" : "rgba(30, 41, 59, 0.9)",
            border: `1px solid ${isPlacing ? "#38bdf8" : "rgba(255, 255, 255, 0.12)"}`,
            borderRadius: "8px",
            padding: "7px 8px",
            color: isPlacing ? "#ffffff" : "#f1f5f9",
            fontWeight: 600,
            fontSize: "0.75rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "5px",
          }}
          title="Click anywhere on the map to place this plot"
        >
          <span>📍</span>
          <span>{isPlacing ? "Click map..." : "Place on Map"}</span>
        </button>

        <button
          onClick={onStartDrawing}
          style={{
            background: isDrawing ? "#f59e0b" : "rgba(30, 41, 59, 0.9)",
            border: `1px solid ${isDrawing ? "#fbbf24" : "rgba(255, 255, 255, 0.12)"}`,
            borderRadius: "8px",
            padding: "7px 8px",
            color: isDrawing ? "#000000" : "#f1f5f9",
            fontWeight: 600,
            fontSize: "0.75rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "5px",
          }}
          title="Click multiple points to draw custom polygon boundary"
        >
          <span>✏️</span>
          <span>{isDrawing ? "Drawing..." : "Draw Custom"}</span>
        </button>
      </div>

      {/* Plot Alignment / Rotation Controls when plot exists */}
      {hasPlot && (
        <div
          style={{
            background: "rgba(15, 23, 42, 0.6)",
            border: "1px solid rgba(255, 255, 255, 0.05)",
            borderRadius: "8px",
            padding: "8px 10px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 600 }}>
              Street Alignment (Rotate)
            </span>
            <span style={{ fontSize: "0.7rem", color: "#38bdf8", fontWeight: 700 }}>
              {Math.round(plotRotation)}°
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              onClick={() => onRotatePlot((plotRotation - 15 + 360) % 360)}
              style={{
                background: "rgba(30, 41, 59, 0.8)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "#cbd5e1",
                borderRadius: "4px",
                padding: "2px 6px",
                fontSize: "0.7rem",
                cursor: "pointer",
              }}
              title="Rotate counter-clockwise 15°"
            >
              ↺ -15°
            </button>

            <input
              type="range"
              min="0"
              max="360"
              value={plotRotation}
              onChange={(e) => onRotatePlot(Number(e.target.value))}
              style={{
                flex: 1,
                accentColor: "#6366f1",
                cursor: "pointer",
                height: "4px",
              }}
            />

            <button
              onClick={() => onRotatePlot((plotRotation + 15) % 360)}
              style={{
                background: "rgba(30, 41, 59, 0.8)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "#cbd5e1",
                borderRadius: "4px",
                padding: "2px 6px",
                fontSize: "0.7rem",
                cursor: "pointer",
              }}
              title="Rotate clockwise 15°"
            >
              ↻ +15°
            </button>
          </div>

          {currentPresetData && (
            <div style={{ fontSize: "0.68rem", color: "#64748b", marginTop: "2px" }}>
              📐 Dimensions: {currentPresetData.dims}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


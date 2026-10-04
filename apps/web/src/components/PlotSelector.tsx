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
        <div style={{ display: "flex", background: "var(--color-surface)", border: "1px solid var(--color-surface-border)", borderRadius: "6px", padding: "2px" }}>
          <button
            onClick={() => onToggleCameraMode("2d")}
            style={{
              background: cameraMode === "2d" ? "var(--color-text-primary)" : "transparent",
              color: cameraMode === "2d" ? "var(--color-bg-primary)" : "var(--color-text-secondary)",
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
              background: cameraMode === "3d" ? "var(--color-text-primary)" : "transparent",
              color: cameraMode === "3d" ? "var(--color-bg-primary)" : "var(--color-text-secondary)",
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "4px" }}>
        {(
          [
            { id: "esri_hd", label: "Esri HD", icon: "🛰️" },
            { id: "google_satellite", label: "Google", icon: "🌍" },
            { id: "streets", label: "Streets", icon: "🗺️" },
            { id: "blueprint", label: "CAD", icon: "📐" },
            { id: "studio", label: "Studio", icon: "🏛️" },
          ] as const
        ).map((m) => {
          const active = mapStyle === m.id;
          return (
            <button
              key={m.id}
              onClick={() => onSelectMapStyle(m.id)}
              style={{
                background: active ? "var(--color-text-primary)" : "var(--color-surface)",
                border: `1px solid ${active ? "var(--color-text-primary)" : "var(--color-surface-border)"}`,
                borderRadius: "6px",
                padding: "4px 2px",
                color: active ? "var(--color-bg-primary)" : "var(--color-text-secondary)",
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

      <div style={{ height: "1px", background: "var(--color-surface-border)" }} />

      {/* Plot Boundary Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "1rem" }}>📐</span>
          <span style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-primary)" }}>
            Plot Boundary
          </span>
          {hasPlot && (
            <span
              style={{
                background: "var(--color-surface-hover)",
                color: "var(--color-text-primary)",
                border: "1px solid var(--color-surface-border)",
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
              color: "var(--color-text-muted)",
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
                background: isSelected ? "var(--color-text-primary)" : "var(--color-surface)",
                border: `1px solid ${isSelected ? "var(--color-text-primary)" : "var(--color-surface-border)"}`,
                borderRadius: "8px",
                padding: "6px 8px",
                color: isSelected ? "var(--color-bg-primary)" : "var(--color-text-primary)",
                cursor: "pointer",
                textAlign: "left",
                display: "flex",
                flexDirection: "column",
                transition: "all 0.15s ease",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 700 }}>{p.label}</span>
                <span style={{ fontSize: "0.65rem", opacity: 0.8 }}>{p.desc}</span>
              </div>
              <span style={{ fontSize: "0.65rem", opacity: 0.75 }}>
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
            background: isPlacing ? "var(--color-text-primary)" : "var(--color-surface)",
            border: `1px solid ${isPlacing ? "var(--color-text-primary)" : "var(--color-surface-border)"}`,
            borderRadius: "8px",
            padding: "7px 8px",
            color: isPlacing ? "var(--color-bg-primary)" : "var(--color-text-primary)",
            fontWeight: 600,
            fontSize: "0.75rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "5px",
            transition: "all 0.15s ease",
          }}
          title="Click anywhere on the map to place this plot"
        >
          <span>📍</span>
          <span>{isPlacing ? "Click map..." : "Place on Map"}</span>
        </button>

        <button
          onClick={onStartDrawing}
          style={{
            background: isDrawing ? "#f59e0b" : "var(--color-surface)",
            border: `1px solid ${isDrawing ? "#fbbf24" : "var(--color-surface-border)"}`,
            borderRadius: "8px",
            padding: "7px 8px",
            color: isDrawing ? "#000000" : "var(--color-text-primary)",
            fontWeight: 600,
            fontSize: "0.75rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "5px",
            transition: "all 0.15s ease",
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
            background: "var(--color-surface)",
            border: "1px solid var(--color-surface-border)",
            borderRadius: "8px",
            padding: "8px 10px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.7rem", color: "var(--color-text-secondary)", fontWeight: 600 }}>
              Street Alignment (Rotate)
            </span>
            <span style={{ fontSize: "0.7rem", color: "var(--color-text-primary)", fontWeight: 700 }}>
              {Math.round(plotRotation)}°
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              onClick={() => onRotatePlot((plotRotation - 15 + 360) % 360)}
              style={{
                background: "var(--color-surface-hover)",
                border: "1px solid var(--color-surface-border)",
                color: "var(--color-text-primary)",
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
                accentColor: "var(--color-text-primary)",
                cursor: "pointer",
                height: "4px",
              }}
            />

            <button
              onClick={() => onRotatePlot((plotRotation + 15) % 360)}
              style={{
                background: "var(--color-surface-hover)",
                border: "1px solid var(--color-surface-border)",
                color: "var(--color-text-primary)",
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
            <div style={{ fontSize: "0.68rem", color: "var(--color-text-muted)", marginTop: "2px" }}>
              📐 Dimensions: {currentPresetData.dims}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


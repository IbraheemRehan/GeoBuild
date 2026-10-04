"use client";

import React, { useState } from "react";
import type { MapStyleKey, CesiumGlobeRef } from "./CesiumGlobe";

export interface Neighborhood {
  name: string;
  lng: number;
  lat: number;
  height: number;
}

interface MapControlsProps {
  globeRef: React.RefObject<CesiumGlobeRef | null>;
  cameraMode: "2d" | "3d";
  onToggleCameraMode: (mode: "2d" | "3d") => void;
  mapStyle: MapStyleKey;
  onSelectMapStyle: (style: MapStyleKey) => void;
  isOrbiting: boolean;
  onToggleOrbit: () => void;
  hasBuilding: boolean;
  hasPlot: boolean;
  neighborhoods: Neighborhood[];
  currentCityName: string;
  onSelectNeighborhood: (n: Neighborhood) => void;
}

export default function MapControls({
  globeRef,
  cameraMode,
  onToggleCameraMode,
  mapStyle,
  onSelectMapStyle,
  isOrbiting,
  onToggleOrbit,
  hasBuilding,
  hasPlot,
  neighborhoods,
  currentCityName,
  onSelectNeighborhood,
}: MapControlsProps) {
  const [showLocations, setShowLocations] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  return (
    <>
      {/* Top Floating Control Bar: Neighborhoods & Map Styles */}
      <div
        style={{
          position: "absolute",
          top: "16px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 300,
          display: "flex",
          alignItems: "center",
          gap: "8px",
          maxWidth: "calc(100vw - 450px)",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {/* Neighborhood Quick Selector Dropdown / Pills */}
        <div
          style={{
            position: "relative",
            display: "inline-block",
          }}
        >
          <button
            onClick={() => setShowLocations(!showLocations)}
            style={{
              background: "rgba(15, 23, 42, 0.88)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(56, 189, 248, 0.35)",
              color: "#f8fafc",
              padding: "7px 14px",
              borderRadius: "10px",
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            }}
          >
            <span>📍</span>
            <span>{currentCityName} Sectors</span>
            <span style={{ fontSize: "0.7rem", opacity: 0.7 }}>{showLocations ? "▲" : "▼"}</span>
          </button>

          {showLocations && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: "0",
                marginTop: "6px",
                background: "rgba(15, 23, 42, 0.95)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: "12px",
                padding: "8px",
                minWidth: "220px",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
                zIndex: 400,
              }}
            >
              <div
                style={{
                  fontSize: "0.68rem",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  color: "#94a3b8",
                  padding: "4px 8px",
                  letterSpacing: "0.06em",
                }}
              >
                Jump to Pakistani Sector
              </div>
              {neighborhoods.map((n) => (
                <button
                  key={n.name}
                  onClick={() => {
                    onSelectNeighborhood(n);
                    setShowLocations(false);
                  }}
                  style={{
                    background: "rgba(30, 41, 59, 0.6)",
                    border: "1px solid rgba(255, 255, 255, 0.05)",
                    borderRadius: "8px",
                    padding: "7px 10px",
                    color: "#f1f5f9",
                    fontSize: "0.78rem",
                    fontWeight: 500,
                    textAlign: "left",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(99, 102, 241, 0.3)";
                    e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.5)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(30, 41, 59, 0.6)";
                    e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.05)";
                  }}
                >
                  <span>{n.name}</span>
                  <span style={{ fontSize: "0.68rem", color: "#38bdf8" }}>Fly ↗</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Map Imagery Style Switcher Pills */}
        <div
          style={{
            display: "flex",
            background: "rgba(15, 23, 42, 0.88)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: "10px",
            padding: "3px",
            gap: "2px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          }}
        >
          <button
            onClick={() => onSelectMapStyle("google_satellite")}
            style={{
              background: mapStyle === "google_satellite" ? "linear-gradient(135deg, #0284c7, #2563eb)" : "transparent",
              color: mapStyle === "google_satellite" ? "#ffffff" : "#94a3b8",
              border: "none",
              borderRadius: "7px",
              padding: "5px 10px",
              fontSize: "0.75rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
            title="Crystal Clear HD Google Hybrid Satellite"
          >
            <span>🛰️</span> HD Satellite
          </button>
          <button
            onClick={() => onSelectMapStyle("streets")}
            style={{
              background: mapStyle === "streets" ? "linear-gradient(135deg, #0284c7, #2563eb)" : "transparent",
              color: mapStyle === "streets" ? "#ffffff" : "#94a3b8",
              border: "none",
              borderRadius: "7px",
              padding: "5px 10px",
              fontSize: "0.75rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
            title="OpenStreetMap Streets & Road Layouts"
          >
            <span>🗺️</span> Streets
          </button>
          <button
            onClick={() => onSelectMapStyle("studio")}
            style={{
              background: mapStyle === "studio" ? "linear-gradient(135deg, #6366f1, #a855f7)" : "transparent",
              color: mapStyle === "studio" ? "#ffffff" : "#94a3b8",
              border: "none",
              borderRadius: "7px",
              padding: "5px 10px",
              fontSize: "0.75rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
            title="Architectural Studio Grid (Isolated 3D Building Inspection)"
          >
            <span>🏛️</span> Studio 3D
          </button>
        </div>
      </div>

      {/* Right Side Navigation Dock (GIS Camera Controls) */}
      <div
        style={{
          position: "absolute",
          top: "80px",
          right: "16px",
          zIndex: 300,
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          alignItems: "center",
        }}
      >
        {/* Navigation Cluster Panel */}
        <div
          style={{
            background: "rgba(15, 23, 42, 0.9)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: "14px",
            padding: "6px",
            display: "flex",
            flexDirection: "column",
            gap: "5px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          }}
        >
          {/* Compass / Reset North */}
          <button
            onClick={() => globeRef.current?.resetNorth()}
            className="nav-hud-btn"
            title="Reset to True North (Orientation)"
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "8px",
              background: "rgba(30, 41, 59, 0.7)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#38bdf8",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.1rem",
              transition: "all 0.15s ease",
            }}
          >
            🧭
          </button>

          <div style={{ height: "1px", background: "rgba(255, 255, 255, 0.1)", margin: "2px 0" }} />

          {/* Zoom In */}
          <button
            onClick={() => globeRef.current?.zoomIn()}
            className="nav-hud-btn"
            title="Zoom In"
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "8px",
              background: "rgba(30, 41, 59, 0.7)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#f1f5f9",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.2rem",
              fontWeight: 700,
            }}
          >
            ＋
          </button>

          {/* Zoom Out */}
          <button
            onClick={() => globeRef.current?.zoomOut()}
            className="nav-hud-btn"
            title="Zoom Out"
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "8px",
              background: "rgba(30, 41, 59, 0.7)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#f1f5f9",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.2rem",
              fontWeight: 700,
            }}
          >
            －
          </button>

          <div style={{ height: "1px", background: "rgba(255, 255, 255, 0.1)", margin: "2px 0" }} />

          {/* 2D / 3D Switch */}
          <button
            onClick={() => onToggleCameraMode(cameraMode === "2d" ? "3d" : "2d")}
            className="nav-hud-btn"
            title={cameraMode === "2d" ? "Switch to 3D Perspective" : "Switch to 2D Top-Down CAD View"}
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "8px",
              background: cameraMode === "2d" ? "rgba(56, 189, 248, 0.3)" : "rgba(30, 41, 59, 0.7)",
              border: cameraMode === "2d" ? "1px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.1)",
              color: cameraMode === "2d" ? "#38bdf8" : "#f1f5f9",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.75rem",
              fontWeight: 700,
            }}
          >
            {cameraMode === "2d" ? "2D" : "3D"}
          </button>

          {/* Tilt Up */}
          <button
            onClick={() => globeRef.current?.tiltCamera(15)}
            className="nav-hud-btn"
            title="Tilt Camera Up"
            style={{
              width: "38px",
              height: "34px",
              borderRadius: "8px",
              background: "rgba(30, 41, 59, 0.7)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#f1f5f9",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.85rem",
            }}
          >
            ▲
          </button>

          {/* Tilt Down */}
          <button
            onClick={() => globeRef.current?.tiltCamera(-15)}
            className="nav-hud-btn"
            title="Tilt Camera Down"
            style={{
              width: "38px",
              height: "34px",
              borderRadius: "8px",
              background: "rgba(30, 41, 59, 0.7)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#f1f5f9",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.85rem",
            }}
          >
            ▼
          </button>

          <div style={{ height: "1px", background: "rgba(255, 255, 255, 0.1)", margin: "2px 0" }} />

          {/* Rotate Left */}
          <button
            onClick={() => globeRef.current?.rotateCamera(-25)}
            className="nav-hud-btn"
            title="Rotate Left 25°"
            style={{
              width: "38px",
              height: "34px",
              borderRadius: "8px",
              background: "rgba(30, 41, 59, 0.7)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#f1f5f9",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1rem",
            }}
          >
            ↺
          </button>

          {/* Rotate Right */}
          <button
            onClick={() => globeRef.current?.rotateCamera(25)}
            className="nav-hud-btn"
            title="Rotate Right 25°"
            style={{
              width: "38px",
              height: "34px",
              borderRadius: "8px",
              background: "rgba(30, 41, 59, 0.7)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#f1f5f9",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1rem",
            }}
          >
            ↻
          </button>

          {(hasBuilding || hasPlot) && (
            <>
              <div style={{ height: "1px", background: "rgba(255, 255, 255, 0.1)", margin: "2px 0" }} />
              {/* Focus Target */}
              <button
                onClick={() => {
                  if (hasBuilding) {
                    globeRef.current?.flyToBuilding();
                  } else {
                    onToggleCameraMode(cameraMode);
                  }
                }}
                className="nav-hud-btn"
                title="Focus on Building / Plot"
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "8px",
                  background: "rgba(16, 185, 129, 0.2)",
                  border: "1px solid rgba(16, 185, 129, 0.4)",
                  color: "#10b981",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.1rem",
                }}
              >
                🎯
              </button>
            </>
          )}

          {/* 360 Orbit */}
          {hasBuilding && (
            <button
              onClick={onToggleOrbit}
              className="nav-hud-btn"
              title="360° Cinematic Orbit"
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "8px",
                background: isOrbiting ? "rgba(245, 158, 11, 0.3)" : "rgba(30, 41, 59, 0.7)",
                border: isOrbiting ? "1px solid #f59e0b" : "1px solid rgba(255, 255, 255, 0.1)",
                color: isOrbiting ? "#f59e0b" : "#f1f5f9",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1rem",
              }}
            >
              🔄
            </button>
          )}

          {/* Shadows */}
          <button
            onClick={() => globeRef.current?.toggleShadows()}
            className="nav-hud-btn"
            title="Toggle Sun Shadows"
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "8px",
              background: "rgba(30, 41, 59, 0.7)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#fbbf24",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1rem",
            }}
          >
            ☀️
          </button>
        </div>

        {/* Quick Help Guide Button */}
        <button
          onClick={() => setShowHelp(!showHelp)}
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            background: "rgba(15, 23, 42, 0.8)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            color: "#94a3b8",
            fontSize: "0.8rem",
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title="Mouse Navigation Guide"
        >
          ?
        </button>
      </div>

      {/* Floating Mouse Navigation Helper Tooltip / Bar */}
      {showHelp && (
        <div
          style={{
            position: "absolute",
            bottom: "24px",
            right: "70px",
            zIndex: 350,
            background: "rgba(15, 23, 42, 0.95)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(56, 189, 248, 0.3)",
            borderRadius: "12px",
            padding: "12px 16px",
            maxWidth: "320px",
            boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
            fontSize: "0.78rem",
            color: "#e2e8f0",
            lineHeight: 1.5,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontWeight: 700, color: "#38bdf8" }}>🗺️ 3D Map Controls Guide</span>
            <button
              onClick={() => setShowHelp(false)}
              style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "0.9rem" }}
            >
              ✕
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div>🖱️ <strong>Left Click + Drag:</strong> Pan / Move around the city</div>
            <div>🖱️ <strong>Right Click + Drag:</strong> Smooth Zoom In & Out</div>
            <div>🔄 <strong>Scroll Wheel:</strong> Zoom in & out</div>
            <div>🖱️ <strong>Middle Click + Drag:</strong> 3D Tilt angle & 360° Rotate</div>
            <div>⌨️ <strong>Ctrl + Left Click:</strong> Tilt & Rotate camera</div>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import React, { useState } from "react";
import type { CesiumGlobeRef } from "./CesiumGlobe";

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
  isOrbiting: boolean;
  onToggleOrbit: () => void;
  hasBuilding: boolean;
  hasPlot: boolean;
  showMarkings?: boolean;
  onToggleMarkings?: () => void;
}

export default function MapControls({
  globeRef,
  cameraMode,
  onToggleCameraMode,
  isOrbiting,
  onToggleOrbit,
  hasBuilding,
  hasPlot,
  showMarkings = true,
  onToggleMarkings,
}: MapControlsProps) {
  const [showHelp, setShowHelp] = useState(false);
  const [shadowsEnabled, setShadowsEnabled] = useState(true);

  const handleToggleShadows = () => {
    const newState = globeRef.current?.toggleShadows();
    if (newState !== undefined) {
      setShadowsEnabled(newState);
    }
  };

  return (
    <>
      {/* Sleek Floating Bottom-Right GIS Camera Dock */}
      <div className="gis-nav-dock">
        {/* Navigation Tools Cluster */}
        <div className="gis-cluster-card">
          {/* Compass / Reset North */}
          <button
            onClick={() => globeRef.current?.resetNorth()}
            className="gis-dock-btn compass"
            title="Reset view orientation to True North (N)"
          >
            🧭
          </button>

          <div className="gis-dock-separator" />

          {/* Zoom In */}
          <button
            onClick={() => globeRef.current?.zoomIn()}
            className="gis-dock-btn"
            title="Zoom In (+)"
          >
            ＋
          </button>

          {/* Zoom Out */}
          <button
            onClick={() => globeRef.current?.zoomOut()}
            className="gis-dock-btn"
            title="Zoom Out (-)"
          >
            －
          </button>

          <div className="gis-dock-separator" />

          {/* 2D / 3D Switch */}
          <button
            onClick={() => onToggleCameraMode(cameraMode === "2d" ? "3d" : "2d")}
            className={`gis-dock-btn mode ${cameraMode === "2d" ? "active-2d" : ""}`}
            title={cameraMode === "2d" ? "Switch to 3D Perspective" : "Switch to 2D Top-Down CAD View"}
          >
            {cameraMode === "2d" ? "2D" : "3D"}
          </button>

          {/* Tilt Up */}
          <button
            onClick={() => globeRef.current?.tiltCamera(15)}
            className="gis-dock-btn arrow"
            title="Tilt Camera Up"
          >
            ▲
          </button>

          {/* Tilt Down */}
          <button
            onClick={() => globeRef.current?.tiltCamera(-15)}
            className="gis-dock-btn arrow"
            title="Tilt Camera Down"
          >
            ▼
          </button>

          <div className="gis-dock-separator" />

          {/* Rotate Camera Left */}
          <button
            onClick={() => globeRef.current?.rotateCamera(-25)}
            className="gis-dock-btn"
            title="Rotate View Left 25°"
          >
            ↺
          </button>

          {/* Rotate Camera Right */}
          <button
            onClick={() => globeRef.current?.rotateCamera(25)}
            className="gis-dock-btn"
            title="Rotate View Right 25°"
          >
            ↻
          </button>

          {(hasBuilding || hasPlot) && (
            <>
              <div className="gis-dock-separator" />

              {/* Focus Building / Target */}
              <button
                onClick={() => {
                  if (hasBuilding) {
                    globeRef.current?.flyToBuilding();
                  } else {
                    onToggleCameraMode(cameraMode);
                  }
                }}
                className="gis-dock-btn focus"
                title={hasBuilding ? "Focus camera on 3D Building" : "Center view on plot"}
              >
                🎯
              </button>
            </>
          )}

          <div className="gis-dock-separator" />

          {/* 360 Orbit Mode */}
          <button
            onClick={onToggleOrbit}
            className={`gis-dock-btn orbit ${isOrbiting ? "active-orbit" : ""}`}
            title={isOrbiting ? "Stop Cinematic Orbit" : "Start 360° Cinematic Orbit"}
          >
            🔄
          </button>

          {/* Sun Shadows Toggle */}
          <button
            onClick={handleToggleShadows}
            className={`gis-dock-btn shadow ${shadowsEnabled ? "active-shadow" : ""}`}
            title={shadowsEnabled ? "Sun Shadows Enabled" : "Sun Shadows Disabled"}
          >
            ☀️
          </button>

          {/* Markings / Clean View Toggle */}
          {onToggleMarkings && (
            <button
              onClick={onToggleMarkings}
              className={`gis-dock-btn markings ${showMarkings ? "active-markings" : ""}`}
              title={
                showMarkings
                  ? "Clean View (Hide plot boundary markings & dimension numbers)"
                  : "Show Plot Markings & Edge Dimension Numbers"
              }
            >
              {showMarkings ? "📏" : "📐"}
            </button>
          )}

          <div className="gis-dock-separator" />

          {/* Help / Shortcut Modal Trigger */}
          <button
            onClick={() => setShowHelp(true)}
            className="gis-dock-btn help"
            title="Navigation Shortcuts & Guide"
          >
            ?
          </button>
        </div>
      </div>

      {/* Navigation Help Modal */}
      {showHelp && (
        <div className="modal-backdrop" onClick={() => setShowHelp(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <span className="modal-icon">🎮</span>
                <h3>3D Geospatial Navigation Controls</h3>
              </div>
              <button onClick={() => setShowHelp(false)} className="modal-close-btn">
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="shortcuts-grid">
                <div className="shortcut-row">
                  <div className="shortcut-badge">Left Click + Drag</div>
                  <div className="shortcut-desc">Pan / Move across satellite terrain</div>
                </div>
                <div className="shortcut-row">
                  <div className="shortcut-badge">Right Click + Drag</div>
                  <div className="shortcut-desc">Tilt angle & Zoom smoothly</div>
                </div>
                <div className="shortcut-row">
                  <div className="shortcut-badge">Middle Click / Scroll</div>
                  <div className="shortcut-desc">Zoom in / out at cursor location</div>
                </div>
                <div className="shortcut-row">
                  <div className="shortcut-badge">Ctrl + Left Click Drag</div>
                  <div className="shortcut-desc">Rotate & orbit around center target</div>
                </div>
                <div className="shortcut-row">
                  <div className="shortcut-badge">2D / 3D Switch</div>
                  <div className="shortcut-desc">Toggle between top-down CAD and 3D angle</div>
                </div>
                <div className="shortcut-row">
                  <div className="shortcut-badge">Markings / Clean View</div>
                  <div className="shortcut-desc">Toggle dimension numbers, corner pins & plot boundary</div>
                </div>
              </div>

              <div className="help-tip-box">
                💡 <strong>Tip:</strong> Click <strong>&quot;Place on Map&quot;</strong> in the top toolbar to drop a preset Pakistani plot (5 Marla, 10 Marla, 1 Kanal, 2 Kanal) anywhere in Lahore, Islamabad, or Karachi!
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import React, { useState, useRef, useEffect } from "react";
import type { MapStyleKey } from "./CesiumGlobe";
import type { PlotPresetKey } from "./PlotSelector";
import type { Neighborhood } from "./MapControls";

export interface CityOption {
  key: string;
  label: string;
  lng: number;
  lat: number;
}

interface TopNavBarProps {
  cities: Record<string, { label: string; lng: number; lat: number }>;
  selectedCity: string;
  onSelectCity: (cityKey: string) => void;
  neighborhoods: Neighborhood[];
  onSelectNeighborhood: (n: Neighborhood) => void;
  selectedPreset: PlotPresetKey | "custom" | null;
  onSelectPreset: (preset: PlotPresetKey) => void;
  isPlacing: boolean;
  onStartPlacement: () => void;
  isDrawing: boolean;
  onStartDrawing: () => void;
  hasPlot: boolean;
  plotRotation: number;
  onRotatePlot: (deg: number) => void;
  onClearPlot: () => void;
  plotMarla?: number | null;
  mapStyle: MapStyleKey;
  onSelectMapStyle: (style: MapStyleKey) => void;
  cameraMode: "2d" | "3d";
  onToggleCameraMode: (mode: "2d" | "3d") => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  hasBuilding: boolean;
}

const PRESET_BUTTONS: { key: PlotPresetKey; label: string; dim: string }[] = [
  { key: "5marla", label: "5 Marla", dim: "25×45'" },
  { key: "10marla", label: "10 Marla", dim: "35×65'" },
  { key: "1kanal", label: "1 Kanal", dim: "50×90'" },
  { key: "2kanal", label: "2 Kanal", dim: "75×120'" },
];

export default function TopNavBar({
  cities,
  selectedCity,
  onSelectCity,
  neighborhoods,
  onSelectNeighborhood,
  selectedPreset,
  onSelectPreset,
  isPlacing,
  onStartPlacement,
  isDrawing,
  onStartDrawing,
  hasPlot,
  plotRotation,
  onRotatePlot,
  onClearPlot,
  plotMarla,
  mapStyle,
  onSelectMapStyle,
  cameraMode,
  onToggleCameraMode,
  isSidebarOpen,
  onToggleSidebar,
  hasBuilding,
}: TopNavBarProps) {
  const [showSectors, setShowSectors] = useState(false);
  const [showStyleMenu, setShowStyleMenu] = useState(false);
  const sectorDropdownRef = useRef<HTMLDivElement>(null);
  const styleDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        sectorDropdownRef.current &&
        !sectorDropdownRef.current.contains(event.target as Node)
      ) {
        setShowSectors(false);
      }
      if (
        styleDropdownRef.current &&
        !styleDropdownRef.current.contains(event.target as Node)
      ) {
        setShowStyleMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const cityName = cities[selectedCity]?.label || "Lahore";

  return (
    <header className="top-nav-bar">
      {/* ===== Left Section: Brand Logo & City/Sector Switcher ===== */}
      <div className="nav-group-left">
        {/* Brand Identity */}
        <div className="brand-badge">
          <div className="brand-logo-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2L2 7L12 12L22 7L12 2Z"
                stroke="url(#brandGrad)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 17L12 22L22 17"
                stroke="url(#brandGrad)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 12L12 17L22 12"
                stroke="url(#brandGrad)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <defs>
                <linearGradient id="brandGrad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#38bdf8" />
                  <stop offset="1" stopColor="#818cf8" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="brand-title-wrap">
            <span className="brand-title">GeoBuild <span className="brand-ai">AI</span></span>
            <span className="brand-tag">BIM • PK</span>
          </div>
        </div>

        <div className="nav-divider" />

        {/* City Switcher Pill Group */}
        <div className="city-pill-group">
          {Object.entries(cities).map(([key, data]) => {
            const active = selectedCity === key;
            return (
              <button
                key={key}
                onClick={() => onSelectCity(key)}
                className={`city-pill-btn ${active ? "active" : ""}`}
                title={`Switch focus to ${data.label}`}
              >
                {data.label}
              </button>
            );
          })}
        </div>

        {/* Pakistani Sectors Quick Jump Dropdown */}
        <div className="dropdown-container" ref={sectorDropdownRef}>
          <button
            onClick={() => setShowSectors(!showSectors)}
            className={`sector-dropdown-btn ${showSectors ? "active" : ""}`}
            title={`Select neighborhood in ${cityName}`}
          >
            <span className="pin-icon">📍</span>
            <span className="sector-btn-label">{cityName} Sectors</span>
            <span className="dropdown-arrow">{showSectors ? "▲" : "▼"}</span>
          </button>

          {showSectors && (
            <div className="nav-dropdown-menu">
              <div className="dropdown-section-title">Fly to Pakistani Sector</div>
              <div className="dropdown-items-scroll">
                {neighborhoods.map((n) => (
                  <button
                    key={n.name}
                    onClick={() => {
                      onSelectNeighborhood(n);
                      setShowSectors(false);
                    }}
                    className="dropdown-item-btn"
                  >
                    <span>{n.name}</span>
                    <span className="fly-badge">Fly ↗</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===== Center Section: Clean Unified Plot Architecture Palette ===== */}
      <div className="nav-group-center">
        <div className="plot-toolbar-container">
          <div className="plot-badge-indicator">
            <span className="plot-tool-icon">📐</span>
            <span className="plot-tool-label">Plot:</span>
          </div>

          {/* Preset Buttons */}
          <div className="plot-preset-pills">
            {PRESET_BUTTONS.map((item) => {
              const active = selectedPreset === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => onSelectPreset(item.key)}
                  className={`preset-pill ${active ? "active" : ""}`}
                  title={`${item.label} (${item.dim})`}
                >
                  <span className="preset-name">{item.label}</span>
                  <span className="preset-dim">{item.dim}</span>
                </button>
              );
            })}
          </div>

          <div className="nav-sub-divider" />

          {/* Place on Map Button */}
          <button
            onClick={onStartPlacement}
            className={`plot-action-btn place ${isPlacing ? "active-placing" : ""}`}
            title="Click anywhere on the satellite globe to position your plot"
          >
            <span>📍</span>
            <span>{isPlacing ? "Click Map..." : "Place on Map"}</span>
          </button>

          {/* Draw Custom Button */}
          <button
            onClick={onStartDrawing}
            className={`plot-action-btn draw ${isDrawing ? "active-drawing" : ""}`}
            title="Draw arbitrary custom polygon plot boundary on the map"
          >
            <span>✏️</span>
            <span>{isDrawing ? "Drawing..." : "Draw Custom"}</span>
          </button>

          {/* Orientation & Clear if plot active */}
          {hasPlot && (
            <div className="plot-active-controls">
              <button
                onClick={() => onRotatePlot((plotRotation + 15) % 360)}
                className="plot-rotate-btn"
                title="Rotate plot street orientation by 15°"
              >
                <span>🔄</span>
                <span>{Math.round(plotRotation)}°</span>
              </button>

              <button
                onClick={onClearPlot}
                className="plot-clear-btn"
                title="Clear current plot and model"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ===== Right Section: Basemap, Camera View & AI Copilot Toggle ===== */}
      <div className="nav-group-right">
        {/* Basemap Switcher Dropdown */}
        <div className="dropdown-container" ref={styleDropdownRef}>
          <button
            onClick={() => setShowStyleMenu(!showStyleMenu)}
            className="basemap-trigger-btn"
            title="Choose Basemap Imagery Layer"
          >
            <span>
              {mapStyle === "esri_hd"
                ? "🛰️ Esri HD"
                : mapStyle === "google_satellite"
                ? "🌍 Google Sat"
                : mapStyle === "streets"
                ? "🗺️ Streets"
                : mapStyle === "blueprint"
                ? "📐 Blueprint"
                : "🏛️ Studio 3D"}
            </span>
            <span className="dropdown-arrow">{showStyleMenu ? "▲" : "▼"}</span>
          </button>

          {showStyleMenu && (
            <div className="nav-dropdown-menu right-aligned">
              <div className="dropdown-section-title">Basemap Imagery</div>
              <button
                onClick={() => {
                  onSelectMapStyle("esri_hd");
                  setShowStyleMenu(false);
                }}
                className={`dropdown-item-btn ${mapStyle === "esri_hd" ? "selected" : ""}`}
              >
                <div className="item-with-icon">
                  <span>🛰️</span>
                  <div>
                    <div className="item-primary-label">Esri Ultra-HD Aerial (0.3m)</div>
                    <div className="item-sub-label">Sub-meter high-res satellite</div>
                  </div>
                </div>
                {mapStyle === "esri_hd" && <span className="check-mark">✓</span>}
              </button>

              <button
                onClick={() => {
                  onSelectMapStyle("google_satellite");
                  setShowStyleMenu(false);
                }}
                className={`dropdown-item-btn ${mapStyle === "google_satellite" ? "selected" : ""}`}
              >
                <div className="item-with-icon">
                  <span>🌍</span>
                  <div>
                    <div className="item-primary-label">HD Satellite (Google Hybrid)</div>
                    <div className="item-sub-label">Photorealistic aerial textures</div>
                  </div>
                </div>
                {mapStyle === "google_satellite" && <span className="check-mark">✓</span>}
              </button>

              <button
                onClick={() => {
                  onSelectMapStyle("streets");
                  setShowStyleMenu(false);
                }}
                className={`dropdown-item-btn ${mapStyle === "streets" ? "selected" : ""}`}
              >
                <div className="item-with-icon">
                  <span>🗺️</span>
                  <div>
                    <div className="item-primary-label">OSM Streets</div>
                    <div className="item-sub-label">Road networks & cadastre</div>
                  </div>
                </div>
                {mapStyle === "streets" && <span className="check-mark">✓</span>}
              </button>

              <button
                onClick={() => {
                  onSelectMapStyle("blueprint");
                  setShowStyleMenu(false);
                }}
                className={`dropdown-item-btn ${mapStyle === "blueprint" ? "selected" : ""}`}
              >
                <div className="item-with-icon">
                  <span>📐</span>
                  <div>
                    <div className="item-primary-label">CAD Blueprint</div>
                    <div className="item-sub-label">Dark architectural linework</div>
                  </div>
                </div>
                {mapStyle === "blueprint" && <span className="check-mark">✓</span>}
              </button>

              <button
                onClick={() => {
                  onSelectMapStyle("studio");
                  setShowStyleMenu(false);
                }}
                className={`dropdown-item-btn ${mapStyle === "studio" ? "selected" : ""}`}
              >
                <div className="item-with-icon">
                  <span>🏛️</span>
                  <div>
                    <div className="item-primary-label">Architectural Studio 3D</div>
                    <div className="item-sub-label">Dark room focus on building</div>
                  </div>
                </div>
                {mapStyle === "studio" && <span className="check-mark">✓</span>}
              </button>
            </div>
          )}
        </div>

        {/* 2D CAD vs 3D Perspective Toggle */}
        <div className="camera-segmented-toggle">
          <button
            onClick={() => onToggleCameraMode("2d")}
            className={`camera-toggle-btn ${cameraMode === "2d" ? "active" : ""}`}
            title="Orthogonal Top-Down CAD Plan View"
          >
            2D CAD
          </button>
          <button
            onClick={() => onToggleCameraMode("3d")}
            className={`camera-toggle-btn ${cameraMode === "3d" ? "active" : ""}`}
            title="3D Geospatial Perspective View"
          >
            3D View
          </button>
        </div>

        {/* AI Architect Copilot Drawer Toggle Button */}
        <button
          onClick={onToggleSidebar}
          className={`ai-drawer-toggle-btn ${isSidebarOpen ? "active" : ""}`}
          title={isSidebarOpen ? "Hide AI Architect Panel" : "Show AI Architect Panel"}
        >
          <span className="ai-dot-pulse" />
          <span>💬 AI Copilot</span>
        </button>
      </div>
    </header>
  );
}

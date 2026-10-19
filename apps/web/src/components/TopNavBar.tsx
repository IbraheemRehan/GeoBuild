"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
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
  buildingRotation?: number;
  onRotateBuilding?: (deg: number) => void;
  onRotateBuildingDelta?: (delta: number) => void;
  theme?: "dark" | "light";
  onToggleTheme?: () => void;
  showMarkings?: boolean;
  onToggleMarkings?: () => void;
}

interface PresetSpec {
  key: PlotPresetKey;
  label: string;
  marla: number;
  dimsFt: string;
  dimsM: string;
  sqft: number;
  sqm: number;
  category: string;
}

const PRESET_SPECS: PresetSpec[] = [
  {
    key: "5marla",
    label: "5 Marla",
    marla: 5,
    dimsFt: "25' × 45'",
    dimsM: "7.6 × 13.7 m",
    sqft: 1125,
    sqm: 126.5,
    category: "Standard Residential",
  },
  {
    key: "10marla",
    label: "10 Marla",
    marla: 10,
    dimsFt: "35' × 65'",
    dimsM: "10.7 × 19.8 m",
    sqft: 2275,
    sqm: 252.9,
    category: "Medium Residential",
  },
  {
    key: "1kanal",
    label: "1 Kanal",
    marla: 20,
    dimsFt: "50' × 90'",
    dimsM: "15.2 × 27.4 m",
    sqft: 4500,
    sqm: 505.8,
    category: "Estate / Luxury",
  },
  {
    key: "2kanal",
    label: "2 Kanal",
    marla: 40,
    dimsFt: "75' × 120'",
    dimsM: "22.8 × 36.5 m",
    sqft: 9000,
    sqm: 1011.7,
    category: "Mansion / Commercial",
  },
];

const MAP_STYLES: {
  key: MapStyleKey;
  title: string;
  subtitle: string;
  badge: string;
}[] = [
  {
    key: "esri_hd",
    title: "Esri Ultra-HD Aerial",
    subtitle: "0.3m sub-meter high-res satellite",
    badge: "0.3m",
  },
  {
    key: "google_satellite",
    title: "HD Satellite (Google Hybrid)",
    subtitle: "Photorealistic aerial textures",
    badge: "Aerial",
  },
  {
    key: "streets",
    title: "OSM Streets",
    subtitle: "Road networks & cadastre lines",
    badge: "Vector",
  },
  {
    key: "blueprint",
    title: "CAD Blueprint",
    subtitle: "Dark architectural linework",
    badge: "CAD",
  },
  {
    key: "studio",
    title: "Architectural Studio 3D",
    subtitle: "Minimal dark studio focus on model",
    badge: "Studio",
  },
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
  buildingRotation = 0,
  onRotateBuilding,
  onRotateBuildingDelta,
  theme = "dark",
  onToggleTheme,
  showMarkings = true,
  onToggleMarkings,
}: TopNavBarProps) {
  // Dropdown states
  const [showLocationMenu, setShowLocationMenu] = useState(false);
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [showPlotDetailsMenu, setShowPlotDetailsMenu] = useState(false);
  const [showBuildingMenu, setShowBuildingMenu] = useState(false);
  const [showStyleMenu, setShowStyleMenu] = useState(false);

  // Sector search query
  const [sectorSearch, setSectorSearch] = useState("");

  // Refs for click outside
  const locationRef = useRef<HTMLDivElement>(null);
  const presetRef = useRef<HTMLDivElement>(null);
  const plotDetailsRef = useRef<HTMLDivElement>(null);
  const buildingMenuRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLDivElement>(null);

  // Outside click & escape key listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (locationRef.current && !locationRef.current.contains(target)) {
        setShowLocationMenu(false);
      }
      if (presetRef.current && !presetRef.current.contains(target)) {
        setShowPresetMenu(false);
      }
      if (plotDetailsRef.current && !plotDetailsRef.current.contains(target)) {
        setShowPlotDetailsMenu(false);
      }
      if (buildingMenuRef.current && !buildingMenuRef.current.contains(target)) {
        setShowBuildingMenu(false);
      }
      if (styleRef.current && !styleRef.current.contains(target)) {
        setShowStyleMenu(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowLocationMenu(false);
        setShowPresetMenu(false);
        setShowPlotDetailsMenu(false);
        setShowBuildingMenu(false);
        setShowStyleMenu(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const cityName = cities[selectedCity]?.label || "Lahore";

  const currentPreset = useMemo(() => {
    return PRESET_SPECS.find((p) => p.key === selectedPreset);
  }, [selectedPreset]);

  const currentMapStyle = useMemo(() => {
    return MAP_STYLES.find((s) => s.key === mapStyle) || MAP_STYLES[0];
  }, [mapStyle]);

  const filteredNeighborhoods = useMemo(() => {
    if (!sectorSearch.trim()) return neighborhoods;
    const q = sectorSearch.toLowerCase();
    return neighborhoods.filter((n) => n.name.toLowerCase().includes(q));
  }, [neighborhoods, sectorSearch]);

  const displayAreaMarla = plotMarla ? plotMarla.toFixed(1) : currentPreset ? currentPreset.marla.toString() : null;

  return (
    <header className="top-nav-bar" role="banner">
      {/* ===== Left Section: Classic Typographic Brand & Location Dropdown ===== */}
      <div className="nav-group-left">
        {/* Classic Architectural Wordmark — No Logo Icon */}
        <div className="brand-badge" title="GeoBuild AI — Geospatial BIM Platform">
          <span className="brand-wordmark">GEOBUILD</span>
          <span className="brand-tag">AI</span>
          <span className="brand-sub">BIM • PK</span>
        </div>

        <div className="nav-divider" aria-hidden="true" />

        {/* Location Dropdown: Cities & Pakistani Sectors */}
        <div className="dropdown-container" ref={locationRef}>
          <button
            type="button"
            onClick={() => {
              setShowLocationMenu((prev) => !prev);
              setShowPresetMenu(false);
              setShowPlotDetailsMenu(false);
              setShowStyleMenu(false);
            }}
            className={`nav-btn nav-btn-dropdown ${showLocationMenu ? "active" : ""}`}
            title="Switch City & Fly to Pakistani Sectors"
            aria-expanded={showLocationMenu}
          >
            {/* Map Pin Vector Icon */}
            <svg
              className="nav-icon"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span className="nav-btn-text-bold">{cityName}</span>
            <span className="nav-btn-muted-hint">• Sectors</span>
            <svg
              className={`nav-chevron ${showLocationMenu ? "rotate-180" : ""}`}
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showLocationMenu && (
            <div className="nav-dropdown-menu location-menu" role="menu">
              <div className="dropdown-header">
                <span className="dropdown-section-title">Focus City (Pakistan)</span>
              </div>
              <div className="location-city-tabs">
                {Object.entries(cities).map(([key, data]) => {
                  const active = selectedCity === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onSelectCity(key)}
                      className={`city-tab-btn ${active ? "active" : ""}`}
                    >
                      {data.label}
                    </button>
                  );
                })}
              </div>

              <div className="dropdown-header search-header">
                <span className="dropdown-section-title">{cityName} Sectors</span>
                <span className="dropdown-count-badge">{filteredNeighborhoods.length}</span>
              </div>

              {/* Fast Filter Input */}
              <div className="dropdown-search-wrap">
                <svg
                  className="search-icon"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Filter sector (e.g. DHA, Gulberg, F-6)..."
                  value={sectorSearch}
                  onChange={(e) => setSectorSearch(e.target.value)}
                  className="dropdown-search-input"
                  autoFocus
                />
                {sectorSearch && (
                  <button
                    type="button"
                    onClick={() => setSectorSearch("")}
                    className="search-clear-btn"
                    title="Clear filter"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="dropdown-items-scroll">
                {filteredNeighborhoods.map((n) => (
                  <button
                    key={n.name}
                    type="button"
                    onClick={() => {
                      onSelectNeighborhood(n);
                      setShowLocationMenu(false);
                    }}
                    className="dropdown-item-btn"
                  >
                    <div className="item-label-group">
                      <span className="item-title">{n.name}</span>
                      <span className="item-coords">
                        {n.lat.toFixed(3)}°N, {n.lng.toFixed(3)}°E
                      </span>
                    </div>
                    <span className="fly-badge">Fly ↗</span>
                  </button>
                ))}
                {filteredNeighborhoods.length === 0 && (
                  <div className="dropdown-empty-state">No sectors matching &quot;{sectorSearch}&quot;</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===== Center Section: Professional CAD Plot Architecture Toolbar ===== */}
      <div className="nav-group-center">
        <div className="plot-cad-toolbar">
          {/* 1. Plot Preset Dropdown Menu */}
          <div className="dropdown-container" ref={presetRef}>
            <button
              type="button"
              onClick={() => {
                setShowPresetMenu((prev) => !prev);
                setShowLocationMenu(false);
                setShowPlotDetailsMenu(false);
                setShowStyleMenu(false);
              }}
              className={`nav-btn nav-btn-dropdown preset-trigger-btn ${showPresetMenu ? "active" : ""}`}
              title="Select Standard Pakistani Plot Preset (5M, 10M, 1K, 2K)"
              aria-expanded={showPresetMenu}
            >
              {/* Plot Boundary / Cadastre Icon */}
              <svg
                className="nav-icon"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M9 21V9" />
              </svg>
              <span className="preset-active-label">
                {selectedPreset === "custom"
                  ? "Custom Boundary"
                  : currentPreset
                  ? currentPreset.label
                  : "Plot Preset"}
              </span>
              {currentPreset && selectedPreset !== "custom" && (
                <span className="preset-active-dim">{currentPreset.dimsFt}</span>
              )}
              <svg
                className={`nav-chevron ${showPresetMenu ? "rotate-180" : ""}`}
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {showPresetMenu && (
              <div className="nav-dropdown-menu preset-menu" role="menu">
                <div className="dropdown-header">
                  <span className="dropdown-section-title">Standard Plot Presets (Pakistan)</span>
                  <span className="dropdown-sub-hint">1 Marla ≈ 25.29 m²</span>
                </div>

                <div className="preset-options-list">
                  {PRESET_SPECS.map((spec) => {
                    const isSelected = selectedPreset === spec.key;
                    return (
                      <button
                        key={spec.key}
                        type="button"
                        onClick={() => {
                          onSelectPreset(spec.key);
                          setShowPresetMenu(false);
                        }}
                        className={`preset-item-card ${isSelected ? "selected" : ""}`}
                      >
                        <div className="preset-card-left">
                          <div className="preset-card-title-row">
                            <span className="preset-card-title">{spec.label}</span>
                            <span className="preset-card-category">{spec.category}</span>
                          </div>
                          <div className="preset-card-specs-row">
                            <span className="spec-pill">{spec.dimsFt}</span>
                            <span className="spec-divider">•</span>
                            <span className="spec-metric">{spec.dimsM}</span>
                            <span className="spec-divider">•</span>
                            <span className="spec-area">{spec.sqm} m² ({spec.sqft.toLocaleString()} sq ft)</span>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="preset-selected-check" title="Currently Selected">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="dropdown-footer-note">
                  <span>Preliminary check — not legal or regulatory approval</span>
                </div>
              </div>
            )}
          </div>

          <div className="nav-sub-divider" aria-hidden="true" />

          {/* 2. Place on Map Action */}
          <button
            type="button"
            onClick={onStartPlacement}
            className={`nav-btn nav-action-btn ${isPlacing ? "btn-placing-pulse" : ""}`}
            title="Click anywhere on the 3D globe to place your selected plot"
          >
            {/* Crosshair placement icon */}
            <svg
              className="nav-icon"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="9" />
              <line x1="12" y1="3" x2="12" y2="7" />
              <line x1="12" y1="17" x2="12" y2="21" />
              <line x1="3" y1="12" x2="7" y2="12" />
              <line x1="17" y1="12" x2="21" y2="12" />
            </svg>
            <span className="action-btn-text">{isPlacing ? "Click Globe..." : "Place"}</span>
          </button>

          {/* 3. Draw Custom Polygon Action */}
          <button
            type="button"
            onClick={onStartDrawing}
            className={`nav-btn nav-action-btn ${isDrawing ? "btn-drawing-pulse" : ""}`}
            title="Draw custom polygon boundary points directly on the map"
          >
            {/* Pen/Polygon draw icon */}
            <svg
              className="nav-icon"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m18 2 4 4-12 12H6v-4L18 2Z" />
              <path d="m15 5 4 4" />
            </svg>
            <span className="action-btn-text">{isDrawing ? "Drawing..." : "Draw"}</span>
          </button>

          {/* 4. Active Plot Controls: Area Dropdown, Rotation & Clear */}
          {hasPlot && (
            <>
              <div className="nav-sub-divider" aria-hidden="true" />

              {/* Active Plot Details Dropdown */}
              <div className="dropdown-container" ref={plotDetailsRef}>
                <button
                  type="button"
                  onClick={() => {
                    setShowPlotDetailsMenu((prev) => !prev);
                    setShowLocationMenu(false);
                    setShowPresetMenu(false);
                    setShowStyleMenu(false);
                  }}
                  className={`nav-btn active-plot-badge ${showPlotDetailsMenu ? "active" : ""}`}
                  title="Active Plot Parameters & Orientation Options"
                  aria-expanded={showPlotDetailsMenu}
                >
                  <span className="plot-active-dot" />
                  <span className="plot-active-text">
                    {displayAreaMarla ? `${displayAreaMarla} Marla` : "Plot Active"}
                  </span>
                  <svg
                    className={`nav-chevron ${showPlotDetailsMenu ? "rotate-180" : ""}`}
                    width="9"
                    height="9"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {showPlotDetailsMenu && (
                  <div className="nav-dropdown-menu plot-details-menu" role="menu">
                    <div className="dropdown-header">
                      <span className="dropdown-section-title">Active Cadastre Plot</span>
                      <span className="plot-status-active-badge">Positioned</span>
                    </div>

                    <div className="plot-metrics-box">
                      <div className="metric-row">
                        <span className="metric-key">Plot Area:</span>
                        <span className="metric-val">
                          {plotMarla ? `${plotMarla.toFixed(2)} Marla` : currentPreset ? `${currentPreset.marla} Marla` : "Custom"}
                        </span>
                      </div>
                      <div className="metric-row">
                        <span className="metric-key">Metric Area:</span>
                        <span className="metric-val">
                          {plotMarla
                            ? `${(plotMarla * 25.2929).toFixed(1)} m²`
                            : currentPreset
                            ? `${currentPreset.sqm} m²`
                            : "—"}
                        </span>
                      </div>
                      <div className="metric-row">
                        <span className="metric-key">Imperial Area:</span>
                        <span className="metric-val">
                          {plotMarla
                            ? `${(plotMarla * 272.25).toFixed(0)} sq ft`
                            : currentPreset
                            ? `${currentPreset.sqft} sq ft`
                            : "—"}
                        </span>
                      </div>
                      <div className="metric-row">
                        <span className="metric-key">Street Azimuth:</span>
                        <span className="metric-val">{Math.round(plotRotation)}°</span>
                      </div>
                    </div>

                    <div className="dropdown-section-title" style={{ marginTop: "8px" }}>
                      Quick Rotate Azimuth
                    </div>
                    <div className="plot-rotation-quick-grid">
                      <button
                        type="button"
                        onClick={() => onRotatePlot((plotRotation + 15) % 360)}
                        className="quick-rotate-btn"
                        title="Rotate by +15 degrees"
                      >
                        +15°
                      </button>
                      <button
                        type="button"
                        onClick={() => onRotatePlot((plotRotation + 45) % 360)}
                        className="quick-rotate-btn"
                        title="Rotate by +45 degrees"
                      >
                        +45°
                      </button>
                      <button
                        type="button"
                        onClick={() => onRotatePlot((plotRotation + 90) % 360)}
                        className="quick-rotate-btn"
                        title="Rotate by 90 degrees orthogonal"
                      >
                        +90°
                      </button>
                      <button
                        type="button"
                        onClick={() => onRotatePlot(0)}
                        className="quick-rotate-btn reset"
                        title="Reset azimuth orientation to 0° True North"
                      >
                        Reset 0°
                      </button>
                    </div>

                    <div className="dropdown-divider-line" />

                    {/* Toggle Plot Annotations & Dimension Labels */}
                    {onToggleMarkings && (
                      <button
                        type="button"
                        onClick={() => {
                          onToggleMarkings();
                        }}
                        className="plot-clear-menu-btn"
                        style={{ color: "var(--color-text-primary)", marginBottom: "4px" }}
                        title="Toggle visibility of plot outline, corner pins, and dimension numbers"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="2" y1="12" x2="22" y2="12" />
                          <line x1="2" y1="7" x2="2" y2="17" />
                          <line x1="22" y1="7" x2="22" y2="17" />
                          <circle cx="12" cy="12" r="2" />
                        </svg>
                        <span>{showMarkings ? "Hide Dimension Numbers" : "Show Dimension Numbers"}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        onClearPlot();
                        setShowPlotDetailsMenu(false);
                      }}
                      className="plot-clear-menu-btn"
                      title="Clear active plot boundary and any generated building"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                      <span>Clear & Delete Plot</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Direct 1-Click Quick Rotate Button */}
              <button
                type="button"
                onClick={() => onRotatePlot((plotRotation + 15) % 360)}
                className="nav-btn plot-quick-rotate-btn"
                title={`Rotate plot street orientation by +15° (Current: ${Math.round(plotRotation)}°)`}
              >
                <svg
                  className="nav-icon"
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                </svg>
                <span className="rotate-angle-text">{Math.round(plotRotation)}°</span>
              </button>

              {/* Direct 1-Click Quick Clear Button */}
              <button
                type="button"
                onClick={onClearPlot}
                className="nav-btn plot-quick-clear-btn"
                title="Clear current plot boundary"
                aria-label="Clear current plot"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>

              {/* 5. 3D Building Orientation Angle Controls */}
              {hasBuilding && (
                <>
                  <div className="nav-sub-divider" aria-hidden="true" />
                  <div className="dropdown-container" ref={buildingMenuRef}>
                    <div className="split-btn-group">
                      <button
                        type="button"
                        onClick={() => onRotateBuildingDelta?.(15)}
                        className="nav-btn building-quick-rotate-btn"
                        title={`Rotate 3D Building Angle by +15° (Current: ${Math.round(buildingRotation)}°)`}
                      >
                        <span style={{ fontSize: "0.8rem", marginRight: "3px" }}>🏢</span>
                        <svg
                          className="nav-icon"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                          <path d="M21 3v5h-5" />
                        </svg>
                        <span className="rotate-angle-text">{Math.round(buildingRotation)}°</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowBuildingMenu((prev) => !prev);
                          setShowPlotDetailsMenu(false);
                          setShowLocationMenu(false);
                          setShowPresetMenu(false);
                          setShowStyleMenu(false);
                        }}
                        className={`nav-btn split-chevron-btn ${showBuildingMenu ? "active" : ""}`}
                        title="3D Building Angle & Orientation Options"
                        aria-expanded={showBuildingMenu}
                      >
                        <svg
                          className={`nav-chevron ${showBuildingMenu ? "rotate-180" : ""}`}
                          width="8"
                          height="8"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                    </div>

                    {showBuildingMenu && (
                      <div className="nav-dropdown-menu building-angle-menu" role="menu">
                        <div className="dropdown-header">
                          <span className="dropdown-section-title">3D Building Orientation</span>
                          <span
                            className="plot-status-active-badge"
                            style={{
                              background: "rgba(59, 130, 246, 0.15)",
                              color: "#60a5fa",
                              borderColor: "rgba(59, 130, 246, 0.3)",
                            }}
                          >
                            {Math.round(buildingRotation)}° Azimuth
                          </span>
                        </div>

                        <div style={{ padding: "8px 10px 4px 10px" }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginBottom: "6px",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "0.72rem",
                                color: "var(--color-text-secondary)",
                                fontWeight: 600,
                              }}
                            >
                              Angle Slider:
                            </span>
                            <span
                              style={{
                                fontSize: "0.75rem",
                                color: "var(--color-accent, #6366f1)",
                                fontWeight: 700,
                              }}
                            >
                              {Math.round(buildingRotation)}°
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="360"
                            step="1"
                            value={Math.round(buildingRotation)}
                            onChange={(e) => onRotateBuilding?.(Number(e.target.value))}
                            style={{
                              width: "100%",
                              accentColor: "var(--color-accent, #6366f1)",
                              cursor: "pointer",
                            }}
                          />
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: "0.65rem",
                              color: "var(--color-text-muted)",
                              marginTop: "2px",
                            }}
                          >
                            <span>0° (N)</span>
                            <span>90° (E)</span>
                            <span>180° (S)</span>
                            <span>270° (W)</span>
                            <span>360°</span>
                          </div>
                        </div>

                        <div className="dropdown-section-title" style={{ marginTop: "6px" }}>
                          Quick Rotate Angle
                        </div>
                        <div className="plot-rotation-quick-grid">
                          <button
                            type="button"
                            onClick={() => onRotateBuildingDelta?.(-15)}
                            className="quick-rotate-btn"
                            title="Rotate counter-clockwise -15 degrees"
                          >
                            -15°
                          </button>
                          <button
                            type="button"
                            onClick={() => onRotateBuildingDelta?.(15)}
                            className="quick-rotate-btn"
                            title="Rotate clockwise +15 degrees"
                          >
                            +15°
                          </button>
                          <button
                            type="button"
                            onClick={() => onRotateBuildingDelta?.(45)}
                            className="quick-rotate-btn"
                            title="Rotate clockwise +45 degrees"
                          >
                            +45°
                          </button>
                          <button
                            type="button"
                            onClick={() => onRotateBuildingDelta?.(90)}
                            className="quick-rotate-btn"
                            title="Rotate clockwise +90 degrees"
                          >
                            +90°
                          </button>
                          <button
                            type="button"
                            onClick={() => onRotateBuildingDelta?.(180)}
                            className="quick-rotate-btn"
                            title="Flip building 180 degrees"
                          >
                            180° Flip
                          </button>
                          <button
                            type="button"
                            onClick={() => onRotateBuilding?.(0)}
                            className="quick-rotate-btn reset"
                            title="Reset building to 0° True North"
                          >
                            Reset 0°
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ===== Right Section: Basemap Dropdown, 2D/3D CAD, Theme & AI Copilot ===== */}
      <div className="nav-group-right">
        {/* Basemap Switcher Dropdown */}
        <div className="dropdown-container" ref={styleRef}>
          <button
            type="button"
            onClick={() => {
              setShowStyleMenu((prev) => !prev);
              setShowLocationMenu(false);
              setShowPresetMenu(false);
              setShowPlotDetailsMenu(false);
            }}
            className={`nav-btn nav-btn-dropdown basemap-trigger-btn ${showStyleMenu ? "active" : ""}`}
            title="Switch Geospatial Basemap Imagery Layer"
            aria-expanded={showStyleMenu}
          >
            {/* Map Layers Icon */}
            <svg
              className="nav-icon"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
            <span className="basemap-title-text">{currentMapStyle.badge}</span>
            <svg
              className={`nav-chevron ${showStyleMenu ? "rotate-180" : ""}`}
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showStyleMenu && (
            <div className="nav-dropdown-menu right-aligned basemap-menu" role="menu">
              <div className="dropdown-header">
                <span className="dropdown-section-title">Geospatial Basemap Layer</span>
              </div>
              <div className="basemap-options-list">
                {MAP_STYLES.map((style) => {
                  const isSelected = mapStyle === style.key;
                  return (
                    <button
                      key={style.key}
                      type="button"
                      onClick={() => {
                        onSelectMapStyle(style.key);
                        setShowStyleMenu(false);
                      }}
                      className={`dropdown-item-btn basemap-item-btn ${isSelected ? "selected" : ""}`}
                    >
                      <div className="item-label-group">
                        <div className="item-title-row">
                          <span className="item-primary-label">{style.title}</span>
                          <span className="item-type-badge">{style.badge}</span>
                        </div>
                        <div className="item-sub-label">{style.subtitle}</div>
                      </div>
                      {isSelected && (
                        <div className="item-check-icon">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Markings vs Clean View Toggle Button */}
        {onToggleMarkings && (
          <button
            type="button"
            onClick={onToggleMarkings}
            className={`nav-btn markings-toggle-btn ${showMarkings ? "active" : "clean-mode"}`}
            title={
              showMarkings
                ? "Switch to Clean 3D View (Hide plot boundary markings & dimension numbers)"
                : "Show CAD Annotations (Display plot boundaries, edge dimensions & markers)"
            }
            aria-label="Toggle CAD Markings and Dimensions"
          >
            <svg
              className="nav-icon"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="2" y1="12" x2="22" y2="12" />
              <line x1="2" y1="7" x2="2" y2="17" />
              <line x1="22" y1="7" x2="22" y2="17" />
              <circle cx="12" cy="12" r="2" />
            </svg>
            <span className="markings-btn-text">
              {showMarkings ? "Markings" : "Clean View"}
            </span>
          </button>
        )}

        {/* 2D CAD vs 3D Perspective Toggle */}
        <div className="camera-segmented-toggle" role="group" aria-label="Camera Projection">
          <button
            type="button"
            onClick={() => onToggleCameraMode("2d")}
            className={`camera-toggle-btn ${cameraMode === "2d" ? "active" : ""}`}
            title="Orthogonal Top-Down CAD Plan View"
          >
            2D CAD
          </button>
          <button
            type="button"
            onClick={() => onToggleCameraMode("3d")}
            className={`camera-toggle-btn ${cameraMode === "3d" ? "active" : ""}`}
            title="3D Geospatial Perspective View"
          >
            3D
          </button>
        </div>

        {/* Classic Minimalist Theme Toggle (Sun/Moon) */}
        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            className="nav-btn theme-icon-btn"
            title={`Switch to ${theme === "dark" ? "Architectural Light" : "Jet Black Dark"} Mode`}
            aria-label="Toggle Theme"
          >
            {theme === "dark" ? (
              /* Sun Icon */
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2" />
                <path d="M12 20v2" />
                <path d="m4.93 4.93 1.41 1.41" />
                <path d="m17.66 17.66 1.41 1.41" />
                <path d="M2 12h2" />
                <path d="M20 12h2" />
                <path d="m6.34 17.66-1.41 1.41" />
                <path d="m19.07 4.93-1.41 1.41" />
              </svg>
            ) : (
              /* Moon Icon */
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
              </svg>
            )}
          </button>
        )}

        {/* AI Architect Copilot Drawer Toggle Button */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className={`ai-drawer-toggle-btn ${isSidebarOpen ? "active" : ""}`}
          title={isSidebarOpen ? "Collapse AI Architect Copilot Drawer" : "Open AI Architect Copilot Drawer"}
        >
          <span className="ai-dot-pulse" aria-hidden="true" />
          <span className="copilot-btn-text">AI Copilot</span>
        </button>
      </div>
    </header>
  );
}

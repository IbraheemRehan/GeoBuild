"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import type { CesiumGlobeRef, MapStyleKey } from "@/components/CesiumGlobe";
import PlotSelector, { type PlotPresetKey } from "@/components/PlotSelector";
import BuildingAnalysisHUD from "@/components/BuildingAnalysisHUD";
import MapControls, { type Neighborhood } from "@/components/MapControls";

// Dynamic import — CesiumJS cannot run on the server
const CesiumGlobe = dynamic(() => import("@/components/CesiumGlobe"), {
  ssr: false,
  loading: () => (
    <div className="cesium-loading-overlay">
      <div className="cesium-loading-spinner" />
      <p>Preparing 3D geospatial engine...</p>
    </div>
  ),
});

const CESIUM_TOKEN = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN || "";

// City coordinates (Rule 8 & 9)
const CITIES = {
  lahore: { lng: 74.3587, lat: 31.5204, label: "Lahore" },
  islamabad: { lng: 73.0479, lat: 33.6844, label: "Islamabad" },
  karachi: { lng: 67.0011, lat: 24.8607, label: "Karachi" },
} as const;

type CityKey = keyof typeof CITIES;

// Pakistani Neighborhood Quick Jumps
const NEIGHBORHOODS: Record<CityKey, Neighborhood[]> = {
  lahore: [
    { name: "DHA Phase 6", lng: 74.4503, lat: 31.4728, height: 350 },
    { name: "Bahria Town Sector C", lng: 74.195, lat: 31.3695, height: 350 },
    { name: "Gulberg III", lng: 74.3496, lat: 31.5135, height: 350 },
    { name: "Johar Town Phase 2", lng: 74.2785, lat: 31.4697, height: 350 },
    { name: "Model Town", lng: 74.3218, lat: 31.4878, height: 350 },
  ],
  islamabad: [
    { name: "F-7 / Blue Area", lng: 73.0551, lat: 33.72, height: 350 },
    { name: "DHA Phase 2 Islamabad", lng: 73.155, lat: 33.528, height: 350 },
    { name: "Bahria Enclave", lng: 73.205, lat: 33.685, height: 350 },
    { name: "Sector G-11", lng: 72.998, lat: 33.668, height: 350 },
  ],
  karachi: [
    { name: "Clifton Block 4", lng: 67.032, lat: 24.819, height: 350 },
    { name: "DHA Phase 8", lng: 67.085, lat: 24.77, height: 350 },
    { name: "Bahria Town Karachi", lng: 67.33, lat: 25.01, height: 450 },
    { name: "Gulshan-e-Iqbal", lng: 67.088, lat: 24.918, height: 350 },
  ],
};

const PRESET_LABELS: Record<PlotPresetKey, string> = {
  "5marla": "5 Marla (25×45 ft)",
  "10marla": "10 Marla (35×65 ft)",
  "1kanal": "1 Kanal (50×90 ft)",
  "2kanal": "2 Kanal (75×120 ft)",
};

// Suggestion prompts
const SUGGESTIONS = [
  "Design a modern 2-storey house with 4 bedrooms, rooftop terrace, and contemporary Pakistani facade",
  "5 marla ka ghar, 2 manzil, 3 kamre, covered parking",
  "Luxury 1 kanal villa with basement, 6 bedrooms, Mughal-inspired design",
  "Simple 3-bedroom house with servant quarter and drawing room",
];

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

// Preset plot dimensions in metres (Rule 7, 10)
const PRESET_DIMS: Record<PlotPresetKey, { width: number; depth: number }> = {
  "5marla": { width: 7.62, depth: 13.72 },   // 25x45 ft ~ 104.5 m²
  "10marla": { width: 10.67, depth: 19.81 }, // 35x65 ft ~ 211.4 m²
  "1kanal": { width: 15.24, depth: 27.43 },  // 50x90 ft ~ 418.0 m²
  "2kanal": { width: 22.86, depth: 36.58 },  // 75x120 ft ~ 836.0 m²
};

// Helper to create rotated rectangular plot coordinates centered at (cLng, cLat)
function createOrientedPlotCoordinates(
  cLng: number,
  cLat: number,
  preset: PlotPresetKey,
  rotDeg: number = 0
): [number, number][] {
  const { width, depth } = PRESET_DIMS[preset];
  const latRad = (cLat * Math.PI) / 180;
  const mPerDegLat = 111132;
  const mPerDegLng = 111132 * Math.cos(latRad);

  const halfW = width / 2;
  const halfD = depth / 2;
  const rad = (rotDeg * Math.PI) / 180;
  const cosR = Math.cos(rad);
  const sinR = Math.sin(rad);

  // 4 corners relative to center in metres:
  // 0: front-left, 1: front-right, 2: back-right, 3: back-left
  const localCorners = [
    [-halfW, -halfD],
    [+halfW, -halfD],
    [+halfW, +halfD],
    [-halfW, +halfD],
  ];

  return localCorners.map(([x, y]) => {
    const rx = x * cosR - y * sinR;
    const ry = x * sinR + y * cosR;
    const lng = cLng + rx / mPerDegLng;
    const lat = cLat + ry / mPerDegLat;
    return [lng, lat];
  });
}

export default function HomePage() {
  const globeRef = useRef<CesiumGlobeRef>(null);
  const [selectedCity, setSelectedCity] = useState<CityKey>("lahore");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [globeReady, setGlobeReady] = useState(false);

  // Layout states: sidebar collapse & tab switcher
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState<"chat" | "plot">("chat");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat when messages or status change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing, statusMessage]);

  // Map & Camera mode state
  const [mapStyle, setMapStyle] = useState<MapStyleKey>("google_satellite");
  const [cameraMode, setCameraMode] = useState<"2d" | "3d">("3d");

  // Plot state
  const [currentPlot, setCurrentPlot] = useState<[number, number][] | null>(null);
  const [plotCenter, setPlotCenter] = useState<[number, number]>([74.3587, 31.5204]);
  const [selectedPreset, setSelectedPreset] = useState<PlotPresetKey | "custom" | null>(null);
  const [plotRotation, setPlotRotation] = useState<number>(0);
  const [plotMarla, setPlotMarla] = useState<number | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPlacing, setIsPlacing] = useState(false);

  // 3D Building & Analysis state
  const [latestAnalysis, setLatestAnalysis] = useState<{
    spec: any;
    generate: any;
    analysis: any;
  } | null>(null);
  const [isOrbiting, setIsOrbiting] = useState(false);

  // Handle City Change
  const handleCityChange = useCallback((city: CityKey) => {
    setSelectedCity(city);
    const coords = CITIES[city];
    setPlotCenter([coords.lng, coords.lat]);
    globeRef.current?.flyTo(coords.lng, coords.lat, 3000);
  }, []);

  // Pakistani Neighborhood quick selection
  const handleSelectNeighborhood = useCallback(
    (n: Neighborhood) => {
      setPlotCenter([n.lng, n.lat]);
      globeRef.current?.flyTo(n.lng, n.lat, n.height);
      if (selectedPreset && selectedPreset !== "custom") {
        const coords = createOrientedPlotCoordinates(n.lng, n.lat, selectedPreset, plotRotation);
        setCurrentPlot(coords);
        globeRef.current?.setPlotPolygon(
          coords,
          `${PRESET_LABELS[selectedPreset]} • ${n.name}`
        );
      }
    },
    [selectedPreset, plotRotation]
  );

  // Map style toggle
  const handleSelectMapStyle = useCallback((style: MapStyleKey) => {
    setMapStyle(style);
    globeRef.current?.setMapStyle(style);
  }, []);

  // 2D / 3D camera mode toggle
  const handleToggleCameraMode = useCallback((mode: "2d" | "3d") => {
    setCameraMode(mode);
    globeRef.current?.setCameraView(mode, plotCenter[0], plotCenter[1]);
  }, [plotCenter]);

  // Preset plot selection
  const handleSelectPreset = useCallback(
    (preset: PlotPresetKey) => {
      setSelectedPreset(preset);
      const coords = createOrientedPlotCoordinates(plotCenter[0], plotCenter[1], preset, plotRotation);
      setCurrentPlot(coords);

      const marlaMap: Record<PlotPresetKey, number> = {
        "5marla": 5.0,
        "10marla": 10.0,
        "1kanal": 20.0,
        "2kanal": 40.0,
      };
      setPlotMarla(marlaMap[preset]);

      const label = `${preset === "5marla" ? "5 Marla" : preset === "10marla" ? "10 Marla" : preset === "1kanal" ? "1 Kanal" : "2 Kanal"} Plot`;
      globeRef.current?.setPlotPolygon(coords, label);
      globeRef.current?.setCameraView(cameraMode, plotCenter[0], plotCenter[1]);
    },
    [plotCenter, plotRotation, cameraMode]
  );

  // Auto-initialize 5 Marla plot once globe is ready if no plot exists yet
  useEffect(() => {
    if (globeReady && !currentPlot) {
      handleSelectPreset("5marla");
    }
  }, [globeReady, currentPlot, handleSelectPreset]);

  // Rotate plot
  const handleRotatePlot = useCallback(
    (deg: number) => {
      setPlotRotation(deg);
      if (selectedPreset && selectedPreset !== "custom") {
        const coords = createOrientedPlotCoordinates(plotCenter[0], plotCenter[1], selectedPreset, deg);
        setCurrentPlot(coords);
        const label = `${selectedPreset === "5marla" ? "5 Marla" : selectedPreset === "10marla" ? "10 Marla" : "1 Kanal"} Plot`;
        globeRef.current?.setPlotPolygon(coords, label);
      }
    },
    [selectedPreset, plotCenter]
  );

  // Click map to place plot
  const handleStartPlacement = useCallback(() => {
    setIsPlacing(true);
    globeRef.current?.startPlotPlacement((lng, lat) => {
      setIsPlacing(false);
      setPlotCenter([lng, lat]);
      const preset = selectedPreset && selectedPreset !== "custom" ? selectedPreset : "5marla";
      setSelectedPreset(preset);
      const coords = createOrientedPlotCoordinates(lng, lat, preset, plotRotation);
      setCurrentPlot(coords);

      const marlaMap: Record<PlotPresetKey, number> = {
        "5marla": 5.0,
        "10marla": 10.0,
        "1kanal": 20.0,
        "2kanal": 40.0,
      };
      setPlotMarla(marlaMap[preset]);

      const label = `${preset === "5marla" ? "5 Marla" : preset === "10marla" ? "10 Marla" : "1 Kanal"} Plot`;
      globeRef.current?.setPlotPolygon(coords, label);
      globeRef.current?.setCameraView(cameraMode, lng, lat);
    });
  }, [selectedPreset, plotRotation, cameraMode]);

  // Custom plot drawn on map
  const handlePlotDrawn = useCallback((coords: [number, number][]) => {
    setCurrentPlot(coords);
    setSelectedPreset("custom");

    // Approximate area in Marla (1 marla ≈ 25.2929 m²)
    const sumX = coords.reduce((acc, c) => acc + c[0], 0);
    const sumY = coords.reduce((acc, c) => acc + c[1], 0);
    const cLon = sumX / coords.length;
    const cLat = sumY / coords.length;
    setPlotCenter([cLon, cLat]);

    const latRad = (cLat * Math.PI) / 180;
    const mPerDegLat = 111132;
    const mPerDegLng = 111132 * Math.cos(latRad);

    let areaSqm = 0;
    const n = coords.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const xi = coords[i][0] * mPerDegLng;
      const yi = coords[i][1] * mPerDegLat;
      const xj = coords[j][0] * mPerDegLng;
      const yj = coords[j][1] * mPerDegLat;
      areaSqm += xi * yj - xj * yi;
    }
    areaSqm = Math.abs(areaSqm) / 2;
    const marla = areaSqm / 25.2929;
    setPlotMarla(roundTo(marla, 1));
  }, []);

  // Clear plot and model
  const handleClearPlot = useCallback(() => {
    setCurrentPlot(null);
    setSelectedPreset(null);
    setPlotMarla(null);
    setLatestAnalysis(null);
    globeRef.current?.clearPlot();
    globeRef.current?.clearModel();
  }, []);

  // Core Pipeline: Natural Language -> AI Spec -> 3D Building -> Map Placement -> Feasibility
  const handleSend = useCallback(
    async (text?: string) => {
      const prompt = text || inputValue.trim();
      if (!prompt) return;

      setInputValue("");
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: prompt,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsProcessing(true);
      setStatusMessage("Interpreting requirements with AI...");

      const aiUrl = process.env.NEXT_PUBLIC_AI_SERVICE_URL || "http://localhost:8000";

      try {
        // Step 1: Natural Language -> AI Building Specification (Rule 1, 2, 5)
        const interpretRes = await fetch(`${aiUrl}/api/v1/interpret`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            city: selectedCity,
          }),
        });

        if (!interpretRes.ok) {
          let errDetail = `AI service error: ${interpretRes.status}`;
          try {
            const errData = await interpretRes.json();
            if (errData?.detail) errDetail = errData.detail;
          } catch {}
          throw new Error(errDetail);
        }

        const interpretData = await interpretRes.json();
        const spec = interpretData.spec;

        // Step 2: Ensure Plot Polygon exists
        let activePlot = currentPlot;
        if (!activePlot || activePlot.length < 3) {
          // Infer plot size from prompt or spec
          const pLower = prompt.toLowerCase();
          let presetKey: PlotPresetKey = "5marla";
          if (pLower.includes("10 marla") || pLower.includes("10marla") || spec.rooms?.bedrooms >= 5) {
            presetKey = "10marla";
          } else if (pLower.includes("kanal") || pLower.includes("villa") || spec.floors >= 3) {
            presetKey = "1kanal";
          }

          const cityCoords = CITIES[selectedCity];
          activePlot = createOrientedPlotCoordinates(cityCoords.lng, cityCoords.lat, presetKey, plotRotation);
          setCurrentPlot(activePlot);
          setSelectedPreset(presetKey);
          const label = `${presetKey === "5marla" ? "5 Marla" : presetKey === "10marla" ? "10 Marla" : "1 Kanal"} Plot`;
          globeRef.current?.setPlotPolygon(activePlot, label);
        }

        if (!activePlot || activePlot.length < 3) {
          throw new Error("Unable to establish plot coordinates for 3D generation.");
        }

        setStatusMessage("Building procedural 3D model (GLB)...");

        // Step 3: Procedural 3D Geometry Generation (Rule 11, 12, 13, 14)
        const generateRes = await fetch(`${aiUrl}/api/v1/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            spec,
            plot_polygon_wgs84: activePlot,
            front_edge_index: 0,
            city: selectedCity,
          }),
        });

        if (!generateRes.ok) {
          let genErr = `Generation failed: ${generateRes.status}`;
          try {
            const ed = await generateRes.json();
            if (ed?.detail) genErr = ed.detail;
          } catch {}
          throw new Error(genErr);
        }

        const generateData = await generateRes.json();

        // Step 4: Geospatial Placement on Cesium Globe
        if (generateData.glb_data_uri && generateData.center_wgs84) {
          globeRef.current?.loadGlbModel(
            generateData.glb_data_uri,
            generateData.center_wgs84 as [number, number],
            generateData.heading_deg || 0
          );
        }

        setStatusMessage("Checking regulations and feasibility...");

        // Step 5: Regulatory Compliance & Cost Feasibility (Rule 15, 16, 17)
        let analysisData: any = null;
        try {
          const analyzeRes = await fetch(`${aiUrl}/api/v1/analyze`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              spec,
              plot_area_sqm: generateData.plot_area_sqm || 126.5,
              city: selectedCity,
              cost_tier: "standard",
            }),
          });
          if (analyzeRes.ok) {
            analysisData = await analyzeRes.json();
          }
        } catch (anErr) {
          console.warn("Analysis check skipped:", anErr);
        }

        setLatestAnalysis({
          spec,
          generate: generateData,
          analysis: analysisData,
        });

        // Step 6: Assistant Chat Message
        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: formatFullResponse(spec, generateData, analysisData),
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);

        // Show assumptions if any
        if (interpretData.assumptions?.length > 0) {
          const sysMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: "system",
            content: `💡 Assumptions: ${interpretData.assumptions.join(" • ")}`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, sysMsg]);
        }
      } catch (err: any) {
        const errorMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "system",
          content: `⚠️ ${err?.message || "Failed to process request. Ensure AI service is running at port 8000."}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsProcessing(false);
        setStatusMessage(null);
      }
    },
    [inputValue, selectedCity, currentPlot]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const toggleOrbitMode = useCallback(() => {
    setIsOrbiting((prev) => {
      const next = !prev;
      globeRef.current?.toggleOrbit(next);
      return next;
    });
  }, []);

  return (
    <div className="app-layout">
      {/* Sidebar with Tabs & Collapsible View */}
      <aside className={`sidebar ${isSidebarCollapsed ? "collapsed" : ""}`}>
        <div className="sidebar-header">
          <div className="sidebar-header-top">
            <div>
              <h1>GeoBuild AI</h1>
              <p className="subtitle">AI Geospatial Real Estate & Architecture</p>
            </div>
            <button
              className="sidebar-collapse-btn"
              onClick={() => setIsSidebarCollapsed(true)}
              title="Collapse sidebar for full-screen map view"
            >
              ◀ Map Only
            </button>
          </div>

          <div className="city-selector">
            {(Object.entries(CITIES) as [CityKey, (typeof CITIES)[CityKey]][]).map(
              ([key, city]) => (
                <button
                  key={key}
                  className={`city-chip ${selectedCity === key ? "active" : ""}`}
                  onClick={() => handleCityChange(key)}
                >
                  {city.label}
                </button>
              )
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="sidebar-tabs">
          <button
            className={`sidebar-tab-btn ${activeSidebarTab === "chat" ? "active" : ""}`}
            onClick={() => setActiveSidebarTab("chat")}
          >
            <span>💬</span> AI Architect
          </button>
          <button
            className={`sidebar-tab-btn ${activeSidebarTab === "plot" ? "active" : ""}`}
            onClick={() => setActiveSidebarTab("plot")}
          >
            <span>📐</span> Plot & Site Plan
            {currentPlot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />}
          </button>
        </div>

        {/* Tab 1: AI Chat & Design */}
        {activeSidebarTab === "chat" && (
          <div className="sidebar-tab-content">
            <div
              style={{
                background: "rgba(15, 23, 42, 0.75)",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                padding: "8px 14px",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  📐 Select Plot Size
                </span>
                <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                  {selectedPreset ? (selectedPreset === "custom" ? `Custom (${plotMarla || 5} Marla)` : PRESET_LABELS[selectedPreset]) : "5 Marla"} • {CITIES[selectedCity].label}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "4px" }}>
                {(["5marla", "10marla", "1kanal", "2kanal"] as PlotPresetKey[]).map((pk) => {
                  const active = selectedPreset === pk;
                  const labelMap: Record<PlotPresetKey, { title: string; dim: string }> = {
                    "5marla": { title: "5 Marla", dim: "25×45'" },
                    "10marla": { title: "10 Marla", dim: "35×65'" },
                    "1kanal": { title: "1 Kanal", dim: "50×90'" },
                    "2kanal": { title: "2 Kanal", dim: "75×120'" },
                  };
                  return (
                    <button
                      key={pk}
                      onClick={() => handleSelectPreset(pk)}
                      style={{
                        background: active ? "linear-gradient(135deg, #0284c7, #2563eb)" : "rgba(30, 41, 59, 0.6)",
                        border: `1px solid ${active ? "#38bdf8" : "rgba(255, 255, 255, 0.08)"}`,
                        borderRadius: "6px",
                        padding: "4px 2px",
                        color: active ? "#ffffff" : "#cbd5e1",
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                      }}
                    >
                      <span>{labelMap[pk].title}</span>
                      <span style={{ fontSize: "0.62rem", opacity: 0.75 }}>{labelMap[pk].dim}</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: "6px", marginTop: "2px" }}>
                <button
                  onClick={handleStartPlacement}
                  style={{
                    flex: 1,
                    background: isPlacing ? "#0284c7" : "rgba(30, 41, 59, 0.7)",
                    color: isPlacing ? "#ffffff" : "#cbd5e1",
                    border: `1px solid ${isPlacing ? "#38bdf8" : "rgba(255, 255, 255, 0.1)"}`,
                    borderRadius: "6px",
                    padding: "4px 8px",
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "4px",
                  }}
                  title="Click anywhere on the map to drop the selected plot"
                >
                  <span>📍</span> {isPlacing ? "Click map..." : "Place on Map"}
                </button>
                <button
                  onClick={() => globeRef.current?.startDrawingPlot()}
                  style={{
                    flex: 1,
                    background: isDrawing ? "#f59e0b" : "rgba(30, 41, 59, 0.7)",
                    color: isDrawing ? "#000000" : "#cbd5e1",
                    border: `1px solid ${isDrawing ? "#fbbf24" : "rgba(255, 255, 255, 0.1)"}`,
                    borderRadius: "6px",
                    padding: "4px 8px",
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "4px",
                  }}
                  title="Draw custom polygon boundary points"
                >
                  <span>✏️</span> {isDrawing ? "Drawing..." : "Draw Custom"}
                </button>
                {currentPlot && (
                  <button
                    onClick={() => handleRotatePlot((plotRotation + 15) % 360)}
                    style={{
                      background: "rgba(30, 41, 59, 0.7)",
                      color: "#38bdf8",
                      border: "1px solid rgba(56, 189, 248, 0.25)",
                      borderRadius: "6px",
                      padding: "4px 8px",
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                    title="Rotate plot street orientation by 15°"
                  >
                    🔄 {Math.round(plotRotation)}°
                  </button>
                )}
              </div>
            </div>

            <div className="chat-panel">
              <div className="chat-messages">
                {messages.length === 0 ? (
                  <div className="welcome-screen">
                    <div className="welcome-icon">🏗️</div>
                    <h2 className="welcome-title">Design Your Property</h2>
                    <p className="welcome-description">
                      Describe your dream home in Urdu or English. The AI generates your 3D building, extrudes procedural floors, places it accurately in Pakistan, and computes LDA/CDA compliance & cost rates.
                    </p>
                    <div className="welcome-suggestions">
                      {SUGGESTIONS.map((s, i) => (
                        <button
                          key={i}
                          className="suggestion-btn"
                          onClick={() => handleSend(s)}
                        >
                          &ldquo;{s}&rdquo;
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`chat-message ${msg.role}`}
                      style={{ whiteSpace: "pre-line" }}
                    >
                      {msg.content}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Status indicator if working */}
              {statusMessage && (
                <div
                  style={{
                    padding: "6px 16px",
                    fontSize: "0.75rem",
                    color: "#818cf8",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "rgba(99, 102, 241, 0.12)",
                    borderTop: "1px solid rgba(99, 102, 241, 0.2)",
                  }}
                >
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "#818cf8",
                      animation: "pulse 1s infinite",
                    }}
                  />
                  {statusMessage}
                </div>
              )}

              {/* Pinned Sticky Chat Input */}
              <div className="chat-input-container">
                <div className="prompt-chips-row">
                  <button
                    className="prompt-chip"
                    onClick={() => setInputValue("5 marla ka ghar, 2 manzil, 3 kamre, contemporary pakistani facade")}
                  >
                    🏠 5 Marla 2-Storey
                  </button>
                  <button
                    className="prompt-chip"
                    onClick={() => setInputValue("10 marla luxury villa with 4 bedrooms, rooftop terrace & covered parking")}
                  >
                    🏰 10 Marla Villa
                  </button>
                  <button
                    className="prompt-chip"
                    onClick={() => setInputValue("Add rooftop terrace, traditional jali screens, and modern balcony")}
                  >
                    🌇 Terrace & Jali
                  </button>
                  <button
                    className="prompt-chip"
                    onClick={() => setInputValue("1 kanal modern house with drawing room and 2 car porch")}
                  >
                    🚗 1 Kanal Porch
                  </button>
                </div>

                <div className="chat-input-wrapper">
                  <textarea
                    className="chat-input"
                    placeholder="Describe your building... (e.g. '5 marla ka ghar, 2 manzil, 4 kamre')"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isProcessing}
                    rows={2}
                  />
                  <button
                    className="chat-send-btn"
                    onClick={() => handleSend()}
                    disabled={!inputValue.trim() || isProcessing}
                    title="Generate 3D Building"
                  >
                    {isProcessing ? "⏳" : "→"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Plot & Site Plan */}
        {activeSidebarTab === "plot" && (
          <div className="sidebar-tab-content">
            <div className="plot-tab-scroll">
              <PlotSelector
                selectedPreset={selectedPreset}
                onSelectPreset={handleSelectPreset}
                onStartDrawing={() => globeRef.current?.startDrawingPlot()}
                onStartPlacement={handleStartPlacement}
                onClearPlot={handleClearPlot}
                isDrawing={isDrawing}
                isPlacing={isPlacing}
                hasPlot={Boolean(currentPlot && currentPlot.length >= 3)}
                plotMarla={plotMarla}
                mapStyle={mapStyle}
                onSelectMapStyle={handleSelectMapStyle}
                cameraMode={cameraMode}
                onToggleCameraMode={handleToggleCameraMode}
                plotRotation={plotRotation}
                onRotatePlot={handleRotatePlot}
              />

              <button
                onClick={() => setActiveSidebarTab("chat")}
                style={{
                  background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
                  border: "none",
                  borderRadius: "10px",
                  color: "white",
                  padding: "12px 16px",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  boxShadow: "0 4px 16px rgba(79, 70, 229, 0.4)",
                  marginTop: "6px",
                }}
              >
                <span>Proceed to AI Building Design</span>
                <span>💬 →</span>
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* 3D Geospatial Globe */}
      <main className="globe-container">
        {/* Floating Re-Open Sidebar Button when Collapsed */}
        {isSidebarCollapsed && (
          <button
            className="sidebar-toggle-floating"
            onClick={() => setIsSidebarCollapsed(false)}
            title="Open AI Architect Sidebar"
          >
            <span>💬</span>
            <span>Open AI Architect</span>
          </button>
        )}

        <CesiumGlobe
          ref={globeRef}
          ionToken={CESIUM_TOKEN}
          onReady={() => setGlobeReady(true)}
          onPlotDrawn={handlePlotDrawn}
          onDrawingChange={(drawing) => setIsDrawing(drawing)}
        />

        {/* Floating GIS Map Controls HUD (Compass, Zoom, 2D/3D, Tilt, Rotate, Neighborhoods, Plot Ribbon) */}
        {globeReady && (
          <MapControls
            globeRef={globeRef}
            cameraMode={cameraMode}
            onToggleCameraMode={handleToggleCameraMode}
            mapStyle={mapStyle}
            onSelectMapStyle={handleSelectMapStyle}
            isOrbiting={isOrbiting}
            onToggleOrbit={toggleOrbitMode}
            hasBuilding={Boolean(latestAnalysis)}
            hasPlot={Boolean(currentPlot && currentPlot.length >= 3)}
            neighborhoods={NEIGHBORHOODS[selectedCity] || []}
            currentCityName={CITIES[selectedCity].label}
            onSelectNeighborhood={handleSelectNeighborhood}
            selectedPreset={selectedPreset}
            onSelectPreset={handleSelectPreset}
            onStartPlacement={handleStartPlacement}
            onStartDrawing={() => globeRef.current?.startDrawingPlot()}
            onClearPlot={handleClearPlot}
            isPlacing={isPlacing}
            isDrawing={isDrawing}
            plotRotation={plotRotation}
            onRotatePlot={handleRotatePlot}
            plotMarla={plotMarla}
          />
        )}

        {/* Floating Building & Feasibility HUD */}
        {latestAnalysis && (
          <BuildingAnalysisHUD
            spec={latestAnalysis.spec}
            generate={latestAnalysis.generate}
            analysis={latestAnalysis.analysis}
            onFocusBuilding={() => globeRef.current?.flyToBuilding()}
            onToggleOrbit={toggleOrbitMode}
            onToggleShadows={() => globeRef.current?.toggleShadows()}
            isOrbiting={isOrbiting}
            onClose={() => setLatestAnalysis(null)}
          />
        )}
      </main>
    </div>
  );
}

function roundTo(val: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

/**
 * Format complete response combining spec, 3D model status, and costs.
 */
function formatFullResponse(spec: any, generate: any, analysis: any): string {
  const lines = [
    `✅ 3D Building Model Generated & Placed!`,
    ``,
    `🏠 ${spec.floors} Storey${spec.floors > 1 ? "s" : ""}${spec.basement ? " + Basement" : ""} • Style: ${(spec.facade?.style || "contemporary_pakistani").replace(/_/g, " ")}`,
    `📐 Total Height: ${generate.total_height_m}m • Footprint: ${generate.building_footprint_sqm} m²`,
    `🛏️ ${spec.rooms?.bedrooms || 3} Bedrooms, ${spec.rooms?.bathrooms || 3} Bathrooms`,
    `🚗 ${spec.parking?.cars || 1} Car Parking (${spec.parking?.type || "covered"})`,
  ];

  if (spec.rooftopTerrace) lines.push(`🌇 Rooftop Terrace`);
  if (spec.facade?.hasBalcony) lines.push(`🏛️ Balcony`);
  if (spec.facade?.hasJali) lines.push(`🪟 Traditional Jali Screen`);
  if (spec.rooms?.drawingRoom) lines.push(`🛋️ Drawing Room`);

  if (analysis?.cost_estimate?.total) {
    const total = analysis.cost_estimate.total;
    const formattedTotal =
      total >= 10000000
        ? `PKR ${(total / 10000000).toFixed(2)} Crore`
        : `PKR ${(total / 100000).toFixed(2)} Lakh`;
    lines.push(``);
    lines.push(`💰 Estimated Cost: ${formattedTotal}`);
  }

  lines.push(``);
  lines.push(`⚖️ Preliminary check — not legal or regulatory approval`);

  return lines.join("\n");
}


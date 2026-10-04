"use client";

import { useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import type { CesiumGlobeRef, MapStyleKey } from "@/components/CesiumGlobe";
import PlotSelector, { type PlotPresetKey } from "@/components/PlotSelector";
import BuildingAnalysisHUD from "@/components/BuildingAnalysisHUD";

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
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>GeoBuild AI</h1>
          <p className="subtitle">AI-Powered 3D Development Platform</p>
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

        {/* Plot Selector Widget */}
        <div style={{ padding: "0 16px 12px 16px" }}>
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
        </div>

        <div className="sidebar-content">
          <div className="chat-panel">
            <div className="chat-messages">
              {messages.length === 0 ? (
                <div className="welcome-screen">
                  <div className="welcome-icon">🏗️</div>
                  <h2 className="welcome-title">Design Your Building</h2>
                  <p className="welcome-description">
                    Select a plot preset above or describe your dream building.
                    The platform generates the exact 3D building, places it on the map,
                    and validates building regulations.
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
                  background: "rgba(99, 102, 241, 0.1)",
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

            <div className="chat-input-container">
              <div className="chat-input-wrapper">
                <textarea
                  className="chat-input"
                  placeholder="Describe your building... (e.g. '5 marla ka ghar, 2 manzil, 4 kamre')"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isProcessing}
                  rows={1}
                />
                <button
                  className="chat-send-btn"
                  onClick={() => handleSend()}
                  disabled={!inputValue.trim() || isProcessing}
                  title="Send"
                >
                  {isProcessing ? "⏳" : "→"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* 3D Geospatial Globe */}
      <main className="globe-container">
        <CesiumGlobe
          ref={globeRef}
          ionToken={CESIUM_TOKEN}
          onReady={() => setGlobeReady(true)}
          onPlotDrawn={handlePlotDrawn}
          onDrawingChange={(drawing) => setIsDrawing(drawing)}
        />

        {/* Floating Map Toolbar */}
        {globeReady && (
          <div className="floating-toolbar">
            <button
              className={`toolbar-btn ${cameraMode === "2d" ? "active" : ""}`}
              title={cameraMode === "2d" ? "Switch to 3D Perspective" : "Switch to 2D Top-Down CAD View"}
              onClick={() => handleToggleCameraMode(cameraMode === "2d" ? "3d" : "2d")}
            >
              {cameraMode === "2d" ? "📐" : "🌐"}
            </button>
            <button
              className={`toolbar-btn ${mapStyle === "studio" ? "active" : ""}`}
              title={mapStyle === "studio" ? "Back to Satellite Map" : "Switch to 3D Architectural Studio"}
              onClick={() => handleSelectMapStyle(mapStyle === "studio" ? "google_satellite" : "studio")}
            >
              🏛️
            </button>
            <button
              className={`toolbar-btn ${isDrawing ? "active" : ""}`}
              title={isDrawing ? "Drawing mode active" : "Draw Plot on Map"}
              onClick={() => {
                if (isDrawing) {
                  globeRef.current?.cancelDrawingPlot();
                } else {
                  globeRef.current?.startDrawingPlot();
                }
              }}
            >
              ✏️
            </button>
            {latestAnalysis && (
              <button
                className="toolbar-btn"
                title="Focus 3D Building"
                onClick={() => globeRef.current?.flyToBuilding()}
              >
                🎥
              </button>
            )}
            {latestAnalysis && (
              <button
                className={`toolbar-btn ${isOrbiting ? "active" : ""}`}
                title="360° Cinematic Orbit"
                onClick={toggleOrbitMode}
              >
                🔄
              </button>
            )}
            <button
              className="toolbar-btn"
              title="Toggle Sun Shadows"
              onClick={() => globeRef.current?.toggleShadows()}
            >
              ☀️
            </button>
            <button
              className="toolbar-btn"
              title="Reset View to City"
              onClick={() => handleCityChange(selectedCity)}
            >
              🏙️
            </button>
          </div>
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


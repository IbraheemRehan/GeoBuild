"use client";

import { useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import type { CesiumGlobeRef } from "@/components/CesiumGlobe";

// Dynamic import — CesiumJS cannot run on the server
const CesiumGlobe = dynamic(() => import("@/components/CesiumGlobe"), {
  ssr: false,
  loading: () => (
    <div className="cesium-loading-overlay">
      <div className="cesium-loading-spinner" />
      <p>Preparing 3D engine...</p>
    </div>
  ),
});

const CESIUM_TOKEN = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN || "";

// City coordinates
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

export default function HomePage() {
  const globeRef = useRef<CesiumGlobeRef>(null);
  const [selectedCity, setSelectedCity] = useState<CityKey>("lahore");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [globeReady, setGlobeReady] = useState(false);

  const handleCityChange = useCallback(
    (city: CityKey) => {
      setSelectedCity(city);
      const coords = CITIES[city];
      globeRef.current?.flyTo(coords.lng, coords.lat, 15000);
    },
    []
  );

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

      try {
        // Call AI service
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_AI_SERVICE_URL || "http://localhost:8000"}/api/v1/interpret`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt,
              city: selectedCity,
            }),
          }
        );

        if (!res.ok) throw new Error(`AI service error: ${res.status}`);

        const data = await res.json();

        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: formatSpec(data),
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);

        // Show assumptions if any
        if (data.assumptions?.length > 0) {
          const sysMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: "system",
            content: `💡 ${data.assumptions.join(" • ")}`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, sysMsg]);
        }
      } catch (err) {
        // Fallback: show a helpful error
        const errorMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "system",
          content: `⚠️ AI service is not running. Start it with: cd apps/ai-service && uvicorn main:app --reload --port 8000`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsProcessing(false);
      }
    },
    [inputValue, selectedCity]
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

        <div className="sidebar-content">
          <div className="chat-panel">
            <div className="chat-messages">
              {messages.length === 0 ? (
                <div className="welcome-screen">
                  <div className="welcome-icon">🏗️</div>
                  <h2 className="welcome-title">Design Your Building</h2>
                  <p className="welcome-description">
                    Select a plot on the map and describe your dream building.
                    I&apos;ll generate a 3D visualization with full analysis.
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
                  >
                    {msg.content}
                  </div>
                ))
              )}
            </div>

            <div className="chat-input-container">
              <div className="chat-input-wrapper">
                <textarea
                  className="chat-input"
                  placeholder="Describe your building... (e.g., 'modern 2-storey house with 4 bedrooms')"
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

      {/* Globe */}
      <main className="globe-container">
        <CesiumGlobe
          ref={globeRef}
          ionToken={CESIUM_TOKEN}
          onReady={() => setGlobeReady(true)}
        />

        {/* Floating toolbar */}
        {globeReady && (
          <div className="floating-toolbar">
            <button
              className="toolbar-btn"
              title="Draw Plot"
              onClick={() => {
                /* TODO: Enable polygon drawing */
              }}
            >
              ✏️
            </button>
            <button
              className="toolbar-btn"
              title="Toggle Buildings"
              onClick={() => {
                /* TODO: Toggle OSM buildings */
              }}
            >
              🏢
            </button>
            <button
              className="toolbar-btn"
              title="Sun Position"
              onClick={() => {
                /* TODO: Sun/shadow slider */
              }}
            >
              ☀️
            </button>
            <button
              className="toolbar-btn"
              title="Reset View"
              onClick={() =>
                handleCityChange(selectedCity)
              }
            >
              🔄
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

/**
 * Format a BuildingSpec response into readable text.
 */
function formatSpec(data: any): string {
  const spec = data.spec;
  if (!spec) return "Received response but no spec was generated.";

  const lines = [
    `✅ Building Specification Generated:`,
    ``,
    `🏠 ${spec.floors} Floor${spec.floors > 1 ? "s" : ""}${spec.basement ? " + Basement" : ""}`,
    `🛏️ ${spec.rooms?.bedrooms || "?"} Bedrooms, ${spec.rooms?.bathrooms || "?"} Bathrooms`,
    `🚗 ${spec.parking?.cars || 0} Car Parking (${spec.parking?.type || "covered"})`,
    `📐 Floor Height: ${spec.floorHeightM || 3.05}m`,
    `🎨 Style: ${(spec.facade?.style || "contemporary_pakistani").replace(/_/g, " ")}`,
  ];

  if (spec.rooftopTerrace) lines.push(`🌇 Rooftop Terrace`);
  if (spec.facade?.hasJali) lines.push(`🪟 Jali Screens`);
  if (spec.facade?.hasBalcony) lines.push(`🏛️ Balcony`);
  if (spec.rooms?.servantQuarter) lines.push(`🏠 Servant Quarter`);
  if (spec.rooms?.drawingRoom) lines.push(`🛋️ Drawing Room`);

  return lines.join("\n");
}

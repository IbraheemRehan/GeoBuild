"use client";

import {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";

// Cesium types
import type {
  Viewer as CesiumViewer,
  Entity,
  Cartesian3,
} from "cesium";

export interface CesiumGlobeRef {
  viewer: CesiumViewer | null;
  flyTo: (lng: number, lat: number, height?: number) => void;
}

interface CesiumGlobeProps {
  ionToken: string;
  onReady?: (viewer: CesiumViewer) => void;
  onPlotDrawn?: (coordinates: number[][]) => void;
  className?: string;
}

const CesiumGlobe = forwardRef<CesiumGlobeRef, CesiumGlobeProps>(
  ({ ionToken, onReady, onPlotDrawn, className }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<CesiumViewer | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
      viewer: viewerRef.current,
      flyTo: (lng: number, lat: number, height = 2000) => {
        if (viewerRef.current) {
          const Cesium = (window as any).Cesium;
          viewerRef.current.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(lng, lat, height),
            duration: 2.0,
          });
        }
      },
    }));

    useEffect(() => {
      let viewer: CesiumViewer | null = null;

      const initCesium = async () => {
        try {
          // Dynamic import — Cesium must not run on the server
          const Cesium = await import("cesium");

          // Set the base URL for Cesium workers and assets
          (window as any).CESIUM_BASE_URL = "/cesium";

          // Set the default access token
          Cesium.Ion.defaultAccessToken = ionToken;

          if (!containerRef.current) return;

          viewer = new Cesium.Viewer(containerRef.current, {
            terrain: Cesium.Terrain.fromWorldTerrain(),
            baseLayerPicker: false,
            geocoder: false,
            homeButton: false,
            sceneModePicker: false,
            navigationHelpButton: false,
            animation: false,
            timeline: false,
            fullscreenButton: false,
            vrButton: false,
            infoBox: true,
            selectionIndicator: true,
            shadows: true,
            shouldAnimate: true,
          });

          viewerRef.current = viewer;

          // Add Cesium OSM Buildings (free with community tier)
          try {
            const osmBuildingsTileset = await Cesium.createOsmBuildingsAsync();
            viewer.scene.primitives.add(osmBuildingsTileset);
          } catch (e) {
            console.warn("Could not load OSM Buildings:", e);
          }

          // Fly to Lahore, Pakistan
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(
              74.3587,  // Lahore longitude
              31.5204,  // Lahore latitude
              15000     // Height in meters
            ),
            orientation: {
              heading: Cesium.Math.toRadians(0),
              pitch: Cesium.Math.toRadians(-45),
              roll: 0,
            },
            duration: 3.0,
          });

          // Enable depth testing against terrain
          viewer.scene.globe.depthTestAgainstTerrain = true;

          // Performance settings
          viewer.scene.fog.enabled = true;
          viewer.scene.globe.enableLighting = true;

          setIsLoading(false);
          onReady?.(viewer);
        } catch (err) {
          console.error("Failed to initialize Cesium:", err);
          setError(
            err instanceof Error ? err.message : "Failed to load 3D globe"
          );
          setIsLoading(false);
        }
      };

      initCesium();

      return () => {
        if (viewer && !viewer.isDestroyed()) {
          viewer.destroy();
        }
        viewerRef.current = null;
      };
    }, [ionToken]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
      <div className={`cesium-globe-container ${className || ""}`}>
        {isLoading && (
          <div className="cesium-loading-overlay">
            <div className="cesium-loading-spinner" />
            <p>Loading 3D Globe...</p>
          </div>
        )}
        {error && (
          <div className="cesium-error-overlay">
            <div className="cesium-error-icon">⚠️</div>
            <h3>Globe Error</h3>
            <p>{error}</p>
            <p className="cesium-error-hint">
              Check your Cesium Ion token in .env
            </p>
          </div>
        )}
        <div ref={containerRef} className="cesium-viewer-container" />
      </div>
    );
  }
);

CesiumGlobe.displayName = "CesiumGlobe";
export default CesiumGlobe;

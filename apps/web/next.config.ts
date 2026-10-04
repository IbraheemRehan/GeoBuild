import type { NextConfig } from "next";
import CopyWebpackPlugin from "copy-webpack-plugin";
import path from "path";

const cesiumSource = path.join(
  path.dirname(require.resolve("cesium")),
  ".."
);

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Copy Cesium static assets to public directory
      config.plugins.push(
        new CopyWebpackPlugin({
          patterns: [
            {
              from: path.join(cesiumSource, "Build/Cesium/Workers"),
              to: "../public/cesium/Workers",
            },
            {
              from: path.join(cesiumSource, "Build/Cesium/ThirdParty"),
              to: "../public/cesium/ThirdParty",
            },
            {
              from: path.join(cesiumSource, "Build/Cesium/Assets"),
              to: "../public/cesium/Assets",
            },
            {
              from: path.join(cesiumSource, "Build/Cesium/Widgets"),
              to: "../public/cesium/Widgets",
            },
          ],
        })
      );

      // Define Cesium base URL
      config.plugins.push(
        new (require("webpack")).DefinePlugin({
          CESIUM_BASE_URL: JSON.stringify("/cesium"),
        })
      );
    }
    return config;
  },
  // Allow loading of Cesium workers
  async headers() {
    return [
      {
        source: "/cesium/:path*",
        headers: [
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

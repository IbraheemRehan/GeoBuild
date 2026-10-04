import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GeoBuild AI — AI-Powered 3D Real Estate Platform",
  description:
    "Visualize and evaluate property developments with AI-powered 3D modeling on real-world maps. Design buildings with natural language in Lahore, Islamabad, and Karachi.",
  keywords: [
    "real estate",
    "3D visualization",
    "AI architecture",
    "Pakistan property",
    "CesiumJS",
    "geospatial",
    "building design",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

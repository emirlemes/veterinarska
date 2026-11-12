import type { Metadata } from "next";
import type { Viewport } from "next";
import { PwaStatus } from "@/components/pwa/pwa-status";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "VetCare | Veterinarski sistem",
    template: "%s | VetCare",
  },
  description: "Sistem za upravljanje veterinarskom ambulantom.",
  applicationName: "VetCare",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "VetCare",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#2e7658",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bs">
      <body className="m-0 scheme-light bg-canvas font-sans text-sm text-ink antialiased">
        <PwaStatus />
        {children}
      </body>
    </html>
  );
}

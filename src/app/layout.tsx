import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/sonner";
import { PwaRegister } from "@/components/shell/pwa-register";
import { PRODUCT_NAME } from "@/lib/config";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: PRODUCT_NAME,
    template: `%s · ${PRODUCT_NAME}`,
  },
  description:
    "Sube la grabación de la reunión y ten las tareas, las decisiones y los correos de seguimiento listos antes de servirte un café.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: PRODUCT_NAME },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1c22" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
        <PwaRegister />
      </body>
    </html>
  );
}

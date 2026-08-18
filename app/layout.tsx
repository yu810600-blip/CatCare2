import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "貓貓輕生活 | 瘦瘦針健康追蹤",
  description: "以溫柔可愛的方式，紀錄身體數值、每日狀況、飲食、運動與施打提醒。",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon.svg", apple: "/icon-192.png" },
  appleWebApp: { capable: true, title: "貓貓輕生活", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#f6b8c4",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}

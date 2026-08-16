import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "貓貓輕生活 | 瘦瘦針健康追蹤",
  description: "以溫柔可愛的方式，紀錄身體數值、每日狀況、飲食、運動與施打提醒。",
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

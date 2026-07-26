import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BÃI XE MINH PHÚC",
  description: "Hệ thống quản lý xe gửi, rửa xe, dịch vụ và thu chi của Bãi xe Minh Phúc.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}

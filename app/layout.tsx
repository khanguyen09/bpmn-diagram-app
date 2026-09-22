import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "BPMN Studio", template: "%s · BPMN Studio" },
  description: "Vẽ, kiểm tra và quản lý quy trình BPMN với lịch sử phiên bản và xuất nhập sơ đồ.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <a className="skip-link" href="#main-content">Bỏ qua đến nội dung chính</a>
        {children}
      </body>
    </html>
  );
}

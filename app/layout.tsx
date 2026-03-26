import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VergabeDashboard - Rahmen & Beleuchtung",
  description: "Tagesaktuelle deutsche Vergaben und Ausschreibungen für die Rahmen- und Beleuchtungsbranche",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}

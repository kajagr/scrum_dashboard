import type { Metadata } from "next";
// @ts-expect-error lalal
import "./globals.css";

export const metadata: Metadata = {
  title: "ScrumBoard",
  description: "Scrum project management dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sl">
      <body className="min-h-screen bg-gray-50">
        {children}
      </body>
    </html>
  );
}
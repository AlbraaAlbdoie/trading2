import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "NEXUS ALPHA | ماسح السيولة الذكي للأسواق المالية",
  description:
    "لوحة تحكم وتحليل مالي فورية للكريبتو (العقود الآجلة والفورية) والذهب (XAU/USD) مدعومة بمحرك ذكاء اصطناعي فائق الدقة.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${cairo.variable} font-sans h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-[#080C14] text-[#E2E8F0] font-sans selection:bg-[#8B5CF6]/30 selection:text-white">
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Instrument_Serif, Plus_Jakarta_Sans, IBM_Plex_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  weight: "400",
  subsets: ["latin", "latin-ext"],
  variable: "--font-serif",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin", "latin-ext"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "VEZOLLA | Zarafet İçten Başlar",
    template: "%s | VEZOLLA",
  },
  description:
    "Vezolla - Zarafeti gösterişte değil incelikte arayan seçkin giyim markası. Akışkan kumaş kıvrımı amblemi ve yüksek kontrastlı zamansız şıklık.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      className={`${plusJakarta.variable} ${instrumentSerif.variable} ${plexMono.variable}`}
    >
      <body className="font-[family-name:var(--font-sans)] antialiased">
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}

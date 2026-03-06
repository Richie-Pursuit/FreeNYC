import "./globals.css";
import SiteFooter from "@/components/SiteFooter";
import { Permanent_Marker } from "next/font/google";

const logoFont = Permanent_Marker({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-logo",
  display: "swap",
});

export const metadata = {
  metadataBase: (() => {
    try {
      return new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000");
    } catch {
      return new URL("http://localhost:3000");
    }
  })(),
  title: {
    default: "Street Photography Portfolio",
    template: "%s | Street Photography Portfolio",
  },
  description: "Minimalist Leica-style digital gallery exhibition.",
  keywords: [
    "street photography",
    "nyc photography",
    "photo portfolio",
    "leica style",
    "free nyc",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Free NYC",
    title: "Street Photography Portfolio",
    description: "Minimalist Leica-style digital gallery exhibition.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Street Photography Portfolio",
    description: "Minimalist Leica-style digital gallery exhibition.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={logoFont.variable}>
      <body className="antialiased">
        <div className="flex min-h-screen flex-col">
          <div className="flex-1">{children}</div>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}

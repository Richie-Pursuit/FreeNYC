import "./globals.css";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import SiteThemeController from "@/components/SiteThemeController";
import {
  Bebas_Neue,
  Black_Ops_One,
  Bungee,
  Permanent_Marker,
  Righteous,
} from "next/font/google";
import { siteBrand } from "@/lib/siteBrand";
import { getSiteSettingsSafe } from "@/lib/siteSettingsStore";
import { getSiteSettingsCssVariables, normalizeSiteSettings } from "@/lib/siteSettings";

const logoFont = Permanent_Marker({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-logo",
  display: "swap",
});

const bebasFont = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
  display: "swap",
});

const bungeeFont = Bungee({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bungee",
  display: "swap",
});

const blackOpsFont = Black_Ops_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-black-ops",
  display: "swap",
});

const righteousFont = Righteous({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-righteous",
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
  keywords: siteBrand.keywords,
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico" },
    ],
    shortcut: "/icon.svg",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: siteBrand.name,
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

export default async function RootLayout({ children }) {
  const siteSettings = normalizeSiteSettings(await getSiteSettingsSafe());
  const themeKey = siteSettings.themeKey;
  const themeStyle = getSiteSettingsCssVariables(siteSettings);

  return (
    <html
      lang="en"
      className={`${logoFont.variable} ${bebasFont.variable} ${bungeeFont.variable} ${blackOpsFont.variable} ${righteousFont.variable}`}
      data-site-theme={themeKey}
      style={themeStyle}
    >
      <body className="antialiased">
        <SiteThemeController initialSettings={siteSettings} />
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <div className="flex min-h-screen flex-col">
          <Navbar initialSettings={siteSettings} />
          <div className="flex-1">{children}</div>
          <SiteFooter initialSettings={siteSettings} />
        </div>
      </body>
    </html>
  );
}

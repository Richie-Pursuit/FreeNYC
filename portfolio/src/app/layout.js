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
  title: "Street Photography Portfolio",
  description: "Minimalist Leica-style digital gallery exhibition.",
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

import "./globals.css";

export const metadata = {
  title: "Street Photography Portfolio",
  description: "Minimalist Leica-style digital gallery exhibition.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

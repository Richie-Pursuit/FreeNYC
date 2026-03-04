import Link from "next/link";

const navLinks = [
  { label: "Gallery", href: "/gallery" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Admin", href: "/admin" },
];

export default function Navbar() {
  return (
    <header className="border-b border-line px-4 py-5 sm:px-8 lg:px-12">
      <div className="mx-auto flex w-full max-w-[1800px] items-center justify-between">
        <Link
          href="/"
          className="display-font text-lg tracking-[0.2em] text-foreground uppercase"
        >
          Free NYC
        </Link>

        <nav className="flex items-center gap-4 sm:gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[11px] tracking-[0.18em] text-muted uppercase transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

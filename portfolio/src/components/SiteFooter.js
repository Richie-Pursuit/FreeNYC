import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="border-t border-line px-4 py-7 sm:px-8 lg:px-12">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col items-start gap-3 text-[11px] tracking-[0.16em] text-muted uppercase sm:flex-row sm:items-center sm:justify-between sm:tracking-[0.18em]">
        <a href="https://instagram.com" target="_blank" rel="noreferrer">
          Instagram
        </a>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/contact">Contact</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </div>
        <p>© {new Date().getFullYear()} Free NYC</p>
      </div>
    </footer>
  );
}

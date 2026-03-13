import Link from "next/link";

export const metadata = {
  title: "404 - Page Not Found",
};

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-background">
      <main
        id="main-content"
        className="motion-page-enter mx-auto flex w-full max-w-4xl flex-col items-center px-4 py-16 text-center sm:px-8 sm:py-20"
      >
        <p className="text-[12px] font-semibold tracking-[0.18em] text-foreground/70 uppercase">
          Error 404
        </p>
        <h1 className="display-font mt-3 text-5xl leading-none text-foreground sm:text-7xl">
          Page Not Found
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-foreground/82 sm:text-lg">
          The page you requested does not exist or may have been moved.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:mt-10 sm:gap-4">
          <Link
            href="/"
            className="theme-primary-button min-h-11 border px-5 py-3 text-[12px] font-semibold tracking-[0.14em] uppercase transition-opacity hover:opacity-90"
          >
            Back To Home
          </Link>
          <Link
            href="/gallery"
            className="theme-secondary-button min-h-11 border px-5 py-3 text-[12px] font-semibold tracking-[0.14em] uppercase transition-colors"
          >
            Open Gallery
          </Link>
          <Link
            href="/contact"
            className="theme-secondary-button min-h-11 border px-5 py-3 text-[12px] font-semibold tracking-[0.14em] uppercase transition-colors"
          >
            Contact
          </Link>
        </div>
      </main>
    </div>
  );
}

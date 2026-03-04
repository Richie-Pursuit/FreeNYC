import Link from "next/link";
import Navbar from "@/components/Navbar";
import PhotoGallery from "@/components/PhotoGallery";
import { samplePhotos } from "@/lib/samplePhotos";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="px-4 pb-14 sm:px-8 sm:pb-16 lg:px-12">
        <section className="mx-auto w-full max-w-[1800px] py-6 sm:py-8">
          <PhotoGallery photos={samplePhotos} layout="cinematic" eagerCount={3} />
        </section>
      </main>

      <footer className="border-t border-line px-4 py-7 sm:px-8 lg:px-12">
        <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-3 text-[11px] tracking-[0.18em] text-muted uppercase sm:flex-row sm:items-center sm:justify-between">
          <a href="https://instagram.com" target="_blank" rel="noreferrer">
            Instagram
          </a>
          <Link href="/contact">Contact</Link>
          <p>© {new Date().getFullYear()} Free NYC</p>
        </div>
      </footer>
    </div>
  );
}

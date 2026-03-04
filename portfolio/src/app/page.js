import Link from "next/link";
import Navbar from "@/components/Navbar";
import PhotoGallery from "@/components/PhotoGallery";
import { listPhotos } from "@/lib/photoStore";
import { samplePhotos } from "@/lib/samplePhotos";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let photos = samplePhotos;

  try {
    const result = await listPhotos({ limit: 300, sort: "manual" });
    photos = result.photos;
  } catch {
    photos = samplePhotos;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="px-4 pb-14 sm:px-8 sm:pb-16 lg:px-12">
        <section className="mx-auto w-full max-w-[1800px] py-6 sm:py-8">
          <PhotoGallery photos={photos} layout="cinematic" eagerCount={3} />
        </section>
      </main>

      <footer className="border-t border-line px-4 py-7 sm:px-8 lg:px-12">
        <div className="mx-auto flex w-full max-w-[1800px] flex-col items-start gap-3 text-[11px] tracking-[0.16em] text-muted uppercase sm:flex-row sm:items-center sm:justify-between sm:tracking-[0.18em]">
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

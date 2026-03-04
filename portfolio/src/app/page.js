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
    </div>
  );
}

import PhotoGallery from "@/components/PhotoGallery";
import { listPhotos } from "@/lib/photoStore";
import { samplePhotos } from "@/lib/samplePhotos";

export const metadata = {
  title: "Gallery",
};

export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  let photos = samplePhotos;

  try {
    const result = await listPhotos({ limit: 300, sort: "manual" });
    photos = result.photos;
  } catch {
    photos = samplePhotos;
  }

  return (
    <div className="min-h-screen bg-background">
      <main
        id="main-content"
        className="motion-page-enter mx-auto w-full max-w-[1800px] px-4 py-10 sm:px-8 lg:px-12"
      >
        <PhotoGallery photos={photos} layout="masonry" showFilters />
      </main>
    </div>
  );
}

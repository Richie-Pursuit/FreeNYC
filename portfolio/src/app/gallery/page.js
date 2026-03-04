import Navbar from "@/components/Navbar";
import PhotoGallery from "@/components/PhotoGallery";
import { samplePhotos } from "@/lib/samplePhotos";

export const metadata = {
  title: "Gallery | Street Photography Portfolio",
};

export default function GalleryPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto w-full max-w-[1800px] px-4 py-10 sm:px-8 lg:px-12">
        <PhotoGallery photos={samplePhotos} layout="masonry" showFilters />
      </main>
    </div>
  );
}

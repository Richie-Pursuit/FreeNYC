import Navbar from "@/components/Navbar";
import PhotoGridSkeleton from "@/components/PhotoGridSkeleton";

export default function GalleryLoading() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main id="main-content" className="mx-auto w-full max-w-[1800px] px-4 py-10 sm:px-8 lg:px-12">
        <PhotoGridSkeleton count={9} />
      </main>
    </div>
  );
}

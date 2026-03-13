import PhotoGridSkeleton from "@/components/PhotoGridSkeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <main id="main-content" className="px-4 pb-14 sm:px-8 sm:pb-16 lg:px-12">
        <section className="mx-auto w-full max-w-[1800px] py-6 sm:py-8">
          <PhotoGridSkeleton count={9} />
        </section>
      </main>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import PhotoGrid from "@/components/PhotoGrid";
import LightboxViewer from "@/components/LightboxViewer";

export default function PhotoGallery({
  photos,
  layout = "cinematic",
  showFilters = false,
  eagerCount = 0,
}) {
  const [activeCollection, setActiveCollection] = useState("All");
  const [activeIndex, setActiveIndex] = useState(null);

  const collections = useMemo(() => {
    return ["All", ...new Set(photos.map((photo) => photo.collection))];
  }, [photos]);

  const visiblePhotos = useMemo(() => {
    if (activeCollection === "All") {
      return photos;
    }

    return photos.filter((photo) => photo.collection === activeCollection);
  }, [photos, activeCollection]);

  const activePhoto = useMemo(() => {
    if (activeIndex === null) {
      return null;
    }

    return visiblePhotos[activeIndex] || null;
  }, [activeIndex, visiblePhotos]);

  const handleOpen = (index) => setActiveIndex(index);
  const handleClose = () => setActiveIndex(null);

  const handlePrevious = () => {
    setActiveIndex((current) => {
      if (current === null || visiblePhotos.length === 0) {
        return current;
      }

      return (current - 1 + visiblePhotos.length) % visiblePhotos.length;
    });
  };

  const handleNext = () => {
    setActiveIndex((current) => {
      if (current === null || visiblePhotos.length === 0) {
        return current;
      }

      return (current + 1) % visiblePhotos.length;
    });
  };

  const handleCollectionChange = (collection) => {
    setActiveCollection(collection);
    setActiveIndex(null);
  };

  return (
    <>
      {showFilters ? (
        <div className="mb-6 flex flex-wrap gap-2 sm:mb-8 sm:gap-3">
          {collections.map((collection) => {
            const isActive = collection === activeCollection;

            return (
              <button
                key={collection}
                type="button"
                onClick={() => handleCollectionChange(collection)}
                className={`border px-4 py-2.5 text-[11px] tracking-[0.14em] uppercase transition-colors sm:py-2 ${
                  isActive
                    ? "border-foreground bg-foreground text-background"
                    : "border-line text-muted hover:border-foreground hover:text-foreground"
                }`}
              >
                {collection}
              </button>
            );
          })}
        </div>
      ) : null}

      <PhotoGrid
        photos={visiblePhotos}
        onOpen={handleOpen}
        layout={layout}
        eagerCount={eagerCount}
      />

      <LightboxViewer
        photo={activePhoto}
        onClose={handleClose}
        onPrevious={handlePrevious}
        onNext={handleNext}
      />
    </>
  );
}

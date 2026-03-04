"use client";

import { useEffect, useMemo, useState } from "react";
import PhotoGrid from "@/components/PhotoGrid";
import LightboxViewer from "@/components/LightboxViewer";

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

export default function PhotoGallery({
  photos,
  layout = "cinematic",
  showFilters = false,
  eagerCount = 0,
  enableLoadMore = false,
  initialDesktopCount = 12,
  loadMoreDesktopCount = 12,
  initialMobileCount = 8,
  loadMoreMobileCount = 8,
}) {
  const [activeCollection, setActiveCollection] = useState("All");
  const [activeIndex, setActiveIndex] = useState(null);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.matchMedia("(max-width: 640px)").matches;
  });
  const [extraVisibleCount, setExtraVisibleCount] = useState(0);
  const safePhotos = useMemo(() => (Array.isArray(photos) ? photos : []), [photos]);

  const collections = useMemo(() => {
    return ["All", ...new Set(safePhotos.map((photo) => photo.collection).filter(Boolean))];
  }, [safePhotos]);

  const visiblePhotos = useMemo(() => {
    if (activeCollection === "All") {
      return safePhotos;
    }

    return safePhotos.filter((photo) => photo.collection === activeCollection);
  }, [safePhotos, activeCollection]);

  const initialCount = toPositiveInt(
    isMobile ? initialMobileCount : initialDesktopCount,
    isMobile ? 8 : 12,
  );
  const loadMoreCount = toPositiveInt(
    isMobile ? loadMoreMobileCount : loadMoreDesktopCount,
    isMobile ? 8 : 12,
  );
  const visibleCount = initialCount + extraVisibleCount;

  const displayedPhotos = useMemo(() => {
    if (!enableLoadMore) {
      return visiblePhotos;
    }

    return visiblePhotos.slice(0, visibleCount);
  }, [enableLoadMore, visibleCount, visiblePhotos]);

  const activePhoto = useMemo(() => {
    if (activeIndex === null) {
      return null;
    }

    return displayedPhotos[activeIndex] || null;
  }, [activeIndex, displayedPhotos]);

  const handleOpen = (index) => {
    if (!Number.isInteger(index) || index < 0 || index >= displayedPhotos.length) {
      return;
    }

    setActiveIndex(index);
  };
  const handleClose = () => setActiveIndex(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 640px)");
    const handleMediaChange = (event) => setIsMobile(event.matches);

    mediaQuery.addEventListener("change", handleMediaChange);

    return () => mediaQuery.removeEventListener("change", handleMediaChange);
  }, []);

  const handlePrevious = () => {
    setActiveIndex((current) => {
      if (current === null || displayedPhotos.length === 0) {
        return current;
      }

      return (current - 1 + displayedPhotos.length) % displayedPhotos.length;
    });
  };

  const handleNext = () => {
    setActiveIndex((current) => {
      if (current === null || displayedPhotos.length === 0) {
        return current;
      }

      return (current + 1) % displayedPhotos.length;
    });
  };

  const handleCollectionChange = (collection) => {
    setActiveCollection(collection);
    setExtraVisibleCount(0);
    setActiveIndex(null);
  };

  const handleLoadMore = () => {
    setExtraVisibleCount((current) => current + loadMoreCount);
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
        photos={displayedPhotos}
        onOpen={handleOpen}
        layout={layout}
        eagerCount={eagerCount}
      />

      {enableLoadMore && displayedPhotos.length < visiblePhotos.length ? (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={handleLoadMore}
            className="border border-foreground bg-white px-6 py-3 text-[11px] tracking-[0.16em] uppercase transition-colors hover:bg-foreground hover:text-background"
          >
            Load More
          </button>
        </div>
      ) : null}

      <LightboxViewer
        photo={activePhoto}
        onClose={handleClose}
        onPrevious={handlePrevious}
        onNext={handleNext}
      />
    </>
  );
}

"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import PhotoGrid from "@/components/PhotoGrid";
import LightboxViewer from "@/components/LightboxViewer";

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

const MOBILE_MEDIA_QUERY = "(max-width: 640px)";

function subscribeToMobileQuery(callback) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
  const handleChange = () => callback();
  mediaQuery.addEventListener("change", handleChange);

  return () => {
    mediaQuery.removeEventListener("change", handleChange);
  };
}

function getMobileSnapshot() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
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
  const [extraVisibleCount, setExtraVisibleCount] = useState(0);
  const isMobile = useSyncExternalStore(
    subscribeToMobileQuery,
    getMobileSnapshot,
    () => false,
  );
  const safePhotos = useMemo(() => {
    const incoming = Array.isArray(photos) ? photos : [];
    return incoming.filter(
      (item) => typeof item?.imageUrl === "string" && item.imageUrl.trim(),
    );
  }, [photos]);

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

  const handleSelect = (index) => {
    if (!Number.isInteger(index) || index < 0 || index >= displayedPhotos.length) {
      return;
    }

    setActiveIndex(index);
  };

  const handleClose = () => setActiveIndex(null);

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
        <div
          className="-mx-1 mb-5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:mb-8 sm:overflow-visible sm:px-0 sm:pb-0"
          role="toolbar"
          aria-label="Filter photos by collection"
        >
          <div className="flex min-w-max gap-2 sm:flex-wrap sm:gap-2.5">
            {collections.map((collection) => {
              const isActive = collection === activeCollection;

              return (
                <button
                  key={collection}
                  type="button"
                  onClick={() => handleCollectionChange(collection)}
                  aria-pressed={isActive}
                  className={`min-h-10 whitespace-nowrap border px-3.5 py-2 text-[11px] tracking-[0.11em] uppercase transition-colors sm:min-h-11 sm:px-4 sm:text-[12px] ${
                    isActive
                      ? "theme-primary-button"
                      : "theme-secondary-button"
                  }`}
                >
                  {collection}
                </button>
              );
            })}
          </div>
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
            className="theme-primary-button min-h-11 border px-6 py-3 text-[12px] tracking-[0.14em] uppercase transition-colors"
          >
            Load More
          </button>
        </div>
      ) : null}

      <LightboxViewer
        isOpen={activeIndex !== null}
        photo={activePhoto}
        photos={displayedPhotos}
        activeIndex={activeIndex}
        onSelect={handleSelect}
        onClose={handleClose}
        onPrevious={handlePrevious}
        onNext={handleNext}
      />
    </>
  );
}

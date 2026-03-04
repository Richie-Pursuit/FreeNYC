"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";

const BLUR_DATA_URL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
const THUMBNAIL_WINDOW_SIZE = 10;

function ArrowIcon({ direction = "left" }) {
  const isLeft = direction === "left";

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 sm:h-6 sm:w-6"
      aria-hidden="true"
    >
      {isLeft ? (
        <path d="m15 18-6-6 6-6" />
      ) : (
        <path d="m9 18 6-6-6-6" />
      )}
    </svg>
  );
}

function getPhotoAltText(photo) {
  if (typeof photo?.alt === "string" && photo.alt.trim()) {
    return photo.alt.trim();
  }

  if (typeof photo?.title === "string" && photo.title.trim()) {
    return photo.title.trim();
  }

  if (typeof photo?.caption === "string" && photo.caption.trim()) {
    return photo.caption.trim();
  }

  if (typeof photo?.collection === "string" && photo.collection.trim()) {
    return `${photo.collection.trim()} photograph`;
  }

  return "Street photograph";
}

function toText(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function truncateText(value, maxLength = 220) {
  if (!value || value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength).trimEnd()}...`;
}

export default function LightboxViewer({
  isOpen = true,
  photo,
  photos = [],
  activeIndex = null,
  onSelect,
  onClose,
  onPrevious,
  onNext,
}) {
  const [showHelp, setShowHelp] = useState(false);
  const [showDetails, setShowDetails] = useState(true);
  const [expandedPhotoKey, setExpandedPhotoKey] = useState("");
  const touchStartRef = useRef(null);

  const safePhotos = useMemo(() => {
    const incoming = Array.isArray(photos) ? photos : [];
    const withImages = incoming.filter(
      (item) => typeof item?.imageUrl === "string" && item.imageUrl.trim(),
    );

    if (withImages.length > 0) {
      return withImages;
    }

    if (typeof photo?.imageUrl === "string" && photo.imageUrl.trim()) {
      return [photo];
    }

    return [];
  }, [photo, photos]);

  let currentIndex = -1;
  if (safePhotos.length > 0) {
    if (Number.isInteger(activeIndex) && activeIndex >= 0 && activeIndex < safePhotos.length) {
      currentIndex = activeIndex;
    } else if (photo?.photoId) {
      const indexById = safePhotos.findIndex((item) => item.photoId === photo.photoId);
      currentIndex = indexById >= 0 ? indexById : 0;
    } else {
      currentIndex = 0;
    }
  }

  const currentPhoto = currentIndex >= 0 ? safePhotos[currentIndex] : null;
  const currentPhotoKey =
    toText(currentPhoto?.photoId) || `photo-${currentIndex >= 0 ? currentIndex : "none"}`;
  const showFullText = expandedPhotoKey === currentPhotoKey;
  const titleText = toText(currentPhoto?.title) || "Untitled";
  const collectionText = toText(currentPhoto?.collection) || "Street Photography";
  const captionText = toText(currentPhoto?.caption);
  const poemText = toText(currentPhoto?.poem);
  const trimmedCaption = showFullText ? captionText : truncateText(captionText, 230);
  const trimmedPoem = showFullText ? poemText : truncateText(poemText, 180);
  const canExpandText =
    (captionText && captionText.length > 230) || (poemText && poemText.length > 180);
  const thumbnailWindow = useMemo(() => {
    if (safePhotos.length < 1 || currentIndex < 0) {
      return [];
    }

    if (safePhotos.length <= THUMBNAIL_WINDOW_SIZE) {
      return safePhotos.map((item, index) => ({ item, index }));
    }

    const maxStart = safePhotos.length - THUMBNAIL_WINDOW_SIZE;
    const start = Math.max(0, Math.min(currentIndex, maxStart));
    const end = start + THUMBNAIL_WINDOW_SIZE;

    return safePhotos.slice(start, end).map((item, offset) => ({
      item,
      index: start + offset,
    }));
  }, [currentIndex, safePhotos]);

  useEffect(() => {
    if (!isOpen || typeof document === "undefined") {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!currentPhoto?.imageUrl) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        if (typeof onClose === "function") {
          onClose();
        }
      }
      if (event.key === "ArrowLeft") {
        if (typeof onPrevious === "function") {
          onPrevious();
        }
      }
      if (event.key === "ArrowRight") {
        if (typeof onNext === "function") {
          onNext();
        }
      }
      if (event.key === "?" || (event.key === "/" && event.shiftKey)) {
        event.preventDefault();
        setShowHelp((current) => !current);
      }
      if (event.key.toLowerCase() === "i") {
        event.preventDefault();
        setShowDetails((current) => !current);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentPhoto?.imageUrl, onClose, onPrevious, onNext]);

  if (!isOpen || !currentPhoto?.imageUrl) {
    return null;
  }

  const altText = getPhotoAltText(currentPhoto);

  const handleTouchStart = (event) => {
    const touch = event.touches?.[0];
    if (!touch) {
      return;
    }

    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
    };
  };

  const handleTouchEnd = (event) => {
    const touchStart = touchStartRef.current;
    const touch = event.changedTouches?.[0];

    touchStartRef.current = null;
    if (!touchStart || !touch) {
      return;
    }

    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;

    if (Math.abs(deltaX) < 55 || Math.abs(deltaX) <= Math.abs(deltaY)) {
      return;
    }

    if (deltaX > 0) {
      if (typeof onPrevious === "function") {
        onPrevious();
      }
      return;
    }

    if (typeof onNext === "function") {
      onNext();
    }
  };

  const content = (
    <div className="fixed inset-0 z-50 bg-black/95 text-white">
      <div className="absolute top-4 left-3 z-20 flex items-center gap-2 sm:top-6 sm:left-5">
        <button
          type="button"
          onClick={() => setShowHelp((current) => !current)}
          className="rounded-full border border-white/25 bg-black/40 px-3 py-2 text-[10px] tracking-[0.14em] text-white/85 uppercase transition-colors hover:text-white sm:text-xs"
          aria-label="Toggle keyboard and gesture help"
        >
          ? Help
        </button>
        <button
          type="button"
          onClick={() => setShowDetails((current) => !current)}
          className="rounded-full border border-white/25 bg-black/40 px-3 py-2 text-[10px] tracking-[0.14em] text-white/85 uppercase transition-colors hover:text-white sm:text-xs"
          aria-label={showDetails ? "Hide photo details" : "Show photo details"}
        >
          {showDetails ? "Hide Info" : "Show Info"}
        </button>
      </div>

      <button
        type="button"
        onClick={() => {
          if (typeof onClose === "function") {
            onClose();
          }
        }}
        className="absolute top-4 right-3 z-10 rounded-full border border-white/20 bg-black/40 px-3 py-2 text-[10px] tracking-[0.16em] text-white/85 uppercase transition-colors hover:text-white sm:top-6 sm:right-5 sm:text-xs"
      >
        Close (ESC)
      </button>

      {showHelp ? (
        <div className="absolute top-14 left-3 z-10 w-[min(320px,calc(100vw-1.5rem))] rounded-xl border border-white/25 bg-black/70 px-4 py-3 text-xs text-white/85 backdrop-blur-sm sm:top-16 sm:left-5">
          <p className="text-[10px] tracking-[0.14em] text-white/70 uppercase">Controls</p>
          <ul className="mt-2 space-y-1.5">
            <li>`Esc` close viewer</li>
            <li>`←` previous photo</li>
            <li>`→` next photo</li>
            <li>Swipe left/right on touch devices</li>
            <li>Tap thumbnails to jump</li>
          </ul>
        </div>
      ) : null}

      <div className="relative h-full">
        <div
          className="absolute inset-0"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <Image
            src={currentPhoto.imageUrl}
            alt=""
            fill
            sizes="100vw"
            className="scale-105 object-cover object-center opacity-38 blur-2xl"
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
            priority
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-black/45" />

          <button
            type="button"
            onClick={() => {
              if (typeof onPrevious === "function") {
                onPrevious();
              }
            }}
            aria-label="Previous photo"
            className="group absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/25 bg-black/35 p-2.5 text-white/85 transition-all hover:border-white/55 hover:bg-black/60 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/40 sm:left-5 sm:p-3"
          >
            <ArrowIcon direction="left" />
          </button>

          <button
            type="button"
            onClick={() => {
              if (typeof onNext === "function") {
                onNext();
              }
            }}
            aria-label="Next photo"
            className="group absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/25 bg-black/35 p-2.5 text-white/85 transition-all hover:border-white/55 hover:bg-black/60 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/40 sm:right-5 sm:p-3"
          >
            <ArrowIcon direction="right" />
          </button>

          <div className="absolute inset-0 flex items-center justify-center p-1 sm:p-4">
            <div className="relative h-full w-full">
              <Image
                src={currentPhoto.imageUrl}
                alt={altText}
                fill
                sizes="100vw"
                className="object-contain object-center"
                placeholder="blur"
                blurDataURL={BLUR_DATA_URL}
                priority
              />
            </div>
          </div>
        </div>

        {showDetails ? (
          <footer className="pointer-events-none absolute right-0 bottom-0 left-0 z-10 flex max-h-[42vh] flex-col gap-2 overflow-y-auto bg-gradient-to-t from-black/86 via-black/52 to-transparent px-4 pt-14 pb-3 sm:px-8 sm:pt-18 sm:pb-4">
            <div className="pointer-events-none">
              <p className="display-font text-xl leading-none break-words sm:text-2xl">
                {titleText}
              </p>
              <p className="mt-2 text-[11px] tracking-[0.16em] text-white/65 uppercase">
                {collectionText}
              </p>
              {trimmedCaption ? (
                <p className="mt-2 max-w-2xl text-xs leading-5 text-white/85 break-words sm:text-sm sm:leading-6">
                  {trimmedCaption}
                </p>
              ) : null}
              {trimmedPoem ? (
                <p className="mt-1.5 max-w-2xl text-xs leading-5 text-white/75 break-words italic sm:text-sm sm:leading-6">
                  {trimmedPoem}
                </p>
              ) : null}
              {canExpandText ? (
                <button
                  type="button"
                  onClick={() => {
                    setExpandedPhotoKey((current) =>
                      current === currentPhotoKey ? "" : currentPhotoKey,
                    );
                  }}
                  className="pointer-events-auto mt-2 inline-flex rounded-full border border-white/28 bg-black/35 px-3 py-1 text-[10px] tracking-[0.14em] text-white/85 uppercase transition-colors hover:text-white"
                >
                  {showFullText ? "Less Text" : "More Text"}
                </button>
              ) : null}
            </div>

            <div className="pointer-events-none flex flex-wrap items-center justify-between gap-2 text-[10px] tracking-[0.16em] text-white/70 uppercase sm:text-[11px] sm:tracking-[0.18em]">
              <p>
                {currentIndex + 1}/{safePhotos.length} • Swipe or use ← →
              </p>
              <p>Press ? for help</p>
            </div>

            {safePhotos.length > 1 ? (
              <div className="pointer-events-auto flex items-center gap-1.5 overflow-x-auto pb-0.5">
                {thumbnailWindow.map(({ item, index }) => {
                  const isActive = index === currentIndex;
                  const thumbUrl =
                    (typeof item.thumbnailUrl === "string" && item.thumbnailUrl.trim()) ||
                    item.imageUrl;

                  return (
                    <button
                      key={item.photoId || `thumb-${index}`}
                      type="button"
                      onClick={() => {
                        if (typeof onSelect === "function") {
                          onSelect(index);
                        }
                      }}
                      className={`relative h-12 w-9 shrink-0 overflow-hidden border transition-all sm:h-14 sm:w-10 ${
                        isActive
                          ? "border-white/90 shadow-[0_0_0_2px_rgba(255,255,255,0.25)]"
                          : "border-white/30 opacity-80 hover:border-white/65 hover:opacity-100"
                      }`}
                      aria-label={`View photo ${index + 1}`}
                    >
                      <Image
                        src={thumbUrl}
                        alt={getPhotoAltText(item)}
                        fill
                        sizes="56px"
                        className="object-cover"
                        placeholder="blur"
                        blurDataURL={BLUR_DATA_URL}
                      />
                    </button>
                  );
                })}
              </div>
            ) : null}
          </footer>
        ) : (
          <div className="pointer-events-none absolute right-0 bottom-0 left-0 z-10 flex items-end justify-between gap-4 bg-gradient-to-t from-black/70 to-transparent px-4 pb-4 sm:px-8 sm:pb-6">
            <p className="text-[10px] tracking-[0.16em] text-white/70 uppercase sm:text-[11px] sm:tracking-[0.18em]">
              {currentIndex + 1}/{safePhotos.length}
            </p>
            <p className="text-[10px] tracking-[0.16em] text-white/70 uppercase sm:text-[11px] sm:tracking-[0.18em]">
              Press I for info
            </p>
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(content, document.body);
}

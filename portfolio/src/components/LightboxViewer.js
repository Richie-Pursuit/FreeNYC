"use client";

import { useEffect } from "react";
import Image from "next/image";

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

export default function LightboxViewer({
  photo,
  onClose,
  onPrevious,
  onNext,
}) {
  useEffect(() => {
    if (!photo) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
      if (event.key === "ArrowLeft") {
        onPrevious();
      }
      if (event.key === "ArrowRight") {
        onNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [photo, onClose, onPrevious, onNext]);

  if (!photo) {
    return null;
  }

  const altText = getPhotoAltText(photo);

  return (
    <div className="fixed inset-0 z-50 bg-black/95 text-white">
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-3 z-10 rounded-full border border-white/20 bg-black/40 px-3 py-2 text-[10px] tracking-[0.16em] text-white/85 uppercase transition-colors hover:text-white sm:top-6 sm:right-5 sm:text-xs"
      >
        Close (ESC)
      </button>

      <div className="flex h-full flex-col">
        <div className="relative min-h-0 flex-1">
          <button
            type="button"
            onClick={onPrevious}
            aria-label="Previous photo"
            className="group absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/25 bg-black/35 p-2.5 text-white/85 transition-all hover:border-white/55 hover:bg-black/60 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/40 sm:left-5 sm:p-3"
          >
            <ArrowIcon direction="left" />
          </button>

          <button
            type="button"
            onClick={onNext}
            aria-label="Next photo"
            className="group absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/25 bg-black/35 p-2.5 text-white/85 transition-all hover:border-white/55 hover:bg-black/60 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/40 sm:right-5 sm:p-3"
          >
            <ArrowIcon direction="right" />
          </button>

          <Image
            src={photo.imageUrl}
            alt={altText}
            fill
            sizes="100vw"
            className="object-contain"
            priority
          />
        </div>

        <footer className="flex flex-col gap-4 border-t border-white/20 px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-8 sm:py-5">
          <div>
            <p className="display-font text-2xl leading-none break-words sm:text-3xl">
              {photo.title}
            </p>
            <p className="mt-2 text-[11px] tracking-[0.16em] text-white/65 uppercase">
              {photo.collection}
            </p>
            <p className="mt-3 max-w-2xl text-xs leading-6 text-white/85 break-words sm:text-sm sm:leading-7">
              {photo.caption}
            </p>
            {photo.poem ? (
              <p className="mt-2 max-w-2xl text-xs leading-6 text-white/75 break-words italic sm:text-sm sm:leading-7">
                {photo.poem}
              </p>
            ) : null}
          </div>

          <div className="text-[10px] tracking-[0.16em] text-white/70 uppercase sm:text-[11px] sm:tracking-[0.18em]">
            Use ← and → keys
          </div>
        </footer>
      </div>
    </div>
  );
}

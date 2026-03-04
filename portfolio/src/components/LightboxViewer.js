"use client";

import { useEffect } from "react";
import Image from "next/image";

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
        className="absolute top-6 right-5 z-10 text-xs tracking-[0.18em] text-white/85 uppercase transition-colors hover:text-white"
      >
        Close (ESC)
      </button>

      <div className="flex h-full flex-col">
        <div className="relative min-h-0 flex-1">
          <Image
            src={photo.imageUrl}
            alt={altText}
            fill
            sizes="100vw"
            className="object-contain"
            priority
          />
        </div>

        <footer className="flex flex-col gap-5 border-t border-white/20 px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-8">
          <div>
            <p className="display-font text-3xl leading-none">{photo.title}</p>
            <p className="mt-2 text-[11px] tracking-[0.16em] text-white/65 uppercase">
              {photo.collection}
            </p>
            <p className="mt-3 max-w-2xl text-sm text-white/85">{photo.caption}</p>
            {photo.poem ? (
              <p className="mt-2 max-w-2xl text-sm text-white/75 italic">{photo.poem}</p>
            ) : null}
          </div>

          <div className="flex items-center gap-8 text-[11px] tracking-[0.18em] uppercase">
            <button
              type="button"
              onClick={onPrevious}
              className="text-white/70 transition-colors hover:text-white"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={onNext}
              className="text-white/70 transition-colors hover:text-white"
            >
              Next
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

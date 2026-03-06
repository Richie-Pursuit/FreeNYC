import Image from "next/image";

const BLUR_DATA_URL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

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

export default function PhotoCard({
  photo,
  onOpen,
  layoutClass,
  priority = false,
  index = 0,
}) {
  const altText = getPhotoAltText(photo);
  const imageUrl =
    typeof photo?.imageUrl === "string" && photo.imageUrl.trim()
      ? photo.imageUrl.trim()
      : "";
  const safeOnOpen = typeof onOpen === "function" ? onOpen : () => {};

  if (!imageUrl) {
    return null;
  }

  return (
    <article
      className={`relative overflow-hidden opacity-100 motion-safe:opacity-0 motion-safe:animate-[cardReveal_720ms_cubic-bezier(0.22,1,0.36,1)_forwards] ${layoutClass}`}
      style={{ animationDelay: `${Math.min(index, 12) * 65}ms` }}
    >
      <button
        type="button"
        onClick={safeOnOpen}
        className="group relative block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        aria-label={`Open ${altText}`}
      >
        <Image
          src={imageUrl}
          alt={altText}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover transition duration-700 group-hover:scale-[1.02] group-active:scale-[1.01]"
          priority={priority}
          placeholder="blur"
          blurDataURL={BLUR_DATA_URL}
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-black/24 to-transparent opacity-100 transition-opacity duration-500 sm:opacity-0 sm:group-hover:opacity-100" />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-0 p-4 text-left text-white opacity-100 transition-all duration-500 sm:translate-y-4 sm:p-6 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100">
          <p className="display-font max-w-[92%] text-xl leading-none break-words sm:text-2xl">
            {photo.title}
          </p>
          <p className="mt-2 text-xs tracking-[0.08em] text-white/80 uppercase">
            {photo.collection}
          </p>
          {photo.poem ? (
            <p className="mt-2 max-w-lg text-xs whitespace-pre-line text-white/90 break-words sm:mt-3 sm:text-sm">
              {photo.poem}
            </p>
          ) : null}
        </div>
      </button>
    </article>
  );
}

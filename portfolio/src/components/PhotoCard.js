import Image from "next/image";

export default function PhotoCard({
  photo,
  onOpen,
  layoutClass,
  priority = false,
}) {
  return (
    <article className={`relative overflow-hidden ${layoutClass}`}>
      <button
        type="button"
        onClick={onOpen}
        className="group relative block h-full w-full"
        aria-label={`Open ${photo.title}`}
      >
        <Image
          src={photo.imageUrl}
          alt={photo.alt}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover transition duration-700 group-hover:scale-[1.02]"
          priority={priority}
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-4 p-5 text-left text-white opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100 sm:p-6">
          <p className="display-font text-2xl leading-none">{photo.title}</p>
          <p className="mt-2 text-xs tracking-[0.08em] text-white/80 uppercase">
            {photo.collection}
          </p>
          <p className="mt-3 max-w-lg text-sm text-white/90">{photo.poem}</p>
        </div>
      </button>
    </article>
  );
}

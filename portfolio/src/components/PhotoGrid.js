import PhotoCard from "./PhotoCard";

const cinematicPattern = [
  "min-h-[78vh] sm:min-h-[64vh] lg:col-span-2 lg:row-span-2",
  "min-h-[52vh] sm:min-h-[42vh]",
  "min-h-[52vh] sm:min-h-[42vh]",
  "min-h-[60vh] sm:min-h-[44vh]",
  "min-h-[76vh] sm:min-h-[56vh] lg:row-span-2",
  "min-h-[58vh] sm:min-h-[44vh]",
  "min-h-[50vh] sm:min-h-[40vh]",
  "min-h-[58vh] sm:min-h-[44vh]",
  "min-h-[50vh] sm:min-h-[40vh]",
];

const masonryPattern = [
  "min-h-[58vh] sm:min-h-[42vh] lg:min-h-[46vh]",
  "min-h-[68vh] sm:min-h-[50vh] lg:min-h-[56vh]",
  "min-h-[50vh] sm:min-h-[36vh] lg:min-h-[42vh]",
  "min-h-[62vh] sm:min-h-[46vh] lg:min-h-[50vh]",
  "min-h-[54vh] sm:min-h-[38vh] lg:min-h-[44vh]",
  "min-h-[72vh] sm:min-h-[54vh] lg:min-h-[58vh]",
];

const patternByLayout = {
  cinematic: cinematicPattern,
  masonry: masonryPattern,
};

export default function PhotoGrid({
  photos,
  onOpen,
  layout = "cinematic",
  eagerCount = 0,
}) {
  const pattern = patternByLayout[layout] || cinematicPattern;

  return (
    <section
      aria-label="Street photography highlights"
      className="grid auto-rows-[1fr] grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      {photos.map((photo, index) => (
        <PhotoCard
          key={photo.photoId}
          photo={photo}
          onOpen={() => onOpen(index)}
          layoutClass={pattern[index % pattern.length]}
          priority={index < eagerCount || Boolean(photo.featured)}
        />
      ))}
    </section>
  );
}

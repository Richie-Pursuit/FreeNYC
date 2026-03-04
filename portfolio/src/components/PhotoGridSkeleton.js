const skeletonPattern = [
  "min-h-[64vh] sm:min-h-[64vh] lg:col-span-2 lg:row-span-2",
  "min-h-[46vh] sm:min-h-[42vh]",
  "min-h-[46vh] sm:min-h-[42vh]",
  "min-h-[54vh] sm:min-h-[44vh]",
  "min-h-[62vh] sm:min-h-[56vh] lg:row-span-2",
  "min-h-[50vh] sm:min-h-[44vh]",
  "min-h-[44vh] sm:min-h-[40vh]",
  "min-h-[50vh] sm:min-h-[44vh]",
  "min-h-[44vh] sm:min-h-[40vh]",
];

export default function PhotoGridSkeleton({ count = 9 }) {
  return (
    <section
      aria-label="Loading photos"
      className="grid auto-rows-[1fr] grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={`skeleton-${index}`}
          className={`relative overflow-hidden ${skeletonPattern[index % skeletonPattern.length]} skeleton-block`}
          style={{ animationDelay: `${index * 90}ms` }}
        />
      ))}
    </section>
  );
}

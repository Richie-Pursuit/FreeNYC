import Navbar from "@/components/Navbar";
import Image from "next/image";

export const metadata = {
  title: "About",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="motion-page-enter mx-auto w-full max-w-[1400px] px-4 py-10 sm:px-8 sm:py-12 lg:px-12 lg:py-16">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_1.4fr] lg:gap-14">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <figure className="overflow-hidden border border-foreground/20 bg-zinc-100 shadow-[0_18px_45px_rgba(0,0,0,0.08)]">
              <div className="relative aspect-[4/5] w-full">
                <Image
                  src="https://picsum.photos/id/1005/1400/1750"
                  alt="Portrait of the street photographer"
                  fill
                  sizes="(max-width: 1024px) 100vw, 42vw"
                  className="object-cover"
                  priority
                />
              </div>
              <figcaption className="border-t border-foreground/15 px-4 py-3 text-[11px] tracking-[0.14em] text-foreground/70 uppercase">
                Free NYC • Photographer
              </figcaption>
            </figure>
          </aside>

          <section>
            <p className="text-[11px] tracking-[0.2em] text-foreground/60 uppercase">
              About The Artist
            </p>
            <h1 className="display-font mt-3 text-4xl leading-[0.95] sm:text-6xl lg:text-7xl">
              Street Frames
            </h1>

            <div className="mt-6 space-y-4 text-sm leading-7 text-foreground/80 sm:mt-8 sm:text-[15px] sm:leading-8">
              <p>
                Free NYC is a Leica-driven street photographer focused on quiet,
                unrepeatable moments in crowded places. Each frame is built from
                natural light, distance, and timing instead of staging.
              </p>
              <p>
                The work moves through subway platforms, crosswalk pauses, and
                midnight avenues, documenting city life as an emotional archive
                rather than a travel postcard.
              </p>
            </div>

            <blockquote className="display-font mt-8 border-l-2 border-foreground/30 pl-4 text-xl leading-8 text-foreground/85 italic sm:mt-10 sm:pl-5 sm:text-3xl sm:leading-10">
              &ldquo;Street photography is the art of noticing what disappears
              in a second.&rdquo;
            </blockquote>

            <div className="mt-8 grid gap-3 sm:mt-10 sm:gap-4 sm:grid-cols-2">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                className="border border-foreground/20 bg-white px-4 py-4 transition-colors hover:border-foreground sm:px-5"
              >
                <p className="text-[11px] tracking-[0.16em] text-foreground/60 uppercase">
                  Instagram
                </p>
                <p className="mt-2 text-sm text-foreground">@freenyc</p>
              </a>
              <a
                href="mailto:hello@example.com"
                className="border border-foreground/20 bg-white px-4 py-4 transition-colors hover:border-foreground sm:px-5"
              >
                <p className="text-[11px] tracking-[0.16em] text-foreground/60 uppercase">
                  Email
                </p>
                <p className="mt-2 text-sm text-foreground">hello@example.com</p>
              </a>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

import Navbar from "@/components/Navbar";
import Image from "next/image";

export const metadata = {
  title: "About | Street Photography Portfolio",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto w-full max-w-[1400px] px-4 py-12 sm:px-8 lg:px-12 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_1.4fr] lg:gap-14">
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
            <h1 className="display-font mt-3 text-6xl leading-[0.95] sm:text-7xl">
              Street Frames
            </h1>

            <div className="mt-8 space-y-5 text-[15px] leading-8 text-foreground/80">
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

            <blockquote className="display-font mt-10 border-l-2 border-foreground/30 pl-5 text-2xl leading-9 text-foreground/85 italic sm:text-3xl sm:leading-10">
              &ldquo;Street photography is the art of noticing what disappears
              in a second.&rdquo;
            </blockquote>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                className="border border-foreground/20 bg-white px-5 py-4 transition-colors hover:border-foreground"
              >
                <p className="text-[11px] tracking-[0.16em] text-foreground/60 uppercase">
                  Instagram
                </p>
                <p className="mt-2 text-sm text-foreground">@freenyc</p>
              </a>
              <a
                href="mailto:hello@example.com"
                className="border border-foreground/20 bg-white px-5 py-4 transition-colors hover:border-foreground"
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

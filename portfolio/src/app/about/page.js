import Image from "next/image";
import { getAboutPageContentSafe } from "@/lib/pageContentStore";

export const metadata = {
  title: "About",
};

export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const aboutPage = await getAboutPageContentSafe();
  const sections = aboutPage?.sections || {};
  const hero = sections.hero || {};
  const header = sections.header || {};
  const body = sections.body || {};
  const quote = sections.quote || {};
  const contact = sections.contact || {};

  const paragraphs = Array.isArray(body.paragraphs) ? body.paragraphs.filter(Boolean) : [];
  const instagramHref = contact.instagramUrl || "";
  const instagramHandle = contact.instagramHandle || "";
  const emailAddress = contact.email || "";
  const hasInstagramLink = Boolean(instagramHref);
  const hasEmailLink = Boolean(emailAddress);

  return (
    <div className="min-h-screen bg-background">
      <main
        id="main-content"
        className="motion-page-enter mx-auto w-full max-w-[1400px] px-3 py-7 sm:px-8 sm:py-12 lg:px-12 lg:py-16"
      >
        <div className="grid gap-6 sm:gap-8 lg:grid-cols-[1.05fr_1.4fr] lg:gap-14">
          <aside className="order-2 lg:order-1 lg:sticky lg:top-24 lg:self-start">
            <figure className="theme-elevated relative overflow-hidden border bg-[var(--image-fallback)]">
              <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_18%,rgba(255,255,255,0.42),transparent_44%),radial-gradient(circle_at_82%_88%,rgba(10,10,10,0.17),transparent_46%)]" />
              <div className="relative aspect-[4/3] w-full sm:aspect-[5/4] lg:aspect-[4/5]">
                {hero.imageUrl ? (
                  <Image
                    src={hero.imageUrl}
                    alt={hero.alt || "Portrait of the artist"}
                    fill
                    sizes="(max-width: 1024px) 100vw, 42vw"
                    className="object-cover"
                    priority
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[var(--image-fallback)] text-sm text-foreground/65">
                    Portrait coming soon
                  </div>
                )}
              </div>
            </figure>
          </aside>

          <section className="order-1 lg:order-2">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-foreground/80 uppercase sm:text-[12px] sm:tracking-[0.2em]">
              {header.introLabel}
            </p>
            <h1 className="display-font mt-3 text-4xl leading-[0.95] text-foreground sm:text-6xl lg:text-7xl">
              {header.headline}
            </h1>
            <p className="mt-2.5 max-w-2xl text-[15px] leading-7 text-foreground/88 sm:mt-3 sm:text-lg sm:leading-8">
              {header.supportingLine}
            </p>

            <div className="mt-6 border-t border-line pt-6 sm:mt-8 sm:pt-8">
              <div className="space-y-4 text-[15px] leading-8 text-foreground/90 sm:text-base">
                {paragraphs.map((paragraph, index) => (
                  <p key={`about-paragraph-${index}`}>{paragraph}</p>
                ))}
              </div>
            </div>

            {quote.text ? (
              <blockquote className="theme-surface display-font mt-8 border px-5 py-5 text-xl leading-8 text-foreground/90 italic sm:mt-10 sm:px-6 sm:py-6 sm:text-3xl sm:leading-10">
                &ldquo;{quote.text}&rdquo;
                {quote.attribution ? (
                  <footer className="mt-4 text-sm not-italic tracking-[0.12em] text-foreground/70 uppercase">
                    {quote.attribution}
                  </footer>
                ) : null}
              </blockquote>
            ) : null}

            <div className="mt-8 grid gap-3 sm:mt-10 sm:grid-cols-2">
              {hasInstagramLink ? (
                <a
                  href={instagramHref}
                  target="_blank"
                  rel="noreferrer"
                  className="theme-surface group border px-5 py-4 transition-all hover:-translate-y-0.5 hover:border-[color:var(--accent)]"
                >
                  <p className="text-[11px] font-semibold tracking-[0.16em] text-foreground/70 uppercase">
                    {contact.instagramLabel}
                  </p>
                  <p className="mt-2 text-base font-semibold text-foreground">{instagramHandle}</p>
                </a>
              ) : (
                <div className="theme-surface border px-5 py-4">
                  <p className="text-[11px] font-semibold tracking-[0.16em] text-foreground/70 uppercase">
                    {contact.instagramLabel || "Instagram"}
                  </p>
                  <p className="mt-2 text-base font-semibold text-foreground/60">Not provided</p>
                </div>
              )}
              {hasEmailLink ? (
                <a
                  href={`mailto:${emailAddress}`}
                  className="theme-surface group border px-5 py-4 transition-all hover:-translate-y-0.5 hover:border-[color:var(--accent)]"
                >
                  <p className="text-[11px] font-semibold tracking-[0.16em] text-foreground/70 uppercase">
                    {contact.emailLabel}
                  </p>
                  <p className="mt-2 text-base font-semibold text-foreground">{emailAddress}</p>
                </a>
              ) : (
                <div className="theme-surface border px-5 py-4">
                  <p className="text-[11px] font-semibold tracking-[0.16em] text-foreground/70 uppercase">
                    {contact.emailLabel || "Email"}
                  </p>
                  <p className="mt-2 text-base font-semibold text-foreground/60">Not provided</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

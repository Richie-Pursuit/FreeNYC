import Navbar from "@/components/Navbar";

export const metadata = {
  title: "About | Street Photography Portfolio",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto grid w-full max-w-[1200px] gap-10 px-4 py-14 sm:px-8 lg:grid-cols-[1.2fr_2fr] lg:px-12">
        <div className="aspect-[4/5] w-full bg-zinc-200" />

        <section>
          <h1 className="display-font text-5xl">About</h1>
          <p className="mt-6 max-w-2xl text-sm leading-7 text-muted">
            This page is scaffolded for the photographer biography and street
            photography philosophy. Content and portrait image will be filled in
            the upcoming step.
          </p>
          <div className="mt-8 space-y-2 text-xs tracking-[0.14em] uppercase">
            <a href="https://instagram.com" target="_blank" rel="noreferrer">
              Instagram
            </a>
            <p>hello@example.com</p>
          </div>
        </section>
      </main>
    </div>
  );
}

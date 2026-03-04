import Navbar from "@/components/Navbar";

export const metadata = {
  title: "Admin | Street Photography Portfolio",
};

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-8 lg:px-12">
        <h1 className="display-font text-5xl">Admin Panel</h1>

        <section className="mt-10 border border-line p-6">
          <h2 className="text-sm tracking-[0.14em] uppercase">Upload Photo</h2>
          <form className="mt-6 grid gap-4 md:grid-cols-2">
            <input
              type="text"
              placeholder="Caption"
              className="border border-line px-4 py-3 text-sm outline-none focus:border-foreground"
            />
            <input
              type="text"
              placeholder="Collection"
              className="border border-line px-4 py-3 text-sm outline-none focus:border-foreground"
            />
            <textarea
              placeholder="Poem"
              rows={4}
              className="border border-line px-4 py-3 text-sm outline-none focus:border-foreground md:col-span-2"
            />
            <button
              type="button"
              className="w-max border border-foreground px-6 py-2 text-[11px] tracking-[0.18em] uppercase transition-colors hover:bg-foreground hover:text-background"
            >
              Submit
            </button>
          </form>
        </section>

        <section className="mt-10 border border-line p-6">
          <h2 className="text-sm tracking-[0.14em] uppercase">Existing Photos</h2>
          <p className="mt-4 text-sm text-muted">
            Dashboard CRUD, drag reorder, and collection assignment will be built
            in upcoming steps.
          </p>
        </section>
      </main>
    </div>
  );
}

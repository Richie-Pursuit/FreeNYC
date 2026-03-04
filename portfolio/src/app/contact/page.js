import Navbar from "@/components/Navbar";

export const metadata = {
  title: "Contact | Street Photography Portfolio",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-8">
        <h1 className="display-font text-5xl">Contact</h1>

        <form className="mt-10 space-y-5">
          <label className="block text-xs tracking-[0.16em] text-muted uppercase">
            Name
            <input
              type="text"
              className="mt-2 w-full border border-line bg-transparent px-4 py-3 text-sm outline-none focus:border-foreground"
              placeholder="Your name"
            />
          </label>

          <label className="block text-xs tracking-[0.16em] text-muted uppercase">
            Email
            <input
              type="email"
              className="mt-2 w-full border border-line bg-transparent px-4 py-3 text-sm outline-none focus:border-foreground"
              placeholder="you@example.com"
            />
          </label>

          <label className="block text-xs tracking-[0.16em] text-muted uppercase">
            Message
            <textarea
              rows={6}
              className="mt-2 w-full border border-line bg-transparent px-4 py-3 text-sm outline-none focus:border-foreground"
              placeholder="Tell me about your project"
            />
          </label>

          <button
            type="submit"
            className="border border-foreground px-6 py-2 text-[11px] tracking-[0.18em] uppercase transition-colors hover:bg-foreground hover:text-background"
          >
            Send
          </button>
        </form>
      </main>
    </div>
  );
}

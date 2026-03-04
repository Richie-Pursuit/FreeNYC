import Navbar from "@/components/Navbar";

export const metadata = {
  title: "Contact | Street Photography Portfolio",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-8 sm:py-14">
        <h1 className="display-font text-4xl sm:text-5xl">Contact</h1>
        <p className="mt-4 max-w-xl text-sm text-foreground/70">
          Share your project details, and we will follow up with availability and rates.
        </p>

        <form className="mt-8 space-y-5 border border-foreground/20 bg-white/70 p-4 shadow-[0_14px_40px_rgba(0,0,0,0.05)] backdrop-blur-sm sm:mt-10 sm:p-6">
          <label className="block text-xs tracking-[0.16em] text-foreground/80 uppercase">
            Name
            <input
              type="text"
              className="mt-2 w-full border border-foreground/30 bg-white px-4 py-3 text-sm text-foreground placeholder:text-foreground/45 outline-none focus:border-foreground focus:ring-2 focus:ring-foreground/15"
              placeholder="Your name"
            />
          </label>

          <label className="block text-xs tracking-[0.16em] text-foreground/80 uppercase">
            Email
            <input
              type="email"
              className="mt-2 w-full border border-foreground/30 bg-white px-4 py-3 text-sm text-foreground placeholder:text-foreground/45 outline-none focus:border-foreground focus:ring-2 focus:ring-foreground/15"
              placeholder="you@example.com"
            />
          </label>

          <label className="block text-xs tracking-[0.16em] text-foreground/80 uppercase">
            Message
            <textarea
              rows={6}
              className="mt-2 w-full border border-foreground/30 bg-white px-4 py-3 text-sm text-foreground placeholder:text-foreground/45 outline-none focus:border-foreground focus:ring-2 focus:ring-foreground/15"
              placeholder="Tell me about your project"
            />
          </label>

          <button
            type="submit"
            className="w-full border border-foreground bg-foreground px-6 py-3 text-[11px] tracking-[0.18em] text-background uppercase transition-opacity hover:opacity-90 sm:w-auto sm:py-2"
          >
            Send
          </button>
        </form>
      </main>
    </div>
  );
}

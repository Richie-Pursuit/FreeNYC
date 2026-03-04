import Navbar from "@/components/Navbar";
import ContactForm from "@/components/ContactForm";

export const metadata = {
  title: "Contact | Street Photography Portfolio",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="motion-page-enter mx-auto w-full max-w-3xl px-4 py-10 sm:px-8 sm:py-14">
        <h1 className="display-font text-4xl sm:text-5xl">Contact</h1>
        <p className="mt-4 max-w-xl text-sm text-foreground/70">
          Share your project details, and we will follow up with availability and rates.
        </p>

        <ContactForm />
      </main>
    </div>
  );
}

import Navbar from "@/components/Navbar";

export const metadata = {
  title: "Terms of Use",
};

const updatedAt = "March 4, 2026";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-8 sm:py-14">
        <p className="text-[11px] tracking-[0.18em] text-muted uppercase">Terms Of Use</p>
        <h1 className="display-font mt-3 text-4xl leading-none sm:text-5xl">Terms Of Use</h1>
        <p className="mt-4 text-sm text-foreground/75">Last updated: {updatedAt}</p>

        <section className="mt-8 space-y-6 text-sm leading-7 text-foreground/85">
          <div>
            <h2 className="text-xs tracking-[0.16em] text-foreground/70 uppercase">
              Site Purpose
            </h2>
            <p className="mt-2">
              This website is a photography portfolio and contact platform for legitimate
              inquiries, collaboration, and licensing communication.
            </p>
          </div>

          <div>
            <h2 className="text-xs tracking-[0.16em] text-foreground/70 uppercase">
              Intellectual Property
            </h2>
            <p className="mt-2">
              All photos, text, and design elements are protected by copyright and related laws.
              You may not copy, reproduce, republish, or use portfolio content without written
              permission.
            </p>
          </div>

          <div>
            <h2 className="text-xs tracking-[0.16em] text-foreground/70 uppercase">
              Acceptable Use
            </h2>
            <p className="mt-2">
              You agree not to misuse this website, attempt unauthorized access, send spam, or
              use the contact form for unlawful or abusive purposes.
            </p>
          </div>

          <div>
            <h2 className="text-xs tracking-[0.16em] text-foreground/70 uppercase">
              No Warranty
            </h2>
            <p className="mt-2">
              This website is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo;
              basis. We do not guarantee uninterrupted service, error-free operation, or fitness
              for a particular purpose.
            </p>
          </div>

          <div>
            <h2 className="text-xs tracking-[0.16em] text-foreground/70 uppercase">
              Limitation Of Liability
            </h2>
            <p className="mt-2">
              To the maximum extent permitted by law, we are not liable for indirect, incidental,
              or consequential damages arising from your use of this website.
            </p>
          </div>

          <div>
            <h2 className="text-xs tracking-[0.16em] text-foreground/70 uppercase">
              Governing Law
            </h2>
            <p className="mt-2">
              These terms are governed by the laws of the State of New York, without regard to
              conflict-of-law principles.
            </p>
          </div>

          <div>
            <h2 className="text-xs tracking-[0.16em] text-foreground/70 uppercase">
              Contact
            </h2>
            <p className="mt-2">
              For legal or policy questions, email{" "}
              <a className="underline decoration-foreground/40" href="mailto:richiecarrasco@pursuit.org">
                richiecarrasco@pursuit.org
              </a>
              .
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

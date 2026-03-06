import Navbar from "@/components/Navbar";

export const metadata = {
  title: "Privacy Policy",
};

const updatedAt = "March 4, 2026";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-8 sm:py-14">
        <p className="text-[11px] tracking-[0.18em] text-muted uppercase">Privacy Policy</p>
        <h1 className="display-font mt-3 text-4xl leading-none sm:text-5xl">
          Privacy Policy
        </h1>
        <p className="mt-4 text-sm text-foreground/75">Last updated: {updatedAt}</p>

        <section className="mt-8 space-y-6 text-sm leading-7 text-foreground/85">
          <div>
            <h2 className="text-xs tracking-[0.16em] text-foreground/70 uppercase">
              Information We Collect
            </h2>
            <p className="mt-2">
              If you use the contact form, we collect your name, email address, subject, and
              message. For anti-spam and security, we may also store technical data such as IP
              address and browser user-agent.
            </p>
          </div>

          <div>
            <h2 className="text-xs tracking-[0.16em] text-foreground/70 uppercase">
              How We Use Information
            </h2>
            <p className="mt-2">
              We use this information to respond to inquiries, manage communications, operate
              this portfolio site, and protect the site from abuse.
            </p>
          </div>

          <div>
            <h2 className="text-xs tracking-[0.16em] text-foreground/70 uppercase">
              Service Providers
            </h2>
            <p className="mt-2">
              We use third-party providers to operate the website and contact workflow,
              including Netlify (hosting), MongoDB Atlas (database), Cloudinary (image hosting),
              Google OAuth (admin authentication), and Resend (email delivery).
            </p>
          </div>

          <div>
            <h2 className="text-xs tracking-[0.16em] text-foreground/70 uppercase">
              Cookies
            </h2>
            <p className="mt-2">
              This site uses essential cookies for security and admin login/session handling.
              We do not use advertising cookies.
            </p>
          </div>

          <div>
            <h2 className="text-xs tracking-[0.16em] text-foreground/70 uppercase">
              Data Retention
            </h2>
            <p className="mt-2">
              Contact submissions are retained only as long as reasonably needed for
              communication, record-keeping, and security.
            </p>
          </div>

          <div>
            <h2 className="text-xs tracking-[0.16em] text-foreground/70 uppercase">
              Your Requests
            </h2>
            <p className="mt-2">
              You can request access, correction, or deletion of your contact submission by
              emailing{" "}
              <a className="underline decoration-foreground/40" href="mailto:richiecarrasco@pursuit.org">
                richiecarrasco@pursuit.org
              </a>
              .
            </p>
          </div>

          <div>
            <h2 className="text-xs tracking-[0.16em] text-foreground/70 uppercase">
              New York Security Notice
            </h2>
            <p className="mt-2">
              We implement reasonable administrative, technical, and physical safeguards for
              private information and follow applicable New York data breach notification laws.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

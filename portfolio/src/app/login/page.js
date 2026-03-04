import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import Navbar from "@/components/Navbar";

export const metadata = {
  title: "Login | Street Photography Portfolio",
};

export default async function LoginPage({ searchParams }) {
  const session = await getServerSession(authOptions);
  const params = await searchParams;
  const callbackUrl =
    typeof params?.callbackUrl === "string" && params.callbackUrl
      ? params.callbackUrl
      : "/admin";

  if (session?.user?.email) {
    redirect(callbackUrl);
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="motion-page-enter mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-24 text-center sm:px-8">
        <h1 className="display-font text-4xl leading-none sm:text-6xl">Admin Login</h1>
        <p className="mt-5 max-w-md text-sm text-muted">
          Sign in with Google to access the private dashboard and manage portfolio
          uploads.
        </p>

        <div className="mt-10">
          <GoogleSignInButton callbackUrl={callbackUrl} />
        </div>

        <Link
          href="/"
          className="mt-8 text-[11px] tracking-[0.16em] text-muted uppercase transition-colors hover:text-foreground"
        >
          Back To Gallery
        </Link>
      </main>
    </div>
  );
}

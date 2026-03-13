import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { isAllowedAdminEmail } from "@/lib/auth-policy";
import AdminSessionControls from "@/components/AdminSessionControls";
import AdminIdleSessionGuard from "@/components/AdminIdleSessionGuard";
import AdminAboutEditor from "@/components/AdminAboutEditor";

export const metadata = {
  title: "Admin About Editor",
};

export default async function AdminAboutPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isAllowedAdminEmail(session.user.email)) {
    redirect("/login?callbackUrl=/admin/about");
  }

  return (
    <div className="admin-page min-h-screen">
      <AdminIdleSessionGuard />
      <div className="motion-page-enter mx-auto flex w-full max-w-[1680px] justify-end px-4 pt-4 sm:px-8 sm:pt-6 lg:px-12">
        <AdminSessionControls email={session.user.email} />
      </div>
      <AdminAboutEditor />
    </div>
  );
}

import Navbar from "@/components/Navbar";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { isAllowedAdminEmail } from "@/lib/auth-policy";
import AdminDashboard from "@/components/AdminDashboard";
import AdminSessionControls from "@/components/AdminSessionControls";

export const metadata = {
  title: "Admin | Street Photography Portfolio",
};

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isAllowedAdminEmail(session.user.email)) {
    redirect("/login?callbackUrl=/admin");
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="mx-auto flex w-full max-w-5xl justify-end px-4 pt-6 sm:px-8 lg:px-12">
        <AdminSessionControls email={session.user.email} />
      </div>
      <AdminDashboard />
    </div>
  );
}

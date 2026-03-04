import { withAuth } from "next-auth/middleware";
import { isAllowedAdminEmail } from "@/lib/auth-policy";

export default withAuth({
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized: ({ token, req }) => {
      const isAdminRoute = req.nextUrl.pathname.startsWith("/admin");
      if (!isAdminRoute) {
        return true;
      }

      const email = typeof token?.email === "string" ? token.email : "";
      return isAllowedAdminEmail(email);
    },
  },
});

export const config = {
  matcher: ["/admin/:path*"],
};

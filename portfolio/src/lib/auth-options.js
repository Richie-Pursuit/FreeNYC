import GoogleProvider from "next-auth/providers/google";
import { isAllowedAdminEmail } from "@/lib/auth-policy";

export const authOptions = {
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user, profile }) {
      const email = profile?.email || user?.email || "";
      return isAllowedAdminEmail(email);
    },
    async session({ session, token }) {
      if (token?.email) {
        session.user.email = token.email;
      }

      return session;
    },
  },
};

import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;
    const role = token?.role;

    // If user is already logged in and visits login page, redirect to dashboard
    if (pathname === "/") {
      if (token) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
      return NextResponse.next();
    }

    // Admin-only route guard
    if (pathname.startsWith("/admin")) {
      if (role !== "ADMIN") {
        return NextResponse.redirect(new URL("/dashboard?error=admin_required", req.url));
      }
    }

    // Participant & Admin team creation route guard
    if (pathname.startsWith("/teams/create")) {
      if (role !== "PARTICIPANT" && role !== "ADMIN") {
        return NextResponse.redirect(new URL("/dashboard?error=participant_required", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        // Public routes
        if (
          pathname === "/" ||
          pathname.startsWith("/api/auth") ||
          pathname.startsWith("/_next") ||
          pathname.startsWith("/favicon.ico")
        ) {
          return true;
        }
        // Protected routes require valid token
        return !!token;
      },
    },
    pages: {
      signIn: "/",
    },
  }
);

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/teams/:path*",
    "/vote/:path*",
    "/admin/:path*",
  ],
};

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import SessionProviderWrapper from "@/components/SessionProviderWrapper";
import Navbar from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Campus Coders League",
  description: "Official team formation, roster management, and live voting platform.",
  icons: {
    icon: "/ccl_logo.jpeg",
    shortcut: "/ccl_logo.jpeg",
    apple: "/ccl_logo.jpeg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-white">
      <body className={`${inter.className} min-h-screen flex flex-col bg-white text-gray-900`}>
        <SessionProviderWrapper>
          <Navbar />
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
          <footer className="w-full bg-white border-t border-gray-200 py-6 text-center text-xs text-gray-400">
            © {new Date().getFullYear()} Campus Coders League.
          </footer>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}

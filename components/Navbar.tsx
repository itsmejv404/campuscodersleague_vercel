"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  Vote,
  Users,
  LayoutDashboard,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  User,
} from "lucide-react";

export default function Navbar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isVotingOpen, setIsVotingOpen] = useState(false);

  React.useEffect(() => {
    async function checkVotingStatus() {
      try {
        const res = await fetch("/api/admin/voting-window");
        const data = await res.json();
        setIsVotingOpen(data?.status === "active");
      } catch {
        setIsVotingOpen(false);
      }
    }
    checkVotingStatus();
  }, [pathname]);

  // If on public landing page or not authenticated, render simplified minimal header
  if (status !== "authenticated" || !session?.user) {
    return (
      <header className="w-full bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-3 shrink-0">
            <Image
              src="/ccl_logo.jpeg"
              alt="Campus Coders League Logo"
              width={38}
              height={38}
              className="w-9.5 h-9.5 rounded-full object-cover border border-gray-100 shadow-xs shrink-0"
              priority
            />
            <span className="text-xl font-bold text-gray-900 tracking-tight whitespace-nowrap">Campus Coders League</span>
          </Link>
        </div>
      </header>
    );
  }

  const role = session.user.role;
  const isParticipant = role === "PARTICIPANT";
  const isAdmin = role === "ADMIN";

  const navLinks = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ...(isParticipant || isAdmin
      ? [{ href: "/teams/create", label: "Create Team", icon: Users }]
      : []),
    { href: "/vote", label: isVotingOpen ? "Vote (Live)" : "Teams & Vote", icon: Vote },
    ...(isAdmin
      ? [
          { href: "/admin", label: "Admin Hub", icon: ShieldCheck },
          { href: "/admin/teams", label: "Teams", icon: Users },
        ]
      : []),
  ];

  const getRoleBadge = (roleStr: string) => {
    switch (roleStr) {
      case "ADMIN":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 whitespace-nowrap shrink-0">
            ADMIN
          </span>
        );
      case "PARTICIPANT":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap shrink-0">
            PARTICIPANT
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200 whitespace-nowrap shrink-0">
            VOTER
          </span>
        );
    }
  };

  return (
    <header className="w-full bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center space-x-6 shrink-0">
          <Link href="/dashboard" className="flex items-center space-x-3 shrink-0">
            <Image
              src="/ccl_logo.jpeg"
              alt="Campus Coders League Logo"
              width={38}
              height={38}
              className="w-9.5 h-9.5 rounded-full object-cover border border-gray-100 shadow-xs shrink-0"
              priority
            />
            <span className="text-xl font-bold text-gray-900 tracking-tight whitespace-nowrap">Campus Coders League</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center space-x-1 shrink-0">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? "bg-gray-100 text-gray-900 font-semibold"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2 text-gray-500 shrink-0" />
                  <span className="whitespace-nowrap">{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User profile & actions */}
        <div className="hidden md:flex items-center space-x-3 shrink-0">
          <div className="flex items-center space-x-2 text-right whitespace-nowrap">
            <span
              className="text-xs font-medium text-gray-900 truncate max-w-[180px] whitespace-nowrap"
              title={session.user.email || ""}
            >
              {session.user.name || session.user.email}
            </span>
            {getRoleBadge(role)}
          </div>

          <div className="h-5 w-px bg-gray-200 shrink-0" />

          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="w-3.5 h-3.5 mr-1.5 text-gray-500 shrink-0" />
            Sign Out
          </button>
        </div>

        {/* Mobile menu button */}
        <div className="md:hidden flex items-center shrink-0">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white px-4 pt-3 pb-4 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-gray-900 truncate max-w-[160px] whitespace-nowrap">
                  {session.user.name || session.user.email}
                </span>
              </div>
            </div>
            {getRoleBadge(role)}
          </div>

          <div className="space-y-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap ${
                    isActive
                      ? "bg-gray-100 text-gray-900 font-semibold"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2.5 text-gray-500 shrink-0" />
                  <span className="whitespace-nowrap">{link.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="pt-2 border-t border-gray-100">
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="w-full flex items-center justify-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 whitespace-nowrap"
            >
              <LogOut className="w-4 h-4 mr-2 text-gray-500 shrink-0" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

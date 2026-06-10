"use client";

import { SignInButton, SignUpButton, UserButton, useAuth } from "@clerk/nextjs";
import Link from "next/link";

export function AuthStatusButtons() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <div className="h-9 w-24 rounded-md border border-slate-200 bg-white/70" />;
  }

  if (isSignedIn) {
    return (
      <>
        <Link
          href="/reports"
          prefetch={false}
          className="hidden h-9 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 sm:inline-flex"
        >
          My Reports
        </Link>
        <Link
          href="/dashboard"
          prefetch={false}
          className="hidden h-9 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 sm:inline-flex"
        >
          Dashboard
        </Link>
        <UserButton />
      </>
    );
  }

  return (
    <>
      <SignInButton mode="modal">
        <button className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">
          Sign in
        </button>
      </SignInButton>
      <SignUpButton mode="modal">
        <button className="hidden h-9 items-center rounded-md bg-slate-950 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 sm:inline-flex">
          Create account
        </button>
      </SignUpButton>
    </>
  );
}

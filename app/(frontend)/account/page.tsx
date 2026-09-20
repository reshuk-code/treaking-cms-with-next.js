import Link from "next/link";

import { travellerSignOutAction } from "@/app/(frontend)/account/actions";
import {
  TravellerPasswordForm,
  TravellerProfileForm,
} from "@/components/frontend/account-forms";
import { requireTraveller } from "@/lib/auth/traveller";

/*
 * noindex, and not only because the sitemap leaves this out: the header links
 * here from every page, and this one is private to whoever is reading it.
 */
export const metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  // Redirects to the sign-in form, carrying this page as `next`, so a visitor
  // whose cookie expired lands back here rather than on the home page.
  const traveller = await requireTraveller("/account");

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Your account
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Signed in as {traveller.email}
          </p>
        </div>

        {/*
          A plain server-action form, not a client component: signing out has
          no state to keep and no error to render, so there is nothing for a
          `use client` boundary to do here.
        */}
        <form action={travellerSignOutAction}>
          <button
            type="submit"
            className="rounded-xl border border-border px-4 py-2 text-sm font-medium"
          >
            Sign out
          </button>
        </form>
      </div>

      <section className="mt-10 space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Your details</h2>
        <TravellerProfileForm traveller={traveller} />
      </section>

      <section className="mt-12 space-y-4 border-t border-border pt-10">
        <h2 className="text-lg font-semibold tracking-tight">Password</h2>
        <TravellerPasswordForm />
      </section>

      <p className="mt-12 border-t border-border pt-6 text-sm text-muted-foreground">
        Looking for a trip?{" "}
        <Link href="/tours" className="font-medium underline">
          Browse everything we run
        </Link>
        .
      </p>
    </main>
  );
}

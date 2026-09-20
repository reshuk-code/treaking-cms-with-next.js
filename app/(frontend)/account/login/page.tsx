import Link from "next/link";
import { redirect } from "next/navigation";

import { TravellerLoginForm } from "@/components/frontend/account-forms";
import {
  getTravellerSession,
  travellerAuthAvailable,
} from "@/lib/auth/traveller";

/*
 * noindex, and not only because the sitemap leaves these out: a crawler that
 * finds the link in the header should not file a sign-in form as a landing
 * page for the client's brand.
 */
export const metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

// Whether a session exists, and which auth provider is active, are both
// runtime state.
export const dynamic = "force-dynamic";

export default async function TravellerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (await getTravellerSession()) redirect("/account");

  const { next } = await searchParams;
  const available = await travellerAuthAvailable();

  return (
    <main className="mx-auto w-full max-w-md px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Access your details and the trips you have enquired about.
      </p>

      <div className="mt-8">
        {available ? (
          <TravellerLoginForm next={next} />
        ) : (
          <UnavailableNotice />
        )}
      </div>
    </main>
  );
}

/**
 * Under a hosted provider the CMS does not own the session, so an email and
 * password form here would post into nothing. Saying so is better than
 * rendering a form that silently cannot work.
 */
function UnavailableNotice() {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-muted/40 px-4 py-4 text-sm">
      <p>
        This website signs visitors in through its identity provider, so there
        is no password form here.
      </p>
      <p className="text-muted-foreground">
        You can still{" "}
        <Link href="/contact" className="font-medium underline">
          send an enquiry
        </Link>{" "}
        without an account.
      </p>
    </div>
  );
}

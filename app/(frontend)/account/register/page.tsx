import Link from "next/link";
import { redirect } from "next/navigation";

import { TravellerRegisterForm } from "@/components/frontend/account-forms";
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
  title: "Create an account",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function TravellerRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (await getTravellerSession()) redirect("/account");

  const { next } = await searchParams;

  if (!(await travellerAuthAvailable())) {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">
          Create an account
        </h1>
        <p className="mt-4 rounded-xl border border-border bg-muted/40 px-4 py-4 text-sm">
          This website signs visitors in through its identity provider, so
          accounts are not created here. You can still{" "}
          <Link href="/contact" className="font-medium underline">
            send an enquiry
          </Link>
          .
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">
        Create an account
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Keep your details in one place so you do not retype them on every
        enquiry.
      </p>

      <div className="mt-8">
        <TravellerRegisterForm next={next} />
      </div>
    </main>
  );
}

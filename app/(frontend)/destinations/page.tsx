import type { Metadata } from "next";
import Link from "next/link";

import { cms } from "@/lib/cms";
import { generateCmsMetadata } from "@/lib/seo/metadata";
import { richTextExcerpt } from "@/lib/rich-text";

import { FeaturedImage } from "@/components/frontend/featured-image";
/**
 * Destination index — part of the default template.
 *
 * Like `/blog`, an editor can create a CMS page with the slug `/destinations`
 * to own this page's title and description; the listing itself stays here,
 * because a page of prose cannot enumerate records.
 */
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const [managed, site] = await Promise.all([
    cms.pages.getBySlug("/destinations"),
    cms.settings.get(),
  ]);

  return generateCmsMetadata({
    title: managed?.title ?? "Destinations",
    path: "/destinations",
    description:
      managed?.excerpt ?? `The places ${site.siteName} runs trips to.`,
    image: managed?.featuredImage ?? null,
    seo: managed?.seo ?? null,
  });
}

export default async function DestinationsIndexPage() {
  const [managed, destinations] = await Promise.all([
    cms.pages.getBySlug("/destinations"),
    cms.destinations.getPublished(),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-16 sm:py-24">
      <header className="max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Where we go
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          {managed?.title ?? "Destinations"}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          {managed?.excerpt ??
            "Places we know well enough to send you there with a plan."}
        </p>
      </header>

      {destinations.length === 0 ? (
        <p className="mt-16 rounded-card border border-dashed border-border px-6 py-16 text-center text-muted-foreground">
          No destinations published yet. Add one in the admin.
        </p>
      ) : (
        <ul className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {destinations.map((destination) => {
            const blurb = richTextExcerpt(destination.description);

            return (
            <li key={destination.id} className="group">
              <Link href={`/destinations/${destination.slug}`} className="block">
                <FeaturedImage
                  record={destination}
                  shape="card"
                  className="rounded-card shadow-[var(--shadow-card)] dark:border dark:border-border"
                />

                <div className="mt-4">
                  <h2 className="text-lg font-semibold tracking-tight group-hover:underline underline-offset-4">
                    {destination.name}
                  </h2>
                  {blurb ? (
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground sm:line-clamp-4">
                      {blurb}
                    </p>
                  ) : null}
                </div>
              </Link>
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

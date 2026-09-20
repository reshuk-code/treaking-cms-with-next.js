"use client";

import { Save } from "lucide-react";
import { startTransition, useActionState, useRef, useState, type FormEvent } from "react";

import { saveDestinationAction } from "@/app/admin/(dashboard)/destinations/actions";
import { FaqEditor } from "@/components/cms/faq-editor";
import { ContentManagementPanel, FormSection, FormSections } from "@/components/cms/form-sections";
import { FeaturedImagesField } from "@/components/cms/featured-images-field";
import { MediaLibraryPanel } from "@/components/cms/media-drawer";
import { RichTextField } from "@/components/cms/rich-text-field";
import { SeoFields } from "@/components/cms/seo-fields";
import { SeoJumpCard } from "@/components/cms/seo-jump-card";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import {
  CheckboxField,
  Field,
  Input,
  Label,
  Select,
} from "@/components/ui/field";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import { IDLE } from "@/lib/actions/result";
import { defaultNewStatus } from "@/lib/publishing";
import { richTextExcerpt } from "@/lib/rich-text";
import { toDateTimeLocal } from "@/lib/utils";
import { slugify } from "@/schemas/common";
import type { Destination } from "@/types/content";

/**
 * The collapsible sections, in the order they appear.
 *
 * Module level so the array keeps its identity between renders: the jump list
 * feeds it to an IntersectionObserver effect.
 */
const SECTIONS = [
  { id: "section-description", label: "Overview" },
  { id: "section-images", label: "Images" },
  { id: "section-faqs", label: "FAQs" },
  { id: "section-seo", label: "SEO" },
];

/** One tab per section. See the note in `tour-form.tsx`. */
const CONTENT_TABS = [
  { id: "overview", label: "Overview", sectionIds: ["section-description"] },
  { id: "images", label: "Images", sectionIds: ["section-images"] },
  { id: "faqs", label: "FAQs", sectionIds: ["section-faqs"] },
];

export interface DestinationFormProps {
  destination: Destination | null;
  siteUrl: string;
  /** Where the frontend mounts destinations. For the slug hint only. */
  basePath?: string;
  canPublish: boolean;
}

/**
 * The destination editor.
 *
 * A destination is a country — Nepal, India, Bhutan — so it carries no
 * country, region or map pin of its own. Regions point at it instead, and the
 * where-and-when facts belong to the regions and tours that sell trips there.
 */
export function DestinationForm({
  destination,
  siteUrl,
  basePath = "/destinations",
  canPublish,
}: DestinationFormProps) {
  const [state, formAction, pending] = useActionState(
    saveDestinationAction,
    IDLE,
  );

  const [name, setName] = useState(destination?.name ?? "");
  // null means "follow the name"; a string means the editor typed their own.
  const [slugOverride, setSlugOverride] = useState<string | null>(
    destination?.slug ?? null,
  );
  const slug = slugOverride ?? (name ? slugify(name) : "");
  // Mirrored out of the editors so the SEO panel grades what is on
  // screen rather than what was last saved.
  const [seoContent, setSeoContent] = useState(destination?.description ?? "");
  const [seoImage, setSeoImage] = useState(destination?.featuredImage ?? "");

  const [status, setStatus] = useState(destination?.status ?? defaultNewStatus(canPublish));

  const errors = state.fieldErrors ?? {};

  /**
   * Submitting by hand rather than through `<form action=...>`.
   *
   * React resets a form whose action prop is a function once that action
   * completes. On a validation failure that throws away everything the editor
   * typed: uncontrolled inputs fall back to their defaults, and controlled
   * ones are blanked in the DOM without React noticing, which can leave a
   * required field empty and silently block the next submit. Dispatching the
   * same action ourselves skips the reset and leaves the work on screen.
   */
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  const formRef = useRef<HTMLFormElement>(null);
  useFormFeedback(state, formRef);

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
      {destination ? (
        <input type="hidden" name="id" value={destination.id} />
      ) : null}

      <FormSections
        sections={SECTIONS}
        tabs={CONTENT_TABS}
        // A rejected save opens everything: a collapsed section hides its own
        // errors, and "fix the highlighted fields" with nothing visibly
        // highlighted leaves the editor stuck.
        revealAll={!state.ok && Boolean(state.fieldErrors)}
      >
      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          <Card>
            <CardBody className="space-y-5">
              <Field id="name" label="Name" error={errors.name?.[0]} required>
                {(props) => (
                  <Input
                    {...props}
                    name="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Nepal"
                    className="text-base"
                    required
                  />
                )}
              </Field>

              <Field
                id="slug"
                label="Slug"
                error={errors.slug?.[0]}
                hint={
                  <>
                    Typically served at{" "}
                    <code className="rounded bg-muted px-1">
                      {siteUrl}
                      {basePath}/{slug || "…"}/
                    </code>{" "}
                    — the exact route is your frontend&apos;s to decide.
                  </>
                }
                required
              >
                {(props) => (
                  <Input
                    {...props}
                    name="slug"
                    value={slug}
                    onChange={(event) => setSlugOverride(event.target.value)}
                    onBlur={(event) =>
                      setSlugOverride(
                        event.target.value ? slugify(event.target.value) : null,
                      )
                    }
                    placeholder="nepal"
                    className="font-mono text-xs"
                    required
                  />
                )}
              </Field>
            </CardBody>
          </Card>

          <ContentManagementPanel>

          <FormSection id="section-description" title="Overview">
              <RichTextField
                id="description"
                name="description"
                label="Overview"
                hideLabel
                defaultValue={destination?.description ?? ""}
                error={errors.description?.[0]}
                onValueChange={setSeoContent}
              />
          </FormSection>

          <FormSection id="section-images" title="Images">
            <FeaturedImagesField
              record={destination}
              errors={errors}
              onFeaturedChange={setSeoImage}
            />
          </FormSection>

          <FormSection id="section-faqs" title="FAQs">
            <FaqEditor defaultValue={destination?.faqs ?? []} />
          </FormSection>

          </ContentManagementPanel>

          <SeoFields
            id="section-seo"
            seo={destination?.seo ?? null}
            fallbackTitle={name}
            fallbackDescription={richTextExcerpt(seoContent, { maxChars: 160 })}
            slug={`${basePath}/${slug}`}
            siteUrl={siteUrl}
            errors={errors}
            content={seoContent}
            featuredImage={seoImage || null}
          />

        </div>

        {/*
          The rail sticks as one unit so the Fast menu stays reachable after a
          jump. Sticking only the menu was tried and was wrong: its siblings
          scrolled up underneath it and swallowed the Publishing heading.

          `self-start` is load bearing — a grid item stretches to the row height
          by default, which leaves sticky nothing to stick to. The rail can
          outgrow the viewport, so it scrolls itself, and `overscroll-contain`
          stops that scroll chaining into the page.
        */}
        <div className="cms-scroll space-y-5 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:self-start lg:overflow-y-auto lg:overscroll-contain">
          <SeoJumpCard />

          <MediaLibraryPanel />

          <Card>
            <CardHeader title="Publishing" />
            <CardBody className="space-y-4">
              <Field id="status" label="Status" error={errors.status?.[0]}>
                {(props) => (
                  <Select
                    {...props}
                    name="status"
                    value={status}
                    onChange={(event) =>
                      setStatus(event.target.value as Destination["status"])
                    }
                  >
                    <option value="draft">Draft</option>
                    <option value="published" disabled={!canPublish}>
                      Published
                    </option>
                    <option value="scheduled" disabled={!canPublish}>
                      Scheduled
                    </option>
                    <option value="trash">Trash</option>
                  </Select>
                )}
              </Field>

              {!canPublish ? (
                <p className="text-xs text-muted-foreground">
                  Your role can save drafts but not publish them.
                </p>
              ) : null}

              {status === "published" || status === "scheduled" ? (
                <Field
                  id="publishedAt"
                  label={status === "scheduled" ? "Publish at" : "Published on"}
                  error={errors.publishedAt?.[0]}
                  hint={
                    status === "scheduled"
                      ? "Goes live automatically once this time passes."
                      : "Back-date or post-date it. Leave blank to stamp it now."
                  }
                  required={status === "scheduled"}
                >
                  {(props) => (
                    <Input
                      {...props}
                      name="publishedAt"
                      type="datetime-local"
                      defaultValue={toDateTimeLocal(
                        destination?.publishedAt ?? null,
                      )}
                    />
                  )}
                </Field>
              ) : (
                <input
                  type="hidden"
                  name="publishedAt"
                  value={destination?.publishedAt ?? ""}
                />
              )}

              <Button type="submit" disabled={pending} className="w-full">
                <Save className="size-4" />
                {pending
                  ? "Saving…"
                  : destination
                    ? "Save changes"
                    : "Create destination"}
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Placement" />
            <CardBody className="space-y-4">
              <CheckboxField
                id="featured"
                name="featured"
                label="Feature this destination"
                hint="Marks it for the homepage set, read with cms.destinations.getFeatured()."
                defaultChecked={destination?.featured ?? false}
              />

              <Field
                id="order"
                label="Order"
                error={errors.order?.[0]}
                hint="Lower numbers come first in listings."
              >
                {(props) => (
                  <Input
                    {...props}
                    name="order"
                    type="number"
                    defaultValue={destination?.order ?? 0}
                  />
                )}
              </Field>

              <div className="space-y-1.5">
                <Label>Used by</Label>
                <p className="text-xs text-muted-foreground">
                  Regions and tour packages reference this destination.
                </p>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
      </FormSections>
    </form>
  );
}

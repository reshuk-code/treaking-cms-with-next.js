"use client";

import { Save } from "lucide-react";
import {
  startTransition,
  useActionState,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { saveTourCategoryAction } from "@/app/admin/(dashboard)/trip-categories/actions";
import { FeaturedImagesField } from "@/components/cms/featured-images-field";
import {
  ContentManagementPanel,
  FormSection,
  FormSections,
} from "@/components/cms/form-sections";
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
import { richTextExcerpt } from "@/lib/rich-text";
import { toDateTimeLocal } from "@/lib/utils";
import { defaultNewStatus } from "@/lib/publishing";
import { slugify } from "@/schemas/common";
import type { TourCategory } from "@/types/content";

/** One tab per section. See the note in `tour-form.tsx`. */
const CONTENT_TABS = [
  { id: "overview", label: "Overview", sectionIds: ["section-overview"] },
  { id: "images", label: "Images", sectionIds: ["section-images"] },
];

const SECTIONS = [
  { id: "section-overview", label: "Overview" },
  { id: "section-images", label: "Images" },
  { id: "section-seo", label: "SEO" },
];

export interface TourCategoryFormProps {
  category: TourCategory | null;
  /** How many tour packages are tagged with this category. Null on a new one. */
  usedByTours: number | null;
  siteUrl: string;
  /** Where the frontend would mount categories. For the slug hint only. */
  basePath?: string;
  canPublish: boolean;
}

/**
 * The trip category editor.
 *
 * The shortest content editor in the admin: a category is a commercial label —
 * Luxury, VIP — so it gets a name, a picture and a paragraph. Price and
 * inclusions are deliberately absent; what "Luxury" costs is a property of each
 * trip sold under it, not of the label.
 */
export function TourCategoryForm({
  category,
  usedByTours,
  siteUrl,
  basePath = "/trip-categories",
  canPublish,
}: TourCategoryFormProps) {
  const [state, formAction, pending] = useActionState(
    saveTourCategoryAction,
    IDLE,
  );

  const [name, setName] = useState(category?.name ?? "");
  // null means "follow the name"; a string means the editor typed their own.
  const [slugOverride, setSlugOverride] = useState<string | null>(
    category?.slug ?? null,
  );
  const slug = slugOverride ?? (name ? slugify(name) : "");
  const [description, setDescription] = useState(category?.description ?? "");
  // Mirrored out of the Images tab so the SEO panel grades the picture that is
  // on screen rather than the one that was last saved.
  const [seoImage, setSeoImage] = useState(category?.featuredImage ?? "");
  const [status, setStatus] = useState(
    category?.status ?? defaultNewStatus(canPublish),
  );

  const errors = state.fieldErrors ?? {};

  /**
   * Submitting by hand rather than through `<form action=...>`. React resets
   * such a form once the action completes, which throws away everything the
   * editor typed when a save is rejected. See the note in `activity-form.tsx`.
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
      {category ? <input type="hidden" name="id" value={category.id} /> : null}

      <FormSections
        sections={SECTIONS}
        tabs={CONTENT_TABS}
        revealAll={!state.ok && Boolean(state.fieldErrors)}
      >
        <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-5">
            <ContentManagementPanel>
              <FormSection
                id="section-overview"
                title="Overview"
                bodyClassName="space-y-5"
              >
                <Field id="name" label="Name" error={errors.name?.[0]} required>
                  {(props) => (
                    <Input
                      {...props}
                      name="name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Luxury"
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
                    <code className="rounded bg-muted px-1">
                      {siteUrl}
                      {basePath}/{slug || "…"}/
                    </code>
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
                          event.target.value
                            ? slugify(event.target.value)
                            : null,
                        )
                      }
                      placeholder="luxury"
                      className="font-mono text-xs"
                      required
                    />
                  )}
                </Field>

                <RichTextField
                  id="description"
                  name="description"
                  label="Description"
                  error={errors.description?.[0]}
                  defaultValue={description}
                  onValueChange={setDescription}
                />
              </FormSection>

              <FormSection id="section-images" title="Images">
                <FeaturedImagesField
                  record={category}
                  errors={errors}
                  onFeaturedChange={setSeoImage}
                />
              </FormSection>
            </ContentManagementPanel>

            <SeoFields
              id="section-seo"
              seo={category?.seo ?? null}
              fallbackTitle={name}
              fallbackDescription={richTextExcerpt(description, {
                maxChars: 160,
              })}
              slug={`${basePath}/${slug}`}
              siteUrl={siteUrl}
              errors={errors}
              content={description}
              featuredImage={seoImage || null}
            />
          </div>

          <div className="space-y-5">
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
                        setStatus(event.target.value as TourCategory["status"])
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
                          category?.publishedAt ?? null,
                        )}
                      />
                    )}
                  </Field>
                ) : (
                  <input
                    type="hidden"
                    name="publishedAt"
                    value={category?.publishedAt ?? ""}
                  />
                )}

                <Button type="submit" disabled={pending} className="w-full">
                  <Save className="size-4" />
                  {pending
                    ? "Saving…"
                    : category
                      ? "Save changes"
                      : "Create category"}
                </Button>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Placement" />
              <CardBody className="space-y-4">
                <CheckboxField
                  id="featured"
                  name="featured"
                  label="Feature this category"
                  hint="Marks it for a homepage strip, read with cms.tourCategories.getFeatured()."
                  defaultChecked={category?.featured ?? false}
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
                      defaultValue={category?.order ?? 0}
                    />
                  )}
                </Field>

                <hr className="border-border" />

                <div className="space-y-1.5">
                  <Label>Used by</Label>
                  <p className="text-xs text-muted-foreground">
                    {usedByTours === null
                      ? "Trips can be tagged with this category once it is saved."
                      : usedByTours === 0
                        ? "No trips use this category yet."
                        : `${usedByTours} trip${
                            usedByTours === 1 ? "" : "s"
                          } tagged with this category.`}
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

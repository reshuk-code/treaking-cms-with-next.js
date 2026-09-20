"use client";

import Link from "next/link";
import {
  startTransition,
  useActionState,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import {
  changeTravellerPasswordAction,
  registerAction,
  travellerSignInAction,
  updateProfileAction,
} from "@/app/(frontend)/account/actions";
import { IDLE, type ActionState } from "@/lib/actions/result";
import type { CmsUser } from "@/types/user";

/**
 * Traveller account forms — a reference implementation.
 *
 * Deliberately plain markup with no design system, exactly like
 * `enquiry-form.tsx`: these exist to show the seam between the public site and
 * the auth layer, and a real client project restyles them wholesale.
 *
 * All four submit through `onSubmit` rather than `<form action={…}>`. React
 * resets a form whose `action` prop is a function as soon as the action
 * resolves, so a rejected sign-up would hand back an empty form and no
 * explanation of which field was wrong. See CLAUDE.md, "Form rules".
 */

const INPUT =
  "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm";

const BUTTON =
  "rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60";

function Labelled({
  label,
  error,
  required,
  hint,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </span>
      {children}
      {hint && !error ? (
        <span className="block text-xs text-muted-foreground">{hint}</span>
      ) : null}
      {error ? <span className="block text-xs text-destructive">{error}</span> : null}
    </label>
  );
}

/** The form-level message. Field errors render beside their own field. */
function Notice({ state }: { state: ActionState }) {
  if (!state.message) return null;

  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={
        state.ok
          ? "rounded-xl bg-muted px-3 py-2 text-sm"
          : "rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      }
    >
      {state.message}
    </p>
  );
}

function submitHandler(action: (data: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => action(formData));
  };
}

export function TravellerLoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(
    travellerSignInAction,
    IDLE,
  );

  return (
    <form onSubmit={submitHandler(formAction)} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Notice state={state} />

      <Labelled label="Email" required>
        <input
          name="email"
          type="email"
          required
          autoComplete="username"
          className={INPUT}
        />
      </Labelled>

      <Labelled label="Password" required>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={INPUT}
        />
      </Labelled>

      <button type="submit" disabled={pending} className={BUTTON}>
        {pending ? "Signing in…" : "Sign in"}
      </button>

      <p className="text-sm text-muted-foreground">
        No account yet?{" "}
        <Link href="/account/register" className="font-medium underline">
          Create one
        </Link>
      </p>
    </form>
  );
}

export function TravellerRegisterForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(registerAction, IDLE);
  const errors = state.fieldErrors ?? {};

  return (
    <form onSubmit={submitHandler(formAction)} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Notice state={state} />

      <Labelled label="Your name" error={errors.name?.[0]} required>
        <input name="name" required autoComplete="name" className={INPUT} />
      </Labelled>

      <Labelled label="Email" error={errors.email?.[0]} required>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className={INPUT}
        />
      </Labelled>

      <div className="grid gap-4 sm:grid-cols-2">
        <Labelled label="Phone" error={errors.phone?.[0]}>
          <input name="phone" autoComplete="tel" className={INPUT} />
        </Labelled>

        <Labelled label="Country" error={errors.country?.[0]}>
          <input name="country" autoComplete="country-name" className={INPUT} />
        </Labelled>
      </div>

      <Labelled
        label="Password"
        error={errors.password?.[0]}
        hint="At least 10 characters."
        required
      >
        <input
          name="password"
          type="password"
          required
          autoComplete="new-password"
          className={INPUT}
        />
      </Labelled>

      <Labelled
        label="Confirm password"
        error={errors.confirmPassword?.[0]}
        required
      >
        <input
          name="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          className={INPUT}
        />
      </Labelled>

      <button type="submit" disabled={pending} className={BUTTON}>
        {pending ? "Creating account…" : "Create account"}
      </button>

      <p className="text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/account/login" className="font-medium underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function TravellerProfileForm({ traveller }: { traveller: CmsUser }) {
  const [state, formAction, pending] = useActionState(updateProfileAction, IDLE);
  const errors = state.fieldErrors ?? {};

  return (
    <form onSubmit={submitHandler(formAction)} className="space-y-4">
      <Notice state={state} />

      <Labelled label="Your name" error={errors.name?.[0]} required>
        <input
          name="name"
          required
          autoComplete="name"
          defaultValue={traveller.name}
          className={INPUT}
        />
      </Labelled>

      <div className="grid gap-4 sm:grid-cols-2">
        <Labelled label="Phone" error={errors.phone?.[0]}>
          <input
            name="phone"
            autoComplete="tel"
            defaultValue={traveller.phone ?? ""}
            className={INPUT}
          />
        </Labelled>

        <Labelled label="Country" error={errors.country?.[0]}>
          <input
            name="country"
            autoComplete="country-name"
            defaultValue={traveller.country ?? ""}
            className={INPUT}
          />
        </Labelled>
      </div>

      {/*
        Email is shown but not editable. With no mailer in this template there
        is nothing to confirm a new address against, and an unconfirmed email
        change is how an account gets taken over. See docs/ROADMAP.md.
      */}
      <Labelled label="Email" hint="Contact us if you need this changed.">
        <input
          value={traveller.email}
          readOnly
          disabled
          className={INPUT + " text-muted-foreground"}
        />
      </Labelled>

      <button type="submit" disabled={pending} className={BUTTON}>
        {pending ? "Saving…" : "Save details"}
      </button>
    </form>
  );
}

export function TravellerPasswordForm() {
  const [state, formAction, pending] = useActionState(
    changeTravellerPasswordAction,
    IDLE,
  );
  const errors = state.fieldErrors ?? {};

  // Emptied on success only. A rejected change must keep what was typed, or
  // the visitor retypes three fields to fix one of them.
  const [formKey, setFormKey] = useState(0);
  const [lastHandled, setLastHandled] = useState(IDLE);

  // Adjusted during render rather than in an effect, which the lint rule
  // forbids here (CLAUDE.md, "Form rules").
  if (state !== lastHandled) {
    setLastHandled(state);
    if (state.ok) setFormKey((value) => value + 1);
  }

  return (
    <form
      key={formKey}
      onSubmit={submitHandler(formAction)}
      className="space-y-4"
    >
      <Notice state={state} />

      <Labelled
        label="Current password"
        error={errors.currentPassword?.[0]}
        required
      >
        <input
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          className={INPUT}
        />
      </Labelled>

      <Labelled
        label="New password"
        error={errors.newPassword?.[0]}
        hint="At least 10 characters."
        required
      >
        <input
          name="newPassword"
          type="password"
          required
          autoComplete="new-password"
          className={INPUT}
        />
      </Labelled>

      <Labelled
        label="Confirm new password"
        error={errors.confirmPassword?.[0]}
        required
      >
        <input
          name="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          className={INPUT}
        />
      </Labelled>

      <button type="submit" disabled={pending} className={BUTTON}>
        {pending ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}

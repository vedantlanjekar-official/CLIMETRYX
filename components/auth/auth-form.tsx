"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import type { AuthState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/primitives";

function autoCompleteFor(name: string, title: string) {
  if (name === "password") return title.toLowerCase().includes("welcome") ? "current-password" : "new-password";
  if (name === "displayName") return "name";
  return "email";
}

const inputClass =
  "w-full rounded-2xl border border-line-strong bg-white/90 px-4 py-3 text-center text-sm text-ink shadow-[0_1px_2px_rgb(15_31_29/0.04)] transition placeholder:text-muted/60 hover:border-brand-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100";

function PasswordInput({ name, autoComplete, placeholder }: { name: string; autoComplete: string; placeholder?: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        id={name}
        name={name}
        type={visible ? "text" : "password"}
        required
        minLength={8}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={`${inputClass} px-11`}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-2 my-auto grid h-8 w-8 place-items-center rounded-full text-muted transition hover:bg-brand-50 hover:text-brand-700"
      >
        {visible ? <EyeOff aria-hidden className="h-4 w-4" /> : <Eye aria-hidden className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function AuthForm({
  action,
  title,
  subtitle,
  fields,
  submitLabel,
  extra,
  hidden,
}: {
  action: (state: AuthState, formData: FormData) => Promise<AuthState>;
  title: string;
  subtitle?: string;
  fields: Array<{ name: string; label: string; type: string; placeholder?: string }>;
  submitLabel: string;
  extra?: React.ReactNode;
  hidden?: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(action, { message: "" });
  return (
    <form action={formAction} className="flex flex-col items-center gap-6 text-center">
      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <div>
        <h1 className="text-balance text-3xl xl:text-[2.1rem]">{title}</h1>
        {subtitle ? <p className="mx-auto mt-2 max-w-xs text-balance text-sm leading-relaxed text-muted">{subtitle}</p> : null}
      </div>
      <div className="flex w-full flex-col gap-4">
        {fields.map((field) => (
          <div key={field.name} className="flex flex-col gap-1.5">
            <label htmlFor={field.name} className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">
              {field.label}
            </label>
            {field.type === "password" ? (
              <PasswordInput name={field.name} autoComplete={autoCompleteFor(field.name, title)} placeholder={field.placeholder} />
            ) : (
              <input
                id={field.name}
                name={field.name}
                type={field.type}
                required
                autoComplete={autoCompleteFor(field.name, title)}
                placeholder={field.placeholder}
                className={inputClass}
              />
            )}
          </div>
        ))}
      </div>
      {extra}
      {state.message ? (
        <p
          className={
            state.ok
              ? "w-full rounded-xl bg-ok-100 px-3 py-2 text-sm text-ok-700"
              : "w-full rounded-xl bg-danger-100 px-3 py-2 text-sm text-danger-700"
          }
          role="status"
        >
          {state.message}
        </p>
      ) : null}
      <Button disabled={pending} type="submit" className="group w-full rounded-2xl py-3.5 text-[0.95rem]">
        {pending ? (
          <>
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> Working…
          </>
        ) : (
          <>
            {submitLabel}
            <ArrowRight aria-hidden className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </>
        )}
      </Button>
    </form>
  );
}

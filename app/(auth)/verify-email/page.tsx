import Link from "next/link";
import { MailCheck } from "lucide-react";

export default function VerifyEmailPage() {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
        <MailCheck aria-hidden className="h-7 w-7" />
      </span>
      <h1 className="mt-5 text-3xl">Check your email</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">
        Supabase Auth sends the confirmation message when email confirmation is enabled for the project. This screen does not invent a delivery receipt.
      </p>
      <Link href="/login" className="mt-6 text-sm font-semibold text-brand-600 hover:text-brand-800">
        Back to sign in
      </Link>
    </div>
  );
}

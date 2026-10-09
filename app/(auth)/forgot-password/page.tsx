import Link from "next/link";
import { requestReset } from "@/lib/actions/auth";
import { AuthForm } from "@/components/auth/auth-form";

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthForm
        action={requestReset}
        title="Reset password"
        subtitle="Enter your account email and Supabase Auth will send a reset link."
        submitLabel="Send reset link"
        fields={[{ name: "email", label: "Email", type: "email", placeholder: "you@company.com" }]}
      />
      <p className="mt-6 text-sm text-muted">
        Remembered it? <Link className="font-semibold text-brand-600 hover:text-brand-800" href="/login">Back to sign in</Link>
      </p>
    </>
  );
}

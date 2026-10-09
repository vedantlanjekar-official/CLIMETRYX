import Link from "next/link";
import { signUp } from "@/lib/actions/auth";
import { AuthForm } from "@/components/auth/auth-form";

export default function SignUpPage() {
  return (
    <>
      <AuthForm
        action={signUp}
        title="Create your account"
        subtitle="Start a transparent climate-disruption assessment."
        submitLabel="Create account"
        fields={[
          { name: "displayName", label: "Display name", type: "text", placeholder: "Your name" },
          { name: "email", label: "Email", type: "email", placeholder: "you@company.com" },
          { name: "password", label: "Password", type: "password", placeholder: "At least 8 characters" },
        ]}
      />
      <p className="mt-6 text-sm text-muted">
        Already registered? <Link className="font-semibold text-brand-600 hover:text-brand-800" href="/login">Sign in</Link>
      </p>
    </>
  );
}

import Link from "next/link";
import { signIn } from "@/lib/actions/auth";
import { AuthForm } from "@/components/auth/auth-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { next } = await searchParams;
  return (
    <>
      <AuthForm
        action={signIn}
        hidden={typeof next === "string" ? { next } : undefined}
        title="Welcome back"
        subtitle="Sign in to your CLIMETRYX workspace."
        submitLabel="Sign in"
        fields={[
          { name: "email", label: "Email", type: "email", placeholder: "you@company.com" },
          { name: "password", label: "Password", type: "password", placeholder: "Your password" },
        ]}
        extra={
          <Link className="-mt-2 text-sm font-semibold text-brand-600 no-underline hover:text-brand-800" href="/forgot-password">
            Forgot password?
          </Link>
        }
      />
      <p className="mt-6 text-sm text-muted">
        New here? <Link className="font-semibold text-brand-600 hover:text-brand-800" href="/signup">Create an account</Link>
      </p>
    </>
  );
}

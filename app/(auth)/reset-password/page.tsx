import { updatePassword } from "@/lib/actions/auth";
import { AuthForm } from "@/components/auth/auth-form";

export default function ResetPasswordPage() {
  return (
    <AuthForm
      action={updatePassword}
      title="Choose a new password"
      subtitle="Use at least 8 characters."
      submitLabel="Update password"
      fields={[{ name: "password", label: "New password", type: "password", placeholder: "At least 8 characters" }]}
    />
  );
}

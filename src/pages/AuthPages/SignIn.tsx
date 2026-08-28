import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignInForm from "../../components/auth/SignInForm";

export default function SignIn() {
  return (
    <>
      <PageMeta
        title="Sign In | LGU Saint Bernard E-Procurement"
        description="Sign in to the LGU Saint Bernard E-Procurement System."
      />
      <AuthLayout>
        <SignInForm />
      </AuthLayout>
    </>
  );
}

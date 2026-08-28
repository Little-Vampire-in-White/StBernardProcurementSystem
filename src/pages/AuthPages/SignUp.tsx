import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignUpForm from "../../components/auth/SignUpForm";

export default function SignUp() {
  return (
    <>
      <PageMeta
        title="Register | LGU Saint Bernard E-Procurement"
        description="Register for the LGU Saint Bernard E-Procurement System."
      />
      <AuthLayout>
        <SignUpForm />
      </AuthLayout>
    </>
  );
}

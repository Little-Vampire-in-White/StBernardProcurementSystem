import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ChevronLeftIcon, EyeCloseIcon, EyeIcon } from "../../icons";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import Select from "../form/Select";
import Checkbox from "../form/input/Checkbox";
import Button from "../ui/button/Button";
import { RoleType, useAuth } from "../../context/AuthContext";

export default function SignUpForm() {
  const navigate = useNavigate();
  const { register, googleSignIn } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [department, setDepartment] = useState("");
  const [barangayId, setBarangayId] = useState("");
  const [barangays, setBarangays] = useState<{ id: number; name: string }[]>([]);
  const [role, setRole] = useState<RoleType>("BarangayTreasurer");
  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const loadBarangays = async () => {
      try {
        const res = await fetch('/api/barangays');
        const data = await res.json();
        if (res.ok && Array.isArray(data.barangays)) {
          setBarangays(data.barangays);
        }
      } catch (error) {
        console.warn('Unable to load barangays', error);
      }
    };

    loadBarangays();
  }, []);

  const roleOptions: { value: RoleType; label: string }[] = [
    { value: "BarangayTreasurer", label: "Barangay Treasurer" },
    { value: "SKTreasurer", label: "Sangguniang Kabataan Treasurer" },
    { value: "SKChairman", label: "Sangguniang Kabataan Chairman" },
    { value: "BarangayBookkeeper", label: "Barangay Bookkeeper" },
    { value: "SKBookkeeper", label: "Sangguniang Kabataan Bookkeeper" },
    { value: "MunicipalAccountant", label: "Municipal Accountant" },
  ];

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!firstName || !lastName) {
      setErrorMessage("Provide your first and last name.");
      return;
    }

    if (!email) {
      setErrorMessage("Provide a valid email address.");
      return;
    }

    if (role !== 'MunicipalAccountant' && !barangayId) {
      setErrorMessage("Select the barangay for this role before continuing.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }

    if (!isChecked) {
      setErrorMessage("Please agree to the terms to continue.");
      return;
    }

    setIsSubmitting(true);
    try {
      await register(
        email,
        password,
        `${firstName} ${lastName}`,
        role,
        department,
        barangayId,
      );
      if (role !== 'MunicipalAccountant') {
        navigate("/signin", { replace: true, state: { approvalNotice: 'Your account is pending administrator approval.' } });
      } else {
        navigate("/signin", { replace: true });
      }
    } catch (error) {
      setErrorMessage("Sign up failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setErrorMessage(null);
    setIsGoogleSubmitting(true);
    try {
      const googleResult = await googleSignIn();
      if (googleResult.profile?.status === 'active') {
        navigate("/procurement/purchase-requests", { replace: true });
      } else if (googleResult.profile) {
        navigate("/signin", { replace: true, state: { approvalNotice: 'Your account is pending administrator approval.' } });
      } else {
        navigate("/signin", { replace: true, state: { googleAccount: googleResult.account } });
      }
    } catch (error) {
      setErrorMessage("Google sign-up failed. Please try again.");
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 w-full overflow-y-auto lg:w-1/2 no-scrollbar">
      <div className="w-full max-w-md mx-auto mb-5 sm:pt-10">
        <Link
          to="/"
          className="inline-flex items-center text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <ChevronLeftIcon className="size-5" />
          Back to dashboard
        </Link>
      </div>
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
              Sign Up
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Enter your email and password to sign up!
            </p>
          </div>
          <div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5">
              <button
                type="button"
                onClick={handleGoogleSignUp}
                disabled={isGoogleSubmitting}
                className="inline-flex items-center justify-center gap-3 py-3 text-sm font-normal text-gray-700 transition-colors bg-gray-100 rounded-lg px-7 hover:bg-gray-200 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white/5 dark:text-white/90 dark:hover:bg-white/10"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M18.7511 10.1944C18.7511 9.47495 18.6915 8.94995 18.5626 8.40552H10.1797V11.6527H15.1003C15.0011 12.4597 14.4654 13.675 13.2749 14.4916L13.2582 14.6003L15.9087 16.6126L16.0924 16.6305C17.7788 15.1041 18.7511 12.8583 18.7511 10.1944Z"
                    fill="#4285F4"
                  />
                  <path
                    d="M10.1788 18.75C12.5895 18.75 14.6133 17.9722 16.0915 16.6305L13.274 14.4916C12.5201 15.0068 11.5081 15.3666 10.1788 15.3666C7.81773 15.3666 5.81379 13.8402 5.09944 11.7305L4.99473 11.7392L2.23868 13.8295L2.20264 13.9277C3.67087 16.786 6.68674 18.75 10.1788 18.75Z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.10014 11.7305C4.91165 11.186 4.80257 10.6027 4.80257 9.99992C4.80257 9.3971 4.91165 8.81379 5.09022 8.26935L5.08523 8.1534L2.29464 6.02954L2.20333 6.0721C1.5982 7.25823 1.25098 8.5902 1.25098 9.99992C1.25098 11.4096 1.5982 12.7415 2.20333 13.9277L5.10014 11.7305Z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M10.1789 4.63331C11.8554 4.63331 12.9864 5.34303 13.6312 5.93612L16.1511 3.525C14.6035 2.11528 12.5895 1.25 10.1789 1.25C6.68676 1.25 3.67088 3.21387 2.20264 6.07218L5.08953 8.26943C5.81381 6.15972 7.81776 4.63331 10.1789 4.63331Z"
                    fill="#EB4335"
                  />
                </svg>
                {isGoogleSubmitting ? "Connecting..." : "Sign up with Google"}
              </button>
              <button className="inline-flex items-center justify-center gap-3 py-3 text-sm font-normal text-gray-700 transition-colors bg-gray-100 rounded-lg px-7 hover:bg-gray-200 hover:text-gray-800 dark:bg-white/5 dark:text-white/90 dark:hover:bg-white/10">
                <svg
                  width="21"
                  className="fill-current"
                  height="20"
                  viewBox="0 0 21 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M15.6705 1.875H18.4272L12.4047 8.75833L19.4897 18.125H13.9422L9.59717 12.4442L4.62554 18.125H1.86721L8.30887 10.7625L1.51221 1.875H7.20054L11.128 7.0675L15.6705 1.875ZM14.703 16.475H16.2305L6.37054 3.43833H4.73137L14.703 16.475Z" />
                </svg>
                Sign up with X
              </button>
            </div>
            <div className="relative py-3 sm:py-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200 dark:border-gray-800"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="p-2 text-gray-400 bg-white dark:bg-gray-900 sm:px-5 sm:py-2">
                  Or
                </span>
              </div>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-1">
                    <Label>
                      First Name<span className="text-error-500">*</span>
                    </Label>
                    <Input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Enter your first name"
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <Label>
                      Last Name<span className="text-error-500">*</span>
                    </Label>
                    <Input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Enter your last name"
                    />
                  </div>
                </div>
                {role !== "MunicipalAccountant" && <div>
                  <Label>
                    Email<span className="text-error-500">*</span>
                  </Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                  />
                </div>}
                <div>
                  <Label>
                    Password<span className="text-error-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      placeholder="Enter your password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <span
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                    >
                      {showPassword ? (
                        <EyeIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                      ) : (
                        <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                      )}
                    </span>
                  </div>
                </div>
                <div>
                  <Label>Department / Office</Label>
                  <Input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Health, Public Works"
                  />
                </div>
                <div>
                  <Label>Barangay</Label>
                  <Select
                    options={barangays.map((item) => ({ value: String(item.id), label: item.name }))}
                    placeholder="Select barangay"
                    defaultValue={barangayId}
                    onChange={(value) => setBarangayId(value)}
                  />
                </div>
                <div>
                  <Label>Role</Label>
                  <Select
                    options={roleOptions.map((option) => ({
                      value: option.value,
                      label: option.label,
                    }))}
                    defaultValue={role}
                    onChange={(value) => setRole(value as RoleType)}
                  />
                </div>
                {errorMessage && (
                  <p className="text-sm font-medium text-center text-error-500">
                    {errorMessage}
                  </p>
                )}
                <div className="flex items-center gap-3">
                  <Checkbox
                    className="w-5 h-5"
                    checked={isChecked}
                    onChange={setIsChecked}
                  />
                  <p className="inline-block font-normal text-gray-500 dark:text-gray-400">
                    By creating an account you agree to our terms and policy.
                  </p>
                </div>
                <div>
                  <Button
                    size="sm"
                    className="w-full"
                    type="submit"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Creating account..." : "Sign Up"}
                  </Button>
                </div>
              </div>
            </form>

            <div className="mt-5">
              <p className="text-sm font-normal text-center text-gray-700 dark:text-gray-400 sm:text-start">
                Already have an account? {""}
                <Link
                  to="/signin"
                  className="text-brand-500 hover:text-brand-600 dark:text-brand-400"
                >
                  Sign In
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

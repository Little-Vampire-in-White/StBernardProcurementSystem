import PageMeta from "../../components/common/PageMeta";
import { Link } from "react-router";

export default function Unauthorized() {
  return (
    <>
      <PageMeta
        title="Unauthorized | E-Procurement"
        description="Access denied for this page."
      />
      <div className="min-h-screen grid place-items-center bg-gray-50 px-4 py-16 dark:bg-gray-950">
        <div className="w-full max-w-xl rounded-3xl border border-gray-200 bg-white p-10 text-center shadow-lg dark:border-gray-800 dark:bg-gray-900">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">403</h1>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
            You do not have permission to view this resource.
          </p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Please contact your administrator if you believe this is an error.
          </p>
          <Link
            to="/"
            className="mt-8 inline-flex rounded-full bg-brand-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-600"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </>
  );
}

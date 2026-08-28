export default function FullScreenLoader() {
  return (
    <div className="min-h-screen grid place-items-center bg-gray-50 dark:bg-gray-950">
      <div className="rounded-2xl border border-gray-200 bg-white px-6 py-5 text-center shadow-lg dark:border-gray-800 dark:bg-gray-900">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
          Loading application data...
        </p>
      </div>
    </div>
  );
}

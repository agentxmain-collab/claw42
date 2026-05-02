import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6">
      <div className="text-center">
        <p className="mb-4 font-mono text-sm text-[#7c5cff]">404</p>
        <h1 className="mb-4 text-3xl font-bold text-white md:text-4xl">Page not found</h1>
        <p className="mb-8 text-gray-400">The page you&apos;re looking for doesn&apos;t exist.</p>
        <Link
          href="/"
          className="inline-flex items-center rounded-xl bg-[#7c5cff] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#8e6bff]"
        >
          Back to Claw 42
        </Link>
      </div>
    </main>
  );
}

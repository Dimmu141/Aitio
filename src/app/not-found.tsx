import Link from "next/link";
import { t } from "@/i18n/fi";

export default function NotFound() {
  return (
    <>
      <h1 className="text-display">{t.notFound.title}</h1>
      <p className="mt-3">{t.notFound.body}</p>
      <p className="mt-6">
        <Link href="/" className="inline-flex min-h-tap items-center rounded-md bg-accent px-6 text-button text-on-accent no-underline hover:bg-accent-strong hover:text-on-accent">
          {t.notFound.home}
        </Link>
      </p>
    </>
  );
}

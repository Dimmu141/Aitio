import Link from "next/link";
import { getDictionary } from "@/i18n";
import { href } from "@/i18n/paths";

export default async function NotFound() {
  const { locale, t } = await getDictionary();
  return (
    <div className="space-y-4">
      <h1 className="text-display">{t.notFound.title}</h1>
      <p>{t.notFound.body}</p>
      <p>
        <Link href={href(locale)} className="inline-flex min-h-tap items-center text-lg">
          {t.notFound.back}
        </Link>
      </p>
    </div>
  );
}

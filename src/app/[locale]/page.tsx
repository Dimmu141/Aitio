import { getDictionary } from "@/i18n";

export default async function HomePage() {
  const { t } = await getDictionary();
  return <h1 className="text-4xl font-semibold">{t.home.title}</h1>;
}

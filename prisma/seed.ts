import "dotenv/config";
import { db } from "../src/lib/db";
import { TAGS } from "../src/lib/diary/tags";
import { THEATRES } from "../src/scrapers/theatres";

async function main(): Promise<void> {
  for (const theatre of THEATRES) {
    await db.theatre.upsert({
      where: { slug: theatre.slug },
      create: theatre,
      update: theatre,
    });
  }
  console.log(`Seeded ${THEATRES.length} theatres`);
  for (const [sortOrder, tag] of TAGS.entries()) {
    await db.tag.upsert({ where: { slug: tag.slug }, create: { ...tag, sortOrder }, update: { ...tag, sortOrder } });
  }
  console.log(`Seeded ${TAGS.length} tags`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

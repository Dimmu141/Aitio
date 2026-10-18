import "dotenv/config";
import { db } from "../src/lib/db";
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
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

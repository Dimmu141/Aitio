import "dotenv/config";
import { db } from "../src/lib/db";
import { personFix } from "../src/lib/ops/people";

/**
 * Usage:
 *   pnpm people:merge           # dry run: what would change
 *   pnpm people:merge --apply   # merge and delete
 *
 * Fixes Person rows saved before the scraper split credit cells (18 Oct 2026): "Silva
 * Lillrank och Outi Paasivirta" becomes two people, "Starman Työryhmä" goes. Credits move
 * to the real people (an existing credit keeps the newer lastSeenAt), then the empty rows
 * are deleted. The one exception to "never hard-delete": these rows are not people.
 * Safe to run again; a second run finds nothing.
 */
async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const people = await db.person.findMany({ include: { credits: true }, orderBy: { name: "asc" } });
  let merged = 0;
  let dropped = 0;
  let orphans = 0;

  for (const person of people) {
    if (person.credits.length === 0) {
      orphans += 1;
      console.log(`  orphan    ${person.name}`);
      if (apply) await db.person.delete({ where: { id: person.id } });
      continue;
    }
    const fix = personFix(person);
    if (fix.action === "keep") continue;
    if (fix.action === "drop") {
      dropped += 1;
      console.log(`  drop      ${person.name} (${person.credits.length} credits)`);
      if (apply) {
        await db.$transaction([db.credit.deleteMany({ where: { personId: person.id } }), db.person.delete({ where: { id: person.id } })]);
      }
      continue;
    }
    merged += 1;
    console.log(`  merge     ${person.name} → ${fix.into.map((target) => target.name).join(" | ")}`);
    if (!apply) continue;
    await db.$transaction(async (tx) => {
      for (const target of fix.into) {
        const real = await tx.person.upsert({ where: { slug: target.slug }, create: target, update: {} });
        for (const credit of person.credits) {
          const key = { personId_productionId_role: { personId: real.id, productionId: credit.productionId, role: credit.role } };
          const existing = await tx.credit.findUnique({ where: key });
          if (existing) {
            await tx.credit.update({
              where: { id: existing.id },
              data: {
                lastSeenAt: existing.lastSeenAt > credit.lastSeenAt ? existing.lastSeenAt : credit.lastSeenAt,
                roleText: existing.roleText ?? credit.roleText,
                characterName: existing.characterName ?? credit.characterName,
              },
            });
          } else {
            const { productionId, role, roleText, characterName, sortOrder, lastSeenAt } = credit;
            await tx.credit.create({ data: { personId: real.id, productionId, role, roleText, characterName, sortOrder, lastSeenAt } });
          }
        }
      }
      await tx.credit.deleteMany({ where: { personId: person.id } });
      await tx.person.delete({ where: { id: person.id } });
    });
  }

  console.log(`${merged} merged, ${dropped} dropped, ${orphans} orphans${apply ? "" : " (dry run, nothing changed)"}`);
  if (apply) console.log("The catalogue cache refreshes after the next scrape, or redeploy to see it now.");
  await db.$disconnect();
}

void main();

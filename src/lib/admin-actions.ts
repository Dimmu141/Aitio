"use server";

import { notFound, redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { z } from "zod";
import { ProductionType } from "@/generated/prisma/enums";
import { CATALOGUE_TAG } from "@/lib/catalogue/queries";
import { productionTag } from "@/lib/catalogue/tags";
import { moderate } from "@/lib/diary/service";
import { setTypeOverride } from "@/lib/ops/catalogue-admin";
import { isAdmin } from "@/lib/ops/admin";
import { getCurrentUser } from "@/lib/session";

const ADMIN_PATH = "/yllapito";

/** Every admin action re-checks: a forged form post from a non-admin is a 404. */
async function requireAdmin(): Promise<void> {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.email)) notFound();
}

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function setTypeOverrideAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const type = z.enum(ProductionType).or(z.literal("")).parse(field(formData, "type"));
  const slug = await setTypeOverride(field(formData, "productionId"), type === "" ? null : type);
  // The type shows on cards everywhere, not only on the production page.
  updateTag(CATALOGUE_TAG);
  if (slug) updateTag(productionTag(slug));
  redirect(`${ADMIN_PATH}?saved=type#tyypit`);
}

export async function moderateAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const slug = await moderate(field(formData, "entryId"), field(formData, "decision") === "hide");
  if (slug) updateTag(productionTag(slug));
  redirect(`${ADMIN_PATH}?saved=moderation#ilmoitukset`);
}

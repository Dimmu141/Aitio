import { config } from "dotenv";
import { checkLaunchEnv } from "../src/lib/ops/launch-check";

/**
 * Usage: vercel env pull .env.production.local --environment=production
 *        pnpm launch:check .env.production.local
 * Reads only the given file, so local development values can't hide a gap.
 */
const file = process.argv[2];
if (!file) {
  console.error("Usage: pnpm launch:check <env file>");
  process.exit(2);
}
const { parsed, error } = config({ path: file, processEnv: {}, quiet: true });
if (error || !parsed) {
  console.error(`Could not read ${file}: ${error?.message ?? "empty"}`);
  process.exit(2);
}

const findings = checkLaunchEnv(parsed);
for (const finding of findings) {
  console.log(`${finding.level === "error" ? "✗" : "!"} ${finding.variable}: ${finding.message}`);
}
const errors = findings.filter((finding) => finding.level === "error").length;
console.log(errors === 0 ? `Ready (${findings.length} warnings).` : `${errors} errors must be fixed before launch.`);
process.exitCode = errors === 0 ? 0 : 1;

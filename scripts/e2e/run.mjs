// Runs the end-to-end suites against a running app.
//
//   npx supabase start            # local database (Docker)
//   npm run dev                   # or: npm run build && npm start
//   npm run test:e2e              # all suites
//   npm run test:e2e -- 02        # only suites whose file name contains "02"
//
// E2E_BASE_URL overrides the app URL (default http://localhost:3000).
import { readdir } from "node:fs/promises";
import { assertLocalTarget, BASE_URL, createContext } from "./lib.mjs";

assertLocalTarget();

try {
  await fetch(BASE_URL, { redirect: "manual" });
} catch {
  console.error(
    `App not reachable at ${BASE_URL}. Start it with "npm run dev".`,
  );
  process.exit(1);
}

const filters = process.argv.slice(2);
const files = (await readdir(new URL(".", import.meta.url)))
  .filter((file) => /^\d+-.+\.mjs$/.test(file))
  .filter(
    (file) => filters.length === 0 || filters.some((f) => file.includes(f)),
  )
  .sort();

let totalPassed = 0;
let totalFailed = 0;

for (const file of files) {
  const suite = await import(new URL(file, import.meta.url));
  console.log(`\n${suite.title ?? file}`);
  const ctx = createContext();
  try {
    await suite.default(ctx);
  } catch (error) {
    ctx.check("suite finished without throwing", false, error?.stack ?? error);
  }
  const { passed, failed } = ctx.results();
  totalPassed += passed;
  totalFailed += failed;
}

console.log(
  `\n${totalFailed === 0 ? "ALL PASSED" : "FAILED"}: ${totalPassed} passed, ${totalFailed} failed (${files.length} suites)`,
);
process.exit(totalFailed === 0 && files.length > 0 ? 0 : 1);

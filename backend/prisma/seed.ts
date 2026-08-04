import { runSeed } from "../src/utils/seedData";
import { prisma } from "../src/config/prisma";

async function main() {
  console.log("Seeding Fair Savings...");
  const log = await runSeed();
  log.forEach((line) => console.log(line));
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

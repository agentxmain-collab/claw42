import fs from "node:fs";
import path from "node:path";

const docs = ["老K.md", "老白.md", "老G.md"];
const baseDir = path.join(process.cwd(), "docs", "agent-ip");
const required = ["核心身份", "说话方式", "招牌话术", "反派别态度", "输出纪律"];
const failures = [];

for (const doc of docs) {
  const filePath = path.join(baseDir, doc);
  if (!fs.existsSync(filePath)) {
    failures.push(`${doc}: missing`);
    continue;
  }

  const content = fs.readFileSync(filePath, "utf8");
  for (const marker of required) {
    if (!content.includes(marker)) failures.push(`${doc}: missing ${marker}`);
  }
}

if (failures.length > 0) {
  console.error("[claw42] agent IP verification failed");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.info("[claw42] agent IP verification passed");

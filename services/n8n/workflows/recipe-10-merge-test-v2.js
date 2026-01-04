// Test script v2 for Recipe 10 merge logic fix

const mockTodoContent = `## Today — 2025-12-01

### High Priority
- [ ] Old urgent task

### Regular Tasks
- [ ] Old regular task

---

## 📋 システム情報

- **Obsidian REST API**: https://127.0.0.1:27124/`;

const mockNewTasks = [
  "- [ ] [Cortex] ⚡ Recipe 10 の Merge ロジック修正  <!-- #urgent -->",
  "- [ ] Cortex OS ヘルスチェック継続監視",
];

console.log("=== Test v2: Including --- in regex ===\n");

// IMPROVED: Match including the --- separator
const todayRegex = /^## Today — \d{4}-\d{2}-\d{2}\s*\n[\s\S]*?^---\s*$/m;
const cleaned = mockTodoContent.replace(todayRegex, "").trim();

console.log("After removing old section:");
console.log(cleaned);
console.log("");

// Build new section
const today = "2025-12-02";
const urgentTasks = mockNewTasks.filter((t) => t.includes("#urgent"));
const regularTasks = mockNewTasks.filter((t) => !t.includes("#urgent"));

let newSection = `## Today — ${today}\n\n`;
newSection += "### High Priority\n";
if (urgentTasks.length > 0) {
  urgentTasks.forEach((task) => {
    newSection += `${task}\n`;
  });
} else {
  newSection += "（タスクなし）\n";
}
newSection += "\n";
newSection += "### Regular Tasks\n";
if (regularTasks.length > 0) {
  regularTasks.forEach((task) => {
    newSection += `${task}\n`;
  });
} else {
  newSection += "（タスクなし）\n";
}
newSection += "\n---\n";

const final = newSection + "\n" + cleaned;

console.log("=== Final TODO.md ===");
console.log(final);

// Verify no double ---
const doubleHyphen = final.match(/---\s*\n\s*---/);
if (doubleHyphen) {
  console.log("\n❌ ERROR: Double --- detected!");
} else {
  console.log("\n✅ SUCCESS: No double ---");
}

// Test script for Recipe 10 merge logic fix

// Mock existing TODO.md content
const mockTodoContent = `## Today — 2025-12-01

### High Priority
- [ ] Old urgent task

### Regular Tasks
- [ ] Old regular task

---

## 📋 システム情報

- **Obsidian REST API**: https://127.0.0.1:27124/`;

// Mock new tasks from digest
const mockNewTasks = [
  "- [ ] [Cortex] ⚡ Recipe 10 の Merge ロジック修正  <!-- #urgent -->",
  "- [ ] Cortex OS ヘルスチェック継続監視",
];

console.log("=== Original TODO.md ===");
console.log(mockTodoContent);
console.log("\n=== New Tasks ===");
mockNewTasks.forEach((t) => console.log(t));

// Test the regex
const todayRegex =
  /^## Today — \d{4}-\d{2}-\d{2}\s*\n[\s\S]*?(?=\n(?:##[^#]|---\n\n##))/m;
const cleaned = mockTodoContent.replace(todayRegex, "").trim();

console.log("\n=== After Removing Old Section ===");
console.log(cleaned);

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

console.log("\n=== Final TODO.md ===");
console.log(final);
console.log("\n✅ Test completed");

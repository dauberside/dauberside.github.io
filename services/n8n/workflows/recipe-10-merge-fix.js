// Recipe 10: Fixed Merge Logic
// Issue: Regex doesn't properly remove old "## Today" section with subsections

const taskInfo = $("Extract Uncompleted Tasks").first().json;
const httpResponse = $input.first().json;

function unwrapContent(raw) {
  if (typeof raw !== "string") return "";
  let current = raw;
  while (true) {
    try {
      const parsed = JSON.parse(current);
      if (parsed && typeof parsed.content === "string") {
        current = parsed.content;
        continue;
      }
      break;
    } catch (e) {
      break;
    }
  }
  return current;
}

// Get existing TODO.md content
let todoContent = "";

if (httpResponse && typeof httpResponse === "object") {
  if (typeof httpResponse.content === "string") {
    todoContent = unwrapContent(httpResponse.content);
  } else if (typeof httpResponse.data === "string") {
    todoContent = unwrapContent(httpResponse.data);
  } else if (typeof httpResponse.body === "string") {
    todoContent = unwrapContent(httpResponse.body);
  } else if (
    httpResponse.data &&
    typeof httpResponse.data.content === "string"
  ) {
    todoContent = unwrapContent(httpResponse.data.content);
  }
} else if (typeof httpResponse === "string") {
  todoContent = unwrapContent(httpResponse);
}

if (!todoContent) {
  todoContent = "";
}

// Parse existing TODO sections
const lines = todoContent.split("\n");
const existingTasks = lines
  .filter((line) => line.trim().match(/^-\s*\[/))
  .map((line) => line.trim());

// Helper function to normalize task text for deduplication
function normalizeTask(taskLine) {
  return taskLine
    .replace(/^-\s*\[\s*\]\s*/, "") // Remove checkbox
    .replace(/^\[.*?\]\s*/, "") // Remove category prefix
    .replace(/^[⚡🚧⏳🎯👁️]\s*/, "") // Remove emoji
    .replace(/\s*<!--.*?-->\s*$/, "") // Remove HTML comment
    .trim();
}

// Format new tasks with category, emoji, and tags
const formattedTasks = taskInfo.uncompletedTasks.map((task) => {
  // Remove the "- [ ] " prefix and any existing tags from content
  let taskContent = task.raw.replace(/^-\s*\[\s*\]\s*/, "");

  // Remove inline tags from the content (they'll be in the comment)
  taskContent = taskContent.replace(/#\w+/g, "").trim();

  // Build the formatted task
  let formatted = "- [ ]";

  // Add category if exists
  if (task.category) {
    formatted += ` [${task.category}]`;
  }

  // Add emoji if exists
  if (task.emoji) {
    formatted += ` ${task.emoji}`;
  }

  // Add task content
  formatted += ` ${taskContent}`;

  // Add tags comment if exists
  if (task.tags && task.tags.length > 0) {
    const tagsList = task.tags.map((t) => `#${t}`).join(",");
    formatted += `  <!-- ${tagsList} -->`;
  }

  return formatted;
});

// Filter out tasks that already exist in TODO (compare normalized content only)
const newTasks = formattedTasks.filter((formattedTask) => {
  const newTaskNormalized = normalizeTask(formattedTask);

  return !existingTasks.some((existing) => {
    const existingNormalized = normalizeTask(existing);
    return existingNormalized === newTaskNormalized;
  });
});

// Categorize tasks by urgency for structured output
const urgentTasks = newTasks.filter((t) => t.includes("<!-- #urgent"));
const regularTasks = newTasks.filter((t) => !t.includes("<!-- #urgent"));

// Build new section for today with proper structure
const today = taskInfo.date;
let newSection = `## Today — ${today}\n\n`;

// High Priority section
newSection += "### High Priority\n";
if (urgentTasks.length > 0) {
  urgentTasks.forEach((task) => {
    newSection += `${task}\n`;
  });
} else {
  newSection += "（タスクなし）\n";
}
newSection += "\n";

// Regular Tasks section
newSection += "### Regular Tasks\n";
if (regularTasks.length > 0) {
  regularTasks.forEach((task) => {
    newSection += `${task}\n`;
  });
} else {
  newSection += "（タスクなし）\n";
}

newSection += "\n---\n";

// FIX: Remove old "## Today —" section completely (including all subsections until ---)
// Strategy: Match "## Today —" and everything until (and including) the "---" separator
const todayRegex = /^## Today — \d{4}-\d{2}-\d{2}\s*\n[\s\S]*?^---\s*$/m;

let updatedContent = todoContent.replace(todayRegex, "").trim();

// Add new section at the top
updatedContent = newSection + "\n" + updatedContent;

return {
  json: {
    date: today,
    todoPath: taskInfo.todoPath,
    newTasksCount: newTasks.length,
    totalTasksCount: taskInfo.taskCount,
    urgentCount: urgentTasks.length,
    regularCount: regularTasks.length,
    updatedContent,
    newTasks,
  },
};

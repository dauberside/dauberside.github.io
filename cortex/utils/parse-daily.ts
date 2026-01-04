/**
 * parse-daily.ts
 *
 * Utility for parsing daily digest markdown files and extracting structured data.
 * Used by weekly/monthly aggregators to process daily digests.
 */

export interface DailyDigest {
  date: string;
  filename: string;
  raw: string;
  sections: {
    todaysPlan?: string;
    tasks?: string;
    highlights?: string;
    reflection?: string;
    notes?: string;
  };
  metadata: {
    hasContent: boolean;
    wordCount: number;
    sectionCount: number;
  };
}

/**
 * Parse a daily digest markdown file into structured data
 */
export function parseDailyDigest(
  filename: string,
  content: string,
): DailyDigest {
  // Extract date from filename (YYYY-MM-DD-digest.md)
  const dateMatch = filename.match(/(\d{4}-\d{2}-\d{2})/);
  const date = dateMatch ? dateMatch[1] : "unknown";

  // Extract sections using markdown headers
  const sections = extractSections(content);

  // Calculate metadata
  const wordCount = content.split(/\s+/).length;
  const sectionCount = Object.keys(sections).filter(
    (k) => sections[k as keyof typeof sections],
  ).length;
  const hasContent = wordCount > 50; // Arbitrary threshold

  return {
    date,
    filename,
    raw: content,
    sections,
    metadata: {
      hasContent,
      wordCount,
      sectionCount,
    },
  };
}

/**
 * Extract markdown sections by header
 */
function extractSections(content: string): DailyDigest["sections"] {
  const sections: DailyDigest["sections"] = {};

  // Patterns for section headers
  const patterns = {
    todaysPlan: /## Today's Plan\s*\n([\s\S]*?)(?=\n## |\n---|\Z)/i,
    tasks: /## Tasks\s*\n([\s\S]*?)(?=\n## |\n---|\Z)/i,
    highlights: /## Highlights\s*\n([\s\S]*?)(?=\n## |\n---|\Z)/i,
    reflection: /## Reflection\s*\n([\s\S]*?)(?=\n## |\n---|\Z)/i,
    notes: /## Notes\s*\n([\s\S]*?)(?=\n## |\n---|\Z)/i,
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = content.match(pattern);
    if (match && match[1]) {
      sections[key as keyof typeof sections] = match[1].trim();
    }
  }

  return sections;
}

/**
 * Extract completed tasks from a daily digest
 */
export function extractCompletedTasks(digest: DailyDigest): string[] {
  const tasks: string[] = [];

  if (digest.sections.tasks) {
    const lines = digest.sections.tasks.split("\n");
    for (const line of lines) {
      // Match lines with ✅ or [x] or - [x]
      if (line.match(/✅|✔|(\[x\])/i)) {
        const cleaned = line
          .replace(/✅|✔|\[x\]/gi, "")
          .replace(/^[-*]\s*/, "")
          .trim();
        if (cleaned) {
          tasks.push(cleaned);
        }
      }
    }
  }

  return tasks;
}

/**
 * Extract key insights/highlights from a daily digest
 */
export function extractInsights(digest: DailyDigest): string[] {
  const insights: string[] = [];

  // From highlights section
  if (digest.sections.highlights) {
    const lines = digest.sections.highlights.split("\n");
    for (const line of lines) {
      if (line.match(/^[-*]\s/)) {
        const cleaned = line.replace(/^[-*]\s*/, "").trim();
        if (cleaned && cleaned.length > 10) {
          insights.push(cleaned);
        }
      }
    }
  }

  // From reflection section
  if (digest.sections.reflection) {
    const lines = digest.sections.reflection.split("\n");
    for (const line of lines) {
      if (line.match(/^[-*]\s/) || line.match(/^###\s/)) {
        const cleaned = line
          .replace(/^[-*]\s*/, "")
          .replace(/^###\s*/, "")
          .trim();
        if (cleaned && cleaned.length > 10) {
          insights.push(cleaned);
        }
      }
    }
  }

  return insights;
}

/**
 * Get a brief summary of a daily digest (first N words from highlights)
 */
export function getBriefSummary(digest: DailyDigest, maxWords = 50): string {
  const content =
    digest.sections.highlights || digest.sections.todaysPlan || digest.raw;
  const words = content.split(/\s+/).slice(0, maxWords);
  return words.join(" ") + (words.length === maxWords ? "..." : "");
}

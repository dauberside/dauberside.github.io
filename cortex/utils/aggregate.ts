/**
 * aggregate.ts
 *
 * AI-powered aggregation utilities for generating weekly/monthly summaries
 * from daily digest data.
 */

import type { DailyDigest } from "./parse-daily";

export interface AggregationOptions {
  aiEnabled?: boolean;
  openaiApiKey?: string;
  model?: string;
  maxTokens?: number;
}

export interface WeeklySummary {
  weekId: string;
  dateRange: { start: string; end: string };
  generatedAt: string;
  dailyCount: number;
  overview: string;
  highlights: string[];
  keyInsights: string[];
  tasksCompleted: string[];
  themes: string[];
  dailyLogs: Array<{
    date: string;
    summary: string;
  }>;
}

/**
 * Generate a weekly summary from daily digests
 */
export async function generateWeeklySummary(
  weekId: string,
  digests: DailyDigest[],
  options: AggregationOptions = {},
): Promise<WeeklySummary> {
  // Sort by date
  const sorted = digests.sort((a, b) => a.date.localeCompare(b.date));

  // Extract data
  const allHighlights = sorted.flatMap((d) =>
    extractBulletPoints(d.sections.highlights || ""),
  );
  const allInsights = sorted.flatMap((d) =>
    extractBulletPoints(d.sections.reflection || ""),
  );
  const allTasks = sorted.flatMap((d) =>
    extractCompletedTasks(d.sections.tasks || ""),
  );

  // Generate overview
  let overview = `週間サマリー ${weekId}`;
  let highlights: string[] = [];
  let keyInsights: string[] = [];

  if (options.aiEnabled && options.openaiApiKey) {
    // AI-powered summarization
    const aiSummary = await generateAISummary(sorted, options);
    overview = aiSummary.overview;
    highlights = aiSummary.highlights;
    keyInsights = aiSummary.insights;
  } else {
    // Rule-based summarization (fallback)
    overview = `${sorted.length}日分のdaily digestを集約。主要なタスク完了数: ${allTasks.length}件`;
    highlights = allHighlights.slice(0, 5); // Top 5
    keyInsights = allInsights.slice(0, 3); // Top 3
  }

  // Detect recurring themes
  const themes = detectThemes(sorted);

  // Create daily log summaries
  const dailyLogs = sorted.map((d) => ({
    date: d.date,
    summary: getBriefSummary(d),
  }));

  return {
    weekId,
    dateRange: {
      start: sorted[0]?.date || "unknown",
      end: sorted[sorted.length - 1]?.date || "unknown",
    },
    generatedAt: new Date().toISOString(),
    dailyCount: sorted.length,
    overview,
    highlights,
    keyInsights,
    tasksCompleted: allTasks,
    themes,
    dailyLogs,
  };
}

/**
 * AI-powered summary generation using OpenAI API
 */
async function generateAISummary(
  digests: DailyDigest[],
  options: AggregationOptions,
): Promise<{ overview: string; highlights: string[]; insights: string[] }> {
  const combinedContent = digests
    .map(
      (d) =>
        `## ${d.date}\n${d.sections.highlights || ""}\n${d.sections.reflection || ""}`,
    )
    .join("\n\n");

  const prompt = `以下は1週間分のdaily digestです。この内容を分析し、以下を生成してください：

1. Overview（1-2文の週間サマリー）
2. Highlights（主要な出来事・達成事項を3-5個）
3. Key Insights（学びや洞察を2-3個）

${combinedContent}

出力はJSON形式で：
{
  "overview": "...",
  "highlights": ["...", "..."],
  "insights": ["...", "..."]
}`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: options.model || "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: options.maxTokens || 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error("No content in OpenAI response");
    }

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        overview: parsed.overview || "",
        highlights: parsed.highlights || [],
        insights: parsed.insights || [],
      };
    }

    throw new Error("Failed to parse JSON from OpenAI response");
  } catch (error) {
    console.error(
      "AI summarization failed, falling back to rule-based:",
      error,
    );
    // Fallback to rule-based
    return {
      overview: `${digests.length}日分の活動を集約`,
      highlights: digests
        .flatMap((d) => extractBulletPoints(d.sections.highlights || ""))
        .slice(0, 5),
      insights: digests
        .flatMap((d) => extractBulletPoints(d.sections.reflection || ""))
        .slice(0, 3),
    };
  }
}

/**
 * Detect recurring themes across daily digests
 */
function detectThemes(digests: DailyDigest[]): string[] {
  const words: Record<string, number> = {};

  for (const digest of digests) {
    const content = [
      digest.sections.highlights,
      digest.sections.reflection,
      digest.sections.todaysPlan,
    ]
      .filter(Boolean)
      .join(" ");

    // Extract meaningful words (simple approach)
    const tokens = content
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3 && !isStopWord(w));

    for (const token of tokens) {
      words[token] = (words[token] || 0) + 1;
    }
  }

  // Get top recurring words
  const sorted = Object.entries(words)
    .filter(([_, count]) => count >= 2) // Appears at least twice
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);

  return sorted;
}

/**
 * Extract bullet points from markdown text
 */
function extractBulletPoints(text: string): string[] {
  return text
    .split("\n")
    .filter((line) => line.match(/^[-*]\s/))
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter((line) => line.length > 5);
}

/**
 * Extract completed tasks (lines with checkmarks)
 */
function extractCompletedTasks(text: string): string[] {
  return text
    .split("\n")
    .filter((line) => line.match(/✅|✔|\[x\]/i))
    .map((line) =>
      line
        .replace(/✅|✔|\[x\]/gi, "")
        .replace(/^[-*]\s*/, "")
        .trim(),
    )
    .filter((line) => line.length > 5);
}

/**
 * Get brief summary of a digest
 */
function getBriefSummary(digest: DailyDigest): string {
  const highlights = digest.sections.highlights || "";
  const words = highlights.split(/\s+/).slice(0, 30);
  return words.join(" ") + (words.length === 30 ? "..." : "");
}

/**
 * Simple stop word filter (English + Japanese common words)
 */
function isStopWord(word: string): boolean {
  const stopWords = new Set([
    "the",
    "and",
    "for",
    "with",
    "this",
    "that",
    "from",
    "have",
    "した",
    "する",
    "ある",
    "です",
    "ます",
  ]);
  return stopWords.has(word);
}

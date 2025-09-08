declare module "@/lib/interpret" {
  export function extractScheduleQuery(text: string): Promise<{
    intent?: string;
    date_range?: { start?: string; end?: string };
    keywords?: string[];
  }>;
}

#!/usr/bin/env python3
"""
Feedback Collector

Extracts mood, energy, and satisfaction from daily digests
to build a feedback history for adaptive suggestions.

Input:
  - cortex/daily/YYYY-MM-DD-digest.md (Reflection section)

Output:
  - cortex/state/feedback-history.json

Supported formats:
  - Mood: 😀 / 🙂 / 😐 / 🙁 / 😞
  - Energy: 8/10
  - Satisfaction: 7/10
  - Free-form reflection text (for sentiment analysis)

Usage:
    python scripts/extract-feedback.py [--days 30]
"""

import json
import re
import sys
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import argparse


DAILY_DIR = Path("cortex/daily")
STATE_DIR = Path("cortex/state")

# Emoji to numeric mapping
MOOD_MAP = {
    "😀": 5, "😃": 5, "😄": 5,  # excellent
    "🙂": 4, "😊": 4,             # good
    "😐": 3, "😑": 3,             # neutral
    "🙁": 2, "😕": 2,             # low
    "😞": 1, "😢": 1, "😭": 1,   # very low
}


def load_digest(date_str: str) -> Optional[str]:
    """Load a daily digest file."""
    digest_file = DAILY_DIR / f"{date_str}-digest.md"
    if not digest_file.exists():
        return None
    try:
        return digest_file.read_text(encoding="utf-8")
    except Exception as e:
        print(f"⚠️  Error reading {digest_file}: {e}", file=sys.stderr)
        return None


def extract_reflection(content: str) -> Optional[str]:
    """Extract the Reflection section from digest content."""
    # Look for ## Reflection section
    match = re.search(
        r"^## Reflection\s*\n(.*?)(?=^##|\Z)",
        content,
        re.MULTILINE | re.DOTALL
    )
    if match:
        reflection = match.group(1).strip()
        # Remove empty placeholder text
        if reflection and "（今日の振り返り" not in reflection:
            return reflection
    return None


def extract_mood(reflection: str) -> Optional[int]:
    """Extract mood emoji and convert to numeric score (1-5)."""
    # Look for "Mood: 😀" or just standalone mood emojis
    for emoji, score in MOOD_MAP.items():
        if emoji in reflection:
            return score
    
    # Look for explicit mood patterns
    mood_match = re.search(r"Mood:\s*([😀😃😄🙂😊😐😑🙁😕😞😢😭])", reflection)
    if mood_match:
        emoji = mood_match.group(1)
        return MOOD_MAP.get(emoji)
    
    return None


def extract_numeric_rating(reflection: str, field: str) -> Optional[int]:
    """Extract numeric rating (e.g., 'Energy: 7/10' or 'Satisfaction: 8')."""
    # Try X/10 format
    pattern1 = rf"{field}:\s*(\d+)\s*/\s*10"
    match1 = re.search(pattern1, reflection, re.IGNORECASE)
    if match1:
        return int(match1.group(1))
    
    # Try standalone number
    pattern2 = rf"{field}:\s*(\d+)"
    match2 = re.search(pattern2, reflection, re.IGNORECASE)
    if match2:
        value = int(match2.group(1))
        # Assume 1-10 scale
        return min(max(value, 1), 10)
    
    return None


def simple_sentiment(text: str) -> str:
    """Simple sentiment analysis based on keywords."""
    if not text:
        return "neutral"
    
    text_lower = text.lower()
    
    # Positive indicators
    positive_words = [
        "good", "great", "excellent", "productive", "satisfied",
        "happy", "progress", "completed", "success", "achieved",
        "順調", "良い", "完成", "達成", "満足"
    ]
    
    # Negative indicators
    negative_words = [
        "bad", "difficult", "tired", "frustrated", "stuck",
        "failed", "problem", "issue", "疲れ", "難しい", "問題"
    ]
    
    pos_count = sum(1 for word in positive_words if word in text_lower)
    neg_count = sum(1 for word in negative_words if word in text_lower)
    
    if pos_count > neg_count + 1:
        return "positive"
    elif neg_count > pos_count + 1:
        return "negative"
    else:
        return "neutral"


def extract_feedback_for_date(date_str: str) -> Optional[Dict[str, Any]]:
    """Extract feedback data for a single date."""
    content = load_digest(date_str)
    if not content:
        return None
    
    reflection = extract_reflection(content)
    if not reflection:
        return None
    
    mood = extract_mood(reflection)
    energy = extract_numeric_rating(reflection, "Energy")
    satisfaction = extract_numeric_rating(reflection, "Satisfaction")
    sentiment = simple_sentiment(reflection)
    
    # Only include if at least one field is present
    if mood is None and energy is None and satisfaction is None:
        return None
    
    entry: Dict[str, Any] = {
        "date": date_str,
        "has_reflection": True,
    }
    
    if mood is not None:
        entry["mood"] = mood
    if energy is not None:
        entry["energy"] = energy
    if satisfaction is not None:
        entry["satisfaction"] = satisfaction
    
    entry["sentiment"] = sentiment
    entry["reflection_length"] = len(reflection)
    
    return entry


def calculate_trends(entries: List[Dict[str, Any]]) -> Dict[str, str]:
    """Calculate trends from recent entries."""
    if len(entries) < 3:
        return {"status": "insufficient_data"}
    
    # Take last 7 days
    recent = entries[-7:]
    
    trends: Dict[str, str] = {}
    
    # Energy trend
    energy_values = [e["energy"] for e in recent if "energy" in e]
    if len(energy_values) >= 3:
        recent_avg = sum(energy_values[-3:]) / 3
        older_avg = sum(energy_values[:-3]) / len(energy_values[:-3]) if len(energy_values) > 3 else recent_avg
        
        if recent_avg > older_avg + 1:
            trends["energy"] = "up"
        elif recent_avg < older_avg - 1:
            trends["energy"] = "down"
        else:
            trends["energy"] = "stable"
    
    # Satisfaction trend
    sat_values = [e["satisfaction"] for e in recent if "satisfaction" in e]
    if len(sat_values) >= 3:
        recent_avg = sum(sat_values[-3:]) / 3
        older_avg = sum(sat_values[:-3]) / len(sat_values[:-3]) if len(sat_values) > 3 else recent_avg
        
        if recent_avg > older_avg + 1:
            trends["satisfaction"] = "up"
        elif recent_avg < older_avg - 1:
            trends["satisfaction"] = "down"
        else:
            trends["satisfaction"] = "stable"
    
    # Mood trend
    mood_values = [e["mood"] for e in recent if "mood" in e]
    if len(mood_values) >= 3:
        recent_avg = sum(mood_values[-3:]) / 3
        older_avg = sum(mood_values[:-3]) / len(mood_values[:-3]) if len(mood_values) > 3 else recent_avg
        
        if recent_avg > older_avg + 0.5:
            trends["mood"] = "up"
        elif recent_avg < older_avg - 0.5:
            trends["mood"] = "down"
        else:
            trends["mood"] = "stable"
    
    return trends


def generate_insights(entries: List[Dict[str, Any]], trends: Dict[str, str]) -> List[str]:
    """Generate human-readable insights."""
    insights: List[str] = []
    
    if not entries:
        insights.append("No feedback data available yet.")
        return insights
    
    recent = entries[-7:] if len(entries) >= 7 else entries
    
    # Recent averages
    energy_vals = [e["energy"] for e in recent if "energy" in e]
    if energy_vals:
        avg_energy = sum(energy_vals) / len(energy_vals)
        if avg_energy >= 7.5:
            insights.append(f"Recent energy levels are high (avg: {avg_energy:.1f}/10).")
        elif avg_energy <= 5:
            insights.append(f"Recent energy levels are low (avg: {avg_energy:.1f}/10) — consider lighter tasks.")
        else:
            insights.append(f"Energy levels are moderate (avg: {avg_energy:.1f}/10).")
    
    # Trends
    if trends.get("energy") == "down":
        insights.append("⚠️ Energy trend is declining.")
    elif trends.get("energy") == "up":
        insights.append("✅ Energy trend is improving.")
    
    if trends.get("satisfaction") == "down":
        insights.append("⚠️ Satisfaction is declining — review task priorities.")
    elif trends.get("satisfaction") == "up":
        insights.append("✅ Satisfaction is improving.")
    
    # Sentiment distribution
    sentiments = [e["sentiment"] for e in recent]
    positive_ratio = sentiments.count("positive") / len(sentiments) if sentiments else 0
    if positive_ratio >= 0.7:
        insights.append("Overall sentiment is positive.")
    elif positive_ratio <= 0.3:
        insights.append("Overall sentiment is low — might need rest or task adjustment.")
    
    return insights


def main():
    parser = argparse.ArgumentParser(description="Extract feedback from daily digests")
    parser.add_argument(
        "--days",
        type=int,
        default=30,
        help="Number of days to analyze (default: 30)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="cortex/state/feedback-history.json",
        help="Output file path",
    )
    
    args = parser.parse_args()
    
    print(f"📊 Extracting feedback (past {args.days} days)...", file=sys.stderr)
    
    if not DAILY_DIR.exists():
        print(f"❌ Daily directory not found: {DAILY_DIR}", file=sys.stderr)
        sys.exit(1)
    
    entries: List[Dict[str, Any]] = []
    today = datetime.now().date()
    
    for i in range(args.days):
        date = today - timedelta(days=i)
        date_str = date.strftime("%Y-%m-%d")
        
        entry = extract_feedback_for_date(date_str)
        if entry:
            entries.append(entry)
    
    # Sort by date
    entries.sort(key=lambda e: e["date"])
    
    print(f"✅ Extracted {len(entries)} feedback entries", file=sys.stderr)
    
    trends = calculate_trends(entries)
    insights = generate_insights(entries, trends)
    
    result = {
        "generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "analysis_period_days": args.days,
        "total_entries": len(entries),
        "entries": entries,
        "trends": trends,
        "insights": insights,
    }
    
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    
    print(f"✅ Feedback history saved to {output_path}", file=sys.stderr)
    
    if insights:
        print("\n💡 Insights:", file=sys.stderr)
        for insight in insights:
            print(f"   • {insight}", file=sys.stderr)
    
    # stdout for piping
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()

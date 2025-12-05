"""
Tests for scripts/extract-feedback.py

Tests feedback extraction from daily digests including mood, energy,
satisfaction ratings, and sentiment analysis.
"""

import json
import pytest
from pathlib import Path
from datetime import datetime
import sys

# Add scripts directory to path
scripts_dir = Path(__file__).parent.parent.parent / "scripts"
sys.path.insert(0, str(scripts_dir))

# Import functions by loading the module
import importlib.util
spec = importlib.util.spec_from_file_location("extract_feedback", scripts_dir / "extract-feedback.py")
extract_feedback = importlib.util.module_from_spec(spec)
spec.loader.exec_module(extract_feedback)

extract_reflection = extract_feedback.extract_reflection
extract_mood = extract_feedback.extract_mood
extract_numeric_rating = extract_feedback.extract_numeric_rating
simple_sentiment = extract_feedback.simple_sentiment
calculate_trends = extract_feedback.calculate_trends
generate_insights = extract_feedback.generate_insights


class TestReflectionExtraction:
    """Test extraction of Reflection section from digest content."""
    
    def test_extract_basic_reflection(self):
        content = """# Daily Digest
        
## Reflection

Today was productive. Completed most tasks.

## Next Section
"""
        result = extract_reflection(content)
        assert result is not None
        assert "productive" in result
        assert "Completed most tasks" in result
    
    def test_extract_no_reflection(self):
        content = """# Daily Digest
        
## Progress

Some progress made.
"""
        result = extract_reflection(content)
        assert result is None
    
    def test_extract_empty_reflection(self):
        content = """# Daily Digest
        
## Reflection

（今日の振り返り・学び・気づきをここに記録）

## Next
"""
        result = extract_reflection(content)
        assert result is None


class TestMoodExtraction:
    """Test mood emoji extraction and numeric conversion."""
    
    def test_extract_mood_excellent(self):
        reflection = "Mood: 😀\n\nGreat day overall!"
        result = extract_mood(reflection)
        assert result == 5
    
    def test_extract_mood_good(self):
        reflection = "Feeling 🙂 today"
        result = extract_mood(reflection)
        assert result == 4
    
    def test_extract_mood_neutral(self):
        reflection = "Mood: 😐"
        result = extract_mood(reflection)
        assert result == 3
    
    def test_extract_mood_low(self):
        reflection = "Feeling 🙁 today"
        result = extract_mood(reflection)
        assert result == 2
    
    def test_extract_mood_very_low(self):
        reflection = "Mood: 😞"
        result = extract_mood(reflection)
        assert result == 1
    
    def test_extract_no_mood(self):
        reflection = "Just a normal day"
        result = extract_mood(reflection)
        assert result is None


class TestNumericRatingExtraction:
    """Test extraction of energy and satisfaction ratings."""
    
    def test_extract_energy_with_slash(self):
        reflection = "Energy: 8/10"
        result = extract_numeric_rating(reflection, "Energy")
        assert result == 8
    
    def test_extract_energy_standalone(self):
        reflection = "Energy: 7"
        result = extract_numeric_rating(reflection, "Energy")
        assert result == 7
    
    def test_extract_satisfaction_with_slash(self):
        reflection = "Satisfaction: 9/10"
        result = extract_numeric_rating(reflection, "Satisfaction")
        assert result == 9
    
    def test_extract_out_of_range_clamped(self):
        reflection = "Energy: 15"
        result = extract_numeric_rating(reflection, "Energy")
        assert result == 10  # Should clamp to max
    
    def test_extract_case_insensitive(self):
        reflection = "energy: 6/10"
        result = extract_numeric_rating(reflection, "Energy")
        assert result == 6
    
    def test_extract_no_rating(self):
        reflection = "Just working today"
        result = extract_numeric_rating(reflection, "Energy")
        assert result is None


class TestSentimentAnalysis:
    """Test simple sentiment analysis."""
    
    def test_positive_sentiment(self):
        text = "Great progress today! Completed all tasks successfully."
        result = simple_sentiment(text)
        assert result == "positive"
    
    def test_negative_sentiment(self):
        text = "Difficult day. Many problems and feeling frustrated."
        result = simple_sentiment(text)
        assert result == "negative"
    
    def test_neutral_sentiment(self):
        text = "Normal day. Did some work."
        result = simple_sentiment(text)
        assert result == "neutral"
    
    def test_japanese_positive(self):
        text = "順調に進んで良い一日でした"
        result = simple_sentiment(text)
        assert result == "positive"
    
    def test_japanese_negative(self):
        text = "疲れた。問題が多くて難しい"
        result = simple_sentiment(text)
        assert result == "negative"
    
    def test_empty_text(self):
        result = simple_sentiment("")
        assert result == "neutral"


class TestTrendCalculation:
    """Test trend calculation from feedback entries."""
    
    def test_insufficient_data(self):
        entries = [
            {"date": "2025-12-01", "energy": 7},
        ]
        result = calculate_trends(entries)
        assert result == {"status": "insufficient_data"}
    
    def test_energy_trend_up(self):
        entries = [
            {"date": "2025-12-01", "energy": 5},
            {"date": "2025-12-02", "energy": 6},
            {"date": "2025-12-03", "energy": 7},
            {"date": "2025-12-04", "energy": 8},
            {"date": "2025-12-05", "energy": 9},
        ]
        result = calculate_trends(entries)
        assert result["energy"] == "up"
    
    def test_energy_trend_down(self):
        entries = [
            {"date": "2025-12-01", "energy": 9},
            {"date": "2025-12-02", "energy": 8},
            {"date": "2025-12-03", "energy": 7},
            {"date": "2025-12-04", "energy": 5},
            {"date": "2025-12-05", "energy": 4},
        ]
        result = calculate_trends(entries)
        assert result["energy"] == "down"
    
    def test_energy_trend_stable(self):
        entries = [
            {"date": "2025-12-01", "energy": 7},
            {"date": "2025-12-02", "energy": 7},
            {"date": "2025-12-03", "energy": 7},
            {"date": "2025-12-04", "energy": 7},
        ]
        result = calculate_trends(entries)
        assert result["energy"] == "stable"
    
    def test_satisfaction_trend(self):
        entries = [
            {"date": "2025-12-01", "satisfaction": 6},
            {"date": "2025-12-02", "satisfaction": 7},
            {"date": "2025-12-03", "satisfaction": 8},
            {"date": "2025-12-04", "satisfaction": 9},
        ]
        result = calculate_trends(entries)
        assert result["satisfaction"] == "up"
    
    def test_mood_trend(self):
        entries = [
            {"date": "2025-12-01", "mood": 3},
            {"date": "2025-12-02", "mood": 3},
            {"date": "2025-12-03", "mood": 2},
            {"date": "2025-12-04", "mood": 2},
        ]
        result = calculate_trends(entries)
        assert result["mood"] == "down"


class TestInsightGeneration:
    """Test insight generation from feedback data."""
    
    def test_no_data_insight(self):
        entries = []
        trends = {}
        result = generate_insights(entries, trends)
        assert len(result) == 1
        assert "No feedback data" in result[0]
    
    def test_high_energy_insight(self):
        entries = [
            {"date": "2025-12-01", "energy": 8, "sentiment": "positive"},
            {"date": "2025-12-02", "energy": 9, "sentiment": "positive"},
            {"date": "2025-12-03", "energy": 8, "sentiment": "positive"},
        ]
        trends = {"energy": "stable"}
        result = generate_insights(entries, trends)
        
        assert any("high" in insight.lower() for insight in result)
    
    def test_low_energy_insight(self):
        entries = [
            {"date": "2025-12-01", "energy": 4, "sentiment": "neutral"},
            {"date": "2025-12-02", "energy": 5, "sentiment": "neutral"},
            {"date": "2025-12-03", "energy": 4, "sentiment": "neutral"},
        ]
        trends = {"energy": "stable"}
        result = generate_insights(entries, trends)
        
        assert any("low" in insight.lower() for insight in result)
        assert any("lighter tasks" in insight.lower() for insight in result)
    
    def test_declining_trend_warning(self):
        entries = [
            {"date": "2025-12-01", "energy": 8, "sentiment": "positive"},
            {"date": "2025-12-02", "energy": 6, "sentiment": "neutral"},
        ]
        trends = {"energy": "down", "satisfaction": "down"}
        result = generate_insights(entries, trends)
        
        assert any("declining" in insight.lower() for insight in result)
    
    def test_positive_sentiment_insight(self):
        entries = [
            {"date": "2025-12-01", "sentiment": "positive"},
            {"date": "2025-12-02", "sentiment": "positive"},
            {"date": "2025-12-03", "sentiment": "positive"},
        ]
        trends = {}
        result = generate_insights(entries, trends)
        
        assert any("positive" in insight.lower() for insight in result)
    
    def test_low_sentiment_insight(self):
        entries = [
            {"date": "2025-12-01", "sentiment": "negative"},
            {"date": "2025-12-02", "sentiment": "negative"},
            {"date": "2025-12-03", "sentiment": "neutral"},
        ]
        trends = {}
        result = generate_insights(entries, trends)
        
        assert any("low" in insight.lower() or "rest" in insight.lower() for insight in result)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

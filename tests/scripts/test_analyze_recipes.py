"""
Tests for scripts/analyze-recipes.py

Recipe Performance Monitoring のロジックをテスト
"""

import pytest
import json
import tempfile
from pathlib import Path
from datetime import datetime, timedelta
import sys

# Import the module to test
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "scripts"))
import importlib.util
spec = importlib.util.spec_from_file_location("analyze_recipes", Path(__file__).parent.parent.parent / "scripts" / "analyze-recipes.py")
analyze_recipes = importlib.util.module_from_spec(spec)
spec.loader.exec_module(analyze_recipes)

parse_log_line = analyze_recipes.parse_log_line
aggregate_metrics = analyze_recipes.aggregate_metrics
compute_statistics = analyze_recipes.compute_statistics
generate_insights = analyze_recipes.generate_insights


class TestParseLogLine:
    """Test log line parsing"""
    
    def test_parse_success_with_duration(self):
        line = "2025-12-05T22:00:02+09:00 [recipe_13_nightly_wrapup] SUCCESS (42.5s)"
        timestamp, recipe, status, duration = parse_log_line(line)
        
        assert timestamp == "2025-12-05T22:00:02+09:00"
        assert recipe == "recipe_13_nightly_wrapup"
        assert status == "success"
        assert duration == 42.5
    
    def test_parse_failure_with_reason(self):
        line = "2025-12-04T08:05:01+09:00 [recipe_10_todo_auto_sync] FAILURE: Obsidian API timeout"
        timestamp, recipe, status, duration = parse_log_line(line)
        
        assert timestamp == "2025-12-04T08:05:01+09:00"
        assert recipe == "recipe_10_todo_auto_sync"
        assert status == "failure"
        assert duration is None
    
    def test_parse_with_emoji_success(self):
        line = "2025-12-05T10:00:00+09:00 [recipe_03_brief] ✅ (10.5s)"
        timestamp, recipe, status, duration = parse_log_line(line)
        
        assert status == "success"
        assert duration == 10.5
    
    def test_parse_with_emoji_failure(self):
        line = "2025-12-05T10:00:00+09:00 [recipe_10_sync] ❌"
        timestamp, recipe, status, duration = parse_log_line(line)
        
        assert status == "failure"
    
    def test_parse_incomplete_line(self):
        line = "Some random log line without structure"
        timestamp, recipe, status, duration = parse_log_line(line)
        
        assert timestamp is None
        assert recipe is None
        assert status is None


class TestAggregateMetrics:
    """Test metrics aggregation"""
    
    def test_aggregate_single_recipe_all_success(self):
        entries = [
            {
                "timestamp": "2025-12-05T22:00:00+09:00",
                "recipe": "recipe_13",
                "status": "success",
                "duration_sec": 42.5,
                "raw_line": "...",
            },
            {
                "timestamp": "2025-12-04T22:00:00+09:00",
                "recipe": "recipe_13",
                "status": "success",
                "duration_sec": 41.0,
                "raw_line": "...",
            },
        ]
        
        result = aggregate_metrics(entries)
        
        assert result["recipe_13"]["runs"] == 2
        assert result["recipe_13"]["successes"] == 2
        assert result["recipe_13"]["failures"] == 0
        assert len(result["recipe_13"]["durations"]) == 2
        assert result["recipe_13"]["last_status"] == "success"
    
    def test_aggregate_with_failures(self):
        entries = [
            {
                "timestamp": "2025-12-05T08:00:00+09:00",
                "recipe": "recipe_10",
                "status": "success",
                "duration_sec": 15.0,
                "raw_line": "...",
            },
            {
                "timestamp": "2025-12-04T08:00:00+09:00",
                "recipe": "recipe_10",
                "status": "failure",
                "duration_sec": None,
                "raw_line": "FAILURE: API timeout",
            },
        ]
        
        result = aggregate_metrics(entries)
        
        assert result["recipe_10"]["runs"] == 2
        assert result["recipe_10"]["successes"] == 1
        assert result["recipe_10"]["failures"] == 1
        assert result["recipe_10"]["last_failure"] == "2025-12-04T08:00:00+09:00"
        assert "timeout" in result["recipe_10"]["last_failure_reason"].lower()
    
    def test_aggregate_multiple_recipes(self):
        entries = [
            {"timestamp": "2025-12-05T22:00:00+09:00", "recipe": "recipe_13", "status": "success", "duration_sec": 42.0, "raw_line": "..."},
            {"timestamp": "2025-12-05T08:00:00+09:00", "recipe": "recipe_10", "status": "success", "duration_sec": 15.0, "raw_line": "..."},
            {"timestamp": "2025-12-05T06:00:00+09:00", "recipe": "recipe_03", "status": "success", "duration_sec": 8.0, "raw_line": "..."},
        ]
        
        result = aggregate_metrics(entries)
        
        assert len(result) == 3
        assert "recipe_13" in result
        assert "recipe_10" in result
        assert "recipe_03" in result


class TestComputeStatistics:
    """Test statistics computation"""
    
    def test_compute_success_rate(self):
        recipe_data = {
            "recipe_test": {
                "runs": 10,
                "successes": 9,
                "failures": 1,
                "durations": [10.0, 11.0, 9.5, 10.5],
                "last_run": "2025-12-05T10:00:00+09:00",
                "last_status": "success",
                "last_failure": "2025-12-04T10:00:00+09:00",
                "last_failure_reason": "Test error",
            }
        }
        
        result = compute_statistics(recipe_data)
        
        assert result["recipe_test"]["success_rate"] == 0.9
        assert result["recipe_test"]["runs"] == 10
        assert result["recipe_test"]["avg_duration_sec"] == 10.25
        assert result["recipe_test"]["last_failure"] == "2025-12-04T10:00:00+09:00"
    
    def test_compute_perfect_success_rate(self):
        recipe_data = {
            "recipe_stable": {
                "runs": 5,
                "successes": 5,
                "failures": 0,
                "durations": [20.0, 21.0, 19.0],
                "last_run": "2025-12-05T10:00:00+09:00",
                "last_status": "success",
                "last_failure": None,
                "last_failure_reason": None,
            }
        }
        
        result = compute_statistics(recipe_data)
        
        assert result["recipe_stable"]["success_rate"] == 1.0
        assert result["recipe_stable"]["failures"] == 0
        assert "last_failure" not in result["recipe_stable"]
    
    def test_compute_no_duration_data(self):
        recipe_data = {
            "recipe_no_duration": {
                "runs": 3,
                "successes": 3,
                "failures": 0,
                "durations": [],
                "last_run": "2025-12-05T10:00:00+09:00",
                "last_status": "success",
                "last_failure": None,
                "last_failure_reason": None,
            }
        }
        
        result = compute_statistics(recipe_data)
        
        assert "avg_duration_sec" not in result["recipe_no_duration"]


class TestGenerateInsights:
    """Test insights generation"""
    
    def test_insights_all_stable(self):
        recipes = {
            "recipe_13": {"runs": 7, "successes": 7, "failures": 0, "success_rate": 1.0, "last_status": "success"},
            "recipe_10": {"runs": 7, "successes": 7, "failures": 0, "success_rate": 1.0, "last_status": "success"},
        }
        
        insights = generate_insights(recipes, window_days=7)
        
        assert len(insights) >= 2
        assert "100.0%" in insights[0]  # Overall success rate
        assert "Stable recipes" in insights[1]
        assert "recipe_13" in insights[1] or "recipe_10" in insights[1]
    
    def test_insights_with_low_reliability(self):
        recipes = {
            "recipe_unstable": {
                "runs": 10,
                "successes": 7,
                "failures": 3,
                "success_rate": 0.7,
                "last_status": "success",
            }
        }
        
        insights = generate_insights(recipes, window_days=7)
        
        # Should mention low reliability
        unstable_mention = any("low reliability" in i.lower() for i in insights)
        assert unstable_mention
    
    def test_insights_recent_failure(self):
        recipes = {
            "recipe_failed": {
                "runs": 5,
                "successes": 4,
                "failures": 1,
                "success_rate": 0.8,
                "last_status": "failure",
                "last_failure": "2025-12-05T10:00:00+09:00",
                "last_failure_reason": "Network timeout",
            }
        }
        
        insights = generate_insights(recipes, window_days=7)
        
        # Should mention recent failure
        failure_mention = any("last failed" in i for i in insights)
        assert failure_mention
        assert any("Network timeout" in i for i in insights)
    
    def test_insights_no_data(self):
        recipes = {}
        
        insights = generate_insights(recipes, window_days=7)
        
        assert len(insights) == 1
        assert "No recipe execution data" in insights[0]
    
    def test_insights_overall_rate_calculation(self):
        recipes = {
            "recipe_a": {"runs": 10, "successes": 9, "failures": 1, "success_rate": 0.9, "last_status": "success"},
            "recipe_b": {"runs": 5, "successes": 5, "failures": 0, "success_rate": 1.0, "last_status": "success"},
        }
        
        insights = generate_insights(recipes, window_days=7)
        
        # Overall: 14/15 = 93.3%
        assert "93.3%" in insights[0]


class TestEndToEnd:
    """End-to-end integration tests"""
    
    def test_full_pipeline(self, tmp_path):
        """Test complete analysis pipeline with temp files"""
        # Create temp log file
        log_content = """2025-12-05T22:00:02+09:00 [recipe_13] SUCCESS (42.5s)
2025-12-05T08:05:01+09:00 [recipe_10] SUCCESS (15.2s)
2025-12-04T22:00:01+09:00 [recipe_13] SUCCESS (41.8s)
2025-12-04T08:05:01+09:00 [recipe_10] FAILURE: API timeout
"""
        
        log_file = tmp_path / "test-recipe.log"
        log_file.write_text(log_content)
        
        # Parse entries manually (simulating load_recipe_logs)
        entries = []
        for line in log_content.strip().split("\n"):
            timestamp, recipe, status, duration = parse_log_line(line)
            if timestamp and recipe and status:
                entries.append({
                    "timestamp": timestamp,
                    "recipe": recipe,
                    "status": status,
                    "duration_sec": duration,
                    "raw_line": line,
                })
        
        # Aggregate and compute
        recipe_data = aggregate_metrics(entries)
        recipes = compute_statistics(recipe_data)
        insights = generate_insights(recipes, window_days=7)
        
        # Verify results
        assert len(recipes) == 2
        assert recipes["recipe_13"]["success_rate"] == 1.0
        assert recipes["recipe_10"]["success_rate"] == 0.5
        assert len(insights) > 0

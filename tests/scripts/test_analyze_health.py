"""
Tests for Health Score Engine (analyze-health.py)

Tests cover:
- Automation score calculation (log parsing, success rate)
- Data freshness scoring (file age thresholds)
- Analytics health scoring (sample size thresholds)
- Insight generation logic
"""

import json
import pytest
import time
import subprocess
from pathlib import Path
from datetime import datetime, timedelta
import sys
import importlib.util

# Load analyze-health.py as a module
script_path = Path(__file__).parent.parent.parent / "scripts" / "analyze-health.py"
spec = importlib.util.spec_from_file_location("analyze_health", script_path)
analyze_health = importlib.util.module_from_spec(spec)
spec.loader.exec_module(analyze_health)

# Import functions
parse_log_files = analyze_health.parse_log_files
calculate_automation_score = analyze_health.calculate_automation_score
calculate_freshness_score = analyze_health.calculate_freshness_score
calculate_analytics_health = analyze_health.calculate_analytics_health
generate_insights = analyze_health.generate_insights
LOGS_DIR = analyze_health.LOGS_DIR
STATE_DIR = analyze_health.STATE_DIR


@pytest.fixture
def tmp_logs_dir(tmp_path, monkeypatch):
    """Create temporary logs directory."""
    logs_dir = tmp_path / "cortex" / "logs"
    logs_dir.mkdir(parents=True)
    monkeypatch.setattr(analyze_health, "LOGS_DIR", logs_dir)
    return logs_dir


@pytest.fixture
def tmp_state_dir(tmp_path, monkeypatch):
    """Create temporary state directory."""
    state_dir = tmp_path / "cortex" / "state"
    state_dir.mkdir(parents=True)
    monkeypatch.setattr(analyze_health, "STATE_DIR", state_dir)
    return state_dir


class TestAutomationScore:
    """Test automation reliability scoring."""
    
    def test_no_logs_returns_no_data(self, tmp_logs_dir):
        """When no logs exist, should return no_data status."""
        runs, successes, failures = parse_log_files(7)
        assert runs == 0
        assert successes == 0
        assert failures == 0
        
        score, details = calculate_automation_score(runs, successes, failures)
        assert score == 50
        assert details["status"] == "no_data"
        assert details["runs"] == 0
    
    def test_all_success_logs(self, tmp_logs_dir):
        """All successful runs should give high score."""
        for i in range(5):
            log_file = tmp_logs_dir / f"recipe-daily-{i}.log"
            log_file.write_text("✅ Recipe completed successfully\nSUCCESS", encoding="utf-8")
        
        runs, successes, failures = parse_log_files(7)
        assert runs == 5
        assert successes == 5
        assert failures == 0
        
        score, details = calculate_automation_score(runs, successes, failures)
        assert score == 95  # 100% success rate
        assert details["success_rate"] == 1.0
    
    def test_partial_failures(self, tmp_logs_dir):
        """Partial failures should reduce score appropriately."""
        # 3 successes
        for i in range(3):
            log = tmp_logs_dir / f"recipe-success-{i}.log"
            log.write_text("✅ completed", encoding="utf-8")
        
        # 2 failures
        for i in range(2):
            log = tmp_logs_dir / f"recipe-failure-{i}.log"
            log.write_text("❌ ERROR: Recipe failed", encoding="utf-8")
        
        runs, successes, failures = parse_log_files(7)
        assert runs == 5
        assert successes == 3
        assert failures == 2
        
        score, details = calculate_automation_score(runs, successes, failures)
        # success_rate = 3/5 = 0.6 -> score should be < 70
        assert score < 70
        assert details["success_rate"] == 0.6
    
    def test_success_rate_thresholds(self):
        """Test score calculation at different success rate thresholds."""
        # 95%+ -> 95
        score, _ = calculate_automation_score(20, 19, 1)
        assert score == 95
        
        # 90-95% -> 85
        score, _ = calculate_automation_score(20, 18, 2)
        assert score == 85
        
        # 80-90% -> 75
        score, _ = calculate_automation_score(20, 16, 4)
        assert score == 75
        
        # 70-80% -> 65
        score, _ = calculate_automation_score(20, 14, 6)
        assert score == 65
        
        # <70% -> lower scores
        score, _ = calculate_automation_score(20, 10, 10)
        assert score <= 65
    
    def test_old_logs_excluded(self, tmp_logs_dir):
        """Logs older than window should be excluded."""
        # Create an old log file
        old_log = tmp_logs_dir / "recipe-old.log"
        old_log.write_text("✅ SUCCESS", encoding="utf-8")
        
        # Set mtime to 10 days ago
        old_time = time.time() - (10 * 24 * 60 * 60)
        old_log.touch()
        import os
        os.utime(old_log, (old_time, old_time))
        
        # Create a recent log
        recent_log = tmp_logs_dir / "recipe-recent.log"
        recent_log.write_text("✅ SUCCESS", encoding="utf-8")
        
        # Window of 7 days should only catch recent
        runs, successes, failures = parse_log_files(7)
        assert runs == 1  # Only recent log
        assert successes == 1


class TestDataFreshness:
    """Test data freshness scoring."""
    
    def test_no_files_returns_no_data(self, tmp_state_dir):
        """When no state files exist, should return no_data."""
        state_files = {
            "duration_stats.json": tmp_state_dir / "duration-stats.json",
            "rhythm_patterns.json": tmp_state_dir / "rhythm-patterns.json"
        }
        
        score, details = calculate_freshness_score(state_files)
        assert score == 50
        assert details["status"] == "no_data"
    
    def test_very_fresh_files_high_score(self, tmp_state_dir):
        """Files < 6h old should score 95."""
        duration_file = tmp_state_dir / "duration-stats.json"
        rhythm_file = tmp_state_dir / "rhythm-patterns.json"
        
        # Create files with current timestamp
        duration_file.write_text("{}", encoding="utf-8")
        rhythm_file.write_text("{}", encoding="utf-8")
        
        state_files = {
            "duration_stats.json": duration_file,
            "rhythm_patterns.json": rhythm_file
        }
        
        score, details = calculate_freshness_score(state_files)
        assert score == 95
        assert details["average_age_hours"] < 1
    
    def test_moderately_stale_files(self, tmp_state_dir):
        """Files 6-24h old should score 80."""
        duration_file = tmp_state_dir / "duration-stats.json"
        duration_file.write_text("{}", encoding="utf-8")
        
        # Set mtime to 12 hours ago
        twelve_hours_ago = time.time() - (12 * 60 * 60)
        import os
        os.utime(duration_file, (twelve_hours_ago, twelve_hours_ago))
        
        state_files = {"duration_stats.json": duration_file}
        
        score, details = calculate_freshness_score(state_files)
        assert score == 80
        assert 11 <= details["average_age_hours"] <= 13
    
    def test_stale_files_low_score(self, tmp_state_dir):
        """Files > 48h old should score 40."""
        duration_file = tmp_state_dir / "duration-stats.json"
        duration_file.write_text("{}", encoding="utf-8")
        
        # Set mtime to 3 days ago
        three_days_ago = time.time() - (3 * 24 * 60 * 60)
        import os
        os.utime(duration_file, (three_days_ago, three_days_ago))
        
        state_files = {"duration_stats.json": duration_file}
        
        score, details = calculate_freshness_score(state_files)
        assert score == 40
        assert details["average_age_hours"] > 48
    
    def test_mixed_file_ages(self, tmp_state_dir):
        """Should average ages across multiple files."""
        fresh_file = tmp_state_dir / "fresh.json"
        stale_file = tmp_state_dir / "stale.json"
        
        fresh_file.write_text("{}", encoding="utf-8")
        stale_file.write_text("{}", encoding="utf-8")
        
        # Fresh: now, Stale: 24h ago
        twenty_four_hours = time.time() - (24 * 60 * 60)
        import os
        os.utime(stale_file, (twenty_four_hours, twenty_four_hours))
        
        state_files = {
            "fresh.json": fresh_file,
            "stale.json": stale_file
        }
        
        score, details = calculate_freshness_score(state_files)
        # Average age should be ~12h -> score 80
        assert score == 80
        assert 10 <= details["average_age_hours"] <= 14


class TestAnalyticsHealth:
    """Test analytics health scoring."""
    
    def test_no_analytics_files(self, tmp_state_dir):
        """When no analytics exist, should return no_analytics."""
        score, details = calculate_analytics_health(tmp_state_dir)
        assert score == 50
        assert details["status"] == "no_analytics"
    
    def test_duration_stats_scoring(self, tmp_state_dir):
        """Duration stats should be scored by task count."""
        # High sample size (50+) -> 95
        duration_file = tmp_state_dir / "duration-stats.json"
        duration_file.write_text(json.dumps({
            "total_tasks_with_duration": 60
        }), encoding="utf-8")
        
        score, details = calculate_analytics_health(tmp_state_dir)
        assert score == 95
        assert details["duration_samples"] == 60
        assert details["duration_score"] == 95
        
        # Medium sample (30-49) -> 85
        duration_file.write_text(json.dumps({
            "total_tasks_with_duration": 35
        }), encoding="utf-8")
        
        score, details = calculate_analytics_health(tmp_state_dir)
        assert score == 85
        
        # Low sample (5-14) -> 55
        duration_file.write_text(json.dumps({
            "total_tasks_with_duration": 8
        }), encoding="utf-8")
        
        score, details = calculate_analytics_health(tmp_state_dir)
        assert score == 55
    
    def test_rhythm_patterns_scoring(self, tmp_state_dir):
        """Rhythm patterns scored by active days + tasks."""
        rhythm_file = tmp_state_dir / "rhythm-patterns.json"
        
        # High quality: 15+ days, 30+ tasks -> 95
        rhythm_file.write_text(json.dumps({
            "active_days": 18,
            "total_tasks": 45
        }), encoding="utf-8")
        
        score, details = calculate_analytics_health(tmp_state_dir)
        assert score == 95
        assert details["rhythm_active_days"] == 18
        assert details["rhythm_score"] == 95
        
        # Medium: 10 days, 20 tasks -> 80
        rhythm_file.write_text(json.dumps({
            "active_days": 10,
            "total_tasks": 22
        }), encoding="utf-8")
        
        score, details = calculate_analytics_health(tmp_state_dir)
        assert score == 80
        
        # Low: 5 days, 10 tasks -> 65
        rhythm_file.write_text(json.dumps({
            "active_days": 5,
            "total_tasks": 12
        }), encoding="utf-8")
        
        score, details = calculate_analytics_health(tmp_state_dir)
        assert score == 65
    
    def test_category_heatmap_scoring(self, tmp_state_dir):
        """Category heatmap scored by active days + tasks."""
        category_file = tmp_state_dir / "category-heatmap.json"
        
        # High: 14+ days, 40+ tasks -> 95
        category_file.write_text(json.dumps({
            "active_days": 15,
            "total_tasks": 50
        }), encoding="utf-8")
        
        score, details = calculate_analytics_health(tmp_state_dir)
        assert score == 95
        assert details["category_samples"] == 50
        
        # Medium: 10 days, 25 tasks -> 80
        category_file.write_text(json.dumps({
            "active_days": 10,
            "total_tasks": 28
        }), encoding="utf-8")
        
        score, details = calculate_analytics_health(tmp_state_dir)
        assert score == 80
    
    def test_multiple_analytics_averaged(self, tmp_state_dir):
        """Multiple analytics should be averaged."""
        duration_file = tmp_state_dir / "duration-stats.json"
        duration_file.write_text(json.dumps({
            "total_tasks_with_duration": 60  # score: 95
        }), encoding="utf-8")
        
        rhythm_file = tmp_state_dir / "rhythm-patterns.json"
        rhythm_file.write_text(json.dumps({
            "active_days": 5,
            "total_tasks": 12  # score: 65
        }), encoding="utf-8")
        
        score, details = calculate_analytics_health(tmp_state_dir)
        # Average of 95 and 65 = 80
        assert score == 80
        assert details["score"] == 80


class TestInsightGeneration:
    """Test insight generation logic."""
    
    def test_excellent_health_insights(self):
        """Overall score >= 90 should produce excellent message."""
        insights = generate_insights(
            overall_score=92,
            automation={"score": 95, "failures": 0},
            freshness={"score": 90},
            analytics={"score": 90}
        )
        
        assert any("excellent health" in i.lower() for i in insights)
        assert any("highly reliable" in i.lower() for i in insights)
    
    def test_healthy_with_warnings(self):
        """Score 75-89 with issues should show warnings."""
        insights = generate_insights(
            overall_score=80,
            automation={"score": 85, "failures": 2},
            freshness={"score": 75, "average_age_hours": 18.5},
            analytics={"score": 80, "rhythm_active_days": 8}
        )
        
        assert any("healthy" in i.lower() for i in insights)
        assert any("2 automation failure" in i for i in insights)
        assert any("rhythm patterns need more data" in i.lower() for i in insights)
    
    def test_moderate_health_alerts(self):
        """Score 60-74 should show moderate health message."""
        insights = generate_insights(
            overall_score=68,
            automation={"score": 70, "failures": 0},
            freshness={"score": 65, "average_age_hours": 30.2},
            analytics={"score": 60}
        )
        
        assert any("moderate" in i.lower() for i in insights)
        assert any("data freshness declined" in i.lower() for i in insights)
    
    def test_low_health_critical_alerts(self):
        """Score < 60 should show critical messages."""
        insights = generate_insights(
            overall_score=45,
            automation={"score": 50, "failures": 5},
            freshness={"score": 40, "average_age_hours": 60.0},
            analytics={"score": 45, "rhythm_active_days": 3}
        )
        
        assert any("low" in i.lower() and "health" in i.lower() for i in insights)
        assert any("5 automation failure" in i for i in insights)
    
    def test_stale_duration_recommendation(self):
        """Stale duration stats should trigger recommendation."""
        insights = generate_insights(
            overall_score=75,
            automation={"score": 80, "failures": 0},
            freshness={
                "score": 70,
                "file_ages_hours": {
                    "duration_stats.json": 30.5,
                    "rhythm_patterns.json": 5.2
                }
            },
            analytics={"score": 75}
        )
        
        assert any("duration stats are stale" in i.lower() for i in insights)
        assert any("analyze-duration.py" in i for i in insights)
    
    def test_low_analytics_health_message(self):
        """Low analytics score should produce specific message."""
        insights = generate_insights(
            overall_score=70,
            automation={"score": 85, "failures": 0},
            freshness={"score": 80},
            analytics={"score": 55, "rhythm_active_days": 4}
        )
        
        assert any("analytics health is low" in i.lower() for i in insights)
        assert any("more task history needed" in i.lower() for i in insights)
    
    def test_rhythm_data_insufficient(self):
        """Low rhythm active days should trigger warning."""
        insights = generate_insights(
            overall_score=75,
            automation={"score": 85, "failures": 0},
            freshness={"score": 80},
            analytics={"score": 70, "rhythm_active_days": 6}
        )
        
        assert any("rhythm patterns need more data" in i.lower() for i in insights)
        assert any("10+ active days" in i for i in insights)


class TestEdgeCases:
    """Test edge cases and error handling."""
    
    def test_corrupt_json_files_handled(self, tmp_state_dir):
        """Corrupt JSON files should not crash the analysis."""
        duration_file = tmp_state_dir / "duration-stats.json"
        duration_file.write_text("{ corrupt json }", encoding="utf-8")
        
        # Should not raise, should return fallback score
        score, details = calculate_analytics_health(tmp_state_dir)
        assert score == 50
        assert details["status"] == "no_analytics"
    
    def test_empty_log_files(self, tmp_logs_dir):
        """Empty log files should be handled gracefully."""
        empty_log = tmp_logs_dir / "recipe-empty.log"
        empty_log.write_text("", encoding="utf-8")
        
        runs, successes, failures = parse_log_files(7)
        # Empty files contribute to runs but neither success nor failure
        assert runs == 1
        assert successes == 0
        assert failures == 0
    
    def test_mixed_success_failure_indicators(self, tmp_logs_dir):
        """Logs with both success and failure markers."""
        mixed_log = tmp_logs_dir / "recipe-mixed.log"
        mixed_log.write_text(
            "Starting recipe...\n"
            "Step 1: ✅ SUCCESS\n"
            "Step 2: ❌ ERROR\n"
            "Overall: ✅ completed with warnings",
            encoding="utf-8"
        )
        
        runs, successes, failures = parse_log_files(7)
        # Should detect both markers, but success takes precedence if both present
        assert runs == 1
        # The current heuristic checks for success first
        assert successes == 1
    
    def test_zero_division_protection(self):
        """Ensure no division by zero in score calculations."""
        score, details = calculate_automation_score(0, 0, 0)
        assert score == 50
        assert details["status"] == "no_data"
        
        # Single file with neither success nor failure marker
        score, details = calculate_automation_score(1, 0, 0)
        # success_rate = 0/1 = 0 -> score should be 50 (minimum)
        assert score == 50


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

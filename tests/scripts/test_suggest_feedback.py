"""Tests for feedback integration in suggest.py"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "scripts"))

from suggest import energy_factor, score_task


def test_energy_factor_low():
    """Low energy reduces heavy task scores."""
    assert energy_factor(3) == 0.6
    assert energy_factor(4) == 0.6


def test_energy_factor_normal():
    """Normal energy has neutral effect."""
    assert energy_factor(5) == 1.0
    assert energy_factor(6) == 1.0
    assert energy_factor(7) == 1.0


def test_energy_factor_high():
    """High energy boosts task scores."""
    assert energy_factor(8) == 1.2
    assert energy_factor(9) == 1.2
    assert energy_factor(10) == 1.2


def test_energy_factor_none():
    """No feedback data has neutral effect."""
    assert energy_factor(None) == 1.0


def test_score_task_with_low_energy():
    """Tasks are scored lower when energy is low."""
    task = {'priority': 1, 'category': 'core-work', 'estimated_minutes': 60}
    context_normal = {'weekday': 'Monday', 'rhythm': {}, 'category_heatmap': {}, 'feedback': {}}
    context_low_energy = {'weekday': 'Monday', 'rhythm': {}, 'category_heatmap': {}, 'feedback': {'energy': 3}}
    
    score_normal = score_task(task, context_normal)
    score_low = score_task(task, context_low_energy)
    
    assert score_low < score_normal
    assert abs(score_low - score_normal * 0.6) < 0.01


def test_score_task_with_high_energy():
    """Tasks are scored higher when energy is high."""
    task = {'priority': 2, 'category': 'admin', 'estimated_minutes': 30}
    context_normal = {'weekday': 'Friday', 'rhythm': {}, 'category_heatmap': {}, 'feedback': {}}
    context_high_energy = {'weekday': 'Friday', 'rhythm': {}, 'category_heatmap': {}, 'feedback': {'energy': 9}}
    
    score_normal = score_task(task, context_normal)
    score_high = score_task(task, context_high_energy)
    
    assert score_high > score_normal
    assert abs(score_high - score_normal * 1.2) < 0.01

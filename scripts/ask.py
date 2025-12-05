#!/usr/bin/env python3
"""
Cortex OS Q&A Agent - /ask

Context-aware Q&A interface for Cortex OS.
Answers questions based on digests, tasks, summaries, and system state.

Usage:
    python scripts/ask.py "What's on my plate today?"
    python scripts/ask.py "How was my week?"
    python scripts/ask.py "System status?"
"""

import json
import sys
from pathlib import Path
from datetime import datetime, timedelta
import argparse
import os

try:
    from anthropic import Anthropic
except ImportError:
    print("Error: anthropic package required. Install with: pip install anthropic", file=sys.stderr)
    sys.exit(1)

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv is optional


def load_context(question: str) -> dict:
    """
    Load relevant context based on the question.
    
    Returns a dict with:
      - today_digest: Today's digest content
      - task_entry: Today's task entry JSON
      - tomorrow: Tomorrow.json content
      - weekly_summary: This week's summary
      - llms_txt: System documentation
    """
    context = {}
    today = datetime.now().strftime("%Y-%m-%d")
    
    # Determine context needs from question
    question_lower = question.lower()
    needs_today = any(word in question_lower for word in ['today', 'now', 'current', 'plate'])
    needs_week = any(word in question_lower for word in ['week', 'this week', 'last week'])
    needs_tomorrow = any(word in question_lower for word in ['tomorrow', 'next', 'plan'])
    needs_system = any(word in question_lower for word in ['system', 'status', 'health', 'cortex'])
    
    # Load today's digest
    if needs_today or not (needs_week or needs_tomorrow or needs_system):
        digest_path = Path(f"cortex/daily/{today}-digest.md")
        if digest_path.exists():
            context['today_digest'] = digest_path.read_text(encoding='utf-8')
        else:
            context['today_digest'] = None
    
    # Load task entry
    if needs_today or needs_week:
        task_entry_path = Path(f"cortex/state/task-entry-{today}.json")
        if task_entry_path.exists():
            with open(task_entry_path, 'r', encoding='utf-8') as f:
                context['task_entry'] = json.load(f)
        else:
            context['task_entry'] = None
    
    # Load tomorrow.json
    if needs_tomorrow:
        tomorrow_path = Path("data/tomorrow.json")
        if tomorrow_path.exists():
            with open(tomorrow_path, 'r', encoding='utf-8') as f:
                context['tomorrow'] = json.load(f)
        else:
            context['tomorrow'] = None
    
    # Load weekly summary
    if needs_week:
        year, week = datetime.now().isocalendar()[:2]
        weekly_path = Path(f"cortex/weekly/{year}-W{week:02d}-summary.md")
        if weekly_path.exists():
            context['weekly_summary'] = weekly_path.read_text(encoding='utf-8')
        else:
            context['weekly_summary'] = None
    
    # Load system documentation
    if needs_system:
        llms_path = Path("llms.txt")
        if llms_path.exists():
            # Only load first 1000 lines to avoid token limits
            lines = llms_path.read_text(encoding='utf-8').split('\n')[:1000]
            context['llms_txt'] = '\n'.join(lines)
        else:
            context['llms_txt'] = None
    
    return context


def build_prompt(question: str, context: dict) -> str:
    """Build the full prompt with context."""
    
    prompt_parts = [
        "You are the Q&A Agent for Cortex OS, a personal automation system.",
        "",
        "Your role:",
        "1. Answer the user's question based on the provided context",
        "2. Be factual and cite sources",
        "3. Be concise (3-5 lines preferred)",
        "4. Suggest next actions if relevant",
        "",
        "User Question:",
        f"> {question}",
        "",
        "=== CONTEXT ===" ,
        ""
    ]
    
    # Add today's digest
    if context.get('today_digest'):
        prompt_parts.extend([
            "## Today's Digest",
            "",
            context['today_digest'][:1000],  # Limit to first 1000 chars
            "",
            "---",
            ""
        ])
    
    # Add task entry
    if context.get('task_entry'):
        task_data = context['task_entry']
        metadata = task_data.get('metadata', {})
        prompt_parts.extend([
            "## Task Entry (Today)",
            "",
            f"- Date: {task_data.get('date', 'N/A')}",
            f"- Total Tasks: {metadata.get('total_tasks', 0)}",
            f"- Completed: {metadata.get('completed', 0)}",
            f"- Completion Rate: {metadata.get('completion_rate', 0):.0%}",
            f"- Workload Level: {metadata.get('workload_level', 'unknown')}",
            "",
            "---",
            ""
        ])
    
    # Add tomorrow.json
    if context.get('tomorrow'):
        tomorrow_data = context['tomorrow']
        candidates = tomorrow_data.get('tomorrow_candidates', [])
        prompt_parts.extend([
            "## Tomorrow's Plan",
            "",
            f"- Generated: {tomorrow_data.get('generated_at', 'N/A')}",
            f"- Candidates: {len(candidates)}",
            "",
            "Tasks:",
        ])
        for i, task in enumerate(candidates[:5], 1):  # Limit to first 5
            prompt_parts.append(f"  {i}. {task.get('task', 'N/A')} ({task.get('priority', 'medium')} priority)")
        prompt_parts.extend(["", "---", ""])
    
    # Add weekly summary
    if context.get('weekly_summary'):
        prompt_parts.extend([
            "## Weekly Summary",
            "",
            context['weekly_summary'][:1500],  # Limit to first 1500 chars
            "",
            "---",
            ""
        ])
    
    # Add system docs
    if context.get('llms_txt'):
        prompt_parts.extend([
            "## System Documentation",
            "",
            context['llms_txt'][:800],  # Limit to first 800 chars
            "",
            "---",
            ""
        ])
    
    prompt_parts.extend([
        "=== END CONTEXT ===",
        "",
        "Now answer the question. Format:",
        "",
        "```",
        "{Your answer}",
        "",
        "---",
        "",
        "📍 Source:",
        "- {List sources you referenced}",
        "",
        "💡 Next Action (if relevant):",
        "- {Suggested next step}",
        "```"
    ])
    
    return '\n'.join(prompt_parts)


def ask_claude(prompt: str) -> str:
    """Send prompt to Claude API and get response."""
    
    api_key = os.environ.get('ANTHROPIC_API_KEY')
    if not api_key:
        return "❌ Error: ANTHROPIC_API_KEY not set in environment"
    
    model = os.environ.get('ANTHROPIC_MODEL', 'claude-3-5-sonnet-20241022')
    
    try:
        client = Anthropic(api_key=api_key)
        
        response = client.messages.create(
            model=model,
            max_tokens=1024,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        
        return response.content[0].text
    
    except Exception as e:
        return f"❌ Error calling Claude API: {str(e)}"


def main():
    parser = argparse.ArgumentParser(description="Cortex OS Q&A Agent")
    parser.add_argument('question', nargs='+', help='Your question')
    args = parser.parse_args()
    
    question = ' '.join(args.question)
    
    print(f"🔍 Processing: {question}")
    print()
    
    # Load context
    context = load_context(question)
    
    # Check if we have any context
    has_context = any(v is not None for v in context.values())
    if not has_context:
        print("⚠️  No context available. Available data:")
        print("  - No digest for today (run: make daily-digest)")
        print("  - No task entry (run: python scripts/extract-tasks.py)")
        print("  - No tomorrow.json (run: /wrap-up)")
        return
    
    # Build prompt
    prompt = build_prompt(question, context)
    
    # Ask Claude
    answer = ask_claude(prompt)
    
    # Display answer
    print(answer)
    print()


if __name__ == "__main__":
    main()

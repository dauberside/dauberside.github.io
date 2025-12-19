#!/bin/bash
set -e

# sync-todo.sh - Sync tasks from brief-{date}.json to TODO.md
# Usage: ./scripts/sync-todo.sh [today|tomorrow|both] [--append|--replace]

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
# Fallback to MCP_OBSIDIAN_API_KEY if OBSIDIAN_API_KEY is not set
OBSIDIAN_API_KEY="${OBSIDIAN_API_KEY:-${MCP_OBSIDIAN_API_KEY}}"
OBSIDIAN_URL="https://127.0.0.1:27124"
PROJECT_ROOT="/Volumes/Extreme Pro/dauberside.github.io-1"

# Parse arguments
MODE="${1:-today}"
OPERATION="${2:---replace}"

echo -e "${GREEN}🔄 /sync-todo ${MODE} ${OPERATION}${NC}"
echo ""

# Check required commands
echo -e "${YELLOW}🔍 Checking dependencies...${NC}"
MISSING_DEPS=0

if ! command -v jq &> /dev/null; then
  echo -e "${RED}❌ jq is not installed${NC}"
  echo "Install with: brew install jq"
  MISSING_DEPS=1
fi

if ! command -v python3 &> /dev/null; then
  echo -e "${RED}❌ python3 is not installed${NC}"
  MISSING_DEPS=1
fi

if ! command -v curl &> /dev/null; then
  echo -e "${RED}❌ curl is not installed${NC}"
  MISSING_DEPS=1
fi

if [ $MISSING_DEPS -eq 1 ]; then
  exit 1
fi

echo -e "${GREEN}✅ All dependencies found${NC}"
echo ""

# Validate Obsidian API key
if [ -z "$OBSIDIAN_API_KEY" ]; then
  echo -e "${RED}❌ Error: OBSIDIAN_API_KEY or MCP_OBSIDIAN_API_KEY is not set${NC}"
  echo "Please set one of the following environment variables:"
  echo "  export OBSIDIAN_API_KEY=your_api_key"
  echo "  export MCP_OBSIDIAN_API_KEY=your_api_key"
  exit 1
fi

# Function: Get today's date
get_today() {
  date +%Y-%m-%d
}

# Function: Get tomorrow's date
get_tomorrow() {
  date -v+1d +%Y-%m-%d
}

# Function: Read brief JSON and generate Markdown tasks
generate_tasks_from_brief() {
  local date=$1
  local brief_file="${PROJECT_ROOT}/cortex/state/brief-${date}.json"

  if [ ! -f "$brief_file" ]; then
    echo -e "${RED}❌ Error: ${brief_file} not found${NC}" >&2
    echo "Hint: Run /brief to generate today's task plan" >&2
    return 1
  fi

  echo -e "${YELLOW}📖 Reading: ${brief_file}${NC}" >&2

  # Validate JSON structure
  if ! jq empty "$brief_file" 2>/dev/null; then
    echo -e "${RED}❌ Error: Invalid JSON format in ${brief_file}${NC}" >&2
    return 1
  fi

  # Check if tasks array exists
  if ! jq -e '.tasks' "$brief_file" &>/dev/null; then
    echo -e "${RED}❌ Error: Missing 'tasks' field in ${brief_file}${NC}" >&2
    return 1
  fi

  # Generate Markdown task list
  local tasks=$(cat "$brief_file" | jq -r '.tasks[] | "- [\(if .status == "completed" then "x" else " " end)] \(.title) (\(.time))"' 2>&1)

  if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error: Failed to parse tasks from ${brief_file}${NC}" >&2
    echo "Details: ${tasks}" >&2
    return 1
  fi

  echo "$tasks"
}

# Function: Read tomorrow.json and generate Markdown tasks
generate_tasks_from_tomorrow() {
  local tomorrow_file="${PROJECT_ROOT}/cortex/state/tomorrow.json"

  if [ ! -f "$tomorrow_file" ]; then
    echo -e "${RED}❌ Error: ${tomorrow_file} not found${NC}" >&2
    echo "Hint: Run /wrap-up to generate tomorrow's task candidates" >&2
    return 1
  fi

  echo -e "${YELLOW}📖 Reading: ${tomorrow_file}${NC}" >&2

  # Validate JSON structure
  if ! jq empty "$tomorrow_file" 2>/dev/null; then
    echo -e "${RED}❌ Error: Invalid JSON format in ${tomorrow_file}${NC}" >&2
    return 1
  fi

  # Check if tomorrow_candidates array exists
  if ! jq -e '.tomorrow_candidates' "$tomorrow_file" &>/dev/null; then
    echo -e "${RED}❌ Error: Missing 'tomorrow_candidates' field in ${tomorrow_file}${NC}" >&2
    return 1
  fi

  # Generate Markdown task list from tomorrow_candidates
  local tasks=$(cat "$tomorrow_file" | jq -r '.tomorrow_candidates[]? | "- [ ] \(.)"' 2>&1)

  if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error: Failed to parse tomorrow_candidates from ${tomorrow_file}${NC}" >&2
    echo "Details: ${tasks}" >&2
    return 1
  fi

  if [ -z "$tasks" ]; then
    echo -e "${YELLOW}⚠️  Warning: No tomorrow_candidates found in ${tomorrow_file}${NC}" >&2
    echo "- [ ] (No tasks scheduled for tomorrow)"
    return 0
  fi

  echo "$tasks"
}

# Function: Get TODO.md from Obsidian
get_todo_md() {
  local response=$(curl -k -s -w "\n%{http_code}" "${OBSIDIAN_URL}/vault/TODO.md" \
    -H "Authorization: Bearer ${OBSIDIAN_API_KEY}" \
    -H "Accept: application/json")

  local http_code=$(echo "$response" | tail -n 1)
  local body=$(echo "$response" | sed '$d')

  if [ "$http_code" != "200" ]; then
    echo -e "${RED}❌ Error: Obsidian API returned HTTP ${http_code}${NC}" >&2
    if [ "$http_code" == "401" ]; then
      echo "Hint: Check your OBSIDIAN_API_KEY" >&2
    elif [ "$http_code" == "000" ]; then
      echo "Hint: Is Obsidian running? Is the Local REST API plugin enabled?" >&2
    fi
    return 1
  fi

  local content=$(echo "$body" | jq -r '.content // empty' 2>&1)
  if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error: Failed to parse Obsidian API response${NC}" >&2
    echo "Details: ${content}" >&2
    return 1
  fi

  echo "$content"
}

# Function: Update TODO.md via Obsidian API
update_todo_md() {
  local content=$1
  local temp_file=$(mktemp)

  echo "$content" > "$temp_file"

  local response=$(curl -k -s -w "\n%{http_code}" -X PUT "${OBSIDIAN_URL}/vault/TODO.md" \
    -H "Authorization: Bearer ${OBSIDIAN_API_KEY}" \
    -H "Content-Type: text/markdown" \
    --data-binary "@${temp_file}")

  local http_code=$(echo "$response" | tail -n 1)
  local body=$(echo "$response" | sed '$d')

  rm "$temp_file"

  if [ "$http_code" != "200" ] && [ "$http_code" != "204" ]; then
    echo -e "${RED}❌ Error: Failed to update TODO.md (HTTP ${http_code})${NC}" >&2
    if [ "$http_code" == "401" ]; then
      echo "Hint: Check your OBSIDIAN_API_KEY" >&2
    elif [ "$http_code" == "000" ]; then
      echo "Hint: Is Obsidian running? Is the Local REST API plugin enabled?" >&2
    fi
    echo "Response: ${body}" >&2
    return 1
  fi

  return 0
}

# Main logic
case "$MODE" in
  today)
    TODAY=$(get_today)
    echo -e "${GREEN}📅 Date: ${TODAY}${NC}"
    echo ""

    # Generate task list
    TASKS=$(generate_tasks_from_brief "$TODAY")
    if [ $? -ne 0 ]; then
      exit 1
    fi

    echo ""
    echo -e "${GREEN}✅ Generated tasks:${NC}"
    echo "$TASKS"
    echo ""

    # Get current TODO.md
    echo -e "${YELLOW}📥 Fetching TODO.md from Obsidian...${NC}"
    CURRENT_TODO=$(get_todo_md)

    if [ -z "$CURRENT_TODO" ]; then
      echo -e "${RED}❌ Error: Failed to fetch TODO.md${NC}"
      exit 1
    fi

    # Process based on operation mode
    if [ "$OPERATION" == "--append" ]; then
      echo -e "${YELLOW}📝 Mode: APPEND (既存タスクに追記)${NC}"
      UPDATED_TODO=$(python3 << PYTHON_EOF
import re
current = """$CURRENT_TODO"""
new_tasks = """$TASKS"""

# Find existing Today section
pattern = r'## Today — ${TODAY}(.*?)(?=\n---)'
match = re.search(pattern, current, flags=re.DOTALL)

if match:
    existing_content = match.group(1).strip()
    # Extract existing tasks (lines starting with - [ ] or - [x])
    existing_tasks = []
    for line in existing_content.split('\n'):
        if line.strip().startswith('- ['):
            existing_tasks.append(line)

    # Combine existing and new tasks
    all_tasks = '\n'.join(existing_tasks) + '\n' + new_tasks

    new_section = """## Today — ${TODAY}

""" + all_tasks + """

---

**✅ 完了サマリー**
- /sync-todo --append で追記

**🎯 明日への引き継ぎ**
- 明朝 Recipe 03/10 の自動実行を確認"""

    # Replace section
    section_pattern = r'## Today — ${TODAY}.*?(?=\n---\n\n## )'
    updated = re.sub(section_pattern, new_section, current, flags=re.DOTALL)
else:
    # Section doesn't exist, create new one
    new_section = """## Today — ${TODAY}

""" + new_tasks + """

---

**✅ 完了サマリー**
- /sync-todo --append で追記

**🎯 明日への引き継ぎ**
- 明朝 Recipe 03/10 の自動実行を確認"""
    updated = new_section + "\n\n---\n\n" + current

print(updated)
PYTHON_EOF
)
    else
      echo -e "${YELLOW}📝 Mode: REPLACE (セクションを置き換え)${NC}"
      NEW_TODAY_SECTION="## Today — ${TODAY}

${TASKS}

---

**✅ 完了サマリー**
- /sync-todo で自動反映

**🎯 明日への引き継ぎ**
- 明朝 Recipe 03/10 の自動実行を確認"

      UPDATED_TODO=$(python3 << PYTHON_EOF
import re
current = """$CURRENT_TODO"""
new_section = """$NEW_TODAY_SECTION"""
pattern = r'## Today — ${TODAY}.*?(?=\n---\n\n## )'
updated = re.sub(pattern, new_section, current, flags=re.DOTALL)
if updated == current:
    updated = new_section + "\n\n---\n\n" + current
print(updated)
PYTHON_EOF
)
    fi

    # Update TODO.md
    echo -e "${YELLOW}📤 Updating TODO.md in Obsidian...${NC}"
    if ! update_todo_md "$UPDATED_TODO"; then
      echo -e "${RED}❌ Failed to update TODO.md${NC}"
      exit 1
    fi

    echo ""
    echo -e "${GREEN}✅ TODO.md updated successfully!${NC}"
    ;;

  tomorrow)
    TOMORROW=$(get_tomorrow)
    echo -e "${GREEN}📅 Date: ${TOMORROW}${NC}"
    echo ""

    # Generate task list
    TASKS=$(generate_tasks_from_tomorrow)
    if [ $? -ne 0 ]; then
      exit 1
    fi

    echo ""
    echo -e "${GREEN}✅ Generated tasks:${NC}"
    echo "$TASKS"
    echo ""

    # Get current TODO.md
    echo -e "${YELLOW}📥 Fetching TODO.md from Obsidian...${NC}"
    CURRENT_TODO=$(get_todo_md)

    if [ -z "$CURRENT_TODO" ]; then
      echo -e "${RED}❌ Error: Failed to fetch TODO.md${NC}"
      exit 1
    fi

    # Process based on operation mode
    if [ "$OPERATION" == "--append" ]; then
      echo -e "${YELLOW}📝 Mode: APPEND (既存タスクに追記)${NC}"
      UPDATED_TODO=$(python3 << PYTHON_EOF
import re
current = """$CURRENT_TODO"""
new_tasks = """$TASKS"""

# Find existing Tomorrow section
pattern = r'## Tomorrow — ${TOMORROW}(.*?)(?=\n---)'
match = re.search(pattern, current, flags=re.DOTALL)

if match:
    existing_content = match.group(1).strip()
    # Extract existing tasks
    existing_tasks = []
    for line in existing_content.split('\n'):
        if line.strip().startswith('- ['):
            existing_tasks.append(line)

    # Combine existing and new tasks
    all_tasks = '\n'.join(existing_tasks) + '\n' + new_tasks

    new_section = """## Tomorrow — ${TOMORROW}

""" + all_tasks + """

---

**🌅 明日の準備**
- /wrap-up の tomorrow_candidates から自動反映 (--append)"""

    # Replace section
    section_pattern = r'## Tomorrow — ${TOMORROW}.*?(?=\n---\n\n## )'
    updated = re.sub(section_pattern, new_section, current, flags=re.DOTALL)
else:
    # Section doesn't exist, create new one
    new_section = """## Tomorrow — ${TOMORROW}

""" + new_tasks + """

---

**🌅 明日の準備**
- /wrap-up の tomorrow_candidates から自動反映 (--append)"""

    # Try to insert after Today section
    today_pattern = r'(## Today — .*?\n---)'
    match = re.search(today_pattern, current, flags=re.DOTALL)
    if match:
        insert_pos = match.end()
        updated = current[:insert_pos] + "\n\n" + new_section + "\n" + current[insert_pos:]
    else:
        updated = new_section + "\n\n---\n\n" + current

print(updated)
PYTHON_EOF
)
    else
      echo -e "${YELLOW}📝 Mode: REPLACE (セクションを置き換え)${NC}"
      NEW_TOMORROW_SECTION="## Tomorrow — ${TOMORROW}

${TASKS}

---

**🌅 明日の準備**
- /wrap-up の tomorrow_candidates から自動反映"

      UPDATED_TODO=$(python3 << PYTHON_EOF
import re
current = """$CURRENT_TODO"""
new_section = """$NEW_TOMORROW_SECTION"""

# Find and replace Tomorrow section
pattern = r'## Tomorrow — ${TOMORROW}.*?(?=\n---\n\n## )'
updated = re.sub(pattern, new_section, current, flags=re.DOTALL)

# If pattern not found, insert after Today section
if updated == current:
    # Try to find Today section and insert after it
    today_pattern = r'(## Today — .*?\n---)'
    match = re.search(today_pattern, current, flags=re.DOTALL)
    if match:
        insert_pos = match.end()
        updated = current[:insert_pos] + "\n\n" + new_section + "\n" + current[insert_pos:]
    else:
        # If no Today section, add at beginning
        updated = new_section + "\n\n---\n\n" + current

print(updated)
PYTHON_EOF
)
    fi

    # Update TODO.md
    echo -e "${YELLOW}📤 Updating TODO.md in Obsidian...${NC}"
    if ! update_todo_md "$UPDATED_TODO"; then
      echo -e "${RED}❌ Failed to update TODO.md${NC}"
      exit 1
    fi

    echo ""
    echo -e "${GREEN}✅ TODO.md updated successfully!${NC}"
    ;;

  both)
    echo -e "${GREEN}🔄 Syncing both Today and Tomorrow${NC}"
    echo ""

    # Run today sync
    echo -e "${YELLOW}=== Syncing Today ===${NC}"
    TODAY=$(get_today)
    echo -e "${GREEN}📅 Date: ${TODAY}${NC}"

    TASKS_TODAY=$(generate_tasks_from_brief "$TODAY")
    if [ $? -ne 0 ]; then
      echo -e "${RED}❌ Failed to generate today's tasks${NC}"
      exit 1
    fi

    echo ""
    echo -e "${GREEN}✅ Today's tasks:${NC}"
    echo "$TASKS_TODAY"
    echo ""

    # Run tomorrow sync
    echo -e "${YELLOW}=== Syncing Tomorrow ===${NC}"
    TOMORROW=$(get_tomorrow)
    echo -e "${GREEN}📅 Date: ${TOMORROW}${NC}"

    TASKS_TOMORROW=$(generate_tasks_from_tomorrow)
    if [ $? -ne 0 ]; then
      echo -e "${RED}❌ Failed to generate tomorrow's tasks${NC}"
      exit 1
    fi

    echo ""
    echo -e "${GREEN}✅ Tomorrow's tasks:${NC}"
    echo "$TASKS_TOMORROW"
    echo ""

    # Get current TODO.md
    echo -e "${YELLOW}📥 Fetching TODO.md from Obsidian...${NC}"
    CURRENT_TODO=$(get_todo_md)

    if [ -z "$CURRENT_TODO" ]; then
      echo -e "${RED}❌ Error: Failed to fetch TODO.md${NC}"
      exit 1
    fi

    # Process based on operation mode
    if [ "$OPERATION" == "--append" ]; then
      echo -e "${YELLOW}📝 Mode: APPEND (既存タスクに追記)${NC}"
      UPDATED_TODO=$(python3 << PYTHON_EOF
import re
current = """$CURRENT_TODO"""
today_tasks = """$TASKS_TODAY"""
tomorrow_tasks = """$TASKS_TOMORROW"""

# Process Today section
today_pattern = r'## Today — ${TODAY}(.*?)(?=\n---)'
today_match = re.search(today_pattern, current, flags=re.DOTALL)

if today_match:
    existing_today = today_match.group(1).strip()
    existing_today_tasks = []
    for line in existing_today.split('\n'):
        if line.strip().startswith('- ['):
            existing_today_tasks.append(line)
    all_today_tasks = '\n'.join(existing_today_tasks) + '\n' + today_tasks
else:
    all_today_tasks = today_tasks

today_section = """## Today — ${TODAY}

""" + all_today_tasks + """

---

**✅ 完了サマリー**
- /sync-todo both --append で追記

**🎯 明日への引き継ぎ**
- 明朝 Recipe 03/10 の自動実行を確認"""

# Process Tomorrow section
tomorrow_pattern = r'## Tomorrow — ${TOMORROW}(.*?)(?=\n---)'
tomorrow_match = re.search(tomorrow_pattern, current, flags=re.DOTALL)

if tomorrow_match:
    existing_tomorrow = tomorrow_match.group(1).strip()
    existing_tomorrow_tasks = []
    for line in existing_tomorrow.split('\n'):
        if line.strip().startswith('- ['):
            existing_tomorrow_tasks.append(line)
    all_tomorrow_tasks = '\n'.join(existing_tomorrow_tasks) + '\n' + tomorrow_tasks
else:
    all_tomorrow_tasks = tomorrow_tasks

tomorrow_section = """## Tomorrow — ${TOMORROW}

""" + all_tomorrow_tasks + """

---

**🌅 明日の準備**
- /wrap-up の tomorrow_candidates から自動反映 (--append)"""

# Replace Today section
today_section_pattern = r'## Today — ${TODAY}.*?(?=\n---\n\n## )'
updated = re.sub(today_section_pattern, today_section, current, flags=re.DOTALL)

# Replace Tomorrow section
tomorrow_section_pattern = r'## Tomorrow — ${TOMORROW}.*?(?=\n---\n\n## )'
updated = re.sub(tomorrow_section_pattern, tomorrow_section, updated, flags=re.DOTALL)

# If Today section not found, add at beginning
if '## Today — ${TODAY}' not in updated:
    updated = today_section + "\n\n---\n\n" + updated

# If Tomorrow section not found, add after Today
if '## Tomorrow — ${TOMORROW}' not in updated:
    today_end = updated.find(today_section) + len(today_section)
    if today_end > 0:
        next_divider = updated.find('\n---\n\n## ', today_end)
        if next_divider > 0:
            insert_pos = next_divider + len('\n---\n\n')
            updated = updated[:insert_pos] + tomorrow_section + "\n\n---\n\n" + updated[insert_pos:]

print(updated)
PYTHON_EOF
)
    else
      echo -e "${YELLOW}📝 Mode: REPLACE (セクションを置き換え)${NC}"
      NEW_TODAY_SECTION="## Today — ${TODAY}

${TASKS_TODAY}

---

**✅ 完了サマリー**
- /sync-todo both で自動反映

**🎯 明日への引き継ぎ**
- 明朝 Recipe 03/10 の自動実行を確認"

      NEW_TOMORROW_SECTION="## Tomorrow — ${TOMORROW}

${TASKS_TOMORROW}

---

**🌅 明日の準備**
- /wrap-up の tomorrow_candidates から自動反映"

      UPDATED_TODO=$(python3 << PYTHON_EOF
import re
current = """$CURRENT_TODO"""
today_section = """$NEW_TODAY_SECTION"""
tomorrow_section = """$NEW_TOMORROW_SECTION"""

# Replace Today section
today_pattern = r'## Today — ${TODAY}.*?(?=\n---\n\n## )'
updated = re.sub(today_pattern, today_section, current, flags=re.DOTALL)

# Replace Tomorrow section
tomorrow_pattern = r'## Tomorrow — ${TOMORROW}.*?(?=\n---\n\n## )'
updated = re.sub(tomorrow_pattern, tomorrow_section, updated, flags=re.DOTALL)

# If Today section not found, add it at beginning
if '## Today — ${TODAY}' not in updated:
    updated = today_section + "\n\n---\n\n" + updated

# If Tomorrow section not found, add it after Today
if '## Tomorrow — ${TOMORROW}' not in updated:
    today_end = updated.find(today_section) + len(today_section)
    if today_end > 0:
        # Find the next --- after Today section
        next_divider = updated.find('\n---\n\n## ', today_end)
        if next_divider > 0:
            insert_pos = next_divider + len('\n---\n\n')
            updated = updated[:insert_pos] + tomorrow_section + "\n\n---\n\n" + updated[insert_pos:]

print(updated)
PYTHON_EOF
)
    fi

    if [ $? -ne 0 ]; then
      echo -e "${RED}❌ Error: Failed to update TODO.md content${NC}"
      exit 1
    fi

    # Update TODO.md
    echo -e "${YELLOW}📤 Updating TODO.md in Obsidian...${NC}"
    if ! update_todo_md "$UPDATED_TODO"; then
      echo -e "${RED}❌ Failed to update TODO.md${NC}"
      exit 1
    fi

    echo ""
    echo -e "${GREEN}✅ TODO.md updated successfully (both Today and Tomorrow)!${NC}"
    ;;

  *)
    echo -e "${RED}❌ Error: Invalid mode '${MODE}'${NC}"
    echo "Usage: ./scripts/sync-todo.sh [today|tomorrow|both] [--append|--replace]"
    exit 1
    ;;
esac

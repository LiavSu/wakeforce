---
name: memory-log
description: Reads and appends to an agent's long-term memory log file. Use READ at the start of a task to recall past decisions and the user's preferences; use APPEND at the end to record what was decided. Shared by every sub-agent in the team — each agent passes its OWN log_path so logs never collide.
---

## What I do
I give any agent durable, long-term memory by persisting notes to a `.log` file on disk.
Every agent in the team uses this same skill but points it at its own file, e.g.
`.opencode/memory/coder-engineer.log`, `.opencode/memory/security-cyber.log`, etc.
- **read_memory_log(log_path)** — recall everything saved so far (run this first).
- **append_memory_log(log_path, entry)** — save a new note (run this last).

## Input Schema
- `read_memory_log` — `log_path: string` (project-relative path to this agent's log, e.g. `.opencode/memory/<agent-name>.log`).
- `append_memory_log` — `log_path: string`, `entry: string` (the text block to save).

## Execution Logic
```python
import os
from datetime import date

def read_memory_log(log_path: str) -> str:
    """
    Returns the full contents of the given memory log.

    Use this at the START of a task to recall past decisions and the user's
    recurring preferences. If the log does not exist yet, returns an empty
    string instead of failing.
    """
    try:
        if not os.path.exists(log_path):
            return ""
        with open(log_path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        return f"Error reading memory log: {str(e)}"

def append_memory_log(log_path: str, entry: str) -> str:
    """
    Appends a single dated entry to the given memory log.

    Use this at the END of a task to record what was decided. NEVER write
    secrets, keys, or personal data. Returns a confirmation string, or the
    error as text if something goes wrong (it never raises/crashes).
    """
    try:
        parent = os.path.dirname(log_path)
        if parent:
            os.makedirs(parent, exist_ok=True)
        stamped = f"\n[{date.today().isoformat()}] {entry.strip()}\n"
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(stamped)
        return "Memory entry saved."
    except Exception as e:
        return f"Error writing memory log: {str(e)}"
```
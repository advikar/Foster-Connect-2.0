# Foster Connect — shared agent entry point

Read `docs/WORKFLOW.md` and `docs/HANDOFF.md` before project work. Read only the relevant task in `docs/TASKS.md`; do not re-audit the entire repository by default.

The user's current request overrides defaults in these documents. These files coordinate Codex and Claude Code; provider chat history is not the source of truth.

Before editing, record the task, owner, intended files, and next checkpoint in HANDOFF. Update it after each coherent implementation/test checkpoint and before stopping. Preserve incomplete work and report tests actually run. Never mark untested functionality verified.

Only one editor operates in this checkout at a time. If another editor is active, perform independent read-only review or coordinate with the user. Do not overwrite their work. No Git repository was present when this setup was added; do not assume branches or commit history exist.

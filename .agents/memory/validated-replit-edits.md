---
name: Validated .replit edits
description: Environment constraint for safely changing the Replit configuration file.
---

Changes to `.replit` must be submitted as a complete temporary TOML file through the environment's schema-validation replacement flow; direct edits are rejected.

**Why:** The workspace protects `.replit` from direct file edits and requires validation before replacement.

**How to apply:** Preserve the existing configuration in a temporary candidate, make the intended change there, validate and replace it, then confirm the resulting file and remove any leftover temporary file.
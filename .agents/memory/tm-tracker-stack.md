---
name: Superseded legacy stack note
description: Historical note retained to prevent reuse of obsolete architecture guidance
---

# Superseded — Do Not Use as Current Project Instructions

This memory previously described an Express/Drizzle/Replit stack, pnpm workspace, OpenAPI code generation, and a legacy secret list. Those details conflict with the current repository layout and must not be used to guide implementation.

For current repository facts, use:
- Root `AGENTS.md` for mandatory contributor rules.
- `docs/DOCUMENTATION_AUTHORITY.md` for the correct reference for each task.
- Root `package.json`, `package-lock.json`, and `vercel.json` for current commands and build configuration.
- `README.md` and current source for the active React/Vite/Supabase application.
- `docs/LEDGER_REQUIREMENTS.md` for owner-confirmed financial requirements.

Do not infer that any legacy environment variable or secret is needed. Never request, print, or commit secret values. This file is retained only to explain why old memory content must not be trusted.

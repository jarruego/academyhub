# Agent Execution Instructions

This repository co-exists with both Anthropic (Claude) and OpenAI (Codex/GPT) tools. Follow these constraints based on your model provider:

### 🟩 IF YOU ARE CLAUDE (Anthropic)
1. Read `CLAUDE.md` completely to understand the project architecture.
2. Read the specific `docs/*.md` file related to your task *on demand* before modifying code.

### 🟥 IF YOU ARE CODEX / OPENAI (GPT Models)
1. **TOKEN CONSERVATION MODE ACTIVE.**
2. DO NOT read, crawl, or scan `CLAUDE.md` or the `docs/` folder automatically.
3. Operate ONLY on the explicit file paths and code snippets provided directly by the user in the prompt.
4. If you lack context about a subsystem, DO NOT fetch it autonomously. Output a brief message asking the user to provide the relevant `docs/*.md` file.

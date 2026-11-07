# Savage.Code

A desktop app for your coding agents, with a mission board on top. Add a task, give it to a thread, and the card
moves on its own: **To do → In progress → Needs you → Done**. It runs on your own computer with your own Claude Code,
Codex, Cursor, Grok, OpenCode or Antigravity subscription.

Built on [T3 Code](https://github.com/pingdotgg/t3code) (MIT license, see `LICENSE`).

## What you need

- A Mac (Apple silicon or Intel)
- At least one coding agent installed and signed in:
  - Claude Code: install [Claude Code](https://claude.com/product/claude-code), then run `claude auth login`
  - Codex: install the [Codex CLI](https://developers.openai.com/codex/cli), then run `codex login`
  - Cursor: install the [Cursor CLI](https://cursor.com/cli), then run `agent login`
  - OpenCode: install [OpenCode](https://opencode.ai), then run `opencode auth login`
- Vite+ (`vp`). Open Terminal and run:

  ```bash
  curl -fsSL https://vite.plus | bash
  ```

  It brings the right Node version with it, so you don't need to install Node yourself.

## Build the app

Open a new Terminal window in this folder and run:

```bash
vp i
vp run dist:desktop:dmg:arm64
```

On an Intel Mac, run `vp run dist:desktop:dmg:x64` instead of the second line.

When it finishes, open the `.dmg` in the `release/` folder and drag **Savage Code** into Applications.

## Use it

1. Open Savage Code and add a project (any folder with code in it).
2. The **Board** is the home page and the top button in the sidebar.
3. Type a task, pick its project, and press **Add**.
4. On the task card, press **Assign**, then **New thread**, or give it to a thread that's already running.
5. Cards move by themselves. A card shows **In progress** while the agent works and **Needs you** when the agent asks
   something or finishes. Drag it to **Done** (or press **Mark done**) when you're happy with it.
6. Want your own background? Go to **Settings → Appearance → Background** and choose a photo. Two sliders control how
   much of the photo shows through and how dark the tint over it is.

## Good to know

- Everything stays on your computer. Savage Code keeps its data in `~/.savage-code` and doesn't send usage data
  anywhere.
- Want to change something? Open this folder in Claude Code or Codex and ask. `AGENTS.md` explains the codebase to
  the agent.

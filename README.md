# revive

A Claude Code mod (function-hooks plugin) that stops you from paying for a cold prompt cache, and lets you continue in a fresh conversation without losing your place.

## What it does

**Cold-cache guard.** Claude Code re-sends the whole conversation every turn. While the prompt cache is warm that is cheap (cache reads cost 0.1x input). Once the cache has expired (5 minutes or 1 hour), the next message re-writes the whole context at 1.25x or 2x. When you send a prompt into a conversation over 100k tokens whose cache is cold, revive holds it back and tells you roughly what it would cost:

> Prompt held back: the prompt cache is cold. This conversation has been idle 2h 00m and its cache lasts 1h 00m.
> Sending now re-writes ~150k tokens of context to the cache, billed like ~300k input tokens, instead of reading it for ~15k: about 20x a warm turn.

Send the same message again within 2 minutes to pay for it anyway.

**`/revive`.** Runs in the engine, never as a model turn of the current conversation:

1. Reads the transcript as data, condenses it, and has Haiku write a handoff (goal, decisions, state, files, what is left, next step) to `<project>/.claude/revive/<timestamp>.md` (git-ignored).
2. Runs `/clear` by itself.
3. Gives the fresh conversation the handoff, and sends the prompt the guard held back, so work continues immediately.
4. Shows "Revived from handoff: <one sentence>" and a desktop notification.

The handoff is tied to the session row it was written in: parallel sessions in the same project never pick up each other's handoffs.

Other forms: `/revive status` shows what the guard sees; `/revive simulate-cold` makes the current conversation count as cold, for testing.

## Install

At the prompt of a terminal session:

```
/plugin install revive --marketplace chillpert/claude-revive
```

From a shell:

```
claude plugin install revive --marketplace chillpert/claude-revive
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `chillpert/claude-revive`, then Add plugin.

This repository is private: installing needs a git credential for github.com on that machine (`gh auth login`, then `gh auth setup-git`).

## Settings

Optional environment variables (for example under `env` in `~/.claude/settings.json`):

| Variable | Default | Effect |
| --- | --- | --- |
| `REVIVE_MIN_TOKENS` | `100000` | Smallest context the guard warns about. |
| `REVIVE_CACHE_TTL_SECONDS` | read from the transcript | Overrides the detected cache lifetime. |
| `REVIVE_GUARD_DISABLE` | off | `1` turns the guard off; `/revive` still works. |

## Notes

- The handoff call to Haiku sends a condensed transcript, not the session's cached context, so it costs cents even for very long sessions.
- Images attached to a held prompt cannot be carried over; you are told to add them again.
- Do not run it alongside another cold-cache guard plugin, or both will hold the same prompt.

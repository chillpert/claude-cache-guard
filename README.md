# cache-guard

A Claude Code mod (function-hooks plugin) that saves you from paying for a cold prompt cache: it holds back prompts that would be sent into a cold cache, keeps the cache warm while you step away, and lets you continue in a fresh conversation without losing your place.

Formerly `revive`.

## What it does

**Cold-cache guard.** Claude Code re-sends the whole conversation every turn. While the prompt cache is warm that is cheap (cache reads cost 0.1x input). Once the cache has expired (5 minutes or 1 hour), the next message re-writes the whole context at 1.25x or 2x. When you send a prompt into a conversation over 100k tokens whose cache is cold, cache-guard holds it back and tells you roughly what it would cost:

> Cache cold (idle 2h 00m, ~150k tokens): sending here costs ~20x a warm turn. /cache-guard handoff to continue fresh, or resend within 2m to send here anyway.

Send the same message again within 2 minutes to pay for it anyway.

**The bar.** One short line above the prompt, on by default: the minutes until the cache goes cold, a button that switches keep warm, and a Handoff button.

> Cache cold in 41m   [Keep warm: off]   [Handoff]

The countdown is green while more than half the cache's lifetime is left, yellow down to a fifth, and red below that and once cold. `/cache-guard bar off` hides the bar (remembered across sessions), `/cache-guard bar on` brings it back.

**How the cold timer works.** It follows Anthropic's documented cache rules, from what each request reports: a cache entry lives 5 minutes or 1 hour, every request that reads or writes it starts its lifetime again, and that lifetime runs from the *start* of the request (time spent generating counts against it). The lifetime is taken from the request's own `usage` (which lifetime its cache writes got); until a request has reported one, the bar says "Cache lifetime unknown" and keep warm sends no poke. Every request is then checked: if most of its context was read from the cache, the cache was warm. `/cache-guard status` shows how often the timer agreed with that. The timer cannot see a model switch (each model has its own cache) or anything that changes the cached prefix; the first request after one of those writes the cache anew.

**Keep warm.** Off by default; the bar's button or `/cache-guard warm on` turns it on. While it is on, a short prompt ("poke") goes out shortly before the cache would expire (48 minutes after the last request on a 1-hour cache), so you come back to a warm cache. A poke reads the cache at 0.1x instead of letting it lapse. It never pokes a cache that has already gone cold, and it turns itself off after 8 hours without a message from you. Each poke is a short turn in the conversation. Whether it is on is kept for the session row, so it stays on when the desktop app restarts the session's process (the bar disappears while the process is down, and no poke can go out until it is back).

**`/cache-guard handoff`.** Runs in the engine, never as a model turn of the current conversation:

1. Reads the transcript as data, condenses it, and has Haiku write a handoff (goal, decisions, state, files, what is left, next step) to `<project>/.claude/handoffs/<timestamp>.md` (git-ignored).
2. Runs `/clear` by itself, 5 seconds later. Until then the bar's **Cancel handoff** button, or `/cache-guard cancel`, stops it: while the summary is being written, or during those 5 seconds. Nothing is cleared and a held prompt stays held.
3. Gives the fresh conversation the handoff, and sends the prompt the guard held back, so work continues immediately.
4. Shows "↻ Continued: <one sentence>" and a desktop notification.

The handoff is tied to the session row it was written in: parallel sessions in the same project never pick up each other's handoffs.

**`/cache-guard`** alone, or `/cache-guard status`, shows what the guard sees; `simulate-cold` makes the current conversation count as cold, for testing.

## Install

At the prompt of a terminal session:

```
/plugin install cache-guard --marketplace chillpert/claude-cache-guard
```

From a shell:

```
claude plugin install cache-guard --marketplace chillpert/claude-cache-guard
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `chillpert/claude-cache-guard`, then Add plugin.

Coming from `revive`: uninstall it first (`claude plugin uninstall revive`), or both will hold the same prompt.

## Requirements

A Claude Code version with function-hooks plugins (mods): the plugin is a `hooks/register.tsx` module run by the engine, not a set of shell hooks. This is an unofficial community plugin, not affiliated with Anthropic.

## Settings

Optional environment variables (for example under `env` in `~/.claude/settings.json`):

| Variable | Default | Effect |
| --- | --- | --- |
| `CACHE_GUARD_MIN_TOKENS` | `100000` | Smallest context the guard warns about. |
| `CACHE_GUARD_TTL_SECONDS` | read from the transcript | Overrides the detected cache lifetime. |
| `CACHE_GUARD_DISABLE` | off | `1` turns the guard off; keep warm and `/cache-guard handoff` still work. |
| `CACHE_GUARD_WARM_IDLE_HOURS` | `8` | Keep warm turns itself off after this long without a message from you. |

The `REVIVE_*` variables of earlier versions are no longer read.

## Notes

- The handoff call to Haiku sends a condensed transcript, not the session's cached context, so it costs cents even for very long sessions.
- Handoffs are plain-text summaries of your conversation, so they can contain anything that was pasted into it. They stay in `<project>/.claude/handoffs/`, which gets its own `.gitignore`; delete them when you no longer need them.
- Images attached to a held prompt cannot be carried over; you are told to add them again.
- Do not run it alongside another cold-cache guard or cache-warming plugin (such as cache-caffeine), or both will hold the same prompt or poke the same cache.

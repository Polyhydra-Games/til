---
til_version: "0.1"
id: "2026-09-19-claude-in-chrome-cant-touch-github"
title: "The Claude-in-Chrome extension and Claude Code are not the same tool"
date: 2026-09-19
status: ready
visibility: public
audience:
  - general
tags:
  - agentic-development
  - harnesses
  - claude-code
  - tooling
summary: "A browser extension and a coding-agent harness can run the same underlying AI model, but the model's capabilities come entirely from the program wrapped around it — not from the model itself."
source_type: observation
confidence: high
ai:
  assisted: true
  disclosure: "AI assisted with research, organization, and editing."
origin:
  kind: conversation
  refs: []
canonical: null
publish:
  lancer1977: true
  devto: false
  hashnode: false
publish_meta: {}
created: "2026-09-19T09:00:00-04:00"
updated: "2026-09-19T09:00:00-04:00"
---

# The Claude-in-Chrome extension and Claude Code are not the same tool

## Lesson

"Claude" isn't one thing with one set of powers. What an AI assistant can actually *do* — click a button, read a file, run `git push` — comes entirely from the **harness**: the program wrapped around the model that decides which tools it's handed. The model can be identical in two places and still be capable of completely different things, because the harness is different.

## Why it matters

My son ran into this directly: he asked the Claude-in-Chrome browser extension to fix something and push it to GitHub, and it couldn't. Not because the model "didn't understand" or "refused" — because the extension's harness only gives it a browser tab. It can click, type, scroll, and read what's on the page, the same way a person moving a mouse could. It has no filesystem, no shell, no `git`, no stored credentials to authenticate a push. There is nothing in its toolbox that does that job.

Claude Code, running as a CLI harness on a real machine, is a different toolbox entirely: it can read and write files, run shell commands, call `git`, and open pull requests. Same underlying model, wildly different capability — because the harness, not the model, is what defines the ceiling.

## Example

| | Claude-in-Chrome (browser extension) | Claude Code (CLI harness) |
|---|---|---|
| Can click/type in a web page | Yes | No (unless it also has browser tools) |
| Can read/edit local files | No | Yes |
| Can run `git commit` / `git push` | No | Yes |
| Can call the GitHub API directly | No | Yes, via `gh` or REST |
| Could still edit a file *through* github.com's own web editor | Yes, clicking the same UI a human would | Yes, but would normally just use `git` instead |

The last row is the interesting nuance: GitHub's website itself lets you edit a file and open a PR with nothing but a browser. So a browser-only agent isn't *categorically* locked out of GitHub — it's locked out of the git/CLI path, but could, in principle, drive the web UI the same way a person clicking around would. It's just clumsier: no local diff, no running the test suite first, no staging multiple files at once.

## What changed my mind

I used to think of "Claude" as a single fixed thing with a fixed set of abilities, the same everywhere it showed up. Watching my son hit this wall made it obvious that's wrong: capability is a property of *what tools the harness hands the model*, not of the model itself. Ask a different question — "what can this harness do" instead of "what can Claude do" — and the confusing moment stops being confusing.

## Caveats

- This isn't specific to Claude — the same split applies to any AI assistant embedded in a browser extension versus one running as a CLI/agent with filesystem and shell access.
- A harness's toolset isn't fixed forever — a browser-extension harness *could* be given more tools (e.g. a way to call the GitHub API directly) without changing the underlying model at all.
- "Browser extension can't push to git" is a capability gap today, not a law of nature.

## Sources

- Conversation with my son about why Claude-in-Chrome couldn't push a fix to GitHub, 2026-09-19.
- Claude Code and Claude-in-Chrome product documentation (tool/permission model).

## Next experiments

- Have Claude-in-Chrome attempt a GitHub-web-UI-only edit + PR, and compare the workflow feel against doing the same fix with Claude Code.
- Write a follow-up TIL specifically on what a "harness" is, independent of this specific example, since it's a reusable concept worth its own note.

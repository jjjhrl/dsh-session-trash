## What changed

<!-- One or two sentences on the user-visible effect. -->

## Why

<!-- The problem this solves. Link the issue: Closes #123 -->

## How it was verified

- [ ] `npm run check` passes
- [ ] Tested in DSH **web** profile, version: ______
- [ ] Host half reloaded (plugin toggled in 插件) after Host-file changes
- [ ] Page reloaded after client-half changes

Describe the manual steps (which menu, which Session, expected and actual result):

## Checklist

- [ ] Deletes still only rename a session-owned directory; nothing rewrites stored logs
- [ ] New user-visible text exists in both `ZH` and `EN` dictionaries
- [ ] UI and the `session_trash` tool still share one Host implementation
- [ ] `CHANGELOG.md` updated under `## [Unreleased]`
- [ ] English and Chinese READMEs updated when behaviour, install, or limits changed
- [ ] No new runtime dependencies, no build step
- [ ] `docs/images/*` screenshots updated if the UI changed (each under 400 KB)

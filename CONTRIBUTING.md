# Contributing

Thanks for taking a look. This plugin is small on purpose: one Host file, one
browser file, a manifest, and a locale pair. Small, well-explained changes are
the easiest to review.

## Before you start

- Read [README.md](README.md) — especially *How it works*, *Safety and
  limitations*, and *Development*.
- For anything that changes behaviour, open an issue first. Describe the DSH
  version you run, the profile (web), and what you observed.
- Never include real Session logs, titles, or personal paths in an issue. The
  trash entries under `$DSH_HOME/session-trash` are user data.

## Development setup

The bundle has no dependencies and no build step.

```bash
git clone https://github.com/jjjhrl/dsh-session-trash.git
cd dsh-session-trash
npm run check
```

Install the cloned directory through **插件 → 添加插件** in DSH (absolute
path). After editing:

- **Host half** (`index.js`, `cordis.patch.yml`): toggle the plugin row off and
  on in **插件** to reload it. A full DSH restart also works.
- **Client half** (`client.js`): reload the page.
- **Manifest / locale**: reinstall the bundle or restart DSH so the plugin
  manager re-reads the metadata.

## What a change must keep true

1. **No byte-level rewriting of Session storage.** Deletes rename a directory;
   restore renames it back. If your change needs to touch file contents, explain
   why in the pull request.
2. **Refuse rather than guess.** Any unexpected storage layout, foreign file in a
   session directory, or Session loaded in the Host must stay untouched and
   produce a localized explanation.
3. **The trash stays outside the persistence root.** Anything inside it would be
   listed as Sessions again.
4. **UI text goes through the locale service.** Add keys to both `ZH` and `EN`
   in `client.js`; `npm run check` fails when the dictionaries diverge.
5. **The UI and the `session_trash` tool share one implementation.** Do not add
   a second code path for the same operation.
6. **No new runtime dependencies.** The bundle must stay plain ESM that DSH can
   load without a build step.

## Pull requests

- One topic per pull request, with a short description of the user-visible
  effect and how you verified it (which DSH version, which steps).
- Update `CHANGELOG.md` under `## [Unreleased]`.
- Update both READMEs when behaviour, installation, or limits change.
- Run `npm run check` — CI runs the same command and will block a red build.
- If a screenshot changes, keep it under `docs/images/` and below 400 KB.

## Reporting bugs

Use the bug report template. Useful facts:

- DSH version (`dsh --version`, or the version shown in **设置 › 通用设置**).
- OS and Node version.
- The exact action you took and the message you saw.
- Whether the Session was loaded in this Host process (see *Safety and
  limitations*).

## Security

Do not open a public issue for a vulnerability that could delete, move, or
expose user data. Follow [SECURITY.md](SECURITY.md).

## Code of Conduct

Participation is covered by the [Code of Conduct](CODE_OF_CONDUCT.md).

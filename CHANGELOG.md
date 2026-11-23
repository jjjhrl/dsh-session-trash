# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-11-23

### Added

- **Delete session…** action in the sidebar Session row menu: one confirmation moves the Session's stored log into a local trash directory and removes its row from every open client.
- **Settings › Session trash** (`会话回收站`): list trashed Sessions with title, deletion time, size, and original directory; restore one to its original location, delete one permanently, or empty the trash. Confirmations and results are inline on the page.
- **`session_trash` agent tool**: `list`, `delete`, `restore`, and `purge`, sharing the Host operations behind the UI.
- Trash entries store `meta.json` next to the moved `data/` directory, so a restore returns byte-identical history to its original path and keeps the previous archive/pin state.
- Safety refusals: a Session loaded in the running Host, a non-per-session storage layout, or a session directory holding foreign files is rejected with a localized explanation instead of being modified.
- English and Chinese UI, plugin display metadata in both languages, and an original plugin icon.

[Unreleased]: https://github.com/jjjhrl/dsh-session-trash/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/jjjhrl/dsh-session-trash/releases/tag/v1.0.0

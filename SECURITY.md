# Security policy

This plugin moves user data (Session logs) between directories and can delete it
permanently. Treat bugs that could move, delete, or expose a Session outside the
user's intent as security issues.

## Supported versions

| Version | Supported |
|---|---|
| `1.x` | ✅ |

## Reporting a vulnerability

**Do not open a public issue.** Use GitHub's private reporting:

<https://github.com/jjjhrl/dsh-session-trash/security/advisories/new>

Please include:

- DSH version, OS, Node version, and how the plugin was installed (GitHub, local
  directory, or agent).
- The exact steps, the affected paths under `$DSH_HOME/sessions` /
  `$DSH_HOME/session-trash`, and whether the Session was loaded in the Host.
- What you expected versus what happened, and whether any files moved or
  disappeared.

You can expect an acknowledgement within a few days, an assessment of severity,
and a fix or mitigation in a patch release where the report is valid. Please
allow time for a release before disclosing publicly; credit is given on request.

## Scope

In scope:

- Code in this repository (`index.js`, `client.js`, `cordis.patch.yml`,
  `scripts/`).
- Operations the plugin performs on Session storage and the trash directory.

Out of scope:

- Vulnerabilities in DeepSeek Harness itself — report those to the DSH
  maintainers.
- Data loss you can already cause by hand (`rm -rf $DSH_HOME/sessions`), or the
  irreversible **Delete permanently** / **Empty trash** actions when the UI warned
  you.
- The known limitation that a Session loaded in the running Host cannot be
  deleted; that refusal is intentional.

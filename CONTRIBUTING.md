# Contributing to MarkOut

Bug reports, ideas, and pull requests are welcome.

## Development

MarkOut requires Node.js 22.13 or newer for development.

```sh
npm install
npm run dev
```

Run the complete check before opening or updating a pull request:

```sh
npm run check
```

The check runs TypeScript validation, the automated tests, the production
build, and verification that the build contains exactly one self-contained
HTML file.

## Changelog workflow

Every pull request must make a changelog decision before it is merged.
User-visible additions, changes, fixes, removals, deprecations, and security
updates belong under `Unreleased` in [CHANGELOG.md](CHANGELOG.md). Refactoring,
tests, documentation, and maintenance that do not affect users normally do not
need an entry.

Write entries for someone using MarkOut rather than as commit summaries. Keep
each entry short and describe the difference the user will notice.

The pull request template records whether the changelog was updated or why an
entry is not needed. This keeps the decision in the pull request instead of
leaving it as a task after the merge.

## Release workflow

MarkOut uses Semantic Versioning:

- Patch releases fix behavior without adding a feature.
- Minor releases add backward-compatible functionality.
- Major releases contain breaking changes.

A release is prepared in a pull request that updates the version in
`package.json` and `package-lock.json`, moves the accumulated `Unreleased`
entries into a dated version section, and adds a new empty `Unreleased`
section.

After that pull request is merged, a matching tag such as `v1.1.0` is pushed.
The release workflow checks that the tag and package version agree, runs the
complete test and build process, creates a GitHub Release, and attaches
`markout.html` plus its SHA-256 checksum. The generated file remains ignored by
Git and is never committed to the repository.

GitHub's automatically generated release notes supplement the curated
changelog with links to the merged pull requests and contributors.

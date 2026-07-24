# MarkOut

MarkOut is for any poor suckers who are forced to use Outlook but are currently
participating in the age of AI. Generative AI artifacts are often created in
Markdown, but I couldn't find a good way to get that Markdown into Outlook
without spending more time reformatting everything by hand. MarkOut turns it
into conservative rich HTML that you can paste into an Outlook email draft.

It runs entirely in your browser and includes a live email preview, rich and
plain-text clipboard formats, file import, and an HTML download.

## Privacy model

The application runs entirely in the browser. It has no analytics, telemetry,
remote APIs, cloud storage, or automatic local storage. Markdown is held only
in the current page. Every runtime dependency is bundled into the finished
HTML file.

Remote images are disabled by default. If the user enables them, only
user-authored `https:` image URLs can load. Local paths and base64 images are
always replaced with a visible warning.

## Build

Node.js 22.13 or newer is required only for development.

```sh
npm install
npm run build
```

The build produces:

```text
dist/markout.html
```

Double-click that file to use the application. The finished file does not need
Node.js, npm, a server, an extension, an installation, or an internet
connection.

## Copy for Outlook

The primary action attempts to place one clipboard item containing:

- `text/html`, with the sanitized inline-styled email fragment
- `text/plain`, with a readable plain-text version

The app first uses `navigator.clipboard.write()` and `ClipboardItem`. If that is
blocked, it tries a `copy` event with `document.execCommand("copy")`. If both
methods fail, it selects the preview and accurately asks for Command+C or
Ctrl+C. It never reports success before a method succeeds.

The copied HTML contains only the email message fragment, not the surrounding
application.

## Contributing

MarkOut is open source under the [MIT License](LICENSE). Bug reports, ideas, and
pull requests are welcome:

- [File an issue](https://github.com/moottoast/markout/issues)
- [Submit a pull request](https://github.com/moottoast/markout/pulls)

## Development and tests

```sh
npm run dev
npm run typecheck
npm test
npm run build
```

Run every check with:

```sh
npm run check
```

Tests cover conversion, nested lists, tables, task lists, safe and unsafe
links, raw HTML, sanitization, inline styles, plain text, both clipboard
methods, file import, empty input, Unicode, long input, image policy, and email
fragment constraints.

## Known limitations

- Outlook can normalize fonts, line spacing, margins, and colors after paste.
- Clipboard API permissions differ by browser and may be stricter on `file:`
  pages. The app includes the fallback and manual-selection behavior described
  above.
- Externally hosted images may be blocked, proxied, or removed by Outlook or
  the recipient's mail client.
- Local filesystem and base64 images are not copied.
- The formatter does not add image attachments or Content-ID references.
- Rich paste requires the Outlook draft to be in HTML format.

## Verification completed here

- Automated tests pass in a browser-like DOM environment.
- The production build produces one self-contained HTML file.
- Live preview, keyboard controls, file import, and rich clipboard output were
  checked in a Chromium-based browser.
- The browser clipboard contained both `text/html` and `text/plain`.
- The download action ran without a console error and reported its result.
- Build verification confirms that the artifact has no external runtime assets.

The browser automation environment blocked navigation to `file:` URLs, so
double-click launch remains a short manual check. The single-file build and
relative-path-free artifact were verified statically. No Outlook client was
available during development, so final rendering in each Outlook edition also
remains a manual compatibility check.

## Manual Outlook QA checklist

Use a draft in HTML format and paste the sample content with Copy for Outlook.
For each client, confirm headings, paragraphs, nested lists, links, quotes,
tables, task markers, inline code, and code blocks remain readable.

- [ ] New Outlook for Windows
- [ ] Classic Outlook for Windows
- [ ] Outlook on the web
- [ ] Outlook for Mac

Also confirm that plain-text paste works, remote image placeholders are
visible, and downloaded HTML matches the in-app preview.

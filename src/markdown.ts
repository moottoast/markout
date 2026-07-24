import DOMPurify from "dompurify";
import { marked, Renderer, type Tokens } from "marked";

const EMAIL_FONT = "Aptos, Calibri, Arial, sans-serif";
const CODE_FONT = "Consolas, 'Courier New', monospace";
const BASE_BODY_SIZE_PX = 15;

export const DEFAULT_FONT_SIZE_PT = 12;

const ALLOWED_TAGS = [
  "a",
  "blockquote",
  "br",
  "code",
  "del",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "span",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
];

const ALLOWED_ATTRIBUTES = [
  "alt",
  "checked",
  "disabled",
  "href",
  "rel",
  "src",
  "start",
  "style",
  "target",
  "title",
  "type",
];

export interface ConversionOptions {
  allowRemoteImages?: boolean;
  defaultFontSizePt?: number;
}

export interface ConversionResult {
  html: string;
  plainText: string;
  imageWarnings: number;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function isSafeLink(value: string): boolean {
  const href = value.trim();
  if (/[\u0000-\u001f\u007f]/u.test(href)) {
    return false;
  }

  try {
    const url = new URL(href);
    return ["https:", "http:", "mailto:", "tel:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function isSafeRemoteImage(value: string): boolean {
  try {
    return new URL(value.trim()).protocol === "https:";
  } catch {
    return false;
  }
}

const rendererState = new WeakMap<
  OutlookRenderer,
  {
    allowRemoteImages: boolean;
    defaultFontSizePt: number;
    imageWarnings: number;
  }
>();

class OutlookRenderer extends Renderer {
  constructor(allowRemoteImages: boolean, defaultFontSizePt: number) {
    super();
    rendererState.set(this, {
      allowRemoteImages,
      defaultFontSizePt,
      imageWarnings: 0,
    });
  }

  get imageWarnings(): number {
    return rendererState.get(this)?.imageWarnings ?? 0;
  }

  private fontSize(originalSizePx: number): string {
    const defaultFontSizePt =
      rendererState.get(this)?.defaultFontSizePt ?? DEFAULT_FONT_SIZE_PT;
    const scaledSize =
      Math.round(
        ((defaultFontSizePt * originalSizePx) / BASE_BODY_SIZE_PX) * 100,
      ) / 100;
    return `${scaledSize}pt`;
  }

  override code({ text }: Tokens.Code): string {
    return `<pre style="margin: 0 0 16px 0; padding: 12px 14px; border: 1px solid #d6dbe1; background-color: #f5f6f8; color: #202124; font-family: ${CODE_FONT}; font-size: ${this.fontSize(13)}; line-height: 1.5; white-space: pre-wrap; word-wrap: break-word;"><code style="font-family: ${CODE_FONT};">${escapeHtml(text)}</code></pre>`;
  }

  override blockquote({ tokens }: Tokens.Blockquote): string {
    return `<blockquote style="margin: 0 0 16px 0; padding: 2px 0 2px 14px; border-left: 4px solid #9aa4b2; color: #4b5563;">${this.parser.parse(tokens)}</blockquote>`;
  }

  override html({ text }: Tokens.HTML | Tokens.Tag): string {
    return `<span style="color: #7a2e2e; font-family: ${EMAIL_FONT}; font-size: ${this.fontSize(13)};">[Raw HTML removed: <code style="font-family: ${CODE_FONT};">${escapeHtml(text)}</code>]</span>`;
  }

  override heading({ tokens, depth }: Tokens.Heading): string {
    const sizes: Record<number, number> = {
      1: 26,
      2: 22,
      3: 19,
      4: 17,
      5: 15,
      6: 14,
    };
    const marginTop = depth === 1 ? "0" : "22px";
    return `<h${depth} style="margin: ${marginTop} 0 10px 0; color: #172033; font-family: ${EMAIL_FONT}; font-size: ${this.fontSize(sizes[depth])}; font-weight: 700; line-height: 1.25;">${this.parser.parseInline(tokens)}</h${depth}>`;
  }

  override hr(): string {
    return '<hr style="margin: 22px 0; border: 0; border-top: 1px solid #cbd1d8;">';
  }

  override list(token: Tokens.List): string {
    const tag = token.ordered ? "ol" : "ul";
    const start =
      token.ordered && token.start !== "" && token.start !== 1
        ? ` start="${token.start}"`
        : "";
    const items = token.items.map((item) => this.listitem(item)).join("");
    return `<${tag}${start} style="margin: 0 0 16px 0; padding-left: 28px; font-family: ${EMAIL_FONT};">${items}</${tag}>`;
  }

  override listitem(item: Tokens.ListItem): string {
    const checkbox = item.task
      ? `<span style="display: inline-block; margin-right: 7px; color: #374151; font-family: ${EMAIL_FONT};">${item.checked ? "☑" : "☐"}</span>`
      : "";
    return `<li style="margin: 0 0 6px 0; padding-left: 2px; color: #202124; font-family: ${EMAIL_FONT}; font-size: ${this.fontSize(15)}; line-height: 1.55;">${checkbox}${this.parser.parse(item.tokens)}</li>`;
  }

  override checkbox({ checked }: Tokens.Checkbox): string {
    return `<span style="display: inline-block; margin-right: 7px; color: #374151; font-family: ${EMAIL_FONT};">${checked ? "☑" : "☐"}</span>`;
  }

  override paragraph({ tokens }: Tokens.Paragraph): string {
    return `<p style="margin: 0 0 16px 0; color: #202124; font-family: ${EMAIL_FONT}; font-size: ${this.fontSize(15)}; line-height: 1.55;">${this.parser.parseInline(tokens)}</p>`;
  }

  override table(token: Tokens.Table): string {
    const header = token.header
      .map((cell) => this.tablecell({ ...cell, header: true }))
      .join("");
    const rows = token.rows
      .map(
        (row) =>
          `<tr>${row.map((cell) => this.tablecell({ ...cell, header: false })).join("")}</tr>`,
      )
      .join("");
    return `<table style="width: 100%; margin: 0 0 18px 0; border-collapse: collapse; border: 1px solid #c7cdd4; font-family: ${EMAIL_FONT}; font-size: ${this.fontSize(14)}; line-height: 1.45;"><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table>`;
  }

  override tablecell(token: Tokens.TableCell): string {
    const tag = token.header ? "th" : "td";
    const background = token.header ? " background-color: #eef1f4;" : "";
    const weight = token.header ? " font-weight: 700;" : "";
    const alignment = token.align ?? "left";
    return `<${tag} style="padding: 8px 10px; border: 1px solid #c7cdd4;${background}${weight} color: #202124; text-align: ${alignment}; vertical-align: top;">${this.parser.parseInline(token.tokens)}</${tag}>`;
  }

  override strong({ tokens }: Tokens.Strong): string {
    return `<strong style="font-weight: 700;">${this.parser.parseInline(tokens)}</strong>`;
  }

  override em({ tokens }: Tokens.Em): string {
    return `<em style="font-style: italic;">${this.parser.parseInline(tokens)}</em>`;
  }

  override codespan({ text }: Tokens.Codespan): string {
    return `<code style="padding: 1px 4px; border: 1px solid #d8dce1; background-color: #f3f4f6; color: #7a2430; font-family: ${CODE_FONT}; font-size: ${this.fontSize(13)};">${escapeHtml(text)}</code>`;
  }

  override br(): string {
    return "<br>";
  }

  override del({ tokens }: Tokens.Del): string {
    return `<del style="text-decoration: line-through;">${this.parser.parseInline(tokens)}</del>`;
  }

  override link({ href, title, tokens }: Tokens.Link): string {
    const text = this.parser.parseInline(tokens);
    if (!isSafeLink(href)) {
      return `<span style="color: #7a2e2e; text-decoration: underline;">${text} [unsafe link removed]</span>`;
    }
    const titleAttribute = title ? ` title="${escapeHtml(title)}"` : "";
    return `<a href="${escapeHtml(href.trim())}"${titleAttribute} target="_blank" rel="noopener noreferrer" style="color: #145ea8; text-decoration: underline;">${text}</a>`;
  }

  override image({ href, title, text }: Tokens.Image): string {
    const alt = text.trim() || "Image";
    const state = rendererState.get(this);
    if (state?.allowRemoteImages && isSafeRemoteImage(href)) {
      const titleAttribute = title ? ` title="${escapeHtml(title)}"` : "";
      return `<img src="${escapeHtml(href.trim())}" alt="${escapeHtml(alt)}"${titleAttribute} style="display: block; max-width: 100%; height: auto; margin: 8px 0 16px 0; border: 0;">`;
    }

    if (state) {
      state.imageWarnings += 1;
    }
    const reason = isSafeRemoteImage(href)
      ? "Remote image disabled"
      : "Image cannot be copied reliably";
    return `<span style="display: inline-block; margin: 4px 0 12px 0; padding: 8px 10px; border: 1px solid #d1a24c; background-color: #fff8e6; color: #6b4d13; font-family: ${EMAIL_FONT}; font-size: ${this.fontSize(13)}; line-height: 1.4;">[${reason}: ${escapeHtml(alt)}]</span>`;
  }

  override text(token: Tokens.Text | Tokens.Escape): string {
    if ("tokens" in token && token.tokens) {
      return this.parser.parseInline(token.tokens);
    }
    return escapeHtml(token.text);
  }
}

export function sanitizeEmailHtml(html: string): string {
  return String(
    DOMPurify.sanitize(html, {
      ALLOWED_TAGS,
      ALLOWED_ATTR: ALLOWED_ATTRIBUTES,
      ALLOW_DATA_ATTR: false,
      ALLOW_ARIA_ATTR: false,
      ALLOW_UNKNOWN_PROTOCOLS: false,
      FORBID_TAGS: [
        "script",
        "style",
        "iframe",
        "form",
        "input",
        "button",
        "object",
        "embed",
        "svg",
        "video",
        "audio",
      ],
      FORBID_ATTR: ["id", "class"],
    }),
  );
}

function appendTextWithBreaks(root: HTMLElement): string {
  const blockTags = new Set([
    "BLOCKQUOTE",
    "DIV",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "P",
    "PRE",
    "TR",
  ]);

  function visit(node: Node, listDepth = 0): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent ?? "";
    }
    if (!(node instanceof HTMLElement)) {
      return "";
    }
    if (node.tagName === "BR") {
      return "\n";
    }
    if (node.tagName === "HR") {
      return "\n---\n";
    }
    if (node.tagName === "IMG") {
      return `[Image: ${node.getAttribute("alt") || "Image"}]`;
    }
    if (node.tagName === "UL" || node.tagName === "OL") {
      const ordered = node.tagName === "OL";
      const start = Number(node.getAttribute("start") || "1");
      return Array.from(node.children)
        .filter((child) => child.tagName === "LI")
        .map((child, index) => {
          const prefix = ordered ? `${start + index}. ` : "- ";
          const content = Array.from(child.childNodes)
            .map((part) => visit(part, listDepth + 1))
            .join("")
            .trim();
          return `${"  ".repeat(listDepth)}${prefix}${content}`;
        })
        .join("\n")
        .concat("\n");
    }
    if (node.tagName === "LI") {
      return Array.from(node.childNodes)
        .map((child) => visit(child, listDepth))
        .join("");
    }
    if (node.tagName === "TABLE") {
      return Array.from(node.querySelectorAll("tr"))
        .map((row) =>
          Array.from(row.querySelectorAll(":scope > th, :scope > td"))
            .map((cell) => cell.textContent?.trim() ?? "")
            .join("\t"),
        )
        .join("\n")
        .concat("\n");
    }

    let text = Array.from(node.childNodes)
      .map((child) => visit(child, listDepth))
      .join("");
    if (node.tagName === "BLOCKQUOTE") {
      text = text
        .trim()
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
    }
    if (blockTags.has(node.tagName)) {
      text += "\n\n";
    }
    return text;
  }

  return visit(root)
    .replace(/[ \t]+\n/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

export function emailHtmlToPlainText(html: string): string {
  const container = document.createElement("div");
  container.innerHTML = sanitizeEmailHtml(html);
  return appendTextWithBreaks(container);
}

export function convertMarkdown(
  markdown: string,
  options: ConversionOptions = {},
): ConversionResult {
  if (!markdown.trim()) {
    return { html: "", plainText: "", imageWarnings: 0 };
  }

  const requestedFontSize = options.defaultFontSizePt;
  const defaultFontSizePt =
    typeof requestedFontSize === "number" &&
    Number.isFinite(requestedFontSize) &&
    requestedFontSize >= 8 &&
    requestedFontSize <= 72
      ? requestedFontSize
      : DEFAULT_FONT_SIZE_PT;
  const renderer = new OutlookRenderer(
    Boolean(options.allowRemoteImages),
    defaultFontSizePt,
  );
  const rendered = marked.parse(markdown, {
    async: false,
    breaks: true,
    gfm: true,
    renderer,
  }) as string;
  const wrapped = `<div style="color: #202124; font-family: ${EMAIL_FONT}; font-size: ${defaultFontSizePt}pt; line-height: 1.55;">${rendered}</div>`;
  const html = sanitizeEmailHtml(wrapped);

  return {
    html,
    plainText: emailHtmlToPlainText(html),
    imageWarnings: renderer.imageWarnings,
  };
}

export function createDownloadDocument(fragment: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Outlook email preview</title>
</head>
<body style="margin: 24px; background-color: #ffffff;">
${sanitizeEmailHtml(fragment)}
</body>
</html>`;
}

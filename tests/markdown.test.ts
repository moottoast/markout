import { describe, expect, it } from "vitest";
import {
  convertMarkdown,
  createDownloadDocument,
  emailHtmlToPlainText,
  isSafeLink,
  sanitizeEmailHtml,
} from "../src/markdown";

describe("Markdown conversion", () => {
  it("converts basic Markdown with Outlook-safe inline styles", () => {
    const result = convertMarkdown(
      "# Hello\n\nA **bold** and *thoughtful* note with `code`.\n\n---\n\nDone.",
    );

    expect(result.html).toContain("<h1");
    expect(result.html).toContain("<strong");
    expect(result.html).toContain("<em");
    expect(result.html).toContain("<code");
    expect(result.html).toContain("<hr");
    expect(result.html).toContain('style="');
    expect(result.html).not.toContain("class=");
    expect(result.html).not.toContain("<style");
  });

  it("renders nested lists", () => {
    const result = convertMarkdown(
      "- Parent\n  - Child\n    1. First\n    2. Second\n- Sibling",
    );
    const container = document.createElement("div");
    container.innerHTML = result.html;

    expect(container.querySelectorAll("ul").length).toBeGreaterThanOrEqual(2);
    expect(container.querySelectorAll("ol")).toHaveLength(1);
    expect(container.querySelectorAll("li")).toHaveLength(5);
  });

  it("renders GFM tables with explicit cell and table styles", () => {
    const result = convertMarkdown(
      "| Name | State |\n| :--- | ---: |\n| Rowan | Ready |",
    );

    expect(result.html).toContain("<table");
    expect(result.html).toContain("border-collapse: collapse");
    expect(result.html).toContain("<th");
    expect(result.html).toContain("text-align: left");
    expect(result.html).toContain("text-align: right");
    expect(result.html).toContain("<td");
  });

  it("renders task lists as readable checked and unchecked markers", () => {
    const result = convertMarkdown("- [x] Finished\n- [ ] Waiting");

    expect(result.html).toContain("☑");
    expect(result.html).toContain("☐");
    expect(result.plainText).toContain("Finished");
    expect(result.plainText).toContain("Waiting");
  });

  it("allows only explicitly safe link schemes", () => {
    expect(isSafeLink("https://example.com")).toBe(true);
    expect(isSafeLink("http://example.com")).toBe(true);
    expect(isSafeLink("mailto:person@example.com")).toBe(true);
    expect(isSafeLink("tel:+15551234567")).toBe(true);
    expect(isSafeLink("javascript:alert(1)")).toBe(false);
    expect(isSafeLink("data:text/html,bad")).toBe(false);
    expect(isSafeLink("/relative")).toBe(false);

    const result = convertMarkdown(
      "[Safe](https://example.com) [Bad](javascript:alert(1))",
    );
    expect(result.html).toContain('href="https://example.com"');
    expect(result.html).toContain('rel="noopener noreferrer"');
    expect(result.html).toContain("unsafe link removed");
    expect(result.html).not.toContain('href="javascript:');
  });

  it("escapes raw HTML and removes scriptable content", () => {
    const result = convertMarkdown(
      '<script>alert("x")</script>\n\n<img src="x" onerror="alert(1)">\n\n<div onclick="bad()">Text</div>',
    );
    const container = document.createElement("div");
    container.innerHTML = result.html;

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("[onerror]")).toBeNull();
    expect(container.querySelector("[onclick]")).toBeNull();
    expect(container.textContent).toContain("Raw HTML removed");
  });

  it("sanitizes direct hostile fragments", () => {
    const cleaned = sanitizeEmailHtml(
      '<p style="color:red" onclick="bad()">Safe</p><script>bad()</script><a href="javascript:bad()">Bad</a>',
    );
    const container = document.createElement("div");
    container.innerHTML = cleaned;

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("[onclick]")).toBeNull();
    expect(container.querySelector("a")?.hasAttribute("href")).toBe(false);
    expect(container.querySelector("p")?.getAttribute("style")).toBe("color:red");
  });

  it("produces clean plain text", () => {
    const result = convertMarkdown(
      "# Heading\n\nA **bold** [link](https://example.com).\n\n- One\n- Two\n\n| A | B |\n| - | - |\n| C | D |",
    );

    expect(result.plainText).toContain("Heading");
    expect(result.plainText).toContain("A bold link.");
    expect(result.plainText).toContain("- One");
    expect(result.plainText).toContain("- Two");
    expect(result.plainText).toContain("A\tB");
    expect(result.plainText).not.toContain("<");
  });

  it("handles empty, Unicode, and very long input", () => {
    expect(convertMarkdown("  \n").html).toBe("");
    expect(convertMarkdown("  \n").plainText).toBe("");

    const unicode = convertMarkdown("# こんにちは 👋\n\nCafé résumé");
    expect(unicode.html).toContain("こんにちは 👋");
    expect(unicode.plainText).toContain("Café résumé");

    const longSource = `${"Long paragraph with Unicode café. ".repeat(10_000)}\n`;
    const longResult = convertMarkdown(longSource);
    expect(longResult.html.length).toBeGreaterThan(100_000);
    expect(longResult.plainText).toContain("café");
  });

  it("blocks images by default and permits only opted-in HTTPS images", () => {
    const markdown =
      "![Hosted](https://example.com/image.png)\n\n![Local](file:///tmp/image.png)\n\n![Data](data:image/png;base64,AAAA)";
    const blocked = convertMarkdown(markdown);
    expect(blocked.imageWarnings).toBe(3);
    expect(blocked.html).not.toContain("<img");
    expect(blocked.html).toContain("Remote image disabled");
    expect(blocked.html).toContain("cannot be copied reliably");

    const allowed = convertMarkdown(markdown, { allowRemoteImages: true });
    expect(allowed.html).toContain(
      '<img src="https://example.com/image.png"',
    );
    expect(allowed.html).not.toContain('src="file:');
    expect(allowed.html).not.toContain('src="data:');
    expect(allowed.imageWarnings).toBe(2);
  });

  it("creates a standalone download document from sanitized content", () => {
    const documentHtml = createDownloadDocument(
      '<p style="margin:0">Hello</p><script>bad()</script>',
    );
    expect(documentHtml).toContain("<!doctype html>");
    expect(documentHtml).toContain('<meta charset="utf-8">');
    expect(documentHtml).not.toContain("<script");
    expect(emailHtmlToPlainText(documentHtml)).toContain("Hello");
  });

  it("keeps the final fragment within conservative email constraints", () => {
    const { html } = convertMarkdown(
      "# Status\n\n- Good\n- Better\n\n| Item | State |\n| --- | --- |\n| Test | Done |",
    );

    expect(html).not.toMatch(/<script|<svg|<link|<style/iu);
    expect(html).not.toMatch(/\bdisplay\s*:\s*(flex|grid)/iu);
    expect(html).not.toMatch(/--[\w-]+\s*:/u);
    expect(html).not.toMatch(/\b(position|animation|transform)\s*:/iu);
    expect(html).not.toContain("class=");
  });
});

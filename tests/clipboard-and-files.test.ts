import { describe, expect, it } from "vitest";
import { copyForOutlook } from "../src/clipboard";
import {
  isSupportedMarkdownFile,
  readMarkdownFile,
} from "../src/file-import";

describe("clipboard behavior", () => {
  it("writes HTML and plain text in one ClipboardItem", async () => {
    let itemPayload: Record<string, Blob> | undefined;
    let writtenItems: unknown[] = [];

    class FakeClipboardItem {
      readonly types: string[];

      constructor(payload: Record<string, Blob>) {
        itemPayload = payload;
        this.types = Object.keys(payload);
      }
    }

    const result = await copyForOutlook("<p>Hello</p>", "Hello", {
      ClipboardItemCtor: FakeClipboardItem,
      clipboard: {
        write: async (items) => {
          writtenItems = items;
        },
      },
    });

    expect(result).toEqual({ method: "clipboard-api", success: true });
    expect(writtenItems).toHaveLength(1);
    expect(Object.keys(itemPayload ?? {}).sort()).toEqual([
      "text/html",
      "text/plain",
    ]);
    expect(itemPayload?.["text/html"].type).toBe("text/html");
    expect(itemPayload?.["text/plain"].type).toBe("text/plain");
  });

  it("uses the copy-event fallback with both MIME types", async () => {
    const supplied = new Map<string, string>();
    const testDocument = document;
    const originalExecCommand = testDocument.execCommand;

    testDocument.execCommand = () => {
      const event = new Event("copy", { cancelable: true });
      Object.defineProperty(event, "clipboardData", {
        value: {
          setData(type: string, value: string) {
            supplied.set(type, value);
          },
        },
      });
      testDocument.dispatchEvent(event);
      return true;
    };

    try {
      const result = await copyForOutlook("<p>Rich</p>", "Rich", {
        clipboard: {
          write: async () => {
            throw new DOMException("Blocked", "NotAllowedError");
          },
        },
        ClipboardItemCtor: class {
          constructor(_: Record<string, Blob>) {}
        },
        documentRef: testDocument,
      });

      expect(result).toMatchObject({ method: "copy-event", success: true });
      expect(supplied.get("text/html")).toBe("<p>Rich</p>");
      expect(supplied.get("text/plain")).toBe("Rich");
    } finally {
      testDocument.execCommand = originalExecCommand;
    }
  });

  it("reports manual copy when both automatic methods fail", async () => {
    const testDocument = document;
    const originalExecCommand = testDocument.execCommand;
    testDocument.execCommand = () => false;

    try {
      const result = await copyForOutlook("<p>Rich</p>", "Rich", {
        clipboard: {
          write: async () => {
            throw new DOMException("Blocked", "NotAllowedError");
          },
        },
        ClipboardItemCtor: class {
          constructor(_: Record<string, Blob>) {}
        },
        documentRef: testDocument,
      });

      expect(result.method).toBe("manual");
      expect(result.success).toBe(false);
    } finally {
      testDocument.execCommand = originalExecCommand;
    }
  });
});

describe("file import", () => {
  it("accepts Markdown and text file extensions case-insensitively", () => {
    expect(isSupportedMarkdownFile({ name: "note.md" })).toBe(true);
    expect(isSupportedMarkdownFile({ name: "NOTE.MARKDOWN" })).toBe(true);
    expect(isSupportedMarkdownFile({ name: "message.txt" })).toBe(true);
    expect(isSupportedMarkdownFile({ name: "message.html" })).toBe(false);
  });

  it("reads a supported file", async () => {
    const file = {
      name: "note.md",
      text: async () => "# Imported",
    } as File;
    await expect(readMarkdownFile(file)).resolves.toBe("# Imported");
  });

  it("rejects unsupported file types", async () => {
    const file = {
      name: "note.html",
      text: async () => "<p>Not Markdown</p>",
    } as File;
    await expect(readMarkdownFile(file)).rejects.toThrow(
      "Choose a .md, .markdown, or .txt file.",
    );
  });
});

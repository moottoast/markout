export type CopyMethod = "clipboard-api" | "copy-event" | "manual";

export interface CopyResult {
  method: CopyMethod;
  success: boolean;
  error?: unknown;
}

interface ClipboardItemLike {
  readonly types?: readonly string[];
}

interface ClipboardItemConstructor {
  new (items: Record<string, Blob>): ClipboardItemLike;
}

export interface ClipboardEnvironment {
  clipboard?: Pick<Clipboard, "write">;
  ClipboardItemCtor?: ClipboardItemConstructor;
  BlobCtor?: typeof Blob;
  documentRef?: Document;
}

export async function copyForOutlook(
  html: string,
  plainText: string,
  environment: ClipboardEnvironment = {},
): Promise<CopyResult> {
  const clipboard = environment.clipboard ?? navigator.clipboard;
  const ClipboardItemCtor =
    environment.ClipboardItemCtor ??
    (globalThis.ClipboardItem as unknown as ClipboardItemConstructor | undefined);
  const BlobCtor = environment.BlobCtor ?? Blob;
  let preferredError: unknown;

  if (clipboard?.write && ClipboardItemCtor) {
    try {
      const item = new ClipboardItemCtor({
        "text/html": new BlobCtor([html], { type: "text/html" }),
        "text/plain": new BlobCtor([plainText], { type: "text/plain" }),
      });
      await clipboard.write([item as ClipboardItem]);
      return { method: "clipboard-api", success: true };
    } catch (error) {
      preferredError = error;
    }
  }

  const documentRef = environment.documentRef ?? document;
  const selection = documentRef.getSelection();
  const staging = documentRef.createElement("div");
  staging.setAttribute("contenteditable", "true");
  staging.setAttribute("aria-hidden", "true");
  staging.style.position = "fixed";
  staging.style.left = "-9999px";
  staging.innerHTML = html || " ";
  documentRef.body.append(staging);

  const range = documentRef.createRange();
  range.selectNodeContents(staging);
  selection?.removeAllRanges();
  selection?.addRange(range);

  let suppliedBothTypes = false;
  const handleCopy = (event: Event) => {
    const clipboardEvent = event as ClipboardEvent;
    if (!clipboardEvent.clipboardData) {
      return;
    }
    event.preventDefault();
    clipboardEvent.clipboardData.setData("text/html", html);
    clipboardEvent.clipboardData.setData("text/plain", plainText);
    suppliedBothTypes = true;
  };

  documentRef.addEventListener("copy", handleCopy, { once: true });
  try {
    const copied =
      typeof documentRef.execCommand === "function" &&
      documentRef.execCommand("copy");
    if (copied && suppliedBothTypes) {
      staging.remove();
      selection?.removeAllRanges();
      return { method: "copy-event", success: true };
    }
  } catch (error) {
    preferredError ??= error;
  }

  documentRef.removeEventListener("copy", handleCopy);
  staging.remove();
  selection?.removeAllRanges();
  return { method: "manual", success: false, error: preferredError };
}

export async function copyPlainText(
  plainText: string,
  clipboard: Pick<Clipboard, "writeText"> | undefined = navigator.clipboard,
): Promise<boolean> {
  if (!clipboard?.writeText) {
    return false;
  }
  try {
    await clipboard.writeText(plainText);
    return true;
  } catch {
    return false;
  }
}

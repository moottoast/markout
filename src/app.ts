import "./styles.css";
import { copyForOutlook, copyPlainText } from "./clipboard";
import { readMarkdownFile } from "./file-import";
import {
  convertMarkdown,
  createDownloadDocument,
  type ConversionResult,
} from "./markdown";
import { SAMPLE_MARKDOWN } from "./sample";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <header class="app-header">
    <div class="brand">
      <span class="brand-mark" aria-hidden="true">M</span>
      <div>
        <h1>MarkOut</h1>
        <p>Write clearly. Paste cleanly.</p>
      </div>
    </div>
    <div class="privacy-badge">
      <span class="privacy-dot" aria-hidden="true"></span>
      Private and offline
    </div>
  </header>

  <main class="app-shell">
    <section class="intro" aria-labelledby="intro-heading">
      <div>
        <p class="eyebrow">Local email formatter</p>
        <h2 id="intro-heading">From Markdown to a polished Outlook draft</h2>
        <p>Your writing stays in this browser. Nothing is uploaded, stored, or sent.</p>
      </div>
      <p class="compatibility-note">
        Outlook may normalize some spacing, fonts, and colors after paste.
      </p>
    </section>

    <div class="workspace">
      <section class="panel editor-panel" id="drop-zone" aria-labelledby="editor-title">
        <div class="panel-header">
          <div>
            <p class="panel-kicker">Compose</p>
            <h2 id="editor-title">Markdown</h2>
          </div>
          <div class="file-actions">
            <input
              id="file-input"
              class="visually-hidden"
              type="file"
              accept=".md,.markdown,.txt,text/markdown,text/plain"
            />
            <button id="open-file" class="button button-quiet" type="button">
              Open file
            </button>
          </div>
        </div>
        <label class="visually-hidden" for="markdown-input">Markdown content</label>
        <textarea
          id="markdown-input"
          spellcheck="true"
          aria-describedby="editor-help"
        ></textarea>
        <div class="editor-footer">
          <p id="editor-help">Drop a .md, .markdown, or .txt file anywhere in this panel.</p>
          <span id="character-count">0 characters</span>
        </div>
      </section>

      <section class="panel preview-panel" aria-labelledby="preview-title">
        <div class="panel-header">
          <div>
            <p class="panel-kicker">Review</p>
            <h2 id="preview-title">Email preview</h2>
          </div>
          <label class="image-toggle">
            <input id="remote-images" type="checkbox" />
            <span>Load remote images</span>
          </label>
        </div>
        <div
          id="email-preview"
          class="email-preview"
          tabindex="-1"
          aria-label="Rendered email preview"
        ></div>
        <p id="image-warning" class="image-warning" hidden></p>
      </section>
    </div>

    <section class="action-bar" aria-label="Output actions">
      <div class="primary-actions">
        <button id="copy-outlook" class="button button-primary" type="button">
          Copy for Outlook
        </button>
        <button id="copy-plain" class="button button-secondary" type="button">
          Copy plain text
        </button>
        <button id="download-html" class="button button-secondary" type="button">
          Download HTML
        </button>
      </div>
      <button id="clear-input" class="button button-quiet danger-text" type="button">
        Clear
      </button>
    </section>

    <div id="status" class="status" role="status" aria-live="polite"></div>

    <footer>
      <div>
        <p><strong>Privacy:</strong> Your Markdown never leaves this browser.</p>
        <p>No accounts, analytics, cloud storage, or network calls.</p>
      </div>
      <p>
        Open source under the MIT License.
        <a href="https://github.com/moottoast/markout" target="_blank" rel="noopener noreferrer">
          View MarkOut on GitHub
        </a>
      </p>
    </footer>
  </main>
`;

function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

const input = requireElement<HTMLTextAreaElement>("#markdown-input");
const preview = requireElement<HTMLDivElement>("#email-preview");
const imageToggle = requireElement<HTMLInputElement>("#remote-images");
const imageWarning = requireElement<HTMLParagraphElement>("#image-warning");
const characterCount = requireElement<HTMLSpanElement>("#character-count");
const status = requireElement<HTMLDivElement>("#status");
const fileInput = requireElement<HTMLInputElement>("#file-input");
const dropZone = requireElement<HTMLElement>("#drop-zone");
const outputButtons = [
  requireElement<HTMLButtonElement>("#copy-outlook"),
  requireElement<HTMLButtonElement>("#copy-plain"),
  requireElement<HTMLButtonElement>("#download-html"),
];

let currentResult: ConversionResult = {
  html: "",
  plainText: "",
  imageWarnings: 0,
};

function setStatus(
  message: string,
  tone: "success" | "error" | "info" = "info",
): void {
  status.textContent = message;
  status.dataset.tone = tone;
}

function render(): void {
  currentResult = convertMarkdown(input.value, {
    allowRemoteImages: imageToggle.checked,
  });
  preview.innerHTML =
    currentResult.html ||
    '<p class="empty-preview">Your formatted email will appear here.</p>';
  characterCount.textContent = `${input.value.length.toLocaleString()} characters`;
  outputButtons.forEach((button) => {
    button.disabled = !input.value.trim();
  });

  imageWarning.hidden = currentResult.imageWarnings === 0;
  imageWarning.textContent =
    currentResult.imageWarnings === 1
      ? "1 image is shown as a placeholder. Enable remote images to include a hosted HTTPS image."
      : `${currentResult.imageWarnings} images are shown as placeholders. Enable remote images to include hosted HTTPS images.`;
}

function selectPreview(): void {
  const range = document.createRange();
  range.selectNodeContents(preview);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  preview.focus();
}

async function importFile(file: File): Promise<void> {
  try {
    input.value = await readMarkdownFile(file);
    render();
    input.focus();
    setStatus(`${file.name} opened.`, "success");
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : "The file could not be opened.",
      "error",
    );
  }
}

input.value = SAMPLE_MARKDOWN;
render();

input.addEventListener("input", () => {
  render();
  setStatus("");
});

imageToggle.addEventListener("change", () => {
  render();
  setStatus(
    imageToggle.checked
      ? "Hosted HTTPS images are enabled for this session."
      : "Remote images are disabled.",
    "info",
  );
});

requireElement<HTMLButtonElement>("#open-file").addEventListener("click", () => {
  fileInput.click();
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) {
    void importFile(file);
  }
  fileInput.value = "";
});

for (const eventName of ["dragenter", "dragover"]) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("is-dragging");
  });
}

for (const eventName of ["dragleave", "drop"]) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("is-dragging");
  });
}

dropZone.addEventListener("drop", (event) => {
  const file = event.dataTransfer?.files[0];
  if (file) {
    void importFile(file);
  }
});

requireElement<HTMLButtonElement>("#copy-outlook").addEventListener(
  "click",
  async () => {
    const result = await copyForOutlook(
      currentResult.html,
      currentResult.plainText,
    );
    if (result.success) {
      setStatus(
        result.method === "clipboard-api"
          ? "Copied rich HTML and plain text for Outlook."
          : "Copied for Outlook using the browser fallback.",
        "success",
      );
      return;
    }

    selectPreview();
    const shortcut =
      navigator.platform.toLowerCase().includes("mac") ? "Command+C" : "Ctrl+C";
    setStatus(
      `Automatic copy was blocked. The preview is selected. Press ${shortcut}.`,
      "error",
    );
  },
);

requireElement<HTMLButtonElement>("#copy-plain").addEventListener(
  "click",
  async () => {
    const copied = await copyPlainText(currentResult.plainText);
    setStatus(
      copied
        ? "Plain text copied."
        : "Plain-text copy was blocked. Select the editor text and copy it manually.",
      copied ? "success" : "error",
    );
  },
);

requireElement<HTMLButtonElement>("#download-html").addEventListener(
  "click",
  () => {
    const documentHtml = createDownloadDocument(currentResult.html);
    const url = URL.createObjectURL(
      new Blob([documentHtml], { type: "text/html;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "outlook-email.html";
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus("Email preview downloaded as HTML.", "success");
  },
);

requireElement<HTMLButtonElement>("#clear-input").addEventListener("click", () => {
  input.value = "";
  render();
  input.focus();
  setStatus("Editor cleared.", "info");
});

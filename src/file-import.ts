const SUPPORTED_EXTENSIONS = [".md", ".markdown", ".txt"];

export function isSupportedMarkdownFile(file: Pick<File, "name">): boolean {
  const name = file.name.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((extension) => name.endsWith(extension));
}

export async function readMarkdownFile(file: File): Promise<string> {
  if (!isSupportedMarkdownFile(file)) {
    throw new Error("Choose a .md, .markdown, or .txt file.");
  }
  return file.text();
}

import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";

const outputDirectory = resolve("dist");
const files = await readdir(outputDirectory);
assert.deepEqual(files, ["markdown-for-outlook.html"]);

const artifactPath = resolve(outputDirectory, files[0]);
const html = await readFile(artifactPath, "utf8");
const document = new JSDOM(html).window.document;

assert.equal(document.querySelectorAll("script[src]").length, 0);
assert.equal(document.querySelectorAll('link[rel="stylesheet"]').length, 0);
assert.equal(
  document.querySelectorAll(
    "img[src], iframe[src], source[src], video[src], audio[src]",
  ).length,
  0,
);
assert.equal(document.querySelectorAll("script").length, 1);
assert.equal(document.querySelectorAll("style").length, 1);
assert.ok(html.includes("Markdown for Outlook"));
assert.ok(html.includes("Copy for Outlook"));

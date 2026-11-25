// Wiki articles live as Markdown files in content/wiki/<slug>.md with YAML
// front matter. They are parsed once and cached; the cache is rebuilt when a
// file's modification time changes, so edits show up without a restart.
//
// Rendering runs in two passes:
//   1. Handlebars, so partials such as {{> stat-icon name="goals"}} work.
//   2. Markdown (marked). Raw HTML is allowed: the content is ours, in git.
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import matter from "gray-matter";
import { Marked, Renderer } from "marked";
import { slugify, wikiPath } from "../../shared/urls.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WIKI_DIR = path.join(__dirname, "../../content/wiki");

let hbs = null;
let cache = { signature: "", articles: [], bySlug: new Map() };

export function initWiki({ handlebarsEngine }) {
  hbs = handlebarsEngine;
}

function formatUpdated(isoDate) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

function toIsoDate(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return typeof value === "string" ? value.slice(0, 10) : "";
}

// marked escapes inline text ("it&#39;s"); the TOC text is escaped again by
// Handlebars, so store it as plain text.
const ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };
const plainText = (html) => html.replace(/<[^>]+>/g, "").replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity]);

function createMarkdown(toc) {
  const renderer = new Renderer();
  const usedIds = new Set();

  renderer.heading = function heading({ tokens, depth, text }) {
    const inner = this.parser.parseInline(tokens);
    let id = slugify(plainText(text));
    while (usedIds.has(id)) id = `${id}-x`;
    usedIds.add(id);
    if (depth === 2) toc.push({ id, text: plainText(inner) });
    return `<h${depth} id="${id}">${inner}</h${depth}>\n`;
  };

  // Wide tables scroll inside their own box instead of the page.
  renderer.table = function table(token) {
    return `<div class="wiki-table-wrap">${Renderer.prototype.table.call(this, token)}</div>\n`;
  };

  return new Marked({ gfm: true, renderer });
}

async function renderBody(source) {
  let expanded = source;
  if (hbs) {
    const partials = await hbs.getPartials();
    expanded = hbs.handlebars.compile(source)({}, { partials, helpers: hbs.helpers });
  }
  const toc = [];
  const html = createMarkdown(toc).parse(expanded);
  return { html, toc };
}

async function loadArticles() {
  const files = (await fs.readdir(WIKI_DIR)).filter((file) => file.endsWith(".md")).sort();
  const stats = await Promise.all(files.map((file) => fs.stat(path.join(WIKI_DIR, file))));
  const signature = files.map((file, index) => `${file}:${stats[index].mtimeMs}`).join("|");
  if (signature === cache.signature) return cache;

  const articles = [];
  for (const file of files) {
    const raw = await fs.readFile(path.join(WIKI_DIR, file), "utf8");
    const { data, content } = matter(raw);
    const slug = path.basename(file, ".md");
    const { html, toc } = await renderBody(content);
    const updated = toIsoDate(data.updated);
    articles.push({
      slug,
      path: wikiPath(slug),
      title: data.title,
      navTitle: data.navTitle || data.title,
      description: data.description,
      lead: data.lead || data.description,
      order: Number(data.order) || 99,
      updated,
      updatedText: formatUpdated(updated),
      published: toIsoDate(data.published) || updated,
      image: data.image || null,
      imageAlt: data.imageAlt || "",
      oldAnchors: data.oldAnchors || [],
      relatedSlugs: data.related || [],
      html,
      toc,
    });
  }
  articles.sort((a, b) => a.order - b.order);

  const bySlug = new Map(articles.map((article) => [article.slug, article]));
  articles.forEach((article, index) => {
    const summary = (other) => other && { slug: other.slug, path: other.path, title: other.navTitle, description: other.description, image: other.image };
    article.prev = summary(articles[index - 1]);
    article.next = summary(articles[index + 1]);
    article.related = article.relatedSlugs.map((slug) => summary(bySlug.get(slug))).filter(Boolean);
  });

  cache = { signature, articles, bySlug };
  return cache;
}

export async function getWikiArticles() {
  return (await loadArticles()).articles;
}

export async function getWikiArticle(slug) {
  return (await loadArticles()).bySlug.get(slug) ?? null;
}

// Old single-page anchors (/gf-wiki#elo) -> article slugs, for the hub's forwarder.
export async function getLegacyAnchorMap() {
  const map = {};
  for (const article of await getWikiArticles()) {
    for (const anchor of article.oldAnchors) map[anchor] = article.path;
  }
  return map;
}

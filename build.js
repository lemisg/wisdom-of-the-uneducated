// Builds the site from the files in content/ into _site/.
// Run with: npm run build
const fs = require("fs");
const path = require("path");
const { marked } = require("marked");

const ROOT = __dirname;
const OUT = path.join(ROOT, "_site");
const site = JSON.parse(fs.readFileSync(path.join(ROOT, "site.json"), "utf8"));
site.url = site.url.replace(/\/+$/, "");
const basePath = new URL(site.url).pathname.replace(/\/+$/, "");

const TYPES = { essay: "Essay", story: "Story", poem: "Poem" };

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Reads the "key: value" block between the --- lines at the top of a file.
function parseFile(file) {
  const raw = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if (/^(".*"|'.*')$/.test(value)) value = value.slice(1, -1);
    meta[key] = value;
  }
  return { meta, body: m[2].trim() };
}

// Poems keep their line breaks: a blank line starts a new stanza.
function renderPoem(body) {
  return body
    .split(/\n\s*\n/)
    .map((stanza) => {
      const lines = stanza.split("\n").map((l) => {
        const indent = l.match(/^\s*/)[0].length;
        const html = marked.parseInline(l.trim());
        return indent ? `<span style="padding-left:${indent * 0.5}em">${html}</span>` : html;
      });
      return `<p class="stanza">${lines.join("<br>\n")}</p>`;
    })
    .join("\n");
}

const formatDate = (d) =>
  d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

function loadPosts() {
  const dir = path.join(ROOT, "content", "posts");
  const posts = [];
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith(".md")) continue;
    const m = name.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/);
    if (!m) throw new Error(`Post file names must look like 2026-11-09-my-title.md (got ${name})`);
    const { meta, body } = parseFile(path.join(dir, name));
    if (!meta.title) throw new Error(`${name} is missing a title`);
    if (meta.draft === "true") continue;
    const type = (meta.type || "essay").toLowerCase();
    if (!TYPES[type]) throw new Error(`${name}: type must be one of ${Object.keys(TYPES).join(", ")}`);
    const date = new Date(m[1] + "T00:00:00Z");
    const html = type === "poem" ? renderPoem(body) : marked.parse(body);
    const words = body.split(/\s+/).filter(Boolean).length;
    posts.push({
      slug: m[2],
      title: meta.title,
      type,
      summary: meta.summary || "",
      date,
      html,
      minutes: Math.max(1, Math.round(words / 220)),
    });
  }
  return posts.sort((a, b) => b.date - a.date || a.slug.localeCompare(b.slug));
}

// `root` is the relative path back to the top of the site ("", "../", "../../"),
// so links work no matter what address the site is served from.
function page({ root, title, description, body, bodyClass = "" }) {
  const fullTitle = title ? `${title} — ${site.title}` : `${site.title} — a weekly letter by ${site.author}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description || site.description)}">
<meta property="og:title" content="${esc(title || site.title)}">
<meta property="og:description" content="${esc(description || site.description)}">
<meta property="og:site_name" content="${esc(site.title)}">
<meta property="og:type" content="${title ? "article" : "website"}">
<link rel="alternate" type="application/rss+xml" title="${esc(site.title)}" href="${root}feed.xml">
<link rel="icon" href="${root}favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${root}style.css">
</head>
<body class="${bodyClass}">
<header class="site-header">
  <a class="brand" href="${root || "./"}">${esc(site.title)}</a>
  <nav>
    <a href="${root}archive/">Archive</a>
    <a href="${root}about/">About</a>
  </nav>
</header>
<main>
${body}
</main>
<footer class="site-footer">
  <p>© ${new Date().getUTCFullYear()} ${esc(site.author)} · <a href="${root}feed.xml">RSS</a></p>
</footer>
</body>
</html>
`;
}

const metaLine = (p) =>
  `<span class="kind">${TYPES[p.type]}</span> · <time datetime="${p.date.toISOString().slice(0, 10)}">${formatDate(p.date)}</time>`;

function listItem(p, root) {
  return `<li>
  <a href="${root}posts/${p.slug}/">
    <span class="item-title">${esc(p.title)}</span>
    ${p.summary ? `<span class="item-summary">${esc(p.summary)}</span>` : ""}
  </a>
  <p class="meta">${metaLine(p)}</p>
</li>`;
}

function write(rel, content) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function build() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(path.join(ROOT, "src"))) {
    fs.copyFileSync(path.join(ROOT, "src", f), path.join(OUT, f));
  }
  write(".nojekyll", "");

  const posts = loadPosts();

  // Home: this week's piece in full, then the most recent earlier ones.
  const [latest, ...rest] = posts;
  let home = `<section class="intro">
  <h1>${esc(site.title)}</h1>
  <p>${esc(site.tagline)}</p>
</section>`;
  if (latest) {
    home += `
<article class="post ${latest.type} featured">
  <p class="eyebrow">This week</p>
  <h2 class="post-title"><a href="posts/${latest.slug}/">${esc(latest.title)}</a></h2>
  <p class="meta">${metaLine(latest)}</p>
  <div class="post-body">
${latest.html}
  </div>
</article>`;
  } else {
    home += `<p class="empty">The first piece is on its way.</p>`;
  }
  if (rest.length) {
    home += `
<section class="list-section">
  <h2 class="section-title">Earlier</h2>
  <ul class="post-list">
${rest.slice(0, 5).map((p) => listItem(p, "")).join("\n")}
  </ul>
  ${rest.length > 5 ? `<p class="more"><a href="archive/">See everything in the archive →</a></p>` : ""}
</section>`;
  }
  write("index.html", page({ root: "", body: home, bodyClass: "home" }));

  // One page per piece, with links to the pieces on either side of it.
  posts.forEach((p, i) => {
    const newer = posts[i - 1];
    const older = posts[i + 1];
    const body = `<article class="post ${p.type}">
  <p class="meta">${metaLine(p)}${p.type === "poem" ? "" : ` · ${p.minutes} min read`}</p>
  <h1 class="post-title">${esc(p.title)}</h1>
  <div class="post-body">
${p.html}
  </div>
  <p class="signoff">— ${esc(site.author)}</p>
</article>
<nav class="pager">
  ${older ? `<a class="older" href="../${older.slug}/"><span>Previous</span>${esc(older.title)}</a>` : "<span></span>"}
  ${newer ? `<a class="newer" href="../${newer.slug}/"><span>Next</span>${esc(newer.title)}</a>` : "<span></span>"}
</nav>`;
    write(
      `posts/${p.slug}/index.html`,
      page({ root: "../../", title: p.title, description: p.summary, body })
    );
  });

  // Archive, grouped by year.
  const years = [...new Set(posts.map((p) => p.date.getUTCFullYear()))];
  const archive = `<h1 class="page-title">Archive</h1>
<p class="lede">Every piece, newest first.</p>
${years
  .map(
    (y) => `<section class="list-section">
  <h2 class="section-title">${y}</h2>
  <ul class="post-list">
${posts.filter((p) => p.date.getUTCFullYear() === y).map((p) => listItem(p, "../")).join("\n")}
  </ul>
</section>`
  )
  .join("\n")}`;
  write("archive/index.html", page({ root: "../", title: "Archive", body: archive }));

  // About.
  const about = parseFile(path.join(ROOT, "content", "about.md"));
  write(
    "about/index.html",
    page({
      root: "../",
      title: about.meta.title || "About",
      body: `<article class="post"><h1 class="page-title">${esc(about.meta.title || "About")}</h1><div class="post-body">${marked.parse(about.body)}</div></article>`,
    })
  );

  // Not-found page. It can be shown at any address, so it uses full paths.
  write(
    "404.html",
    page({
      root: basePath + "/",
      title: "Page not found",
      body: `<h1 class="page-title">Page not found</h1><p class="lede">That page isn't here. Try the <a href="${basePath}/archive/">archive</a>.</p>`,
    })
  );

  // RSS feed, so readers can follow along in a feed reader.
  const items = posts
    .slice(0, 30)
    .map(
      (p) => `<item>
<title>${esc(p.title)}</title>
<link>${site.url}/posts/${p.slug}/</link>
<guid>${site.url}/posts/${p.slug}/</guid>
<pubDate>${p.date.toUTCString()}</pubDate>
<description><![CDATA[${p.html.replace(/]]>/g, "]]&gt;")}]]></description>
</item>`
    )
    .join("\n");
  write(
    "feed.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>${esc(site.title)}</title>
<link>${site.url}/</link>
<description>${esc(site.description)}</description>
<language>en-us</language>
${items}
</channel>
</rss>
`
  );

  console.log(`Built ${posts.length} piece(s) into _site/`);
}

build();

# Wisdom of the Uneducated

A weekly perspective letter by an unknown author — philosophy, politics, theology, business, and current news.

Live site: https://lemisg.github.io/wisdom-of-the-uneducated/

## Publishing a new piece

Add one file to `content/posts/`, named with the date and a short title:

```
content/posts/2026-11-16-my-grandmothers-saying.md
```

Start the file like this, then write underneath:

```
---
title: My Grandmother's Saying
type: essay
summary: One sentence that shows up in the archive.
---

Your writing goes here.
```

`type` can be `essay`, `story`, or `poem`. For a poem, every line stays on its own line and a blank line starts a new stanza. Add `draft: true` to keep a piece off the site until it is ready.

When the file is pushed to the `main` branch, GitHub rebuilds and publishes the site automatically (about a minute).

## Other things you can change

- `site.json` — the site name, tagline, author, and web address.
- `content/about.md` — the About page.
- `src/style.css` — colors, fonts, and spacing.

## One-time setup on GitHub

In the repository, go to **Settings → Pages** and set **Source** to **GitHub Actions**.

## Previewing on your own computer

```
npm install
npm run preview
```

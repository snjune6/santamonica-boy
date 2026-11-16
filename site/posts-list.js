import { listPublishedPosts, listVisibleCategories, postPath } from "./posts.js?v=3";

const status = document.querySelector("[data-status]");
const list = document.querySelector("[data-list]");
const filters = document.querySelector("[data-filters]");
const params = new URLSearchParams(location.search);
const categoryId = params.get("category") || "";

function chip(href, label, active) {
  const a = document.createElement("a");
  a.href = href;
  a.className = active ? "posts-chip is-active" : "posts-chip";
  a.textContent = label;
  return a;
}

function escapeText(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

try {
  const [categories, posts] = await Promise.all([
    listVisibleCategories(),
    listPublishedPosts(categoryId || undefined),
  ]);

  if (filters) {
    filters.hidden = false;
    filters.replaceChildren(chip("/posts", "All", !categoryId));
    categories.forEach((category) => {
      filters.appendChild(
        chip(`/posts?category=${encodeURIComponent(category.id)}`, category.name, categoryId === category.id),
      );
    });
  }

  if (!posts.length) {
    if (status) status.textContent = "No posts yet.";
  } else if (list && status) {
    status.hidden = true;
    list.innerHTML = posts
      .map((post) => {
        const thumb = post.thumbnail?.url
          ? `<img class="posts-thumb" src="${escapeText(post.thumbnail.url)}" alt="" width="${post.thumbnail.width || 160}" height="${post.thumbnail.height || 90}" loading="lazy" decoding="async" />`
          : `<span class="posts-thumb posts-thumb-empty" aria-hidden="true"></span>`;
        return `<li>
          <a class="posts-row" href="${postPath(post.slug)}">
            ${thumb}
            <span class="posts-row-copy">
              <span class="posts-row-title">${escapeText(post.title)}</span>
              <span class="posts-row-meta">${escapeText(post.categoryName || "Post")}${post.publishedAt ? ` · ${escapeText(post.publishedAt)}` : ""}</span>
            </span>
          </a>
        </li>`;
      })
      .join("");
  }
} catch (error) {
  console.error(error);
  if (status) status.textContent = "Couldn't load posts.";
}

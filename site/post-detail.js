import { getPublishedPostBySlug, renderMarkdown } from "./posts.js?v=4";
import { getApps } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getAnalytics,
  isSupported,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-analytics.js";

let analyticsBooted = false;

function bootAnalytics() {
  if (analyticsBooted) return;
  const analyticsApp = getApps()[0];
  if (!analyticsApp) return;
  analyticsBooted = true;
  isSupported()
    .then((supported) => {
      if (supported) getAnalytics(analyticsApp);
    })
    .catch((error) => console.warn("Analytics unavailable:", error));
}

export async function mountPostDetail() {
  bootAnalytics();

  const status = document.querySelector("[data-status]");
  const article = document.querySelector("[data-article]");
  if (!status && !article) return () => {};

  const parts = location.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  const slug = decodeURIComponent(parts[parts.length - 1] || "");
  let cancelled = false;

  if (!slug || slug === "posts") {
    if (status) status.textContent = "Post not found.";
    return () => {
      cancelled = true;
    };
  }

  try {
    const post = await getPublishedPostBySlug(slug);
    if (cancelled) return () => {};

    if (!post) {
      if (status) status.textContent = "Post not found.";
    } else if (article && status) {
      document.title = `${post.title} | Santamonica Boy`;
      const existingCanonical = document.querySelector('link[rel="canonical"][data-post-canonical]');
      existingCanonical?.remove();
      const canonical = document.createElement("link");
      canonical.rel = "canonical";
      canonical.dataset.postCanonical = "1";
      canonical.href = `https://santamonica-boy.web.app/posts/${encodeURIComponent(post.slug)}`;
      document.head.appendChild(canonical);

      status.hidden = true;
      article.hidden = false;
      const meta = document.querySelector("[data-meta]");
      if (meta) meta.textContent = `Home · ${post.categoryName || "Posts"}`;
      const title = document.querySelector("[data-title]");
      if (title) title.textContent = post.title;
      const date = document.querySelector("[data-date]");
      if (date && post.publishedAt) {
        date.hidden = false;
        date.textContent = post.publishedAt;
      }
      const thumb = document.querySelector("[data-thumb]");
      if (thumb && post.thumbnail?.url) {
        thumb.hidden = false;
        thumb.src = post.thumbnail.url;
        if (post.thumbnail.width) thumb.width = post.thumbnail.width;
        if (post.thumbnail.height) thumb.height = post.thumbnail.height;
      }
      const body = document.querySelector("[data-body]");
      if (body) body.innerHTML = renderMarkdown(post.body);
    }
  } catch (error) {
    console.error(error);
    if (!cancelled && status) status.textContent = "Couldn't load this post.";
  }

  return () => {
    cancelled = true;
    document.querySelector('link[rel="canonical"][data-post-canonical]')?.remove();
  };
}

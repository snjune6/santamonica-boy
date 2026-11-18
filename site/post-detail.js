import { getPublishedPostBySlug, renderMarkdown } from "./posts.js?v=4";
import { getApps } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getAnalytics,
  isSupported,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-analytics.js";

// GA4 for /posts/{slug}. posts.js has already created the Firebase app.
const analyticsApp = getApps()[0];
if (analyticsApp) {
  isSupported()
    .then((supported) => {
      if (supported) getAnalytics(analyticsApp);
    })
    .catch((error) => console.warn("Analytics unavailable:", error));
}

const status = document.querySelector("[data-status]");
const article = document.querySelector("[data-article]");
const parts = location.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
const slug = decodeURIComponent(parts[parts.length - 1] || "");

if (!slug || slug === "posts") {
  if (status) status.textContent = "Post not found.";
} else {
  try {
    const post = await getPublishedPostBySlug(slug);
    if (!post) {
      if (status) status.textContent = "Post not found.";
    } else if (article && status) {
      document.title = `${post.title} | Santamonica Boy`;
      const canonical = document.createElement("link");
      canonical.rel = "canonical";
      canonical.href = `https://santamonica-boy.web.app/posts/${encodeURIComponent(post.slug)}`;
      document.head.appendChild(canonical);

      status.hidden = true;
      article.hidden = false;
      document.querySelector("[data-meta]").textContent = `Home · ${post.categoryName || "Posts"}`;
      document.querySelector("[data-title]").textContent = post.title;
      const date = document.querySelector("[data-date]");
      if (post.publishedAt) {
        date.hidden = false;
        date.textContent = post.publishedAt;
      }
      const thumb = document.querySelector("[data-thumb]");
      if (post.thumbnail?.url) {
        thumb.hidden = false;
        thumb.src = post.thumbnail.url;
        if (post.thumbnail.width) thumb.width = post.thumbnail.width;
        if (post.thumbnail.height) thumb.height = post.thumbnail.height;
      }
      document.querySelector("[data-body]").innerHTML = renderMarkdown(post.body);
    }
  } catch (error) {
    console.error(error);
    if (status) status.textContent = "Couldn't load this post.";
  }
}

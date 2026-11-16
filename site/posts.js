import { getApps, initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  limit,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBS3E1TzbfsPBuBr8MKhIROY4KU9au_9Ig",
  authDomain: "santamonica-boy.firebaseapp.com",
  projectId: "santamonica-boy",
  storageBucket: "santamonica-boy.firebasestorage.app",
  messagingSenderId: "670971540291",
  appId: "1:670971540291:web:9fa80b513924aa0eb475f6",
  measurementId: "G-FCRLEMKTZK",
};

const app = getApps()[0] || initializeApp(firebaseConfig);
const db = getFirestore(app);

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function inline(value) {
  let text = escapeHtml(value);
  text = text.replace(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g, (_, alt, src) => {
    return `<img src="${src}" alt="${alt}" loading="lazy" decoding="async" class="post-image" />`;
  });
  text = text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return text;
}

export function renderMarkdown(markdown) {
  const lines = String(markdown || "")
    .replaceAll("\r\n", "\n")
    .split("\n");
  const html = [];
  let inList = false;
  let inCode = false;
  let code = [];
  let paragraph = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${inline(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (!inList) return;
    html.push("</ul>");
    inList = false;
  };

  for (const line of lines) {
    if (line.startsWith("```")) {
      flushParagraph();
      closeList();
      if (inCode) {
        html.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
        code = [];
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      code.push(line);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      closeList();
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      closeList();
      html.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`);
      continue;
    }
    if (/^>\s?/.test(line)) {
      flushParagraph();
      closeList();
      html.push(`<blockquote><p>${inline(line.replace(/^>\s?/, ""))}</p></blockquote>`);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      flushParagraph();
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${inline(line.replace(/^[-*]\s+/, ""))}</li>`);
      continue;
    }
    closeList();
    paragraph.push(line.trim());
  }
  if (inCode) html.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
  flushParagraph();
  closeList();
  return html.join("\n");
}

function dateLabel(value) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  if (value?.toDate) return value.toDate().toISOString().slice(0, 10);
  return "";
}

function sortPosts(posts) {
  return posts.sort((a, b) => String(b.publishedAt || "").localeCompare(String(a.publishedAt || "")));
}

function excerptFromBody(body, limit = 220) {
  const plain = String(body || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[[^\]]*\]\([^)]+\)/g, "$1")
    .replace(/[#>*_`~-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= limit) return plain;
  return `${plain.slice(0, limit).trim()}…`;
}

function displayDate(value) {
  const label = dateLabel(value);
  return label ? label.replaceAll("-", ".") : "";
}

export async function listPublishedPosts(categoryId) {
  const snap = await getDocs(query(collection(db, "posts"), where("status", "==", "published")));
  let posts = snap.docs.map((item) => {
    const data = item.data();
    return {
      id: item.id,
      title: data.title || "",
      slug: data.slug || "",
      categoryId: data.categoryId || "",
      categoryName: data.categoryName || "",
      publishedAt: dateLabel(data.publishedAt),
      date: displayDate(data.publishedAt),
      description: excerptFromBody(data.body),
      thumbnail: data.thumbnail || null,
    };
  });
  if (categoryId) posts = posts.filter((post) => post.categoryId === categoryId);
  return sortPosts(posts);
}

export async function listVisibleCategories() {
  const snap = await getDocs(query(collection(db, "postCategories"), where("visible", "==", true)));
  return snap.docs
    .map((item) => {
      const data = item.data();
      return {
        id: item.id,
        name: data.name || "",
        slug: data.slug || "",
        order: typeof data.order === "number" ? data.order : 0,
        visible: true,
      };
    })
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

export async function getPublishedPostBySlug(slug) {
  // Keep the query rules-compatible (status == published). Filter slug client-side
  // so we don't depend on a composite index for the first versions.
  const snap = await getDocs(query(collection(db, "posts"), where("status", "==", "published")));
  const found = snap.docs.find((item) => item.data().slug === slug);
  if (!found) return null;
  const data = found.data();
  return {
    id: found.id,
    title: data.title || "",
    slug: data.slug || "",
    categoryId: data.categoryId || "",
    categoryName: data.categoryName || "",
    body: data.body || "",
    publishedAt: dateLabel(data.publishedAt),
    thumbnail: data.thumbnail || null,
  };
}

export function postPath(slug) {
  return `/posts/${encodeURIComponent(slug)}`;
}

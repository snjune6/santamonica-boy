import {
  getPublishedPostBySlug,
  listPublishedPosts,
  listVisibleCategories,
  postPath,
  renderMarkdown,
} from "./posts.js?v=4";

const canvas = document.getElementById("constellationCanvas");
const ctx = canvas.getContext("2d");
const bootStatus = document.getElementById("boot-status");
const nodeCountEl = document.getElementById("node-count");
const stage = document.querySelector(".constellation-stage") || canvas.parentElement;
const workspace = document.querySelector("[data-workspace]");
const detailPanel = document.querySelector("[data-detail-panel]");
const detailStatus = document.querySelector("[data-detail-status]");
const detailArticle = document.querySelector("[data-detail-article]");
const detailCategory = document.querySelector("[data-detail-category]");
const detailDate = document.querySelector("[data-detail-date]");
const detailTitle = document.querySelector("[data-detail-title]");
const detailThumb = document.querySelector("[data-detail-thumb]");
const detailBody = document.querySelector("[data-detail-body]");

let width = 0;
let height = 0;
let detailRequestId = 0;
let activeDetailSlug = "";

function resizeCanvas() {
  const rect = stage.getBoundingClientRect();
  const nextW = Math.max(1, Math.floor(rect.width));
  const nextH = Math.max(1, Math.floor(rect.height));
  if (nextW === width && nextH === height) return;
  width = canvas.width = nextW;
  height = canvas.height = nextH;
}

resizeCanvas();

// Temporary threshold for testing the "더보기" node. Raise again after QA.
const PAGE_SIZE = 1;

let allPosts = [];
let categories = [];
let nodes = [];

let cameraX = 0;
let cameraY = 0;
let targetCameraX = 0;
let targetCameraY = 0;
let zoom = 1;
let targetZoom = 1;

let isDragging = false;
let startX = 0;
let startY = 0;
let hoveredNode = null;
let draggedNode = null;
let hasMoved = false;

function categoryAnchor(index, total) {
  if (total <= 1) return { x: 0, y: 40 };
  if (total === 2) return index === 0 ? { x: -180, y: 0 } : { x: 180, y: 0 };
  const spread = Math.min(520, 160 * (total - 1));
  const start = -spread / 2;
  const step = spread / (total - 1);
  return { x: start + step * index, y: 30 + (index % 2) * 24 };
}

function buildBaseNodes() {
  const home = {
    id: "menu-home",
    title: "Home",
    x: -170,
    y: -120,
    targetX: -170,
    targetY: -120,
    isMenuNode: true,
    href: "/",
    alpha: 1,
  };

  const rootX = 170;
  const rootY = -120;
  const postsRoot = {
    id: "root-posts",
    title: "Posts",
    x: rootX,
    y: rootY,
    targetX: rootX,
    targetY: rootY,
    isMenuNode: true,
    isPostsRoot: true,
    isRootNode: true,
    alpha: 1,
  };

  const categoryNodes = categories.map((category, index) => {
    const anchor = categoryAnchor(index, categories.length);
    const offsetX = anchor.x;
    const offsetY = anchor.y + 120;
    const postCount = postsForCategory(category.id).length;
    return {
      id: `cat-${category.id}`,
      categoryId: category.id,
      category: category.name.toUpperCase(),
      title: category.name.toUpperCase(),
      postCount,
      visibleLimit: PAGE_SIZE,
      x: rootX + offsetX,
      y: rootY + offsetY,
      targetX: rootX + offsetX,
      targetY: rootY + offsetY,
      offsetX,
      offsetY,
      parentId: "root-posts",
      isCategoryNode: true,
      expanded: false,
      alpha: 1,
      anchorIndex: index,
    };
  });

  nodes = [home, postsRoot, ...categoryNodes];
  updateNodeCount();
}

function updateNodeCount() {
  if (nodeCountEl) nodeCountEl.textContent = String(nodes.filter((node) => !node.isClosing).length);
}

function postsForCategory(categoryId) {
  return allPosts
    .filter((post) => post.categoryId === categoryId)
    .sort((a, b) => String(b.publishedAt || "").localeCompare(String(a.publishedAt || "")));
}

function moreNodeId(categoryId) {
  return `more-${categoryId}`;
}

function appendPostNode(catNode, post, index, visiblePosts) {
  const existing = nodes.find((node) => node.id === post.id);
  const parentId = index === 0 ? catNode.id : visiblePosts[index - 1].id;
  const targetOffsetY = 90 + index * 85;

  if (existing) {
    existing.isClosing = false;
    existing.isPostNode = true;
    existing.alpha = Math.max(existing.alpha || 0, 0.05);
    existing.parentId = parentId;
    existing.targetX = catNode.x;
    existing.targetY = catNode.y + targetOffsetY;
    return;
  }

  nodes.push({
    ...post,
    id: post.id,
    categoryId: post.categoryId,
    category: (post.categoryName || "POST").toUpperCase(),
    date: post.date || post.publishedAt?.replaceAll("-", ".") || "",
    description: post.description || "",
    x: catNode.x,
    y: catNode.y,
    targetX: catNode.x,
    targetY: catNode.y + targetOffsetY,
    parentId,
    isCategoryNode: false,
    isRootNode: false,
    isPostNode: true,
    alpha: 0,
  });
}

function syncMoreNode(catNode, visibleCount, totalCount) {
  const id = moreNodeId(catNode.categoryId);
  nodes = nodes.filter((node) => node.id !== id);

  if (totalCount <= visibleCount) return;

  const remaining = totalCount - visibleCount;
  const lastPost = postsForCategory(catNode.categoryId)[visibleCount - 1];
  const parentId = lastPost?.id || catNode.id;

  nodes.push({
    id,
    categoryId: catNode.categoryId,
    title: `더보기 · ${remaining}`,
    remaining,
    x: catNode.x,
    y: catNode.y,
    targetX: catNode.x,
    targetY: catNode.y + 90 + visibleCount * 85,
    parentId,
    isMoreNode: true,
    isCategoryNode: false,
    isRootNode: false,
    alpha: 0,
  });
}

function showCategoryPosts(catNode, fromIndex = 0) {
  const all = postsForCategory(catNode.categoryId);
  const limit = Math.min(catNode.visibleLimit, all.length);
  const visible = all.slice(0, limit);

  for (let index = fromIndex; index < visible.length; index += 1) {
    appendPostNode(catNode, visible[index], index, visible);
  }

  visible.forEach((post, index) => {
    const node = nodes.find((item) => item.id === post.id);
    if (!node) return;
    node.parentId = index === 0 ? catNode.id : visible[index - 1].id;
    node.targetX = catNode.x;
    node.targetY = catNode.y + 90 + index * 85;
  });

  syncMoreNode(catNode, limit, all.length);
  updateNodeCount();
}

function toggleCategory(catNode) {
  catNode.expanded = !catNode.expanded;

  if (catNode.expanded) {
    catNode.visibleLimit = PAGE_SIZE;
    showCategoryPosts(catNode, 0);
  } else {
    nodes.forEach((node) => {
      if (
        node.categoryId === catNode.categoryId &&
        (node.isPostNode || node.isMoreNode)
      ) {
        node.isClosing = true;
      }
    });
    updateNodeCount();
  }
}

function loadMoreCategory(catNode) {
  const all = postsForCategory(catNode.categoryId);
  const prevLimit = catNode.visibleLimit;
  catNode.visibleLimit = Math.min(all.length, prevLimit + PAGE_SIZE);
  showCategoryPosts(catNode, prevLimit);
}

function openModal(post) {
  document.getElementById("modal-category").textContent = post.category || "POST";
  document.getElementById("modal-date").textContent = post.date || "";
  document.getElementById("modal-title").textContent = post.title || "";
  document.getElementById("modal-desc").textContent =
    post.description || "No summary available for this post.";

  const media = document.querySelector("[data-modal-media]");
  const thumb = document.getElementById("modal-thumb");
  if (post.thumbnail?.url) {
    media.hidden = false;
    thumb.src = post.thumbnail.url;
    thumb.alt = post.title || "";
  } else {
    media.hidden = true;
    thumb.removeAttribute("src");
    thumb.alt = "";
  }

  const open = document.getElementById("modal-open");
  open.dataset.slug = post.slug || "";
  bindShareLinks(post);

  const modal = document.getElementById("node-modal");
  const content = document.getElementById("modal-content");
  modal.classList.remove("hidden");
  requestAnimationFrame(() => {
    modal.classList.remove("opacity-0", "pointer-events-none");
    content.classList.remove("scale-95");
    content.classList.add("scale-100");
  });
}

function closeModal() {
  const modal = document.getElementById("node-modal");
  const content = document.getElementById("modal-content");
  modal.classList.add("opacity-0", "pointer-events-none");
  content.classList.remove("scale-100");
  content.classList.add("scale-95");
  setTimeout(() => modal.classList.add("hidden"), 300);
}

function absolutePostUrl(slug) {
  return `${location.origin}${postPath(slug)}`;
}

function bindShareLinks(post) {
  const url = absolutePostUrl(post.slug || "");
  const title = post.title || "Santamonica Boy";
  const description = post.description || post.categoryName || "";
  const imageUrl = post.thumbnail?.url || "";

  document.querySelectorAll("[data-share-kakao]").forEach((el) => {
    el.dataset.shareUrl = url;
    el.dataset.shareTitle = title;
    el.dataset.shareDescription = description;
    el.dataset.shareImage = imageUrl;
  });
  document.querySelectorAll("[data-share-copy]").forEach((el) => {
    el.dataset.copyUrl = url;
    el.classList.remove("is-copied");
    el.setAttribute("aria-label", "링크 복사");
    el.title = "링크 복사";
  });
}

async function shareToKakao(button) {
  const url = button?.dataset.shareUrl;
  if (!url) return;
  const title = button.dataset.shareTitle || "Santamonica Boy";
  const description = button.dataset.shareDescription || "";
  const imageUrl = button.dataset.shareImage || "";

  if (window.Kakao?.isInitialized?.() && window.Kakao?.Share) {
    window.Kakao.Share.sendDefault({
      objectType: "feed",
      content: {
        title,
        description,
        imageUrl: imageUrl || `${location.origin}/favicon.svg`,
        link: {
          mobileWebUrl: url,
          webUrl: url,
        },
      },
      buttons: [
        {
          title: "글 보기",
          link: {
            mobileWebUrl: url,
            webUrl: url,
          },
        },
      ],
    });
    return;
  }

  if (navigator.share) {
    try {
      await navigator.share({ title, text: description, url });
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }

  try {
    await navigator.clipboard.writeText(`${title}\n${url}`);
    button.classList.add("is-copied");
    button.title = "링크 복사됨 · 카카오톡에 붙여넣기";
    window.setTimeout(() => {
      button.classList.remove("is-copied");
      button.title = "카카오톡 공유";
    }, 1600);
  } catch (error) {
    console.error(error);
  }
}

async function copyShareLink(button) {
  const url = button?.dataset.copyUrl;
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    button.classList.add("is-copied");
    button.setAttribute("aria-label", "복사됨");
    button.title = "복사됨";
    window.setTimeout(() => {
      button.classList.remove("is-copied");
      button.setAttribute("aria-label", "링크 복사");
      button.title = "링크 복사";
    }, 1400);
  } catch (error) {
    console.error(error);
  }
}

function resetDetailContent() {
  if (detailStatus) {
    detailStatus.hidden = false;
    detailStatus.textContent = "Loading…";
    detailStatus.classList.remove("is-ready");
  }
  if (detailArticle) {
    detailArticle.hidden = true;
    detailArticle.classList.remove("is-ready");
  }
  if (detailBody) detailBody.innerHTML = "";
  if (detailThumb) {
    detailThumb.hidden = true;
    detailThumb.removeAttribute("src");
  }
}

function closeDetailPanel() {
  detailRequestId += 1;
  activeDetailSlug = "";
  workspace?.classList.remove("is-split");
  if (detailPanel) detailPanel.setAttribute("aria-hidden", "true");
  window.setTimeout(() => {
    if (!workspace?.classList.contains("is-split")) resetDetailContent();
  }, 720);
}

async function openDetailPanel(slug) {
  if (!slug || !workspace || !detailPanel) return;

  closeModal();
  activeDetailSlug = slug;
  const requestId = ++detailRequestId;
  const alreadySplit = workspace.classList.contains("is-split");

  workspace.classList.add("is-split");
  detailPanel.setAttribute("aria-hidden", "false");
  resetDetailContent();

  try {
    const post = await getPublishedPostBySlug(slug);
    if (requestId !== detailRequestId) return;

    if (!post) {
      if (detailStatus) detailStatus.textContent = "Post not found.";
      return;
    }

    if (detailStatus) detailStatus.hidden = true;
    if (detailCategory) detailCategory.textContent = post.categoryName || "Posts";
    if (detailDate) detailDate.textContent = post.publishedAt || "";
    if (detailTitle) detailTitle.textContent = post.title || "";
    if (detailThumb) {
      if (post.thumbnail?.url) {
        detailThumb.hidden = false;
        detailThumb.src = post.thumbnail.url;
        detailThumb.alt = post.title || "";
      } else {
        detailThumb.hidden = true;
        detailThumb.removeAttribute("src");
      }
    }
    if (detailBody) detailBody.innerHTML = renderMarkdown(post.body);
    bindShareLinks(post);
    if (detailArticle) {
      detailArticle.hidden = false;
      detailArticle.classList.remove("is-ready");
      const reveal = () => detailArticle.classList.add("is-ready");
      if (alreadySplit) requestAnimationFrame(reveal);
      else window.setTimeout(reveal, 220);
    }
    detailPanel.querySelector(".detail-panel-scroll")?.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    console.error(error);
    if (requestId !== detailRequestId) return;
    if (detailStatus) detailStatus.textContent = "Couldn't load this post.";
  }
}

function resetView() {
  closeModal();
  if (workspace?.classList.contains("is-split")) closeDetailPanel();
  targetCameraX = 0;
  targetCameraY = 0;
  targetZoom = 1;
  cameraX = 0;
  cameraY = 0;
  zoom = 1;
  buildBaseNodes();
}

function worldFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left - width / 2) / zoom + cameraX,
    y: (event.clientY - rect.top - height / 2) / zoom + cameraY,
  };
}

function hitTest(x, y) {
  return nodes.find((node) => Math.hypot(node.x - x, node.y - y) < 30);
}

window.addEventListener("resize", resizeCanvas);

canvas.addEventListener("mousedown", (event) => {
  const point = worldFromEvent(event);
  hasMoved = false;
  const clicked = hitTest(point.x, point.y);
  if (clicked) draggedNode = clicked;
  else isDragging = true;
  startX = event.clientX;
  startY = event.clientY;
});

window.addEventListener("mousemove", (event) => {
  const point = worldFromEvent(event);
  if (Math.abs(event.clientX - startX) > 3 || Math.abs(event.clientY - startY) > 3) hasMoved = true;

  if (draggedNode) {
    draggedNode.x = point.x;
    draggedNode.targetX = point.x;
    draggedNode.y = point.y;
    draggedNode.targetY = point.y;
  } else if (isDragging) {
    targetCameraX -= (event.clientX - startX) / zoom;
    targetCameraY -= (event.clientY - startY) / zoom;
    startX = event.clientX;
    startY = event.clientY;
  } else {
    hoveredNode = null;
    nodes.forEach((node) => {
      if (Math.hypot(node.x - point.x, node.y - point.y) < 40) hoveredNode = node;
    });
    canvas.style.cursor = hoveredNode ? "pointer" : isDragging ? "grabbing" : "grab";
  }
});

window.addEventListener("mouseup", () => {
  draggedNode = null;
  isDragging = false;
});

canvas.addEventListener("click", (event) => {
  if (hasMoved) return;
  const point = worldFromEvent(event);
  const clicked = hitTest(point.x, point.y);
  if (!clicked) return;
  if (clicked.href) {
    location.assign(clicked.href);
    return;
  }
  if (clicked.isCategoryNode) {
    toggleCategory(clicked);
  } else if (clicked.isMoreNode) {
    const catNode = nodes.find(
      (node) => node.isCategoryNode && node.categoryId === clicked.categoryId,
    );
    if (catNode) loadMoreCategory(catNode);
  } else if (!clicked.isMenuNode && !clicked.isRootNode) {
    openModal(clicked);
  }
});

canvas.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    const next = targetZoom * (event.deltaY > 0 ? 0.92 : 1.08);
    targetZoom = Math.min(2.2, Math.max(0.55, next));
  },
  { passive: false },
);

document.querySelector("[data-reset-view]")?.addEventListener("click", resetView);
document.querySelector("[data-close-modal]")?.addEventListener("click", closeModal);
document.querySelector("[data-close-detail]")?.addEventListener("click", closeDetailPanel);
document.querySelectorAll("[data-share-copy]").forEach((button) => {
  button.addEventListener("click", () => copyShareLink(button));
});
document.querySelectorAll("[data-share-kakao]").forEach((button) => {
  button.addEventListener("click", () => shareToKakao(button));
});
document.getElementById("modal-open")?.addEventListener("click", () => {
  const slug = document.getElementById("modal-open")?.dataset.slug;
  if (slug) openDetailPanel(slug);
});
document.getElementById("node-modal")?.addEventListener("click", (event) => {
  if (event.target.id === "node-modal") closeModal();
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  const modal = document.getElementById("node-modal");
  if (modal && !modal.classList.contains("hidden")) {
    closeModal();
    return;
  }
  if (workspace?.classList.contains("is-split")) closeDetailPanel();
});

function animate() {
  cameraX += (targetCameraX - cameraX) * 0.1;
  cameraY += (targetCameraY - cameraY) * 0.1;
  zoom += (targetZoom - zoom) * 0.1;

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-cameraX, -cameraY);

  const root = nodes.find((node) => node.isPostsRoot || node.isRootNode);

  nodes.forEach((node) => {
    if (node.isCategoryNode && root) {
      if (draggedNode === node) {
        node.offsetX = node.x - root.x;
        node.offsetY = node.y - root.y;
        node.targetX = node.x;
        node.targetY = node.y;
      } else {
        node.targetX = root.x + (node.offsetX ?? 0);
        node.targetY = root.y + (node.offsetY ?? 0);
      }
    } else if (node.parentId && !node.isMenuNode && !node.isRootNode && !node.isClosing) {
      const parent = nodes.find((item) => item.id === node.parentId);
      if (parent) {
        node.targetX = parent.x;
        node.targetY = parent.y + 85;
      }
    }

    if (draggedNode !== node) {
      node.x += (node.targetX - node.x) * 0.12;
      node.y += (node.targetY - node.y) * 0.12;
    } else {
      node.targetX = node.x;
      node.targetY = node.y;
    }
    if (node.alpha === undefined) node.alpha = 1;
    if (node.isClosing) node.alpha -= 0.1;
    else if (node.alpha < 1) node.alpha += 0.1;
  });

  nodes = nodes.filter((node) => !node.isClosing || node.alpha > 0.05);

  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(2, 132, 199, 0.25)";
  nodes.forEach((child) => {
    if (!child.parentId || child.alpha <= 0.05) return;
    const parent = nodes.find((item) => item.id === child.parentId);
    if (!parent) return;
    ctx.save();
    ctx.globalAlpha = Math.min(parent.alpha, child.alpha);
    ctx.beginPath();
    ctx.moveTo(parent.x, parent.y);
    ctx.lineTo(child.x, child.y);
    ctx.stroke();
    ctx.restore();
  });

  nodes.forEach((node) => {
    if (node.alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = node.alpha;

    const isHovered = hoveredNode === node;
    const isMenu = node.isMenuNode || node.isRootNode;
    const radius = isHovered
      ? isMenu
        ? 18
        : node.isCategoryNode
          ? 16
          : node.isMoreNode
            ? 11
            : 12
      : isMenu
        ? 14
        : node.isCategoryNode
          ? 12
          : node.isMoreNode
            ? 8
            : 7;

    if (isHovered) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius + 12, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(2, 132, 199, 0.15)";
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = isMenu
      ? "#0f172a"
      : node.isCategoryNode
        ? "#0284c7"
        : node.isMoreNode
          ? "#38bdf8"
          : isHovered
            ? "#0284c7"
            : "#0f172a";
    ctx.fill();

    if (node.isMoreNode) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius + 3, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(2, 132, 199, 0.45)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    if (isMenu) {
      ctx.font = 'bold 14px "Space Grotesk", sans-serif';
      ctx.fillStyle = "#0f172a";
      ctx.fillText(node.title, node.x + 20, node.y + 5);
    } else if (node.isCategoryNode) {
      const label = `${node.category} [${node.postCount ?? 0}]`;
      ctx.font = 'bold 13px "Space Grotesk", sans-serif';
      ctx.fillStyle = "#0f172a";
      ctx.fillText(label, node.x + 18, node.y + 4);
    } else if (node.isMoreNode) {
      ctx.font = '12px "Space Grotesk", sans-serif';
      ctx.fillStyle = "#0284c7";
      ctx.fillText(node.title, node.x + 18, node.y + 4);
    } else {
      ctx.font = '13px "Space Grotesk", sans-serif';
      ctx.fillStyle = "#0f172a";
      ctx.fillText(node.title, node.x + 18, node.y - 2);
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = "#0284c7";
      ctx.fillText(node.date || "", node.x + 18, node.y + 14);
    }

    ctx.restore();
  });

  ctx.restore();
  requestAnimationFrame(animate);
}

try {
  const [cats, posts] = await Promise.all([listVisibleCategories(), listPublishedPosts()]);
  categories = cats;
  allPosts = posts;
  buildBaseNodes();
  if (bootStatus) bootStatus.remove();
  animate();
} catch (error) {
  console.error(error);
  if (bootStatus) bootStatus.textContent = "Couldn't load constellation.";
}

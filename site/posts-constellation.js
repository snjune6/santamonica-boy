import {
  getPublishedPostBySlug,
  listPublishedPosts,
  listVisibleCategories,
  postPath,
  renderMarkdown,
} from "./posts.js?v=4";

let canvas = null;
let ctx = null;
let bootStatus = null;
let nodeCountEl = null;
let stage = null;
let workspace = null;
let detailPanel = null;
let detailStatus = null;
let detailArticle = null;
let detailCategory = null;
let detailDate = null;
let detailTitle = null;
let detailThumb = null;
let detailBody = null;

let width = 0;
let height = 0;
let dpr = 1;
let detailRequestId = 0;
let activeDetailSlug = "";
let rafId = 0;
let running = false;
let constellationAbort = null;

function resizeCanvas() {
  if (!canvas || !ctx || !stage) return;
  const rect = stage.getBoundingClientRect();
  const nextW = Math.max(1, Math.floor(rect.width));
  const nextH = Math.max(1, Math.floor(rect.height));
  const nextDpr = Math.min(window.devicePixelRatio || 1, 3);
  if (nextW === width && nextH === height && nextDpr === dpr) return;

  width = nextW;
  height = nextH;
  dpr = nextDpr;
  canvas.width = Math.max(1, Math.floor(nextW * dpr));
  canvas.height = Math.max(1, Math.floor(nextH * dpr));
  canvas.style.width = `${nextW}px`;
  canvas.style.height = `${nextH}px`;
  // Draw in CSS pixels while backing store matches device pixels.
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

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
let activePointerId = null;
let pinchStartDistance = 0;
let pinchStartZoom = 1;

function isCompactLayout() {
  return window.matchMedia("(max-width: 900px)").matches;
}

function hitRadius() {
  return isCompactLayout() ? 38 : 30;
}

function postStep() {
  return isCompactLayout() ? 72 : 85;
}

function categoryAnchor(index, total) {
  const compact = isCompactLayout();
  if (total <= 1) return { x: 0, y: compact ? 28 : 40 };
  if (total === 2) {
    return index === 0
      ? { x: compact ? -110 : -180, y: 0 }
      : { x: compact ? 110 : 180, y: 0 };
  }
  const spread = Math.min(compact ? 280 : 520, (compact ? 100 : 160) * (total - 1));
  const start = -spread / 2;
  const step = spread / (total - 1);
  return { x: start + step * index, y: (compact ? 20 : 30) + (index % 2) * (compact ? 18 : 24) };
}

function buildBaseNodes() {
  const compact = isCompactLayout();
  const menuGap = compact ? 108 : 170;
  const rootY = compact ? -72 : -120;

  const home = {
    id: "menu-home",
    title: "Home",
    x: -menuGap,
    y: rootY + 18,
    targetX: -menuGap,
    targetY: rootY,
    isMenuNode: true,
    href: "/",
    alpha: 0,
    hoverAmount: 0,
    displayRadius: 10,
  };

  const rootX = menuGap;
  const postsRoot = {
    id: "root-posts",
    title: "Posts",
    x: rootX,
    y: rootY + 18,
    targetX: rootX,
    targetY: rootY,
    isMenuNode: true,
    isPostsRoot: true,
    isRootNode: true,
    alpha: 0,
    hoverAmount: 0,
    displayRadius: 10,
  };

  const categoryNodes = categories.map((category, index) => {
    const anchor = categoryAnchor(index, categories.length);
    const offsetX = anchor.x;
    const offsetY = anchor.y + (compact ? 90 : 120);
    const postCount = postsForCategory(category.id).length;
    return {
      id: `cat-${category.id}`,
      categoryId: category.id,
      category: category.name.toUpperCase(),
      title: category.name.toUpperCase(),
      postCount,
      visibleLimit: PAGE_SIZE,
      x: rootX + offsetX,
      y: rootY + offsetY + 24,
      targetX: rootX + offsetX,
      targetY: rootY + offsetY,
      offsetX,
      offsetY,
      parentId: "root-posts",
      isCategoryNode: true,
      expanded: false,
      alpha: 0,
      hoverAmount: 0,
      displayRadius: 8,
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
  const step = postStep();
  const targetOffsetY = (isCompactLayout() ? 72 : 90) + index * step;

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
  const step = postStep();

  nodes.push({
    id,
    categoryId: catNode.categoryId,
    title: `더보기 · ${remaining}`,
    remaining,
    x: catNode.x,
    y: catNode.y,
    targetX: catNode.x,
    targetY: catNode.y + (isCompactLayout() ? 72 : 90) + visibleCount * step,
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

  const step = postStep();
  visible.forEach((post, index) => {
    const node = nodes.find((item) => item.id === post.id);
    if (!node) return;
    node.parentId = index === 0 ? catNode.id : visible[index - 1].id;
    node.targetX = catNode.x;
    node.targetY = catNode.y + (isCompactLayout() ? 72 : 90) + index * step;
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

function defaultZoom() {
  return isCompactLayout() ? 0.82 : 1;
}

function resetView() {
  closeModal();
  if (workspace?.classList.contains("is-split")) closeDetailPanel();
  const z = defaultZoom();
  targetCameraX = 0;
  targetCameraY = 0;
  targetZoom = z;
  cameraX = 0;
  cameraY = 0;
  zoom = z;
  buildBaseNodes();
}

function clientPoint(event) {
  if (event.touches?.length) {
    return { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }
  if (event.changedTouches?.length) {
    return { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
  }
  return { x: event.clientX, y: event.clientY };
}

function worldFromClient(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left - width / 2) / zoom + cameraX,
    y: (clientY - rect.top - height / 2) / zoom + cameraY,
  };
}

function nodeLabel(node) {
  if (node.isCategoryNode) return `${node.category} [${node.postCount ?? 0}]`;
  return node.title || "";
}

function hitsNodeLabel(node, x, y) {
  const label = nodeLabel(node);
  if (!label) return false;

  if (node.isMenuNode || node.isRootNode) {
    ctx.font = 'bold 14px "Space Grotesk", sans-serif';
  } else if (node.isCategoryNode) {
    ctx.font = 'bold 13px "Space Grotesk", sans-serif';
  } else if (node.isMoreNode) {
    ctx.font = '12px "Space Grotesk", sans-serif';
  } else {
    ctx.font = '13px "Space Grotesk", sans-serif';
  }

  const isPost =
    !node.isMenuNode && !node.isRootNode && !node.isCategoryNode && !node.isMoreNode;
  const textW = Math.min(
    isCompactLayout() ? 240 : 340,
    Math.ceil(ctx.measureText(label).width) + (isPost ? 16 : 12),
  );
  const left = node.x + 12;
  const right = left + textW;
  const top = node.y - (isPost ? 18 : 14);
  const bottom = node.y + (isPost ? 24 : 14);
  return x >= left && x <= right && y >= top && y <= bottom;
}

function hitTest(x, y) {
  const radius = hitRadius();
  // Later nodes are drawn on top; prefer the front-most match.
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    const node = nodes[i];
    if (node.isClosing || (node.alpha !== undefined && node.alpha <= 0.05)) continue;
    if (Math.hypot(node.x - x, node.y - y) < radius) return node;
    if (hitsNodeLabel(node, x, y)) return node;
  }
  return null;
}

function activateNode(node) {
  if (!node) return;
  if (node.href) {
    location.assign(node.href);
    return;
  }
  if (node.isCategoryNode) {
    toggleCategory(node);
  } else if (node.isMoreNode) {
    const catNode = nodes.find(
      (item) => item.isCategoryNode && item.categoryId === node.categoryId,
    );
    if (catNode) loadMoreCategory(catNode);
  } else if (!node.isMenuNode && !node.isRootNode) {
    openModal(node);
  }
}

function pinchDistance(touches) {
  const [a, b] = touches;
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function onPointerDown(event) {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  if (typeof event.pointerId === "number") {
    activePointerId = event.pointerId;
    canvas.setPointerCapture?.(event.pointerId);
  }
  const { x: clientX, y: clientY } = clientPoint(event);
  const point = worldFromClient(clientX, clientY);
  hasMoved = false;
  const clicked = hitTest(point.x, point.y);
  if (clicked) draggedNode = clicked;
  else isDragging = true;
  startX = clientX;
  startY = clientY;
}

function onPointerMove(event) {
  if (activePointerId !== null && event.pointerId !== activePointerId) return;
  const { x: clientX, y: clientY } = clientPoint(event);
  const point = worldFromClient(clientX, clientY);
  if (Math.abs(clientX - startX) > 4 || Math.abs(clientY - startY) > 4) hasMoved = true;

  if (draggedNode) {
    draggedNode.x = point.x;
    draggedNode.targetX = point.x;
    draggedNode.y = point.y;
    draggedNode.targetY = point.y;
  } else if (isDragging) {
    targetCameraX -= (clientX - startX) / zoom;
    targetCameraY -= (clientY - startY) / zoom;
    startX = clientX;
    startY = clientY;
  } else if (event.pointerType !== "touch") {
    hoveredNode = hitTest(point.x, point.y);
    canvas.style.cursor = hoveredNode ? "pointer" : "grab";
  }
}

function onPointerUp(event) {
  if (activePointerId !== null && event.pointerId !== activePointerId) return;
  const shouldActivate = !hasMoved;
  const { x: clientX, y: clientY } = clientPoint(event);
  const point = worldFromClient(clientX, clientY);
  const clicked = hitTest(point.x, point.y);
  draggedNode = null;
  isDragging = false;
  activePointerId = null;
  if (shouldActivate) activateNode(clicked);
}

function onTouchStart(event) {
  if (event.touches.length === 2) {
    event.preventDefault();
    draggedNode = null;
    isDragging = false;
    pinchStartDistance = pinchDistance(event.touches);
    pinchStartZoom = targetZoom;
  }
}

function onTouchMove(event) {
  if (event.touches.length === 2 && pinchStartDistance > 0) {
    event.preventDefault();
    const scale = pinchDistance(event.touches) / pinchStartDistance;
    targetZoom = Math.min(2.2, Math.max(0.5, pinchStartZoom * scale));
  }
}

function onTouchEnd(event) {
  if (event.touches.length < 2) pinchStartDistance = 0;
}

function onWheel(event) {
  event.preventDefault();
  const next = targetZoom * (event.deltaY > 0 ? 0.92 : 1.08);
  targetZoom = Math.min(2.2, Math.max(0.5, next));
}

function onEscapeKey(event) {
  if (event.key !== "Escape") return;
  const modal = document.getElementById("node-modal");
  if (modal && !modal.classList.contains("hidden")) {
    closeModal();
    return;
  }
  if (workspace?.classList.contains("is-split")) closeDetailPanel();
}

function onModalBackdrop(event) {
  if (event.target.id === "node-modal") closeModal();
}

function onModalOpenClick() {
  const slug = document.getElementById("modal-open")?.dataset.slug;
  if (slug) openDetailPanel(slug);
}

function bindConstellationEvents(signal) {
  window.addEventListener("resize", resizeCanvas, { signal });
  canvas.addEventListener("pointerdown", onPointerDown, { signal });
  window.addEventListener("pointermove", onPointerMove, { signal });
  window.addEventListener("pointerup", onPointerUp, { signal });
  window.addEventListener("pointercancel", onPointerUp, { signal });
  canvas.addEventListener("touchstart", onTouchStart, { passive: false, signal });
  canvas.addEventListener("touchmove", onTouchMove, { passive: false, signal });
  canvas.addEventListener("touchend", onTouchEnd, { passive: true, signal });
  canvas.addEventListener("wheel", onWheel, { passive: false, signal });
  document.querySelector("[data-reset-view]")?.addEventListener("click", resetView, { signal });
  document.querySelector("[data-close-modal]")?.addEventListener("click", closeModal, { signal });
  document.querySelector("[data-close-detail]")?.addEventListener("click", closeDetailPanel, {
    signal,
  });
  document.querySelectorAll("[data-share-copy]").forEach((button) => {
    button.addEventListener("click", () => copyShareLink(button), { signal });
  });
  document.querySelectorAll("[data-share-kakao]").forEach((button) => {
    button.addEventListener("click", () => shareToKakao(button), { signal });
  });
  document.getElementById("modal-open")?.addEventListener("click", onModalOpenClick, { signal });
  document.getElementById("node-modal")?.addEventListener("click", onModalBackdrop, { signal });
  document.addEventListener("keydown", onEscapeKey, { signal });
}

function lerp(from, to, amount) {
  return from + (to - from) * amount;
}

function baseRadius(node) {
  if (node.isMenuNode || node.isRootNode) return 14;
  if (node.isCategoryNode) return 12;
  if (node.isMoreNode) return 8;
  return 7;
}

function hoverRadius(node) {
  if (node.isMenuNode || node.isRootNode) return 18;
  if (node.isCategoryNode) return 16;
  if (node.isMoreNode) return 11;
  return 12;
}

function nodeFill(node, hoverAmount) {
  if (node.isMenuNode || node.isRootNode) return "#0f172a";
  if (node.isCategoryNode) return "#0284c7";
  if (node.isMoreNode) return "#38bdf8";
  return hoverAmount > 0.45 ? "#0284c7" : "#0f172a";
}

function drawSoftDot(x, y, radius, color, glowStrength) {
  if (glowStrength > 0.01) {
    const glow = ctx.createRadialGradient(x, y, radius * 0.2, x, y, radius + 16);
    glow.addColorStop(0, "rgba(2, 132, 199, 0.22)");
    glow.addColorStop(0.45, "rgba(2, 132, 199, 0.1)");
    glow.addColorStop(1, "rgba(2, 132, 199, 0)");
    ctx.beginPath();
    ctx.fillStyle = glow;
    ctx.arc(x, y, radius + 16 * glowStrength, 0, Math.PI * 2);
    ctx.fill();
  }

  const body = ctx.createRadialGradient(
    x - radius * 0.28,
    y - radius * 0.32,
    radius * 0.08,
    x,
    y,
    radius,
  );
  body.addColorStop(0, "#ffffff");
  body.addColorStop(0.22, color);
  body.addColorStop(1, color);
  ctx.beginPath();
  ctx.fillStyle = body;
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function animate() {
  if (!running || !ctx) return;
  const now = performance.now();
  cameraX = lerp(cameraX, targetCameraX, 0.055);
  cameraY = lerp(cameraY, targetCameraY, 0.055);
  zoom = lerp(zoom, targetZoom, 0.06);

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-cameraX, -cameraY);

  const root = nodes.find((node) => node.isPostsRoot || node.isRootNode);

  nodes.forEach((node, index) => {
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
        node.targetY = parent.y + postStep();
      }
    }

    if (draggedNode !== node) {
      node.x = lerp(node.x, node.targetX, 0.07);
      node.y = lerp(node.y, node.targetY, 0.07);
    } else {
      node.targetX = node.x;
      node.targetY = node.y;
    }

    if (node.alpha === undefined) node.alpha = 1;
    if (node.isClosing) node.alpha = Math.max(0, node.alpha - 0.035);
    else if (node.alpha < 1) {
      if (node.bornAt == null) node.bornAt = now;
      const delay = (node.anchorIndex ?? (node.isMenuNode ? 0 : 1)) * 70;
      if (now - node.bornAt >= delay) node.alpha = Math.min(1, node.alpha + 0.04);
    }

    const wantHover = hoveredNode === node ? 1 : 0;
    node.hoverAmount = lerp(node.hoverAmount ?? 0, wantHover, 0.14);
    const targetR = lerp(baseRadius(node), hoverRadius(node), node.hoverAmount);
    node.displayRadius = lerp(node.displayRadius ?? targetR, targetR, 0.16);

    // Soft idle drift so resting nodes feel alive, not frozen.
    if (draggedNode !== node && !node.isClosing) {
      const phase = (node.driftPhase ?? index * 0.85) + now * 0.0007;
      node.driftPhase = node.driftPhase ?? index * 0.85;
      node.renderX = node.x + Math.sin(phase) * (0.55 + node.hoverAmount * 0.35);
      node.renderY = node.y + Math.cos(phase * 0.9) * (0.45 + node.hoverAmount * 0.25);
    } else {
      node.renderX = node.x;
      node.renderY = node.y;
    }
  });

  nodes = nodes.filter((node) => !node.isClosing || node.alpha > 0.04);

  nodes.forEach((child) => {
    if (!child.parentId || child.alpha <= 0.04) return;
    const parent = nodes.find((item) => item.id === child.parentId);
    if (!parent) return;
    const x1 = parent.renderX ?? parent.x;
    const y1 = parent.renderY ?? parent.y;
    const x2 = child.renderX ?? child.x;
    const y2 = child.renderY ?? child.y;
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2 + (x2 >= x1 ? -10 : 10);
    ctx.save();
    ctx.globalAlpha = Math.min(parent.alpha, child.alpha) * 0.9;
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = "rgba(2, 132, 199, 0.22)";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(mx, my, x2, y2);
    ctx.stroke();
    ctx.restore();
  });

  nodes.forEach((node) => {
    if (node.alpha <= 0) return;
    const x = node.renderX ?? node.x;
    const y = node.renderY ?? node.y;
    const radius = node.displayRadius ?? baseRadius(node);
    const hoverAmount = node.hoverAmount ?? 0;

    ctx.save();
    ctx.globalAlpha = node.alpha;
    ctx.textBaseline = "middle";

    drawSoftDot(x, y, radius, nodeFill(node, hoverAmount), hoverAmount);

    if (node.isMoreNode) {
      ctx.beginPath();
      ctx.arc(x, y, radius + 3.5, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(2, 132, 199, ${0.28 + hoverAmount * 0.25})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    const labelX = x + 18 + hoverAmount * 2;
    if (node.isMenuNode || node.isRootNode) {
      ctx.font = 'bold 14px "Space Grotesk", sans-serif';
      ctx.fillStyle = "#0f172a";
      ctx.fillText(node.title, labelX, y);
    } else if (node.isCategoryNode) {
      const label = `${node.category} [${node.postCount ?? 0}]`;
      ctx.font = 'bold 13px "Space Grotesk", sans-serif';
      ctx.fillStyle = "#0f172a";
      ctx.fillText(label, labelX, y);
    } else if (node.isMoreNode) {
      ctx.font = '12px "Space Grotesk", sans-serif';
      ctx.fillStyle = "#0284c7";
      ctx.fillText(node.title, labelX, y);
    } else {
      ctx.font = '13px "Space Grotesk", sans-serif';
      ctx.fillStyle = "#0f172a";
      ctx.fillText(node.title, labelX, y - 7);
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = "#0284c7";
      ctx.fillText(node.date || "", labelX, y + 9);
    }

    ctx.restore();
  });

  ctx.restore();
  rafId = requestAnimationFrame(animate);
}

export async function mountConstellation() {
  constellationAbort?.abort();
  if (rafId) cancelAnimationFrame(rafId);
  running = false;

  canvas = document.getElementById("constellationCanvas");
  if (!canvas) return () => {};

  ctx = canvas.getContext("2d");
  bootStatus = document.getElementById("boot-status");
  nodeCountEl = document.getElementById("node-count");
  stage = document.querySelector(".constellation-stage") || canvas.parentElement;
  workspace = document.querySelector("[data-workspace]");
  detailPanel = document.querySelector("[data-detail-panel]");
  detailStatus = document.querySelector("[data-detail-status]");
  detailArticle = document.querySelector("[data-detail-article]");
  detailCategory = document.querySelector("[data-detail-category]");
  detailDate = document.querySelector("[data-detail-date]");
  detailTitle = document.querySelector("[data-detail-title]");
  detailThumb = document.querySelector("[data-detail-thumb]");
  detailBody = document.querySelector("[data-detail-body]");

  width = 0;
  height = 0;
  dpr = 1;
  detailRequestId = 0;
  activeDetailSlug = "";
  allPosts = [];
  categories = [];
  nodes = [];
  cameraX = 0;
  cameraY = 0;
  targetCameraX = 0;
  targetCameraY = 0;
  zoom = 1;
  targetZoom = 1;
  isDragging = false;
  hoveredNode = null;
  draggedNode = null;
  hasMoved = false;
  activePointerId = null;
  pinchStartDistance = 0;

  constellationAbort = new AbortController();
  const { signal } = constellationAbort;
  resizeCanvas();
  bindConstellationEvents(signal);

  try {
    const [cats, posts] = await Promise.all([listVisibleCategories(), listPublishedPosts()]);
    if (signal.aborted) return () => {};
    categories = cats;
    allPosts = posts;
    const z = defaultZoom();
    zoom = z;
    targetZoom = z;
    buildBaseNodes();
    if (bootStatus) bootStatus.remove();
    running = true;
    rafId = requestAnimationFrame(animate);
  } catch (error) {
    console.error(error);
    if (bootStatus) bootStatus.textContent = "Couldn't load constellation.";
  }

  return () => {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    constellationAbort?.abort();
    constellationAbort = null;
    closeDetailPanel?.();
    canvas = null;
    ctx = null;
  };
}

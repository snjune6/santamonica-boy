import Swup from "https://esm.sh/swup@4.6.1";
import SwupHeadPlugin from "https://esm.sh/@swup/head-plugin@2.3.1";
import SwupBodyClassPlugin from "https://esm.sh/@swup/body-class-plugin@3.3.0";
import SwupPreloadPlugin from "https://esm.sh/@swup/preload-plugin@3.2.10";
import SwupFadeTheme from "https://esm.sh/@swup/fade-theme@2.0.1";

let pageCleanup = () => {};
let mountGeneration = 0;

function pathOf(url = location.href) {
  try {
    return new URL(url, location.origin).pathname.replace(/\/+$/, "") || "/";
  } catch {
    return "/";
  }
}

async function mountPage() {
  const generation = ++mountGeneration;
  pageCleanup();
  pageCleanup = () => {};

  const path = pathOf();
  const cleanups = [];

  const { mountSharedChrome, mountHomePage } = await import("./app.js?v=5");
  if (generation !== mountGeneration) return;

  cleanups.push(mountSharedChrome() || (() => {}));

  if (path === "/") {
    cleanups.push(mountHomePage() || (() => {}));
  } else if (path === "/posts") {
    const { mountConstellation } = await import("./posts-constellation.js?v=15");
    if (generation !== mountGeneration) return;
    cleanups.push((await mountConstellation()) || (() => {}));
  } else if (path.startsWith("/posts/")) {
    const { mountPostDetail } = await import("./post-detail.js?v=4");
    if (generation !== mountGeneration) return;
    cleanups.push((await mountPostDetail()) || (() => {}));
  }

  if (generation !== mountGeneration) {
    while (cleanups.length) {
      try {
        cleanups.pop()();
      } catch {
        /* ignore stale cleanup */
      }
    }
    return;
  }

  if (typeof window.__refreshSampleNav === "function") {
    window.__refreshSampleNav();
  }

  pageCleanup = () => {
    while (cleanups.length) {
      try {
        cleanups.pop()();
      } catch (error) {
        console.warn("Page cleanup failed:", error);
      }
    }
  };
}

const swup = new Swup({
  containers: ["#swup"],
  animateHistoryBrowsing: true,
  plugins: [
    new SwupHeadPlugin({
      persistAssets: true,
      awaitAssets: true,
    }),
    new SwupBodyClassPlugin(),
    new SwupPreloadPlugin(),
    new SwupFadeTheme(),
  ],
});

swup.hooks.on("visit:start", () => {
  pageCleanup();
  pageCleanup = () => {};
});

swup.hooks.on("page:view", () => {
  mountPage().catch((error) => console.error("Failed to mount page:", error));
});

mountPage().catch((error) => console.error("Failed to mount page:", error));

window.__swup = swup;

(function setupSampleNav() {
  if (document.querySelector("[data-sample-nav]")) return;

  const path = window.location.pathname.replace(/\/$/, "") || "/";
  const designChildren = [
    { href: "/sample/main", label: "메인" },
    { href: "/sample/subpage", label: "서브페이지" },
    { href: "/sample/board", label: "게시판" },
    { href: "/sample/etc", label: "기타" },
  ];
  const isDesignPath = path === "/sample" || path.startsWith("/sample/");

  const root = document.createElement("div");
  root.className = "sample-float";
  root.setAttribute("data-sample-nav", "");

  const panel = document.createElement("nav");
  panel.className = "sample-float-panel";
  panel.id = "sample-float-panel";
  panel.setAttribute("aria-label", "공통 메뉴");
  panel.hidden = true;

  const list = document.createElement("ul");
  list.className = "sample-float-list";

  const homeItem = document.createElement("li");
  const homeLink = document.createElement("a");
  homeLink.href = "/";
  homeLink.textContent = "Home";
  if (path === "/") homeLink.setAttribute("aria-current", "page");
  homeItem.appendChild(homeLink);
  list.appendChild(homeItem);

  const designItem = document.createElement("li");
  designItem.className = "sample-float-group";

  const designToggle = document.createElement("button");
  designToggle.className = "sample-float-parent";
  designToggle.type = "button";
  designToggle.textContent = "Design";
  designToggle.setAttribute("aria-expanded", "false");
  designToggle.setAttribute("aria-controls", "sample-float-design-sub");
  if (isDesignPath) designToggle.classList.add("is-parent-active");

  const childWrap = document.createElement("div");
  childWrap.className = "sample-float-subwrap";

  const childList = document.createElement("ul");
  childList.className = "sample-float-sublist";
  childList.id = "sample-float-design-sub";

  designChildren.forEach((item) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = item.href;
    a.textContent = item.label;
    const itemPath = item.href.replace(/\/$/, "") || "/";
    if (itemPath === path) a.setAttribute("aria-current", "page");
    li.appendChild(a);
    childList.appendChild(li);
  });
  childWrap.appendChild(childList);

  const setDesignOpen = (open) => {
    designItem.classList.toggle("is-expanded", open);
    designToggle.setAttribute("aria-expanded", open ? "true" : "false");
  };

  designToggle.addEventListener("click", () => {
    setDesignOpen(!designItem.classList.contains("is-expanded"));
  });

  designItem.appendChild(designToggle);
  designItem.appendChild(childWrap);
  list.appendChild(designItem);
  panel.appendChild(list);

  const button = document.createElement("button");
  button.className = "sample-float-toggle";
  button.type = "button";
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-controls", "sample-float-panel");
  button.setAttribute("aria-label", "공통 메뉴 열기");
  button.innerHTML =
    '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">' +
    '<path d="M4 7h16v2H4zm0 4h16v2H4zm0 4h16v2H4z" fill="currentColor"/>' +
    "</svg>";

  const setOpen = (open) => {
    root.classList.toggle("is-open", open);
    panel.hidden = !open;
    button.setAttribute("aria-expanded", open ? "true" : "false");
    button.setAttribute("aria-label", open ? "공통 메뉴 닫기" : "공통 메뉴 열기");
    if (open && isDesignPath) setDesignOpen(true);
    if (!open) setDesignOpen(false);
  };

  button.addEventListener("click", () => {
    setOpen(!root.classList.contains("is-open"));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && root.classList.contains("is-open")) {
      setOpen(false);
      button.focus();
    }
  });

  document.addEventListener("click", (event) => {
    if (!root.classList.contains("is-open")) return;
    if (!root.contains(event.target)) setOpen(false);
  });

  root.appendChild(panel);
  root.appendChild(button);
  document.body.appendChild(root);
})();

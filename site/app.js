import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getAnalytics,
  isSupported,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-analytics.js";
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  getStorage,
  ref,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-storage.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  serverTimestamp,
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

const INSTALLER_PATH = "downloads/AutoCation-Setup.exe";
// FormSubmit form id (hides the inbox address in client code)
const CONTACT_FORM_ID = "a26d0d3ae0d2ffd5377fe997d3e82282";
// Hidden field only bots fill; never stored in Firestore (inquiries rules use hasOnly)
const HONEYPOT_FIELD = "hp_ref";
const INQUIRY_TYPES = new Set([
  "New project",
  "Maintenance",
  "Defect repair",
  "Other design",
]);

const app = initializeApp(firebaseConfig);

// GA4 (measurementId G-FCRLEMKTZK). Browsers with analytics storage blocked
// report unsupported, so skip quietly instead of breaking the page.
isSupported()
  .then((supported) => {
    if (supported) getAnalytics(app);
  })
  .catch((error) => console.warn("Analytics unavailable:", error));

const auth = getAuth(app);
const storage = getStorage(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

const ADMIN_PAGE_ROLE = "관리자";

let downloadUrl = null;
let authListenerBound = false;
let showcaseDelegationBound = false;
let sharedAbort = null;
let homeAbort = null;

function downloadButton() {
  return document.querySelector("[data-download]");
}
function authButton() {
  return document.querySelector("[data-auth]");
}
function authStatus() {
  return document.querySelector("[data-auth-status]");
}
function adminLink() {
  return document.querySelector("[data-admin]");
}
function contactForm() {
  return document.querySelector("[data-contact-form]");
}
function contactStatus() {
  return document.querySelector("[data-contact-status]");
}

function setDownloadDisabled(message) {
  const button = downloadButton();
  if (!button) return;
  button.disabled = true;
  button.classList.remove("is-ready", "is-signin");
  button.removeAttribute("aria-busy");
  button.title = message;
}

function setDownloadNeedsSignIn() {
  const button = downloadButton();
  if (!button) return;
  button.disabled = false;
  button.classList.remove("is-ready");
  button.classList.add("is-signin");
  button.removeAttribute("aria-busy");
  button.title = "Sign in to download AutoCation";
}

function setDownloadReady(url) {
  const button = downloadButton();
  if (!button) return;
  downloadUrl = url;
  button.disabled = false;
  button.classList.remove("is-signin");
  button.classList.add("is-ready");
  button.removeAttribute("aria-busy");
  button.title = "Download AutoCation";
}

async function resolveInstallerUrl() {
  return getDownloadURL(ref(storage, INSTALLER_PATH));
}

async function signIn() {
  await signInWithPopup(auth, googleProvider);
}

async function rememberFirstLogin(user) {
  const userRef = doc(db, "users", user.uid);
  const existing = await getDoc(userRef);
  if (existing.exists()) {
    if (existing.get("role") == null) await updateDoc(userRef, { role: 1 });
    return;
  }
  await setDoc(userRef, {
    email: user.email || "",
    displayName: user.displayName || "",
    role: 1,
    AutoCaption: { autoCaption: 0 },
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  });
}

async function handleDownloadClick() {
  if (!auth.currentUser) {
    try {
      await signIn();
    } catch (error) {
      console.warn("Sign-in canceled or failed:", error);
    }
    return;
  }

  if (!downloadUrl) return;
  window.location.assign(downloadUrl);
}

async function refreshDownloadState(user) {
  const button = downloadButton();
  if (!button) return;

  downloadUrl = null;
  button.setAttribute("aria-busy", "true");
  button.title = "Checking download…";

  if (!user) {
    setDownloadNeedsSignIn();
    return;
  }

  try {
    const url = await resolveInstallerUrl();
    setDownloadReady(url);
  } catch (error) {
    setDownloadDisabled("Installer is not available yet.");
    console.warn("Installer not available yet:", INSTALLER_PATH, error);
  }
}

function roleNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

async function adminRoleCode() {
  const snapshot = await getDoc(doc(db, "commonCodes", "role"));
  const codes = snapshot.data() || {};
  for (const [key, name] of Object.entries(codes)) {
    if (name === ADMIN_PAGE_ROLE) return roleNumber(key) ?? 10;
  }
  return 10;
}

async function signedInUserIsAdmin(user) {
  const [adminCode, userDoc] = await Promise.all([
    adminRoleCode(),
    getDoc(doc(db, "users", user.uid)),
  ]);
  return roleNumber(userDoc.get("role")) === adminCode;
}

function setAdminLink(visible) {
  const link = adminLink();
  if (!link) return;
  link.hidden = !visible;
}

function updateAuthUi(user) {
  const button = authButton();
  const status = authStatus();
  if (!button || !status) return;

  if (user) {
    status.textContent = user.email || "Signed in";
    status.hidden = false;
    button.textContent = "Sign out";
    button.dataset.mode = "out";
  } else {
    status.textContent = "";
    status.hidden = true;
    button.textContent = "Sign in";
    button.dataset.mode = "in";
    setAdminLink(false);
  }
}

function setContactMessage(message, state = "") {
  const status = contactStatus();
  if (!status) return;
  status.textContent = message;
  status.classList.remove("is-error", "is-success");
  if (state) status.classList.add(state);
}

function finishContactForm() {
  const form = contactForm();
  if (!form) return;
  form.reset();
  const defaultType = form.querySelector('input[name="type"][value="New project"]');
  if (defaultType) defaultType.checked = true;
  setContactMessage("Thanks. Your inquiry was received.", "is-success");
}

function ensureAuthListener() {
  if (authListenerBound) return;
  authListenerBound = true;
  onAuthStateChanged(auth, (user) => {
    updateAuthUi(user);
    refreshDownloadState(user);
    setAdminLink(false);
    if (!user) return;
    rememberFirstLogin(user)
      .catch((error) => {
        console.warn("Could not save the first login:", error);
      })
      .then(() => signedInUserIsAdmin(user))
      .then((isAdmin) => {
        if (auth.currentUser?.uid === user.uid) setAdminLink(isAdmin);
      })
      .catch((error) => {
        console.warn("Could not check the admin role:", error);
      });
  });
}

function setShowcaseOpenState(open) {
  document.querySelector("#showcase")?.classList.toggle("is-dialog-open", open);
  document.documentElement.classList.toggle("is-scroll-locked", open);
}

function openShowcaseDialog() {
  const dialog = document.querySelector("[data-showcase-dialog]");
  if (!dialog || typeof dialog.showModal !== "function") return false;
  if (!dialog.open) dialog.showModal();
  setShowcaseOpenState(true);
  return true;
}

function closeShowcaseDialog() {
  const dialog = document.querySelector("[data-showcase-dialog]");
  if (!dialog) return;
  if (dialog.open) dialog.close();
  setShowcaseOpenState(false);
}

/** Delegated handlers survive Swarm/swup DOM swaps on the home showcase. */
function ensureShowcaseDelegation() {
  if (showcaseDelegationBound) return;
  showcaseDelegationBound = true;

  document.addEventListener(
    "click",
    (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    if (target.closest("[data-showcase-open]")) {
      event.preventDefault();
      openShowcaseDialog();
      return;
    }

    if (target.closest("[data-showcase-close]")) {
      event.preventDefault();
      closeShowcaseDialog();
      return;
    }

    const dialog = document.querySelector("[data-showcase-dialog]");
    if (dialog?.open && target === dialog) {
      closeShowcaseDialog();
    }
  },
    true,
  );

  document.addEventListener(
    "close",
    (event) => {
      const dialog = event.target;
      if (!(dialog instanceof HTMLDialogElement)) return;
      if (!dialog.matches("[data-showcase-dialog]")) return;
      setShowcaseOpenState(false);
      document.querySelector("[data-showcase-open]")?.focus();
    },
    true,
  );
}

/** Header auth controls — safe to call on every swup page. */
export function mountSharedChrome() {
  sharedAbort?.abort();
  sharedAbort = new AbortController();
  const { signal } = sharedAbort;

  const button = authButton();
  if (button) {
    button.addEventListener(
      "click",
      async () => {
        try {
          if (button.dataset.mode === "out") {
            await signOut(auth);
          } else {
            await signIn();
          }
        } catch (error) {
          console.warn("Auth action failed:", error);
        }
      },
      { signal },
    );
  }

  ensureAuthListener();
  ensureShowcaseDelegation();
  updateAuthUi(auth.currentUser);
  refreshDownloadState(auth.currentUser);
  if (auth.currentUser) {
    signedInUserIsAdmin(auth.currentUser)
      .then((isAdmin) => {
        if (auth.currentUser) setAdminLink(isAdmin);
      })
      .catch(() => {});
  }

  return () => {
    sharedAbort?.abort();
    sharedAbort = null;
  };
}

/** Home-only widgets (download, contact, reveal, to-top, showcase). */
export function mountHomePage() {
  homeAbort?.abort();
  homeAbort = new AbortController();
  const { signal } = homeAbort;

  const dl = downloadButton();
  if (dl) {
    dl.addEventListener("click", () => handleDownloadClick(), { signal });
  }
  refreshDownloadState(auth.currentUser);

  const form = contactForm();
  if (form) {
    form.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();

        const formData = new FormData(form);
        const type = String(formData.get("type") || "").trim();
        const name = String(formData.get("name") || "").trim();
        const email = String(formData.get("email") || "").trim();
        const message = String(formData.get("message") || "").trim();
        const honey = String(formData.get(HONEYPOT_FIELD) || "");

        if (honey) {
          finishContactForm();
          return;
        }

        if (!INQUIRY_TYPES.has(type) || !name || !email || !message) {
          setContactMessage("Please check your input.", "is-error");
          return;
        }

        const submitButton = form.querySelector('button[type="submit"]');
        if (submitButton) submitButton.disabled = true;
        setContactMessage("Sending…");

        try {
          await addDoc(collection(db, "inquiries"), {
            type,
            name,
            email,
            message,
            createdAt: serverTimestamp(),
          });

          const mailBody = new FormData();
          mailBody.append("_subject", `[Santamonica Boy] ${type}`);
          mailBody.append("_replyto", email);
          mailBody.append("_template", "table");
          mailBody.append("_captcha", "false");
          mailBody.append("_honey", honey);
          mailBody.append("_url", "https://santamonica-boy.web.app/");
          mailBody.append("Type", type);
          mailBody.append("Name", name);
          mailBody.append("Email", email);
          mailBody.append("Message", message);
          mailBody.append(
            "Summary",
            [`[Type] ${type}`, `[Name] ${name}`, `[Email] ${email}`, "", message].join("\n"),
          );

          const mailResponse = await fetch(`https://formsubmit.co/ajax/${CONTACT_FORM_ID}`, {
            method: "POST",
            headers: {
              Accept: "application/json",
            },
            body: mailBody,
          });

          const mailResult = await mailResponse.json().catch(() => ({}));
          if (String(mailResult.success) !== "true") {
            throw new Error(
              String(mailResult.message || `Mail delivery failed (${mailResponse.status})`),
            );
          }

          finishContactForm();
        } catch (error) {
          console.error("Failed to submit inquiry:", error);
          setContactMessage("Something went wrong. Please try again.", "is-error");
        } finally {
          if (submitButton) submitButton.disabled = false;
        }
      },
      { signal },
    );
  }

  document.querySelectorAll("[data-inquiry-type]").forEach((link) => {
    link.addEventListener(
      "click",
      () => {
        const type = link.getAttribute("data-inquiry-type");
        const currentForm = contactForm();
        if (!type || !currentForm) return;
        const input = currentForm.querySelector(`input[name="type"][value="${CSS.escape(type)}"]`);
        if (input) input.checked = true;
      },
      { signal },
    );
  });

  const revealPanels = document.querySelectorAll("[data-reveal]");
  let revealObserver = null;
  if (revealPanels.length) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      revealPanels.forEach((panel) => panel.classList.add("is-in"));
    } else {
      revealObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) entry.target.classList.add("is-in");
          });
        },
        { threshold: 0.22 },
      );
      revealPanels.forEach((panel) => revealObserver.observe(panel));
    }
  }

  const toTop = document.querySelector("[data-to-top]");
  if (toTop) {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const showAfter = () => Math.max(240, Math.round(window.innerHeight * 0.45));
    const syncVisibility = () => {
      const visible = window.scrollY > showAfter();
      toTop.classList.toggle("is-visible", visible);
      toTop.hidden = !visible;
    };
    toTop.addEventListener(
      "click",
      () => {
        window.scrollTo({
          top: 0,
          behavior: reduceMotion.matches ? "auto" : "smooth",
        });
      },
      { signal },
    );
    window.addEventListener("scroll", syncVisibility, { passive: true, signal });
    window.addEventListener("resize", syncVisibility, { passive: true, signal });
    syncVisibility();
  }

  // Showcase open/close uses document-level delegation (ensureShowcaseDelegation)
  // so it keeps working after Swarm rebuilds or swup replaces #swup.

  return () => {
    revealObserver?.disconnect();
    homeAbort?.abort();
    homeAbort = null;
    document.documentElement.classList.remove("is-scroll-locked");
  };
}

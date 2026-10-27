import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
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
const INQUIRY_TYPES = new Set(["New project", "Maintenance", "Defect repair"]);

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const storage = getStorage(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

const downloadButton = document.querySelector("[data-download]");
const authButton = document.querySelector("[data-auth]");
const authStatus = document.querySelector("[data-auth-status]");
const contactForm = document.querySelector("[data-contact-form]");
const contactStatus = document.querySelector("[data-contact-status]");
const revealPanels = document.querySelectorAll("[data-reveal]");
const sections = Array.from(document.querySelectorAll("[data-section]"));

let downloadUrl = null;
let clickBound = false;
let isSnapping = false;

function setDownloadDisabled(message) {
  if (!downloadButton) return;
  downloadButton.disabled = true;
  downloadButton.classList.remove("is-ready", "is-signin");
  downloadButton.removeAttribute("aria-busy");
  downloadButton.title = message;
}

function setDownloadNeedsSignIn() {
  if (!downloadButton) return;
  downloadButton.disabled = false;
  downloadButton.classList.remove("is-ready");
  downloadButton.classList.add("is-signin");
  downloadButton.removeAttribute("aria-busy");
  downloadButton.title = "Sign in to download AutoCation";
}

function setDownloadReady(url) {
  if (!downloadButton) return;
  downloadUrl = url;
  downloadButton.disabled = false;
  downloadButton.classList.remove("is-signin");
  downloadButton.classList.add("is-ready");
  downloadButton.removeAttribute("aria-busy");
  downloadButton.title = "Download AutoCation";
}

async function resolveInstallerUrl() {
  return getDownloadURL(ref(storage, INSTALLER_PATH));
}

async function signIn() {
  await signInWithPopup(auth, googleProvider);
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
  if (!downloadButton) return;

  downloadUrl = null;
  downloadButton.setAttribute("aria-busy", "true");
  downloadButton.title = "Checking download…";

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

function updateAuthUi(user) {
  if (!authButton || !authStatus) return;

  if (user) {
    authStatus.textContent = user.email || "Signed in";
    authStatus.hidden = false;
    authButton.textContent = "Sign out";
    authButton.dataset.mode = "out";
  } else {
    authStatus.textContent = "";
    authStatus.hidden = true;
    authButton.textContent = "Sign in";
    authButton.dataset.mode = "in";
  }
}

function setContactMessage(message, state = "") {
  if (!contactStatus) return;
  contactStatus.textContent = message;
  contactStatus.classList.remove("is-error", "is-success");
  if (state) contactStatus.classList.add(state);
}

function setupContactForm() {
  if (!contactForm) return;

  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(contactForm);
    const type = String(formData.get("type") || "").trim();
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const message = String(formData.get("message") || "").trim();

    if (!INQUIRY_TYPES.has(type) || !name || !email || !message) {
      setContactMessage("Please check your input.", "is-error");
      return;
    }

    const submitButton = contactForm.querySelector('button[type="submit"]');
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
      mailBody.append("_url", "https://santamonica-boy.web.app/");
      mailBody.append("Type", type);
      mailBody.append("Name", name);
      mailBody.append("Email", email);
      mailBody.append("Message", message);
      mailBody.append(
        "Summary",
        [`[Type] ${type}`, `[Name] ${name}`, `[Email] ${email}`, "", message].join("\n")
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
          String(mailResult.message || `Mail delivery failed (${mailResponse.status})`)
        );
      }

      contactForm.reset();
      const defaultType = contactForm.querySelector('input[name="type"][value="New project"]');
      if (defaultType) defaultType.checked = true;
      setContactMessage("Thanks. Your inquiry was received.", "is-success");
    } catch (error) {
      console.error("Failed to submit inquiry:", error);
      setContactMessage("Something went wrong. Please try again.", "is-error");
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}

function setupReveal() {
  if (!revealPanels.length) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    revealPanels.forEach((panel) => panel.classList.add("is-in"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
        }
      });
    },
    { threshold: 0.22 }
  );

  revealPanels.forEach((panel) => observer.observe(panel));
}

function snapTo(section) {
  if (!section || isSnapping) return;
  isSnapping = true;
  section.scrollIntoView({ behavior: "smooth", block: "start" });
  window.setTimeout(() => {
    isSnapping = false;
  }, 900);
}

function getNearestSectionIndex() {
  const mid = window.scrollY + window.innerHeight * 0.35;
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  sections.forEach((section, index) => {
    const center = section.offsetTop + section.offsetHeight * 0.35;
    const distance = Math.abs(center - mid);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });

  return nearestIndex;
}

function setupSectionSnap() {
  if (sections.length < 2) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  window.addEventListener(
    "wheel",
    (event) => {
      if (isSnapping) {
        event.preventDefault();
        return;
      }

      if (Math.abs(event.deltaY) < 12) return;

      const currentIndex = getNearestSectionIndex();
      const nextIndex =
        event.deltaY > 0
          ? Math.min(currentIndex + 1, sections.length - 1)
          : Math.max(currentIndex - 1, 0);

      if (nextIndex === currentIndex) return;

      event.preventDefault();
      snapTo(sections[nextIndex]);
    },
    { passive: false }
  );

  let touchStartY = 0;
  window.addEventListener(
    "touchstart",
    (event) => {
      touchStartY = event.touches[0]?.clientY ?? 0;
    },
    { passive: true }
  );

  window.addEventListener(
    "touchend",
    (event) => {
      const endY = event.changedTouches[0]?.clientY ?? touchStartY;
      const delta = touchStartY - endY;
      if (Math.abs(delta) < 40) return;

      const currentIndex = getNearestSectionIndex();
      const nextIndex =
        delta > 0
          ? Math.min(currentIndex + 1, sections.length - 1)
          : Math.max(currentIndex - 1, 0);

      if (nextIndex === currentIndex) return;
      snapTo(sections[nextIndex]);
    },
    { passive: true }
  );
}

if (authButton) {
  authButton.addEventListener("click", async () => {
    try {
      if (authButton.dataset.mode === "out") {
        await signOut(auth);
      } else {
        await signIn();
      }
    } catch (error) {
      console.warn("Auth action failed:", error);
    }
  });
}

if (downloadButton && !clickBound) {
  clickBound = true;
  downloadButton.addEventListener("click", () => {
    handleDownloadClick();
  });
}

onAuthStateChanged(auth, (user) => {
  updateAuthUi(user);
  refreshDownloadState(user);
});

setupContactForm();
setupReveal();
setupSectionSnap();

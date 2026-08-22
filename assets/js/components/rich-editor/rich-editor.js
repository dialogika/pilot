// assets/js/components/rich-editor/rich-editor.js
// =====================================================================
// RICH EDITOR — Controller & Orchestrator for Tiptap-style Rich Text Editor
//
// Clean Vanilla JS ES Module compatible with Dialogika 4-Layer Architecture.
// =====================================================================

import { renderEditorDOM } from "./rich-editor.ui.js";

/**
 * Creates and initializes a Rich Text Editor instance.
 *
 * @param {HTMLElement|string} target Container element or selector
 * @param {Object} options Configuration options
 * @returns {Object} Editor controller API
 */
export function createRichEditor(target, options = {}) {
  const container = typeof target === "string" ? document.querySelector(target) : target;
  if (!container) {
    console.warn("createRichEditor: Target element not found", target);
    return null;
  }

  // Ensure CSS stylesheet is loaded
  if (!document.querySelector('link[href*="rich-editor.css"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "../../assets/js/components/rich-editor/rich-editor.css";
    document.head.appendChild(link);
  }

  const dom = renderEditorDOM(container, options);
  const contentEl = dom.content;
  const toolbarEl = dom.toolbar;
  const styleSelect = dom.styleSelect;
  const imageFileInput = dom.imageFileInput;

  let listeners = {
    input: [],
    change: [],
  };

  let isDisabled = Boolean(options.disabled);

  // Set initial content if provided
  if (options.initialContent) {
    setContent(options.initialContent);
  }

  /* ------------------------------------------------------------------ */
  /* Helper: Count words & chars                                        */
  /* ------------------------------------------------------------------ */
  function updateCounters() {
    const text = getText();
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;

    if (dom.wordsCount) dom.wordsCount.textContent = `${words} words`;
    if (dom.charsCount) dom.charsCount.textContent = `${chars} chars`;
  }

  /* ------------------------------------------------------------------ */
  /* Content extraction / setting                                       */
  /* ------------------------------------------------------------------ */
  function getText() {
    return contentEl.innerText || contentEl.textContent || "";
  }

  function getHTML() {
    // Clone and sanitize contentEl to clean temporary delete buttons if needed
    const clone = contentEl.cloneNode(true);
    clone.querySelectorAll(".dg-editor-img-del").forEach((btn) => btn.remove());
    const raw = clone.innerHTML.trim();
    if (!raw || raw === "<br>" || raw === "<p><br></p>") return "";
    return raw;
  }

  function setContent(val) {
    if (!val || typeof val !== "string") {
      contentEl.innerHTML = "";
    } else {
      // If it has HTML tags, set as HTML, else wrap lines into paragraphs
      if (/<[a-z][\s\S]*>/i.test(val)) {
        contentEl.innerHTML = val;
        // Re-inject delete buttons on image wrappers if missing
        ensureImageDeleteButtons();
      } else {
        const paragraphs = val
          .split("\n")
          .map((line) => `<p>${escapeHtml(line) || "<br>"}</p>`)
          .join("");
        contentEl.innerHTML = paragraphs;
      }
    }
    updateCounters();
    triggerEvent("input");
  }

  function ensureImageDeleteButtons() {
    contentEl.querySelectorAll(".dg-editor-img-wrap").forEach((wrap) => {
      if (!wrap.querySelector(".dg-editor-img-del")) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "dg-editor-img-del";
        btn.title = "Delete Image";
        btn.innerHTML = "&times;";
        wrap.appendChild(btn);
      }
    });
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  /* ------------------------------------------------------------------ */
  /* Image Insertion Helpers                                            */
  /* ------------------------------------------------------------------ */
  function insertImageElement(src, alt = "Image") {
    if (!src) return;
    const wrap = document.createElement("div");
    wrap.className = "dg-editor-img-wrap";
    wrap.contentEditable = "false";
    wrap.innerHTML = `
      <img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" class="dg-editor-img" />
      <button type="button" class="dg-editor-img-del" title="Delete Image">&times;</button>
    `;

    const p = document.createElement("p");
    p.innerHTML = "<br>";

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && contentEl.contains(selection.anchorNode)) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(wrap);
      range.collapse(false);
      if (wrap.nextSibling) {
        wrap.parentNode.insertBefore(p, wrap.nextSibling);
      } else {
        wrap.parentNode.appendChild(p);
      }
    } else {
      contentEl.appendChild(wrap);
      contentEl.appendChild(p);
    }

    updateCounters();
    triggerEvent("input");
  }

  function handleImageFile(file) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxWidth = 1000;
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.7);
        insertImageElement(compressedDataUrl, file.name || "Uploaded Image");
      };
      img.onerror = () => {
        insertImageElement(e.target.result, file.name || "Uploaded Image");
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  /* ------------------------------------------------------------------ */
  /* Command Execution                                                  */
  /* ------------------------------------------------------------------ */
  function execCmd(command, value = null) {
    if (isDisabled) return;
    contentEl.focus();

    if (command === "createLink") {
      const url = prompt("Enter URL:", "https://");
      if (url) {
        document.execCommand("createLink", false, url);
      }
      syncToolbarState();
      return;
    }

    if (command === "insertImage") {
      if (imageFileInput) {
        imageFileInput.click();
      }
      return;
    }

    if (command === "code") {
      const selection = window.getSelection();
      if (!selection.rangeCount) return;
      const range = selection.getRangeAt(0);
      const selectedText = range.toString();

      if (selectedText) {
        const codeNode = document.createElement("code");
        codeNode.textContent = selectedText;
        range.deleteContents();
        range.insertNode(codeNode);
        selection.removeAllRanges();
      }
      triggerEvent("input");
      syncToolbarState();
      return;
    }

    if (command === "insertTaskList") {
      insertTaskItem();
      triggerEvent("input");
      syncToolbarState();
      return;
    }

    document.execCommand(command, false, value);
    triggerEvent("input");
    syncToolbarState();
  }

  function insertTaskItem() {
    const list = document.createElement("ul");
    list.className = "dg-task-list";
    const item = document.createElement("li");
    item.className = "dg-task-item";
    item.innerHTML = `<input type="checkbox" /> <span>To-do item</span>`;
    list.appendChild(item);

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(list);
      range.selectNodeContents(item.querySelector("span"));
    } else {
      contentEl.appendChild(list);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Markdown-like Quick Formatting Shortcuts                           */
  /* ------------------------------------------------------------------ */
  function handleMarkdownInput(e) {
    if (e.key !== " " && e.key !== "Enter") return;

    const selection = window.getSelection();
    if (!selection || !selection.anchorNode) return;

    const node = selection.anchorNode;
    const text = node.textContent || "";
    const offset = selection.anchorOffset;
    const textBefore = text.slice(0, offset);

    if (e.key === " ") {
      if (textBefore === "#") {
        e.preventDefault();
        node.textContent = text.slice(offset);
        document.execCommand("formatBlock", false, "h1");
      } else if (textBefore === "##") {
        e.preventDefault();
        node.textContent = text.slice(offset);
        document.execCommand("formatBlock", false, "h2");
      } else if (textBefore === "###") {
        e.preventDefault();
        node.textContent = text.slice(offset);
        document.execCommand("formatBlock", false, "h3");
      } else if (textBefore === "-" || textBefore === "*") {
        e.preventDefault();
        node.textContent = text.slice(offset);
        document.execCommand("insertUnorderedList", false, null);
      } else if (textBefore === "1.") {
        e.preventDefault();
        node.textContent = text.slice(offset);
        document.execCommand("insertOrderedList", false, null);
      } else if (textBefore === ">") {
        e.preventDefault();
        node.textContent = text.slice(offset);
        document.execCommand("formatBlock", false, "blockquote");
      } else if (textBefore === "[]" || textBefore === "[ ]") {
        e.preventDefault();
        node.textContent = text.slice(offset);
        insertTaskItem();
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Toolbar Active State Synchronizer                                  */
  /* ------------------------------------------------------------------ */
  function syncToolbarState() {
    if (!toolbarEl) return;

    const buttons = toolbarEl.querySelectorAll(".dg-editor-btn[data-command]");
    buttons.forEach((btn) => {
      const cmd = btn.getAttribute("data-command");
      const val = btn.getAttribute("data-value");

      if (cmd === "formatBlock" && val) {
        const active = document.queryCommandValue("formatBlock")?.toLowerCase() === val.toLowerCase();
        btn.classList.toggle("active", active);
      } else if (["bold", "italic", "underline", "strikeThrough", "insertUnorderedList", "insertOrderedList"].includes(cmd)) {
        try {
          const state = document.queryCommandState(cmd);
          btn.classList.toggle("active", Boolean(state));
        } catch (_) {}
      }
    });

    if (styleSelect) {
      try {
        const curBlock = (document.queryCommandValue("formatBlock") || "").toLowerCase().replace(/<|>/g, "");
        if (["h1", "h2", "h3", "p", "blockquote"].includes(curBlock)) {
          styleSelect.value = curBlock;
        } else {
          styleSelect.value = "p";
        }
      } catch (_) {}
    }
  }

  /* ------------------------------------------------------------------ */
  /* Event Listeners Setup                                              */
  /* ------------------------------------------------------------------ */
  toolbarEl?.addEventListener("click", (e) => {
    const btn = e.target.closest(".dg-editor-btn");
    if (!btn) return;
    e.preventDefault();
    const cmd = btn.getAttribute("data-command");
    const val = btn.getAttribute("data-value");
    execCmd(cmd, val);
  });

  styleSelect?.addEventListener("change", (e) => {
    execCmd("formatBlock", e.target.value);
  });

  // File Picker Image Upload
  imageFileInput?.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      handleImageFile(file);
      imageFileInput.value = "";
    }
  });

  contentEl.addEventListener("keydown", (e) => {
    // Keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+U, Ctrl+Z, Ctrl+Y)
    if (e.ctrlKey || e.metaKey) {
      if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        execCmd("bold");
        return;
      }
      if (e.key === "i" || e.key === "I") {
        e.preventDefault();
        execCmd("italic");
        return;
      }
      if (e.key === "u" || e.key === "U") {
        e.preventDefault();
        execCmd("underline");
        return;
      }
      if (e.key === "z" || e.key === "Z") {
        if (e.shiftKey) {
          e.preventDefault();
          execCmd("redo");
        } else {
          e.preventDefault();
          execCmd("undo");
        }
        return;
      }
      if (e.key === "y" || e.key === "Y") {
        e.preventDefault();
        execCmd("redo");
        return;
      }
    }

    handleMarkdownInput(e);
  });

  // Clipboard Paste Image handling (e.g. Snipping tool / screenshots)
  contentEl.addEventListener("paste", (e) => {
    const items = e.clipboardData && e.clipboardData.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf("image") !== -1) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            handleImageFile(file);
          }
          return;
        }
      }
    }
  });

  // Drag and Drop Image handling
  contentEl.addEventListener("dragover", (e) => {
    e.preventDefault();
  });

  contentEl.addEventListener("drop", (e) => {
    const files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith("image/")) {
        e.preventDefault();
        handleImageFile(file);
      }
    }
  });

  contentEl.addEventListener("input", () => {
    updateCounters();
    triggerEvent("input");
  });

  contentEl.addEventListener("blur", () => {
    triggerEvent("change");
  });

  contentEl.addEventListener("click", (e) => {
    // Checkbox toggle inside task item
    if (e.target && e.target.matches('li.dg-task-item input[type="checkbox"]')) {
      const parent = e.target.closest("li.dg-task-item");
      if (parent) {
        parent.classList.toggle("checked", e.target.checked);
      }
      triggerEvent("input");
    }

    // Delete Image button
    if (e.target && (e.target.matches(".dg-editor-img-del") || e.target.closest(".dg-editor-img-del"))) {
      const wrap = e.target.closest(".dg-editor-img-wrap");
      if (wrap) {
        wrap.remove();
        updateCounters();
        triggerEvent("input");
      }
    }
  });

  document.addEventListener("selectionchange", () => {
    if (document.activeElement === contentEl || contentEl.contains(document.activeElement)) {
      syncToolbarState();
    }
  });

  function triggerEvent(eventName) {
    const list = listeners[eventName] || [];
    const html = getHTML();
    const text = getText();
    list.forEach((cb) => {
      try {
        cb({ html, text });
      } catch (err) {
        console.error("RichEditor listener error:", err);
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Public Instance API                                                */
  /* ------------------------------------------------------------------ */
  return {
    getHTML,
    getText,
    getValue: getHTML,
    setHTML: setContent,
    setValue: setContent,
    insertImage: insertImageElement,
    clear: () => setContent(""),
    focus: () => contentEl.focus(),
    setDisabled: (disabled) => {
      isDisabled = Boolean(disabled);
      contentEl.contentEditable = isDisabled ? "false" : "true";
      container.classList.toggle("dg-editor-disabled", isDisabled);
    },
    on: (eventName, callback) => {
      if (listeners[eventName]) {
        listeners[eventName].push(callback);
      }
    },
    off: (eventName, callback) => {
      if (listeners[eventName]) {
        listeners[eventName] = listeners[eventName].filter((cb) => cb !== callback);
      }
    },
    destroy: () => {
      container.innerHTML = "";
      listeners = { input: [], change: [] };
    },
  };
}

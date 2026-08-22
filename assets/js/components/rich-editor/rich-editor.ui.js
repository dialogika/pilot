// assets/js/components/rich-editor/rich-editor.ui.js
// =====================================================================
// RICH EDITOR UI — Pure DOM rendering for Tiptap-style Rich Text Editor
//
// RULES:
//  - Pure rendering and DOM construction.
//  - No Firestore / backend queries.
// =====================================================================

export function renderEditorDOM(containerEl, options = {}) {
  const placeholder = options.placeholder || "Add a description for this quest...";
  const showFooter = options.showFooter !== false;

  containerEl.className = "dg-editor-container" + (options.disabled ? " dg-editor-disabled" : "");
  containerEl.innerHTML = `
    <!-- Top Toolbar -->
    <div class="dg-editor-toolbar" role="toolbar">
      <div class="dg-editor-btn-group">
        <select class="dg-editor-select" data-command="formatBlock" title="Text Style">
          <option value="p">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
        </select>
      </div>

      <div class="dg-editor-divider"></div>

      <div class="dg-editor-btn-group">
        <button type="button" class="dg-editor-btn" data-command="bold" title="Bold (Ctrl+B)">
          <i class="bi bi-type-bold"></i>
        </button>
        <button type="button" class="dg-editor-btn" data-command="italic" title="Italic (Ctrl+I)">
          <i class="bi bi-type-italic"></i>
        </button>
        <button type="button" class="dg-editor-btn" data-command="underline" title="Underline (Ctrl+U)">
          <i class="bi bi-type-underline"></i>
        </button>
        <button type="button" class="dg-editor-btn" data-command="strikeThrough" title="Strikethrough">
          <i class="bi bi-type-strikethrough"></i>
        </button>
        <button type="button" class="dg-editor-btn" data-command="code" title="Inline Code">
          <i class="bi bi-code"></i>
        </button>
      </div>

      <div class="dg-editor-divider"></div>

      <div class="dg-editor-btn-group">
        <button type="button" class="dg-editor-btn" data-command="insertUnorderedList" title="Bullet List">
          <i class="bi bi-list-ul"></i>
        </button>
        <button type="button" class="dg-editor-btn" data-command="insertOrderedList" title="Numbered List">
          <i class="bi bi-list-ol"></i>
        </button>
        <button type="button" class="dg-editor-btn" data-command="insertTaskList" title="Checklist">
          <i class="bi bi-check2-square"></i>
        </button>
      </div>

      <div class="dg-editor-divider"></div>

      <div class="dg-editor-btn-group">
        <button type="button" class="dg-editor-btn" data-command="formatBlock" data-value="blockquote" title="Quote">
          <i class="bi bi-quote"></i>
        </button>
        <button type="button" class="dg-editor-btn" data-command="formatBlock" data-value="pre" title="Code Block">
          <i class="bi bi-terminal"></i>
        </button>
        <button type="button" class="dg-editor-btn" data-command="createLink" title="Link">
          <i class="bi bi-link-45deg"></i>
        </button>
        <button type="button" class="dg-editor-btn" data-command="insertImage" title="Insert Image (Upload or URL)">
          <i class="bi bi-image"></i>
        </button>
        <button type="button" class="dg-editor-btn" data-command="removeFormat" title="Clear Formatting">
          <i class="bi bi-eraser"></i>
        </button>
      </div>

      <div class="dg-editor-divider"></div>

      <div class="dg-editor-btn-group ms-auto">
        <button type="button" class="dg-editor-btn" data-command="undo" title="Undo (Ctrl+Z)">
          <i class="bi bi-arrow-counterclockwise"></i>
        </button>
        <button type="button" class="dg-editor-btn" data-command="redo" title="Redo (Ctrl+Y)">
          <i class="bi bi-arrow-clockwise"></i>
        </button>
      </div>
    </div>

    <!-- Hidden file input for image uploads -->
    <input type="file" class="dg-editor-image-file-input d-none" accept="image/*" />

    <!-- Editable Content Area -->
    <div class="dg-editor-content" contenteditable="${options.disabled ? "false" : "true"}" data-placeholder="${placeholder}" spellcheck="true"></div>

    <!-- Footer Status Bar -->
    ${
      showFooter
        ? `
    <div class="dg-editor-footer">
      <div class="dg-editor-status-info">
        <span class="dg-editor-words-count">0 words</span>
        <span>•</span>
        <span class="dg-editor-chars-count">0 chars</span>
      </div>
      <span class="dg-editor-badge-tiptap">Rich Text</span>
    </div>
    `
        : ""
    }
  `;

  return {
    toolbar: containerEl.querySelector(".dg-editor-toolbar"),
    content: containerEl.querySelector(".dg-editor-content"),
    footer: containerEl.querySelector(".dg-editor-footer"),
    wordsCount: containerEl.querySelector(".dg-editor-words-count"),
    charsCount: containerEl.querySelector(".dg-editor-chars-count"),
    styleSelect: containerEl.querySelector('.dg-editor-select[data-command="formatBlock"]'),
    imageFileInput: containerEl.querySelector(".dg-editor-image-file-input"),
  };
}

import { markOwned } from "../../dom/ownership";
import { normalizeListingUrl } from "../../domain/listings/url";
import { getFromStorage, onStorageChange, setInStorage } from "../../platform/storage";

const STORAGE_KEY = "shortlistNotes";
const NOTE_TEST_ID = "extra-domain-filters-shortlist-note";
const NATIVE_NOTES_LABEL = /^(?:add|edit|view) notes$/i;

type ShortlistNotes = Record<string, { text: string; updatedAt: number }>;

let notesCache: ShortlistNotes | undefined;
const editing = new Map<string, string>();

async function readNotes(): Promise<ShortlistNotes> {
    notesCache ??= (await getFromStorage<ShortlistNotes>(STORAGE_KEY)) ?? {};
    return notesCache;
}

async function writeNote(url: string, text: string): Promise<void> {
    const notes = { ...await readNotes() };
    const key = normalizeListingUrl(url);
    if (text.trim()) notes[key] = { text: text.trim(), updatedAt: Date.now() };
    else delete notes[key];
    notesCache = notes;
    await setInStorage(STORAGE_KEY, notes);
}

export function watchShortlistNotes(onChange: () => void): () => void {
    return onStorageChange<ShortlistNotes>(STORAGE_KEY, next => {
        notesCache = next ?? {};
        onChange();
    });
}

function setLabel(button: HTMLButtonElement, text: string): void {
    if (button.textContent !== text) button.textContent = text;
}

function createEditor(url: string, rerender: () => void): HTMLElement {
    const editor = document.createElement("div");
    const textarea = document.createElement("textarea");
    const actions = document.createElement("div");
    const cancel = document.createElement("button");
    const save = document.createElement("button");
    const key = normalizeListingUrl(url);

    editor.className = "edf-shortlist-note-editor";
    textarea.className = "edf-shortlist-note-input";
    textarea.placeholder = "Write a private note about this property…";
    textarea.ariaLabel = "Notes";
    textarea.value = editing.get(key) ?? "";
    textarea.addEventListener("input", () => editing.set(key, textarea.value));
    actions.className = "edf-shortlist-note-actions";
    cancel.type = "button";
    cancel.className = "edf-shortlist-note-button";
    cancel.textContent = "Cancel";
    save.type = "button";
    save.className = "edf-shortlist-note-button edf-shortlist-note-button-primary";
    save.textContent = "Save note";

    const close = (): void => {
        editing.delete(key);
        rerender();
    };
    const commit = async (): Promise<void> => {
        save.disabled = true;
        await writeNote(url, textarea.value);
        close();
    };
    cancel.addEventListener("click", close);
    save.addEventListener("click", () => void commit());
    textarea.addEventListener("keydown", event => {
        if (event.key === "Escape") close();
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) void commit();
    });
    actions.append(cancel, save);
    editor.append(textarea, actions);
    requestAnimationFrame(() => {
        if (!textarea.isConnected || document.activeElement === textarea) return;
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    });
    return editor;
}

/**
 * Inline notes on shortlist cards. Domain's "Add Notes" now navigates to the listing's notes
 * section (which many listings don't have) instead of editing in the card, so the button opens
 * this extension-owned editor; notes are stored in extension storage and shown on the card.
 */
export function bindShortlistNotes(card: HTMLElement, url: string): void {
    const actions = card.querySelector<HTMLElement>('[data-testid="listing-card-buttons-wrapper"]');
    const native = actions && [...actions.querySelectorAll<HTMLButtonElement>("button")]
        .find(button => NATIVE_NOTES_LABEL.test(button.textContent?.trim() ?? ""));
    if (!actions || !native) return;
    const key = normalizeListingUrl(url);

    const render = (): void => {
        void readNotes().then(notes => {
            if (!actions.isConnected) return;
            const note = notes[key]?.text ?? "";
            const isEditing = editing.has(key);
            setLabel(native, note ? "Edit notes" : "Add notes");
            native.ariaExpanded = String(isEditing);

            const existing = card.querySelector<HTMLElement>(`[data-testid="${NOTE_TEST_ID}"]`);
            const mode = isEditing ? "editing" : note ? "note" : "empty";
            if (existing?.dataset.mode === mode && (mode !== "note" || existing.textContent === note)) return;
            existing?.remove();
            if (mode === "empty") return;

            const block = isEditing ? createEditor(url, render) : document.createElement("p");
            if (!isEditing) {
                block.className = "edf-shortlist-note";
                block.textContent = note;
            }
            block.dataset.testid = NOTE_TEST_ID;
            block.dataset.mode = mode;
            actions.before(markOwned(block, "shortlist-note"));
        });
    };

    if (native.dataset.edfNotesBound !== "true") {
        native.dataset.edfNotesBound = "true";
        native.addEventListener("click", event => {
            event.preventDefault();
            event.stopImmediatePropagation();
            void readNotes().then(notes => {
                if (editing.has(key)) editing.delete(key);
                else editing.set(key, notes[key]?.text ?? "");
                render();
            });
        }, { capture: true });
    }
    render();
}

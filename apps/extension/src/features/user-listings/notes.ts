import { markOwned } from "../../dom/ownership";
import { normalizeListingUrl } from "../../domain/listings/url";
import { getFromStorage, onStorageChange, setInStorage } from "../../platform/storage";

const STORAGE_KEY = "shortlistNotes";
const NOTE_TEST_ID = "extra-domain-filters-shortlist-note";
const NATIVE_NOTES_LABEL = /^(?:add|edit|view) notes$/i;
const NOTE_MAX_HEIGHT = 144;

type ShortlistNotes = Record<string, { text: string; updatedAt: number }>;

let notesCache: ShortlistNotes | undefined;
let domainNotes: Map<string, string> | undefined;
/** Cards whose still-empty note field was opened with "Add notes". */
const opened = new Set<string>();

async function readNotes(): Promise<ShortlistNotes> {
    notesCache ??= (await getFromStorage<ShortlistNotes>(STORAGE_KEY)) ?? {};
    return notesCache;
}

/**
 * Notes written while Domain still allowed editing them on the card (its feature flag is now
 * off) only survive in the page data. Show them until the user edits the note here.
 */
function readDomainNotes(): Map<string, string> {
    if (domainNotes) return domainNotes;
    domainNotes = new Map();
    try {
        const data = JSON.parse(document.getElementById("__NEXT_DATA__")?.textContent ?? "{}");
        for (const listing of data?.props?.pageProps?.componentProps?.shortlistListings ?? []) {
            if (typeof listing?.url === "string" && typeof listing.notes === "string" && listing.notes.trim()) {
                domainNotes.set(normalizeListingUrl(listing.url), listing.notes.trim());
            }
        }
    } catch {
        // No page data: only extension notes.
    }
    return domainNotes;
}

function noteFor(notes: ShortlistNotes, key: string): string {
    return notes[key]?.text ?? readDomainNotes().get(key) ?? "";
}

async function writeNote(key: string, text: string): Promise<void> {
    const notes = { ...await readNotes() };
    // An empty entry hides a Domain note the user cleared; otherwise drop the key.
    if (text || readDomainNotes().has(key)) notes[key] = { text, updatedAt: Date.now() };
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

function resize(field: HTMLTextAreaElement): void {
    field.style.height = "auto";
    const borders = field.offsetHeight - field.clientHeight;
    field.style.height = `${Math.min(field.scrollHeight, NOTE_MAX_HEIGHT) + borders}px`;
    field.style.overflowY = field.scrollHeight > NOTE_MAX_HEIGHT ? "auto" : "hidden";
}

function createField(key: string, rerender: () => void): HTMLTextAreaElement {
    const field = markOwned(document.createElement("textarea"), "shortlist-note");
    field.className = "edf-shortlist-note";
    field.dataset.testid = NOTE_TEST_ID;
    field.placeholder = "Add a private note…";
    field.ariaLabel = "Notes";
    field.rows = 1;

    let reverting = false;
    field.addEventListener("input", () => resize(field));
    field.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            reverting = true;
            field.blur();
        } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            field.blur();
        }
    });
    field.addEventListener("blur", () => void readNotes().then(async notes => {
        const text = field.value.trim();
        opened.delete(key);
        if (!reverting && text !== noteFor(notes, key)) await writeNote(key, text);
        reverting = false;
        rerender();
    }));
    return field;
}

/**
 * Shortlist notes, edited in place on the card like Domain's old inline notes: click the note
 * and type; it saves when focus leaves (Ctrl/⌘+Enter), Escape reverts. Domain's own "Add notes"
 * now just opens the listing page, so the button opens this field instead.
 */
export function bindShortlistNotes(card: HTMLElement, url: string): void {
    const actions = card.querySelector<HTMLElement>('[data-testid="listing-card-buttons-wrapper"]');
    const native = actions && [...actions.querySelectorAll<HTMLButtonElement>("button")]
        .find(button => NATIVE_NOTES_LABEL.test(button.textContent?.trim() ?? ""));
    if (!actions || !native) return;
    const key = normalizeListingUrl(url);

    const findField = (): HTMLTextAreaElement | null =>
        card.querySelector<HTMLTextAreaElement>(`[data-testid="${NOTE_TEST_ID}"]`);
    const render = (focus = false): void => {
        void readNotes().then(notes => {
            if (!actions.isConnected) return;
            const note = noteFor(notes, key);
            const label = note ? "Edit notes" : "Add notes";
            if (native.textContent !== label) native.textContent = label;

            let field = findField();
            if (field && document.activeElement === field) return;
            if (!note && !opened.has(key)) {
                field?.remove();
                return;
            }
            field ??= createField(key, render);
            if (field.value !== note) field.value = note;
            if (field.nextElementSibling !== actions) actions.before(field);
            resize(field);
            if (focus) {
                field.focus();
                field.setSelectionRange(field.value.length, field.value.length);
            }
        });
    };

    if (native.dataset.edfNotesBound !== "true") {
        native.dataset.edfNotesBound = "true";
        native.addEventListener("click", event => {
            event.preventDefault();
            event.stopImmediatePropagation();
            opened.add(key);
            render(true);
        }, { capture: true });
    }
    render();
}

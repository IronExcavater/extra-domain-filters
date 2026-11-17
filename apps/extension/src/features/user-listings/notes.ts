import { markOwned } from "../../dom/ownership";
import { normalizeListingUrl } from "../../domain/listings/url";
import { getFromStorage, onStorageChange, setInStorage } from "../../platform/storage";

const STORAGE_KEY = "shortlistNotes";
const NOTE_VIEW_TEST_ID = "extra-domain-filters-shortlist-note";
const NATIVE_NOTES_LABEL = /^(?:(?:add|edit|view) notes?|view details)$/i;
const SAVE_DELAY_MS = 500;

type ShortlistNotes = Record<string, { text: string; updatedAt: number }>;

let notesCache: ShortlistNotes | undefined;
let domainNotes: Map<string, string> | undefined;

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

function formatSaved(updatedAt: number | undefined): string {
    if (!updatedAt) return "Saves as you type";
    const date = new Date(updatedAt);
    const today = new Date().toDateString() === date.toDateString();
    return `Saved ${today
        ? date.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })
        : date.toLocaleDateString("en-AU", { day: "numeric", month: "short" })}`;
}

/** The card's other side: a title, when it was saved, and the note filling the card. */
function createNoteView(key: string, onClose: () => void): { element: HTMLElement; field: HTMLTextAreaElement; status: HTMLElement } {
    const element = markOwned(document.createElement("section"), "shortlist-note");
    const head = document.createElement("div");
    const title = document.createElement("p");
    const status = document.createElement("span");
    const field = document.createElement("textarea");

    element.className = "edf-shortlist-note-view";
    element.dataset.testid = NOTE_VIEW_TEST_ID;
    element.ariaLabel = "Your note on this listing";
    head.className = "edf-shortlist-note-head";
    title.className = "edf-shortlist-note-title";
    title.textContent = "Your note";
    status.className = "edf-shortlist-note-status";
    status.ariaLive = "polite";
    head.append(title, status);
    field.className = "edf-shortlist-note-field";
    field.placeholder = "What did you think? Inspection times, questions for the agent, what to check…";
    field.ariaLabel = "Note";

    let timer: number | undefined;
    const save = async (): Promise<void> => {
        window.clearTimeout(timer);
        timer = undefined;
        const text = field.value.trim();
        if (text === noteFor(await readNotes(), key)) return;
        await writeNote(key, text);
        status.textContent = formatSaved(Date.now());
    };
    field.addEventListener("input", () => {
        status.textContent = "Saving…";
        window.clearTimeout(timer);
        timer = window.setTimeout(() => void save(), SAVE_DELAY_MS);
    });
    field.addEventListener("blur", () => void save());
    field.addEventListener("keydown", event => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        void save().then(onClose);
    });
    // The card's address link stretches over the whole card; the note must not follow it.
    for (const type of ["click", "pointerdown", "mousedown"] as const) {
        element.addEventListener(type, event => event.stopPropagation());
    }
    element.append(head, field);
    return { element, field, status };
}

/**
 * Shortlist notes as a second view of the card: "Add note" (or "View note" once there is one)
 * turns the card over to its note, which fills the card and saves as you type; "View details"
 * turns it back. Domain's own notes button now only opens the listing page, so it becomes
 * that switch.
 */
export function bindShortlistNotes(card: HTMLElement, url: string): void {
    const actions = card.querySelector<HTMLElement>('[data-testid="listing-card-buttons-wrapper"]');
    const button = actions && [...actions.querySelectorAll<HTMLButtonElement>("button")]
        .find(candidate => NATIVE_NOTES_LABEL.test(candidate.textContent?.trim() ?? ""));
    if (!actions || !button) return;
    const key = normalizeListingUrl(url);
    const open = (): boolean => card.dataset.edfNoteView === "true";

    const sync = (): void => {
        void readNotes().then(notes => {
            if (!card.isConnected) return;
            const note = noteFor(notes, key);
            const label = open() ? "View details" : note ? "View note" : "Add note";
            if (button.textContent !== label) button.textContent = label;
            button.ariaPressed = String(open());
            card.dataset.edfHasNote = String(Boolean(note));
            const view = card.querySelector<HTMLElement>(`[data-testid="${NOTE_VIEW_TEST_ID}"]`);
            const field = view?.querySelector("textarea");
            if (field && document.activeElement !== field && field.value !== note) field.value = note;
        });
    };
    const setOpen = (next: boolean): void => {
        let view = card.querySelector<HTMLElement>(`[data-testid="${NOTE_VIEW_TEST_ID}"]`);
        if (next && !view) {
            const created = createNoteView(key, () => setOpen(false));
            view = created.element;
            card.append(view);
            void readNotes().then(notes => {
                created.field.value = noteFor(notes, key);
                created.status.textContent = formatSaved(notes[key]?.updatedAt);
            });
        }
        if (!view) return;
        // The note covers the card down to its buttons, which stay where they are.
        view.style.bottom = `${card.getBoundingClientRect().bottom - actions.getBoundingClientRect().top}px`;
        card.dataset.edfNoteView = String(next);
        view.inert = !next;
        if (next) {
            const field = view.querySelector("textarea");
            window.setTimeout(() => {
                field?.focus({ preventScroll: true });
                field?.setSelectionRange(field.value.length, field.value.length);
            }, 120);
        } else if (view.contains(document.activeElement)) {
            button.focus({ preventScroll: true });
        }
        sync();
    };

    if (button.dataset.edfNotesBound !== "true") {
        button.dataset.edfNotesBound = "true";
        card.dataset.edfNoteCard = "true";
        button.addEventListener("click", event => {
            event.preventDefault();
            event.stopImmediatePropagation();
            setOpen(!open());
        }, { capture: true });
    }
    sync();
}

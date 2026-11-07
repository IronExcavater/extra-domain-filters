import { getFromStorage, setInStorage } from "../platform/storage";
import { createSvgIcon } from "./elements";
import { replaceWithGripCornerIcon, replaceWithGripHorizontalIcon, replaceWithGripVerticalIcon } from "./icons";

export interface PopupSize {
    height: number;
    width: number;
}

type ResizeHandleName = "bottom" | "bottom-left" | "left";

interface HandleInfo {
    cursor: string;
    name: ResizeHandleName;
    x: -1 | 0;
    y: 0 | 1;
}

// Only left/bottom/bottom-left: the popup's top-right corner is anchored to the toolbar icon,
// so top and right edges aren't meaningfully draggable — matches the direction-restricted
// Resizable from return-spotify-lyrics-v2's packages/ui/src/Resizable.tsx.
const HANDLES: readonly HandleInfo[] = [
    { cursor: "ew-resize", name: "left", x: -1, y: 0 },
    { cursor: "ns-resize", name: "bottom", x: 0, y: 1 },
    { cursor: "nesw-resize", name: "bottom-left", x: -1, y: 1 },
];

const STORAGE_KEY = "popupSize";
const MIN_WIDTH = 480;
const MIN_HEIGHT = 420;
const MAX_WIDTH = 800;
const MAX_HEIGHT = 600;
const DEFAULT_SIZE: PopupSize = { height: 600, width: 760 };

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function clampSize(size: PopupSize): PopupSize {
    return {
        height: clamp(size.height, MIN_HEIGHT, MAX_HEIGHT),
        width: clamp(size.width, MIN_WIDTH, MAX_WIDTH),
    };
}

function applySize(size: PopupSize): void {
    for (const element of [document.documentElement, document.body]) {
        element.style.width = `${size.width}px`;
        element.style.height = `${size.height}px`;
    }
    // Chrome sizes the popup window itself off the rendered layout box of the document, and
    // only re-measures it around actual layout passes. Force one synchronously so the resize is
    // picked up immediately during a drag instead of trailing a frame (or more) behind the mouse.
    void document.documentElement.offsetHeight;
}

function createHandleIcon(handle: HandleInfo): SVGSVGElement {
    const render = handle.name === "bottom-left"
        ? replaceWithGripCornerIcon
        : handle.name === "bottom"
            ? replaceWithGripHorizontalIcon
            : replaceWithGripVerticalIcon;
    const icon = createSvgIcon(render, "edf-popup-resize-handle-icon");

    // GripCorner points bottom-right in its source asset; rotate it to point bottom-left,
    // matching the corner it actually sits in.
    if (handle.name === "bottom-left") icon.classList.add("edf-popup-resize-handle-icon-corner");
    return icon;
}

function createHandle(handle: HandleInfo, size: PopupSize): HTMLElement {
    const element = document.createElement("div");
    let dragPointerId: number | undefined;

    element.className = `edf-popup-resize-handle edf-popup-resize-handle-${handle.name}`;
    element.style.cursor = handle.cursor;
    element.ariaHidden = "true";
    element.append(createHandleIcon(handle));

    element.addEventListener("pointerdown", event => {
        event.preventDefault();
        element.setPointerCapture(event.pointerId);
        dragPointerId = event.pointerId;
        element.dataset.active = "true";
    });
    element.addEventListener("pointermove", event => {
        if (dragPointerId !== event.pointerId) return;

        size.width = clamp(size.width + event.movementX * handle.x, MIN_WIDTH, MAX_WIDTH);
        size.height = clamp(size.height + event.movementY * handle.y, MIN_HEIGHT, MAX_HEIGHT);
        applySize(size);
    });
    const endDrag = (event: PointerEvent): void => {
        if (dragPointerId !== event.pointerId) return;
        if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
        dragPointerId = undefined;
        delete element.dataset.active;
        void setInStorage(STORAGE_KEY, size);
    };
    element.addEventListener("pointerup", endDrag);
    element.addEventListener("pointercancel", endDrag);

    return element;
}

export async function enableResizablePopup(shell: HTMLElement): Promise<void> {
    const stored = await getFromStorage<PopupSize>(STORAGE_KEY);
    const size = clampSize(stored ?? DEFAULT_SIZE);
    applySize(size);

    for (const handle of HANDLES) {
        shell.append(createHandle(handle, size));
    }
}

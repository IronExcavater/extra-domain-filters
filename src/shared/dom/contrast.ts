type Rgb = {
    a: number;
    b: number;
    g: number;
    r: number;
};

interface ContrastSyncOptions {
    scope?: Element;
}

const DARK_FOREGROUND: Rgb = { a: 1, b: 31, g: 41, r: 47 };
const LIGHT_FOREGROUND: Rgb = { a: 1, b: 255, g: 255, r: 255 };
const DARK_FOREGROUND_VALUE = "rgb(47 41 31)";
const LIGHT_FOREGROUND_VALUE = "#fff";

function parseRgb(value: string): Rgb | undefined {
    const match = value.match(
        /^rgba?\(\s*([\d.]+)(?:\s+|,\s*)([\d.]+)(?:\s+|,\s*)([\d.]+)(?:\s*[/,]\s*([\d.]+%?))?\s*\)$/i,
    );

    if (!match) return undefined;

    const alpha = match[4]?.endsWith("%")
        ? Number.parseFloat(match[4]) / 100
        : Number.parseFloat(match[4] ?? "1");

    return {
        a: Number.isFinite(alpha) ? alpha : 1,
        b: Number.parseFloat(match[3]),
        g: Number.parseFloat(match[2]),
        r: Number.parseFloat(match[1]),
    };
}

function luminance(color: Rgb): number {
    const channels = [color.r, color.g, color.b].map(channel => {
        const value = channel / 255;
        return value <= 0.03928
            ? value / 12.92
            : ((value + 0.055) / 1.055) ** 2.4;
    });

    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(first: Rgb, second: Rgb): number {
    const firstLuminance = luminance(first);
    const secondLuminance = luminance(second);
    const lighter = Math.max(firstLuminance, secondLuminance);
    const darker = Math.min(firstLuminance, secondLuminance);

    return (lighter + 0.05) / (darker + 0.05);
}

function sampleImage(image: HTMLImageElement, x: number, y: number): Rgb | undefined {
    if (!image.complete || image.naturalWidth === 0 || image.naturalHeight === 0) {
        return undefined;
    }

    const rect = image.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return undefined;

    const sourceX = Math.floor(((x - rect.left) / rect.width) * image.naturalWidth);
    const sourceY = Math.floor(((y - rect.top) / rect.height) * image.naturalHeight);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    if (!context) return undefined;

    canvas.width = 1;
    canvas.height = 1;

    try {
        context.drawImage(
            image,
            Math.max(0, Math.min(sourceX, image.naturalWidth - 1)),
            Math.max(0, Math.min(sourceY, image.naturalHeight - 1)),
            1,
            1,
            0,
            0,
            1,
            1,
        );

        const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
        return { a: a / 255, b, g, r };
    } catch {
        return undefined;
    }
}

function backgroundAtPoint(target: Element, x: number, y: number): Rgb | undefined {
    const element = target instanceof HTMLElement || target instanceof SVGElement
        ? target
        : undefined;
    const visibility = element?.style.visibility;

    if (element) {
        element.style.visibility = "hidden";
    }

    const elements = document.elementsFromPoint(x, y);

    if (element) {
        element.style.visibility = visibility ?? "";
    }

    for (const current of elements) {
        if (current === target || target.contains(current)) continue;

        if (current instanceof HTMLImageElement) {
            const imageColor = sampleImage(current, x, y);
            if (imageColor && imageColor.a > 0.2) return imageColor;

            return { a: 1, b: 24, g: 24, r: 24 };
        }

        if (getComputedStyle(current).backgroundImage !== "none") {
            return { a: 1, b: 24, g: 24, r: 24 };
        }

        const color = parseRgb(getComputedStyle(current).backgroundColor);
        if (color && color.a > 0.2) return color;
    }

    return parseRgb(getComputedStyle(document.body).backgroundColor);
}

function intersects(first: DOMRect, second: DOMRect): boolean {
    return !(
        first.right < second.left ||
        first.left > second.right ||
        first.bottom < second.top ||
        first.top > second.bottom
    );
}

function sampleScopedImages(scope: Element, targetRect: DOMRect): Rgb[] {
    const x = targetRect.left + targetRect.width / 2;
    const y = targetRect.top + targetRect.height / 2;

    return [...scope.querySelectorAll<HTMLImageElement>("img")]
        .filter(image => {
            const rect = image.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && intersects(rect, targetRect);
        })
        .map(image => sampleImage(image, x, y) ?? { a: 1, b: 24, g: 24, r: 24 });
}

function readableForegroundFor(color: Rgb): string {
    return contrastRatio(color, LIGHT_FOREGROUND) >= contrastRatio(color, DARK_FOREGROUND)
        ? LIGHT_FOREGROUND_VALUE
        : DARK_FOREGROUND_VALUE;
}

function readableForegroundForSamples(colors: readonly Rgb[]): string | undefined {
    if (colors.length === 0) return undefined;

    const lightMinimum = Math.min(...colors.map(color => contrastRatio(color, LIGHT_FOREGROUND)));
    const darkMinimum = Math.min(...colors.map(color => contrastRatio(color, DARK_FOREGROUND)));

    return lightMinimum >= darkMinimum
        ? LIGHT_FOREGROUND_VALUE
        : DARK_FOREGROUND_VALUE;
}

function applyColor(element: HTMLElement | SVGElement, color: string): void {
    element.classList.add("edf-adaptive-foreground");
    element.style.setProperty("--edf-adaptive-foreground", color);
}

export function syncForegroundWithBackgroundAt(
    element: HTMLElement | SVGElement,
    options: ContrastSyncOptions = {},
): void {
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const samplePoints = [
        [0.5, 0.5],
        [0.25, 0.25],
        [0.75, 0.25],
        [0.25, 0.75],
        [0.75, 0.75],
    ] as const;
    const colors = samplePoints
        .map(([x, y]) => backgroundAtPoint(
            element,
            rect.left + rect.width * x,
            rect.top + rect.height * y,
        ))
        .filter((color): color is Rgb => Boolean(color));
    const scopedImageColors = options.scope
        ? sampleScopedImages(options.scope, rect)
        : [];
    const sampledColors = scopedImageColors.length > 0 ? scopedImageColors : colors;
    const color = readableForegroundForSamples(sampledColors) ??
        (sampledColors[0] ? readableForegroundFor(sampledColors[0]) : undefined);

    if (!color) return;

    applyColor(element, color);
}

export function queueForegroundContrastSync(
    element: HTMLElement | SVGElement,
    options: ContrastSyncOptions = {},
): void {
    requestAnimationFrame(() => {
        syncForegroundWithBackgroundAt(element, options);
        window.setTimeout(() => syncForegroundWithBackgroundAt(element, options), 250);
    });
}

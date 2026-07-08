import binSvg from "../../public/bin.svg?raw";
import shortlistSvg from "../../public/shortlist.svg?raw";

export type SvgAttributes = Record<string, string | number>;

export function setSvgIcon(
    target: SVGElement,
    rawSvg: string,
    attributes: SvgAttributes = {},
): void {
    const source = new DOMParser()
        .parseFromString(rawSvg, "image/svg+xml")
        .documentElement;

    const viewBox = source.getAttribute("viewBox");

    if (viewBox) {
        target.setAttribute("viewBox", viewBox);
    }

    target.replaceChildren(
        ...Array.from(
            source.childNodes,
            node => document.importNode(node, true),
        ),
    );

    for (const [name, value] of Object.entries(attributes)) {
        target.setAttribute(name, String(value));
    }
}

export function replaceWithBinIcon(target: SVGElement): void {
    setSvgIcon(target, binSvg);
}

export function replaceWithShortlistIcon(target: SVGElement): void {
    setSvgIcon(target, shortlistSvg);
}

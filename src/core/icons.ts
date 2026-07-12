import bathSvg from "../../public/bath.svg?raw";
import bedSvg from "../../public/bed.svg?raw";
import binSvg from "../../public/bin.svg?raw";
import chevronSvg from "../../public/chevron.svg?raw";
import eyeOffSvg from "../../public/eye-off.svg?raw";
import eyeSvg from "../../public/eye.svg?raw";
import parkingSvg from "../../public/parking.svg?raw";
import shortlistSvg from "../../public/shortlist.svg?raw";
import unbinSvg from "../../public/unbin.svg?raw";

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

export function replaceWithUnbinIcon(target: SVGElement): void {
    setSvgIcon(target, unbinSvg);
}

export function replaceWithShortlistIcon(target: SVGElement): void {
    setSvgIcon(target, shortlistSvg);
}

export function replaceWithBedIcon(target: SVGElement): void {
    setSvgIcon(target, bedSvg);
}

export function replaceWithBathIcon(target: SVGElement): void {
    setSvgIcon(target, bathSvg);
}

export function replaceWithParkingIcon(target: SVGElement): void {
    setSvgIcon(target, parkingSvg);
}

export function replaceWithEyeIcon(target: SVGElement): void {
    setSvgIcon(target, eyeSvg);
}

export function replaceWithEyeOffIcon(target: SVGElement): void {
    setSvgIcon(target, eyeOffSvg);
}

export function replaceWithChevronIcon(target: SVGElement): void {
    setSvgIcon(target, chevronSvg);
}

import doorSvg from "../../../public/icons/account/door.svg?raw";
import settingsSvg from "../../../public/icons/account/settings.svg?raw";
import closeSvg from "../../../public/icons/actions/close.svg?raw";
import externalSvg from "../../../public/icons/actions/external.svg?raw";
import eyeOffSvg from "../../../public/icons/actions/hide.svg?raw";
import plusSvg from "../../../public/icons/actions/plus.svg?raw";
import trashRestoreSvg from "../../../public/icons/actions/restore.svg?raw";
import saveSvg from "../../../public/icons/actions/save.svg?raw";
import shareSvg from "../../../public/icons/actions/share.svg?raw";
import eyeSvg from "../../../public/icons/actions/show.svg?raw";
import shortlistFilledSvg from "../../../public/icons/actions/star-filled.svg?raw";
import shortlistOutlineSvg from "../../../public/icons/actions/star.svg?raw";
import trashSvg from "../../../public/icons/actions/trash.svg?raw";
import bathSvg from "../../../public/icons/amenities/bath.svg?raw";
import bedSvg from "../../../public/icons/amenities/bed.svg?raw";
import parkingSvg from "../../../public/icons/amenities/parking.svg?raw";
import chevronSvg from "../../../public/icons/navigation/chevron.svg?raw";
import bellFilledSvg from "../../../public/icons/search/bell-filled.svg?raw";
import bellOutlineSvg from "../../../public/icons/search/bell.svg?raw";
import moreCircleSvg from "../../../public/icons/search/more.svg?raw";
import savedSearchSvg from "../../../public/icons/search/search.svg?raw";
import chromeWebStoreSvg from "../../../public/icons/support/chrome-web-store.svg?raw";
import githubSvg from "../../../public/icons/support/github.svg?raw";
import itchioSvg from "../../../public/icons/support/itchio.svg?raw";
import linkedInSvg from "../../../public/icons/support/linked-in.svg?raw";

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
    setSvgIcon(target, trashSvg);
}

export function replaceWithUnbinIcon(target: SVGElement): void {
    setSvgIcon(target, trashRestoreSvg);
}

export function replaceWithShortlistIcon(target: SVGElement): void {
    setSvgIcon(target, shortlistFilledSvg);
}

export function replaceWithShareIcon(target: SVGElement): void {
    setSvgIcon(target, shareSvg);
}

export function replaceWithSaveIcon(target: SVGElement): void {
    setSvgIcon(target, saveSvg);
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

export function replaceWithCloseIcon(target: SVGElement): void {
    setSvgIcon(target, closeSvg);
}

export function replaceWithExternalIcon(target: SVGElement): void {
    setSvgIcon(target, externalSvg);
}

export function replaceWithGithubIcon(target: SVGElement): void {
    setSvgIcon(target, githubSvg);
}

export function replaceWithChromeWebStoreIcon(target: SVGElement): void {
    setSvgIcon(target, chromeWebStoreSvg);
}

export function replaceWithItchioIcon(target: SVGElement): void {
    setSvgIcon(target, itchioSvg);
}

export function replaceWithLinkedInIcon(target: SVGElement): void {
    setSvgIcon(target, linkedInSvg);
}

export function replaceWithPopupStarIcon(target: SVGElement): void {
    setSvgIcon(target, shortlistOutlineSvg);
}

export function replaceWithPopupSavedSearchIcon(target: SVGElement): void {
    setSvgIcon(target, savedSearchSvg);
}

export function replaceWithPopupCogIcon(target: SVGElement): void {
    setSvgIcon(target, settingsSvg);
}

export function replaceWithPopupDoorIcon(target: SVGElement): void {
    setSvgIcon(target, doorSvg);
}

export function replaceWithPopupPlusIcon(target: SVGElement): void {
    setSvgIcon(target, plusSvg);
}

export function replaceWithSavedSearchBellIcon(target: SVGElement): void {
    setSvgIcon(target, bellOutlineSvg);
}

export function replaceWithSavedSearchBellFilledIcon(target: SVGElement): void {
    setSvgIcon(target, bellFilledSvg);
}

export function replaceWithSavedSearchKebabIcon(target: SVGElement): void {
    setSvgIcon(target, moreCircleSvg);
}

export function replaceWithSavedSearchTrashIcon(target: SVGElement): void {
    setSvgIcon(target, trashSvg);
}

export function replaceWithSavedSearchShareIcon(target: SVGElement): void {
    setSvgIcon(target, shareSvg);
}

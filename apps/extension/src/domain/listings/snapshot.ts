import { isPlainObject } from "../../utils/types";
import type { ListingSnapshot } from "../matching";

function textValue(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
}

function stringList(value: unknown): string[] | undefined {
    return Array.isArray(value) && value.every(item => typeof item === "string") ? value : undefined;
}

function listingFeatures(value: unknown): ListingSnapshot["features"] | undefined {
    if (!isPlainObject(value)) return undefined;

    const bathrooms = textValue(value.bathrooms);
    const bedrooms = textValue(value.bedrooms);
    const parking = textValue(value.parking);
    if (!bathrooms && !bedrooms && !parking) return undefined;

    return { bathrooms, bedrooms, parking };
}

export function parseListingSnapshot(value: unknown): ListingSnapshot | undefined {
    if (!isPlainObject(value)) return undefined;

    const url = textValue(value.url);
    const title = textValue(value.title);
    const text = textValue(value.text);
    if (!url || !title || text === undefined) return undefined;

    return {
        displayAddress: textValue(value.displayAddress),
        features: listingFeatures(value.features),
        imageUrls: stringList(value.imageUrls),
        price: textValue(value.price),
        propertyType: textValue(value.propertyType),
        text,
        thumbnailUrl: textValue(value.thumbnailUrl),
        title,
        url,
    };
}

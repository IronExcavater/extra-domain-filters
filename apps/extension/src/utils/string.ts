export function toTitleCase(value: string): string {
    return value.toLowerCase().replace(/(^|[^\p{L}\p{N}])(\p{L})/gu, (_, separator, letter) => {
        return separator + letter.toUpperCase();
    });
}

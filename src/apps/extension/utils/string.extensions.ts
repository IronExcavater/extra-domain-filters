declare global {
    interface String {
        toTitleCase(): string;
        toSentenceCase(): string;
    }
}

if (!String.prototype.toTitleCase) {
    Object.defineProperty(String.prototype, 'toTitleCase', {
        value: function (this: string): string {
            return this.toLowerCase().replace(/(^|[^\p{L}\p{N}])(\p{L})/gu, (_, separator, letter) => {
                return separator + letter.toUpperCase()
            });
        },
        enumerable: false,
        writable: true,
        configurable: true,
    });
}

if (!String.prototype.toSentenceCase) {
    Object.defineProperty(String.prototype, 'toSentenceCase', {
        value: function (this: string): string {
            return this.toLowerCase().replace(/(^\s*|[.!?]\s+)./g, match => match.toUpperCase());
        },
        enumerable: false,
        writable: true,
        configurable: true,
    });
}

export {};
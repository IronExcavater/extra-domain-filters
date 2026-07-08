declare global {
    interface Math {
        clamp(value: number, min: number, max: number): number;
        percent(value: number, min: number, max: number): number;
    }
}

if (!Math.clamp) {
    Object.defineProperty(Math, 'clamp', {
        value: function (this: Math, value: number, min: number, max: number): number {
            return this.min(this.max(value, min), max);
        },
        enumerable: false,
        writable: true,
        configurable: true,
    });
}

if (!Math.percent) {
    Object.defineProperty(Math, 'percent', {
        value: function (this: Math, value: number, min: number, max: number): number {
            return ((value - min) / (max - min)) * 100;
        },
        enumerable: false,
        writable: true,
        configurable: true,
    });
}

export {};
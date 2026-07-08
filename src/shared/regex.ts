import { toArray, OneOrMany } from "./types";

interface MatchOptions {
    path?: OneOrMany<string>;
    prefix?: OneOrMany<string>;
    pattern?: RegExp;
    search?: Readonly<Record<string, string>>;
}

function normalizePath(path: string): string {
    return path === '/' ? path : path.replace(/\/+$/, '');
}

function matchOne(options: MatchOptions): (url: URL) => boolean {
    const paths = toArray(options.path).map(normalizePath);
    const prefixes = toArray(options.prefix).map(normalizePath);

    return url => {
        const pathname = normalizePath(url.pathname);

        if (paths.length > 0 && !paths.includes(pathname)) return false;

        if (prefixes.length > 0 && !prefixes.some(prefix => pathname.startsWith(prefix))) return false;

        if (options.pattern) {
            options.pattern.lastIndex = 0;

            if (!options.pattern?.test(url.pathname)) return false;
        }

        if (options.search &&
            !Object.entries(options.search).every(
                ([key, value]) => url.searchParams.get(key) === value
            )
        ) return false;

        return true;
    };
}

// A single options object requires all its own fields to match (AND). Passing an array of
// options ORs across them: the URL matches if any one config matches.
export function match(options: OneOrMany<MatchOptions>): (url: URL) => boolean {
    const matchers = toArray(options).map(matchOne);
    return url => matchers.some(matcher => matcher(url));
}
import { match } from '../core/regex';
import { Route } from '../core/router';

// Real listing IDs observed are 8 digits (e.g. /28-box-drive-cotswold-hills-qld-4350-18205976),
// not the 9-12 this previously required — no route matched any real listing page. Left open-ended
// rather than re-guessing a fixed range, since Domain's ID length isn't something we control.
const LISTING_PATH_PATTERN = /^\/[^/]+-\d{6,}\/?$/;

export const routes: Route[] = [
    {
        id: 'home',
        test: match({
            path: '/'
        }),
        load: () => import('../pages/home.ts'),
    },
    {
        id: 'search',
        test: match({
            prefix: ['/sale', '/rent']
        }),
        load: () => import('../pages/search.ts'),
    },
    {
        id: 'listing',
        test: match({
            pattern: LISTING_PATH_PATTERN
        }),
        load: () => import('../pages/listing.ts'),
    },
    {
        id: 'blacklist',
        test: match({
            path: '/user/shortlist',
            search: {
                blacklist: '1',
            },
        }),
        load: () => import('../pages/blacklist.ts'),
    },
    {
        id: 'shortlist',
        test: match({
            path: '/user/shortlist',
        }),
        load: () => import('../pages/shortlist.ts'),
    },
]
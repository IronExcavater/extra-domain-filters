import { match } from '../shared/regex';
import { Route } from '../shared/router';

const LISTING_PATH_PATTERN = /^\/[^/]+-\d{9,12}\/?$/;

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
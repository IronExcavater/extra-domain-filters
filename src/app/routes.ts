import { Route } from '../shared/platform/router';
import { match } from '../shared/utils/regex';

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
        id: 'project',
        test: match({
            prefix: ['/project/']
        }),
        load: () => import('../pages/listing.ts'),
    },
    {
        id: 'agency',
        test: match({
            prefix: ['/real-estate-agencies/']
        }),
        load: () => import('../pages/agency.ts'),
    },
    {
        id: 'profile',
        test: match({
            path: '/user/user-profile',
        }),
        load: () => import('../pages/profile.ts'),
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

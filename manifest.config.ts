import { defineManifest } from '@crxjs/vite-plugin';
import { loadEnv } from 'vite';
import pkg from './package.json';

export default defineManifest(({ mode }) => {
    const env = loadEnv(mode, '.', 'VITE_');
    const oauthClientId = env.VITE_GOOGLE_OAUTH_CLIENT_ID?.trim();

    return {
        manifest_version: 3,
        name: pkg.name,
        version: pkg.version,
        description: pkg.description,
        minimum_chrome_version: '105',
        icons: {
            16: 'public/icons/brand/icon-16.png',
            32: 'public/icons/brand/icon-32.png',
            48: 'public/icons/brand/icon-48.png',
            128: 'public/icons/brand/icon-128.png',
        },
        action: {
            default_icon: {
                16: 'public/icons/brand/icon-16.png',
                32: 'public/icons/brand/icon-32.png',
                48: 'public/icons/brand/icon-48.png',
            },
            default_popup: 'src/popup/popup.html',
        },
        background: {
            service_worker: 'src/background/background.ts',
            type: 'module',
        },
        permissions: ['storage', 'alarms', 'unlimitedStorage', 'identity', 'activeTab'],
        host_permissions: [
            '*://domain.com.au/*',
            '*://www.domain.com.au/*',
            'https://firestore.googleapis.com/*',
            'https://identitytoolkit.googleapis.com/*',
            'https://securetoken.googleapis.com/*',
        ],
        oauth2: oauthClientId
            ? {
                client_id: oauthClientId,
                scopes: [
                    'openid',
                    'https://www.googleapis.com/auth/userinfo.email',
                    'https://www.googleapis.com/auth/userinfo.profile',
                ],
            }
            : undefined,
        web_accessible_resources: [{
            resources: ['public/fonts/F37Bolton-VF.ttf'],
            matches: ['*://domain.com.au/*', '*://www.domain.com.au/*'],
        }],
        content_scripts: [
            {
                matches: ['*://domain.com.au/*', '*://www.domain.com.au/*'],
                js: ['src/app/main.ts'],
                css: [
                    'src/app/tokens.css',
                    'src/shared/ui/domainControls.css',
                    'src/shared/ui/popover.css',
                    'src/shared/ui/collection.css',
                    'src/shared/ui/sort.css',
                    'src/shared/ui/toast.css',
                    'src/shared/ui/tooltip.css',
                    'src/features/filters/styles.css',
                    'src/features/blacklist/styles.css',
                    'src/features/saved-searches/card/card.css',
                    'src/features/saved-searches/alertPopover.css',
                    'src/features/listing-cards/styles.css',
                    'src/features/listing-cards/exclusion/styles.css',
                    'src/features/listing-cards/carousel.css',
                    'src/features/navigation/styles.css',
                    'src/features/account/styles.css',
                    'src/features/settings/settings.css',
                    'src/features/user-listings/styles.css',
                ],
                run_at: 'document_idle',
            },
        ],
    };
});

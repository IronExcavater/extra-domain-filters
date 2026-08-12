import { defineManifest } from '@crxjs/vite-plugin';
import { loadEnv } from 'vite';
import pkg from './package.json';
import { getAuthRuntime } from './src/shared/config/auth';

const DOMAIN_MATCH_PATTERNS = ['*://domain.com.au/*', '*://www.domain.com.au/*'];

export default defineManifest(({ mode }) => {
    const env = loadEnv(mode, '.', 'VITE_');
    const oauthClientId = env.VITE_GOOGLE_OAUTH_CLIENT_ID?.trim();
    const authRuntime = getAuthRuntime(mode);

    return {
        manifest_version: 3,
        name: pkg.name,
        version: pkg.version,
        description: pkg.description,
        minimum_chrome_version: '116',
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
            default_popup: 'src/apps/extension/popup/popup.html',
        },
        background: {
            service_worker: 'src/apps/extension/background/background.ts',
            type: 'module',
        },
        permissions: ['storage', 'alarms', 'unlimitedStorage', 'identity', 'activeTab', 'offscreen'],
        content_security_policy: {
            extension_pages: `script-src 'self'; object-src 'self'; frame-src ${authRuntime.bridgeOrigin}`,
        },
        host_permissions: [
            ...DOMAIN_MATCH_PATTERNS,
            'https://firestore.googleapis.com/*',
            'https://identitytoolkit.googleapis.com/*',
            'https://securetoken.googleapis.com/*',
            `${authRuntime.bridgeOrigin}/*`,
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
            resources: ['public/fonts/F37Bolton-VF.ttf', 'src/apps/extension/offscreen/offscreen.html'],
            matches: DOMAIN_MATCH_PATTERNS,
        }],
        content_scripts: [
            {
                matches: DOMAIN_MATCH_PATTERNS,
                js: ['src/apps/extension/content/main.ts'],
                css: [
                    'src/apps/extension/content/tokens.css',
                    'src/apps/extension/ui/domainControls.css',
                    'src/apps/extension/ui/popover.css',
                    'src/apps/extension/ui/collection.css',
                    'src/apps/extension/ui/sort.css',
                    'src/apps/extension/ui/toast.css',
                    'src/apps/extension/ui/tooltip.css',
                    'src/apps/extension/features/filters/styles.css',
                    'src/apps/extension/features/blacklist/styles.css',
                    'src/apps/extension/features/saved-searches/card/card.css',
                    'src/apps/extension/features/saved-searches/alertPopover.css',
                    'src/apps/extension/features/listing-cards/styles.css',
                    'src/apps/extension/features/listing-cards/exclusion/styles.css',
                    'src/apps/extension/features/listing-cards/carousel.css',
                    'src/apps/extension/features/navigation/styles.css',
                    'src/apps/extension/features/account/styles.css',
                    'src/apps/extension/features/settings/settings.css',
                    'src/apps/extension/features/user-listings/styles.css',
                ],
                run_at: 'document_idle',
            },
        ],
    };
});

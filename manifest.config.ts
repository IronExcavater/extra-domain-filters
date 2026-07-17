import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json';

export default defineManifest({
    manifest_version: 3,
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
    minimum_chrome_version: '88',
    icons: {
        16: 'public/icons/icon16.png',
        32: 'public/icons/icon32.png',
        48: 'public/icons/icon48.png',
        128: 'public/icons/icon128.png',
    },
    action: {
        default_icon: {
            16: 'public/icons/icon16.png',
            32: 'public/icons/icon32.png',
            48: 'public/icons/icon48.png',
        },
        default_popup: 'src/popup/popup.html',
    },
    background: {
        service_worker: 'src/background/background.ts',
        type: 'module',
    },
    permissions: ['storage', 'alarms', 'unlimitedStorage'],
    host_permissions: ['*://domain.com.au/*', '*://www.domain.com.au/*'],
    content_scripts: [
        {
            matches: ['*://domain.com.au/*', '*://www.domain.com.au/*'],
            js: ['src/app/main.ts'],
            css: ['src/app/main.css'],
            run_at: 'document_idle',
        },
    ],
    web_accessible_resources: [
        {
            matches: ['*://domain.com.au/*', '*://www.domain.com.au/*'],
            resources: ['src/app/main.ts']
        }
    ]
});

import { fileURLToPath, URL } from 'node:url';
import { crx } from '@crxjs/vite-plugin';
import { defineConfig, type PluginOption } from 'vite';
import zip from 'vite-plugin-zip-pack';
import manifest from './manifest.config.ts';
import { name, version } from './package.json';
import { getAuthRuntime } from './src/shared/config/auth';

export default defineConfig(({ command, mode }) => {
    const authRuntime = getAuthRuntime(mode);
    const plugins: PluginOption[] = [
        crx({
            manifest,
            liveReload: true,
            contentScripts: {
                hmrTimeout: 10_000,
            },
        }),
    ];

    if (command === 'build') {
        plugins.push(zip({ outDir: 'release', outFileName: `crx-${name}-${version}.zip` }));
    }

    return {
        build: {
            rollupOptions: {
                input: {
                    offscreen: fileURLToPath(new URL('./src/apps/extension/offscreen/offscreen.html', import.meta.url)),
                },
            },
        },
        define: {
            __BUNDLED_DEV__: "false",
            __AUTH_BRIDGE_URL__: JSON.stringify(authRuntime.bridgeUrl),
            __AUTH_BRIDGE_MODE__: JSON.stringify(authRuntime.mode),
            __SERVER_FORWARD_CONSOLE__: "false",
        },
        plugins,
        resolve: {
            alias: {
                '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
            },
        },
    };
});

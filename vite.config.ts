import { fileURLToPath, URL } from 'node:url';
import { crx } from '@crxjs/vite-plugin';
import { defineConfig, type PluginOption } from 'vite';
import zip from 'vite-plugin-zip-pack';
import manifest from './manifest.config.ts';
import { name, version } from './package.json';

export default defineConfig(({ command }) => {
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
                    offscreen: fileURLToPath(new URL('./src/offscreen/offscreen.html', import.meta.url)),
                },
            },
        },
        define: {
            __BUNDLED_DEV__: "false",
            __SERVER_FORWARD_CONSOLE__: "false",
        },
        plugins,
        resolve: {
            alias: {
                '@': '/src',
            },
        },
    };
});

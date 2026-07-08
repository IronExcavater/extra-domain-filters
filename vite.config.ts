import { crx } from '@crxjs/vite-plugin';
import { defineConfig, type PluginOption } from 'vite';
import zip from 'vite-plugin-zip-pack';
import manifest from './manifest.config.ts';
import { name, version } from './package.json';

export default defineConfig(({ command }) => {
    const plugins: PluginOption[] = [crx({ manifest, liveReload: true })];

    if (command === 'build') {
        plugins.push(zip({ outDir: 'release', outFileName: `crx-${name}-${version}.zip` }));
    }

    return {
        plugins,
        resolve: {
            alias: {
                '@': '/src',
            },
        },
    };
});

import { defineConfig, LibraryFormats, PluginOption } from 'vite';
import webExtension, { readJsonFile } from 'vite-plugin-web-extension';
import zip from 'vite-plugin-zip-pack';
import * as path from 'path';
import type { PackageJson } from 'type-fest';
import react from '@vitejs/plugin-react';
import semver from 'semver';

const emptyOutDir = !process.argv.includes('--watch');

function useSpecialFormat(
  entriesToUse: string[],
  format: LibraryFormats,
): PluginOption {
  return {
    name: 'use-special-format',
    config(config) {
      // entry can be string | string[] | {[entryAlias: string]: string}
      const entry = config.build?.lib && config.build.lib.entry;
      let shouldUse = false;

      if (typeof entry === 'string') {
        shouldUse = entriesToUse.includes(entry);
      } else if (Array.isArray(entry)) {
        shouldUse = entriesToUse.some((e) => entry.includes(e));
      } else if (entry && typeof entry === 'object') {
        const entryKeys = Object.keys(entry);
        shouldUse = entriesToUse.some((e) => entryKeys.includes(e));
      }

      if (shouldUse) {
        config.build = config.build ?? {};
        // @ts-expect-error: lib needs to be an object, forcing it.
        config.build.lib =
          typeof config.build.lib == 'object' ? config.build.lib : {};
        // @ts-expect-error: lib is an object
        config.build.lib.formats = [format];
      }
    },
  };
}

/**
 * Get the extension version based on the ScreenTrail version.
 */
function getExtensionVersion(rrwebVersion: string): string {
  const parsedVersion = semver.parse(rrwebVersion.replace('^', ''));

  if (!parsedVersion) {
    throw new Error('Invalid version format');
  }

  if (parsedVersion.prerelease.length > 0) {
    // If it's a pre-release version like alpha or beta, strip the pre-release identifier
    return `${parsedVersion.major}.${parsedVersion.minor}.${parsedVersion.patch
      }.${parsedVersion.prerelease[1] || 0}`;
  } else if (rrwebVersion === '1.0.0') {
    // This version has already been released as the first version. We need to add a patch version to it to avoid publishing conflicts.
    return '1.0.0.0';
  } else {
    return rrwebVersion;
  }
}

export default defineConfig({
  root: 'src',
  // Configure our outputs - nothing special, this is normal vite config
  build: {
    outDir: path.resolve(
      __dirname,
      'dist',
      process.env.TARGET_BROWSER as string,
    ),
    emptyOutDir,
  },
  // Add the webExtension plugin
  plugins: [
    react(),
    webExtension({
      // A function to generate manifest file dynamically.
      manifest: () => {
        const packageJson = readJsonFile('package.json') as PackageJson;
        type ManifestBase = {
          common: Record<string, unknown>;
          chrome: Record<string, unknown>;
          firefox: Record<string, unknown>;
        };
        const originalManifest = readJsonFile('./src/manifest.json') as {
          common: Record<string, unknown>;
          v2: ManifestBase;
          v3: ManifestBase;
        };
        const ManifestVersion =
          process.env.TARGET_BROWSER === 'chrome' ? 'v3' : 'v2';
        const BrowserName =
          process.env.TARGET_BROWSER === 'chrome' ? 'chrome' : 'firefox';
        const commonManifest = originalManifest.common;
        const rrwebVersion = packageJson.dependencies!.rrweb!.replace('^', '');
        const manifest = {
          version: getExtensionVersion(rrwebVersion),
          author: packageJson.author,
          version_name: rrwebVersion,
          ...commonManifest,
        };
        Object.assign(
          manifest,
          originalManifest[ManifestVersion].common,
          originalManifest[ManifestVersion][BrowserName],
        );
        return manifest;
      },
      browser: process.env.TARGET_BROWSER,
      webExtConfig: {
        startUrl: ['github.com/rrweb-io/rrweb'],
        watchIgnored: ['*.md', '*.log'],
        target: process.env.TARGET_BROWSER,
      },
      additionalInputs: ['pages/index.html', 'content/inject.ts'],
      entryPoints: [
        'src/manifest.json',
        'src/popup/index.tailwind.tsx',
        'src/options/index.tailwind.tsx',
        'src/pages/index.tailwind.tsx',
      ],
    }) as PluginOption,
    // https://github.com/aklinker1/vite-plugin-web-extension/issues/50#issuecomment-1317922947
    // transfer inject.ts to iife format to avoid error
    useSpecialFormat(
      [path.resolve(__dirname, 'src/content/inject.ts')],
      'iife',
    ),
    process.env.ZIP === 'true' &&
    zip({
      inDir: `dist/${process.env.TARGET_BROWSER || 'chrome'}`,
      outDir: 'dist',
      outFileName: `${process.env.TARGET_BROWSER || 'chrome'}.zip`,
    }),
  ],
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './src'),
    },
  },
});

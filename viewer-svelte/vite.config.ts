import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
	plugins: [sveltekit()],
	resolve: {
		alias: {
			$services: path.resolve(__dirname, '../src/services'),
			$domain: path.resolve(__dirname, '../src/domain'),
			$storage: path.resolve(__dirname, '../src/storage')
		}
	},
	// Include markdown files as assets for ?raw imports
	assetsInclude: ['**/*.md'],
	// Fix SSR issues with packages that use .svelte files
	ssr: {
		noExternal: ['phosphor-svelte']
	},
	server: {
		port: 5176,
		host: true,
		allowedHosts: ['tripbot.ngrok.io'],
		fs: {
			// Allow serving files from the parent directory
			allow: ['..']
		}
	},
	preview: {
		port: 5176
	}
});

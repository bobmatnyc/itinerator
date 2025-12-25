<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	let swaggerUIContainer: HTMLDivElement;

	onMount(async () => {
		if (!browser) return;

		// Dynamically import Swagger UI (client-side only)
		const SwaggerUIBundle = (await import('swagger-ui-dist/swagger-ui-bundle.js')).default;
		const SwaggerUIStandalonePreset = (
			await import('swagger-ui-dist/swagger-ui-standalone-preset.js')
		).default;

		// Initialize Swagger UI
		SwaggerUIBundle({
			url: '/openapi.yaml',
			dom_id: '#swagger-ui',
			deepLinking: true,
			presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
			plugins: [SwaggerUIBundle.plugins.DownloadUrl],
			layout: 'StandaloneLayout',
			defaultModelsExpandDepth: 1,
			defaultModelExpandDepth: 1,
			docExpansion: 'list',
			filter: true,
			persistAuthorization: true,
			tryItOutEnabled: true,
			requestSnippetsEnabled: true,
			syntaxHighlight: {
				activate: true,
				theme: 'monokai'
			}
		});
	});
</script>

<svelte:head>
	<title>Itinerizer API Documentation</title>
	<link
		rel="stylesheet"
		type="text/css"
		href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css"
	/>
	<style>
		body {
			margin: 0;
			padding: 0;
		}
	</style>
</svelte:head>

<div id="swagger-ui" bind:this={swaggerUIContainer}></div>

<style>
	#swagger-ui {
		min-height: 100vh;
	}
</style>

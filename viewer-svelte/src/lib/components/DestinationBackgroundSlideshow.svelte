<script lang="ts">
  /**
   * DestinationBackgroundSlideshow - Rotating background images for destinations
   *
   * Features:
   * - Fetches multiple images from Unsplash API
   * - Auto-rotates through images every 8 seconds
   * - Smooth fade transitions between images
   * - Moderate opacity (35%) for visibility while maintaining readability
   * - Gradient overlay for text contrast
   */

  interface UnsplashImage {
    id: string;
    urls: {
      regular: string;
      small: string;
    };
    alt_description: string | null;
  }

  interface Props {
    destination: string;
    imageCount?: number;
    interval?: number;
    opacity?: number;
  }

  let {
    destination,
    imageCount = 5,
    interval = 8000,
    opacity = 0.35
  }: Props = $props();

  let images = $state<UnsplashImage[]>([]);
  let currentIndex = $state(0);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Unsplash Access Key from environment
  const UNSPLASH_ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY || '';

  // Fetch destination images
  async function fetchDestinationImages(dest: string) {
    loading = true;
    error = null;

    try {
      if (!UNSPLASH_ACCESS_KEY) {
        // Fallback to Lorem Picsum (no auth required)
        // Note: Does not provide destination-specific images, but provides working placeholders
        const timestamp = Date.now();
        images = Array.from({ length: imageCount }, (_, i) => ({
          id: `picsum-${i}`,
          urls: {
            regular: `https://picsum.photos/1600/900?random=${timestamp + i}`,
            small: `https://picsum.photos/800/450?random=${timestamp + i}`
          },
          alt_description: `${dest} travel destination`
        }));
        loading = false;
        return;
      }

      // Use official Unsplash API for better control
      const response = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(dest)}+travel&per_page=${imageCount}&orientation=landscape`,
        {
          headers: {
            Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Unsplash API error: ${response.status}`);
      }

      const data = await response.json();
      images = data.results || [];
      loading = false;
    } catch (e) {
      console.error('Failed to fetch destination images:', e);
      error = e instanceof Error ? e.message : 'Unknown error';
      loading = false;

      // Fallback to Lorem Picsum
      const timestamp = Date.now();
      images = [{
        id: 'fallback',
        urls: {
          regular: `https://picsum.photos/1600/900?random=${timestamp}`,
          small: `https://picsum.photos/800/450?random=${timestamp}`
        },
        alt_description: `${dest} travel destination`
      }];
    }
  }

  // Auto-advance slideshow
  $effect(() => {
    if (images.length <= 1) return;

    const timer = setInterval(() => {
      currentIndex = (currentIndex + 1) % images.length;
    }, interval);

    return () => clearInterval(timer);
  });

  // Fetch images when destination changes
  $effect(() => {
    if (destination) {
      fetchDestinationImages(destination);
    }
  });
</script>

<div class="slideshow-container">
  {#if loading}
    <!-- Loading state - show placeholder -->
    <div class="slide loading-slide"></div>
  {:else if images.length > 0}
    <!-- Slideshow images -->
    {#each images as image, index (image.id)}
      <div
        class="slide"
        class:active={index === currentIndex}
        style="background-image: url({image.urls.regular}); opacity: {index === currentIndex ? opacity : 0}"
      >
        <!-- Accessibility: Image alt text -->
        <span class="sr-only">{image.alt_description || destination}</span>
      </div>
    {/each}

    <!-- Gradient overlay for text readability -->
    <div class="background-overlay"></div>

    <!-- Optional: Slideshow indicators -->
    {#if images.length > 1}
      <div class="slideshow-indicators">
        {#each images as _, index}
          <button
            class="indicator"
            class:active={index === currentIndex}
            onclick={() => currentIndex = index}
            aria-label="Go to image {index + 1}"
          ></button>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .slideshow-container {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 300px;
    overflow: hidden;
    z-index: 0;
  }

  .slide {
    position: absolute;
    inset: 0;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    transition: opacity 2s ease-in-out;
  }

  .loading-slide {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    opacity: 0.1;
  }

  /* Gradient overlay for smooth transition to page background */
  .background-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 100%;
    background: linear-gradient(
      to bottom,
      transparent 0%,
      rgba(250, 250, 250, 0.5) 50%,
      rgba(250, 250, 250, 1) 100%
    );
    z-index: 1;
    pointer-events: none;
  }

  /* Slideshow indicators */
  .slideshow-indicators {
    position: absolute;
    bottom: 1rem;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 0.5rem;
    z-index: 2;
  }

  .indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: rgba(255, 255, 255, 0.5);
    border: 1px solid rgba(0, 0, 0, 0.1);
    cursor: pointer;
    transition: all 0.3s ease;
    padding: 0;
  }

  .indicator:hover {
    background-color: rgba(255, 255, 255, 0.8);
    transform: scale(1.2);
  }

  .indicator.active {
    background-color: rgba(255, 255, 255, 0.9);
    width: 24px;
    border-radius: 4px;
  }

  /* Screen reader only text */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
</style>

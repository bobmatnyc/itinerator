<script lang="ts">
  // New Trip Helper View - shown when creating a new trip with no segments yet

  interface Props {
    onPromptSelect?: (prompt: string) => void;
    destination?: string;
  }

  let { onPromptSelect, destination }: Props = $props();

  // Extract destination from title (e.g., "Croatia Business Trip" → "Croatia")
  function inferDestinationFromTitle(title: string | undefined): string | null {
    if (!title || title === 'New Itinerary') return null;

    const patterns = [
      /^(.+?)\s+(business\s+)?trip$/i,           // "Croatia Business Trip" → "Croatia"
      /^(.+?)\s+vacation$/i,                      // "Hawaii Vacation" → "Hawaii"
      /^(.+?)\s+adventure$/i,                     // "Japan Adventure" → "Japan"
      /^trip\s+to\s+(.+)$/i,                      // "Trip to Paris" → "Paris"
      /^visit(?:ing)?\s+(.+)$/i,                  // "Visiting London" → "London"
      /^(.+?)\s+getaway$/i,                       // "Paris Getaway" → "Paris"
    ];

    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match) {
        const dest = match[1].trim();
        if (!['new', 'my', 'our', 'the', 'a', 'an', 'weekend'].includes(dest.toLowerCase())) {
          return dest;
        }
      }
    }
    return null;
  }

  // Get clean destination name (infer from title if needed)
  let cleanDestination = $derived(
    destination ? (inferDestinationFromTitle(destination) || destination) : null
  );

  // Generate background image URL from destination using Unsplash Source
  let backgroundUrl = $derived(
    cleanDestination
      ? `https://source.unsplash.com/1600x900/?${encodeURIComponent(cleanDestination)},travel,city`
      : null
  );

  // Prompts for each checklist item
  const prompts = {
    destination: "Where would you like to go?",
    dates: "When are you planning to travel?",
    travelers: "Who will be joining you on this trip?",
    budget: "What's your budget and preferred travel style?",
    interests: "What activities and experiences interest you?"
  };

  function handleItemClick(prompt: string) {
    onPromptSelect?.(prompt);
  }
</script>

<div class="helper-view" class:has-background={backgroundUrl}>
  {#if backgroundUrl}
    <div
      class="destination-background"
      style="background-image: url({backgroundUrl})"
    ></div>
    <div class="background-overlay"></div>
  {/if}

  <div class="helper-content">
    <!-- Header -->
    <div class="header-section">
      <div class="header-icon">✈️</div>
      <h1 class="header-title">Let's Plan Your Trip!</h1>
      <p class="header-subtitle">I'll ask you a few questions to create the perfect itinerary</p>
    </div>

    <!-- What We'll Cover -->
    <div class="info-section">
      <h2 class="info-title">What We'll Cover</h2>
      <p class="info-subtitle">Click any item to start planning</p>
      <div class="checklist">
        <button class="checklist-item" onclick={() => handleItemClick(prompts.destination)} type="button">
          <div class="checklist-icon">📍</div>
          <div class="checklist-content">
            <div class="checklist-label">Destination</div>
            <div class="checklist-description">Where you want to go</div>
          </div>
        </button>

        <button class="checklist-item" onclick={() => handleItemClick(prompts.dates)} type="button">
          <div class="checklist-icon">📅</div>
          <div class="checklist-content">
            <div class="checklist-label">Dates</div>
            <div class="checklist-description">When you're traveling</div>
          </div>
        </button>

        <button class="checklist-item" onclick={() => handleItemClick(prompts.travelers)} type="button">
          <div class="checklist-icon">👥</div>
          <div class="checklist-content">
            <div class="checklist-label">Who's Traveling</div>
            <div class="checklist-description">Solo, couple, family, or group</div>
          </div>
        </button>

        <button class="checklist-item" onclick={() => handleItemClick(prompts.budget)} type="button">
          <div class="checklist-icon">💰</div>
          <div class="checklist-content">
            <div class="checklist-label">Budget & Style</div>
            <div class="checklist-description">Your travel preferences</div>
          </div>
        </button>

        <button class="checklist-item" onclick={() => handleItemClick(prompts.interests)} type="button">
          <div class="checklist-icon">⭐</div>
          <div class="checklist-content">
            <div class="checklist-label">Interests & Activities</div>
            <div class="checklist-description">What you want to experience</div>
          </div>
        </button>
      </div>
    </div>

    <!-- Tip -->
    <div class="tip-section">
      <div class="tip-icon">💡</div>
      <p class="tip-text">
        <strong>Tip:</strong> Answer in the chat panel on the left, or use the quick-select options I provide.
        Feel free to share as much or as little detail as you'd like!
      </p>
    </div>

    <!-- Getting Started -->
    <div class="cta-section">
      <div class="cta-icon">👈</div>
      <p class="cta-text">Ready to start? Look at the chat panel on the left to begin!</p>
    </div>
  </div>
</div>

<style>
  .helper-view {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    overflow-y: auto;
    background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #dbeafe 100%);
    padding: 1.25rem;
  }

  /* Destination background image */
  .destination-background {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    z-index: 0;
    opacity: 0;
    transition: opacity 1s ease-in-out;
  }

  .destination-background[style] {
    opacity: 1;
  }

  /* Gradient overlay for text readability */
  .background-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      to bottom,
      rgba(255, 255, 255, 0.85) 0%,
      rgba(255, 255, 255, 0.95) 50%,
      rgba(255, 255, 255, 1) 100%
    );
    z-index: 1;
  }

  .helper-content {
    position: relative;
    z-index: 2;
    max-width: 600px;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  /* Enhance text contrast when background is present */
  .has-background .header-title {
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  /* Header Section */
  .header-section {
    text-align: center;
    padding: 1.25rem 1.5rem;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 1rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }

  .header-icon {
    font-size: 3rem;
    margin-bottom: 0.5rem;
    animation: float 3s ease-in-out infinite;
  }

  @keyframes float {
    0%, 100% {
      transform: translateY(0px);
    }
    50% {
      transform: translateY(-10px);
    }
  }

  .header-title {
    font-size: 1.75rem;
    font-weight: 700;
    color: #1f2937;
    margin: 0 0 0.375rem 0;
  }

  .header-subtitle {
    font-size: 0.9375rem;
    color: #6b7280;
    margin: 0;
  }

  /* Info Section */
  .info-section {
    background: rgba(255, 255, 255, 0.9);
    padding: 1.25rem 1.5rem;
    border-radius: 1rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }

  .info-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 0.25rem 0;
    text-align: center;
  }

  .info-subtitle {
    font-size: 0.8125rem;
    color: #6b7280;
    margin: 0 0 1rem 0;
    text-align: center;
  }

  .checklist {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.625rem;
  }

  .checklist-item {
    display: flex;
    align-items: flex-start;
    gap: 0.625rem;
    padding: 0.75rem;
    background: #f9fafb;
    border-radius: 0.5rem;
    border: 2px solid #e5e7eb;
    transition: all 0.2s;
    cursor: pointer;
    width: 100%;
    text-align: left;
    font: inherit;
  }

  .checklist-item:hover {
    border-color: #3b82f6;
    background: #eff6ff;
    transform: translateX(4px);
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.2);
  }

  .checklist-item:active {
    transform: translateX(4px) scale(0.98);
  }

  .checklist-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
  }

  .checklist-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .checklist-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #1f2937;
  }

  .checklist-description {
    font-size: 0.75rem;
    color: #6b7280;
    line-height: 1.3;
  }

  /* Tip Section */
  .tip-section {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    background: rgba(255, 255, 255, 0.8);
    border-radius: 0.5rem;
    border: 2px solid #fbbf24;
    box-shadow: 0 4px 6px -1px rgba(251, 191, 36, 0.2);
  }

  .tip-icon {
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .tip-text {
    font-size: 0.8125rem;
    color: #4b5563;
    margin: 0;
    line-height: 1.5;
  }

  .tip-text strong {
    color: #1f2937;
    font-weight: 600;
  }

  /* CTA Section */
  .cta-section {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    background: rgba(59, 130, 246, 0.1);
    border-radius: 0.5rem;
    border: 2px solid #3b82f6;
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% {
      box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4);
    }
    50% {
      box-shadow: 0 0 0 8px rgba(59, 130, 246, 0);
    }
  }

  .cta-icon {
    font-size: 1.5rem;
    animation: pointLeft 1.5s ease-in-out infinite;
  }

  @keyframes pointLeft {
    0%, 100% {
      transform: translateX(0px);
    }
    50% {
      transform: translateX(-8px);
    }
  }

  .cta-text {
    font-size: 0.9375rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0;
  }

  /* Responsive */
  @media (max-width: 640px) {
    .helper-view {
      padding: 1rem;
    }

    .header-title {
      font-size: 1.5rem;
    }

    .header-subtitle {
      font-size: 1rem;
    }

    .header-icon {
      font-size: 3rem;
    }

    .checklist {
      grid-template-columns: 1fr;
    }

    .checklist-item {
      padding: 0.75rem;
    }

    .cta-text {
      font-size: 1rem;
    }
  }
</style>

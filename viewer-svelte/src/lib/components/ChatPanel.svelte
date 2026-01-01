<script lang="ts">
  import { onMount } from 'svelte';
  import {
    chatSessionId,
    chatMessages,
    chatLoading,
    chatError,
    structuredQuestions,
    streamingContent,
    isStreaming,
    isThinking,
    currentToolCall,
    itineraryUpdated,
    sessionTokens,
    sessionCost,
    pendingPrompt,
    createChatSession,
    sendMessageStreaming,
    sendContextMessage,
    resetChat,
  } from '../stores/chat.svelte';
  import { loadItinerary, selectedItinerary } from '../stores/itineraries.svelte';
  import { settingsStore, hasAIAccess } from '../stores/settings.svelte';
  import { visualizationStore } from '../stores/visualization.svelte';
  import { modal } from '$lib/stores/modal.svelte';
  import type { StructuredQuestion } from '../types';
  import QuickResponses from './QuickResponses.svelte';
  import { generateQuickResponses, shouldShowQuickResponses } from '../utils/quick-responses';

  /**
   * Agent configuration
   */
  export type AgentMode = 'trip-designer' | 'help';

  interface AgentConfig {
    mode: AgentMode;
    welcomeMessage?: string;
    placeholderText?: string;
    headerTitle?: string;
    showTokenStats?: boolean;
  }

  let {
    agent = $bindable<AgentConfig>({
      mode: 'trip-designer',
      placeholderText: 'Type a message... (Shift+Enter for new line)',
      showTokenStats: true
    }),
    itineraryId,
    initialContent,
    disabled = false,
  }: {
    agent?: AgentConfig;
    itineraryId?: string;
    initialContent?: string;
    disabled?: boolean;
  } = $props();

  let message = $state('');
  let messagesContainer: HTMLDivElement | undefined = $state();
  let showScrollButton = $state(false);
  let selectedOptions = $state<Set<string>>(new Set());
  let scaleValues = $state<Map<string, number>>(new Map());
  let dateRangeValues = $state<Map<string, { start: string; end: string }>>(new Map());
  let previousItineraryId = $state<string | null>(null);
  let showUpdatingIndicator = $state(false);
  let showUpdateSuccess = $state(false);
  let showPastDatesQuestion = $state(false);
  let pastDatesInfo = $state<{ currentStart: string; currentEnd: string; nextStart: string; nextEnd: string } | null>(null);
  let isUpdatingDates = $state(false);
  let dateUpdateError = $state<string | null>(null);
  let animatingOption = $state<{ label: string; description?: string } | null>(null);
  let isQuestionsHiding = $state(false);

  // Get today's date in YYYY-MM-DD format for min attribute
  function getTodayString(): string {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

  // Check if user has AI access
  let aiAccessAvailable = $derived(hasAIAccess());

  // Dynamic placeholder based on whether structured questions are shown
  let inputPlaceholder = $derived(
    ($structuredQuestions && $structuredQuestions.length > 0)
      ? 'Type here or select an option above...'
      : (agent.placeholderText || 'Type a message... (Shift+Enter for new line)')
  );

  // Helper to read API key directly from localStorage
  function getApiKeyFromStorage(): string | null {
    if (typeof window === 'undefined') return null;

    try {
      // Try new unified storage first
      const settings = localStorage.getItem('itinerator_settings');
      if (settings) {
        const parsed = JSON.parse(settings);
        if (parsed.openRouterKey) return parsed.openRouterKey;
      }

      // Fall back to legacy storage
      return localStorage.getItem('itinerator_api_key');
    } catch {
      return null;
    }
  }

  // Auto-create session on mount (only for trip-designer mode)
  onMount(async () => {
    console.log('[ChatPanel] 🔄 onMount START - itineraryId:', itineraryId, 'mode:', agent.mode);

    // Always clear any previous errors on mount
    chatError.set(null);

    if (agent.mode === 'trip-designer' && itineraryId) {
      const apiKey = getApiKeyFromStorage();
      console.log('[ChatPanel] onMount - API key check:', {
        hasKey: !!apiKey,
        mode: agent.mode,
        itineraryId
      });

      if (!apiKey || apiKey.trim() === '') {
        chatError.set('No OpenRouter API key configured. Please add your API key in Profile settings.');
        return;
      }

      // Check if there's a pending prompt BEFORE reset
      console.log('[ChatPanel] onMount - pendingPrompt BEFORE reset:', $pendingPrompt);

      // Always reset and create fresh session for this itinerary
      // This handles case where component remounts with different itinerary
      // while global stores still have old data
      // CRITICAL: Pass true to delete backend session - prevents leaked context from orphaned sessions
      // CRITICAL: AWAIT the reset to ensure backend session is deleted BEFORE creating new one
      // NOTE: pendingPrompt should NOT be cleared by reset (see chat.svelte.ts line 520)
      await resetChat(true);

      // Verify pendingPrompt survived the reset
      console.log('[ChatPanel] onMount - pendingPrompt AFTER reset:', $pendingPrompt);

      visualizationStore.clearHistory();

      try {
        await createChatSession(itineraryId, agent.mode);
        previousItineraryId = itineraryId;
        console.log('[ChatPanel] onMount - Session created, sessionId:', $chatSessionId);
        console.log('[ChatPanel] onMount - pendingPrompt at session creation:', $pendingPrompt);
        await sendInitialContext();
        console.log('[ChatPanel] 🔄 onMount END - ready for pending prompt effect to trigger');
      } catch (error) {
        console.error('Failed to initialize chat session:', error);
        // Don't set error for normal "session not found" - it will be created on first message
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('Session not found')) {
          chatError.set(null); // Clear any error - session will be created on first message
        } else {
          chatError.set(`Failed to start chat session: ${errorMessage}`);
        }
      }
    } else if (agent.mode === 'help') {
      // Help mode: create session without itinerary
      const apiKey = getApiKeyFromStorage();
      if (!apiKey || apiKey.trim() === '') {
        chatError.set('No OpenRouter API key configured. Please add your API key in Profile settings.');
        return;
      }

      try {
        await createChatSession(undefined, 'help');
      } catch (error) {
        console.error('Failed to initialize help session:', error);
        // Don't set error for normal "session not found" - it will be created on first message
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('Session not found')) {
          chatError.set(null); // Clear any error - session will be created on first message
        } else {
          chatError.set(`Failed to start chat session: ${errorMessage}`);
        }
      }
    }
  });

  // Reset chat when itinerary changes (trip-designer mode only)
  // This ensures each itinerary has a fresh chat session with proper context
  $effect(() => {
    if (agent.mode === 'trip-designer' && itineraryId && previousItineraryId && itineraryId !== previousItineraryId) {
      const apiKey = getApiKeyFromStorage();
      console.log('[ChatPanel] Itinerary changed - resetting session:', {
        hasKey: !!apiKey,
        oldItinerary: previousItineraryId,
        newItinerary: itineraryId
      });

      if (!apiKey || apiKey.trim() === '') {
        resetChat();
        chatError.set('No OpenRouter API key configured. Please add your API key in Profile settings.');
        return;
      }

      // Use IIFE to properly await async operations in $effect
      (async () => {
        // CRITICAL: Clear old session state completely AND delete backend session
        // This ensures NO cached context from previous trip leaks into new session
        // The deleteBackendSession=true parameter ensures orphaned sessions don't accumulate
        // CRITICAL: AWAIT the reset to ensure backend session is deleted BEFORE creating new one
        await resetChat(true);

        // Clear visualization history when switching itineraries
        visualizationStore.clearHistory();

        // IMPORTANT: Force new backend session creation by NOT reusing session ID
        // The backend TripDesignerService caches context in session.messages
        // We need to ensure a completely fresh session with zero cached messages
        try {
          await createChatSession(itineraryId, agent.mode);
          previousItineraryId = itineraryId;
          console.log('[ChatPanel] New session created for itinerary:', itineraryId);
          // Send initial context with itinerary details and user's name
          await sendInitialContext();
        } catch (error) {
          console.error('Failed to reset chat for new itinerary:', error);
          // Don't set error for normal "session not found" - it will be created on first message
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage.includes('Session not found')) {
            chatError.set(null); // Clear any error - session will be created on first message
          } else {
            chatError.set(`Failed to start chat session: ${errorMessage}`);
          }
        }
      })();
    }
  });

  // Send initial context with user preferences and itinerary summary (trip-designer only)
  async function sendInitialContext() {
    if (agent.mode !== 'trip-designer') return;

    const contextParts: string[] = [];

    // IMPORTANT: Add user's preferred name FIRST so agent can use it in greeting
    // This must come before other context to ensure agent sees it immediately
    if (settingsStore.nickname || settingsStore.firstName) {
      const name = settingsStore.nickname || settingsStore.firstName;
      contextParts.push(`IMPORTANT: The user's preferred name is ${name}. Always greet them by name and use their name when appropriate in conversation.`);
    }

    // Add current date for temporal awareness
    const now = new Date();
    const currentDate = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    contextParts.push(`Today's date is ${currentDate}.`);

    if (settingsStore.homeAirport) {
      contextParts.push(`My home airport is ${settingsStore.homeAirport}.`);
    }

    // Add itinerary summary if available
    if ($selectedItinerary) {
      const title = $selectedItinerary.title;
      const description = $selectedItinerary.description;
      const startDate = $selectedItinerary.startDate;
      const endDate = $selectedItinerary.endDate;
      const tripType = $selectedItinerary.tripType;
      const segmentsCount = $selectedItinerary.segmentCount || 0;
      const destinations = ($selectedItinerary as any).destinations || [];

      if (title) {
        contextParts.push(`Working on itinerary: "${title}".`);
      }

      // Add explicit destinations if available
      if (destinations.length > 0) {
        const destNames = destinations.map((d: any) => d.name || d.city).filter(Boolean);
        if (destNames.length > 0) {
          contextParts.push(`Destinations: ${destNames.join(', ')}.`);
        }
      }
      // Otherwise, try to infer destination from title (e.g., "Croatia Business Trip" → Croatia)
      else if (title && title !== 'New Itinerary') {
        // Common patterns: "[Country/City] Trip", "[Country/City] Business Trip", "Trip to [Country/City]"
        const patterns = [
          /^(.+?)\s+(business\s+)?trip$/i,           // "Croatia Business Trip" → "Croatia"
          /^(.+?)\s+vacation$/i,                      // "Hawaii Vacation" → "Hawaii"
          /^(.+?)\s+adventure$/i,                     // "Japan Adventure" → "Japan"
          /^trip\s+to\s+(.+)$/i,                      // "Trip to Paris" → "Paris"
          /^visit(?:ing)?\s+(.+)$/i,                  // "Visiting London" → "London"
          /^(.+?)\s+getaway$/i,                       // "Weekend Getaway" might not match, but "Paris Getaway" → "Paris"
        ];

        let inferredDestination: string | null = null;
        for (const pattern of patterns) {
          const match = title.match(pattern);
          if (match) {
            // Get the captured group (destination)
            const dest = match[1].trim();
            // Filter out generic words
            if (!['new', 'my', 'our', 'the', 'a', 'an', 'weekend'].includes(dest.toLowerCase())) {
              inferredDestination = dest;
              break;
            }
          }
        }

        if (inferredDestination) {
          contextParts.push(`IMPORTANT: Based on the title, this trip is to ${inferredDestination}. Please use ${inferredDestination} as the destination for all planning.`);
        }
      }
      if (startDate && endDate) {
        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);
        const start = startDateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        const end = endDateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

        // Calculate trip duration
        const durationDays = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24));
        contextParts.push(`Trip dates: ${start} to ${end} (${durationDays} days).`);

        // Check if trip dates are in the past
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (endDateObj < today) {
          // Calculate next FUTURE occurrence
          let yearsToAdd = 1;
          const testEndDate = new Date(endDateObj);
          testEndDate.setFullYear(testEndDate.getFullYear() + yearsToAdd);

          while (testEndDate <= today) {
            yearsToAdd++;
            testEndDate.setFullYear(endDateObj.getFullYear() + yearsToAdd);
          }

          const nextYearStart = new Date(startDateObj);
          nextYearStart.setFullYear(startDateObj.getFullYear() + yearsToAdd);
          const nextYearEnd = new Date(endDateObj);
          nextYearEnd.setFullYear(endDateObj.getFullYear() + yearsToAdd);
          const nextStart = nextYearStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
          const nextEnd = nextYearEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

          pastDatesInfo = { currentStart: start, currentEnd: end, nextStart, nextEnd };
          showPastDatesQuestion = true;
          return;
        }
      }
      if (description) {
        contextParts.push(`Description: ${description}`);
      }
      if (tripType) {
        contextParts.push(`Trip type: ${tripType}.`);
      }

      // Add segments summary if itinerary has content
      if (segmentsCount > 0) {
        contextParts.push(`Current itinerary has ${segmentsCount} segment${segmentsCount !== 1 ? 's' : ''} planned.`);
      } else {
        contextParts.push(`Itinerary is currently empty and ready to be planned.`);
      }
    }

    // Send context as initial message if we have any
    if (contextParts.length > 0 && $chatMessages.length === 0) {
      const contextMessage = contextParts.join(' ');
      console.log('[ChatPanel] Sending initial context:', contextMessage);
      await sendContextMessage(`Context: ${contextMessage}`);
    } else if (contextParts.length > 0) {
      console.log('[ChatPanel] Skipping context - chat already has messages');
    }
  }

  // Auto-scroll to bottom when new messages arrive or streaming content updates
  $effect(() => {
    const container = messagesContainer;
    if (container && ($chatMessages.length > 0 || $streamingContent)) {
      const isNearBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      if (isNearBottom) {
        setTimeout(() => {
          container.scrollTop = container.scrollHeight;
        }, 0);
      }
    }
  });

  // Auto-scroll when structured questions appear or change
  $effect(() => {
    const container = messagesContainer;
    if (container && $structuredQuestions && $structuredQuestions.length > 0) {
      // Small delay to ensure DOM is updated with questions
      setTimeout(() => {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth'
        });
      }, 100);
    }
  });

  // Reload itinerary when updated (trip-designer only)
  $effect(() => {
    if (agent.mode === 'trip-designer' && $itineraryUpdated && itineraryId) {
      // Use IIFE to handle async operation in $effect
      (async () => {
        showUpdatingIndicator = true;
        // CRITICAL: Await the reload to ensure data is fetched before hiding indicator
        await loadItinerary(itineraryId);
        itineraryUpdated.set(false);

        setTimeout(() => {
          showUpdatingIndicator = false;
          showUpdateSuccess = true;
          setTimeout(() => {
            showUpdateSuccess = false;
          }, 2000);
        }, 1000);
      })();
    }
  });

  // Handle pending prompt injection from HomeView/NewTripHelperView quick prompts
  // This effect runs whenever chatSessionId or pendingPrompt changes
  $effect(() => {
    // Debug: track what's happening
    const hasSession = !!$chatSessionId;
    const hasPending = !!$pendingPrompt;
    console.log('[ChatPanel] Pending prompt check:', { hasSession, hasPending, prompt: $pendingPrompt });

    // Only send if BOTH session exists AND pending prompt exists
    // This ensures we don't try to send before session is ready
    if ($chatSessionId && $pendingPrompt) {
      // Capture the prompt value before clearing it
      const prompt = $pendingPrompt;
      console.log('[ChatPanel] ✅ Sending pending prompt:', prompt);

      // Clear immediately to prevent re-send when effect re-runs
      pendingPrompt.set(null);

      // Use queueMicrotask instead of setTimeout for faster, more predictable timing
      // This runs after current synchronous code but before next render
      queueMicrotask(async () => {
        try {
          await sendMessageStreaming(prompt);
        } catch (error) {
          console.error('[ChatPanel] Failed to send pending prompt:', error);
        }
      });
    }
  });

  function handleScroll() {
    if (!messagesContainer) return;
    const { scrollHeight, scrollTop, clientHeight } = messagesContainer;
    showScrollButton = scrollHeight - scrollTop - clientHeight > 100;
  }

  function scrollToBottom() {
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  async function handleSend() {
    if (!message.trim() || $chatLoading) return;

    // If there are structured questions visible, slide them away first
    if ($structuredQuestions && $structuredQuestions.length > 0) {
      isQuestionsHiding = true;
      await new Promise(resolve => setTimeout(resolve, 300));
      structuredQuestions.set([]);
      isQuestionsHiding = false;
    }

    const userMessage = message;
    message = '';

    await sendMessageStreaming(userMessage);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleStructuredAnswer(
    question: StructuredQuestion,
    optionId?: string
  ) {
    if (question.type === 'single_choice' && optionId) {
      const option = question.options?.find((o) => o.id === optionId);
      if (option) {
        // Start hiding the questions section
        isQuestionsHiding = true;

        // Show animation of the selected option
        animatingOption = { label: option.label, description: option.description };

        // Wait for slide-out animation
        await new Promise(resolve => setTimeout(resolve, 300));

        // Clear questions immediately so they don't show after animation
        structuredQuestions.set([]);

        // Wait a bit more for the selected option animation
        await new Promise(resolve => setTimeout(resolve, 200));

        message = option.label;
        animatingOption = null;
        isQuestionsHiding = false;
        await handleSend();
        selectedOptions.clear();
      }
    } else if (question.type === 'multiple_choice') {
      if (optionId) {
        if (selectedOptions.has(optionId)) {
          selectedOptions.delete(optionId);
        } else {
          selectedOptions.add(optionId);
        }
        selectedOptions = new Set(selectedOptions);
      }
    }
  }

  async function confirmMultipleChoice(question: StructuredQuestion) {
    if (selectedOptions.size === 0) return;

    const selectedLabels = Array.from(selectedOptions)
      .map((id) => question.options?.find((o) => o.id === id)?.label)
      .filter(Boolean)
      .join(', ');

    message = selectedLabels;
    await handleSend();
    selectedOptions.clear();
  }

  function initializeScaleValue(questionId: string, defaultValue: number) {
    if (!scaleValues.has(questionId)) {
      scaleValues.set(questionId, defaultValue);
      scaleValues = new Map(scaleValues);
    }
  }

  function updateScaleValue(questionId: string, value: number) {
    scaleValues.set(questionId, value);
    scaleValues = new Map(scaleValues);
  }

  async function handleScaleSubmit(question: StructuredQuestion) {
    const value = scaleValues.get(question.id);
    if (value === undefined) return;

    message = value.toString();
    await handleSend();
    scaleValues.delete(question.id);
  }

  function initializeDateRange(questionId: string) {
    if (!dateRangeValues.has(questionId)) {
      dateRangeValues.set(questionId, { start: '', end: '' });
      dateRangeValues = new Map(dateRangeValues);
    }
  }

  function updateDateRangeStart(questionId: string, value: string) {
    const current = dateRangeValues.get(questionId) || { start: '', end: '' };
    dateRangeValues.set(questionId, { ...current, start: value });
    dateRangeValues = new Map(dateRangeValues);
  }

  function updateDateRangeEnd(questionId: string, value: string) {
    const current = dateRangeValues.get(questionId) || { start: '', end: '' };
    dateRangeValues.set(questionId, { ...current, end: value });
    dateRangeValues = new Map(dateRangeValues);
  }

  function formatDateRange(start: string, end: string): string {
    const startDate = new Date(start);
    const endDate = new Date(end);

    const startFormatted = startDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
    const endFormatted = endDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    return `${startFormatted} - ${endFormatted}`;
  }

  async function handleDateRangeSubmit(question: StructuredQuestion) {
    const range = dateRangeValues.get(question.id);
    if (!range || !range.start || !range.end) return;

    // Format dates as readable string
    message = formatDateRange(range.start, range.end);
    await handleSend();
    dateRangeValues.delete(question.id);
  }

  async function handleTextSubmit(question: StructuredQuestion, value: string) {
    if (!value.trim()) return;

    message = value;
    await handleSend();
  }

  async function handlePastDatesChoice(choice: 'update-next-year' | 'choose-different' | 'cancel') {
    if (choice === 'update-next-year' && pastDatesInfo && $selectedItinerary && itineraryId) {
      isUpdatingDates = true;
      dateUpdateError = null;

      const startDate = new Date($selectedItinerary.startDate);
      const endDate = new Date($selectedItinerary.endDate);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let yearsToAdd = 1;
      const testEndDate = new Date(endDate);
      testEndDate.setFullYear(testEndDate.getFullYear() + yearsToAdd);

      while (testEndDate <= today) {
        yearsToAdd++;
        testEndDate.setFullYear(endDate.getFullYear() + yearsToAdd);
      }

      startDate.setFullYear(startDate.getFullYear() + yearsToAdd);
      endDate.setFullYear(endDate.getFullYear() + yearsToAdd);

      try {
        const response = await fetch(`/api/v1/itineraries/${itineraryId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
          })
        });

        if (response.ok) {
          await loadItinerary(itineraryId);
          showPastDatesQuestion = false;
          pastDatesInfo = null;
          await sendInitialContext();
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          dateUpdateError = errorData.error || 'Failed to update dates. Please try again.';
        }
      } catch (error) {
        console.error('Failed to update itinerary dates:', error);
        dateUpdateError = 'Network error. Please check your connection and try again.';
      } finally {
        isUpdatingDates = false;
      }
    } else if (choice === 'choose-different') {
      showPastDatesQuestion = false;
      pastDatesInfo = null;
      message = "I'd like to choose different dates for this trip. Can you help me pick new dates?";
      await handleSend();
    } else if (choice === 'cancel') {
      showPastDatesQuestion = false;
      pastDatesInfo = null;
      chatError.set('Cannot plan a trip with past dates. Please update the itinerary dates or create a new itinerary.');
    }
  }

  function formatTime(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  }

  function getToolCallLabel(toolName: string): string {
    const labels: Record<string, string> = {
      search_flights: 'Searching for flights...',
      search_hotels: 'Finding hotels...',
      search_activities: 'Discovering activities...',
      search_transfers: 'Looking up transfers...',
      search_web: 'Researching...',
      get_weather: 'Checking weather...',
      get_itinerary: 'Loading itinerary...',
      add_segment: 'Adding to your trip...',
      add_flight: 'Adding flight...',
      add_hotel: 'Adding accommodation...',
      add_activity: 'Adding activity...',
      add_transfer: 'Adding transfer...',
      update_segment: 'Updating your trip...',
      update_itinerary: 'Updating trip details...',
      delete_segment: 'Removing from trip...',
      move_segment: 'Rearranging itinerary...',
      switch_to_trip_designer: 'Switching to Trip Designer...',
    };
    return labels[toolName] || `Processing...`;
  }

  function formatNumber(num: number): string {
    return new Intl.NumberFormat('en-US').format(num);
  }

  function formatCost(cost: number): string {
    return `$${cost.toFixed(4)}`;
  }

  async function handleQuickResponse(responseText: string) {
    message = responseText;
    await handleSend();
  }
</script>

<div class="chatpanel">
  {#if !aiAccessAvailable}
    <div class="chatpanel-no-access">
      <div class="chatpanel-no-access-icon">🔑</div>
      <p class="chatpanel-no-access-text">AI features require an API key</p>
      <p class="chatpanel-no-access-hint">
        Add your OpenRouter API key in <a href="/profile" class="chatpanel-profile-link">Profile settings</a> to enable Trip Designer and other AI-powered features.
      </p>
    </div>
  {:else if $chatError}
    <div class="chatpanel-error">
      <strong>Error:</strong>
      {$chatError}
    </div>
  {/if}

  {#if showUpdatingIndicator}
    <div class="chatpanel-updating-banner">
      <div class="chatpanel-updating-icon">✨</div>
      <span>Updating itinerary...</span>
    </div>
  {/if}

  {#if showUpdateSuccess}
    <div class="chatpanel-success-toast">
      <div class="chatpanel-success-icon">✓</div>
      <span>Itinerary updated!</span>
    </div>
  {/if}

  <!-- Main chat messages area -->
  <div class="chatpanel-messages" bind:this={messagesContainer} onscroll={handleScroll}>
    {#if initialContent && $chatMessages.length === 0}
      <div class="chatpanel-initial-content">
        {@html initialContent}
      </div>
    {:else if $chatMessages.length === 0}
      <div class="chatpanel-empty">
        <p>{agent.mode === 'help' ? 'Ask me anything about using Itinerizer!' : 'Start a conversation to plan your trip'}</p>
        <p class="chatpanel-empty-hint">
          {agent.mode === 'help' ? 'Type your question below' : 'Ask about destinations, activities, or travel dates'}
        </p>
      </div>
    {:else}
      {#each $chatMessages as msg, idx (msg.timestamp.getTime() + idx)}
        <div class="chatpanel-message chatpanel-message-{msg.role}">
          <div class="chatpanel-message-content">
            {msg.content}
          </div>
          <div class="chatpanel-message-time">{formatTime(msg.timestamp)}</div>

          {#if msg.role === 'assistant' && idx === $chatMessages.length - 1 && !$isStreaming}
            {@const quickResponses = shouldShowQuickResponses(msg.content, !!($structuredQuestions && $structuredQuestions.length > 0))
              ? generateQuickResponses(msg.content)
              : null}
            {#if quickResponses && quickResponses.length > 0}
              <QuickResponses
                responses={quickResponses}
                disabled={$chatLoading}
                onSelect={handleQuickResponse}
              />
            {/if}
          {/if}
        </div>
      {/each}

      {#if $isStreaming && $streamingContent}
        <div class="chatpanel-message chatpanel-message-assistant">
          <div class="chatpanel-message-content chatpanel-streaming">
            {$streamingContent}<span class="chatpanel-cursor"></span>
          </div>
        </div>
      {/if}


      {#if $currentToolCall}
        <div class="chatpanel-message chatpanel-message-assistant">
          <div class="chatpanel-suspense">
            <div class="chatpanel-suspense-icon">
              {#if $currentToolCall.includes('search')}
                🔍
              {:else if $currentToolCall.includes('update') || $currentToolCall.includes('add')}
                ✏️
              {:else}
                🔧
              {/if}
            </div>
            <div class="chatpanel-suspense-content">
              <div class="chatpanel-suspense-label">{getToolCallLabel($currentToolCall)}</div>
              <div class="chatpanel-suspense-progress">
                <div class="chatpanel-suspense-bar"></div>
              </div>
            </div>
          </div>
        </div>
      {/if}
    {/if}
  </div>

  {#if showScrollButton}
    <button class="chatpanel-scroll-button" onclick={scrollToBottom} type="button">
      ↓ Scroll to bottom
    </button>
  {/if}

  <!-- Structured questions area (between messages and input) -->
  {#if $structuredQuestions && $structuredQuestions.length > 0}
    <div class="chatpanel-structured-questions" class:hiding={isQuestionsHiding}>
      {#each $structuredQuestions as question}
        <div class="chatpanel-question">
          <div class="chatpanel-question-text">{question.question}</div>
          {#if question.context}
            <div class="chatpanel-question-context">{question.context}</div>
          {/if}
          <div class="chatpanel-question-options">
            {#if question.type === 'single_choice' && question.options}
              {#each question.options as option}
                <button
                  class="chatpanel-option-button"
                  onclick={() => handleStructuredAnswer(question, option.id)}
                  disabled={$chatLoading}
                  type="button"
                >
                  {#if option.imageUrl}
                    <img
                      src={option.imageUrl}
                      alt={option.label}
                      class="chatpanel-option-image"
                    />
                  {/if}
                  <span class="chatpanel-option-label">{option.label}</span>
                  {#if option.description}
                    <span class="chatpanel-option-description">{option.description}</span>
                  {/if}
                </button>
              {/each}
              <div class="chatpanel-option-hint">Or type your own response below</div>
            {:else if question.type === 'multiple_choice' && question.options}
              {#each question.options as option}
                <button
                  class="chatpanel-option-button {selectedOptions.has(option.id)
                    ? 'chatpanel-option-selected'
                    : ''}"
                  onclick={() => handleStructuredAnswer(question, option.id)}
                  disabled={$chatLoading}
                  type="button"
                >
                  {#if option.imageUrl}
                    <img
                      src={option.imageUrl}
                      alt={option.label}
                      class="chatpanel-option-image"
                    />
                  {/if}
                  <span class="chatpanel-option-label">{option.label}</span>
                  {#if option.description}
                    <span class="chatpanel-option-description">{option.description}</span>
                  {/if}
                </button>
              {/each}
              <div class="chatpanel-option-hint">Or type your own response below</div>
              {#if selectedOptions.size > 0}
                <button
                  class="chatpanel-confirm-button"
                  onclick={() => confirmMultipleChoice(question)}
                  type="button"
                >
                  Confirm ({selectedOptions.size} selected)
                </button>
              {/if}
            {:else if question.type === 'scale' && question.scale}
              {@const scale = question.scale}
              {#snippet _init()}{initializeScaleValue(question.id, scale.min)}{/snippet}
              {@render _init()}
              <div class="chatpanel-scale-question">
                <input
                  type="range"
                  min={scale.min}
                  max={scale.max}
                  step={scale.step || 1}
                  value={scaleValues.get(question.id) || scale.min}
                  oninput={(e) =>
                    updateScaleValue(question.id, Number(e.currentTarget.value))}
                  class="chatpanel-scale-input"
                />
                <div class="chatpanel-scale-labels">
                  <span>{scale.minLabel || scale.min}</span>
                  <span class="chatpanel-scale-value">
                    {scaleValues.get(question.id) || scale.min}
                  </span>
                  <span>{scale.maxLabel || scale.max}</span>
                </div>
                <button
                  class="chatpanel-confirm-button"
                  onclick={() => handleScaleSubmit(question)}
                  type="button"
                >
                  Confirm
                </button>
              </div>
            {:else if question.type === 'date_range'}
              {#snippet _init()}{initializeDateRange(question.id)}{/snippet}
              {@render _init()}
              {@const todayString = getTodayString()}
              {@const startDate = dateRangeValues.get(question.id)?.start || ''}
              {@const endDate = dateRangeValues.get(question.id)?.end || ''}
              {@const canSubmit = startDate && endDate}
              <div class="chatpanel-date-range-question">
                <label class="chatpanel-date-label">
                  <span>Start Date:</span>
                  <input
                    type="date"
                    value={startDate}
                    min={todayString}
                    oninput={(e) => updateDateRangeStart(question.id, e.currentTarget.value)}
                    class="chatpanel-date-input"
                  />
                </label>
                <label class="chatpanel-date-label">
                  <span>End Date:</span>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate || todayString}
                    oninput={(e) => updateDateRangeEnd(question.id, e.currentTarget.value)}
                    class="chatpanel-date-input"
                  />
                </label>
                <button
                  class="chatpanel-confirm-button"
                  onclick={() => handleDateRangeSubmit(question)}
                  disabled={!canSubmit}
                  type="button"
                >
                  Confirm Dates
                </button>
              </div>
            {:else if question.type === 'text'}
              <div class="chatpanel-text-question">
                <input
                  type="text"
                  placeholder="Type your answer..."
                  class="chatpanel-text-input"
                  onkeydown={(e) => {
                    if (e.key === 'Enter') {
                      handleTextSubmit(question, e.currentTarget.value);
                      e.currentTarget.value = '';
                    }
                  }}
                />
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}

  {#if showPastDatesQuestion && pastDatesInfo}
    <div class="chatpanel-past-dates-overlay">
      <div class="chatpanel-past-dates-card">
        <div class="chatpanel-past-dates-icon">📅</div>
        <div class="chatpanel-past-dates-title">Trip Dates Are in the Past</div>
        <div class="chatpanel-past-dates-message">
          This itinerary is scheduled for <strong>{pastDatesInfo.currentStart}</strong> to <strong>{pastDatesInfo.currentEnd}</strong>, which has already passed.
        </div>
        <div class="chatpanel-past-dates-question">How would you like to proceed?</div>

        {#if dateUpdateError}
          <div class="chatpanel-past-dates-error">
            <strong>Error:</strong> {dateUpdateError}
          </div>
        {/if}

        <div class="chatpanel-past-dates-buttons">
          <button
            class="chatpanel-past-dates-button chatpanel-past-dates-primary"
            onclick={() => handlePastDatesChoice('update-next-year')}
            disabled={isUpdatingDates}
            type="button"
          >
            {#if isUpdatingDates}
              <span class="button-icon">
                <span class="chatpanel-spinner"></span>
              </span>
              <span class="button-text">
                <span class="button-label">Updating Dates...</span>
                <span class="button-detail">Please wait</span>
              </span>
            {:else}
              <span class="button-icon">🔄</span>
              <span class="button-text">
                <span class="button-label">Update to Next Year</span>
                <span class="button-detail">{pastDatesInfo.nextStart} – {pastDatesInfo.nextEnd}</span>
              </span>
            {/if}
          </button>
          <button
            class="chatpanel-past-dates-button chatpanel-past-dates-secondary"
            onclick={() => handlePastDatesChoice('choose-different')}
            disabled={isUpdatingDates}
            type="button"
          >
            <span class="button-icon">📆</span>
            <span class="button-text">
              <span class="button-label">Choose Different Dates</span>
              <span class="button-detail">I'll help you pick new dates</span>
            </span>
          </button>
          <button
            class="chatpanel-past-dates-button chatpanel-past-dates-cancel"
            onclick={() => handlePastDatesChoice('cancel')}
            disabled={isUpdatingDates}
            type="button"
          >
            <span class="button-icon">❌</span>
            <span class="button-text">
              <span class="button-label">Cancel Planning</span>
              <span class="button-detail">Exit without changes</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Input container at bottom -->
  <div class="chatpanel-input-container">
    <!-- Network progress bar (shown when thinking or streaming) -->
    {#if $isThinking || $isStreaming}
      <div class="network-progress-bar">
        <div class="progress-bar-inner"></div>
      </div>
    {/if}

    <!-- Animating option indicator -->
    {#if animatingOption}
      <div class="chatpanel-animating-option">
        <div class="chatpanel-animating-content">
          <span class="chatpanel-animating-label">{animatingOption.label}</span>
          {#if animatingOption.description}
            <span class="chatpanel-animating-description">{animatingOption.description}</span>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Input Row with Clear Button -->
    <div class="chatpanel-input-row">
      <!-- Clear Chat Button -->
      <button
        onclick={async () => {
          const confirmed = await modal.confirm({
            title: 'Clear Conversation',
            message: 'Clear this conversation? This cannot be undone.',
            confirmText: 'Clear',
            destructive: true
          });
          if (confirmed) {
            resetChat();
          }
        }}
        disabled={!aiAccessAvailable || disabled || $chatMessages.length === 0}
        class="chatpanel-clear-button"
        type="button"
        title="Clear conversation"
      >
        🗑️
      </button>

      <textarea
        bind:value={message}
        onkeydown={handleKeydown}
        placeholder={inputPlaceholder}
        class="chatpanel-input"
        rows="3"
        disabled={!aiAccessAvailable || disabled || $chatLoading}
      ></textarea>
      <button
        onclick={handleSend}
        disabled={!aiAccessAvailable || disabled || $chatLoading || !message.trim()}
        class="chatpanel-send-button"
        type="button"
      >
        {$chatLoading ? 'Sending...' : 'Send'}
      </button>
    </div>
  </div>

  <!-- Token stats (optional, shown for trip-designer) -->
  {#if agent.showTokenStats && $chatSessionId && $sessionTokens.total > 0}
    <div class="chatpanel-stats-bar" title="Input: {formatNumber($sessionTokens.input)} tokens ({formatCost($sessionCost.input)})&#10;Output: {formatNumber($sessionTokens.output)} tokens ({formatCost($sessionCost.output)})">
      <div class="chatpanel-stats-info">
        <span class="chatpanel-stats-label">Session:</span>
        <span class="chatpanel-stats-tokens">{formatNumber($sessionTokens.total)} tokens</span>
        <span class="chatpanel-stats-separator">|</span>
        <span class="chatpanel-stats-cost">{formatCost($sessionCost.total)}</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .chatpanel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: #ffffff;
    border-top: 1px solid #e5e7eb;
    position: relative;
  }

  .chatpanel-no-access {
    padding: 2rem 1.5rem;
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
    border-bottom: 2px solid #fbbf24;
    text-align: center;
  }

  .chatpanel-no-access-icon {
    font-size: 3rem;
    margin-bottom: 0.75rem;
  }

  .chatpanel-no-access-text {
    font-size: 1.125rem;
    font-weight: 600;
    color: #78350f;
    margin: 0 0 0.5rem 0;
  }

  .chatpanel-no-access-hint {
    font-size: 0.9375rem;
    color: #92400e;
    margin: 0;
    line-height: 1.5;
  }

  .chatpanel-profile-link {
    color: #1d4ed8;
    font-weight: 600;
    text-decoration: none;
  }

  .chatpanel-profile-link:hover {
    text-decoration: underline;
  }

  .chatpanel-error {
    padding: 0.75rem 1rem;
    background-color: #fef2f2;
    border-bottom: 1px solid #fee2e2;
    color: #dc2626;
    font-size: 0.875rem;
  }

  .chatpanel-updating-banner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
    border-bottom: 1px solid #bae6fd;
    color: #0369a1;
    font-size: 0.875rem;
    font-weight: 500;
    animation: slideDown 0.3s ease-out;
  }

  @keyframes slideDown {
    from {
      transform: translateY(-100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .chatpanel-updating-icon {
    font-size: 1rem;
    animation: sparkle 1.5s ease-in-out infinite;
  }

  @keyframes sparkle {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.7;
      transform: scale(1.2);
    }
  }

  .chatpanel-success-toast {
    position: fixed;
    bottom: 100px;
    right: 20px;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    animation: toastSlideIn 0.3s ease-out;
    z-index: 1000;
  }

  @keyframes toastSlideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  .chatpanel-success-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    font-size: 0.75rem;
  }

  .chatpanel-messages {
    flex: 1;
    overflow-y: auto;
    padding: 1rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-height: 0;
    order: 1; /* Position first */
  }

  .chatpanel-initial-content {
    padding: 2rem;
    text-align: center;
    color: #6b7280;
  }

  .chatpanel-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #6b7280;
    text-align: center;
  }

  .chatpanel-empty p {
    margin: 0.25rem 0;
  }

  .chatpanel-empty-hint {
    font-size: 0.875rem;
    color: #9ca3af;
  }

  .chatpanel-message {
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  .chatpanel-message-user {
    align-items: flex-end;
  }

  .chatpanel-message-user .chatpanel-message-content {
    background-color: #3b82f6;
    color: white;
    border-radius: 1rem 1rem 0.25rem 1rem;
    margin-left: 2rem;
  }

  .chatpanel-message-user .chatpanel-message-time {
    text-align: right;
  }

  .chatpanel-message-assistant {
    align-items: flex-start;
  }

  .chatpanel-message-assistant .chatpanel-message-content {
    background-color: #f3f4f6;
    color: #1f2937;
    border-radius: 1rem 1rem 1rem 0.25rem;
    margin-right: 2rem;
  }

  .chatpanel-message-content {
    padding: 0.875rem 1.25rem;
    font-size: 0.9375rem;
    line-height: 1.6;
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  .chatpanel-message-time {
    font-size: 0.75rem;
    color: #9ca3af;
    margin-top: 0.375rem;
    padding: 0 0.25rem;
  }

  .chatpanel-streaming {
    position: relative;
  }

  .chatpanel-cursor {
    display: inline-block;
    width: 2px;
    height: 1em;
    background-color: #1f2937;
    margin-left: 2px;
    animation: blink 1s infinite;
  }

  @keyframes blink {
    0%,
    50% {
      opacity: 1;
    }
    51%,
    100% {
      opacity: 0;
    }
  }

  .chatpanel-suspense {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
    border-radius: 1rem;
    border: 1px solid #bae6fd;
  }

  .chatpanel-suspense-icon {
    font-size: 1.25rem;
    animation: pulse 2s ease-in-out infinite;
  }

  .chatpanel-suspense-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .chatpanel-suspense-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #0369a1;
  }

  .chatpanel-suspense-progress {
    height: 3px;
    background-color: #e0f2fe;
    border-radius: 2px;
    overflow: hidden;
  }

  .chatpanel-suspense-bar {
    height: 100%;
    width: 30%;
    background: linear-gradient(90deg, #0ea5e9, #38bdf8);
    border-radius: 2px;
    animation: progress 1.5s ease-in-out infinite;
  }

  @keyframes progress {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(400%);
    }
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.7;
      transform: scale(1.1);
    }
  }

  .chatpanel-suspense-dots {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .chatpanel-suspense-dots span {
    width: 6px;
    height: 6px;
    background-color: #0ea5e9;
    border-radius: 50%;
    animation: suspenseDot 1.4s infinite;
  }

  .chatpanel-suspense-dots span:nth-child(2) {
    animation-delay: 0.2s;
  }

  .chatpanel-suspense-dots span:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes suspenseDot {
    0%, 60%, 100% {
      transform: translateY(0);
      opacity: 0.6;
    }
    30% {
      transform: translateY(-4px);
      opacity: 1;
    }
  }

  .chatpanel-scroll-button {
    position: absolute;
    bottom: 6rem;
    right: 1rem;
    padding: 0.5rem 1rem;
    background-color: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 1rem;
    font-size: 0.875rem;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    transition: all 0.2s;
  }

  .chatpanel-scroll-button:hover {
    background-color: #f9fafb;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .chatpanel-structured-questions {
    padding: 1rem;
    border-top: 1px solid #e5e7eb;
    background-color: #f9fafb;
    flex-shrink: 0;
    max-height: 40%;
    overflow-y: auto;
    order: 2; /* Position between messages and input */
    transition: transform 0.3s ease-out, opacity 0.3s ease-out;
  }

  .chatpanel-structured-questions.hiding {
    transform: translateY(20px);
    opacity: 0;
    pointer-events: none;
  }

  .chatpanel-question {
    margin-bottom: 1rem;
  }

  .chatpanel-question:last-child {
    margin-bottom: 0;
  }

  .chatpanel-question-text {
    font-size: 0.875rem;
    font-weight: 500;
    color: #1f2937;
    margin-bottom: 0.5rem;
  }

  .chatpanel-question-context {
    font-size: 0.75rem;
    color: #6b7280;
    margin-bottom: 0.75rem;
    font-style: italic;
  }

  .chatpanel-question-options {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .chatpanel-option-hint {
    width: 100%;
    font-size: 0.75rem;
    color: #9ca3af;
    text-align: center;
    margin-top: 0.25rem;
    font-style: italic;
  }

  .chatpanel-option-button {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 0.5rem 0.75rem;
    background-color: #ffffff;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .chatpanel-option-button:hover:not(:disabled) {
    border-color: #3b82f6;
    background-color: #eff6ff;
  }

  .chatpanel-option-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .chatpanel-option-selected {
    border-color: #3b82f6;
    background-color: #eff6ff;
  }

  .chatpanel-option-label {
    font-weight: 500;
    color: #1f2937;
  }

  .chatpanel-option-description {
    font-size: 0.75rem;
    color: #6b7280;
    margin-top: 0.25rem;
  }

  .chatpanel-option-image {
    width: 100%;
    height: auto;
    max-height: 150px;
    object-fit: cover;
    border-radius: 0.25rem;
    margin-bottom: 0.5rem;
  }

  .chatpanel-confirm-button {
    padding: 0.5rem 1rem;
    background-color: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .chatpanel-confirm-button:hover {
    background-color: #2563eb;
  }

  .chatpanel-input-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem;
    border-top: 1px solid #e5e7eb;
    background-color: #ffffff;
    flex-shrink: 0;
    order: 3; /* Position after structured questions */
  }

  /* Network progress bar (thin animated line) */
  .network-progress-bar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: #e5e7eb;
    overflow: hidden;
    z-index: 10;
  }

  .progress-bar-inner {
    height: 100%;
    width: 30%;
    background: linear-gradient(90deg, #3b82f6, #8b5cf6, #3b82f6);
    background-size: 200% 100%;
    animation: progress-slide 1.5s ease-in-out infinite;
    border-radius: 2px;
  }

  @keyframes progress-slide {
    0% {
      transform: translateX(-100%);
    }
    50% {
      transform: translateX(250%);
    }
    100% {
      transform: translateX(-100%);
    }
  }

  .chatpanel-input-row {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    position: relative;
  }

  .chatpanel-clear-button {
    position: absolute;
    left: 0.75rem;
    top: 0.75rem;
    padding: 0.375rem;
    background-color: transparent;
    border: none;
    font-size: 1.125rem;
    cursor: pointer;
    opacity: 0.4;
    transition: opacity 0.2s, transform 0.2s;
    z-index: 1;
  }

  .chatpanel-clear-button:hover:not(:disabled) {
    opacity: 1;
    transform: scale(1.1);
  }

  .chatpanel-clear-button:disabled {
    opacity: 0.2;
    cursor: not-allowed;
  }

  .chatpanel-animating-option {
    animation: slideDownFade 0.4s ease-out;
    margin-bottom: 0.5rem;
  }

  @keyframes slideDownFade {
    0% {
      opacity: 0;
      transform: translateY(-20px);
    }
    50% {
      opacity: 1;
      transform: translateY(0);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .chatpanel-animating-content {
    display: flex;
    flex-direction: column;
    padding: 0.75rem 1rem;
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: white;
    border-radius: 0.5rem;
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
  }

  .chatpanel-animating-label {
    font-weight: 600;
    font-size: 0.9375rem;
  }

  .chatpanel-animating-description {
    font-size: 0.75rem;
    opacity: 0.9;
    margin-top: 0.25rem;
  }

  .chatpanel-input {
    width: 100%;
    padding: 0.75rem 0.75rem 0.75rem 2.75rem;
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    resize: vertical;
    font-family: inherit;
    background-color: #ffffff;
    color: #1f2937;
  }

  .chatpanel-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
  }

  .chatpanel-input:disabled {
    background-color: #f3f4f6;
    cursor: not-allowed;
  }

  .chatpanel-send-button {
    align-self: flex-end;
    padding: 0.5rem 1rem;
    background-color: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .chatpanel-send-button:hover:not(:disabled) {
    background-color: #2563eb;
  }

  .chatpanel-send-button:disabled {
    background-color: #9ca3af;
    cursor: not-allowed;
  }

  .chatpanel-scale-question {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .chatpanel-scale-input {
    width: 100%;
    cursor: pointer;
  }

  .chatpanel-scale-labels {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.875rem;
    color: #6b7280;
  }

  .chatpanel-scale-value {
    font-weight: 600;
    color: #3b82f6;
    font-size: 1rem;
  }

  .chatpanel-date-range-question {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    background: #f9fafb;
    border-radius: 0.5rem;
    border: 1px solid #e5e7eb;
  }

  .chatpanel-date-label {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
  }

  .chatpanel-date-input {
    padding: 0.625rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 1rem;
    font-family: inherit;
    background-color: #ffffff;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .chatpanel-date-input:hover {
    border-color: #9ca3af;
  }

  .chatpanel-date-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .chatpanel-text-question {
    width: 100%;
  }

  .chatpanel-text-input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-family: inherit;
  }

  .chatpanel-text-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
  }

  .chatpanel-past-dates-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 1rem;
  }

  .chatpanel-past-dates-card {
    background: #ffffff;
    border-radius: 1rem;
    padding: 1.5rem;
    max-width: 400px;
    width: 100%;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    animation: slideUp 0.3s ease-out;
  }

  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .chatpanel-past-dates-icon {
    font-size: 2.5rem;
    text-align: center;
    margin-bottom: 0.75rem;
  }

  .chatpanel-past-dates-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1f2937;
    text-align: center;
    margin-bottom: 0.75rem;
  }

  .chatpanel-past-dates-message {
    font-size: 0.9375rem;
    color: #4b5563;
    text-align: center;
    line-height: 1.5;
    margin-bottom: 0.5rem;
  }

  .chatpanel-past-dates-question {
    font-size: 0.875rem;
    color: #6b7280;
    text-align: center;
    margin-bottom: 1.25rem;
  }

  .chatpanel-past-dates-buttons {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .chatpanel-past-dates-button {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid transparent;
    text-align: left;
  }

  .chatpanel-past-dates-button .button-icon {
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .chatpanel-past-dates-button .button-text {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .chatpanel-past-dates-button .button-label {
    font-weight: 600;
    font-size: 0.9375rem;
  }

  .chatpanel-past-dates-button .button-detail {
    font-size: 0.75rem;
    opacity: 0.8;
  }

  .chatpanel-past-dates-primary {
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: #ffffff;
  }

  .chatpanel-past-dates-primary:hover {
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
    transform: translateY(-1px);
    box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3);
  }

  .chatpanel-past-dates-secondary {
    background: #f3f4f6;
    color: #1f2937;
    border-color: #e5e7eb;
  }

  .chatpanel-past-dates-secondary:hover {
    background: #e5e7eb;
    border-color: #d1d5db;
  }

  .chatpanel-past-dates-cancel {
    background: transparent;
    color: #6b7280;
    border-color: #e5e7eb;
  }

  .chatpanel-past-dates-cancel:hover:not(:disabled) {
    background: #fef2f2;
    color: #dc2626;
    border-color: #fecaca;
  }

  .chatpanel-past-dates-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .chatpanel-past-dates-primary:disabled {
    background: linear-gradient(135deg, #93c5fd 0%, #60a5fa 100%);
    transform: none;
    box-shadow: none;
  }

  .chatpanel-past-dates-error {
    padding: 0.75rem;
    background-color: #fef2f2;
    border: 1px solid #fee2e2;
    border-radius: 0.5rem;
    color: #dc2626;
    font-size: 0.875rem;
    margin-bottom: 1rem;
    text-align: center;
  }

  .chatpanel-spinner {
    display: inline-block;
    width: 1.25rem;
    height: 1.25rem;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #ffffff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .chatpanel-stats-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem 1rem;
    background-color: #f9fafb;
    border-top: 1px solid #e5e7eb;
    font-size: 0.75rem;
    color: #6b7280;
    font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', monospace;
    transition: background-color 0.2s;
    flex-shrink: 0;
  }

  .chatpanel-stats-bar:hover {
    background-color: #f3f4f6;
  }

  .chatpanel-stats-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: help;
  }

  .chatpanel-stats-label {
    font-weight: 600;
    color: #374151;
  }

  .chatpanel-stats-tokens {
    color: #4b5563;
  }

  .chatpanel-stats-separator {
    color: #d1d5db;
  }

  .chatpanel-stats-cost {
    color: #059669;
    font-weight: 600;
  }
</style>

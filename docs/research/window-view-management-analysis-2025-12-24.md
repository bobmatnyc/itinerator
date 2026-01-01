# Window and View Management Analysis - Itinerizer SvelteKit Application

**Date:** December 24, 2025
**Researcher:** Research Agent
**Project:** Itinerizer TypeScript
**Focus:** Navigation state management, view switching, and component hierarchy

---

## Executive Summary

The Itinerizer SvelteKit application uses a **centralized navigation store pattern** with Svelte 5 runes for managing all view state. The architecture is well-structured with clear separation of concerns, but exhibits **hybrid state management** where both centralized store methods and direct property mutations coexist, creating potential for inconsistency.

**Key Findings:**
- ✅ **Single source of truth**: `navigationStore` (Svelte 5 runes-based)
- ✅ **Event bus pattern**: Decoupled store communication via `eventBus`
- ⚠️ **Hybrid mutation pattern**: Mix of store methods and direct property access
- ⚠️ **Auto-switching logic**: Multiple reactive effects managing view transitions
- ✅ **Session-view coupling**: Proper cleanup with `resetChat(deleteBackendSession=true)`

---

## 1. Navigation State Architecture

### 1.1 Central Navigation Store

**File:** `/viewer-svelte/src/lib/stores/navigation.svelte.ts`

The navigation store uses Svelte 5's `$state` rune and provides a **class-based singleton** pattern:

```typescript
class NavigationStore {
  // View state
  mainView = $state<MainView>('home');
  leftPaneTab = $state<LeftPaneTab>('chat');
  detailTab = $state<DetailTab>('itinerary');
  agentMode = $state<AgentMode>('trip-designer');

  // Modal state
  importModalOpen = $state(false);
  textImportModalOpen = $state(false);
  editModalOpen = $state(false);
  editingItinerary = $state<any | null>(null);
}
```

**Key Types:**
```typescript
type MainView = 'home' | 'itinerary-detail' | 'new-trip-helper' | 'import' | 'help';
type LeftPaneTab = 'chat' | 'itineraries';
type DetailTab = 'itinerary' | 'calendar' | 'map' | 'travelers' | 'docs' | 'faq';
type AgentMode = 'trip-designer' | 'help';
```

### 1.2 Navigation Methods (Centralized API)

The store provides **high-level navigation methods** that update multiple related state properties atomically:

| Method | Updates | Purpose |
|--------|---------|---------|
| `goHome()` | mainView='home', leftPaneTab='chat', agentMode='trip-designer' | Return to home screen |
| `goToItinerary(hasContent)` | mainView based on content, leftPaneTab='chat', agentMode='trip-designer' | Navigate to itinerary view |
| `goToHelp()` | mainView='help', detailTab='docs', agentMode='help', leftPaneTab='chat' | Open help documentation |
| `goToImport()` | mainView='import', leftPaneTab='itineraries' | Navigate to import view |

**Example:**
```typescript
goToItinerary(hasContent: boolean): void {
  if (hasContent) {
    this.mainView = 'itinerary-detail';
    this.leftPaneTab = 'chat';
  } else {
    this.mainView = 'new-trip-helper';
    this.leftPaneTab = 'chat';
  }
  this.agentMode = 'trip-designer';
}
```

### 1.3 URL Synchronization

The store includes **bidirectional URL sync**:

```typescript
// Read from URL
syncFromUrl(params: URLSearchParams): void {
  const mode = params.get('mode');
  const view = params.get('view');

  if (mode === 'help') {
    this.goToHelp();
    return;
  }

  if (view === 'import') {
    this.goToImport();
    return;
  }
  // ... tab parameters
}

// Write to URL
updateUrl(): void {
  const params = this.getUrlParams();
  const currentUrl = new URL(window.location.href);

  // Preserve existing params (like id)
  const id = currentUrl.searchParams.get('id');
  if (id) params.set('id', id);

  const newUrl = `${currentUrl.pathname}?${params.toString()}`;
  window.history.replaceState({}, '', newUrl);
}
```

---

## 2. Store Communication Pattern

### 2.1 Event Bus (Decoupled Communication)

**File:** `/viewer-svelte/src/lib/stores/events.ts`

The application uses an **event bus** to prevent circular dependencies between stores:

```typescript
type StoreEvent =
  | { type: 'auth:logout' }
  | { type: 'auth:login'; email: string }
  | { type: 'itinerary:updated'; id: string }
  | { type: 'itinerary:selected'; id: string }
  | { type: 'itinerary:created'; id: string };

class EventBus {
  emit<T extends StoreEvent>(event: T): void { /* ... */ }
  on<T>(type: T, handler: EventHandler): () => void { /* ... */ }
}

export const eventBus = new EventBus();
```

**Usage Example:**
```typescript
// itineraries.svelte.ts
eventBus.on('auth:logout', () => {
  itinerariesStore.clear();
});
```

**Benefits:**
- ✅ No circular imports between stores
- ✅ Testable (can clear listeners)
- ✅ Type-safe event definitions

### 2.2 Store Dependencies

```
navigationStore (independent)
     ↓
     ↓ referenced by
     ↓
itineraries/+page.svelte
     ↓
     ↓ uses
     ↓
chatStore ← → itinerariesStore
     ↑            ↑
     └── eventBus ──┘
```

---

## 3. View Switching Logic

### 3.1 Main View Rendering (Template)

**File:** `/viewer-svelte/src/routes/itineraries/+page.svelte` (lines 424-506)

The main view uses **if-else branching** on `navigationStore.mainView`:

```svelte
{#if navigationStore.mainView === 'home'}
  <HomeView onQuickPromptClick={handleQuickPrompt} />

{:else if navigationStore.mainView === 'new-trip-helper'}
  <NewTripHelperView
    onPromptSelect={handleQuickPrompt}
    destination={$selectedItinerary?.destinations?.[0]?.name || $selectedItinerary?.title}
  />

{:else if navigationStore.mainView === 'import'}
  <ImportView models={$models} onSuccess={handleTextImportSuccess} />

{:else if navigationStore.mainView === 'help'}
  <MainPane title="Help & Documentation" ...>
    <HelpView activeTab={navigationStore.detailTab} />
  </MainPane>

{:else if navigationStore.mainView === 'itinerary-detail' && $selectedItinerary}
  <MainPane title={$selectedItinerary.title} ...>
    <!-- Tab content based on navigationStore.detailTab -->
  </MainPane>

{:else}
  <!-- Fallback: Empty state -->
{/if}
```

### 3.2 Automatic View Switching (Reactive Effects)

The application has **THREE reactive effects** that automatically switch views:

#### Effect 1: No Itineraries → Home View
```typescript
// Lines 119-123
$effect(() => {
  if (!$itinerariesLoading && $itineraries.length === 0) {
    navigationStore.goHome();
  }
});
```

#### Effect 2: Auto-Switch from Home to Helper/Detail
```typescript
// Lines 126-146
$effect(() => {
  const isOnHomeView = navigationStore.mainView === 'home';
  const hasSelectedItinerary = !!$selectedItinerary;
  const hasActivity = $chatMessages.length > 0 || $isStreaming;

  if (isOnHomeView && hasSelectedItinerary && hasActivity) {
    const hasContent = hasItineraryContent($selectedItinerary);

    if (!hasContent) {
      console.log('[Auto-switch] Switching to new-trip-helper view (empty itinerary)');
      navigationStore.mainView = 'new-trip-helper'; // ⚠️ DIRECT MUTATION
    } else {
      console.log('[Auto-switch] Switching to itinerary-detail view (has content)');
      navigationStore.mainView = 'itinerary-detail'; // ⚠️ DIRECT MUTATION
    }
  }
});
```

#### Effect 3: Helper → Detail When Content Added
```typescript
// Lines 149-159
$effect(() => {
  if (navigationStore.mainView === 'new-trip-helper' && $selectedItinerary) {
    const hasContent = hasItineraryContent($selectedItinerary);

    if (hasContent) {
      console.log('[Auto-switch] Switching from helper to itinerary-detail (itinerary has content)');
      navigationStore.mainView = 'itinerary-detail'; // ⚠️ DIRECT MUTATION
    }
  }
});
```

### 3.3 Content Detection Logic

```typescript
function hasItineraryContent(itinerary: Itinerary | null): boolean {
  if (!itinerary) return false;
  const hasSegments = itinerary.segments && itinerary.segments.length > 0;
  const hasDestinations = itinerary.destinations && itinerary.destinations.length > 0;
  const hasDates = !!(itinerary.startDate || itinerary.endDate);
  return hasSegments || hasDestinations || hasDates;
}
```

---

## 4. Component Hierarchy and Communication

### 4.1 Layout Structure

```
+page.svelte (root)
├── Header (global nav)
├── ImportModal (modal overlay)
├── TextImportModal (modal overlay)
├── EditItineraryModal (modal overlay)
└── main-content
    ├── left-pane (resizable)
    │   ├── Tab Navigation (chat/itineraries)
    │   ├── ChatPanel (when leftPaneTab='chat')
    │   └── Itinerary List (when leftPaneTab='itineraries')
    └── right-pane-wrapper
        ├── right-pane-content (main view area)
        │   ├── HomeView
        │   ├── NewTripHelperView
        │   ├── ImportView
        │   ├── HelpView (wrapped in MainPane)
        │   └── ItineraryDetail (wrapped in MainPane)
        └── VisualizationPane (conditional)
```

### 4.2 Component Props Flow

#### ChatPanel (Complex Component)
```svelte
<ChatPanel
  agent={agentConfig}          // Derived from navigationStore.agentMode
  itineraryId={$selectedItinerary.id}
  initialContent={...}
  disabled={false}
/>
```

**Internal State Management:**
- Uses `chatStore` (writable stores) for session state
- Manages 11+ local state variables with `$state()`
- Subscribes to itinerary changes via `$effect()`
- Auto-creates/resets session when itinerary changes

**Critical Session Management (lines 172-219):**
```typescript
$effect(() => {
  if (agent.mode === 'trip-designer' && itineraryId && previousItineraryId && itineraryId !== previousItineraryId) {
    (async () => {
      // CRITICAL: Delete backend session BEFORE creating new one
      await resetChat(true);  // deleteBackendSession=true

      visualizationStore.clearHistory();

      try {
        await createChatSession(itineraryId, agent.mode);
        previousItineraryId = itineraryId;
        await sendInitialContext();
      } catch (error) {
        // ... error handling
      }
    })();
  }
});
```

**Benefits:**
- ✅ Prevents context leakage between itineraries
- ✅ Properly awaits backend cleanup before creating new session
- ✅ Clears visualization history on itinerary switch

#### HomeView (Simple Component)
```svelte
<HomeView onQuickPromptClick={handleQuickPrompt} />
```

**Props:** Single callback for quick prompt buttons
**State:** Minimal - derived display name from auth store

### 4.3 Parent-Child Communication Patterns

| Pattern | Example | Direction |
|---------|---------|-----------|
| **Props Down** | `agent={agentConfig}` | Parent → Child |
| **Events Up** | `onQuickPromptClick={handler}` | Child → Parent |
| **Shared Store** | `$selectedItinerary` | Bidirectional |
| **Event Bus** | `eventBus.emit('auth:logout')` | Store → Store |

---

## 5. State Inconsistency Risks

### 5.1 Hybrid Mutation Pattern (⚠️ PRIMARY CONCERN)

The application uses **TWO different patterns** for updating `mainView`:

#### Pattern A: Centralized Methods (✅ Recommended)
```typescript
// Uses store methods
navigationStore.goHome();
navigationStore.goToItinerary(hasContent);
navigationStore.goToHelp();
```

**Locations:**
- Line 121: `navigationStore.goHome()`
- Line 186: `navigationStore.goToItinerary(false)`
- Line 211: `navigationStore.goToItinerary(hasContent)`
- Line 216: `navigationStore.goHome()`
- Line 220: `navigationStore.goToHelp()`

#### Pattern B: Direct Property Mutation (⚠️ Inconsistent)
```typescript
// Bypasses store methods
navigationStore.mainView = 'new-trip-helper';
navigationStore.mainView = 'itinerary-detail';
```

**Locations:**
- Line 139: `navigationStore.mainView = 'new-trip-helper'`
- Line 143: `navigationStore.mainView = 'itinerary-detail'`
- Line 156: `navigationStore.mainView = 'itinerary-detail'`
- Line 243: `navigationStore.mainView = 'itinerary-detail'`
- Line 261: `navigationStore.mainView = 'itinerary-detail'`

**Problem:**
When using **Pattern B**, related state is NOT updated:
- `leftPaneTab` remains unchanged
- `agentMode` remains unchanged
- `detailTab` remains unchanged

**Example Scenario:**
```typescript
// User is in help mode (agentMode='help', leftPaneTab='chat')
// Auto-switch to itinerary-detail via Pattern B:
navigationStore.mainView = 'itinerary-detail';

// Result:
// ✅ mainView = 'itinerary-detail'
// ❌ agentMode = 'help' (should be 'trip-designer')
// ❌ detailTab = 'docs' (should be 'itinerary')
// ✅ leftPaneTab = 'chat' (correct by coincidence)
```

### 5.2 Reactive Effect Race Conditions

**Potential Issue:** Multiple effects can fire simultaneously:

```typescript
// Effect 1: No itineraries → goHome()
$effect(() => {
  if (!$itinerariesLoading && $itineraries.length === 0) {
    navigationStore.goHome(); // Sets mainView='home'
  }
});

// Effect 2: Home + activity → switch to helper/detail
$effect(() => {
  if (navigationStore.mainView === 'home' && hasActivity) {
    navigationStore.mainView = 'itinerary-detail'; // Overrides Effect 1
  }
});
```

**Current Mitigation:**
- Effects check specific conditions before firing
- Svelte 5's reactive system batches updates

**Remaining Risk:**
- Order of effect execution is not guaranteed
- No explicit effect dependencies or priorities

### 5.3 Session-View Coupling

**Positive Finding:** The application properly couples chat sessions to itineraries:

```typescript
// ChatPanel.svelte (lines 172-219)
$effect(() => {
  if (itineraryId !== previousItineraryId) {
    // CRITICAL: Delete backend session AND frontend state
    await resetChat(true);  // deleteBackendSession=true

    // Create fresh session for new itinerary
    await createChatSession(itineraryId, agent.mode);
    previousItineraryId = itineraryId;
  }
});
```

**Benefits:**
- ✅ No context leakage between itineraries
- ✅ Backend session deleted before creating new one (prevents orphaned sessions)
- ✅ Visualization history cleared on switch
- ✅ Token/cost tracking reset per itinerary

---

## 6. Multiple Sources of Truth Analysis

### 6.1 Navigation State (✅ Single Source)

**Source:** `navigationStore` (Svelte 5 runes-based singleton)

**Evidence:**
- All view state centralized in one store
- Components read via `navigationStore.mainView`
- No duplicate state in component local variables

### 6.2 Itinerary State (✅ Single Source)

**Source:** `itinerariesStore` (writable stores with class-based methods)

**Evidence:**
```typescript
export const itineraries = writable<ItineraryListItem[]>([]);
export const selectedItinerary = writable<Itinerary | null>(null);
export const selectedItineraryId = writable<string | undefined>(undefined);
```

Components access via `$itineraries`, `$selectedItinerary` stores.

### 6.3 Chat State (✅ Single Source)

**Source:** `chatStore` (writable stores with class-based methods)

**Evidence:**
```typescript
export const chatSessionId = writable<string | null>(null);
export const chatMessages = writable<ChatMessage[]>([]);
export const structuredQuestions = writable<StructuredQuestion[] | null>(null);
// ... 10+ more stores
```

**Note:** ChatStore uses **backward-compatible writable stores** rather than Svelte 5 runes internally.

### 6.4 Visualization State (✅ Single Source)

**Source:** `visualizationStore` (Svelte 5 runes-based)

**Evidence:**
```typescript
// Referenced in +page.svelte (lines 53-54)
let isPaneVisible = $derived(visualizationStore.isPaneVisible);
let historyLength = $derived(visualizationStore.history.length);
```

---

## 7. Event Bus Pattern Usage

**File:** `/viewer-svelte/src/lib/stores/events.ts`

### 7.1 Current Events

| Event Type | Emitted By | Listened By | Purpose |
|------------|------------|-------------|---------|
| `auth:logout` | authStore | itinerariesStore | Clear itinerary data on logout |
| `auth:login` | authStore | (unused?) | Track login events |
| `itinerary:updated` | (unused?) | (unused?) | Future: Broadcast itinerary changes |
| `itinerary:selected` | (unused?) | (unused?) | Future: Track itinerary selection |
| `itinerary:created` | (unused?) | (unused?) | Future: Track itinerary creation |

### 7.2 Event Bus Benefits

✅ **Prevents Circular Dependencies:**
```typescript
// WITHOUT event bus (circular dependency):
// itinerariesStore.ts
import { authStore } from './auth.svelte';
authStore.subscribe(...);  // ❌ Creates circular import

// WITH event bus (decoupled):
// itinerariesStore.ts
import { eventBus } from './events';
eventBus.on('auth:logout', () => { ... });  // ✅ No circular import
```

✅ **Testability:**
```typescript
// Clear all listeners before each test
beforeEach(() => {
  eventBus.clear();
});
```

---

## 8. Left Pane Tab Switching

### 8.1 Tab State Management

```svelte
<!-- Lines 304-319 -->
<div class="left-pane-tabs">
  <button
    class="tab-button {navigationStore.leftPaneTab === 'chat' ? 'active' : ''}"
    onclick={() => navigationStore.setLeftPaneTab('chat')}
    type="button"
  >
    💬 Chat
  </button>
  <button
    class="tab-button {navigationStore.leftPaneTab === 'itineraries' ? 'active' : ''}"
    onclick={() => navigationStore.setLeftPaneTab('itineraries')}
    type="button"
  >
    📋 Itineraries
  </button>
</div>
```

### 8.2 Conditional Content Rendering

```svelte
<!-- Lines 322-404 -->
{#if navigationStore.leftPaneTab === 'chat'}
  <div class="chat-tab-content">
    {#if $selectedItinerary}
      <ChatPanel agent={agentConfig} itineraryId={$selectedItinerary.id} />
    {:else}
      <!-- No itinerary selected state -->
    {/if}
  </div>

{:else}
  <!-- Itineraries tab: Header + List -->
  <div class="left-pane-header">
    <!-- Import/Create buttons -->
  </div>
  <div class="left-pane-content">
    <!-- Itinerary list -->
  </div>
{/if}
```

**Benefits:**
- ✅ Consistent: Uses `setLeftPaneTab()` method
- ✅ Simple: Binary choice (chat/itineraries)
- ✅ Stateful: Tab selection persists during view changes

---

## 9. Modal Management

### 9.1 Modal State (Centralized in navigationStore)

```typescript
// navigation.svelte.ts
importModalOpen = $state(false);
textImportModalOpen = $state(false);
editModalOpen = $state(false);
editingItinerary = $state<any | null>(null);

openImportModal(): void { this.importModalOpen = true; }
closeImportModal(): void { this.importModalOpen = false; }
openEditModal(itinerary: any): void {
  this.editingItinerary = itinerary;
  this.editModalOpen = true;
}
closeEditModal(): void {
  this.editModalOpen = false;
  this.editingItinerary = null;
}
```

### 9.2 Modal Binding Pattern

```svelte
<!-- Lines 291-297 -->
<ImportModal bind:open={navigationStore.importModalOpen} onImport={handleImport} />
<TextImportModal bind:open={navigationStore.textImportModalOpen} onSuccess={handleTextImportSuccess} />
<EditItineraryModal bind:open={navigationStore.editModalOpen} itinerary={navigationStore.editingItinerary} />
```

**Pattern:** Two-way binding with `bind:open` allows modals to close themselves.

**Benefits:**
- ✅ Modal state centralized
- ✅ Can be opened from anywhere via `navigationStore`
- ✅ Modals can close themselves (via `bind:`)

---

## 10. Recommendations

### 10.1 Critical: Fix Hybrid Mutation Pattern

**Problem:** Mixing store methods and direct mutations causes state inconsistency.

**Solution:** Enforce **exclusive use of store methods**:

```typescript
// ❌ BEFORE (inconsistent):
navigationStore.mainView = 'itinerary-detail';

// ✅ AFTER (consistent):
navigationStore.goToItinerary(true);
```

**Implementation Steps:**

1. **Add missing navigation methods:**
```typescript
// navigation.svelte.ts
goToNewTripHelper(): void {
  this.mainView = 'new-trip-helper';
  this.leftPaneTab = 'chat';
  this.agentMode = 'trip-designer';
  this.detailTab = 'itinerary';
}

goToItineraryDetail(): void {
  this.mainView = 'itinerary-detail';
  this.leftPaneTab = 'chat';
  this.agentMode = 'trip-designer';
  this.detailTab = 'itinerary';
}
```

2. **Update auto-switch effects:**
```typescript
// +page.svelte (Effect 2)
if (!hasContent) {
  navigationStore.goToNewTripHelper();  // ✅ Use method
} else {
  navigationStore.goToItineraryDetail();  // ✅ Use method
}
```

3. **Update manual navigation:**
```typescript
// Line 243
navigationStore.goToItineraryDetail();  // ✅ Use method

// Line 261
navigationStore.goToItineraryDetail();  // ✅ Use method
```

### 10.2 Optional: Add Effect Priority/Dependencies

**Problem:** Multiple effects can fire simultaneously without clear ordering.

**Solution:** Consolidate related effects or add explicit dependencies:

```typescript
// Consolidated effect with clear priority
$effect(() => {
  // Priority 1: No itineraries case
  if (!$itinerariesLoading && $itineraries.length === 0) {
    navigationStore.goHome();
    return;  // Early exit prevents further checks
  }

  // Priority 2: Auto-switch from home
  if (navigationStore.mainView === 'home' && $selectedItinerary && hasActivity) {
    const hasContent = hasItineraryContent($selectedItinerary);
    if (hasContent) {
      navigationStore.goToItineraryDetail();
    } else {
      navigationStore.goToNewTripHelper();
    }
    return;
  }

  // Priority 3: Helper → Detail upgrade
  if (navigationStore.mainView === 'new-trip-helper' && $selectedItinerary) {
    const hasContent = hasItineraryContent($selectedItinerary);
    if (hasContent) {
      navigationStore.goToItineraryDetail();
    }
  }
});
```

### 10.3 Optional: Type Safety for Direct Mutations

**If direct mutations must remain**, add TypeScript private modifier:

```typescript
class NavigationStore {
  private _mainView = $state<MainView>('home');

  get mainView(): MainView {
    return this._mainView;
  }

  // Force use of methods by making setter private
  private set mainView(value: MainView) {
    this._mainView = value;
  }
}
```

**Benefits:**
- ✅ Prevents external direct mutations
- ✅ Allows internal use by methods
- ⚠️ Breaking change (requires refactoring all access points)

### 10.4 Document Navigation State Machine

Create visual state machine diagram:

```
                    ┌──────────────┐
                    │     home     │
                    └──────┬───────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
  │  new-trip-   │ │  itinerary-  │ │     help     │
  │   helper     │ │    detail    │ └──────────────┘
  └──────┬───────┘ └──────────────┘
         │
         │ (content added)
         └──────────────────────────▶ itinerary-detail
```

### 10.5 Add Navigation Debugging

**Enhancement:** Log all navigation changes for debugging:

```typescript
class NavigationStore {
  private logNavigation(from: MainView, to: MainView, trigger: string): void {
    if (import.meta.env.DEV) {
      console.log(`[Navigation] ${from} → ${to} (${trigger})`);
    }
  }

  goHome(): void {
    const from = this.mainView;
    this.mainView = 'home';
    this.logNavigation(from, 'home', 'goHome()');
  }
}
```

---

## 11. Positive Findings

### 11.1 Strengths

✅ **Centralized Navigation State**
- Single source of truth in `navigationStore`
- No duplicate state across components

✅ **Event Bus Pattern**
- Prevents circular dependencies
- Testable and type-safe

✅ **Proper Session Management**
- Chat sessions properly coupled to itineraries
- Backend cleanup with `resetChat(deleteBackendSession=true)`
- Visualization history cleared on itinerary switch

✅ **URL Synchronization**
- Bidirectional URL sync preserves navigation state
- Deep linking supported via `syncFromUrl()`

✅ **Svelte 5 Runes**
- Modern reactive primitives (`$state`, `$derived`, `$effect`)
- Better performance than Svelte 4 stores

✅ **Modal Management**
- Centralized modal state
- Two-way binding for self-closing modals

### 11.2 Architecture Quality

**Score:** 8.5/10

**Rationale:**
- Strong separation of concerns
- Well-structured component hierarchy
- Good use of Svelte 5 features
- Deducted 1.5 points for hybrid mutation pattern

---

## 12. Summary of Issues

### Critical Issues (🔴)
1. **Hybrid mutation pattern**: Mixing `navigationStore.goHome()` and `navigationStore.mainView = 'home'` causes inconsistent related state updates

### Minor Issues (🟡)
1. **Multiple reactive effects**: Three separate effects manage view switching with potential race conditions
2. **Unused event types**: `itinerary:updated`, `itinerary:selected`, `itinerary:created` defined but never used

### Non-Issues (✅)
1. **Session-view coupling**: Properly handled with `resetChat(deleteBackendSession=true)`
2. **Multiple sources of truth**: NOT present - single source per state domain
3. **Event bus**: Well-designed and correctly used

---

## 13. File Locations Reference

| Component/Store | File Path | Lines of Interest |
|----------------|-----------|-------------------|
| Navigation Store | `/viewer-svelte/src/lib/stores/navigation.svelte.ts` | 34-265 (full store) |
| Chat Store | `/viewer-svelte/src/lib/stores/chat.svelte.ts` | 19-526 (class + exports) |
| Itineraries Store | `/viewer-svelte/src/lib/stores/itineraries.svelte.ts` | 56-240 (class + exports) |
| Event Bus | `/viewer-svelte/src/lib/stores/events.ts` | 12-69 (full implementation) |
| Main Page | `/viewer-svelte/src/routes/itineraries/+page.svelte` | 1-893 (full file) |
| Chat Panel | `/viewer-svelte/src/lib/components/ChatPanel.svelte` | 1-2007 (full component) |
| Home View | `/viewer-svelte/src/lib/components/HomeView.svelte` | 1-351 (full component) |
| Main Pane | `/viewer-svelte/src/lib/components/MainPane.svelte` | 1-148 (layout component) |

---

## 14. Related Documentation

- **Svelte 5 Runes:** https://svelte-5-preview.vercel.app/docs/runes
- **SvelteKit Routing:** https://kit.svelte.dev/docs/routing
- **Project Overview:** `/Users/masa/Projects/itinerator/CLAUDE.md`

---

**End of Report**

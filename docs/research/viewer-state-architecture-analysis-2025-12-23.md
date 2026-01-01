# Viewer State Architecture Analysis

**Date:** 2025-12-23
**Scope:** viewer-svelte application state management and view/window architecture
**Objective:** Document current state architecture, identify pain points, and recommend consolidation

---

## Executive Summary

The viewer-svelte application manages complex state across **5 stores** and **multiple component-local state variables**. The architecture shows a **split between Svelte 4 (writable stores) and Svelte 5 (runes)**, with **view management responsibility scattered** across route components and local state.

### Critical Findings

1. **View state has no single source of truth** - managed in `+page.svelte` component state
2. **Store paradigm inconsistency** - mixing Svelte 4 writable stores with Svelte 5 runes
3. **Session management complexity** - chat sessions tightly coupled to itineraries with unclear lifecycle
4. **Duplication between stores** - `selectedItinerary` exists in both itineraries store and is queried repeatedly
5. **Navigation state scattered** - tabs, active views, and window state in component-local variables

---

## 1. Current State Architecture

### 1.1 Store Inventory

| Store | Paradigm | Purpose | State Managed | Persistence |
|-------|----------|---------|---------------|-------------|
| **settings.svelte.ts** | Svelte 5 Runes | User preferences | API key, name, nickname, home airport | localStorage |
| **auth.svelte.ts** | Svelte 5 Runes | Authentication | isAuthenticated, userEmail | localStorage |
| **itineraries.ts** | Svelte 4 Writable | Itinerary data | List, selected itinerary, loading states | None (server) |
| **chat.ts** | Svelte 4 Writable | Chat/messaging | Messages, session, streaming, structured questions | None (server) |
| **visualization.svelte.ts** | Svelte 5 Runes | Map/calendar viz | Current visualization, history, pane state | None (ephemeral) |

### 1.2 Component-Level State (itineraries/+page.svelte)

**View/Window Management (NO STORE):**
```typescript
let mainView = $state<MainView>('home');  // 'home' | 'itinerary-detail' | 'new-trip-helper' | 'import' | 'help'
let leftPaneTab = $state<LeftPaneTab>('chat');  // 'chat' | 'itineraries'
let detailTab = $state<DetailTab>('itinerary');  // 'itinerary' | 'calendar' | 'map' | 'travelers' | 'docs' | 'faq'
```

**Layout State:**
```typescript
let leftPaneWidth = $state(350);
let isResizing = $state(false);
```

**Modal State:**
```typescript
let importModalOpen = $state(false);
let textImportModalOpen = $state(false);
let editModalOpen = $state(false);
let editingItinerary = $state<ItineraryListItemType | null>(null);
```

**Agent Configuration:**
```typescript
let agentConfig = $state<AgentConfig>({
  mode: 'trip-designer',
  placeholderText: 'Type a message... (Shift+Enter for new line)',
  showTokenStats: true
});
```

---

## 2. Store Deep Dive

### 2.1 Settings Store (settings.svelte.ts)

**Pattern:** Svelte 5 Runes + Class-based
**Persistence:** localStorage with SSR-safe checks

**State:**
```typescript
class SettingsStore {
  firstName = $state('');
  lastName = $state('');
  nickname = $state('');
  openRouterKey = $state('');
  homeAirport = $state('');
}
```

**Responsibilities:**
- ✅ Manages user profile data
- ✅ Persists to localStorage automatically
- ✅ Provides derived `hasAIAccess()` function

**Pain Points:**
- None identified - clean implementation

---

### 2.2 Auth Store (auth.svelte.ts)

**Pattern:** Svelte 5 Runes + Class-based
**Persistence:** localStorage with SSR-safe checks

**State:**
```typescript
class AuthStore {
  isAuthenticated = $state(false);
  private _userEmail = $state<string | null>(null);

  get userEmail(): string | null { return this._userEmail; }
  set userEmail(email: string | null) { /* ... */ }
}
```

**Responsibilities:**
- ✅ Authentication state management
- ✅ Password hashing (SHA-256)
- ✅ Session persistence
- ⚠️ Triggers `clearItineraries()` on logout (cross-store coupling)

**Pain Points:**
- **Cross-store dependency** - directly imports and calls `clearItineraries()`
- User email duplicated in multiple places (auth store, settings, localStorage keys)

---

### 2.3 Itineraries Store (itineraries.ts)

**Pattern:** Svelte 4 Writable Stores
**Persistence:** None (server-backed)

**State:**
```typescript
export const itineraries = writable<ItineraryListItem[]>([]);
export const itinerariesLoading = writable<boolean>(true);
export const itinerariesError = writable<string | null>(null);

export const selectedItineraryId = writable<string | undefined>(undefined);
export const selectedItinerary = writable<Itinerary | null>(null);
export const selectedItineraryLoading = writable<boolean>(false);

export const models = writable<ModelConfig[]>([]);
export const modelsLoading = writable<boolean>(false);

export const importing = writable<boolean>(false);
```

**Responsibilities:**
- ✅ Manages itinerary list and selected itinerary
- ✅ Provides CRUD operations (loadItineraries, createItinerary, updateItinerary, deleteItinerary)
- ✅ Manages segment operations (addSegment, updateSegment, deleteSegment)
- ✅ Model configuration loading

**Pain Points:**
- **Duplication** - `selectedItineraryId` AND `selectedItinerary` (should be derived)
- **Scattered loading states** - 4 separate loading booleans instead of state machine
- **No typed state machine** - loading/error states managed with booleans
- **Mixed responsibilities** - models should be separate concern
- **No derived selectors** - components query `$selectedItinerary?.id === itinerary.id` repeatedly

---

### 2.4 Chat Store (chat.ts)

**Pattern:** Svelte 4 Writable Stores
**Persistence:** None (server-backed sessions)

**State (14 stores!):**
```typescript
// Core chat state
export const chatSessionId = writable<string | null>(null);
export const chatMessages = writable<ChatMessage[]>([]);
export const chatLoading = writable<boolean>(false);
export const chatError = writable<string | null>(null);
export const structuredQuestions = writable<StructuredQuestion[] | null>(null);

// Streaming state
export const streamingContent = writable<string>('');
export const isStreaming = writable<boolean>(false);
export const isThinking = writable<boolean>(false);
export const currentToolCall = writable<string | null>(null);
export const itineraryUpdated = writable<boolean>(false);

// Token tracking
export const sessionTokens = writable<TokenUsage>({ input: 0, output: 0, total: 0 });
export const sessionCost = writable<CostData>({ input: 0, output: 0, total: 0 });

// UI state
export const pendingPrompt = writable<string | null>(null);
```

**Responsibilities:**
- ✅ Chat session lifecycle (create, reset)
- ✅ Message sending (streaming and non-streaming)
- ✅ Streaming state management
- ✅ Token and cost tracking
- ✅ Structured questions handling
- ⚠️ Content cleaning and JSON parsing (complex logic in store)
- ⚠️ Location detection with hardcoded coordinates (500+ lines of location data)

**Pain Points:**
- **Massive store** - 787 lines, single responsibility violation
- **14 separate writable stores** - should be consolidated into state machine
- **Business logic in store** - `cleanMessageContent()`, `detectLocationsInText()` belong in utilities
- **Hardcoded data** - 200+ lines of airport/city coordinates (should be separate data file)
- **Complex state transitions** - streaming/thinking/loading states have race conditions
- **Tight coupling** - directly manipulates `visualizationStore` and `settingsStore`
- **No session-itinerary binding clarity** - unclear what happens when itinerary changes

---

### 2.5 Visualization Store (visualization.svelte.ts)

**Pattern:** Svelte 5 Runes + Closure
**Persistence:** None (ephemeral)

**State:**
```typescript
interface VisualizationState {
  current: Visualization | null;
  history: Visualization[];
  isPaneVisible: boolean;
  isPaneCollapsed: boolean;
}
```

**Responsibilities:**
- ✅ Manages map and calendar visualizations
- ✅ Tracks visualization history
- ✅ Controls visualization pane visibility
- ✅ Extracts visualization data from tool results

**Pain Points:**
- **Extraction logic in store** - `extractMapDataFromSegment()` is 100+ lines, belongs in utility
- **Tight coupling to chat** - extraction logic expects specific tool result formats

---

## 3. View/Window Management

### 3.1 Current Architecture

**View state is managed ENTIRELY in component state** (`itineraries/+page.svelte`):

```typescript
// NO STORE - all in component state
let mainView = $state<MainView>('home');
let leftPaneTab = $state<LeftPaneTab>('chat');
let detailTab = $state<DetailTab>('itinerary');
```

**View Transitions via $effect():**
```typescript
// URL params → view state
$effect(() => {
  const mode = $page.url.searchParams.get('mode');
  const view = $page.url.searchParams.get('view');
  const id = $page.url.searchParams.get('id');

  if (mode === 'help') mainView = 'help';
  else if (view === 'import') mainView = 'import';
  else if (id && $selectedItinerary?.id === id) mainView = 'itinerary-detail';
  else if (!id && !view && !mode) mainView = 'home';
});

// Auto-switch to helper/detail when activity starts
$effect(() => {
  const isOnHomeView = mainView === 'home';
  const hasSelectedItinerary = !!$selectedItinerary;
  const hasActivity = $chatMessages.length > 0 || $isStreaming;

  if (isOnHomeView && hasSelectedItinerary && hasActivity) {
    const hasContent = hasItineraryContent($selectedItinerary);
    mainView = hasContent ? 'itinerary-detail' : 'new-trip-helper';
  }
});

// Auto-switch from helper to detail when content appears
$effect(() => {
  if (mainView === 'new-trip-helper' && $selectedItinerary) {
    const hasContent = hasItineraryContent($selectedItinerary);
    if (hasContent) mainView = 'itinerary-detail';
  }
});
```

### 3.2 Pain Points

1. **No single source of truth** - view state in component, not shareable across routes
2. **Complex $effect() chains** - 4 separate effects manage view transitions, hard to reason about
3. **Race conditions** - multiple effects can update `mainView` simultaneously
4. **Testing difficulty** - can't test view logic without mounting entire page component
5. **No history/back button** - view state not synced to URL properly
6. **Implicit state transitions** - hidden dependencies on `$selectedItinerary`, `$chatMessages`, `$isStreaming`

---

## 4. Session Management

### 4.1 Chat Session Lifecycle

**Session Creation:**
```typescript
// ChatPanel.svelte onMount
onMount(async () => {
  if (agent.mode === 'trip-designer' && itineraryId) {
    resetChat();
    visualizationStore.clearHistory();
    await createChatSession(itineraryId, agent.mode);
  }
});
```

**Session-Itinerary Relationship:**
- Chat sessions are **per-itinerary** (trip-designer mode) or **global** (help mode)
- Session ID stored in `chatSessionId` writable
- **Problem:** When itinerary changes, session handling is unclear:
  - `previousItineraryId` tracked in component state
  - Manual `resetChat()` call required
  - No automatic cleanup

### 4.2 Pain Points

1. **Session-itinerary coupling unclear** - should sessions persist when switching itineraries?
2. **Manual lifecycle management** - components must call `resetChat()` explicitly
3. **Race condition** - `createChatSession()` can fail if session already exists
4. **No session restoration** - refresh loses session state
5. **Dual session modes** - trip-designer vs help mode with different behaviors

---

## 5. Navigation State

### 5.1 Current Architecture

**Three-level tab system:**

1. **Left Pane Tabs** (`leftPaneTab`): `'chat' | 'itineraries'`
2. **Main View** (`mainView`): `'home' | 'itinerary-detail' | 'new-trip-helper' | 'import' | 'help'`
3. **Detail Tabs** (`detailTab`): `'itinerary' | 'calendar' | 'map' | 'travelers' | 'docs' | 'faq'`

**State Location:** All in component state, no store

### 5.2 Pain Points

1. **No URL sync** - tabs don't update URL query params
2. **Lost on refresh** - tab state resets to defaults
3. **No deep linking** - can't share link to specific tab
4. **Component-local** - can't trigger tab changes from other components/stores

---

## 6. User Context

### 6.1 Current Architecture

**User data scattered across:**
- `authStore.isAuthenticated` (Svelte 5 rune)
- `authStore.userEmail` (Svelte 5 rune)
- `settingsStore.firstName/lastName/nickname` (Svelte 5 runes)
- `settingsStore.openRouterKey` (Svelte 5 rune)
- localStorage keys: `itinerator_auth`, `itinerator_user_email`, `itinerator_settings`

**API client reads directly from localStorage:**
```typescript
// api.ts
function getUserEmail(): string | null {
  return localStorage.getItem('itinerator_user_email');
}
```

### 6.2 Pain Points

1. **Duplication** - user email in both auth store AND settings localStorage
2. **Inconsistent reads** - some code reads from store, some from localStorage directly
3. **No derived user context** - components check `hasAIAccess()` separately
4. **Logout coupling** - auth store calls `clearItineraries()` directly

---

## 7. State Architecture Anti-Patterns

### 7.1 Mixed Paradigms

**Svelte 4 vs Svelte 5:**
- `settings.svelte.ts`, `auth.svelte.ts`, `visualization.svelte.ts` → Svelte 5 runes
- `itineraries.ts`, `chat.ts` → Svelte 4 writable stores
- **Problem:** Inconsistent patterns, harder to reason about reactivity

### 7.2 Store Responsibility Violations

**Chat store (787 lines):**
- Message management ✅
- Streaming state ✅
- Session lifecycle ✅
- Content cleaning ❌ (should be utility)
- Location detection ❌ (should be service)
- 200+ lines of location data ❌ (should be data file)
- Visualization extraction ❌ (visualization store responsibility)

**Itineraries store:**
- Itinerary CRUD ✅
- Segment CRUD ✅
- Model loading ❌ (should be separate)
- Import state ❌ (should be separate)

### 7.3 Derived State Not Derived

**Should be computed:**
- `selectedItinerary` should derive from `itineraries` + `selectedItineraryId`
- `hasAIAccess()` should be derived property on settings store
- Current visualization should derive from history

**Currently stored as separate writables:**
- Leads to synchronization bugs
- Manual updates in multiple places

### 7.4 Component State That Should Be Store

**View/navigation state:**
- Currently: component-local state in `+page.svelte`
- Should be: dedicated navigation/router store
- Benefits: URL sync, deep linking, testability

**Modal state:**
- Currently: component-local state
- Should be: UI state store or component-scoped

---

## 8. Pain Points Summary

### 8.1 Critical Issues

1. **View state has no single source of truth** - scattered in component state, not testable or shareable
2. **Chat store too large** - 787 lines, multiple responsibilities, hardcoded data
3. **No state machines** - boolean flags instead of typed state machines (loading/error states)
4. **Mixed Svelte paradigms** - confusing reactivity model
5. **Session management unclear** - session-itinerary lifecycle not well-defined

### 8.2 Major Issues

6. **Derived state stored separately** - `selectedItinerary` duplication
7. **Business logic in stores** - content cleaning, location detection, visualization extraction
8. **Cross-store coupling** - auth calls itineraries, chat calls visualization
9. **No URL sync** - view/tab state lost on refresh
10. **Component $effect() complexity** - 4 effects managing view transitions with race conditions

### 8.3 Minor Issues

11. User context duplication (auth vs settings)
12. Loading states as separate booleans instead of enum
13. No session restoration on refresh
14. Direct localStorage reads bypassing stores

---

## 9. Recommendations for Consolidation

### 9.1 Immediate Actions (High Priority)

#### 1. Create Navigation Store (Svelte 5 Runes)

**Purpose:** Centralize view/tab/navigation state

```typescript
// stores/navigation.svelte.ts
class NavigationStore {
  mainView = $state<MainView>('home');
  leftPaneTab = $state<LeftPaneTab>('chat');
  detailTab = $state<DetailTab>('itinerary');

  // Derived
  get canNavigateBack() { /* ... */ }

  // Actions
  navigateTo(view: MainView) { /* ... */ }
  setLeftTab(tab: LeftPaneTab) { /* ... */ }
  setDetailTab(tab: DetailTab) { /* ... */ }
}
```

**Benefits:**
- Single source of truth for navigation
- Testable in isolation
- Can sync to URL params
- Shareable across components

#### 2. Migrate Chat Store to Svelte 5 + Refactor

**Extract:**
- Content cleaning → `utils/content-cleaner.ts`
- Location detection → `services/location-detector.ts`
- Location data → `data/known-locations.ts`
- Visualization extraction → visualization store

**Consolidate state:**
```typescript
// Instead of 14 separate stores:
class ChatStore {
  sessionId = $state<string | null>(null);
  messages = $state<ChatMessage[]>([]);

  // State machine instead of booleans
  status = $state<'idle' | 'thinking' | 'streaming' | 'error'>('idle');
  error = $state<string | null>(null);

  structuredQuestions = $state<StructuredQuestion[] | null>(null);
  currentToolCall = $state<string | null>(null);

  streamingContent = $state<string>('');

  tokens = $state<TokenUsage>({ input: 0, output: 0, total: 0 });
  cost = $state<CostData>({ input: 0, output: 0, total: 0 });

  pendingPrompt = $state<string | null>(null);
}
```

#### 3. Fix Derived State in Itineraries Store

**Convert to Svelte 5:**
```typescript
class ItinerariesStore {
  items = $state<ItineraryListItem[]>([]);
  selectedId = $state<string | undefined>(undefined);
  status = $state<'idle' | 'loading' | 'error'>('idle');
  error = $state<string | null>(null);

  // Derived - no separate writable!
  get selected() {
    return this.items.find(i => i.id === this.selectedId) ?? null;
  }

  get isLoading() {
    return this.status === 'loading';
  }
}
```

**Separate models store:**
```typescript
class ModelsStore {
  items = $state<ModelConfig[]>([]);
  status = $state<'idle' | 'loading' | 'error'>('idle');
}
```

---

### 9.2 Medium Priority

#### 4. Create UI State Store

**Purpose:** Centralize modal and UI state

```typescript
class UIStore {
  modals = $state({
    import: false,
    textImport: false,
    editItinerary: false,
  });

  leftPaneWidth = $state(350);

  editingItinerary = $state<ItineraryListItem | null>(null);

  openModal(name: keyof typeof this.modals) { /* ... */ }
  closeModal(name: keyof typeof this.modals) { /* ... */ }
}
```

#### 5. Decouple Store Dependencies

**Remove cross-store imports:**
- Auth store shouldn't call `clearItineraries()` directly
- Chat store shouldn't manipulate visualization store
- Use events/callbacks instead

**Pattern:**
```typescript
// Instead of:
import { clearItineraries } from './itineraries';
clearItineraries();

// Use:
export const authEvents = {
  onLogout: new EventEmitter()
};

// In itineraries store:
authEvents.onLogout.subscribe(() => {
  clearItineraries();
});
```

---

### 9.3 Lower Priority (Enhancements)

#### 6. Add URL Synchronization

**Use SvelteKit's $page store:**
```typescript
// navigation store
syncToURL() {
  const params = new URLSearchParams();
  if (this.mainView !== 'home') params.set('view', this.mainView);
  if (this.detailTab !== 'itinerary') params.set('tab', this.detailTab);
  goto(`?${params}`, { replaceState: true, noScroll: true });
}
```

#### 7. Add Session Persistence

**Store session in localStorage:**
```typescript
class ChatStore {
  // Persist session ID per itinerary
  saveSession(itineraryId: string, sessionId: string) {
    const sessions = JSON.parse(localStorage.getItem('chat_sessions') ?? '{}');
    sessions[itineraryId] = sessionId;
    localStorage.setItem('chat_sessions', JSON.stringify(sessions));
  }

  restoreSession(itineraryId: string): string | null {
    const sessions = JSON.parse(localStorage.getItem('chat_sessions') ?? '{}');
    return sessions[itineraryId] ?? null;
  }
}
```

#### 8. Consolidate User Context

**Single user store:**
```typescript
class UserStore {
  // Auth
  isAuthenticated = $state(false);
  email = $state<string | null>(null);

  // Profile
  firstName = $state('');
  lastName = $state('');
  nickname = $state('');
  homeAirport = $state('');

  // API access
  openRouterKey = $state('');

  // Derived
  get hasAIAccess() {
    return !!this.openRouterKey?.trim();
  }

  get displayName() {
    return this.nickname || this.firstName || this.email?.split('@')[0] || 'User';
  }
}
```

---

## 10. Migration Strategy

### Phase 1: Navigation & View State (Week 1)
1. Create `navigation.svelte.ts` store
2. Move view state from `+page.svelte` to store
3. Add URL synchronization
4. Update components to use navigation store

### Phase 2: Itineraries Store Cleanup (Week 1-2)
1. Migrate to Svelte 5 runes
2. Make `selected` a derived getter
3. Convert loading booleans to state machine
4. Extract models to separate store

### Phase 3: Chat Store Refactor (Week 2-3)
1. Extract content cleaning to utilities
2. Extract location detection to service
3. Move location data to separate file
4. Consolidate 14 stores into state machine
5. Migrate to Svelte 5 runes
6. Add session persistence

### Phase 4: Decouple Stores (Week 3)
1. Remove cross-store imports
2. Add event bus for store communication
3. Create UI state store for modals

### Phase 5: User Context Consolidation (Week 4)
1. Merge auth + settings into user store
2. Update all user context reads
3. Remove localStorage duplication

---

## 11. Testing Strategy

### Before Refactor
1. Document current behavior with E2E tests
2. Create test cases for view transitions
3. Test session lifecycle edge cases

### During Refactor
1. Unit test each new store in isolation
2. Test derived properties
3. Test state machine transitions

### After Refactor
1. Verify E2E tests still pass
2. Add new tests for URL sync
3. Add tests for session persistence

---

## 12. Appendix: Store Metrics

| Store | Lines | Writables | Runes | Paradigm | Business Logic | Data Files |
|-------|-------|-----------|-------|----------|----------------|------------|
| settings.svelte.ts | 193 | 0 | 5 | Svelte 5 | ✅ None | ✅ None |
| auth.svelte.ts | 127 | 0 | 2 | Svelte 5 | ✅ Minimal | ✅ None |
| itineraries.ts | 175 | 9 | 0 | Svelte 4 | ✅ None | ✅ None |
| chat.ts | 787 | 14 | 0 | Svelte 4 | ❌ 200+ lines | ❌ 500 lines |
| visualization.svelte.ts | 380 | 0 | 4 | Svelte 5 | ⚠️ 100+ lines | ✅ None |

**Total:** 1,662 lines across 5 stores

---

## 13. Conclusion

The viewer-svelte state architecture demonstrates **good separation of concerns at the store level** but suffers from:

1. **Missing navigation store** - view state scattered in components
2. **Chat store bloat** - too many responsibilities
3. **Mixed paradigms** - Svelte 4 + Svelte 5 inconsistency
4. **Derived state duplication** - manual synchronization required
5. **Complex component effects** - view transitions hard to reason about

**Primary recommendation:** Create a navigation store and refactor chat store as highest priority items. The navigation store will eliminate the most complex $effect() chains and provide a foundation for URL synchronization and deep linking.

**Estimated effort:** 4 weeks for complete refactor following the phased migration strategy above.

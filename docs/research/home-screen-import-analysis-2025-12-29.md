# Home Screen Import Functionality Analysis

**Date**: 2025-12-29
**Objective**: Investigate home screen structure and identify where to add import functionality

## Key Findings

### 1. Main Home Screen File

**Primary File**: `/Users/masa/Projects/itinerator/viewer-svelte/src/routes/itineraries/+page.svelte`

**Important Note**: The root `/Users/masa/Projects/itinerator/viewer-svelte/src/routes/+page.svelte` is just a redirect that auto-navigates to `/itineraries` on mount. The actual home screen is the itineraries page.

### 2. Home Screen Architecture

The itineraries page uses a **tabbed left pane** with two tabs:
- **💬 Chat Tab**: Shows ChatPanel for AI interaction
- **📋 Itineraries Tab**: Shows list of itineraries with action buttons

**Current Action Buttons in Itineraries Tab** (lines 372-396):
```svelte
<div class="left-pane-header">
  <button
    class="minimal-button"
    class:ai-disabled={!aiAccessAvailable}
    onclick={handleImportClick}
    disabled={!aiAccessAvailable}
    title={!aiAccessAvailable ? 'API key required - visit Profile to add one' : 'Import PDF'}
    type="button"
  >
    Import PDF
  </button>
  <button
    class="minimal-button"
    class:ai-disabled={!aiAccessAvailable}
    onclick={handleTextImportClick}
    disabled={!aiAccessAvailable}
    title={!aiAccessAvailable ? 'API key required - visit Profile to add one' : 'Import Text'}
    type="button"
  >
    Import Text
  </button>
  <button class="minimal-button" onclick={handleBuildClick} type="button">
    Create New
  </button>
</div>
```

### 3. ImportDialog Component

**File**: `/Users/masa/Projects/itinerator/viewer-svelte/src/lib/components/ImportDialog.svelte`

**Current Usage**: ImportDialog is used in `ItineraryDetail.svelte` (line 673-677):
```svelte
{#if showImportDialog}
  <ImportDialog
    bind:open={showImportDialog}
    preselectedItineraryId={itinerary.id}
    onComplete={handleImportComplete}
  />
```

**Trigger**: Button in ItineraryDetail's action bar (line 264-269):
```svelte
<button
  class="minimal-button"
  onclick={() => showImportDialog = true}
  type="button"
>
  📥 Import
</button>
```

**Component Props**:
```typescript
{
  open: boolean;              // Bindable modal state
  preselectedItineraryId?: string;  // Optional - pre-select destination itinerary
  onComplete?: (itineraryId: string, itineraryName: string) => void;  // Success callback
}
```

### 4. Import Flow Steps

**Step 1: Upload** (`step = 'upload'`)
- Drag-and-drop zone OR file picker
- Accepts: `.pdf`, `.ics`, `.png`, `.jpg`, `.jpeg`
- Button: "Upload & Process"

**Step 2: Processing** (`step = 'processing'`)
- Spinner with "Extracting booking details..." message
- Calls `/api/v1/import/upload` endpoint

**Step 3: Matching** (`step = 'matching'`)
- Shows extracted segments preview
- Shows trip matches (if `autoMatch=true`)
- User selects destination trip OR creates new trip
- Button: "Import Segments"

**Step 4: Confirm** (`step = 'confirm'`)
- Success message with checkmark
- Auto-closes after 1.5s
- Calls `onComplete` callback

### 5. Existing Import Modals

**Import Handlers** (lines 171-179, 236-246):
```typescript
function handleImportClick() {
  if (!aiAccessAvailable) return;
  navigationStore.openImportModal();  // Opens ImportModal (PDF)
}

function handleTextImportClick() {
  if (!aiAccessAvailable) return;
  navigationStore.openTextImportModal();  // Opens TextImportModal
}

async function handleImport(file: File, model: string | undefined) {
  try {
    await importPDF(file, model);
    toast.success('Import successful!');
  } catch (error) {
    console.error('Import failed:', error);
    toast.error(error instanceof Error ? error.message : 'Import failed. Please try again.');
  }
}
```

**Modal Components** (lines 321-328):
```svelte
<!-- Import Modal (PDF) -->
<ImportModal bind:open={navigationStore.importModalOpen} onImport={handleImport} />

<!-- Text Import Modal -->
<TextImportModal bind:open={navigationStore.textImportModalOpen} onSuccess={handleTextImportSuccess} />

<!-- Edit Modal -->
<EditItineraryModal bind:open={navigationStore.editModalOpen} itinerary={navigationStore.editingItinerary} />
```

### 6. HomeView Component

**File**: `/Users/masa/Projects/itinerator/viewer-svelte/src/lib/components/HomeView.svelte`

**Purpose**: Welcome screen with quick prompts (shown when `navigationStore.mainView === 'home'`)

**Content**:
- Welcome message with user's name
- Itinerary count summary
- Quick prompt buttons (4 options):
  - 🏖️ Plan a weekend getaway
  - ✈️ Help me with my upcoming trip
  - 🎯 Find activities for my destination
  - 📅 Optimize my travel schedule
- Help section with link to documentation

**No import functionality currently present in HomeView.**

### 7. UI Patterns to Follow

**Button Style**: `.minimal-button` class (lines 759-779)
```css
.minimal-button {
  padding: 0.5rem 1rem;
  background-color: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #1f2937;
  cursor: pointer;
  transition: all 0.2s;
}
```

**AI Feature Gating** (lines 781-793):
```css
.minimal-button.ai-disabled {
  position: relative;
  opacity: 0.5;
  background-color: #f9fafb;
}

.minimal-button.ai-disabled::after {
  content: '🔒';
  position: absolute;
  top: -0.25rem;
  right: -0.25rem;
  font-size: 0.75rem;
}
```

## Recommendations

### Option 1: Add Import Button to HomeView (Recommended)

**Location**: Add to the "Get Started" section alongside quick prompts

**Rationale**:
- Consistent with user flow (users start on home view when no itineraries)
- Provides immediate access to import functionality
- Follows pattern of quick action buttons

**Implementation**:
```svelte
<!-- In HomeView.svelte, add after quick-prompts-grid -->
<div class="import-section">
  <div class="divider">
    <span class="divider-text">or</span>
  </div>

  <button
    class="import-button"
    class:disabled={!aiAccessAvailable}
    onclick={handleImportClick}
    disabled={!aiAccessAvailable}
    title={!aiAccessAvailable ? 'API key required - visit Profile to add one' : 'Import existing travel documents'}
    type="button"
  >
    <div class="import-icon">📥</div>
    <div class="import-content">
      <div class="import-text">Import Travel Documents</div>
      <div class="import-description">Upload confirmations, emails, or calendar files</div>
    </div>
  </button>
</div>
```

### Option 2: Keep Import in Left Pane Only

**Current State**: Import buttons already exist in the Itineraries tab's header

**No changes needed** - Users can switch to Itineraries tab to access import

### Option 3: Add Import to Both Locations

**Hybrid approach**:
- HomeView: "Import Travel Documents" as a prominent card/button
- Itineraries Tab: Keep existing "Import PDF" and "Import Text" buttons

**Benefit**: Maximum discoverability

## Import Dialog Integration Points

To use ImportDialog from HomeView:

1. **Add State** (in itineraries/+page.svelte):
```typescript
let showImportDialog = $state(false);
```

2. **Add Handler** (pass to HomeView as prop):
```typescript
function handleImportFromHome() {
  if (!aiAccessAvailable) return;
  showImportDialog = true;
}
```

3. **Add Dialog Component** (in template):
```svelte
<!-- Import Dialog (for home view) -->
{#if showImportDialog}
  <ImportDialog
    bind:open={showImportDialog}
    onComplete={handleTextImportSuccess}  // Reuse existing handler
  />
{/if}
```

4. **Update HomeView Props** (in HomeView.svelte):
```typescript
let {
  onQuickPromptClick,
  onImportClick  // NEW
}: {
  onQuickPromptClick: (prompt: string) => void;
  onImportClick: () => void;  // NEW
} = $props();
```

## Conclusion

**Main Home Screen**: `/Users/masa/Projects/itinerator/viewer-svelte/src/routes/itineraries/+page.svelte`

**ImportDialog Trigger**: Currently only in ItineraryDetail component (📥 Import button)

**Recommended Location**: Add import button to HomeView component in the "Get Started" section

**Existing Action Buttons**: Follow the `.minimal-button` class pattern with AI access gating

**Import Flow**: 4-step process (upload → processing → matching → confirm) with automatic trip matching

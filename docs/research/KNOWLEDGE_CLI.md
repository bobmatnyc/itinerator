# Knowledge Base CLI Commands

CLI commands for managing the Weaviate-based knowledge base in Itinerator.

## Prerequisites

Set up Weaviate credentials:

```bash
export WEAVIATE_URL="https://your-cluster.weaviate.network"
export WEAVIATE_API_KEY="your-api-key"
export OPENAI_API_KEY="your-openai-key"  # For embeddings
```

Or run `npx itinerator setup` to configure interactively.

## Commands

### 1. Ingest Itineraries

Bulk ingest itineraries into the knowledge base:

```bash
# Ingest all itineraries
npx itinerator knowledge ingest --all

# Ingest specific itinerary
npx itinerator knowledge ingest --id <itinerary-id>

# Preview without storing (dry-run)
npx itinerator knowledge ingest --all --dry-run

# Show detailed progress
npx itinerator knowledge ingest --all --verbose
```

**What gets extracted:**
- **Destinations**: Destination names and locations
- **Hotels**: Property names, locations, room types, notes
- **Activities**: Activity names, categories, descriptions, notes
- **Flight Tips**: Useful notes from flight segments
- **Meeting Venues**: Meeting locations and context

**Anonymization**: All personal information (names, emails, etc.) is automatically anonymized before storage.

**Auto-Detection**: The system automatically detects:
- Geographic regions and countries
- Luxury levels (from budget data)
- Travel seasons
- Trip types
- Traveler types

### 2. Search Knowledge Base

Search for relevant knowledge:

```bash
# Basic search
npx itinerator knowledge search "best restaurants in Tokyo"

# Search with filters
npx itinerator knowledge search "cherry blossoms" \
  --region Asia \
  --season spring

# Search for luxury travel tips
npx itinerator knowledge search "luxury hotels" \
  --luxury-level luxury \
  --trip-type leisure

# Family-friendly activities
npx itinerator knowledge search "family activities" \
  --traveler-type family \
  --category activity

# Limit results
npx itinerator knowledge search "budget travel" \
  --limit 5

# Output as JSON
npx itinerator knowledge search "travel tips" --json
```

**Available Filters:**
- `--region <region>` - Geographic region
- `--country <country>` - Specific country
- `--category <category>` - destination, activity, event, weather, tip, restriction
- `--season <season>` - spring, summer, fall, winter
- `--trip-type <type>` - leisure, business, adventure, cultural, relaxation
- `--luxury-level <level>` - budget, moderate, luxury, ultra-luxury
- `--traveler-type <type>` - family, couple, solo, friends, group
- `--limit <number>` - Maximum results (default: 10)

### 3. View Statistics

View knowledge base statistics:

```bash
# Basic stats
npx itinerator knowledge stats

# Detailed stats (includes source and temporal breakdowns)
npx itinerator knowledge stats --detailed

# JSON output
npx itinerator knowledge stats --json
```

**Stats Include:**
- Total knowledge items
- Total destinations
- Total itinerary references
- Breakdown by category
- Breakdown by source (detailed mode)
- Breakdown by temporal type (detailed mode)

## Aliases

The `knowledge` command can be abbreviated as `kb`:

```bash
npx itinerator kb ingest --all
npx itinerator kb search "Tokyo hotels"
npx itinerator kb stats
```

## Knowledge Extraction Process

For each itinerary ingested:

1. **Load Itinerary**: Fetch from storage (JSON or Blob)
2. **Extract Knowledge**:
   - Parse destinations
   - Extract segment details (hotels, activities, etc.)
   - Filter out inferred/auto-generated segments
3. **Anonymize**: Remove personal information
4. **Auto-Detect Categories**:
   - Luxury level from daily budget
   - Travel season from dates
   - Geographic region from country
   - Traveler type from traveler count
5. **Store in Weaviate**: Create vector embeddings for semantic search

## Examples

### Ingest all itineraries and view stats

```bash
# Dry-run first to see what will be ingested
npx itinerator kb ingest --all --dry-run

# Ingest everything
npx itinerator kb ingest --all --verbose

# Check stats
npx itinerator kb stats --detailed
```

### Find family-friendly spring activities in Japan

```bash
npx itinerator kb search "outdoor activities" \
  --country Japan \
  --season spring \
  --traveler-type family \
  --category activity \
  --limit 10
```

### Search for luxury hotel recommendations

```bash
npx itinerator kb search "boutique hotels" \
  --luxury-level luxury \
  --trip-type leisure
```

## Output Format

### Search Results (Text)

```
Search Results (5)

1. ACTIVITY (outdoor)
   Activity: Cherry blossom viewing at Shinjuku Gyoen | Tokyo, Japan | outdoor | Beautiful park...
   Destination: Tokyo | Country: Japan | Region: Asia | Source: bulk_import | Created: Mar 15, 2024 | Relevance: 92.5%

2. DESTINATION
   Travel destination: Kyoto, Japan
   Destination: Kyoto | Country: Japan | Region: Asia | Source: bulk_import | Created: Mar 10, 2024 | Relevance: 85.3%

...
```

### Stats Output (Text)

```
Knowledge Base Statistics

Overall:
  Total Knowledge Items: 127
  Total Destinations: 23
  Total Itineraries: 15

By Category:
  destination    : 23
  activity       : 45
  tip           : 52
  event         : 7

By Source:
  bulk_import   : 100
  trip_designer : 18
  web_search    : 9
```

## Implementation Details

**Files Created:**
- `src/cli/commands/knowledge.command.ts` - Main router
- `src/cli/commands/knowledge/ingest.ts` - Bulk ingestion
- `src/cli/commands/knowledge/search.ts` - Search command
- `src/cli/commands/knowledge/stats.ts` - Statistics
- `src/index.ts` - Updated to register command

**Services Used:**
- `WeaviateKnowledgeService` - Knowledge management
- `WeaviateStorage` - Vector database operations
- `AnonymizerService` - PII removal
- `ItineraryStorage` - Itinerary loading (JSON/Blob)

**LOC Delta:**
- Added: ~650 lines
- Removed: 0 lines
- Net Change: +650 lines

**Phase:** MVP (Core functionality for knowledge base management)

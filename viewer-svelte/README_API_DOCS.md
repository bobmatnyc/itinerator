# API Documentation

## Quick Access

### 🌐 Interactive Documentation (Swagger UI)

Start the development server and navigate to:

```
http://localhost:5176/api/docs
```

### 📄 OpenAPI Specification

Download or view the spec at:

```
http://localhost:5176/openapi.yaml
```

## Getting Started

### 1. Start Development Server

```bash
cd viewer-svelte
npm install
npm run dev
```

### 2. Open Swagger UI

Visit: `http://localhost:5176/api/docs`

### 3. Authenticate

1. Click the **"Authorize"** button (top right)
2. Enter your API key in the `X-API-Key` field
3. (Optional) Enter OpenRouter API key for AI features
4. Click **"Authorize"** then **"Close"**

### 4. Test Endpoints

1. Expand any endpoint (e.g., `POST /itineraries`)
2. Click **"Try it out"**
3. Fill in request parameters
4. Click **"Execute"**
5. View response below

## Documentation Files

| File | Description |
|------|-------------|
| [`/openapi.yaml`](static/openapi.yaml) | Complete OpenAPI 3.0 specification |
| [`/api/docs`](src/routes/api/docs/+page.svelte) | Swagger UI page |
| [`API_DOCUMENTATION.md`](API_DOCUMENTATION.md) | Comprehensive API guide |
| [`API_TESTING_GUIDE.md`](API_TESTING_GUIDE.md) | Testing scenarios and examples |

## Common Tasks

### Import into Postman

1. Open Postman
2. Click **Import**
3. Select `viewer-svelte/static/openapi.yaml`
4. Collection is created with all endpoints

### Import into Insomnia

1. Open Insomnia
2. Click **Import/Export → Import Data**
3. Select `viewer-svelte/static/openapi.yaml`
4. Choose **OpenAPI 3.0**

### Generate TypeScript Client

```bash
npx @openapitools/openapi-generator-cli generate \
  -i viewer-svelte/static/openapi.yaml \
  -g typescript-fetch \
  -o src/generated/api-client
```

### Test with cURL

```bash
# List itineraries
curl -H "X-API-Key: your-key" \
  http://localhost:5176/api/v1/itineraries

# Create itinerary
curl -X POST \
  -H "X-API-Key: your-key" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Trip"}' \
  http://localhost:5176/api/v1/itineraries
```

## API Overview

### Endpoints

- **Itineraries** (5 endpoints) - Manage travel itineraries
- **Segments** (6 endpoints) - Manage trip segments (flights, hotels, etc.)
- **Trip Designer** (5 endpoints) - AI-powered trip planning chat
- **Import** (1 endpoint) - Import from text/email

**Total:** 17 unique endpoints (24 including all HTTP methods)

### Authentication

All endpoints require:

```http
X-API-Key: your-api-key-here
```

AI features also need:

```http
X-OpenRouter-API-Key: your-openrouter-key
```

### Streaming Endpoints

The Trip Designer streaming endpoint uses Server-Sent Events:

```
POST /api/v1/designer/sessions/{sessionId}/messages/stream
```

Event types: `connected`, `text`, `tool_call`, `tool_result`, `structured_questions`, `done`, `error`

## Resources

- 📖 [API Documentation](API_DOCUMENTATION.md) - Complete API guide
- 🧪 [Testing Guide](API_TESTING_GUIDE.md) - Test scenarios and examples
- 📊 [OpenAPI Spec](static/openapi.yaml) - Machine-readable specification
- 🌐 [Swagger UI](http://localhost:5176/api/docs) - Interactive testing

## Support

For issues or questions:
- GitHub Issues: https://github.com/yourusername/itinerizer-ts/issues
- OpenAPI Spec: https://spec.openapis.org/oas/v3.0.3

---

**Happy Testing! 🚀**

# Web Search + Reranker Subsystem

A modular TypeScript/Node.js library for web search with optional reranking capabilities. This system provides a flexible pipeline for searching the web, scraping content, and reranking results using various AI models.

## Features

- **Pluggable Search Providers**: Support for SearXNG and Serper
- **Multiple Rerankers**: Qwen, Jina, Cohere, BGE, FlashRank, Two-stage reranking
- **Content Scraping**: Integration with Crawl4AI and Firecrawl
- **Performance Logging**: Comprehensive logging to JSONL and CSV formats
- **Chunking Support**: Text splitting and chunking for large documents
- **Configuration via Environment Variables**: Easy setup and deployment

## Architecture

The system consists of several key components:

- **Search Providers** (`searchProviders.ts`): Handle web search queries
- **Rerankers** (`rerankers.ts`): Reorder search results based on relevance
- **Scrapers** (`scraper.ts`): Extract content from web pages
- **Pipeline** (`webSearchPipeline.ts`): Orchestrates the entire search and reranking process
- **Factories** (`factories.ts`): Create instances of providers and rerankers
- **Performance Logger** (`performanceLogger.ts`): Track and log performance metrics

## Installation

```bash
npm install
```

## Setup

1. Copy the environment example file and configure your API keys:
```bash
cp .env.example .env
# Edit .env with your actual API keys
```

2. Build the project:
```bash
npm run build
```

3. (Optional) Start supporting services:
```bash
# For SearXNG
docker run -d -p 8080:8080 searxng/searxng

# For local rerankers (see services/ directory)
python services/bge_reranker.py
python services/qwen_reranker.py
# etc.
```

## Configuration

Environment variables are loaded from `.env` file. Copy `.env.example` and fill in your API keys.

### Key Configuration Options

- **Search Provider**: `SEARCH_PROVIDER` (searxng, serper)
- **Reranker Type**: `RERANKER_TYPE` (qwen, jina, cohere, bge, flashrank, two-stage, noop)
- **Scraper Type**: `SCRAPER_TYPE` (crawl4ai, firecrawl)
- **Max Results**: `MAX_SEARCH_RESULTS`

### API Keys Required

- `SERPER_API_KEY` (for Serper search)
- `QWEN_RERANKER_API_KEY` (for Qwen reranking)
- `JINA_API_KEY` (for Jina reranking)
- `COHERE_API_KEY` (for Cohere reranking)
- `FIRECRAWL_API_KEY` (for Firecrawl scraping)
- `LITELLM_API_KEY` (for evaluation)

## Usage

### Basic Example

```typescript
import { createWebSearchPipeline } from './webSearchPipeline';

const pipeline = createWebSearchPipeline();
const results = await pipeline.searchAndRerank('your search query');
console.log(results);
```

See `example.ts` for a complete demo.

### Testing

```bash
# Run all tests
npm test

# Test the full pipeline
npm run test:pipeline

# Individual test files
node dist/test_full_pipeline.js
node dist/test_reranker_only.js
# etc.
```

## Log Format

### JSONL Format
```json
{
  "timestamp": "2023-01-01T00:00:00.000Z",
  "requestId": "uuid",
  "providerKind": "search",
  "providerName": "serper",
  "operation": "search",
  "query": "test",
  "durationMs": 150,
  "success": true,
  "numDocumentsOut": 10
}
```

### CSV Headers
timestamp,requestId,providerKind,providerName,operation,query,durationMs,success,errorMessage,httpStatus,numDocumentsIn,numDocumentsOut,topKRequested,timeoutMs,extra

## Services

The `services/` directory contains Python services for local rerankers:

- `bge_reranker.py`: BGE reranker service
- `qwen_reranker.py`: Qwen reranker service
- `flashrank_reranker.py`: FlashRank reranker service
- `crawl4ai_service.py`: Crawl4AI scraping service

## Development

### Project Structure

- `src/`: Source TypeScript files
- `dist/`: Compiled JavaScript output
- `services/`: Python microservices
- `logs/`: Performance logs and test outputs
- `runs/`: Test run results and comparisons
- `searxng-config/`: SearXNG configuration

### Adding New Providers

1. Implement the provider interface in `searchTypes.ts`
2. Add factory method in `factories.ts`
3. Update environment configuration

### Performance Analysis

Use the Jupyter notebooks for analysis:
- `analysis.ipynb`: General performance analysis
- `full_pipeline_analysis.ipynb`: Pipeline-specific analysis

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

[Add your license here]
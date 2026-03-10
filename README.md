# Web Search + Reranker Subsystem

A modular TypeScript/Node.js library for web search with optional reranking.

## Features

- Pluggable search providers (SearXNG, Serper)
- Multiple rerankers (Qwen, Jina, Cohere, Noop, Two-stage)
- Performance logging to JSONL and CSV
- Configuration via environment variables

## Installation

```bash
npm install
```

## Setup

1. Copy `.env` and fill in your API keys:
```bash
cp .env .env.local  # or edit .env directly
```

2. Build the project:
```bash
npm run build
```

## Configuration

Environment variables are loaded from `.env` file. See `.env` for all available options.

See `example.ts` for a demo.

Set environment variables:

- `SERPER_API_KEY`
- `QWEN_RERANKER_API_KEY`, etc.

## Log Format

JSONL example:
```json
{"timestamp":"2023-01-01T00:00:00.000Z","requestId":"uuid","providerKind":"search","providerName":"serper","operation":"search","query":"test","durationMs":150,"success":true,"numDocumentsOut":10}
```

CSV headers: timestamp,requestId,providerKind,providerName,operation,query,durationMs,success,errorMessage,httpStatus,numDocumentsIn,numDocumentsOut,topKRequested,timeoutMs,extra
// example.ts
import { config as dotenvConfig } from 'dotenv';
dotenvConfig(); // Load environment variables from .env

import { WebSearchConfig } from './searchTypes';
import { createSearchProvider, createReranker } from './factories';
import { runWebSearchWithReranker } from './webSearchPipeline';

const config: WebSearchConfig & {
  scraperProvider: 'firecrawl';
  firecrawlApiKey: string;
} = {
  searchProvider: 'searxng',
  searxngInstanceUrl: process.env.SEARXNG_INSTANCE_URL!,
  searxngApiKey: process.env.SEARXNG_API_KEY,
  maxSearchResults: parseInt(process.env.MAX_SEARCH_RESULTS || '12'),
  rerankerType: 'qwen',
  qwenRerankerApiKey: process.env.QWEN_RERANKER_API_KEY!,
  qwenRerankerApiUrl: process.env.QWEN_RERANKER_API_URL!,
  qwenRerankerModel: process.env.QWEN_RERANKER_MODEL!,
  scraperProvider: 'firecrawl',
  firecrawlApiKey: process.env.FIRECRAWL_API_KEY!,
  firecrawlBaseUrl: process.env.FIRECRAWL_ENDPOINT,
  firecrawlFormats: ['markdown', 'rawHtml'],
  firecrawlMaxPages: 5,
  scraperTimeout: 30000,
};

// Map to old config format
const searchConfig = {
  provider: config.searchProvider as 'searxng' | 'serper',
  searxng: config.searchProvider === 'searxng' ? { baseUrl: config.searxngInstanceUrl!, apiKey: config.searxngApiKey } : undefined,
  serper: config.searchProvider === 'serper' ? { apiKey: config.serperApiKey! } : undefined,
};

const rerankerConfig = {
  type: config.rerankerType as 'qwen' | 'jina' | 'cohere' | 'none',
  qwen: config.rerankerType === 'qwen' ? { apiKey: config.qwenRerankerApiKey!, apiUrl: config.qwenRerankerApiUrl!, model: config.qwenRerankerModel! } : undefined,
  // Add others if needed
};

async function main() {
  const searchProvider = createSearchProvider(searchConfig);
  const reranker = createReranker(rerankerConfig);

  const { results, rawSearch } = await runWebSearchWithReranker(
    'latest research on graph transformers',
    { searchProvider, reranker, config },
    10, // topResults
  );

  console.log('Top reranked results:', results.slice(0, 3).map(r => ({ score: r.score, content: r.content.substring(0, 100) + '...' })));
}

main().catch(console.error);
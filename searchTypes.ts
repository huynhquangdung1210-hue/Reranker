// searchTypes.ts
export interface SearchOptions {
  topK?: number;        // max results to return
  safeSearch?: 'off' | 'moderate' | 'strict';
  language?: string;    // e.g. 'en'
  region?: string;      // e.g. 'us'
  timeoutMs?: number;   // max time allowed for search call
}

export interface SearchResultItem {
  title: string;
  url: string;
  content: string;      // snippet / summary / body text
  publishedDate?: string; // ISO string if available
  source?: string;        // e.g. 'google', 'searxng'
  rank?: number;          // original rank from search provider
}

export interface AnswerBox {
  title?: string;
  snippet?: string;
  url?: string;
  type?: string; // e.g., 'featured_snippet', 'knowledge_panel'
}

export interface SearchResponse {
  organic: SearchResultItem[];
  topStories?: SearchResultItem[];
  answerBox?: AnswerBox;
  success: boolean;
  error?: string;
}

export interface BaseSearchProvider {
  name: string;
  search(query: string, options?: SearchOptions): Promise<SearchResponse>;
}

export interface Reference {
  title: string;
  url: string;
  publishedDate?: string;
  provider?: string; // 'serper', 'searxng', etc.
  rank?: number;     // final reranked position
  score?: number;    // reranker score
}

export interface Highlight {
  score: number;
  text: string;          // combined snippet / short summary
  references?: Reference[];
}

export interface RerankerOptions {
  topK?: number;        // how many results to return
  timeoutMs?: number;   // max time allowed for reranker call
}

export interface RerankerResult {
  content: string;
  score: number;
  index?: number;       // original index in input documents array
}

export interface BaseReranker {
  name: string;
  rerank(
    query: string,
    documents: string[],
    topResults: number
  ): Promise<RerankerResult[]>;
}

export type ScraperProvider = 'serper' | 'firecrawl';

export interface ScraperOptions {
  timeoutMs?: number;
  maxPages?: number;      // how many URLs to scrape per query (e.g. top N search results)
}

export interface ScrapedPage {
  url: string;
  title?: string;
  content: string;        // full, cleaned text/markdown for that URL
  publishedDate?: string;
  metadata?: Record<string, any>;
}

export interface BaseScraper {
  name: string;
  scrape(urls: string[], options?: ScraperOptions): Promise<ScrapedPage[]>;
}

export interface WebSearchConfig {
  // Search
  searchProvider: 'searxng' | 'serper';
  searxngInstanceUrl?: string;
  searxngApiKey?: string;
  serperApiKey?: string;
  maxSearchResults?: number;          // max results from search provider (default 10)
  
  // Reranker
  rerankerType: 'qwen' | 'bge' | 'jina' | 'cohere' | 'none';
  qwenRerankerApiKey?: string;
  qwenRerankerApiUrl?: string;
  qwenRerankerModel?: string;
  bgeRerankerApiKey?: string;
  bgeRerankerApiUrl?: string;
  bgeRerankerModel?: string;
  
  // Options
  safeSearch?: 0 | 1 | 2;
  scraperTimeout?: number;

  // Scraper selection
  scraperProvider?: ScraperProvider;    // default 'serper' if not set

  // Firecrawl-specific
  firecrawlApiKey?: string;
  firecrawlBaseUrl?: string;          // e.g. 'https://api.firecrawl.dev/v2/scrape'
  firecrawlFormats?: string[];         // e.g. ['markdown', 'rawHtml']
  firecrawlMaxPages?: number;          // how many URLs to scrape per query (top N)

  // URL Processing Configuration
  maxSearchResultsLimit?: number;      // default 20
  urlScrapeTimeout?: number;           // default 7500ms
  maxConcurrentScrapes?: number;       // default 5
}
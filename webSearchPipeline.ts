// webSearchPipeline.ts
import { BaseSearchProvider, SearchResponse, WebSearchConfig, ScrapedPage, RerankerResult } from './searchTypes';
import { BaseReranker } from './searchTypes';
import { createScraper } from './scraper';
import { chunkScrapedPages } from './chunking';

interface WebSearchPipelineDeps {
  searchProvider: BaseSearchProvider;
  reranker: BaseReranker;
  config: WebSearchConfig;
}

interface WebSearchPipelineResult {
  results: RerankerResult[];  // top reranked results with scores
  rawSearch: SearchResponse;  // original search data
}

export async function runWebSearchWithReranker(
  query: string,
  deps: WebSearchPipelineDeps,
  topResults: number,
): Promise<WebSearchPipelineResult> {
  const { searchProvider, reranker, config } = deps;

  // 1) Search
  const searchResponse = await searchProvider.search(query, {
    topK: config.maxSearchResults || 10,
    // map safeSearch, etc. from config
  });

  if (!searchResponse.success || searchResponse.organic.length === 0) {
    return { results: [], rawSearch: searchResponse };
  }

  // 2) Scrape (Firecrawl or Serper) to enrich content
  const scraper = createScraper(config);
  let scrapedPages: ScrapedPage[] = [];

  if (scraper) {
    const allUrls = searchResponse.organic.map((item) => item.url).filter(Boolean);
    console.log(`🔍 Found ${searchResponse.organic.length} search results, attempting to scrape ${allUrls.length} URLs`);
    
    // URLs are now validated inside the scraper
    scrapedPages = await scraper.scrape(allUrls, {
      timeoutMs: config.scraperTimeout,
      maxPages: config.firecrawlMaxPages,
    });
    console.log(`📄 Scraping complete: ${scrapedPages.length} pages scraped`);
  } else {
    // Fallback: use existing snippets as content
    scrapedPages = searchResponse.organic.map((item) => ({
      url: item.url,
      title: item.title,
      content: item.content,
      publishedDate: item.publishedDate,
    }));
    console.log(`📄 Using fallback: ${scrapedPages.length} pages from search snippets`);
  }

  if (scrapedPages.length === 0) {
    console.log(`❌ No pages to process, exiting early`);
    return { results: [], rawSearch: searchResponse };
  }

  // 3) Chunk: each scraped content string → multiple chunks
  const documents: string[] = await chunkScrapedPages(scrapedPages);

  console.log(`📄 Scraped ${scrapedPages.length} pages, created ${documents.length} chunks`);

  if (documents.length === 0) {
    console.log(`❌ No document chunks generated`);
    return { results: [], rawSearch: searchResponse };
  }

  // 4) Rerank: reranker.rerank(query, documents, topResults)
  console.log(`🎯 Reranking ${documents.length} documents...`);
  const results = await reranker.rerank(query, documents, topResults);
  console.log(`✅ Reranking complete: ${results.length} results`);

  return {
    results,
    rawSearch: searchResponse,
  };
}
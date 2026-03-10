// test_full_pipeline.ts - Full pipeline test from web search to reranker
import * as path from 'path';
import { config } from 'dotenv';
config({ path: path.resolve(__dirname, '.env') });

import * as fs from 'fs';
import { runWebSearchWithReranker } from './webSearchPipeline';
import { PerformanceLogger } from './performanceLogger';
import { createSearchProvider, createReranker } from './factories';

// ===== HYPERPARAMETERS =====
const QUERY = 'latest research on LLM routers landscape';
const MAX_SEARCH_RESULTS = 20; // Back to normal
const RERANKER_TYPE: string = 'bge'; // 'none' | 'qwen' | 'bge' | 'jina' | 'cohere' | 'two-stage' | 'embedding' | 'heuristic'
const TOP_RESULTS = 10;
const LOG_TO_FILE = true;

// Create run-specific directory
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const runDir = path.join(__dirname, 'runs', `full_pipeline_${timestamp}`);
fs.mkdirSync(runDir, { recursive: true });

async function runFullPipelineTest() {
  console.log('🚀 Starting Full Pipeline Test');
  console.log(`📁 Results will be saved to: ${runDir}`);
  console.log(`🔍 Query: "${QUERY}"`);
  console.log(`📊 Max Search Results: ${MAX_SEARCH_RESULTS}`);
  console.log(`🤖 Reranker: ${RERANKER_TYPE}`);
  console.log(`🎯 Top Results: ${TOP_RESULTS}`);

  const startTime = Date.now();

  // Setup logger
  const logger = LOG_TO_FILE
    ? new PerformanceLogger({
        jsonlPath: path.join(runDir, 'performance.jsonl'),
        csvPath: path.join(runDir, 'performance.csv'),
      })
    : new PerformanceLogger({});

  try {
    // Create search provider
    const searchConfig = {
      provider: 'searxng' as const,
      searxng: {
        baseUrl: process.env.SEARXNG_INSTANCE_URL!,
        apiKey: process.env.SEARXNG_API_KEY
      },
    };
    const searchProvider = createSearchProvider(searchConfig, logger);

    // Create reranker
    const rerankerConfig: any = {
      type: RERANKER_TYPE,
    };

    if (RERANKER_TYPE === 'qwen') {
      rerankerConfig.qwen = {
        apiKey: process.env.QWEN_RERANKER_API_KEY!,
        apiUrl: process.env.QWEN_RERANKER_API_URL!,
        model: process.env.QWEN_RERANKER_MODEL!,
      };
    } else if (RERANKER_TYPE === 'bge') {
      rerankerConfig.bge = {
        apiKey: process.env.BGE_RERANKER_API_KEY!,
        apiUrl: process.env.BGE_RERANKER_API_URL!,
        model: process.env.BGE_RERANKER_MODEL!,
      };
    }

    if (RERANKER_TYPE === 'two-stage') {
      rerankerConfig.twoStage = {
        firstStage: 'embedding',
        secondStage: 'qwen',
        embeddingTopK: 40
      };
    }
    const reranker = createReranker(rerankerConfig, logger);

    // Create web search config
    const webConfig: any = {
      searchProvider: 'searxng' as const,
      searxngInstanceUrl: process.env.SEARXNG_INSTANCE_URL!,
      searxngApiKey: process.env.SEARXNG_API_KEY,
      maxSearchResults: MAX_SEARCH_RESULTS,
      rerankerType: RERANKER_TYPE as any,
      scraperProvider: 'firecrawl' as const,
      firecrawlApiKey: process.env.FIRECRAWL_API_KEY!,
      firecrawlBaseUrl: process.env.FIRECRAWL_ENDPOINT,
      firecrawlFormats: ['markdown', 'rawHtml'],
      firecrawlMaxPages: MAX_SEARCH_RESULTS,
      scraperTimeout: 30000,
    };

    // Add reranker-specific config
    if (RERANKER_TYPE === 'qwen') {
      webConfig.qwenRerankerApiKey = process.env.QWEN_RERANKER_API_KEY!;
      webConfig.qwenRerankerApiUrl = process.env.QWEN_RERANKER_API_URL!;
      webConfig.qwenRerankerModel = process.env.QWEN_RERANKER_MODEL!;
    } else if (RERANKER_TYPE === 'bge') {
      webConfig.bgeRerankerApiKey = process.env.BGE_RERANKER_API_KEY!;
      webConfig.bgeRerankerApiUrl = process.env.BGE_RERANKER_API_URL!;
      webConfig.bgeRerankerModel = process.env.BGE_RERANKER_MODEL!;
    }

    // Run the full pipeline
    const pipelineStart = Date.now();
    const { results, rawSearch } = await runWebSearchWithReranker(
      QUERY,
      { searchProvider, reranker, config: webConfig },
      TOP_RESULTS
    );
    const pipelineDuration = Date.now() - pipelineStart;

    // Prepare results
    const testResults = {
      metadata: {
        testType: 'full_pipeline',
        timestamp: new Date().toISOString(),
        query: QUERY,
        hyperparameters: {
          maxSearchResults: MAX_SEARCH_RESULTS,
          rerankerType: RERANKER_TYPE,
          topResults: TOP_RESULTS,
        },
        totalDuration: Date.now() - startTime,
        pipelineDuration,
      },
      searchResults: {
        success: rawSearch.success,
        totalFound: rawSearch.organic.length,
        error: rawSearch.error,
      },
      rerankedResults: results.map((r, i) => ({
        rank: i + 1,
        score: r.score,
        content: r.content.substring(0, 500) + (r.content.length > 500 ? '...' : ''),
      })),
    };

    // Save results
    const resultsPath = path.join(runDir, 'results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(testResults, null, 2));

    // Save raw search data
    const rawSearchPath = path.join(runDir, 'raw_search.json');
    fs.writeFileSync(rawSearchPath, JSON.stringify(rawSearch, null, 2));

    // Save reranked results in readable format
    const readableResults = results.map((r, i) => ({
      rank: i + 1,
      score: r.score.toFixed(4),
      content: r.content.substring(0, 200) + (r.content.length > 200 ? '...' : ''),
    }));
    const readablePath = path.join(runDir, 'reranked_results.txt');
    const readableContent = `Full Pipeline Test Results\n${'='.repeat(50)}\n\nQuery: ${QUERY}\nTimestamp: ${new Date().toISOString()}\n\nTop ${TOP_RESULTS} Reranked Results:\n\n` +
      readableResults.map(r => `${r.rank}. [${r.score}] ${r.content}`).join('\n\n');
    fs.writeFileSync(readablePath, readableContent);

    console.log('✅ Test completed successfully!');
    console.log(`📊 Found ${rawSearch.organic.length} search results`);
    console.log(`🎯 Got ${results.length} reranked results`);
    console.log(`⏱️  Total duration: ${(Date.now() - startTime)}ms`);
    console.log(`📁 Results saved to: ${runDir}`);

  } catch (error) {
    console.error('❌ Test failed:', error);
    const errorPath = path.join(runDir, 'error.log');
    fs.writeFileSync(errorPath, `Error: ${error}\nTimestamp: ${new Date().toISOString()}`);
  }
}

runFullPipelineTest().catch(console.error);
// test_reranker_only.ts - Reranker-only test using sample documents
import * as path from 'path';
import { config } from 'dotenv';
config({ path: path.resolve(__dirname, '.env') });

import * as fs from 'fs';
import { PerformanceLogger } from './performanceLogger';
import { createReranker } from './factories';
import { chunkScrapedPages } from './chunking';
import { ScrapedPage } from './searchTypes';

// ===== HYPERPARAMETERS =====
const DOCUMENTS_FILE = 'sample_clean.json'; // File containing documents to rerank
const QUERY = 'latest research on LLM routers landscape';
let RERANKER_TYPE: string = 'bge'; // 'none' | 'qwen' | 'bge' | 'jina' | 'cohere' | 'two-stage' | 'embedding' | 'heuristic'
const TOP_RESULTS = 10;
const LOG_TO_FILE = true;

// Create run-specific directory
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const runDir = path.join(__dirname, 'runs', `reranker_only_${RERANKER_TYPE}_${timestamp}`);
fs.mkdirSync(runDir, { recursive: true });

async function runRerankerOnlyTest() {
  console.log('Starting Reranker-Only Test');
  console.log(`Results will be saved to: ${runDir}`);
  console.log(`Documents file: ${DOCUMENTS_FILE}`);
  console.log(`Query: "${QUERY}"`);
  console.log(`Reranker: ${RERANKER_TYPE}`);
  console.log(`Top Results: ${TOP_RESULTS}`);

  const startTime = Date.now();

  // Setup logger
  const logger = LOG_TO_FILE
    ? new PerformanceLogger({
        jsonlPath: path.join(runDir, 'performance.jsonl'),
        csvPath: path.join(runDir, 'performance.csv'),
      })
    : new PerformanceLogger({});

  try {
    // Load sample documents
    const samplePath = path.resolve(__dirname, DOCUMENTS_FILE);
    console.log(`Loading documents from: ${samplePath}`);

    if (!fs.existsSync(samplePath)) {
      throw new Error(`Documents file not found: ${samplePath}`);
    }

    const sampleData = JSON.parse(fs.readFileSync(samplePath, 'utf8'));
    const rawDocuments = sampleData.organic || [];

    if (rawDocuments.length === 0) {
      throw new Error('No documents found in the sample file');
    }

    console.log(`Loaded ${rawDocuments.length} raw documents`);

    // Convert to ScrapedPage format and chunk
    const scrapedPages: ScrapedPage[] = rawDocuments.map((doc: any) => ({
      url: doc.url,
      title: doc.title,
      content: doc.content,
      publishedDate: doc.publishedDate,
      metadata: doc.metadata,
    }));

    const chunkingStart = Date.now();
    const allDocuments: string[] = await chunkScrapedPages(scrapedPages);
    // Limit to first 20 chunks for testing (API may have limits)
    const documents: string[] = allDocuments.slice(0, 20);
    const chunkingDuration = Date.now() - chunkingStart;

    console.log(`Created ${allDocuments.length} chunks from ${scrapedPages.length} documents, using first ${documents.length} for testing`);

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
        firstStage: 'embedding' as any,
        secondStage: 'qwen' as any,
        embeddingTopK: 40
      };
    }
    const reranker = createReranker(rerankerConfig, logger);

    // Run reranking
    const rerankingStart = Date.now();
    console.log(`🎯 Starting reranking with ${RERANKER_TYPE}...`);
    const results = await reranker.rerank(QUERY, documents, TOP_RESULTS);
    const rerankingDuration = Date.now() - rerankingStart;

    // Check for API errors in results (dummy scores indicate fallback)
    const hasApiErrors = RERANKER_TYPE !== 'none' && RERANKER_TYPE !== 'embedding' &&
      results.length > 0 && results.every((r, i) => Math.abs(r.score - (1.0 - i * 0.1)) < 0.001);

    if (hasApiErrors) {
      console.log(`⚠️  API Error Detected: ${RERANKER_TYPE} reranker fell back to dummy scores`);
      console.log(`   This usually means the API endpoint is unreachable or authentication failed`);
    }

    // Prepare results
    const testResults = {
      metadata: {
        testType: 'reranker_only',
        timestamp: new Date().toISOString(),
        query: QUERY,
        documentsFile: DOCUMENTS_FILE,
        hyperparameters: {
          rerankerType: RERANKER_TYPE,
          topResults: TOP_RESULTS,
        },
        durations: {
          total: Date.now() - startTime,
          chunking: chunkingDuration,
          reranking: rerankingDuration,
        },
        apiStatus: {
          rerankerType: RERANKER_TYPE,
          hasApiErrors,
          apiEndpoint: RERANKER_TYPE === 'qwen' ? process.env.QWEN_RERANKER_API_URL :
                      RERANKER_TYPE === 'jina' ? process.env.JINA_API_URL :
                      RERANKER_TYPE === 'cohere' ? 'cohere-api' : 'local/no-api',
        },
      },
      inputStats: {
        rawDocuments: rawDocuments.length,
        chunksCreated: documents.length,
      },
      rerankedResults: results.map((r, i) => ({
        rank: i + 1,
        score: r.score,
        content: r.content, // Full content without truncation
      })),
    };

    // Save results
    const resultsPath = path.join(runDir, 'results.json');
    fs.writeFileSync(resultsPath, JSON.stringify(testResults, null, 2));

    // Save reranked results in readable format
    const readableResults = results.map((r, i) => ({
      rank: i + 1,
      score: r.score.toFixed(4),
      content: r.content, // Full content without truncation
    }));
    const readablePath = path.join(runDir, 'reranked_results.txt');
    const apiStatusText = hasApiErrors ?
      `⚠️  API ERROR: ${RERANKER_TYPE.toUpperCase()} API failed - using fallback scores` :
      (RERANKER_TYPE === 'qwen' || RERANKER_TYPE === 'jina' || RERANKER_TYPE === 'cohere') ?
      `✅ API OK: ${RERANKER_TYPE.toUpperCase()} API working` :
      `✅ Local: ${RERANKER_TYPE.toUpperCase()} (no API required)`;

    const readableContent = `Reranker-Only Test Results\n${'='.repeat(50)}\n\nQuery: ${QUERY}\nDocuments: ${DOCUMENTS_FILE}\nReranker: ${RERANKER_TYPE}\nTimestamp: ${new Date().toISOString()}\nAPI Status: ${apiStatusText}\n\nTop ${TOP_RESULTS} Reranked Results:\n\n` +
      readableResults.map(r => `${r.rank}. [${r.score}] ${r.content}`).join('\n\n');
    fs.writeFileSync(readablePath, readableContent);

    // Save input documents summary
    const inputSummary = rawDocuments.map((doc: any, i: number) => ({
      index: i + 1,
      title: doc.title,
      url: doc.url,
      contentLength: doc.content?.length || 0,
    }));
    const inputPath = path.join(runDir, 'input_documents.json');
    fs.writeFileSync(inputPath, JSON.stringify(inputSummary, null, 2));

    console.log('✅ Test completed successfully!');
    console.log(`📄 Processed ${rawDocuments.length} documents → ${documents.length} chunks`);
    console.log(`🎯 Got ${results.length} reranked results`);
    console.log(`⏱️  Performance: Chunking ${chunkingDuration}ms, Reranking ${rerankingDuration}ms`);

    if (hasApiErrors) {
      console.log(`⚠️  API Status: ${RERANKER_TYPE.toUpperCase()} API ERROR - Using fallback scores`);
      console.log(`   Check console output above for detailed error information`);
    } else if (RERANKER_TYPE === 'qwen' || RERANKER_TYPE === 'jina' || RERANKER_TYPE === 'cohere') {
      console.log(`✅ API Status: ${RERANKER_TYPE.toUpperCase()} API working correctly`);
    } else {
      console.log(`✅ API Status: ${RERANKER_TYPE.toUpperCase()} (local/no API required)`);
    }

    console.log(`📁 Results saved to: ${runDir}`);

  } catch (error) {
    console.error('Test failed:', error);
    const errorPath = path.join(runDir, 'error.log');
    fs.writeFileSync(errorPath, `Error: ${error}\nTimestamp: ${new Date().toISOString()}`);
  }
}

runRerankerOnlyTest().catch(console.error);
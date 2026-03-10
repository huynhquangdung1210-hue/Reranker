// rerankers.ts
import { BaseReranker, RerankerOptions, RerankerResult, Highlight, SearchResultItem, Reference } from './searchTypes';
import { PerformanceLogger, PerformanceLogRecord } from './performanceLogger';

export class QwenReranker implements BaseReranker {
  name = 'qwen';

  constructor(
    private apiKey: string,
    private apiUrl: string,
    private model: string,
    private logger?: PerformanceLogger
  ) {}

  async rerank(query: string, documents: string[], topResults: number): Promise<RerankerResult[]> {
    const startTime = Date.now();
    let success = false;
    let error: string | undefined;
    let topChunks: RerankerResult[] = [];

    try {
      // Truncate each document to avoid exceeding API input limits
      const MAX_DOC_CHARS = 2000;
      const payload = {
        model: this.model,
        query,
        documents: documents.map(doc => doc.length > MAX_DOC_CHARS ? doc.substring(0, MAX_DOC_CHARS) : doc),
        top_n: topResults,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // Increased timeout to 300 seconds (5 minutes) for very slow model loading

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const results = data.results || [];

      topChunks = results.slice(0, topResults).map((res: any) => ({
        content: documents[res.index],
        score: res.score || res.relevance_score || 0,
        index: res.index
      }));

      success = true;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
      console.error(`QWen API Error: ${error}`);
      console.error(`Endpoint: ${this.apiUrl}`);
      console.error(`API Key: ${this.apiKey ? 'Present' : 'Missing'}`);
      // Fallback to first topResults with dummy scores
      topChunks = documents.slice(0, topResults).map((doc, i) => ({
        content: doc,
        score: 1.0 - (i * 0.1), // decreasing dummy scores
        index: i
      }));
    }

    if (this.logger) {
      this.logger.log({
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        providerKind: 'reranker',
        operation: 'rerank',
        providerName: this.name,
        query,
        numDocumentsIn: documents.length,
        numDocumentsOut: topChunks.length,
        durationMs: Date.now() - startTime,
        success,
        errorMessage: error,
      });
    }

    return topChunks;
  }
}

export class JinaReranker implements BaseReranker {
  name = 'jina';

  constructor(
    private apiKey: string,
    private apiUrl: string,
    private logger?: PerformanceLogger
  ) {}

  async rerank(query: string, documents: string[], topResults: number): Promise<RerankerResult[]> {
    const startTime = Date.now();
    let success = false;
    let error: string | undefined;
    let topChunks: RerankerResult[] = [];

    try {
      const payload = {
        input_type: 'document',
        query,
        documents: documents,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const results = data.results || [];

      topChunks = results.slice(0, topResults).map((res: any) => ({
        content: documents[res.index],
        score: res.score || res.relevance_score || 0,
        index: res.index
      }));

      success = true;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
      console.error(`❌ Jina API Error: ${error}`);
      console.error(`📍 Endpoint: ${this.apiUrl}`);
      console.error(`🔑 API Key: ${this.apiKey ? 'Present' : 'Missing'}`);
      topChunks = documents.slice(0, topResults).map((doc, i) => ({
        content: doc,
        score: 1.0 - (i * 0.1),
        index: i
      }));
    }

    if (this.logger) {
      this.logger.log({
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        providerKind: 'reranker',
        operation: 'rerank',
        providerName: this.name,
        query,
        numDocumentsIn: documents.length,
        numDocumentsOut: topChunks.length,
        durationMs: Date.now() - startTime,
        success,
        errorMessage: error,
      });
    }

    return topChunks;
  }
}

export class CohereReranker implements BaseReranker {
  name = 'cohere';

  constructor(
    private apiKey: string,
    private logger?: PerformanceLogger
  ) {}

  async rerank(query: string, documents: string[], topResults: number): Promise<RerankerResult[]> {
    const startTime = Date.now();
    let success = false;
    let error: string | undefined;
    let topChunks: RerankerResult[] = [];

    try {
      const payload = {
        query,
        documents: documents,
        top_n: topResults,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch('https://api.cohere.com/v2/rerank', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const results = data.results || [];

      topChunks = results.slice(0, topResults).map((res: any) => ({
        content: documents[res.index],
        score: res.score || res.relevance_score || 0,
        index: res.index
      }));

      success = true;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
      console.error(`❌ Cohere API Error: ${error}`);
      console.error(`🔑 API Key: ${this.apiKey ? 'Present' : 'Missing'}`);
      topChunks = documents.slice(0, topResults).map((doc, i) => ({
        content: doc,
        score: 1.0 - (i * 0.1),
        index: i
      }));
    }

    if (this.logger) {
      this.logger.log({
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        providerKind: 'reranker',
        operation: 'rerank',
        providerName: this.name,
        query,
        numDocumentsIn: documents.length,
        numDocumentsOut: topChunks.length,
        durationMs: Date.now() - startTime,
        success,
        errorMessage: error,
      });
    }

    return topChunks;
  }
}

export class NoopReranker implements BaseReranker {
  name = 'noop';

  constructor(private logger?: PerformanceLogger) {}

  async rerank(query: string, documents: string[], topResults: number): Promise<RerankerResult[]> {
    const startTime = Date.now();
    const topChunks = documents.slice(0, topResults).map((doc, i) => ({
      content: doc,
      score: 1.0 - (i * 0.1),
      index: i
    }));

    if (this.logger) {
      this.logger.log({
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        providerKind: 'reranker',
        operation: 'rerank',
        providerName: this.name,
        query,
        numDocumentsIn: documents.length,
        numDocumentsOut: topChunks.length,
        durationMs: Date.now() - startTime,
        success: true,
      });
    }

    return topChunks;
  }
}

export class EmbeddingReranker implements BaseReranker {
  name = 'embedding';
  private extractor: any = null;
  private isInitialized = false;

  constructor(
    private modelName: string = 'Xenova/all-mpnet-base-v2',
    private logger?: PerformanceLogger
  ) {
    // Model will be loaded lazily on first use
  }

  private async initializeModel() {
    if (this.isInitialized) {
      return; // Already initialized
    }
    
    try {
      const { pipeline } = await import('@xenova/transformers');
      this.extractor = await pipeline('feature-extraction', this.modelName);
      this.isInitialized = true;
      console.log(`✅ MPNet model '${this.modelName}' loaded and ready for deployment`);
    } catch (error) {
      console.error(`❌ Failed to load MPNet model: ${error}`);
      this.isInitialized = false;
      throw error;
    }
  }

  async rerank(query: string, documents: string[], topResults: number): Promise<RerankerResult[]> {
    const startTime = Date.now();
    let success = false;
    let error: string | undefined;
    let topChunks: RerankerResult[] = [];

    try {
      // Wait for model initialization if not ready
      if (!this.isInitialized && !this.extractor) {
        await this.initializeModel();
      }

      if (!this.extractor) {
        throw new Error('MPNet model failed to initialize');
      }

      // Generate embeddings for query and documents (model is already loaded)
      const queryEmbedding = await this.extractor(query, { pooling: 'mean', normalize: true });
      const docEmbeddings = await Promise.all(
        documents.map(doc => this.extractor(doc, { pooling: 'mean', normalize: true }))
      );

      // Calculate cosine similarities
      const similarities = docEmbeddings.map((docEmb, i) => {
        const similarity = this.cosineSimilarity(Array.from(queryEmbedding.data), Array.from(docEmb.data));
        return {
          content: documents[i],
          score: similarity,
          index: i
        };
      });

      // Sort by similarity (higher is better) and take top results
      topChunks = similarities
        .sort((a, b) => b.score - a.score)
        .slice(0, topResults);

      success = true;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
      // Fallback to simple scoring
      topChunks = documents.slice(0, topResults).map((doc, i) => ({
        content: doc,
        score: 1.0 - (i * 0.1),
        index: i
      }));
    }

    if (this.logger) {
      this.logger.log({
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        providerKind: 'reranker',
        operation: 'rerank',
        providerName: this.name,
        query,
        numDocumentsIn: documents.length,
        numDocumentsOut: topChunks.length,
        durationMs: Date.now() - startTime,
        success,
        errorMessage: error,
      });
    }

    return topChunks;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    return normA && normB ? dotProduct / (normA * normB) : 0;
  }
}

export class HeuristicReranker implements BaseReranker {
  name = 'heuristic';

  constructor(
    private fallbackReranker: BaseReranker,
    private minQueryLength: number = 5,
    private minDocuments: number = 3,
    private logger?: PerformanceLogger
  ) {}

  async rerank(query: string, documents: string[], topResults: number): Promise<RerankerResult[]> {
    const startTime = Date.now();

    // Heuristic 1: Query too short
    if (query.trim().length < this.minQueryLength) {
      return this.fallbackRerank(query, documents, topResults, startTime, 'query_too_short');
    }

    // Heuristic 2: Too few documents
    if (documents.length < this.minDocuments) {
      return this.fallbackRerank(query, documents, topResults, startTime, 'too_few_documents');
    }

    // Heuristic 3: Documents too similar (simple check - if many documents share common words)
    const avgSimilarity = this.calculateDocumentSimilarity(documents);
    if (avgSimilarity > 0.8) { // High similarity threshold
      return this.fallbackRerank(query, documents, topResults, startTime, 'documents_too_similar');
    }

    // Heuristic 4: Query complexity (has question words, multiple terms, etc.)
    const complexityScore = this.calculateQueryComplexity(query);
    if (complexityScore < 2) { // Low complexity
      return this.fallbackRerank(query, documents, topResults, startTime, 'query_low_complexity');
    }

    // If heuristics pass, use the fallback reranker (which could be any reranker)
    return await this.fallbackReranker.rerank(query, documents, topResults);
  }

  private async fallbackRerank(
    query: string,
    documents: string[],
    topResults: number,
    startTime: number,
    reason: string
  ): Promise<RerankerResult[]> {
    const results = await this.fallbackReranker.rerank(query, documents, topResults);

    if (this.logger) {
      this.logger.log({
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        providerKind: 'reranker',
        operation: 'rerank',
        providerName: this.name,
        query,
        numDocumentsIn: documents.length,
        numDocumentsOut: results.length,
        durationMs: Date.now() - startTime,
        success: true,
        extra: { heuristic_reason: reason, fallback_reranker: this.fallbackReranker.name }
      });
    }

    return results;
  }

  private calculateDocumentSimilarity(documents: string[]): number {
    if (documents.length < 2) return 0;

    let totalSimilarity = 0;
    let pairs = 0;

    for (let i = 0; i < documents.length; i++) {
      for (let j = i + 1; j < documents.length; j++) {
        const sim = this.simpleTextSimilarity(documents[i], documents[j]);
        totalSimilarity += sim;
        pairs++;
      }
    }

    return pairs > 0 ? totalSimilarity / pairs : 0;
  }

  private simpleTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private calculateQueryComplexity(query: string): number {
    let score = 0;

    // Length score
    score += Math.min(query.length / 10, 2); // Max 2 points for length

    // Question words
    const questionWords = ['what', 'how', 'why', 'when', 'where', 'who', 'which'];
    const hasQuestionWord = questionWords.some(word =>
      query.toLowerCase().includes(word)
    );
    if (hasQuestionWord) score += 1;

    // Multiple terms
    const terms = query.split(/\s+/).filter(term => term.length > 2);
    score += Math.min(terms.length / 3, 2); // Max 2 points for terms

    // Special characters (indicating complex queries)
    if (/[?!\-+]/.test(query)) score += 0.5;

    return score;
  }
}

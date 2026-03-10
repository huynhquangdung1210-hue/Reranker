// twoStageReranker.ts
import { BaseReranker, RerankerResult } from './searchTypes';
import { PerformanceLogger } from './performanceLogger';

export class TwoStageReranker implements BaseReranker {
  name = 'two-stage';

  constructor(
    private firstStage: BaseReranker,
    private secondStage: BaseReranker,
    private embeddingTopK: number,
    private logger?: PerformanceLogger
  ) {}

  async rerank(query: string, documents: string[], topResults: number): Promise<RerankerResult[]> {
    // 1) First-stage rerank on ALL documents to get full scoring
    const firstStageResults = await this.firstStage.rerank(query, documents, documents.length);

    // 2) Select top `embeddingTopK` chunks by score
    const topResultsFromFirst = firstStageResults
      .sort((a, b) => b.score - a.score)
      .slice(0, this.embeddingTopK);

    // 3) Extract content strings for second stage
    const topChunks = topResultsFromFirst.map(r => r.content);

    // 4) Second-stage rerank on that subset
    const secondStageResults = await this.secondStage.rerank(query, topChunks, topResults);

    // 5) Return final RerankerResult[] (indices are relative to the subset)
    return secondStageResults;
  }
}
// factories.ts
import { config } from 'dotenv';
config(); // Load environment variables from .env file

import { BaseSearchProvider } from './searchTypes';
import { BaseReranker } from './searchTypes';
import { SearXNGSearchProvider, SerperSearchProvider } from './searchProviders';
import { QwenReranker, JinaReranker, CohereReranker, NoopReranker, EmbeddingReranker, HeuristicReranker } from './rerankers';
import { TwoStageReranker } from './twoStageReranker';
import { PerformanceLogger } from './performanceLogger';

export type SearchProviderType = 'serper' | 'searxng';
export type RerankerType = 'none' | 'qwen' | 'bge' | 'jina' | 'cohere' | 'two-stage' | 'embedding' | 'heuristic';

export interface SearchConfig {
  provider: SearchProviderType;
  serper?: { apiKey: string; baseUrl?: string; };
  searxng?: { baseUrl: string; apiKey?: string; };
}

export interface RerankerConfig {
  type: RerankerType;
  qwen?: { apiKey: string; apiUrl: string; model: string; };
  bge?: { apiKey: string; apiUrl: string; model: string; };
  jina?: { apiKey: string; apiUrl: string; };
  cohere?: { apiKey: string; };
  twoStage?: {
    firstStage: RerankerType;
    secondStage: RerankerType;
    embeddingTopK: number;
  };
  heuristic?: {
    fallbackType: RerankerType;
    minQueryLength?: number;
    minDocuments?: number;
  };
}

export function createSearchProvider(cfg: SearchConfig, logger?: PerformanceLogger): BaseSearchProvider {
  switch (cfg.provider) {
    case 'searxng':
      if (!cfg.searxng?.baseUrl) throw new Error('SearXNG baseUrl required');
      return new SearXNGSearchProvider(cfg.searxng.baseUrl, cfg.searxng.apiKey, logger);
    case 'serper':
      if (!cfg.serper?.apiKey) throw new Error('Serper apiKey required');
      return new SerperSearchProvider(cfg.serper.apiKey, cfg.serper.baseUrl, logger);
    default:
      throw new Error(`Unknown search provider: ${cfg.provider}`);
  }
}

export function createReranker(cfg: RerankerConfig, logger?: PerformanceLogger): BaseReranker {
  switch (cfg.type) {
    case 'none':
      return new NoopReranker(logger);
    case 'qwen':
      if (!cfg.qwen?.apiKey || !cfg.qwen.apiUrl || !cfg.qwen.model) throw new Error('Qwen config incomplete');
      return new QwenReranker(cfg.qwen.apiKey, cfg.qwen.apiUrl, cfg.qwen.model, logger);
    case 'bge':
      if (!cfg.bge?.apiKey || !cfg.bge.apiUrl || !cfg.bge.model) throw new Error('BGE config incomplete');
      return new QwenReranker(cfg.bge.apiKey, cfg.bge.apiUrl, cfg.bge.model, logger);
    case 'jina':
      if (!cfg.jina?.apiKey || !cfg.jina.apiUrl) throw new Error('Jina config incomplete');
      return new JinaReranker(cfg.jina.apiKey, cfg.jina.apiUrl, logger);
    case 'cohere':
      if (!cfg.cohere?.apiKey) throw new Error('Cohere apiKey required');
      return new CohereReranker(cfg.cohere.apiKey, logger);
    case 'embedding':
      return new EmbeddingReranker('Xenova/all-mpnet-base-v2', logger);
    case 'heuristic':
      if (!cfg.heuristic?.fallbackType) throw new Error('Heuristic fallbackType required');
      const fallbackReranker = createReranker({ type: cfg.heuristic.fallbackType }, logger);
      return new HeuristicReranker(
        fallbackReranker,
        cfg.heuristic.minQueryLength || 5,
        cfg.heuristic.minDocuments || 3,
        logger
      );
    case 'two-stage':
      if (!cfg.twoStage) throw new Error('Two-stage config required');
      const firstStage = createReranker({ type: cfg.twoStage.firstStage }, logger);
      const secondStage = createReranker({ ...cfg, type: cfg.twoStage.secondStage }, logger);
      return new TwoStageReranker(firstStage, secondStage, cfg.twoStage.embeddingTopK, logger);
    default:
      throw new Error(`Unknown reranker type: ${cfg.type}`);
  }
}

// Load from env
export function loadSearchConfigFromEnv(): SearchConfig {
  const provider = (process.env.SEARCH_PROVIDER as SearchProviderType) || 'serper';
  const cfg: SearchConfig = { provider };
  if (provider === 'serper') {
    cfg.serper = {
      apiKey: process.env.SERPER_API_KEY || '',
      baseUrl: process.env.SERPER_BASE_URL,
    };
  } else if (provider === 'searxng') {
    cfg.searxng = {
      baseUrl: process.env.SEARXNG_INSTANCE_URL || '',
      apiKey: process.env.SEARXNG_API_KEY,
    };
  }
  return cfg;
}

export function loadRerankerConfigFromEnv(): RerankerConfig {
  const type = (process.env.RERANKER_TYPE as RerankerType) || 'none';
  const cfg: RerankerConfig = { type };
  if (type === 'qwen') {
    cfg.qwen = {
      apiKey: process.env.QWEN_RERANKER_API_KEY || '',
      apiUrl: process.env.QWEN_RERANKER_API_URL || '',
      model: process.env.QWEN_RERANKER_MODEL || '',
    };
  } else if (type === 'bge') {
    cfg.bge = {
      apiKey: process.env.BGE_RERANKER_API_KEY || '',
      apiUrl: process.env.BGE_RERANKER_API_URL || '',
      model: process.env.BGE_RERANKER_MODEL || '',
    };
  } else if (type === 'jina') {
    cfg.jina = {
      apiKey: process.env.JINA_API_KEY || '',
      apiUrl: process.env.JINA_API_URL || '',
    };
  } else if (type === 'cohere') {
    cfg.cohere = {
      apiKey: process.env.COHERE_API_KEY || '',
    };
  } else if (type === 'two-stage') {
    cfg.twoStage = {
      firstStage: (process.env.TWO_STAGE_FIRST as RerankerType) || 'none',
      secondStage: (process.env.TWO_STAGE_SECOND as RerankerType) || 'qwen',
      embeddingTopK: parseInt(process.env.TWO_STAGE_EMBEDDING_TOPK || '10'),
    };
  }
  return cfg;
}
// searchProviders.ts
import { BaseSearchProvider, SearchOptions, SearchResponse, SearchResultItem } from './searchTypes';
import { PerformanceLogger, PerformanceLogRecord } from './performanceLogger';

export class SearXNGSearchProvider implements BaseSearchProvider {
  name = 'searxng';

  constructor(
    private baseUrl: string,
    private apiKey?: string,
    private logger?: PerformanceLogger
  ) {}

  async search(query: string, options?: SearchOptions): Promise<SearchResponse> {
    const startTime = Date.now();
    let success = false;
    let error: string | undefined;
    let organic: SearchResultItem[] = [];

    try {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        safesearch: this.mapSafeSearch(options?.safeSearch || 'moderate'),
      });

      if (options?.language) params.append('language', options.language);
      if (options?.region) params.append('locale', options.region);

      const url = `${this.baseUrl}?${params.toString()}`;
      const response = await fetch(url, {
        headers: this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {},
        signal: AbortSignal.timeout(options?.timeoutMs || 10000), // configurable timeout, default 10s
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      organic = (data.results || []).map((item: any, index: number) => ({
        title: item.title || '',
        url: item.url || '',
        content: item.content || item.snippet || '',
        publishedDate: item.publishedDate,
        source: 'searxng',
        rank: index + 1,
      }));

      success = true;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
    }

    const durationMs = Date.now() - startTime;

    if (this.logger) {
      const record: PerformanceLogRecord = {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        providerKind: 'search',
        providerName: this.name,
        operation: 'search',
        query: query.substring(0, 100), // truncate
        durationMs,
        success,
        errorMessage: error,
        numDocumentsOut: organic.length,
        topKRequested: options?.topK,
        timeoutMs: options?.timeoutMs || 10000,
      };
      this.logger.log(record);
    }

    return {
      organic,
      success,
      error,
    };
  }

  private mapSafeSearch(safeSearch: 'off' | 'moderate' | 'strict'): string {
    switch (safeSearch) {
      case 'off': return '0';
      case 'moderate': return '1';
      case 'strict': return '2';
      default: return '1';
    }
  }
}

export class SerperSearchProvider implements BaseSearchProvider {
  name = 'serper';

  constructor(
    private apiKey: string,
    private baseUrl: string = 'https://google.serper.dev/search',
    private logger?: PerformanceLogger
  ) {}

  async search(query: string, options?: SearchOptions): Promise<SearchResponse> {
    const startTime = Date.now();
    let success = false;
    let error: string | undefined;
    let organic: SearchResultItem[] = [];
    let answerBox: any;

    try {
      const body: any = {
        q: query,
      };

      if (options?.topK) body.num = options.topK;
      if (options?.safeSearch) body.safeSearch = options.safeSearch;
      if (options?.language) body.gl = options.language;
      if (options?.region) body.hl = options.region;

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'X-API-KEY': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(options?.timeoutMs || 10000), // configurable timeout, default 10s
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      organic = (data.organic || []).map((item: any, index: number) => ({
        title: item.title || '',
        url: item.link || '',
        content: item.snippet || '',
        publishedDate: item.date,
        source: 'serper',
        rank: index + 1,
      }));

      if (data.answerBox) {
        answerBox = {
          title: data.answerBox.title,
          snippet: data.answerBox.snippet,
          url: data.answerBox.link,
          type: data.answerBox.type,
        };
      }

      success = true;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
    }

    const durationMs = Date.now() - startTime;

    if (this.logger) {
      const record: PerformanceLogRecord = {
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
        providerKind: 'search',
        providerName: this.name,
        operation: 'search',
        query: query.substring(0, 100),
        durationMs,
        success,
        errorMessage: error,
        numDocumentsOut: organic.length,
        topKRequested: options?.topK,
        timeoutMs: options?.timeoutMs || 10000,
      };
      this.logger.log(record);
    }

    return {
      organic,
      answerBox,
      success,
      error,
    };
  }
}
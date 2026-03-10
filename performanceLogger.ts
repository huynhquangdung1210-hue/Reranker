// performanceLogger.ts
import { appendFile } from 'fs/promises';

export type ProviderKind = 'search' | 'reranker';

export interface PerformanceLogRecord {
  timestamp: string;          // ISO string
  requestId: string;          // UUID per high-level pipeline call
  providerKind: ProviderKind; // 'search' or 'reranker'
  providerName: string;       // e.g. 'serper', 'searxng', 'qwen', 'jina'
  operation: string;          // e.g. 'search', 'rerank'
  query: string;              // truncated if necessary
  durationMs: number;
  success: boolean;
  errorMessage?: string;
  httpStatus?: number;
  numDocumentsIn?: number;
  numDocumentsOut?: number;
  topKRequested?: number;
  timeoutMs?: number;
  extra?: Record<string, any>; // flexible extensibility
}

export interface PerformanceLoggerOptions {
  jsonlPath?: string;   // path to .jsonl log file
  csvPath?: string;     // optional path to .csv (if we want CSV too)
}

export class PerformanceLogger {
  private csvHeaderWritten = false;

  constructor(private options: PerformanceLoggerOptions) {}

  async log(record: PerformanceLogRecord): Promise<void> {
    try {
      if (this.options.jsonlPath) {
        await appendFile(this.options.jsonlPath, JSON.stringify(record) + '\n');
      }
      if (this.options.csvPath) {
        // Write header if not already written
        if (!this.csvHeaderWritten) {
          const header = 'timestamp,requestId,providerKind,providerName,operation,query,durationMs,success,errorMessage,httpStatus,numDocumentsIn,numDocumentsOut,topKRequested,timeoutMs,extra\n';
          await appendFile(this.options.csvPath, header);
          this.csvHeaderWritten = true;
        }
        const csvLine = this.recordToCsv(record);
        await appendFile(this.options.csvPath, csvLine + '\n');
      }
    } catch (err) {
      console.error('Failed to log performance:', err);
    }
  }

  private recordToCsv(record: PerformanceLogRecord): string {
    const fields = [
      record.timestamp,
      record.requestId,
      record.providerKind,
      record.providerName,
      record.operation,
      `"${record.query.replace(/"/g, '""')}"`,
      record.durationMs,
      record.success,
      record.errorMessage ? `"${record.errorMessage.replace(/"/g, '""')}"` : '',
      record.httpStatus || '',
      record.numDocumentsIn || '',
      record.numDocumentsOut || '',
      record.topKRequested || '',
      record.timeoutMs || '',
      record.extra ? JSON.stringify(record.extra) : '',
    ];
    return fields.join(',');
  }
}
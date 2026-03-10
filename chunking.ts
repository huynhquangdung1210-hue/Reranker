import { ScrapedPage } from './searchTypes';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

// LangChain RecursiveCharacterTextSplitter configuration
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,        // 1000 characters per chunk
  chunkOverlap: 200,      // 200 characters overlap between chunks
  separators: ["\n\n", "\n", " ", ""], // Recursive splitting strategy
});

export async function chunkScrapedPages(pages: ScrapedPage[]): Promise<string[]> {
  const allChunks: string[] = [];

  for (const page of pages) {
    if (!page.content) continue;

    try {
      // Use LangChain's RecursiveCharacterTextSplitter
      const chunks = await textSplitter.splitText(page.content);

      // Filter out empty chunks and add to results
      for (const chunk of chunks) {
        if (chunk && chunk.trim().length > 0) {
          allChunks.push(chunk.trim());
        }
      }
    } catch (error) {
      console.error(`Error chunking page ${page.url}:`, error);
      // Fallback: add the whole content if chunking fails
      if (page.content.trim().length > 0) {
        allChunks.push(page.content.trim());
      }
    }
  }

  return allChunks;
}
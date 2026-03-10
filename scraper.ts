import { WebSearchConfig, ScraperProvider, ScraperOptions, ScrapedPage, BaseScraper } from './searchTypes';

interface FirecrawlScraperConfig {
  apiKey: string;
  timeout?: number;        // ms
  formats?: string[];      // default ['markdown', 'rawHtml']
  baseUrl?: string;        // default 'https://api.firecrawl.dev/v2/scrape'
}

// URL Processing Configuration
const MAX_SEARCH_RESULTS = 20;
const URL_SCRAPE_TIMEOUT = 7500;
const MAX_CONCURRENT_SCRAPES = 5;

// Error categorization for scraping failures
const SCRAPE_ERROR_TYPES = {
  // Network errors
  TIMEOUT: 'Request timed out',
  ENOTFOUND: 'Domain not found', 
  ECONNREFUSED: 'Connection refused',
  NETWORK_ERROR: 'Network connectivity issue',
  
  // HTTP errors  
  HTTP_401: 'Authentication required',
  HTTP_403: 'Access forbidden',
  HTTP_404: 'Page not found',
  HTTP_429: 'Rate limited',
  HTTP_5XX: 'Server error',
  
  // Content errors
  BLOCKED: 'Blocked by anti-bot measures',
  EMPTY: 'No readable content',
  JAVASCRIPT_REQUIRED: 'Requires JavaScript execution',
  
  // Circuit breaker
  CIRCUIT_OPEN: 'Service temporarily unavailable'
};

// Track errors without failing entire search
let errorStats = {
  total: 0,
  successful: 0,
  failed: 0,
  errors: {} as Record<string, number>
};

// URL validation functions
function isInternalURL(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    // Check for internal/private IPs and localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || 
        hostname.startsWith('10.') || hostname.startsWith('172.')) {
      return true;
    }
    // Check for internal domains
    return hostname.includes('.local') || hostname.includes('.internal');
  } catch {
    return false;
  }
}

function shouldSkipURL(url: string): boolean {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase();
    const hostname = parsed.hostname.toLowerCase();
    
    // Skip non-HTML content types
    if (pathname.endsWith('.pdf') || pathname.endsWith('.doc') || pathname.endsWith('.docx') ||
        pathname.endsWith('.xls') || pathname.endsWith('.xlsx') || pathname.endsWith('.ppt') ||
        pathname.endsWith('.pptx') || pathname.endsWith('.zip') || pathname.endsWith('.rar') ||
        pathname.endsWith('.exe') || pathname.endsWith('.dmg') || pathname.endsWith('.iso')) {
      return true;
    }
    
    // Skip certain domains that are known to be problematic
    const skipDomains = ['facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com', 
                        'youtube.com', 'vimeo.com', 'tiktok.com'];
    return skipDomains.some(domain => hostname.includes(domain));
  } catch {
    return true;
  }
}

function isSocialMedia(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const socialDomains = ['facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com', 
                          'reddit.com', 'tiktok.com', 'snapchat.com', 'pinterest.com'];
    return socialDomains.some(domain => hostname.includes(domain));
  } catch {
    return false;
  }
}

function isVideoPlatform(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const videoDomains = ['youtube.com', 'vimeo.com', 'dailymotion.com', 'twitch.tv', 
                         'tiktok.com', 'instagram.com'];
    return videoDomains.some(domain => hostname.includes(domain));
  } catch {
    return false;
  }
}

// Applied to each SearXNG result URL
function isValidSearchURL(url: string): boolean {
  // 1. Basic URL parsing
  try {
    const parsed = new URL(url);
    if (!parsed.protocol.startsWith('http')) return false;
  } catch {
    return false; // Malformed URL
  }
  
  // 2. SSRF Protection (same as URL content fetching)
  if (isInternalURL(url)) return false;
  
  // 3. Content Type Filtering
  if (shouldSkipURL(url)) return false;
  
  // 4. Additional web search filters
  if (isSocialMedia(url)) return false; // Optional: filter social media
  if (isVideoPlatform(url)) return false; // Optional: filter video sites
  
  return true;
}

function updateErrorStats(success: boolean, errorType?: string) {
  if (success) {
    errorStats.successful++;
  } else {
    errorStats.failed++;
    if (errorType) {
      errorStats.errors[errorType] = (errorStats.errors[errorType] || 0) + 1;
    }
  }
}

function resetErrorStats() {
  errorStats = {
    total: 0,
    successful: 0,
    failed: 0,
    errors: {}
  };
}

export class FirecrawlScraper implements BaseScraper {
  public readonly name = 'firecrawl';

  constructor(private readonly cfg: FirecrawlScraperConfig) {}

  async scrape(urls: string[], options?: ScraperOptions): Promise<ScrapedPage[]> {
    const maxPages = options?.maxPages ?? urls.length;
    const timeoutMs = options?.timeoutMs ?? this.cfg.timeout;
    const formats = this.cfg.formats ?? ['markdown', 'rawHtml'];
    const baseUrl = this.cfg.baseUrl ?? 'https://api.firecrawl.dev/v1/scrape';

    // Filter and validate URLs
    const validUrls = urls
      .filter(url => isValidSearchURL(url))
      .slice(0, maxPages); // Limit to prevent overload

    console.log(`🔍 Validated ${validUrls.length} URLs out of ${urls.length} total`);

    resetErrorStats();
    errorStats.total = validUrls.length;

    const results: ScrapedPage[] = [];

    // Scrape URLs with concurrency control
    const scrapePromises = validUrls.map(url => this.scrapeSingleUrl(url, timeoutMs, formats, baseUrl));
    
    // Use Promise.allSettled to prevent cascade failures
    const scrapeResults = await Promise.allSettled(scrapePromises);

    // Process results individually
    for (let i = 0; i < validUrls.length; i++) {
      const url = validUrls[i];
      const scrapeResult = scrapeResults[i];
      
      if (scrapeResult.status === 'fulfilled' && scrapeResult.value.success && scrapeResult.value.page) {
        // Successful scrape
        results.push(scrapeResult.value.page);
        updateErrorStats(true);
      } else {
        // Failed scrape - log error but don't add to results
        const errorType = scrapeResult.status === 'fulfilled' 
          ? scrapeResult.value.errorType 
          : 'SCRAPE_FAILED';
        console.warn(`❌ Failed to scrape ${url}: ${errorType}`);
        updateErrorStats(false, errorType);
      }
    }

    console.log(`📊 Scrape stats: ${errorStats.successful}/${errorStats.total} successful`);
    if (errorStats.failed > 0) {
      console.log(`📊 Error breakdown:`, errorStats.errors);
    }

    return results;
  }

  async scrapeSingleUrl(url: string, timeoutMs: number | undefined, formats: string[], baseUrl: string): Promise<{success: boolean, page?: ScrapedPage, errorType?: string}> {

    try {
      const controller = timeoutMs ? new AbortController() : undefined;
      if (controller && timeoutMs) {
        setTimeout(() => controller.abort(), timeoutMs);
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (this.cfg.apiKey && this.cfg.apiKey.trim()) {
        headers['Authorization'] = `Bearer ${this.cfg.apiKey}`;
      }

      const res = await fetch(baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ url, formats }),
        signal: controller?.signal,
      });
      
      const responseText = await res.text();
      
      // Check if response is JSON or direct content
      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        // Not JSON, treat as direct content
        data = { success: true, data: { markdown: responseText, url: url } };
      }
      
      if (!res.ok && !data.success) {
        let errorType = 'HTTP_ERROR';
        if (res.status === 401) errorType = 'HTTP_401';
        else if (res.status === 403) errorType = 'HTTP_403';
        else if (res.status === 404) errorType = 'HTTP_404';
        else if (res.status === 429) errorType = 'HTTP_429';
        else if (res.status >= 500) errorType = 'HTTP_5XX';
        
        console.log(`❌ FireCrawl error ${res.status} (${errorType}) for ${url}`);
        return { success: false, errorType };
      }

      if (!data.success) {
        console.log(`❌ FireCrawl returned success=false for ${url}`);
        return { success: false, errorType: 'API_ERROR' };
      }

      const rawContent =
        data.data?.markdown ??
        data.data?.text ??
        data.data?.rawHtml ??
        data.markdown ??
        data.text ??
        data.rawHtml ??
        '';

      console.log(`📝 Content length: ${rawContent.length}`);

      if (!rawContent.trim()) {
        console.log(`❌ Empty content for ${url}`);
        return { success: false, errorType: 'EMPTY' };
      }

      const page: ScrapedPage = {
        url: data.data?.url ?? data.url ?? url,
        title: data.data?.title ?? data.title,
        content: normalizeContent(rawContent),
        publishedDate: data.data?.metadata?.publishedDate ?? data.metadata?.publishedDate,
        metadata: data.data?.metadata ?? data.metadata,
      };

      console.log(`✅ Successfully scraped ${url}`);
      return { success: true, page };
    } catch (error: any) {
      let errorType = 'NETWORK_ERROR';
      if (error.name === 'AbortError') errorType = 'TIMEOUT';
      else if (error.code === 'ENOTFOUND') errorType = 'ENOTFOUND';
      else if (error.code === 'ECONNREFUSED') errorType = 'ECONNREFUSED';
      
      return { success: false, errorType };
    }
  }
}

function normalizeContent(raw: string, maxChars = 8000): string {
  const s = String(raw).replace(/\s+/g, ' ').trim();
  return s.length > maxChars ? s.slice(0, maxChars) : s;
}

export function createFirecrawlScraper(config: FirecrawlScraperConfig): BaseScraper {
  return new FirecrawlScraper(config);
}

export function createScraper(config: WebSearchConfig): BaseScraper | null {
  const provider: ScraperProvider = config.scraperProvider ?? 'serper';
  const timeout = config.scraperTimeout ?? config.urlScrapeTimeout ?? URL_SCRAPE_TIMEOUT;

  if (provider === 'firecrawl') {
    if (!config.firecrawlApiKey) {
      throw new Error('firecrawlApiKey is required when scraperProvider = "firecrawl"');
    }
    return createFirecrawlScraper({
      apiKey: config.firecrawlApiKey,
      baseUrl: config.firecrawlBaseUrl,
      timeout,
      formats: config.firecrawlFormats ?? ['markdown', 'rawHtml'],
    });
  }

  // 'serper' branch:
  // If you have a Serper-based scraper, instantiate it here.
  // Otherwise, return null to mean "no extra scraping; use snippets".
  return null;
}

// Export validation functions for testing
export { isValidSearchURL, isInternalURL, shouldSkipURL, isSocialMedia, isVideoPlatform };
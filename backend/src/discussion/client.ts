export interface DiscussionResult {
  title: string;
  url: string;
  snippet: string;
}

export interface DiscussionSearchClient {
  search(query: string): Promise<DiscussionResult[]>;
}

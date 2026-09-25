/** A tiny in-memory HTTP-like server, used as a fetch() stub so crawler tests need no real network. */
export interface FakeRoute {
  status?: number;
  contentType?: string;
  body: string;
  headers?: Record<string, string>;
}

export function fakeSite(routes: Record<string, FakeRoute>): typeof fetch {
  return (async (input: any) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    const path = url.pathname === "" ? "/" : url.pathname;
    const route = routes[path];
    if (!route) {
      return new Response("not found", { status: 404 });
    }
    return new Response(route.body, {
      status: route.status ?? 200,
      headers: { "content-type": route.contentType ?? "text/html", ...(route.headers ?? {}) },
    });
  }) as unknown as typeof fetch;
}

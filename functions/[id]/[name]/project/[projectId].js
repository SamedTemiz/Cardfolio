/**
 * Cloudflare Pages Function: serve project-detail.html for /:id/:name/project/:projectId
 * so the correct HTML is returned without relying on _redirects.
 */
export async function onRequest(context) {
  const url = new URL(context.request.url);
  url.pathname = "/project-detail.html";
  return context.env.ASSETS.fetch(new Request(url, context.request));
}

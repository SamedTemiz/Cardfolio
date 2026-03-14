/**
 * Cloudflare Pages Function: serve profile.html for /:id/:name/profile
 * so the correct HTML is returned without relying on _redirects.
 */
export async function onRequest(context) {
  const url = new URL(context.request.url);
  url.pathname = "/profile.html";
  return context.env.ASSETS.fetch(new Request(url, context.request));
}

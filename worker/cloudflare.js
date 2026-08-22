export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/financeiro" || url.pathname === "/financeiro/") {
      return Response.redirect(`${url.origin}/financeiro-v2.html?v=202608220345`, 302);
    }
    return env.ASSETS.fetch(request);
  },
};

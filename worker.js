// worker.js

import { getAssetFromKV, NotFoundError } from '@cloudflare/kv-asset-handler';

   const STATIC_CONTENT_MANIFEST = {
        'chat.html': chat_html,
        'chat.js': chat_js,
        'style.css': style_css,
        '404.html': notfound_html
    };

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event));
});

async function handleRequest(event) {
  const { request, waitUntil } = event;
  const url = new URL(request.url);
  let options = {};

  try {
    if (STATIC_CONTENT_MANIFEST[url.pathname.slice(1)]) {
      const page = await getAssetFromKV(event, options);
      return page;
    }
  } catch (e) {
    if (e instanceof NotFoundError) {
      try {
        let notFoundPage = await getAssetFromKV(event, { mapRequestToAsset: () => new Request(`${new URL(request.url).pathname}.html`, request) })
        return new Response(notFoundPage.body, { ...notFoundPage, status: 404 });
      } catch (e) { }
    }

  }

  if (request.headers.get('Upgrade') === 'websocket') {
    return handleWebSocket(event);
  }
  return new Response('Not found', { status: 404 });
}


async function handleWebSocket(event) {
  const { request, waitUntil } = event;
  const url = new URL(request.url);
  if (url.pathname !== '/ws') {
    return new Response(null, { status: 404 });
  }
  const [client, worker] = Object.values(new WebSocketPair());
  await handleSession(worker);
  return new Response(null, { status: 101, webSocket: client });
}


async function handleSession(ws) {
  ws.accept();
  ws.addEventListener('message', async event => {
    const message = event.data;
    console.log('message', message)
    for (const client of sockets) {
      client.send(message);
    }
  });
  ws.addEventListener('close', event => {
    sockets.delete(ws);
  });
  ws.addEventListener('error', event => {
    sockets.delete(ws);
  });
  sockets.add(ws);
}

const sockets = new Set();
// cloudflare-worker.js
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const jwtAssertion = request.headers.get('cf-access-jwt-assertion');
  const yourCloudflareDomain = 'your-cloudflare-domain.com'; // Replace with your actual domain

    if (!jwtAssertion) {
      return new Response('Unauthorized: Missing JWT', { status: 401 });
    }

    try {
      const authResponse = await verifyJWT(jwtAssertion, yourCloudflareDomain);
      if (authResponse.ok) {
        // JWT is valid, forward the request to your Next.js application
        return fetch(request);
      } else {
        console.error('JWT Verification Failed:', authResponse.status, authResponse.statusText);
        return new Response('Unauthorized: Invalid JWT', { status: 401 });
      }
    } catch (error) {
      console.error('Error verifying JWT:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
}

async function verifyJWT(jwtAssertion, yourCloudflareDomain) {
  const CLOUDFLARE_ACCESS_PUBLIC_KEY_URL = `https://${yourCloudflareDomain}/cdn-cgi/access/certs`;
  try {
    const response = await fetch(CLOUDFLARE_ACCESS_PUBLIC_KEY_URL);
    if (!response.ok) {
      console.error('Failed to fetch public key:', response.status, response.statusText);
      throw new Error('Failed to fetch public key');
    }
    const data = await response.json();
    if (!data || !data.keys || data.keys.length === 0) {
      console.error('Invalid public key data:', data);
      throw new Error('Invalid public key data');
    }
    const publicKey = data.keys[0].x5c[0];
    const algorithm = data.keys[0].alg;

    // You'll need to implement a proper JWT verification library here
    // This is a placeholder - replace with your JWT library of choice
    // and proper certificate handling
    const isValid = await validateJwt(jwtAssertion, publicKey, algorithm);
    return { ok: isValid };
  } catch (error) {
    console.error('JWT Verification Error:', error);
    return { ok: false, error: error.message };
  }
}
// Placeholder for actual JWT validation using a library
async function validateJwt(token, publicKey, algorithm) {
  // Implement validation using a JWT library like jose, node-jsonwebtoken
  // This is a very simple placeholder and is NOT SECURE
  // Replace with a validated implementation
  // e.g., const { jwtVerify, createRemoteJWKSet } = require('jose')

  return true;
}
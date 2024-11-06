// Importing necessary modules from express and @badgateway/oauth2-client
import express from 'express';
import { generateCodeVerifier, OAuth2Client } from '@badgateway/oauth2-client';
import {
  RefreshRequest,
  TokenResponse,
} from '@badgateway/oauth2-client/dist/messages';
import { AuthorizationCodeRequest } from '@badgateway/oauth2-client/src/messages';
import crypto from 'crypto';

// Initialize the express app
const app = express();
const PORT = 12345; // Define port for the server to listen on

// OAuth2 configuration constants
const CLIENT_ID = 'YOUR CLIENT_ID'; // Client ID for OAuth2 client
const CLIENT_SECRET = 'YOUR CLIENT_SECRET'; // Client secret for OAuth2 client
const REDIRECT_URI = 'http://localhost:12345/callback'; // Redirect URI to handle callback from authorization server
const SERVER = 'https://api.biz.moneyforward.com'; // OAuth2 authorization server base URL

// Global variables to manage token and state information
let tokenResponse: TokenResponse | null = null; // Stores the token response
let codeVerifier: string | null = null; // Code verifier for PKCE (Proof Key for Code Exchange)
let state: string | null = null; // Unique state for each authorization request to prevent CSRF attacks

// Instantiate OAuth2 client with configuration
const client = new OAuth2Client({
  server: SERVER,
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET,
  authorizationEndpoint: '/authorize',
  tokenEndpoint: '/token',
  authenticationMethod: 'client_secret_post', // Method to authenticate client
});

// Helper function to create HTML form buttons for actions on the homepage
function createButton(action: string, label: string): string {
  return `
    <form action="${action}" method="get" style="display:inline;">
      <button type="submit">${label}</button>
    </form>
  `;
}

// Display home page with token info and buttons for actions
function displayHomePage(req: express.Request, res: express.Response) {
  const tokenInfo = tokenResponse
    ? JSON.stringify(tokenResponse, null, 2) // If token is available, display its details
    : 'No token available'; // If token is not available, show a placeholder message
  res.send(`
    <h1>OAuth2 Client Demo</h1>
    <h2>Token Info</h2>
    <pre>${tokenInfo}</pre>
    ${createButton('/login', 'Authorize')}
    ${createButton('/refresh', 'Refresh Token')}
    ${createButton('/revoke', 'Revoke Token')}
    <br /><br />
    ${createButton('/office', 'Fetch Protected Resource')}
  `); // Send response with HTML buttons for various actions
}

// Start authorization flow for OAuth2 using PKCE (Proof Key for Code Exchange)
async function startAuthorization(req: express.Request, res: express.Response) {
  codeVerifier = await generateCodeVerifier(); // Generate code verifier for PKCE
  state = Math.random().toString(36).substring(7); // Generate a random state string for CSRF protection

  // Generate authorization URL
  const authorizeUrl = await client.authorizationCode.getAuthorizeUri({
    redirectUri: REDIRECT_URI,
    codeVerifier,
    state,
    scope: ['mfc/admin/office.read'], // Scope of access for the authorization
  });

  console.info('Redirecting to', authorizeUrl); // Log the URL for debugging
  res.redirect(authorizeUrl); // Redirect user to the authorization URL
}

// Handle the callback from authorization server to retrieve tokens
async function handleAuthorizationCallback(
  req: express.Request,
  res: express.Response,
) {
  try {
    const { code, state: returnedState } = req.query; // Extract code and state from query parameters

    // Verify that returned state matches the initial state for security
    if (
      !crypto.timingSafeEqual(
        Buffer.from(String(returnedState)),
        Buffer.from(String(state)),
      )
    )
      throw new Error('State does not match');
    if (!codeVerifier) throw new Error('Code verifier is missing'); // Ensure code verifier exists for PKCE

    // Create request payload for token exchange
    const authorizationCodeRequest: AuthorizationCodeRequest = {
      grant_type: 'authorization_code', // Authorization code grant type
      code: code as string,
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifier, // Send code verifier for PKCE
    };

    // Exchange authorization code for access and refresh tokens
    tokenResponse = await client.request(
      'tokenEndpoint',
      authorizationCodeRequest,
    );
    console.info('Access Token Response:', tokenResponse); // Log the token response

    res.redirect('/'); // Redirect back to the home page
  } catch (error) {
    console.error('Error during callback processing:', error); // Log errors if any
    res.status(500).send('Failed to obtain access token.');
  }
}

// Refresh the access token using the refresh token
async function refreshAccessToken(
  req: express.Request,
  res: express.Response,
): Promise<boolean> {
  // Check if refresh token is available
  if (!tokenResponse?.refresh_token) {
    console.error('Refresh token is missing.'); // Log missing refresh token
    return false; // Return false if no refresh token
  }

  try {
    // Create refresh token request payload
    const refreshRequest: RefreshRequest = {
      grant_type: 'refresh_token', // Refresh token grant type
      refresh_token: tokenResponse.refresh_token,
    };
    console.info('Refreshing token with request:', refreshRequest); // Log request payload

    // Request new access token using refresh token
    tokenResponse = await client.request('tokenEndpoint', refreshRequest);
    console.info('New Refreshed Token Response:', tokenResponse); // Log the refreshed token

    return true; // Return true if refresh successful
  } catch (error) {
    console.error('Error refreshing token:', error); // Log errors if any
    return false; // Return false if refresh fails
  }
}

// Wrapper for /refresh route to handle Promise<boolean>
app.get('/refresh', async (req, res) => {
  const refreshStatus = await refreshAccessToken(req, res);
  if (refreshStatus) {
    res.redirect('/'); // Redirect to home page if refresh is successful
  } else {
    res.status(401).send('Failed to refresh token. Please log in again.');
  }
});

// Revoke the current access token for security (optional)
async function revokeAccessToken(req: express.Request, res: express.Response) {
  if (!tokenResponse || !tokenResponse.access_token) {
    res.status(400).send('Access token is missing'); // Ensure access token is available
    return;
  }

  try {
    // Revoke token by sending a request to the revocation endpoint
    await client.request('revocationEndpoint', {
      token: tokenResponse.access_token,
    });
    tokenResponse = null; // Clear token response after revocation
    console.info('Token revoked successfully'); // Log success message

    res.redirect('/'); // Redirect to home page
  } catch (error) {
    console.error('Error revoking token:', error); // Log errors if any
    res.status(500).send('Failed to revoke token.');
  }
}

// Fetch a protected resource using the access token
async function fetchProtectedResource(
  req: express.Request,
  res: express.Response,
) {
  if (!tokenResponse) {
    res.status(401).send('Access token is missing. Please log in.'); // Ensure access token is available
    return;
  }

  try {
    // First attempt to fetch resource
    let response = await fetch(
      'https://bizapis.moneyforward.com/admin/office',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${tokenResponse.access_token}`, // Send access token
        },
      },
    );

    // If token expired, attempt to refresh and retry fetching the resource
    if (response.status === 401) {
      console.info('Token expired. Refreshing token...');
      const refreshStatus = await refreshAccessToken(req, res);

      if (!refreshStatus) {
        // Ensure refresh was successful
        res
          .status(401)
          .send('Token expired and refresh failed. Please log in again.');
        return;
      }

      // Retry fetching resource with refreshed token
      response = await fetch('https://bizapis.moneyforward.com/admin/office', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${tokenResponse.access_token}`, // Send refreshed access token
        },
      });
    }

    // Handle final fetch response
    if (!response.ok) {
      throw new Error(`Failed to fetch resource: ${response.statusText}`); // Handle response error
    }

    const data = await response.json(); // Parse response JSON
    console.info('Protected Resource Response:', data); // Log the response data
    res.json(data); // Send data to client
  } catch (error) {
    console.error('Error fetching protected resource:', error); // Log errors if any
    res.status(500).send('Failed to fetch protected resource.');
  }
}

// Define routes for the application
app.get('/', displayHomePage); // Home route
app.get('/login', startAuthorization); // Start authorization
app.get('/callback', handleAuthorizationCallback); // Handle callback and get tokens
app.get('/revoke', revokeAccessToken); // Revoke token
app.get('/office', fetchProtectedResource); // Access protected resource

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`); // Log server start message
});

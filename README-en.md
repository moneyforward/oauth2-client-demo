# oauth-client-demo

This project demonstrates how to implement an OAuth2 client in Node.js to interact with Money Forward's authentication server. It showcases a complete flow for authorizing, obtaining tokens, refreshing tokens, and accessing protected resources using OAuth2.

## Prerequisites

- **Node.js**: Ensure that Node.js is installed on your system, as this example is based on Node.js v22.9.0. You can download it from [Node.js](https://nodejs.org/).
- **OAuth2 Client Library**: Uses `@badgateway/oauth2-client` to implement OAuth2 flow properly.

## Configuration

Before running the application, you need to set your own OAuth2 credentials and redirect uri. Replace the placeholders in `src/index.ts` with your actual values:

```javascript
const CLIENT_ID = 'YOUR_CLIENT_ID'; // Replace with your OAuth2 Client ID
const CLIENT_SECRET = 'YOUR_CLIENT_SECRET'; // Replace with your OAuth2 Client Secret
const REDIRECT_URI = 'http://localhost:12345/callback'; // Replace with your Redirect URI
```

Make sure to set `CLIENT_ID`, `CLIENT_SECRET`, and `REDIRECT_URI` according to your settings.

## Dependencies

The project uses the following dependencies:

- `@badgateway/oauth2-client`: OAuth2 client library.
- `express`: Web framework for handling routes and HTTP requests.

These dependencies are specified in the `package.json` file, and can be installed as shown below.

## Installation

To install the required dependencies:

```bash
npm install
```

## Build

To build the TypeScript files into JavaScript:

```bash
npm run build
```

## Run

To start the application after building, use:

```bash
npm start
```

## Project Structure

- **src/index.ts**: Main file where the OAuth2 client is set up and routes are defined.
- **package.json**: Defines project dependencies, scripts, and other configurations.

## Formatting

To format all project files, use the following command:

```bash
npm run format
```

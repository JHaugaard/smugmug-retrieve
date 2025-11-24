/**
 * Test script for SmugMug OAuth flow
 *
 * This script demonstrates how to authenticate with SmugMug API
 *
 * Usage:
 * 1. Get your API Key and Secret from SmugMug Developer Portal
 * 2. Run: node test-oauth.js
 * 3. Follow the prompts to complete OAuth flow
 */

import SmugMugService from './src/services/SmugMugService.js';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function testOAuthFlow() {
  try {
    console.log('\n=== SmugMug OAuth 1.0a Test ===\n');

    // Step 1: Get API credentials
    const apiKey = await question('Enter your SmugMug API Key: ');
    const apiSecret = await question('Enter your SmugMug API Secret: ');

    if (!apiKey || !apiSecret) {
      console.error('Error: API Key and Secret are required');
      rl.close();
      return;
    }

    const smugmugService = new SmugMugService(apiKey, apiSecret);

    // Step 2: Get request token
    console.log('\nStep 1: Getting request token...');
    const { requestToken, authorizeUrl } = await smugmugService.getRequestToken('oob');

    console.log('\n✓ Request token obtained');
    console.log(`Request Token: ${requestToken}`);

    // Step 3: User authorization
    console.log('\n=== AUTHORIZATION REQUIRED ===');
    console.log('\nPlease visit this URL in your browser:');
    console.log(`\n${authorizeUrl}\n`);
    console.log('After authorizing, you will receive a 6-digit verification code.');

    const verifier = await question('\nEnter the verification code: ');

    if (!verifier) {
      console.error('Error: Verification code is required');
      rl.close();
      return;
    }

    // Step 4: Exchange for access token
    console.log('\nStep 2: Exchanging verification code for access token...');
    const { accessToken, accessTokenSecret } = await smugmugService.getAccessToken(verifier);

    console.log('\n✓ Access token obtained!');
    console.log(`Access Token: ${accessToken}`);
    console.log(`Access Token Secret: ${accessTokenSecret}`);

    // Step 5: Test authenticated request
    console.log('\nStep 3: Testing authenticated request...');
    const user = await smugmugService.getAuthenticatedUser();

    console.log('\n✓ Authentication successful!');
    console.log('\nUser Information:');
    console.log(`  Name: ${user.Name}`);
    console.log(`  Nickname: ${user.NickName}`);
    console.log(`  Domain: ${user.Domain}`);

    // Save tokens for future use
    console.log('\n=== IMPORTANT: Save These Tokens ===');
    console.log('\nYou can reuse these tokens instead of going through OAuth each time:');
    console.log(`\nAccess Token: ${accessToken}`);
    console.log(`Access Token Secret: ${accessTokenSecret}`);
    console.log('\nStore these securely and use them in your .env file or configuration.\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    rl.close();
  }
}

// Run the test
testOAuthFlow();

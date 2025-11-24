/**
 * Test script for SmugMug Account Discovery
 *
 * This script demonstrates how to discover albums and folder structure
 *
 * Usage:
 * 1. Complete OAuth flow first (run test-oauth.js) to get access tokens
 * 2. Run: node test-discovery.js
 * 3. Enter your credentials and tokens when prompted
 */

import SmugMugService from './src/services/SmugMugService.js';
import AccountDiscoveryService from './src/services/AccountDiscoveryService.js';
import readline from 'readline';
import fs from 'fs/promises';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function testAccountDiscovery() {
  try {
    console.log('\n=== SmugMug Account Discovery Test ===\n');

    // Step 1: Get credentials
    const apiKey = await question('Enter your SmugMug API Key: ');
    const apiSecret = await question('Enter your SmugMug API Secret: ');
    const accessToken = await question('Enter your Access Token: ');
    const accessTokenSecret = await question('Enter your Access Token Secret: ');

    if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
      console.error('Error: All credentials are required');
      rl.close();
      return;
    }

    // Step 2: Initialize services
    console.log('\nInitializing services...');
    const smugmugService = new SmugMugService(apiKey, apiSecret);
    smugmugService.setAccessToken(accessToken, accessTokenSecret);

    const discoveryService = new AccountDiscoveryService(smugmugService);

    // Set up progress callback
    discoveryService.setProgressCallback((phase, current, total, message) => {
      if (current % 10 === 0 || current === total) {
        console.log(`  [${phase}] ${current}/${total}: ${message}`);
      }
    });

    // Step 3: Ask about empty albums
    const includeEmptyInput = await question('\nInclude empty albums? (y/n) [y]: ');
    const includeEmpty = includeEmptyInput.toLowerCase() !== 'n';

    // Step 4: Discover account structure
    console.log('\nStarting account discovery...');
    console.log('This may take a few minutes depending on account size.\n');

    const startTime = Date.now();
    const accountStructure = await discoveryService.discoverAccount(includeEmpty);
    const endTime = Date.now();

    // Step 5: Display results
    console.log('\n' + '='.repeat(60));
    console.log('DISCOVERY COMPLETE');
    console.log('='.repeat(60));

    const stats = accountStructure.getStats();
    console.log('\nAccount Information:');
    console.log(`  User: ${accountStructure.user.name} (@${accountStructure.user.nickName})`);
    console.log(`  Domain: ${accountStructure.user.domain}`);

    console.log('\nStatistics:');
    console.log(`  Total Albums: ${stats.totalAlbums}`);
    console.log(`  Total Images: ${stats.totalImages}`);
    console.log(`  Total Videos: ${stats.totalVideos}`);
    console.log(`  Total Assets: ${stats.totalAssets}`);
    console.log(`  Discovery Time: ${Math.round((endTime - startTime) / 1000)}s`);

    // Step 6: Show sample albums
    console.log('\nSample Albums (first 10):');
    const albums = accountStructure.getAllAlbums();
    albums.slice(0, 10).forEach((album, index) => {
      console.log(`  ${index + 1}. ${album.name} (${album.getTotalMediaCount()} assets)`);
      if (album.keywords && album.keywords.length > 0) {
        console.log(`     Keywords: ${album.keywords.slice(0, 5).join(', ')}`);
      }
    });

    if (albums.length > 10) {
      console.log(`  ... and ${albums.length - 10} more albums`);
    }

    // Step 7: Offer to save results
    const saveInput = await question('\nSave results to JSON file? (y/n) [y]: ');
    if (saveInput.toLowerCase() !== 'n') {
      const filename = `discovery-${accountStructure.user.nickName}-${Date.now()}.json`;
      const data = accountStructure.toJSON();

      await fs.writeFile(filename, JSON.stringify(data, null, 2));
      console.log(`\n✓ Results saved to: ${filename}`);
      console.log(`  File size: ${Math.round((await fs.stat(filename)).size / 1024)}KB`);
    }

    // Step 8: Show albums with most assets
    console.log('\nTop 5 Albums by Asset Count:');
    const sortedAlbums = [...albums]
      .filter(a => a.getTotalMediaCount() > 0)
      .sort((a, b) => b.getTotalMediaCount() - a.getTotalMediaCount())
      .slice(0, 5);

    sortedAlbums.forEach((album, index) => {
      console.log(`  ${index + 1}. ${album.name}`);
      console.log(`     ${album.imageCount} images, ${album.videoCount} videos`);
      console.log(`     Total: ${album.getTotalMediaCount()} assets`);
    });

    console.log('\n✓ Account discovery test complete!\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('API Response:', error.response.data);
    }
  } finally {
    rl.close();
  }
}

// Run the test
testAccountDiscovery();

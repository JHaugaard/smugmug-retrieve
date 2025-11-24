/**
 * Test script for Asset Enumeration
 *
 * This script demonstrates complete asset inventory building
 *
 * Usage:
 * 1. Complete OAuth flow first (run test-oauth.js) to get access tokens
 * 2. Run: node test-enumeration.js
 * 3. Enter your credentials and tokens when prompted
 */

import SmugMugService from './src/services/SmugMugService.js';
import AccountDiscoveryService from './src/services/AccountDiscoveryService.js';
import AssetInventoryService from './src/services/AssetInventoryService.js';
import readline from 'readline';
import fs from 'fs/promises';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function testAssetEnumeration() {
  try {
    console.log('\n=== SmugMug Asset Enumeration Test ===\n');

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

    // Step 2: Ask about test mode
    const testModeInput = await question('\nTest mode (limit assets)? (y/n) [y]: ');
    const testMode = testModeInput.toLowerCase() !== 'n';

    let testLimit = 0;
    if (testMode) {
      const limitInput = await question('How many assets to process? [50]: ');
      testLimit = parseInt(limitInput) || 50;
    }

    const includeEmptyInput = await question('\nInclude empty albums? (y/n) [n]: ');
    const includeEmpty = includeEmptyInput.toLowerCase() === 'y';

    // Step 3: Initialize services
    console.log('\nInitializing services...');
    const smugmugService = new SmugMugService(apiKey, apiSecret);
    smugmugService.setAccessToken(accessToken, accessTokenSecret);

    // Step 4: Discover account structure
    console.log('\n' + '='.repeat(60));
    console.log('PHASE 1: ACCOUNT DISCOVERY');
    console.log('='.repeat(60));

    const discoveryService = new AccountDiscoveryService(smugmugService);
    const accountStructure = await discoveryService.discoverAccount(includeEmpty);

    const accountStats = accountStructure.getStats();
    console.log('\n✓ Discovery complete');
    console.log(`  Albums: ${accountStats.totalAlbums}`);
    console.log(`  Expected images: ${accountStats.totalImages}`);
    console.log(`  Expected videos: ${accountStats.totalVideos}`);

    // Step 5: Build asset inventory
    console.log('\n' + '='.repeat(60));
    console.log('PHASE 2: ASSET ENUMERATION');
    console.log('='.repeat(60));

    if (testMode) {
      console.log(`\n⚠️  TEST MODE: Limiting to ${testLimit} assets\n`);
    }

    const inventoryService = new AssetInventoryService(smugmugService, accountStructure);

    // Progress tracking
    let lastUpdate = Date.now();
    inventoryService.setProgressCallback((phase, current, total, message, details) => {
      const now = Date.now();
      if (now - lastUpdate > 2000 || current === total) { // Update every 2 seconds
        console.log(`[${phase}] ${current}/${total}: ${message}`);
        lastUpdate = now;
      }
    });

    const startTime = Date.now();
    await inventoryService.buildInventory(testLimit);
    const endTime = Date.now();

    // Step 6: Display results
    console.log('\n' + '='.repeat(60));
    console.log('ENUMERATION COMPLETE');
    console.log('='.repeat(60));

    const stats = inventoryService.getStats();
    const summary = inventoryService.getSummary();
    const assets = inventoryService.getAssets();

    console.log('\nStatistics:');
    console.log(`  Total Assets: ${stats.totalAssets}`);
    console.log(`  Images: ${stats.totalImages}`);
    console.log(`  Videos: ${stats.totalVideos}`);
    console.log(`  Total Size: ${summary.totalSize}`);
    console.log(`  Albums Processed: ${stats.processedAlbums}/${stats.totalAlbums}`);
    console.log(`  Errors: ${stats.errors.length}`);
    console.log(`  Duration: ${Math.round((endTime - startTime) / 1000)}s`);

    // Show errors if any
    if (stats.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      stats.errors.slice(0, 5).forEach(err => {
        console.log(`  - Album: ${err.album}`);
        console.log(`    Error: ${err.error}`);
      });
      if (stats.errors.length > 5) {
        console.log(`  ... and ${stats.errors.length - 5} more errors`);
      }
    }

    // Step 7: Show sample assets
    console.log('\nSample Assets (first 10):');
    assets.slice(0, 10).forEach((asset, index) => {
      console.log(`  ${index + 1}. ${asset.toString()}`);
      console.log(`     Album: ${asset.albumName}`);
      if (asset.keywords && asset.keywords.length > 0) {
        console.log(`     Keywords: ${asset.keywords.slice(0, 5).join(', ')}`);
      }
      console.log(`     Download: ${asset.getDownloadUrl()}`);
    });

    if (assets.length > 10) {
      console.log(`  ... and ${assets.length - 10} more assets`);
    }

    // Step 8: Asset breakdown by type
    const images = inventoryService.getImages();
    const videos = inventoryService.getVideos();

    console.log('\nAsset Breakdown:');
    console.log(`  Images: ${images.length} (${((images.length / assets.length) * 100).toFixed(1)}%)`);
    console.log(`  Videos: ${videos.length} (${((videos.length / assets.length) * 100).toFixed(1)}%)`);

    // Step 9: Top albums by asset count
    const albumCounts = {};
    assets.forEach(asset => {
      albumCounts[asset.albumName] = (albumCounts[asset.albumName] || 0) + 1;
    });

    const topAlbums = Object.entries(albumCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    console.log('\nTop 5 Albums by Asset Count:');
    topAlbums.forEach(([album, count], index) => {
      console.log(`  ${index + 1}. ${album}: ${count} assets`);
    });

    // Step 10: Offer to save results
    const saveInput = await question('\nSave complete inventory to JSON? (y/n) [y]: ');
    if (saveInput.toLowerCase() !== 'n') {
      const inventoryFilename = `inventory-${accountStructure.user.nickName}-${Date.now()}.json`;
      const inventoryData = inventoryService.exportInventory();

      await fs.writeFile(inventoryFilename, JSON.stringify(inventoryData, null, 2));
      console.log(`\n✓ Inventory saved to: ${inventoryFilename}`);
      console.log(`  File size: ${Math.round((await fs.stat(inventoryFilename)).size / 1024)}KB`);

      // Also save metadata manifest
      const metadataFilename = `metadata-${accountStructure.user.nickName}-${Date.now()}.json`;
      const metadataManifest = inventoryService.exportMetadata();

      await fs.writeFile(metadataFilename, JSON.stringify(metadataManifest, null, 2));
      console.log(`✓ Metadata manifest saved to: ${metadataFilename}`);
      console.log(`  File size: ${Math.round((await fs.stat(metadataFilename)).size / 1024)}KB`);
    }

    // Step 11: Show assets with GPS
    const assetsWithGPS = assets.filter(a => a.hasGPS());
    if (assetsWithGPS.length > 0) {
      console.log(`\n📍 Assets with GPS: ${assetsWithGPS.length} (${((assetsWithGPS.length / assets.length) * 100).toFixed(1)}%)`);
      console.log('Sample GPS locations:');
      assetsWithGPS.slice(0, 3).forEach(asset => {
        console.log(`  - ${asset.filename}: ${asset.gpsLatitude}, ${asset.gpsLongitude}`);
      });
    }

    // Step 12: Show keyword statistics
    const allKeywords = assets.flatMap(a => a.keywords || []);
    const uniqueKeywords = [...new Set(allKeywords)];
    console.log(`\n🏷️  Keywords: ${uniqueKeywords.length} unique keywords across ${allKeywords.length} total`);

    if (uniqueKeywords.length > 0) {
      const keywordCounts = {};
      allKeywords.forEach(kw => {
        keywordCounts[kw] = (keywordCounts[kw] || 0) + 1;
      });

      const topKeywords = Object.entries(keywordCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      console.log('Top 10 Keywords:');
      topKeywords.forEach(([kw, count]) => {
        console.log(`  - ${kw}: ${count} assets`);
      });
    }

    console.log('\n✓ Asset enumeration test complete!\n');

    if (testMode) {
      console.log('💡 Tip: Run without test mode to enumerate all assets');
    } else {
      console.log('🎉 Ready for Epic 2: Asset Download and B2 Upload!');
    }

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
testAssetEnumeration();

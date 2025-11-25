// Quick B2 test - run with: node test-b2.js <keyId> <appKey> <bucketName>
import B2 from 'backblaze-b2';

const keyId = process.argv[2];
const appKey = process.argv[3];
const bucketName = process.argv[4];

if (!keyId || !appKey || !bucketName) {
  console.log('Usage: node test-b2.js <keyId> <applicationKey> <bucketName>');
  process.exit(1);
}

console.log('Testing B2 connection...');
console.log('Key ID:', keyId.substring(0, 10) + '...');
console.log('App Key:', appKey.substring(0, 5) + '...');
console.log('Bucket:', bucketName);

const b2 = new B2({
  applicationKeyId: keyId,
  applicationKey: appKey,
});

try {
  console.log('\n1. Authorizing...');
  const authResponse = await b2.authorize();
  console.log('✓ Authorization successful');
  console.log('  API URL:', authResponse.data.apiUrl);
  console.log('  Account ID:', authResponse.data.accountId);
  console.log('  Allowed:', JSON.stringify(authResponse.data.allowed, null, 2));

  // For restricted keys, get bucketId from auth response instead of listBuckets
  const allowed = authResponse.data.allowed;
  if (allowed.bucketId && allowed.bucketName === bucketName) {
    console.log('\n2. Bucket ID from auth (restricted key):', allowed.bucketId);
    console.log('   Bucket name matches:', bucketName, '✓');

    console.log('\n3. Testing upload URL retrieval...');
    const uploadUrlResponse = await b2.getUploadUrl({ bucketId: allowed.bucketId });
    console.log('✓ Upload URL retrieved:', uploadUrlResponse.data.uploadUrl.substring(0, 50) + '...');
    console.log('\n✓ All tests passed! B2 is ready for uploads.');
  } else {
    // Fall back to listBuckets for unrestricted keys
    console.log('\n2. Listing buckets...');
    const bucketsResponse = await b2.listBuckets({ bucketName: bucketName });
    console.log('✓ Buckets retrieved:', bucketsResponse.data.buckets.length);
    bucketsResponse.data.buckets.forEach(b => {
      console.log(`  - ${b.bucketName} (${b.bucketType}) id: ${b.bucketId}`);
    });

    if (bucketsResponse.data.buckets.length > 0) {
      console.log('\n3. Testing upload URL retrieval...');
      const bucketId = bucketsResponse.data.buckets[0].bucketId;
      const uploadUrlResponse = await b2.getUploadUrl({ bucketId });
      console.log('✓ Upload URL retrieved:', uploadUrlResponse.data.uploadUrl.substring(0, 50) + '...');
      console.log('\n✓ All tests passed! B2 is ready for uploads.');
    }
  }

} catch (error) {
  console.error('\n✗ Error:', error.message);
  if (error.response) {
    console.error('  Status:', error.response.status);
    console.error('  Data:', JSON.stringify(error.response.data, null, 2));
  }
}

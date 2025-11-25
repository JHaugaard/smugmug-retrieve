#!/bin/bash
# Quick test script to trigger migration directly

curl -X POST http://localhost:3001/api/migration/start \
  -H "Content-Type: application/json" \
  -d '{
    "smugmug": {
      "apiKey": "XJCbKrt8V6zTs8QqVvSznzK4sqv7G3qh",
      "apiSecret": "'"$SMUGMUG_SECRET"'",
      "accessToken": "'"$SMUGMUG_ACCESS_TOKEN"'",
      "accessTokenSecret": "'"$SMUGMUG_ACCESS_SECRET"'"
    },
    "backblaze": {
      "accountId": "000680229fef358000000000e",
      "applicationKey": "K000KylSkMBic3v6RAUI6z2IQs6I5FA",
      "bucketName": "smugmug-retrieve-test"
    },
    "testMode": true,
    "testAssetLimit": 5
  }'

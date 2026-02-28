#!/bin/bash
# Script to sync EAS build status to production API
# Usage: ./sync_build_status.sh <build_id> <version>
# Example: ./sync_build_status.sh 52394c77-aa5d-4286-9d31-dd0988744930 1.8.0

BUILD_ID=$1
VERSION=$2
APP_TYPE="mechanic"
PROD_API="https://crmdev.wisedrive.com"

if [ -z "$BUILD_ID" ] || [ -z "$VERSION" ]; then
    echo "Usage: $0 <build_id> <version>"
    exit 1
fi

echo "=== Checking EAS build status for $BUILD_ID ==="

# Get build info from EAS
cd /app/mechanic-app-native
BUILD_INFO=$(npx eas-cli build:view $BUILD_ID --json 2>/dev/null)

if [ -z "$BUILD_INFO" ]; then
    echo "Failed to get build info from EAS"
    exit 1
fi

# Parse build status and download URL
STATUS=$(echo "$BUILD_INFO" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','').lower())" 2>/dev/null)
DOWNLOAD_URL=$(echo "$BUILD_INFO" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('artifacts',{}).get('buildUrl',''))" 2>/dev/null)

echo "Build Status: $STATUS"
echo "Download URL: $DOWNLOAD_URL"

if [ "$STATUS" = "finished" ] && [ -n "$DOWNLOAD_URL" ]; then
    echo ""
    echo "=== Updating production API ==="
    
    # Login to production
    PROD_TOKEN=$(curl -s -X POST "$PROD_API/api/auth/login" \
      -H "Content-Type: application/json" \
      -d '{"email":"kalyan@wisedrive.com","password":"password123"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null)
    
    if [ -n "$PROD_TOKEN" ]; then
        # Sync build status
        RESULT=$(curl -s -X POST "$PROD_API/api/app-releases/$APP_TYPE/sync-build" \
          -H "Authorization: Bearer $PROD_TOKEN" \
          -H "Content-Type: application/json" \
          -d "{
            \"version\": \"$VERSION\",
            \"build_id\": \"$BUILD_ID\",
            \"status\": \"$STATUS\",
            \"download_url\": \"$DOWNLOAD_URL\"
          }")
        
        echo "Result: $RESULT"
        echo ""
        echo "✅ Build synced! APK available at: $DOWNLOAD_URL"
    else
        echo "Failed to get production token"
        exit 1
    fi
elif [ "$STATUS" = "in_progress" ] || [ "$STATUS" = "pending" ]; then
    echo ""
    echo "⏳ Build still in progress. Run this script again later."
elif [ "$STATUS" = "errored" ] || [ "$STATUS" = "canceled" ]; then
    echo ""
    echo "❌ Build failed with status: $STATUS"
    exit 1
else
    echo ""
    echo "Unknown status: $STATUS"
fi

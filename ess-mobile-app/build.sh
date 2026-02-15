#!/bin/bash
# WiseDrive ESS Mobile App Build Script
# Run this script to build APK (Android) and IPA (iOS)

echo "========================================"
echo "WiseDrive ESS Mobile App Build"
echo "========================================"

cd /app/ess-mobile-app

# Step 1: Login to Expo (if not already logged in)
echo ""
echo "Step 1: Checking Expo login status..."
eas whoami 2>/dev/null || {
    echo "Please login to Expo:"
    eas login
}

# Step 2: Configure project
echo ""
echo "Step 2: Configuring EAS project..."
eas build:configure --platform all 2>/dev/null || true

# Step 3: Build Android APK
echo ""
echo "Step 3: Building Android APK..."
echo "This will take 10-20 minutes..."
eas build --platform android --profile preview --non-interactive

# Step 4: Build iOS IPA (requires Apple Developer account)
echo ""
echo "Step 4: Building iOS IPA..."
echo "Note: iOS builds require Apple Developer credentials"
eas build --platform ios --profile preview --non-interactive

echo ""
echo "========================================"
echo "Build Complete!"
echo "========================================"
echo ""
echo "Download links will be displayed above."
echo "APK can be installed directly on Android devices."
echo "IPA requires TestFlight for iOS distribution."

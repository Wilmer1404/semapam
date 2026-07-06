#!/bin/bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MANIFEST="$PROJECT_DIR/android/app/src/main/AndroidManifest.xml"
BUILD_GRADLE="$PROJECT_DIR/android/app/build.gradle"
GRADLE_PROPS="$PROJECT_DIR/android/gradle.properties"

echo "[android-setup] Configurando proyecto Android para Android 9+ (API 28)..."

if [ ! -f "$MANIFEST" ]; then
    echo "[android-setup] ERROR: AndroidManifest.xml no encontrado. Ejecuta primero: npx cap sync android"
    exit 1
fi

echo "[android-setup] Agregando permisos Bluetooth + Location en AndroidManifest..."

BLUETOOTH_PERMS=(
    'android.permission.BLUETOOTH'
    'android.permission.BLUETOOTH_ADMIN'
    'android.permission.ACCESS_FINE_LOCATION'
    'android.permission.ACCESS_COARSE_LOCATION'
)

for PERM in "${BLUETOOTH_PERMS[@]}"; do
    if ! grep -q "$PERM" "$MANIFEST"; then
        sed -i "/<uses-permission/i\\    <uses-permission android:name=\"$PERM\" android:maxSdkVersion=\"30\" />" "$MANIFEST" 2>/dev/null || \
        sed -i "/<\/manifest>/i\\    <uses-permission android:name=\"$PERM\" android:maxSdkVersion=\"30\" />" "$MANIFEST"
        echo "  + $PERM"
    fi
done

LOCATION_PERMS=(
    'android.permission.ACCESS_BACKGROUND_LOCATION'
)

for PERM in "${LOCATION_PERMS[@]}"; do
    if ! grep -q "$PERM" "$MANIFEST"; then
        sed -i "/<\/manifest>/i\\    <uses-permission android:name=\"$PERM\" />" "$MANIFEST"
        echo "  + $PERM"
    fi
done

if ! grep -q 'ACCESS_FINE_LOCATION' "$MANIFEST" 2>/dev/null; then
    sed -i 's|<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>|<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" android:maxSdkVersion="30"/>|g' "$MANIFEST"
fi

if ! grep -q 'networkSecurityConfig' "$MANIFEST" 2>/dev/null; then
    sed -i 's|<application|<application android:networkSecurityConfig="@xml/network_security_config"|' "$MANIFEST"
    echo "  + networkSecurityConfig"
fi

echo "[android-setup] Configurando gradle.properties para WebView legacy..."
if [ -f "$GRADLE_PROPS" ]; then
    if ! grep -q 'android.useAndroidX' "$GRADLE_PROPS"; then
        echo "android.useAndroidX=true" >> "$GRADLE_PROPS"
    fi
    if ! grep -q 'android.enableJetifier' "$GRADLE_PROPS"; then
        echo "android.enableJetifier=true" >> "$GRADLE_PROPS"
    fi
    echo "  + gradle.properties OK"
fi

echo "[android-setup] Completado. El proyecto esta configurado para Android 9+."

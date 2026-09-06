const fs = require('fs');
const path = require('path');

let patchedFilesCount = 0;

function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, callback);
    } else if (entry.isFile()) {
      callback(fullPath);
    }
  }
}

function patchSwiftFiles(dir) {
  walkDir(dir, (filePath) => {
    if (!filePath.endsWith('.swift')) return;
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // Fix invalid modifier order where nonisolated(unsafe) came before access modifier:
    if (content.includes('nonisolated(unsafe) internal weak var')) {
      content = content.replace(/nonisolated\(unsafe\)\s+internal\s+weak\s+var/g, 'internal nonisolated(unsafe) weak var');
      changed = true;
    }
    if (content.includes('nonisolated(unsafe) private weak var')) {
      content = content.replace(/nonisolated\(unsafe\)\s+private\s+weak\s+var/g, 'private nonisolated(unsafe) weak var');
      changed = true;
    }
    if (content.includes('nonisolated(unsafe) public weak var')) {
      content = content.replace(/nonisolated\(unsafe\)\s+public\s+weak\s+var/g, 'public nonisolated(unsafe) weak var');
      changed = true;
    }

    // Fix original weak let declarations:
    if (content.includes('weak let')) {
      // 1. nonisolated(unsafe) weak let -> nonisolated(unsafe) weak var (for local variables)
      content = content.replace(/nonisolated\(unsafe\)\s+weak\s+let\b/g, 'nonisolated(unsafe) weak var');
      
      // 2. private weak let -> private nonisolated(unsafe) weak var (access modifier first!)
      content = content.replace(/private\s+weak\s+let\b/g, 'private nonisolated(unsafe) weak var');
      
      // 3. internal weak let -> internal nonisolated(unsafe) weak var (access modifier first!)
      content = content.replace(/internal\s+weak\s+let\b/g, 'internal nonisolated(unsafe) weak var');
      
      // 4. public weak let -> public nonisolated(unsafe) weak var (access modifier first!)
      content = content.replace(/public\s+weak\s+let\b/g, 'public nonisolated(unsafe) weak var');
      
      // 5. Any remaining weak let -> nonisolated(unsafe) weak var
      content = content.replace(/\bweak\s+let\b/g, 'nonisolated(unsafe) weak var');
      changed = true;
    }

    if (changed) {
      console.log(`[patched] Swift modifier order and weak var in: ${filePath}`);
      fs.writeFileSync(filePath, content, 'utf8');
      patchedFilesCount++;
    }
  });
}

const nodeModulesDir = path.resolve(__dirname, '..', 'node_modules');

// 1. Patch Swift files in expo-modules-jsi and expo-modules-core
console.log('Searching for Swift weak let / modifier order in node_modules...');
patchSwiftFiles(path.join(nodeModulesDir, 'expo-modules-jsi'));
patchSwiftFiles(path.join(nodeModulesDir, 'expo-modules-core'));

// 2. Patch Package.swift tools version (6.2 -> 6.0 for broad Swift compiler compatibility)
const packageSwiftPath = path.join(nodeModulesDir, 'expo-modules-jsi', 'apple', 'Package.swift');
if (fs.existsSync(packageSwiftPath)) {
  let packageSwift = fs.readFileSync(packageSwiftPath, 'utf8');
  if (packageSwift.includes('swift-tools-version: 6.2')) {
    console.log(`Patching swift-tools-version to 6.0 in: ${packageSwiftPath}`);
    packageSwift = packageSwift.replace(/swift-tools-version:\s*6\.2/g, 'swift-tools-version: 6.0');
    fs.writeFileSync(packageSwiftPath, packageSwift, 'utf8');
    patchedFilesCount++;
  }
}

// 3. Patch build-xcframework.sh in expo-modules-jsi
const buildScriptPath = path.join(nodeModulesDir, 'expo-modules-jsi', 'apple', 'scripts', 'build-xcframework.sh');
if (fs.existsSync(buildScriptPath)) {
  let scriptContent = fs.readFileSync(buildScriptPath, 'utf8');
  let changed = false;

  if (scriptContent.includes('-disableAutomaticPackageResolution')) {
    console.log(`Removing -disableAutomaticPackageResolution from: ${buildScriptPath}`);
    scriptContent = scriptContent.replace(/-disableAutomaticPackageResolution \\\r?\n/g, '');
    changed = true;
  }

  if (scriptContent.includes('-quiet')) {
    console.log(`Removing -quiet from: ${buildScriptPath}`);
    scriptContent = scriptContent.replace(/-quiet \\\r?\n/g, '');
    changed = true;
  }

  // Ensure env_args carries critical environment variables into the nested xcodebuild
  const oldEnvArgs = 'local env_args=(PATH="$PATH" HOME="$HOME" PODS_ROOT="$PODS_ROOT" RN_ROOT="$RN_ROOT")';
  const newEnvArgs = 'local env_args=(PATH="$PATH" HOME="$HOME" TMPDIR="${TMPDIR:-/tmp}" USER="${USER:-runner}" LOGNAME="${LOGNAME:-runner}" CI="${CI:-1}" PODS_ROOT="$PODS_ROOT" RN_ROOT="$RN_ROOT")';
  if (scriptContent.includes(oldEnvArgs)) {
    console.log(`Enhancing env_args with TMPDIR, USER, LOGNAME in: ${buildScriptPath}`);
    scriptContent = scriptContent.replace(oldEnvArgs, newEnvArgs);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(buildScriptPath, scriptContent, 'utf8');
    patchedFilesCount++;
  }
}

console.log(`Patch completed successfully. Total files touched: ${patchedFilesCount}`);

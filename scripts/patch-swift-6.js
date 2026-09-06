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

// 1. Patch Swift files: modifier ordering and weak var
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
      content = content.replace(/nonisolated\(unsafe\)\s+weak\s+let\b/g, 'nonisolated(unsafe) weak var');
      content = content.replace(/private\s+weak\s+let\b/g, 'private nonisolated(unsafe) weak var');
      content = content.replace(/internal\s+weak\s+let\b/g, 'internal nonisolated(unsafe) weak var');
      content = content.replace(/public\s+weak\s+let\b/g, 'public nonisolated(unsafe) weak var');
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

// 2. Patch Task+immediate.swift: replace future Swift 6.2 Task.immediate / Task(name:) with clean polyfill
function patchTaskImmediate(dir) {
  walkDir(dir, (filePath) => {
    if (!filePath.endsWith('Task+immediate.swift')) return;
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('Task.immediate') || content.includes('Task(name:')) {
      console.log(`[patched] Task.immediate polyfill in: ${filePath}`);
      const cleanPolyfill = `// swift-format-ignore-file: AlwaysUseLowerCamelCase

extension Task where Failure == any Error {
  @discardableResult
  public static func immediate_polyfill(
    name: String? = nil,
    priority: TaskPriority? = nil,
    @_inheritActorContext @_implicitSelfCapture operation: sending @escaping @isolated(any) () async throws -> Success
  ) -> Task<Success, any Error> {
    return Task(priority: priority ?? .high, operation: operation)
  }
}
`;
      fs.writeFileSync(filePath, cleanPolyfill, 'utf8');
      patchedFilesCount++;
    }
  });
}

// 3. Patch JavaScriptRuntime.swift: move propNameId with consume and remove trailing commas
function patchJavaScriptRuntime(dir) {
  walkDir(dir, (filePath) => {
    if (!filePath.endsWith('JavaScriptRuntime.swift')) return;
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    if (content.includes('vector.push_back(consuming: propNameId)')) {
      console.log(`[patched] vector.push_back(consume propNameId) in: ${filePath}`);
      content = content.replace('vector.push_back(consuming: propNameId)', 'vector.push_back(consume propNameId)');
      changed = true;
    } else if (content.includes('vector.push_back(propNameId)')) {
      console.log(`[patched] vector.push_back(consume propNameId) in: ${filePath}`);
      content = content.replace('vector.push_back(propNameId)', 'vector.push_back(consume propNameId)');
      changed = true;
    }

    if (content.includes('_ arguments: consuming JavaScriptValuesBuffer,')) {
      console.log(`[patched] trailing comma in AsyncFunctionClosure in: ${filePath}`);
      content = content.replace('_ arguments: consuming JavaScriptValuesBuffer,', '_ arguments: consuming JavaScriptValuesBuffer');
      changed = true;
    }

    if (changed) {
      fs.writeFileSync(filePath, content, 'utf8');
      patchedFilesCount++;
    }
  });
}

// 4. Patch JavaScriptCodable+Date.swift: fix ambiguous abs(Double) in Swift 6 with C++ interop
function patchDateCoding(dir) {
  walkDir(dir, (filePath) => {
    if (!filePath.endsWith('JavaScriptCodable+Date.swift')) return;
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('abs(milliseconds)')) {
      console.log(`[patched] abs(milliseconds) -> milliseconds.magnitude in: ${filePath}`);
      content = content.replace('abs(milliseconds)', 'milliseconds.magnitude');
      fs.writeFileSync(filePath, content, 'utf8');
      patchedFilesCount++;
    }
  });
}

// 5. Patch RuntimeScheduler.h: add SWIFT_NAME init factories for Swift C++ reference import
function patchRuntimeScheduler(dir) {
  walkDir(dir, (filePath) => {
    if (!filePath.endsWith('RuntimeScheduler.h') || !filePath.includes('expo-modules-jsi')) return;
    let content = fs.readFileSync(filePath, 'utf8');
    if (!content.includes('SWIFT_NAME("init()")')) {
      console.log(`[patched] Adding SWIFT_NAME init factory methods in: ${filePath}`);
      const factoryMethods = `
#ifndef SWIFT_RETURNS_RETAINED
#define SWIFT_RETURNS_RETAINED __attribute__((swift_attr("returns_retained")))
#endif

  static inline SWIFT_RETURNS_RETAINED RuntimeScheduler *create(void *scheduler, ScheduleFn fn) SWIFT_NAME("init(_:_:)") {
    return new RuntimeScheduler(scheduler, fn);
  }

  static inline SWIFT_RETURNS_RETAINED RuntimeScheduler *create() SWIFT_NAME("init()") {
    return new RuntimeScheduler();
  }
`;
      content = content.replace('RuntimeScheduler(const RuntimeScheduler &) = delete;', 'RuntimeScheduler(const RuntimeScheduler &) = delete;\n' + factoryMethods);
      fs.writeFileSync(filePath, content, 'utf8');
      patchedFilesCount++;
    }
  });
}

// 6. Patch HostFunctionClosure.h: add SWIFT_NAME init factory for Swift C++ reference import (immortal reference)
function patchHostFunctionClosure(dir) {
  walkDir(dir, (filePath) => {
    if (!filePath.endsWith('HostFunctionClosure.h') || !filePath.includes('expo-modules-jsi')) return;
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // Remove SWIFT_RETURNS_UNRETAINED if present (invalid for SWIFT_IMMORTAL_REFERENCE)
    if (content.includes('SWIFT_RETURNS_UNRETAINED')) {
      content = content.replace(/#ifndef SWIFT_RETURNS_UNRETAINED[\s\S]*?#endif\r?\n/, '');
      content = content.replace(/SWIFT_RETURNS_UNRETAINED\s+/g, '');
      changed = true;
    }

    if (!content.includes('HostFunctionClosure *create')) {
      console.log(`[patched] Adding SWIFT_NAME init factory method in: ${filePath}`);
      const factoryMethod = `
  static inline HostFunctionClosure *create(Context context, Closure closure, Deallocator deallocator) SWIFT_NAME("init(_:_:_:)") {
    return new HostFunctionClosure(context, closure, deallocator);
  }
`;
      content = content.replace(/explicit HostFunctionClosure\([^)]*\)\s*:[^;]*;/, (match) => match + '\n' + factoryMethod);
      changed = true;
    }

    if (changed) {
      fs.writeFileSync(filePath, content, 'utf8');
      patchedFilesCount++;
    }
  });
}

// 7. Patch Package.swift: tools version (6.2 -> 6.0) and trailing commas
function patchPackageSwift(dir) {
  walkDir(dir, (filePath) => {
    if (!filePath.endsWith('Package.swift')) return;
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    if (content.includes('swift-tools-version: 6.2')) {
      console.log(`[patched] swift-tools-version to 6.0 in: ${filePath}`);
      content = content.replace(/swift-tools-version:\s*6\.2/g, 'swift-tools-version: 6.0');
      changed = true;
    }

    // Remove trailing commas before closing parentheses
    if (/,(\s*\))/.test(content)) {
      content = content.replace(/,(\s*\))/g, (m, p1) => p1);
      changed = true;
    }

    if (changed) {
      fs.writeFileSync(filePath, content, 'utf8');
      patchedFilesCount++;
    }
  });
}

// 8. Patch build-xcframework.sh: remove disableAutomaticPackageResolution, -quiet, and enhance env_args
function patchBuildXcframework(dir) {
  walkDir(dir, (filePath) => {
    if (!filePath.endsWith('build-xcframework.sh')) return;
    let scriptContent = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    if (scriptContent.includes('-disableAutomaticPackageResolution')) {
      console.log(`[patched] Removed -disableAutomaticPackageResolution from: ${filePath}`);
      scriptContent = scriptContent.replace(/-disableAutomaticPackageResolution \\\r?\n/g, '');
      changed = true;
    }

    if (scriptContent.includes('-quiet')) {
      console.log(`[patched] Removed -quiet from: ${filePath}`);
      scriptContent = scriptContent.replace(/-quiet \\\r?\n/g, '');
      changed = true;
    }

    const oldEnvArgs = 'local env_args=(PATH="$PATH" HOME="$HOME" PODS_ROOT="$PODS_ROOT" RN_ROOT="$RN_ROOT")';
    const newEnvArgs = 'local env_args=(PATH="$PATH" HOME="$HOME" TMPDIR="${TMPDIR:-/tmp}" USER="${USER:-runner}" LOGNAME="${LOGNAME:-runner}" CI="${CI:-1}" PODS_ROOT="$PODS_ROOT" RN_ROOT="$RN_ROOT")';
    if (scriptContent.includes(oldEnvArgs)) {
      console.log(`[patched] Enhanced env_args with TMPDIR, USER, LOGNAME in: ${filePath}`);
      scriptContent = scriptContent.replace(oldEnvArgs, newEnvArgs);
      changed = true;
    }

    if (changed) {
      fs.writeFileSync(filePath, scriptContent, 'utf8');
      patchedFilesCount++;
    }
  });
}

const nodeModulesDir = path.resolve(__dirname, '..', 'node_modules');

console.log('--- Applying Swift 6 & Xcode 16.4 compatibility patches ---');
patchSwiftFiles(nodeModulesDir);
patchTaskImmediate(nodeModulesDir);
patchJavaScriptRuntime(nodeModulesDir);
patchDateCoding(nodeModulesDir);
patchRuntimeScheduler(nodeModulesDir);
patchHostFunctionClosure(nodeModulesDir);
patchPackageSwift(nodeModulesDir);
patchBuildXcframework(nodeModulesDir);

console.log(`Patch completed successfully. Total files touched: ${patchedFilesCount}`);

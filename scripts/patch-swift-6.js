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

// 3. Patch HostObjectCallbacks.h: add C++ appendPropNameId helper so Swift doesn't touch deleted copy constructor
function patchHostObjectCallbacks(dir) {
  walkDir(dir, (filePath) => {
    if (!filePath.endsWith('HostObjectCallbacks.h') || !filePath.includes('expo-modules-jsi')) return;
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    if (!content.includes('IRuntimeCompat.h')) {
      content = content.replace('#include <jsi/jsi.h>', '#include <jsi/jsi.h>\n#include "IRuntimeCompat.h"');
      changed = true;
    }

    if (content.includes('facebook::jsi::Runtime &runtime')) {
      content = content.replace('facebook::jsi::Runtime &runtime', 'facebook::jsi::IRuntime &runtime');
      changed = true;
    }

    if (!content.includes('appendPropNameId')) {
      console.log(`[patched] Adding appendPropNameId helper in: ${filePath}`);
      const helper = `
inline void appendPropNameId(HostObjectCallbacks::PropNameIds &vector, facebook::jsi::IRuntime &runtime, const std::string &name) {
  vector.push_back(facebook::jsi::PropNameID::forUtf8(runtime, name));
}
`;
      content = content.replace('} SWIFT_NONCOPYABLE; // class HostObjectCallbacks', '} SWIFT_NONCOPYABLE; // class HostObjectCallbacks\n' + helper);
      changed = true;
    }

    if (changed) {
      fs.writeFileSync(filePath, content, 'utf8');
      patchedFilesCount++;
    }
  });
}

// 4. Patch RuntimeScheduler.h: add createRuntimeScheduler factory functions
function patchRuntimeScheduler(dir) {
  walkDir(dir, (filePath) => {
    if (!filePath.endsWith('RuntimeScheduler.h') || !filePath.includes('expo-modules-jsi')) return;
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // Clean up any inner create methods if previously injected into class body
    if (content.includes('static inline SWIFT_RETURNS_RETAINED RuntimeScheduler *create')) {
      content = content.replace(/#ifndef SWIFT_RETURNS_RETAINED[\s\S]*?static inline SWIFT_RETURNS_RETAINED RuntimeScheduler \*create\(\) SWIFT_NAME\("init\(\)"\)\s*\{\s*return new RuntimeScheduler\(\);\s*\}\s*/g, '');
      changed = true;
    }

    if (!content.includes('createRuntimeScheduler')) {
      console.log(`[patched] Adding createRuntimeScheduler helpers in: ${filePath}`);
      const factoryMethods = `
namespace expo {
#ifndef SWIFT_RETURNS_RETAINED
#define SWIFT_RETURNS_RETAINED __attribute__((swift_attr("returns_retained")))
#endif

inline SWIFT_RETURNS_RETAINED RuntimeScheduler *createRuntimeScheduler(void *scheduler, RuntimeScheduler::ScheduleFn fn) {
  return new RuntimeScheduler(scheduler, fn);
}

inline SWIFT_RETURNS_RETAINED RuntimeScheduler *createRuntimeScheduler() {
  return new RuntimeScheduler();
}
} // namespace expo
`;
      content = content.replace(/inline void releaseRuntimeScheduler\(expo::RuntimeScheduler \*scheduler\)\s*\{\s*scheduler->release\(\);\s*\}/, (match) => match + '\n' + factoryMethods);
      changed = true;
    }

    if (changed) {
      fs.writeFileSync(filePath, content, 'utf8');
      patchedFilesCount++;
    }
  });
}

// 5. Patch HostFunctionClosure.h: add createHostFunctionClosure factory function
function patchHostFunctionClosure(dir) {
  walkDir(dir, (filePath) => {
    if (!filePath.endsWith('HostFunctionClosure.h') || !filePath.includes('expo-modules-jsi')) return;
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // Clean up any inner create methods if previously injected into class body
    if (content.includes('static inline HostFunctionClosure *create(') || content.includes('SWIFT_RETURNS_UNRETAINED')) {
      content = content.replace(/#ifndef SWIFT_RETURNS_UNRETAINED[\s\S]*?#endif\r?\n/g, '');
      content = content.replace(/\s*static inline (?:SWIFT_RETURNS_UNRETAINED )?HostFunctionClosure \*create\([^)]*\)[^{]*\{[^}]*\}\s*/g, '\n');
      changed = true;
    }

    // Clean up any nested namespace expo around createHostFunctionClosure
    if (content.includes('namespace expo {\ninline HostFunctionClosure *createHostFunctionClosure')) {
      content = content.replace(/namespace expo \{\s*inline HostFunctionClosure \*createHostFunctionClosure[\s\S]*?\} \/\/ namespace expo\r?\n/g, '');
      changed = true;
    }

    if (!content.includes('createHostFunctionClosure')) {
      console.log(`[patched] Adding createHostFunctionClosure helper in: ${filePath}`);
      const factoryMethod = `
inline HostFunctionClosure *createHostFunctionClosure(HostFunctionClosure::Context context, HostFunctionClosure::Closure closure, HostFunctionClosure::Deallocator deallocator) {
  return new HostFunctionClosure(context, closure, deallocator);
}
`;
      content = content.replace('} SWIFT_IMMORTAL_REFERENCE; // class HostFunctionClosure', '} SWIFT_IMMORTAL_REFERENCE; // class HostFunctionClosure\n' + factoryMethod);
      changed = true;
    }

    if (changed) {
      fs.writeFileSync(filePath, content, 'utf8');
      patchedFilesCount++;
    }
  });
}

// 6. Patch JavaScriptRuntime.swift: wire createRuntimeScheduler, createHostFunctionClosure, and appendPropNameId
function patchJavaScriptRuntime(dir) {
  walkDir(dir, (filePath) => {
    if (!filePath.endsWith('JavaScriptRuntime.swift')) return;
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // 1. Replace self.scheduler = expo.RuntimeScheduler(...) with expo.createRuntimeScheduler(...)
    if (content.includes('self.scheduler = expo.RuntimeScheduler()')) {
      console.log(`[patched] expo.createRuntimeScheduler() in: ${filePath}`);
      content = content.replace(/self\.scheduler = expo\.RuntimeScheduler\(\)/g, 'self.scheduler = expo.createRuntimeScheduler()');
      changed = true;
    }
    if (content.includes('self.scheduler = expo.RuntimeScheduler(scheduler, fn)')) {
      console.log(`[patched] expo.createRuntimeScheduler(scheduler, fn) in: ${filePath}`);
      content = content.replace('self.scheduler = expo.RuntimeScheduler(scheduler, fn)', 'self.scheduler = expo.createRuntimeScheduler(scheduler, fn)');
      changed = true;
    }

    // 2. Replace return expo.HostFunctionClosure(...) with return expo.createHostFunctionClosure(...)
    if (content.includes('return expo.HostFunctionClosure(context, call, deallocate)')) {
      console.log(`[patched] expo.createHostFunctionClosure in: ${filePath}`);
      content = content.replace(/return expo\.HostFunctionClosure\(context, call, deallocate\)/g, 'return expo.createHostFunctionClosure(context, call, deallocate)');
      changed = true;
    }

    // 3. Replace propertyNames loop with appendPropNameId
    if (content.includes('vector.push_back')) {
      console.log(`[patched] expo.appendPropNameId in: ${filePath}`);
      const oldLoop = /for propertyName in propertyNames\s*\{[\s\S]*?vector\.push_back\([^)]*\)\s*\}/;
      const newLoop = `for propertyName in propertyNames {
        expo.appendPropNameId(&vector, runtime.pointee, std.string(propertyName))
      }`;
      content = content.replace(oldLoop, newLoop);
      changed = true;
    }

    // 4. Trailing comma in AsyncFunctionClosure
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

// 7. Patch JavaScriptCodable+Date.swift: fix ambiguous abs(Double) in Swift 6 with C++ interop
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

// 8. Patch Package.swift: tools version (6.2 -> 6.0) and trailing commas
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
patchHostObjectCallbacks(nodeModulesDir);
patchRuntimeScheduler(nodeModulesDir);
patchHostFunctionClosure(nodeModulesDir);
patchJavaScriptRuntime(nodeModulesDir);
patchDateCoding(nodeModulesDir);
patchPackageSwift(nodeModulesDir);
patchBuildXcframework(nodeModulesDir);

console.log(`Patch completed successfully. Total files touched: ${patchedFilesCount}`);

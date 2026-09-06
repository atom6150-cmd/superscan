const fs = require('fs');
const path = require('path');

console.log('--- Configuring Podfile & Xcode project for unsigned archive and source builds ---');

// 1. Patch ios/Podfile
const podfilePath = path.resolve(__dirname, '..', 'ios', 'Podfile');
if (fs.existsSync(podfilePath)) {
  let podfile = fs.readFileSync(podfilePath, 'utf8');

  // Prepend precompiled modules disable override
  const precompiledOverride = `# Force all Expo modules to build from source
begin
  require_relative '../node_modules/expo-modules-autolinking/scripts/ios/precompiled_modules'
  module Expo
    module PrecompiledModules
      def self.enabled?
        false
      end
    end
  end
rescue LoadError
end
`;

  const bypassCode = `
    installer.generated_projects.each do |project|
      project.targets.each do |target|
        target.build_configurations.each do |config|
          config.build_settings['ENABLE_USER_SCRIPT_SANDBOXING'] = 'NO'
          config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
          config.build_settings['CODE_SIGNING_REQUIRED'] = 'NO'
          config.build_settings['CODE_SIGN_IDENTITY'] = ''
          config.build_settings['SWIFT_STRICT_CONCURRENCY'] = 'minimal'
        end
      end
    end

`;

  if (!podfile.includes('module PrecompiledModules')) {
    podfile = precompiledOverride + '\n' + podfile;
  }

  if (!podfile.includes("config.build_settings['ENABLE_USER_SCRIPT_SANDBOXING'] = 'NO'")) {
    podfile = podfile.replace(/post_install do \|installer\|/, 'post_install do |installer|' + bypassCode);
  }

  fs.writeFileSync(podfilePath, podfile, 'utf8');
  console.log('[patched] ios/Podfile configured.');
} else {
  console.log('[skipped] ios/Podfile does not exist yet.');
}

// 2. Patch ios/superscan.xcodeproj/project.pbxproj
const pbxPath = path.resolve(__dirname, '..', 'ios', 'superscan.xcodeproj', 'project.pbxproj');
if (fs.existsSync(pbxPath)) {
  let pbx = fs.readFileSync(pbxPath, 'utf8');
  pbx = pbx.replace(/ENABLE_USER_SCRIPT_SANDBOXING = YES;/g, 'ENABLE_USER_SCRIPT_SANDBOXING = NO;');
  pbx = pbx.replace(/CODE_SIGN_STYLE = Automatic;/g, 'CODE_SIGN_STYLE = Manual;');
  pbx = pbx.replace(/CODE_SIGN_IDENTITY = "[^"]*";/g, 'CODE_SIGN_IDENTITY = "";');
  pbx = pbx.replace(/CODE_SIGNING_ALLOWED = YES;/g, 'CODE_SIGNING_ALLOWED = NO;');
  fs.writeFileSync(pbxPath, pbx, 'utf8');
  console.log('[patched] ios/superscan.xcodeproj/project.pbxproj configured.');
} else {
  console.log('[skipped] ios/superscan.xcodeproj/project.pbxproj does not exist yet.');
}

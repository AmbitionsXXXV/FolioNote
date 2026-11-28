Pod::Spec.new do |s|
  s.name           = 'TabMotion'
  s.version        = '1.0.0'
  s.summary        = 'Plays FolioNote tab selection motion on the native tab bar icons'
  s.author         = 'FolioNote'
  s.homepage       = 'https://github.com/AmbitionsXXXV/FolioNote'
  s.license        = 'MIT'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.swift'
end

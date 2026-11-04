Pod::Spec.new do |s|
  s.name           = 'VisualHeight'
  s.version        = '1.0.0'
  s.summary        = 'Measures an HTML visual with scripts off'
  s.description    = 'Lays out a lesson visual in an off-screen WKWebView with content JavaScript disabled and reads its height.'
  s.author         = 'learn.ninja'
  s.homepage       = 'https://learn.ninja'
  s.license        = 'Apache-2.0'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,swift}"
end

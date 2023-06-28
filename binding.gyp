{
  'variables': {
    'openssl_fips': ''
  },
  "targets": [{
    "target_name": "serial_binding",
    "sources": [
      "binding.cpp"
    ],
    "include_dirs": [
      "<!@(node -p \"require('node-addon-api').include_dir\")"
    ],
    "cflags!": ["-fno-exceptions"],
    "cflags_cc!": ["-fno-exceptions"],
    "defines": ["NAPI_CPP_EXCEPTIONS"],
    "conditions": [
      ['OS=="mac"',
        {
          'sources': [ ],
          'xcode_settings': {
            'GCC_ENABLE_CPP_EXCEPTIONS': 'YES',
            'MACOSX_DEPLOYMENT_TARGET': '10.9',
            'OTHER_CFLAGS': [
              '-arch x86_64',
              '-arch arm64'
            ],
            'OTHER_LDFLAGS': [
              '-framework CoreFoundation',
              '-framework IOKit',
              '-arch x86_64',
              '-arch arm64'
            ]
          }
        }
      ],
    ]
  }],
}

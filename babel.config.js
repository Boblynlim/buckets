module.exports = function(api) {
  // Check if we're building for web (webpack)
  const isWeb = api.caller(caller => caller && caller.name === 'babel-loader');

  if (isWeb) {
    // Web build configuration
    return {
      presets: [
        ['@babel/preset-env', {
          modules: false,
          targets: {
            browsers: ['last 2 versions', 'safari >= 11', 'ios >= 11']
          }
        }],
        '@babel/preset-react',
        '@babel/preset-typescript',
      ],
      plugins: [
        '@babel/plugin-transform-runtime',
        [
          'module:react-native-dotenv',
          {
            moduleName: '@env',
            path: '.env',
            safe: false,
            allowUndefined: true,
          },
        ],
      ],
    };
  }

  // React Native configuration
  return {
    presets: ['module:@react-native/babel-preset'],
    plugins: [
      [
        'module:react-native-dotenv',
        {
          moduleName: '@env',
          path: '.env',
          safe: false,
          allowUndefined: true,
        },
      ],
    ],
  };
};

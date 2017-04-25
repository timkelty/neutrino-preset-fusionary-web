const path = require('path');
const web = require('neutrino-preset-web');
const stylelint = require('neutrino-middleware-stylelint');
const eslint = require('neutrino-middleware-eslint');
const extractStyles = require('neutrino-middleware-extractstyles');
const ManifestPlugin = require('webpack-manifest-plugin');
const SvgSpritePlugin = require('external-svg-sprite-loader/lib/SvgStorePlugin');
const FaviconsWebpackPlugin = require('favicons-webpack-plugin');
const OptimizeCssAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const dotenv = require('dotenv').config();
const {defaultTo} = require('ramda');

module.exports = (neutrino) => {

  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';
  const devProxy = process.env.DEV_PROXY;
  const middlewareOptions = neutrino.options.fusionary || {};
  const setPathDefaults = defaultTo(true, middlewareOptions.setPathDefaults);
  const spa = defaultTo(false, middlewareOptions.spa);

  /**
   * Neutrino options
   * https://neutrino.js.org/customization/simple.html#overriding-neutrino-options
   */

  if (setPathDefaults) {
    Object.assign(neutrino.options, {
      source: './app/assets',
      output: './public/assets',
      entry: './js/index.js',
    });
  }

  /**
   * Neutrino middlewares
   * 1. https://github.com/postcss/postcss-loader#css-modules
   */

  neutrino.use(web);
  neutrino.use(stylelint);
  neutrino.use(eslint);
  neutrino.use(extractStyles, {
    loaderOptions: {
      use: [
        {
          loader: require.resolve('css-loader'),
          options: {
            sourceMap: true,
            importLoaders: 1, /* 1 */
          }
        },
        {
          loader: require.resolve('postcss-loader'),
          options: require('./config/postcss')(neutrino.options),
        },
      ],
    },
    pluginOptions: {
      filename: `[name]${isProduction ? '.[chunkhash]' : ''}.css`,
      allChunks: true,
      ignoreOrder: true,
    }
  });

  /**
   * config.*
   */

  neutrino.config.when(isDevelopment && devProxy, (config) => {
    config.devServer.proxy({
      '/': {
        target: devProxy,
        changeOrigin: true,
      }
    });
  });

  neutrino.config.entry('head')
  .add(path.join(neutrino.options.source, 'js/head.js'));

  neutrino.config.resolve
  .alias
    .set('modernizr$', path.resolve(__dirname, '.modernizr-autorc'))
    .end()
  .modules
    .add(neutrino.options.source)
    .add(path.join(neutrino.options.source, 'js'));

  /**
   * config.module.rule
   * 1. https://github.com/karify/external-svg-sprite-loader/issues/18
   */

  neutrino.config.module.rule('modernizr')
  .test(/\.modernizr-autorc$/)
  .use('modernizr')
    .when(isProduction, (config) => {
      config.loader(require.resolve('modernizr-auto-loader'));
    }, (config) => {
      config.loader(require.resolve('null-loader'));
    });

  neutrino.config.module.rule('img')
  .when(isProduction, (config) => config.use('img').loader(require.resolve('img-loader')));

  neutrino.config.module.rule('svg')
  .uses.delete('url').end() /* 1 */
  .when(isProduction, (config) => config.use('img').loader(require.resolve('img-loader')))
  .use('externalSvgSprite')
    .loader(require.resolve('external-svg-sprite-loader'))
    .options({
      name: `sprites${isProduction ? '.[hash]' : ''}.svg`
    })
    .end();

  neutrino.config.module.rule('jquery')
  .test(/^jquery$/)
  .use('jQuery')
    .loader(require.resolve('expose-loader'))
    .options('jQuery')
    .end()
  .use('$')
    .loader(require.resolve('expose-loader'))
    .options('$')
    .end();

  neutrino.config.module.rule('webfontloader')
  .test(/^webfontloader$/)
  .use('webfontloader')
    .loader(require.resolve('expose-loader'))
    .options('WebFont')
    .end();

  /**
   * config.plugin(s)
   */

  neutrino.config
  .plugins
    .when(!spa, (config) => {
      config.delete('html');
    })
    .delete('copy')
    .end()
  .when(isProduction, (config) => {
    config
    .plugin('favicons')
      .use(FaviconsWebpackPlugin, [
        require('./config/favicon')(neutrino.options)
      ])
      .end()
    .plugin('minify')
      .tap(() => [{
        removeConsole: true,
        removeDebugger: true,
      }])
      .end()
    .plugin('optimizeCss')
      .use(OptimizeCssAssetsPlugin)
      .end();
  })
  .plugin('svgSprite')
    .use(SvgSpritePlugin)
    .end()
  .plugin('manifest')
    .use(ManifestPlugin)
    .end();
};

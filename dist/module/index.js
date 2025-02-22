'use strict'

const upath = require('upath')
const ufo = require('ufo')
const fsExtra = require('fs-extra')

var name = '@nuxtjs/composition-api'
var version = '0.29.2'

function isFullStatic(options) {
  var _a
  return (
    !options.dev &&
    !options._legacyGenerate &&
    options.target === 'static' &&
    ((_a = options.render) == null ? void 0 : _a.ssr)
  )
}
function isUrl(url) {
  return ['http', '//'].some(str => url.startsWith(str))
}
function resolveRelativePath(...path) {
  return upath.resolve(__dirname, ...path)
}
function addResolvedTemplate(template, options = {}) {
  const nuxtOptions = this.nuxt.options
  const src = resolveRelativePath(`../runtime/templates/${template}`)
  const filename = template.replace('register.mjs', 'register.js')
  const { dst } = this.addTemplate({
    src,
    fileName: upath.join('composition-api', filename),
    options,
  })
  const templatePath = upath.join(nuxtOptions.buildDir, dst)
  return templatePath
}
function resolveCoreJsVersion() {
  let corejsPolyfill = this.nuxt.options.build.corejs
    ? String(this.nuxt.options.build.corejs)
    : void 0
  try {
    if (!['2', '3'].includes(corejsPolyfill || '')) {
      const corejsPkg = this.nuxt.resolver.requireModule('core-js/package.json')
      corejsPolyfill = corejsPkg.version.slice(0, 1)
    }
  } catch (e) {
    corejsPolyfill = void 0
  }
  return corejsPolyfill
}
function getNuxtGlobals() {
  const nuxtOptions = this.nuxt.options
  const globalName = nuxtOptions.globalName
  const globalContextFactory =
    nuxtOptions.globals.context ||
    (globalName2 => `__${globalName2.toUpperCase()}__`)
  const globalNuxtFactory =
    nuxtOptions.globals.nuxt || (globalName2 => `$${globalName2}`)
  const globalContext = globalContextFactory(globalName)
  const globalNuxt = globalNuxtFactory(globalName)
  return { globalContext, globalNuxt }
}

function registerBabelPlugin() {
  const nuxtOptions = this.nuxt.options
  nuxtOptions.build.babel = nuxtOptions.build.babel || {}
  nuxtOptions.build.babel.plugins = nuxtOptions.build.babel.plugins || []
  if (nuxtOptions.build.babel.plugins instanceof Function) {
    console.warn(
      'Unable to automatically add Babel plugin. Make sure your custom `build.babel.plugins` returns `@nuxtjs/composition-api/dist/babel-plugin`'
    )
  } else {
    nuxtOptions.build.babel.plugins.push(resolveRelativePath('../babel-plugin'))
  }
  const actualPresets = nuxtOptions.build.babel.presets
  nuxtOptions.build.babel.presets = (env, [defaultPreset, defaultOptions]) => {
    const newOptions = {
      ...defaultOptions,
      jsx: {
        ...(typeof defaultOptions.jsx === 'object' ? defaultOptions.jsx : {}),
        compositionAPI: true,
      },
    }
    if (typeof actualPresets === 'function') {
      return actualPresets(env, [defaultPreset, newOptions])
    }
    return [[defaultPreset, newOptions]]
  }
}

function prepareUseStatic() {
  const nuxtOptions = this.nuxt.options
  const staticPath = upath.join(nuxtOptions.buildDir, 'static-json')
  this.nuxt.hook('builder:prepared', () => {
    fsExtra.mkdirpSync(staticPath)
  })
  this.nuxt.hook('generate:route', () => {
    fsExtra.mkdirpSync(staticPath)
  })
  this.nuxt.hook('generate:done', async generator => {
    if (!fsExtra.existsSync(staticPath)) return
    const { distPath } = generator
    fsExtra
      .readdirSync(staticPath)
      .forEach(file =>
        fsExtra.copyFileSync(
          upath.join(staticPath, file),
          upath.join(distPath, file)
        )
      )
  })
  return { staticPath }
}

function addGlobalsFile() {
  const nuxtOptions = this.options
  const { staticPath } = prepareUseStatic.call(this)
  const { globalContext, globalNuxt } = getNuxtGlobals.call(this)
  const routerBase = ufo.withTrailingSlash(nuxtOptions.router.base)
  const publicPath = ufo.withTrailingSlash(nuxtOptions.build.publicPath)
  const globals = {
    isFullStatic: isFullStatic(nuxtOptions),
    staticPath,
    publicPath: isUrl(publicPath) ? publicPath : routerBase,
    globalContext,
    globalNuxt,
  }
  const contents = Object.entries(globals)
    .map(([key, value]) => `export const ${key} = ${JSON.stringify(value)}`)
    .join('\n')
  const globalsFile = addResolvedTemplate.call(this, 'globals.mjs', {
    contents,
  })
  nuxtOptions.alias['@nuxtjs/composition-api/dist/runtime/globals'] =
    globalsFile
}

const compositionApiModule = function compositionApiModule2() {
  const nuxtOptions = this.nuxt.options
  addGlobalsFile.call(this)
  const runtimeDir = upath.resolve(__dirname, 'runtime')
  nuxtOptions.build.transpile = nuxtOptions.build.transpile || []
  nuxtOptions.build.transpile.push('@nuxtjs/composition-api', runtimeDir)
  nuxtOptions.alias.vue =
    nuxtOptions.alias.vue ||
    (nuxtOptions.dev
      ? this.nuxt.resolver.resolveModule('vue/dist/vue.common.dev.js')
      : this.nuxt.resolver.resolveModule('vue/dist/vue.runtime.esm.js'))
  const capiEntrypoint = '@vue/composition-api/dist/vue-composition-api.esm.js'
  const capiResolution =
    nuxtOptions.alias['@vue/composition-api'] ||
    this.nuxt.resolver.resolveModule(capiEntrypoint)
  nuxtOptions.alias[capiEntrypoint] = capiResolution
  nuxtOptions.alias['@vue/composition-api'] = capiResolution
  nuxtOptions.alias['@nuxtjs/composition-api'] =
    nuxtOptions.alias['@nuxtjs/composition-api'] ||
    this.nuxt.resolver
      .resolveModule('@nuxtjs/composition-api')
      .replace('.js', '.mjs')
  const registration = addResolvedTemplate.call(this, 'register.mjs')
  this.nuxt.hook('webpack:config', config => {
    config.forEach(config2 => {
      const entry = config2.entry
      entry.app.unshift(registration)
    })
  })
  this.extendBuild(config => {
    if (!config.module) return
    config.module.rules.forEach(rule => {
      if (rule.test instanceof RegExp && rule.test.test('index.mjs')) {
        rule.type = 'javascript/auto'
      }
    })
  })
  const viteMiddleware = addResolvedTemplate.call(this, 'middleware.mjs')
  this.nuxt.hook('vite:extend', async ctx => {
    const { compositionApiPlugin } = await Promise.resolve().then(function () {
      return require('./index.js-vite-plugin.js')
    })
    ctx.config.plugins.push(compositionApiPlugin())
    ctx.config.resolve.alias['./middleware.js'] = viteMiddleware
  })
  registerBabelPlugin.call(this)
  addResolvedTemplate.call(this, 'polyfill.client.mjs', {
    corejsPolyfill: resolveCoreJsVersion.call(this),
  })
  const globalPlugin = addResolvedTemplate.call(this, 'plugin.mjs')
  const metaPlugin = addResolvedTemplate.call(this, 'meta.mjs')
  this.nuxt.hook('modules:done', () => {
    nuxtOptions.plugins.push(metaPlugin)
    nuxtOptions.plugins.unshift(globalPlugin)
  })
  this.addModule('unplugin-vue2-script-setup/nuxt')
}
compositionApiModule.meta = {
  name,
  version,
}

module.exports = compositionApiModule

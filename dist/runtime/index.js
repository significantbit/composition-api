'use strict'

Object.defineProperty(exports, '__esModule', { value: true })

const Vue = require('vue')
const CompositionApi = require('@vue/composition-api')
const globals = require('@nuxtjs/composition-api/dist/runtime/globals')
const defu = require('defu')
const ufo = require('ufo')

function _interopDefaultLegacy(e) {
  return e && typeof e === 'object' && 'default' in e ? e : { default: e }
}

const Vue__default = /*#__PURE__*/ _interopDefaultLegacy(Vue)
const CompositionApi__default =
  /*#__PURE__*/ _interopDefaultLegacy(CompositionApi)
const defu__default = /*#__PURE__*/ _interopDefaultLegacy(defu)

function validateKey(key) {
  if (!key) {
    throw new Error(
      "You must provide a key. You can have it generated automatically by adding '@nuxtjs/composition-api/dist/babel-plugin' to your Babel plugins."
    )
  }
}
function getCurrentInstance() {
  const vm = CompositionApi.getCurrentInstance()
  if (!vm) return
  return vm.proxy
}

function getValue(value) {
  if (value instanceof Function) return value()
  return value
}
let globalRefs = {}
function setSSRContext(app) {
  globalRefs = Object.assign({}, {})
  app.context.ssrContext.nuxt.globalRefs = globalRefs
}
const useServerData = () => {
  const vm = getCurrentInstance()
  const type = vm ? 'ssrRefs' : 'globalRefs'
  let ssrRefs
  if (vm && process.server) {
    const ssrContext = (vm[globals.globalNuxt] || vm.$options).context
      .ssrContext
    ssrRefs = ssrContext.nuxt.ssrRefs = ssrContext.nuxt.ssrRefs || {}
  }
  const setData = (key, val) => {
    const refs = ssrRefs || globalRefs
    refs[key] = sanitise(val)
  }
  return { type, setData }
}
const isProxyable = val => !!val && typeof val === 'object'
const sanitise = val => (val && JSON.parse(JSON.stringify(val))) || val
const ssrValue = (value, key, type = 'globalRefs') => {
  var _a, _b, _c, _d
  if (process.client) {
    if (
      process.env.NODE_ENV === 'development' &&
      ((_a = window[globals.globalNuxt]) == null ? void 0 : _a.context.isHMR)
    ) {
      return getValue(value)
    }
    return (_d =
      (_c = (_b = window[globals.globalContext]) == null ? void 0 : _b[type]) ==
      null
        ? void 0
        : _c[key]) != null
      ? _d
      : getValue(value)
  }
  return getValue(value)
}
const ssrRef = (value, key) => {
  validateKey(key)
  const { type, setData } = useServerData()
  let val = ssrValue(value, key, type)
  if (process.client) return CompositionApi.ref(val)
  if (value instanceof Function) setData(key, val)
  const getProxy = (track, trigger, observable) =>
    new Proxy(observable, {
      get(target, prop) {
        track()
        if (isProxyable(target[prop]))
          return getProxy(track, trigger, target[prop])
        return Reflect.get(target, prop)
      },
      set(obj, prop, newVal) {
        const result = Reflect.set(obj, prop, newVal)
        setData(key, val)
        trigger()
        return result
      },
    })
  const proxy = CompositionApi.customRef((track, trigger) => ({
    get: () => {
      track()
      if (isProxyable(val)) return getProxy(track, trigger, val)
      return val
    },
    set: v => {
      setData(key, v)
      val = v
      trigger()
    },
  }))
  return proxy
}
const shallowSsrRef = (value, key) => {
  validateKey(key)
  const { type, setData } = useServerData()
  if (process.client)
    return CompositionApi.shallowRef(ssrValue(value, key, type))
  const _val = getValue(value)
  if (value instanceof Function) {
    setData(key, _val)
  }
  return CompositionApi.customRef((track, trigger) => ({
    get() {
      track()
      return _val
    },
    set(newValue) {
      setData(key, newValue)
      value = newValue
      trigger()
    },
  }))
}
const ssrPromise = (value, key) => {
  validateKey(key)
  const { type, setData } = useServerData()
  const val = ssrValue(value, key, type)
  if (process.client) return Promise.resolve(val)
  CompositionApi.onServerPrefetch(async () => {
    setData(key, await val)
  })
  return val
}

const useAsync = (cb, key) => {
  var _a
  validateKey(key)
  const _ref = CompositionApi.isRef(key) ? key : ssrRef(null, key)
  if (
    !_ref.value ||
    (process.env.NODE_ENV === 'development' &&
      process.client &&
      ((_a = window[globals.globalNuxt]) == null ? void 0 : _a.context.isHMR))
  ) {
    const p = Promise.resolve(cb())
    if (process.server) {
      CompositionApi.onServerPrefetch(async () => {
        _ref.value = await p
      })
    } else {
      p.then(res => (_ref.value = res))
    }
  }
  return _ref
}

function createEmptyMeta() {
  return {
    titleTemplate: null,
    __dangerouslyDisableSanitizers: [],
    __dangerouslyDisableSanitizersByTagID: {},
    title: void 0,
    htmlAttrs: {},
    headAttrs: {},
    bodyAttrs: {},
    base: void 0,
    meta: [],
    link: [],
    style: [],
    script: [],
    noscript: [],
    changed: void 0,
    afterNavigation: void 0,
  }
}
const getHeadOptions = options => {
  const head = function () {
    const optionHead =
      options.head instanceof Function ? options.head.call(this) : options.head
    if (!this._computedHead) return optionHead
    const computedHead = this._computedHead.map(h => {
      if (CompositionApi.isReactive(h)) return CompositionApi.toRaw(h)
      if (CompositionApi.isRef(h)) return h.value
      return h
    })
    return defu__default['default']({}, ...computedHead.reverse(), optionHead)
  }
  return { head }
}
const useMeta = init => {
  const vm = getCurrentInstance()
  if (!vm) throw new Error('useMeta must be called within a component.')
  if (!('head' in vm.$options))
    throw new Error(
      'In order to enable `useMeta`, please make sure you include `head: {}` within your component definition, and you are using the `defineComponent` exported from @nuxtjs/composition-api.'
    )
  const refreshMeta = () => vm.$meta().refresh()
  if (!vm._computedHead) {
    const metaRefs = CompositionApi.reactive(createEmptyMeta())
    vm._computedHead = [metaRefs]
    vm._metaRefs = CompositionApi.toRefs(metaRefs)
    if (process.client) {
      CompositionApi.watch(Object.values(vm._metaRefs), refreshMeta, {
        immediate: true,
      })
    }
  }
  if (init) {
    const initRef =
      init instanceof Function
        ? CompositionApi.computed(init)
        : CompositionApi.ref(init)
    vm._computedHead.push(initRef)
    if (process.client) {
      CompositionApi.watch(initRef, refreshMeta, { immediate: true })
    }
  }
  return vm._metaRefs
}

const defineComponent = options => {
  if (!('head' in options)) return options
  return {
    ...options,
    ...getHeadOptions(options),
  }
}

const withContext = callback => {
  const vm = getCurrentInstance()
  if (!vm) throw new Error('This must be called within a setup function.')
  callback((vm[globals.globalNuxt] || vm.$options).context)
}
const useContext = () => {
  const vm = getCurrentInstance()
  if (!vm) throw new Error('This must be called within a setup function.')
  return {
    ...(vm[globals.globalNuxt] || vm.$options).context,
    route: CompositionApi.computed(() => vm.$route),
    query: CompositionApi.computed(() => vm.$route.query),
    from: CompositionApi.computed(
      () => (vm[globals.globalNuxt] || vm.$options).context.from
    ),
    params: CompositionApi.computed(() => vm.$route.params),
  }
}

const defineNuxtPlugin = plugin => plugin
const defineNuxtMiddleware = middleware => middleware

const nuxtState = process.client && window[globals.globalContext]
function normalizeError(err) {
  let message
  if (!(err.message || typeof err === 'string')) {
    try {
      message = JSON.stringify(err, null, 2)
    } catch (e) {
      message = `[${err.constructor.name}]`
    }
  } else {
    message = err.message || err
  }
  return {
    ...err,
    message,
    statusCode:
      err.statusCode ||
      err.status ||
      (err.response && err.response.status) ||
      500,
  }
}
function createGetCounter(counterObject, defaultKey = '') {
  return function getCounter(id = defaultKey) {
    if (counterObject[id] === void 0) {
      counterObject[id] = 0
    }
    return counterObject[id]++
  }
}
const fetches = new WeakMap()
const fetchPromises = new Map()
const isSsrHydration = vm => {
  var _a, _b, _c
  return (_c =
    (_b = (_a = vm.$vnode) == null ? void 0 : _a.elm) == null
      ? void 0
      : _b.dataset) == null
    ? void 0
    : _c.fetchKey
}
function registerCallback(vm, callback) {
  const callbacks = fetches.get(vm) || []
  fetches.set(vm, [...callbacks, callback])
}
async function callFetches() {
  const fetchesToCall = fetches.get(this)
  if (!fetchesToCall) return
  this[globals.globalNuxt].nbFetching++
  this.$fetchState.pending = true
  this.$fetchState.error = null
  this._hydrated = false
  let error = null
  const startTime = Date.now()
  try {
    await Promise.all(
      fetchesToCall.map(fetch => {
        if (fetchPromises.has(fetch)) return fetchPromises.get(fetch)
        const promise = Promise.resolve(fetch(this)).finally(() =>
          fetchPromises.delete(fetch)
        )
        fetchPromises.set(fetch, promise)
        return promise
      })
    )
  } catch (err) {
    if (process.dev) {
      console.error('Error in fetch():', err)
    }
    error = normalizeError(err)
  }
  const delayLeft = (this._fetchDelay || 0) - (Date.now() - startTime)
  if (delayLeft > 0) {
    await new Promise(resolve => setTimeout(resolve, delayLeft))
  }
  this.$fetchState.error = error
  this.$fetchState.pending = false
  this.$fetchState.timestamp = Date.now()
  this.$nextTick(() => this[globals.globalNuxt].nbFetching--)
}
const setFetchState = vm => {
  vm.$fetchState =
    vm.$fetchState ||
    CompositionApi.reactive({
      error: null,
      pending: false,
      timestamp: 0,
    })
}
const mergeDataOnMount = data => {
  const vm = getCurrentInstance()
  if (!vm) throw new Error('This must be called within a setup function.')
  CompositionApi.onBeforeMount(() => {
    for (const key in data) {
      try {
        if (key in vm) {
          const _key = key
          if (typeof vm[_key] === 'function') continue
          if (CompositionApi.isReactive(vm[_key])) {
            for (const k in vm[_key]) {
              if (!(k in data[key])) {
                delete vm[_key][k]
              }
            }
            Object.assign(vm[_key], data[key])
            continue
          }
        }
        CompositionApi.set(vm, key, data[key])
      } catch (e) {
        if (process.env.NODE_ENV === 'development')
          console.warn(`Could not hydrate ${key}.`)
      }
    }
  })
}
const loadFullStatic = vm => {
  vm._fetchKey = getKey(vm)
  const { fetchOnServer } = vm.$options
  const fetchedOnServer =
    typeof fetchOnServer === 'function'
      ? fetchOnServer.call(vm) !== false
      : fetchOnServer !== false
  const nuxt = vm[globals.globalNuxt]
  if (
    !fetchedOnServer ||
    (nuxt == null ? void 0 : nuxt.isPreview) ||
    !(nuxt == null ? void 0 : nuxt._pagePayload)
  ) {
    return
  }
  vm._hydrated = true
  const data = nuxt._pagePayload.fetch[vm._fetchKey]
  if (data && data._error) {
    vm.$fetchState.error = data._error
    return
  }
  mergeDataOnMount(data)
}
async function serverPrefetch(vm) {
  if (!vm._fetchOnServer) return
  setFetchState(vm)
  try {
    await callFetches.call(vm)
  } catch (err) {
    if (process.dev) {
      console.error('Error in fetch():', err)
    }
    vm.$fetchState.error = normalizeError(err)
  }
  vm.$fetchState.pending = false
  vm._fetchKey =
    'push' in vm.$ssrContext.nuxt.fetch
      ? vm.$ssrContext.nuxt.fetch.length
      : vm._fetchKey || vm.$ssrContext.fetchCounters['']++
  if (!vm.$vnode.data) vm.$vnode.data = {}
  const attrs = (vm.$vnode.data.attrs = vm.$vnode.data.attrs || {})
  attrs['data-fetch-key'] = vm._fetchKey
  const data = { ...vm._data }
  Object.entries(vm.__composition_api_state__.rawBindings).forEach(
    ([key, val]) => {
      if (val instanceof Function || val instanceof Promise) return
      data[key] = CompositionApi.isRef(val) ? val.value : val
    }
  )
  const content = vm.$fetchState.error
    ? { _error: vm.$fetchState.error }
    : JSON.parse(JSON.stringify(data))
  if ('push' in vm.$ssrContext.nuxt.fetch) {
    vm.$ssrContext.nuxt.fetch.push(content)
  } else {
    vm.$ssrContext.nuxt.fetch[vm._fetchKey] = content
  }
}
function getKey(vm) {
  const nuxtState2 = vm[globals.globalNuxt]
  if (process.server && 'push' in vm.$ssrContext.nuxt.fetch) {
    return void 0
  } else if (process.client && '_payloadFetchIndex' in nuxtState2) {
    nuxtState2._payloadFetchIndex = nuxtState2._payloadFetchIndex || 0
    return nuxtState2._payloadFetchIndex++
  }
  const defaultKey = vm.$options._scopeId || vm.$options.name || ''
  const getCounter = createGetCounter(
    process.server
      ? vm.$ssrContext.fetchCounters
      : vm[globals.globalNuxt]._fetchCounters,
    defaultKey
  )
  const options = vm.$options
  if (typeof options.fetchKey === 'function') {
    return options.fetchKey.call(vm, getCounter)
  } else {
    const key =
      typeof options.fetchKey === 'string' ? options.fetchKey : defaultKey
    return key ? key + ':' + getCounter(key) : String(getCounter(key))
  }
}
const useFetch = callback => {
  var _a
  const vm = getCurrentInstance()
  if (!vm) throw new Error('This must be called within a setup function.')
  registerCallback(vm, callback)
  if (typeof vm.$options.fetchOnServer === 'function') {
    vm._fetchOnServer = vm.$options.fetchOnServer.call(vm) !== false
  } else {
    vm._fetchOnServer = vm.$options.fetchOnServer !== false
  }
  if (process.server) {
    vm._fetchKey = getKey(vm)
  }
  setFetchState(vm)
  CompositionApi.onServerPrefetch(() => serverPrefetch(vm))
  function result() {
    return {
      fetch: vm.$fetch,
      fetchState: vm.$fetchState,
      $fetch: vm.$fetch,
      $fetchState: vm.$fetchState,
    }
  }
  vm._fetchDelay =
    typeof vm.$options.fetchDelay === 'number' ? vm.$options.fetchDelay : 0
  vm.$fetch = callFetches.bind(vm)
  CompositionApi.onBeforeMount(() => !vm._hydrated && callFetches.call(vm))
  if (process.server || !isSsrHydration(vm)) {
    if (process.client && globals.isFullStatic) loadFullStatic(vm)
    return result()
  }
  vm._hydrated = true
  vm._fetchKey =
    ((_a = vm.$vnode.elm) == null ? void 0 : _a.dataset.fetchKey) || getKey(vm)
  const data = nuxtState.fetch[vm._fetchKey]
  if (data && data._error) {
    vm.$fetchState.error = data._error
    return result()
  }
  mergeDataOnMount(data)
  return result()
}

const reqRefs = new Set()
const reqRef = initialValue => {
  const _ref = CompositionApi.ref(initialValue)
  if (process.server) reqRefs.add(() => (_ref.value = initialValue))
  return _ref
}
const reqSsrRef = (initialValue, key) => {
  const _ref = ssrRef(initialValue, key)
  if (process.server)
    reqRefs.add(() => {
      _ref.value =
        initialValue instanceof Function
          ? sanitise(initialValue())
          : initialValue
    })
  return _ref
}

let globalSetup
const onGlobalSetup = fn => {
  globalSetup.add(fn)
}
const setMetaPlugin = context => {
  const { head } = context.app
  Object.assign(context.app, getHeadOptions({ head }))
}
const globalPlugin = context => {
  if (process.server) {
    reqRefs.forEach(reset => reset())
    setSSRContext(context.app)
  }
  const { setup } = context.app
  globalSetup = new Set()
  context.app.setup = function (...args) {
    let result = {}
    if (setup instanceof Function) {
      result = setup(...args) || {}
    }
    for (const fn of globalSetup) {
      result = { ...result, ...(fn.call(this, ...args) || {}) }
    }
    return result
  }
}

const staticCache = {}
function writeFile(key, value) {
  if (process.client || !process.static) return
  const { writeFileSync } = process.client ? '' : require('fs')
  const { join } = process.client ? '' : require('upath')
  try {
    writeFileSync(join(globals.staticPath, `${key}.json`), value)
  } catch (e) {
    console.log(e)
  }
}
const useStatic = (factory, param = CompositionApi.ref(''), keyBase) => {
  var _a, _b
  const key = CompositionApi.computed(
    () => `${keyBase}-${param.value.replace(/[^a-z0-9]/gi, '_')}`
  )
  const result = ssrRef(null, key.value)
  if (result.value) staticCache[key.value] = result.value
  if (process.client) {
    const publicPath =
      ((_b =
        (_a = window[globals.globalContext].$config) == null
          ? void 0
          : _a.app) == null
        ? void 0
        : _b.cdnURL) || globals.publicPath
    const onFailure = () =>
      factory(param.value, key.value).then(r => {
        staticCache[key.value] = r
        result.value = r
        return
      })
    CompositionApi.watch(
      key,
      key2 => {
        if (key2 in staticCache) {
          result.value = staticCache[key2]
          return
        }
        if (!process.static) onFailure()
        else
          fetch(ufo.joinURL(publicPath, `${key2}.json`))
            .then(response => {
              if (!response.ok) throw new Error('Response invalid.')
              return response.json()
            })
            .then(json => {
              staticCache[key2] = json
              result.value = json
            })
            .catch(onFailure)
      },
      {
        immediate: true,
      }
    )
  } else {
    if (key.value in staticCache) {
      result.value = staticCache[key.value]
      return result
    }
    CompositionApi.onServerPrefetch(async () => {
      const [_key, _param] = [key.value, param.value]
      result.value = await factory(_param, _key)
      staticCache[_key] = result.value
      writeFile(_key, JSON.stringify(result.value))
    })
  }
  return result
}

const wrapProperty = (property, makeComputed) => {
  return () => {
    const vm = getCurrentInstance()
    if (!vm) throw new Error('This must be called within a setup function.')
    return makeComputed !== false
      ? CompositionApi.computed(() => vm[property])
      : vm[property]
  }
}
const useRouter = wrapProperty('$router', false)
const useRoute = wrapProperty('$route')
const useStore = key => {
  const vm = getCurrentInstance()
  if (!vm) throw new Error('This must be called within a setup function.')
  return vm.$store
}

if (process.env.NODE_ENV === 'test') {
  Vue__default['default'].use(CompositionApi__default['default'])
}

Object.defineProperty(exports, 'computed', {
  enumerable: true,
  get: function () {
    return CompositionApi.computed
  },
})
Object.defineProperty(exports, 'createApp', {
  enumerable: true,
  get: function () {
    return CompositionApi.createApp
  },
})
Object.defineProperty(exports, 'createRef', {
  enumerable: true,
  get: function () {
    return CompositionApi.createRef
  },
})
Object.defineProperty(exports, 'customRef', {
  enumerable: true,
  get: function () {
    return CompositionApi.customRef
  },
})
Object.defineProperty(exports, 'defineAsyncComponent', {
  enumerable: true,
  get: function () {
    return CompositionApi.defineAsyncComponent
  },
})
Object.defineProperty(exports, 'del', {
  enumerable: true,
  get: function () {
    return CompositionApi.del
  },
})
Object.defineProperty(exports, 'effectScope', {
  enumerable: true,
  get: function () {
    return CompositionApi.effectScope
  },
})
Object.defineProperty(exports, 'getCurrentInstance', {
  enumerable: true,
  get: function () {
    return CompositionApi.getCurrentInstance
  },
})
Object.defineProperty(exports, 'getCurrentScope', {
  enumerable: true,
  get: function () {
    return CompositionApi.getCurrentScope
  },
})
Object.defineProperty(exports, 'h', {
  enumerable: true,
  get: function () {
    return CompositionApi.h
  },
})
Object.defineProperty(exports, 'inject', {
  enumerable: true,
  get: function () {
    return CompositionApi.inject
  },
})
Object.defineProperty(exports, 'isRaw', {
  enumerable: true,
  get: function () {
    return CompositionApi.isRaw
  },
})
Object.defineProperty(exports, 'isReactive', {
  enumerable: true,
  get: function () {
    return CompositionApi.isReactive
  },
})
Object.defineProperty(exports, 'isReadonly', {
  enumerable: true,
  get: function () {
    return CompositionApi.isReadonly
  },
})
Object.defineProperty(exports, 'isRef', {
  enumerable: true,
  get: function () {
    return CompositionApi.isRef
  },
})
Object.defineProperty(exports, 'markRaw', {
  enumerable: true,
  get: function () {
    return CompositionApi.markRaw
  },
})
Object.defineProperty(exports, 'nextTick', {
  enumerable: true,
  get: function () {
    return CompositionApi.nextTick
  },
})
Object.defineProperty(exports, 'onActivated', {
  enumerable: true,
  get: function () {
    return CompositionApi.onActivated
  },
})
Object.defineProperty(exports, 'onBeforeMount', {
  enumerable: true,
  get: function () {
    return CompositionApi.onBeforeMount
  },
})
Object.defineProperty(exports, 'onBeforeUnmount', {
  enumerable: true,
  get: function () {
    return CompositionApi.onBeforeUnmount
  },
})
Object.defineProperty(exports, 'onBeforeUpdate', {
  enumerable: true,
  get: function () {
    return CompositionApi.onBeforeUpdate
  },
})
Object.defineProperty(exports, 'onDeactivated', {
  enumerable: true,
  get: function () {
    return CompositionApi.onDeactivated
  },
})
Object.defineProperty(exports, 'onErrorCaptured', {
  enumerable: true,
  get: function () {
    return CompositionApi.onErrorCaptured
  },
})
Object.defineProperty(exports, 'onMounted', {
  enumerable: true,
  get: function () {
    return CompositionApi.onMounted
  },
})
Object.defineProperty(exports, 'onScopeDispose', {
  enumerable: true,
  get: function () {
    return CompositionApi.onScopeDispose
  },
})
Object.defineProperty(exports, 'onServerPrefetch', {
  enumerable: true,
  get: function () {
    return CompositionApi.onServerPrefetch
  },
})
Object.defineProperty(exports, 'onUnmounted', {
  enumerable: true,
  get: function () {
    return CompositionApi.onUnmounted
  },
})
Object.defineProperty(exports, 'onUpdated', {
  enumerable: true,
  get: function () {
    return CompositionApi.onUpdated
  },
})
Object.defineProperty(exports, 'provide', {
  enumerable: true,
  get: function () {
    return CompositionApi.provide
  },
})
Object.defineProperty(exports, 'proxyRefs', {
  enumerable: true,
  get: function () {
    return CompositionApi.proxyRefs
  },
})
Object.defineProperty(exports, 'reactive', {
  enumerable: true,
  get: function () {
    return CompositionApi.reactive
  },
})
Object.defineProperty(exports, 'readonly', {
  enumerable: true,
  get: function () {
    return CompositionApi.readonly
  },
})
Object.defineProperty(exports, 'ref', {
  enumerable: true,
  get: function () {
    return CompositionApi.ref
  },
})
Object.defineProperty(exports, 'set', {
  enumerable: true,
  get: function () {
    return CompositionApi.set
  },
})
Object.defineProperty(exports, 'shallowReactive', {
  enumerable: true,
  get: function () {
    return CompositionApi.shallowReactive
  },
})
Object.defineProperty(exports, 'shallowReadonly', {
  enumerable: true,
  get: function () {
    return CompositionApi.shallowReadonly
  },
})
Object.defineProperty(exports, 'shallowRef', {
  enumerable: true,
  get: function () {
    return CompositionApi.shallowRef
  },
})
Object.defineProperty(exports, 'toRaw', {
  enumerable: true,
  get: function () {
    return CompositionApi.toRaw
  },
})
Object.defineProperty(exports, 'toRef', {
  enumerable: true,
  get: function () {
    return CompositionApi.toRef
  },
})
Object.defineProperty(exports, 'toRefs', {
  enumerable: true,
  get: function () {
    return CompositionApi.toRefs
  },
})
Object.defineProperty(exports, 'triggerRef', {
  enumerable: true,
  get: function () {
    return CompositionApi.triggerRef
  },
})
Object.defineProperty(exports, 'unref', {
  enumerable: true,
  get: function () {
    return CompositionApi.unref
  },
})
Object.defineProperty(exports, 'useAttrs', {
  enumerable: true,
  get: function () {
    return CompositionApi.useAttrs
  },
})
Object.defineProperty(exports, 'useCSSModule', {
  enumerable: true,
  get: function () {
    return CompositionApi.useCSSModule
  },
})
Object.defineProperty(exports, 'useCssModule', {
  enumerable: true,
  get: function () {
    return CompositionApi.useCssModule
  },
})
Object.defineProperty(exports, 'useSlots', {
  enumerable: true,
  get: function () {
    return CompositionApi.useSlots
  },
})
Object.defineProperty(exports, 'version', {
  enumerable: true,
  get: function () {
    return CompositionApi.version
  },
})
Object.defineProperty(exports, 'warn', {
  enumerable: true,
  get: function () {
    return CompositionApi.warn
  },
})
Object.defineProperty(exports, 'watch', {
  enumerable: true,
  get: function () {
    return CompositionApi.watch
  },
})
Object.defineProperty(exports, 'watchEffect', {
  enumerable: true,
  get: function () {
    return CompositionApi.watchEffect
  },
})
Object.defineProperty(exports, 'watchPostEffect', {
  enumerable: true,
  get: function () {
    return CompositionApi.watchPostEffect
  },
})
Object.defineProperty(exports, 'watchSyncEffect', {
  enumerable: true,
  get: function () {
    return CompositionApi.watchSyncEffect
  },
})
exports.defineComponent = defineComponent
exports.defineNuxtMiddleware = defineNuxtMiddleware
exports.defineNuxtPlugin = defineNuxtPlugin
exports.globalPlugin = globalPlugin
exports.onGlobalSetup = onGlobalSetup
exports.reqRef = reqRef
exports.reqSsrRef = reqSsrRef
exports.setMetaPlugin = setMetaPlugin
exports.setSSRContext = setSSRContext
exports.shallowSsrRef = shallowSsrRef
exports.ssrPromise = ssrPromise
exports.ssrRef = ssrRef
exports.useAsync = useAsync
exports.useContext = useContext
exports.useFetch = useFetch
exports.useMeta = useMeta
exports.useRoute = useRoute
exports.useRouter = useRouter
exports.useStatic = useStatic
exports.useStore = useStore
exports.withContext = withContext
exports.wrapProperty = wrapProperty

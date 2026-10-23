'use strict'

const assert = require('assert')

const REQUESTS = 96
const UPSTREAM_LIMIT = 32

let active = 0
let maximumActive = 0
const observedTimeouts = []

class CapacityLimitedXHR {
  open(_method, url) {
    this.url = url
  }

  send() {
    observedTimeouts.push(this.timeout)
    active += 1
    maximumActive = Math.max(maximumActive, active)
    const rejectedByUpstream = active > UPSTREAM_LIMIT
    setTimeout(() => {
      active -= 1
      this.readyState = 4
      this.status = rejectedByUpstream ? 0 : 200
      this.statusText = rejectedByUpstream ? 'connection dropped' : 'OK'
      this.response = rejectedByUpstream ? null : new ArrayBuffer(1)
      this.onreadystatechange?.()
    }, 1)
  }

  abort() {}
}

global.XMLHttpRequest = CapacityLimitedXHR

const { retrieveData } = require('../build/data.js')

Promise.all(
  Array.from({ length: REQUESTS }, (_, index) => {
    const output = { data: null, loaded: false, error: false }
    return retrieveData(
      output,
      `/runtime/edit/large-map/block/chunk-${index}`,
      0,
      5000,
    )
  }),
).then(() => {
  assert.ok(
    maximumActive <= UPSTREAM_LIMIT,
    `local runtime opened ${maximumActive} requests concurrently`,
  )
  assert.ok(
    observedTimeouts.every((timeout) => timeout >= 31 * 60 * 1000),
    'local runtime requests must outlive the runtime startup window',
  )
  console.log(
    `local runtime request concurrency is bounded: max=${maximumActive}`,
  )
}).catch((error) => {
  console.error(error)
  process.exitCode = 1
})

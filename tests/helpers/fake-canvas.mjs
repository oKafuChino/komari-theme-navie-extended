export function createFakeCanvas({ contextAvailable = true, throwOnFill = false } = {}) {
  const calls = { clearRect: 0, fill: 0, remove: 0, setTransform: 0 }
  const context = {
    beginPath() {},
    bezierCurveTo() {},
    clearRect() { calls.clearRect++ },
    closePath() {},
    fill() {
      calls.fill++
      if (throwOnFill)
        throw new Error('draw failed')
    },
    lineTo() {},
    moveTo() {},
    restore() {},
    rotate() {},
    save() {},
    scale() {},
    setTransform() { calls.setTransform++ },
    translate() {},
    fillStyle: '',
    globalAlpha: 1,
    shadowBlur: 0,
    shadowColor: '',
  }
  const canvas = {
    width: 0,
    height: 0,
    style: {},
    getContext: () => contextAvailable ? context : null,
    remove() { calls.remove++ },
  }
  return { calls, canvas, context }
}

export function createFrameHarness() {
  let callback = null
  let nextId = 1
  return {
    requestFrame(value) {
      callback = value
      return nextId++
    },
    cancelFrame() {
      callback = null
    },
    hasPending() {
      return callback !== null
    },
    step(time) {
      const current = callback
      callback = null
      if (!current)
        throw new Error('No animation frame is pending')
      current(time)
    },
  }
}

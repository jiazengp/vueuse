import type { MockInstance } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'
import {
  createSingletonPromise,
  increaseWithUnit,
  objectOmit,
  objectPick,
  promiseTimeout,
} from './general'
import {
  assert,
  clamp,
  createFilterWrapper,
  debounceFilter,
  hasOwn,
  isClient,
  isDef,
  isIOS,
  isObject,
  noop,
  now,
  rand,
  throttleFilter,
  timestamp,
} from './index'

describe('utils', () => {
  it('increaseWithUnit', () => {
    expect(increaseWithUnit(100, 1)).toEqual(101)
    expect(increaseWithUnit('1px', 1)).toEqual('2px')
    expect(increaseWithUnit('-1em', 1)).toEqual('0em')
    expect(increaseWithUnit('1em', -1)).toEqual('0em')
    expect(increaseWithUnit('1em', -5)).toEqual('-4em')
    expect(increaseWithUnit('0.5vw', 1.5)).toEqual('2vw')
    expect(increaseWithUnit('100 %', 10)).toEqual('110 %')
    expect(increaseWithUnit('var(--cool)', -5)).toEqual('var(--cool)')
  })

  it('objectPick', () => {
    expect(objectPick({ a: 1, b: 2, c: 3 }, ['a', 'b'])).toEqual({ a: 1, b: 2 })
    expect(objectPick({ a: 1, b: 2, c: undefined }, ['a', 'b'], true)).toEqual({ a: 1, b: 2 })
  })

  it('objectOmit', () => {
    const obj = { a: 1, b: 2, c: 3 }

    expect(objectOmit(obj, ['a', 'b'])).toEqual({ c: 3 })
    expect(obj).toEqual({ a: 1, b: 2, c: 3 })
    expect(objectOmit({ a: 1, b: 2, c: undefined }, ['a', 'b'], true)).toEqual({})
    expect(objectOmit({ a: 1, b: 2, c: undefined }, ['b', 'c'], true)).toEqual({ a: 1 })
  })
})

describe('promise', () => {
  it('should promiseTimeout work', async () => {
    const num = shallowRef(0)
    setTimeout(() => {
      num.value = 1
    }, 100)

    await promiseTimeout(100)

    expect(num.value).toBe(1)
  })

  it('should promiseTimeout throw timeout', async () => {
    await promiseTimeout(100, true).catch((error) => {
      expect(error).toBe('Timeout')
    })
  })

  it('should createSingletonPromise work', async () => {
    const createPromise = () => Promise.resolve(0)
    const wrapper = createSingletonPromise(createPromise)
    const promise1 = wrapper()
    const promise2 = wrapper()

    expect(promise1).toBe(promise2)
    const value = await promise1
    expect(value).toBe(0)
  })

  it('should createSingletonPromise reset', async () => {
    const cb = vi.fn()
    const createPromise = () => Promise.resolve(0).then(cb)
    const wrapper = createSingletonPromise(createPromise)
    const promise1 = wrapper()

    await wrapper.reset()
    expect(cb).toHaveBeenCalled()

    const promise2 = wrapper()
    expect(promise1).not.toBe(promise2)
  })
})

describe('filters', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  describe('debounceFilter', () => {
    it('should debounce', () => {
      const debouncedFilterSpy = vi.fn()
      const filter = createFilterWrapper(debounceFilter(1000), debouncedFilterSpy)

      setTimeout(filter, 200)
      vi.runAllTimers()

      setTimeout(filter, 500)
      vi.advanceTimersByTime(500)
      expect(debouncedFilterSpy).toHaveBeenCalledOnce()
    })

    it('should debounce twice', () => {
      const debouncedFilterSpy = vi.fn()
      const filter = createFilterWrapper(debounceFilter(500), debouncedFilterSpy)

      setTimeout(filter, 500)
      vi.advanceTimersByTime(500)
      setTimeout(filter, 1000)
      vi.advanceTimersByTime(2000)

      expect(debouncedFilterSpy).toHaveBeenCalledTimes(2)
    })

    it('should resolve & reject debounced fn', async () => {
      const debouncedSum = createFilterWrapper(
        debounceFilter(500, { rejectOnCancel: true }),
        (a: number, b: number) => a + b,
      )

      const five = debouncedSum(2, 3)
      let nine
      setTimeout(() => {
        nine = debouncedSum(4, 5)
      }, 200)

      vi.runAllTimers()

      await expect(five).rejects.toBeUndefined()
      await expect(nine).resolves.toBe(9)
    })

    it('should debounce with ref', () => {
      const debouncedFilterSpy = vi.fn()
      const debounceTime = shallowRef(0)
      const filter = createFilterWrapper(debounceFilter(debounceTime), debouncedFilterSpy)

      filter()
      debounceTime.value = 500
      filter()
      setTimeout(filter, 200)

      vi.runAllTimers()

      expect(debouncedFilterSpy).toHaveBeenCalledTimes(2)
    })
  })

  describe('throttleFilter', () => {
    it('should throttle', () => {
      const throttledFilterSpy = vi.fn()
      const filter = createFilterWrapper(throttleFilter(1000), throttledFilterSpy)
      setTimeout(filter, 500)
      setTimeout(filter, 500)
      setTimeout(filter, 500)
      setTimeout(filter, 500)

      vi.runAllTimers()

      expect(throttledFilterSpy).toHaveBeenCalledTimes(2)
    })

    it('should throttle evenly', () => {
      const debouncedFilterSpy = vi.fn()

      const filter = createFilterWrapper(throttleFilter(1000), debouncedFilterSpy)

      setTimeout(() => filter(1), 500)
      setTimeout(() => filter(2), 1000)
      setTimeout(() => filter(3), 2000)

      vi.runAllTimers()

      expect(debouncedFilterSpy).toHaveBeenCalledTimes(3)
      expect(debouncedFilterSpy).toHaveBeenCalledWith(1)
      expect(debouncedFilterSpy).toHaveBeenCalledWith(2)
      expect(debouncedFilterSpy).toHaveBeenCalledWith(3)
    })

    it('should throttle with ref', () => {
      const debouncedFilterSpy = vi.fn()
      const throttle = shallowRef(0)
      const filter = createFilterWrapper(throttleFilter(throttle), debouncedFilterSpy)

      filter()
      throttle.value = 1000

      setTimeout(filter, 300)
      setTimeout(filter, 600)
      setTimeout(filter, 900)

      vi.runAllTimers()

      expect(debouncedFilterSpy).toHaveBeenCalledTimes(2)
    })

    it('should not duplicate single event', () => {
      const debouncedFilterSpy = vi.fn()
      const filter = createFilterWrapper(throttleFilter(1000), debouncedFilterSpy)

      setTimeout(filter, 500)

      vi.runAllTimers()

      expect(debouncedFilterSpy).toHaveBeenCalledTimes(1)
    })

    it('should get trailing value', async () => {
      const sumSpy = vi.fn((a: number, b: number) => a + b)
      const throttledSum = createFilterWrapper(
        throttleFilter(1000, true),
        sumSpy,
      )

      let result = throttledSum(2, 3)
      setTimeout(() => {
        result = throttledSum(4, 5)
      }, 600)
      setTimeout(() => {
        result = throttledSum(6, 7)
      }, 900)

      vi.runAllTimers()

      expect(sumSpy).toHaveBeenCalledTimes(2)
      await expect(result).resolves.toBe(6 + 7)

      setTimeout(() => {
        result = throttledSum(8, 9)
      }, 1200)
      setTimeout(() => {
        result = throttledSum(10, 11)
      }, 1800)

      vi.runAllTimers()

      expect(sumSpy).toHaveBeenCalledTimes(4)
      await expect(result).resolves.toBe(10 + 11)
    })

    it('should get leading value', async () => {
      const sumSpy = vi.fn((a: number, b: number) => a + b)
      const throttledSum = createFilterWrapper(
        throttleFilter(1000, false),
        sumSpy,
      )

      let result = throttledSum(2, 3)
      setTimeout(() => {
        result = throttledSum(4, 5)
      }, 600)
      setTimeout(() => {
        result = throttledSum(6, 7)
      }, 900)

      vi.runAllTimers()

      expect(sumSpy).toHaveBeenCalledTimes(1)
      await expect(result).resolves.toBe(2 + 3)

      setTimeout(() => {
        result = throttledSum(8, 9)
      }, 1200)
      setTimeout(() => {
        result = throttledSum(10, 11)
      }, 1800)

      vi.runAllTimers()

      expect(sumSpy).toHaveBeenCalledTimes(2)
      await expect(result).resolves.toBe(8 + 9)
    })
  })

  describe('pausableFilter', () => {
    it.todo('should pause')
  })
})

describe('is', () => {
  let warnSpy: MockInstance

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should be client', () => {
    expect(isClient).toBeTruthy()
  })

  it('should be IOS', () => {
    expect(isIOS).toBeFalsy()
  })

  it('should assert', () => {
    assert(true)
    expect(warnSpy).not.toBeCalled()
    assert(false, 'error')
    expect(warnSpy).toHaveBeenCalledWith('error')
  })

  it('should be defined', () => {
    expect(isDef(null)).toBeTruthy()
    expect(isDef(0)).toBeTruthy()
    expect(isDef('')).toBeTruthy()
    expect(isDef(undefined)).toBeFalsy()
  })

  it('should be object', () => {
    expect(isObject({})).toBeTruthy()
    expect(isObject(null)).toBeFalsy()
    expect(isObject([])).toBeFalsy()
  })

  it('should be now', () => {
    expect(now()).toEqual(Date.now())
    expect(timestamp()).toEqual(Date.now())
  })

  it('should clamp', () => {
    expect(clamp(1, 2, 3)).toBe(2)
    expect(clamp(2, 1, 3)).toBe(2)
  })

  it('should noop', () => {
    expect(noop()).toBeUndefined()
  })

  it('should be rand', { retry: 20 }, () => {
    expect(rand(1, 2)).not.toBe(rand(1, 2))
  })

  it('hasOwn', () => {
    class Parent {a = 1}
    class Child extends Parent {}
    function F() {}
    F.prototype.a = 1
    const obj1 = { a: 1 } as any
    const obj2 = new Child() as any
    // @ts-expect-error ES5 new
    const obj3 = new F() as any
    expect(hasOwn(obj1, 'a')).toBeTruthy()
    expect(hasOwn(obj1, 'b')).toBeFalsy()
    expect(hasOwn(obj2, 'a')).toBeTruthy()
    expect(hasOwn(obj2, 'b')).toBeFalsy()
    expect(hasOwn(obj3, 'a')).toBeFalsy()

    obj3.a = 2
    expect(hasOwn(obj3, 'a')).toBeTruthy()
  })
})

describe('optionsFilters', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  it('optionsThrottleFilter should throttle', () => {
    const throttledFilterSpy = vi.fn()
    const filter = createFilterWrapper(throttleFilter({
      delay: 1000,
    }), throttledFilterSpy)
    setTimeout(filter, 500)
    setTimeout(filter, 500)
    setTimeout(filter, 500)
    setTimeout(filter, 500)

    vi.runAllTimers()

    expect(throttledFilterSpy).toHaveBeenCalledTimes(2)
  })

  it('optionsThrottleFilter should throttle evenly', () => {
    const debouncedFilterSpy = vi.fn()

    const filter = createFilterWrapper(throttleFilter({
      delay: 1000,
    }), debouncedFilterSpy)

    setTimeout(() => filter(1), 500)
    setTimeout(() => filter(2), 1000)
    setTimeout(() => filter(3), 2000)

    vi.runAllTimers()

    expect(debouncedFilterSpy).toHaveBeenCalledTimes(3)
    expect(debouncedFilterSpy).toHaveBeenCalledWith(1)
    expect(debouncedFilterSpy).toHaveBeenCalledWith(2)
    expect(debouncedFilterSpy).toHaveBeenCalledWith(3)
  })

  it('optionsThrottleFilter should throttle with ref', () => {
    const debouncedFilterSpy = vi.fn()
    const throttle = shallowRef(0)
    const filter = createFilterWrapper(throttleFilter(throttle), debouncedFilterSpy)

    filter()
    throttle.value = 1000

    setTimeout(filter, 300)
    setTimeout(filter, 600)
    setTimeout(filter, 900)

    vi.runAllTimers()

    expect(debouncedFilterSpy).toHaveBeenCalledTimes(2)
  })

  it('optionsThrottleFilter should not duplicate single event', () => {
    const debouncedFilterSpy = vi.fn()
    const filter = createFilterWrapper(throttleFilter({
      delay: 1000,
    }), debouncedFilterSpy)

    setTimeout(filter, 500)

    vi.runAllTimers()

    expect(debouncedFilterSpy).toHaveBeenCalledTimes(1)
  })

  it('optionsThrottleFilter should get trailing value', async () => {
    const sumSpy = vi.fn((a: number, b: number) => a + b)
    const throttledSum = createFilterWrapper(
      throttleFilter({
        delay: 1000,
        trailing: true,
      }),
      sumSpy,
    )

    let result = throttledSum(2, 3)
    setTimeout(() => {
      result = throttledSum(4, 5)
    }, 600)
    setTimeout(() => {
      result = throttledSum(6, 7)
    }, 900)

    vi.runAllTimers()

    expect(sumSpy).toHaveBeenCalledTimes(2)
    await expect(result).resolves.toBe(6 + 7)

    setTimeout(() => {
      result = throttledSum(8, 9)
    }, 1200)
    setTimeout(() => {
      result = throttledSum(10, 11)
    }, 1800)

    vi.runAllTimers()

    expect(sumSpy).toHaveBeenCalledTimes(4)
    await expect(result).resolves.toBe(10 + 11)
  })

  it('optionsThrottleFilter should get leading value', async () => {
    const sumSpy = vi.fn((a: number, b: number) => a + b)
    const throttledSum = createFilterWrapper(
      throttleFilter({
        delay: 1000,
        trailing: false,
      }),
      sumSpy,
    )

    let result = throttledSum(2, 3)
    setTimeout(() => {
      result = throttledSum(4, 5)
    }, 600)
    setTimeout(() => {
      result = throttledSum(6, 7)
    }, 900)

    vi.runAllTimers()

    expect(sumSpy).toHaveBeenCalledTimes(1)
    await expect(result).resolves.toBe(2 + 3)

    setTimeout(() => {
      result = throttledSum(8, 9)
    }, 1200)
    setTimeout(() => {
      result = throttledSum(10, 11)
    }, 1800)

    vi.runAllTimers()

    expect(sumSpy).toHaveBeenCalledTimes(2)
    await expect(result).resolves.toBe(8 + 9)
  })
})

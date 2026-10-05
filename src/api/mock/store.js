import { createSeedState } from '../../data/mockData'

const STORAGE_KEY = 'cloudstay.mock-db.v1'
let memoryState = null

function storageAvailable() {
  try {
    return typeof localStorage !== 'undefined'
  } catch {
    return false
  }
}

export function readMockState() {
  if (storageAvailable()) {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed?.version === 1 && Array.isArray(parsed.rooms)) return parsed
      }
    } catch {
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {
        // Fall through to the in-memory state when browser storage is blocked.
      }
    }
  }

  if (!memoryState) memoryState = createSeedState()
  writeMockState(memoryState)
  return structuredClone(memoryState)
}

export function writeMockState(nextState) {
  memoryState = structuredClone(nextState)
  if (storageAvailable()) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState))
    } catch {
      // Quota/security errors must not break the in-memory demo.
    }
  }
  return structuredClone(nextState)
}

export function updateMockState(updater) {
  const current = readMockState()
  const next = updater(current) ?? current
  return writeMockState(next)
}

export function resetMockState() {
  memoryState = createSeedState()
  if (storageAvailable()) {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // The following write still updates the in-memory state.
    }
  }
  return writeMockState(memoryState)
}

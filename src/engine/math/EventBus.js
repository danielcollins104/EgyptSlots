// ============================================================================
// SLOT EVENT BUS (`src/engine/math/EventBus.js`)
// ============================================================================
// Architectural Decision #2 from Slot Mechanics Standard:
// Near-misses, wins, features, bets, and modes are all passive events.
// Presentation modules, quests, analytics, and audio subscribe as decoupled consumers.
// ============================================================================

export class SlotEventBus {
  constructor() {
    this.listeners = new Map();
  }

  /**
   * Subscribe a listener callback to an event type.
   * @param {string} event - Event name (e.g. 'outcome:evaluated', 'near_miss:detected')
   * @param {Function} callback - Handler function
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  /**
   * Subscribe a listener that only fires once.
   */
  once(event, callback) {
    const wrapper = (...args) => {
      this.off(event, wrapper);
      callback(...args);
    };
    return this.on(event, wrapper);
  }

  /**
   * Unsubscribe a listener callback.
   */
  off(event, callback) {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Emit an event synchronously to all registered listeners.
   * @param {string} event - Event name
   * @param {*} data - Payload passed to handlers
   */
  emit(event, data) {
    const set = this.listeners.get(event);
    if (set) {
      for (const cb of set) {
        try {
          cb(data);
        } catch (err) {
          console.error(`[SlotEventBus] Error in listener for event "${event}":`, err);
        }
      }
    }
  }

  /**
   * Remove all registered listeners.
   */
  clear() {
    this.listeners.clear();
  }
}

export const slotEventBus = new SlotEventBus();

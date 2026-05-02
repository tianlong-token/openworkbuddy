"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Stream = void 0;
/**
 * Stream - A clean AsyncGenerator implementation with queue support.
 *
 * Provides a simple way to create async iterables that can be
 * fed values from external sources (like process stdout).
 */
class Stream {
    constructor(returned) {
        this.queue = [];
        this.isDone = false;
        this.started = false;
        this.returned = returned;
    }
    [Symbol.asyncIterator]() {
        if (this.started) {
            throw new Error('Stream can only be iterated once');
        }
        this.started = true;
        return this;
    }
    next() {
        if (this.queue.length > 0) {
            return Promise.resolve({
                done: false,
                value: this.queue.shift(),
            });
        }
        if (this.isDone) {
            return Promise.resolve({ done: true, value: undefined });
        }
        if (this.hasError) {
            return Promise.reject(this.hasError);
        }
        return new Promise((resolve, reject) => {
            this.readResolve = resolve;
            this.readReject = reject;
        });
    }
    enqueue(value) {
        if (this.readResolve) {
            const resolve = this.readResolve;
            this.readResolve = undefined;
            this.readReject = undefined;
            resolve({ done: false, value });
        }
        else {
            this.queue.push(value);
        }
    }
    done() {
        this.isDone = true;
        if (this.readResolve) {
            const resolve = this.readResolve;
            this.readResolve = undefined;
            this.readReject = undefined;
            resolve({ done: true, value: undefined });
        }
    }
    error(error) {
        this.hasError = error;
        if (this.readReject) {
            const reject = this.readReject;
            this.readResolve = undefined;
            this.readReject = undefined;
            reject(error);
        }
    }
    return() {
        this.isDone = true;
        if (this.returned) {
            this.returned();
        }
        return Promise.resolve({ done: true, value: undefined });
    }
    throw(e) {
        this.hasError = e;
        this.isDone = true;
        return Promise.reject(e);
    }
    /**
     * Returns true if the queue is empty and no pending read is waiting.
     */
    get isEmpty() {
        return this.queue.length === 0;
    }
    /**
     * Returns the current number of items in the queue.
     */
    get length() {
        return this.queue.length;
    }
    /**
     * Reset the stream state to allow re-iteration.
     *
     * This is needed when the stream's iterator is closed (e.g., by early loop exit
     * or cancel operation) but the underlying data source (process, connection) is
     * still active. After reset(), the stream can be iterated again.
     *
     * Note: This clears any queued values to ensure fresh state for new iteration.
     * The previous turn's messages (like result messages from cancel) are discarded.
     */
    reset() {
        this.started = false;
        this.isDone = false;
        this.hasError = undefined;
        this.readResolve = undefined;
        this.readReject = undefined;
        // Clear queue to discard stale messages from previous turn (e.g., result from cancel)
        this.queue = [];
    }
    /**
     * Check if the stream has been started (iterated).
     */
    get isStarted() {
        return this.started;
    }
    /**
     * Check if the stream is done.
     */
    get isFinished() {
        return this.isDone;
    }
}
exports.Stream = Stream;
//# sourceMappingURL=stream.js.map
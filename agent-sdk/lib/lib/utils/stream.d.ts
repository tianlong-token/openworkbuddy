/**
 * Stream - A clean AsyncGenerator implementation with queue support.
 *
 * Provides a simple way to create async iterables that can be
 * fed values from external sources (like process stdout).
 */
export declare class Stream<T, TReturn = void> implements AsyncGenerator<T, TReturn, unknown> {
    private returned?;
    private queue;
    private readResolve?;
    private readReject?;
    private isDone;
    private hasError?;
    private started;
    constructor(returned?: () => void);
    [Symbol.asyncIterator](): AsyncGenerator<T, TReturn, unknown>;
    next(): Promise<IteratorResult<T, TReturn>>;
    enqueue(value: T): void;
    done(): void;
    error(error: Error): void;
    return(): Promise<IteratorResult<T, TReturn>>;
    throw(e?: Error): Promise<IteratorResult<T, TReturn>>;
    /**
     * Returns true if the queue is empty and no pending read is waiting.
     */
    get isEmpty(): boolean;
    /**
     * Returns the current number of items in the queue.
     */
    get length(): number;
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
    reset(): void;
    /**
     * Check if the stream has been started (iterated).
     */
    get isStarted(): boolean;
    /**
     * Check if the stream is done.
     */
    get isFinished(): boolean;
}
//# sourceMappingURL=stream.d.ts.map
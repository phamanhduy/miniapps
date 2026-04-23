/**
 * zalo-listener-factory.ts — sets up zca-js listener events for one Zalo account.
 * Handles message routing, user-info caching, group detection, and undo events.
 * Extracted from ZaloAccountPool to keep zalo-pool.ts under 200 lines.
 */
import type { Server } from 'socket.io';
export interface ListenerContext {
    accountId: string;
    api: any;
    io: Server | null;
    userInfoCache?: Map<string, any>;
    onDisconnected: (accountId: string) => void;
}
/**
 * Attach all zca-js listener events for the given account.
 * Calls listener.start() with retryOnClose at the end.
 */
export declare function attachZaloListener(ctx: ListenerContext): void;
//# sourceMappingURL=zalo-listener-factory.d.ts.map
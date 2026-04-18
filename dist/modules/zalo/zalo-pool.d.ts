import type { Server } from 'socket.io';
interface ZaloCredentials {
    cookie: any;
    imei: string;
    userAgent: string;
}
interface ZaloInstance {
    zalo: any;
    api: any;
    status: 'connected' | 'disconnected' | 'qr_pending' | 'connecting';
    displayName?: string;
    zaloUid?: string;
    lastActivity: Date;
}
declare class ZaloAccountPool {
    private instances;
    private io;
    private userInfoCache;
    private disconnectHistory;
    setIO(io: Server): void;
    loginQR(accountId: string): Promise<void>;
    reconnect(accountId: string, credentials: ZaloCredentials): Promise<void>;
    private attachListener;
    private saveCredentials;
    private updateAccountDB;
    private autoReconnect;
    disconnect(accountId: string): void;
    getStatus(accountId: string): string;
    getAllStatuses(): Record<string, string>;
    getApi(accountId: string): any | null;
    getInstance(accountId: string): ZaloInstance | undefined;
}
export declare const zaloPool: ZaloAccountPool;
export {};
//# sourceMappingURL=zalo-pool.d.ts.map
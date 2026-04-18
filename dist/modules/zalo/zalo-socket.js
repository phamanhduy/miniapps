import { logger } from '../../shared/utils/logger.js';
export function registerZaloSocketHandlers(io) {
    io.on('connection', (socket) => {
        // Client should send orgId after connecting to join org-level room
        socket.on('org:join', (data) => {
            if (!data?.orgId)
                return;
            socket.join(`org:${data.orgId}`);
            logger.debug(`Socket ${socket.id} joined org:${data.orgId}`);
        });
        // Subscribe to QR/status updates for a specific Zalo account
        socket.on('zalo:subscribe', (data) => {
            if (!data?.accountId)
                return;
            socket.join(`account:${data.accountId}`);
            logger.debug(`Socket ${socket.id} joined account:${data.accountId}`);
        });
        // Unsubscribe from a specific account room
        socket.on('zalo:unsubscribe', (data) => {
            if (!data?.accountId)
                return;
            socket.leave(`account:${data.accountId}`);
            logger.debug(`Socket ${socket.id} left account:${data.accountId}`);
        });
    });
}
//# sourceMappingURL=zalo-socket.js.map
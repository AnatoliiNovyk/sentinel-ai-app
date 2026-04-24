export var ErrorCode;
(function (ErrorCode) {
    ErrorCode["AI_RPC_FAILED"] = "AI_RPC_FAILED";
    ErrorCode["AI_POLLING_FAILED"] = "AI_POLLING_FAILED";
    ErrorCode["AI_PROCESSING_TIMEOUT"] = "AI_PROCESSING_TIMEOUT";
    ErrorCode["SCAN_DB_INSERT_FAILED"] = "SCAN_DB_INSERT_FAILED";
    ErrorCode["SCAN_EDGE_FN_ERROR"] = "SCAN_EDGE_FN_ERROR";
    ErrorCode["SCAN_MOCK_FAILED"] = "SCAN_MOCK_FAILED";
    ErrorCode["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";
})(ErrorCode || (ErrorCode = {}));
export function success(data) {
    return { ok: true, data };
}
export function failure(code, message, cause, context) {
    return {
        ok: false,
        error: {
            code,
            message,
            cause,
            context,
            timestamp: new Date().toISOString(),
        },
    };
}
export function errorToUserMessage(err) {
    switch (err.code) {
        case ErrorCode.AI_RPC_FAILED:
            return 'AI task dispatch failed. Please retry in a moment.';
        case ErrorCode.AI_POLLING_FAILED:
            return 'AI polling failed due to a service error. Please retry shortly.';
        case ErrorCode.AI_PROCESSING_TIMEOUT:
            return 'AI processing timed out. Please try again.';
        case ErrorCode.SCAN_DB_INSERT_FAILED:
            return 'Failed to create scan record.';
        case ErrorCode.SCAN_EDGE_FN_ERROR:
            return 'Scan service unavailable. Switched to mock mode.';
        case ErrorCode.SCAN_MOCK_FAILED:
            return 'Mock scan failed to execute.';
        default:
            return err.message || 'Unexpected error occurred.';
    }
}

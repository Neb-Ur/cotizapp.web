export const ok = (res, data, status = 200) => {
    return res.status(status).json({ ok: true, data });
};
export const fail = (res, code, message, status = 400, details) => {
    return res.status(status).json({
        ok: false,
        error: {
            code,
            message,
            details
        }
    });
};
export const getTokenFromRequest = (req) => {
    const value = req.header('authorization') || req.header('Authorization');
    if (!value) {
        return null;
    }
    const [scheme, token] = value.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
        return null;
    }
    return token;
};
export const paginate = (items, pageRaw, pageSizeRaw) => {
    const page = Math.max(1, Number.parseInt(pageRaw || '1', 10) || 1);
    const pageSize = Math.max(1, Number.parseInt(pageSizeRaw || '20', 10) || 20);
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const from = (safePage - 1) * pageSize;
    const to = from + pageSize;
    return {
        items: items.slice(from, to),
        meta: {
            page: safePage,
            pageSize,
            total,
            totalPages
        }
    };
};

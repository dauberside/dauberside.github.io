// Debug endpoint for datetime picker / environment diagnostics.
// (Previously empty file triggered Next.js config parse warnings.)
// Remove or protect with auth if not needed in production.
import type { NextApiRequest, NextApiResponse } from 'next';

// Avoid using `as const` or type assertions that produce TsAsExpression in AST.
// Extend here only with plain object literals recognizable by Next.js.
export const config = {
	// You can add api config here if needed, e.g. bodyParser: false
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
	const now = new Date();
	res.status(200).json({
		status: 'ok',
		now: now.toISOString(),
		note: 'dtpicker debug endpoint',
		method: req.method,
	});
}

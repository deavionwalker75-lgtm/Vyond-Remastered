/**
 * Movie export status route
 */

module.exports = function (req, res, url) {
	// GET /api/export/status/:exportId
	const match = req.url.match(/^\/api\/export\/status\/([a-f0-9]+)$/);
	
	if (!match || req.method !== 'GET') {
		return;
	}

	const exportId = match[1];
	const { getJobStatus } = require('./export');

	const status = getJobStatus(exportId);
	
	res.setHeader('Content-Type', 'application/json');
	
	if (!status) {
		res.statusCode = 404;
		res.end(JSON.stringify({ error: 'Export job not found' }));
	} else {
		res.statusCode = 200;
		res.end(JSON.stringify(status));
	}

	return true;
};

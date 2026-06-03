#!/usr/bin/env node

/**
 * Video Export CLI Tool
 * Test and manage movie exports from the command line
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

function exportMovie(movieId, format = 'mp4', quality = 'medium', outputPath = null) {
	return new Promise((resolve, reject) => {
		const hostname = process.env.VYOND_HOST || 'localhost';
		const port = process.env.PORT || 8080;
		const url = `/goapi/exportMovie/?movieId=${movieId}&format=${format}&quality=${quality}`;

		const options = {
			hostname,
			port,
			path: url,
			method: 'POST'
		};

		const req = http.request(options, (res) => {
			const chunks = [];
			let size = 0;

			res.on('data', (chunk) => {
				chunks.push(chunk);
				size += chunk.length;
				process.stdout.write(`\rDownloading... ${(size / 1024 / 1024).toFixed(2)} MB`);
			});

			res.on('end', () => {
				console.log('');
				
				if (res.statusCode !== 200) {
					const errorData = Buffer.concat(chunks).toString();
					try {
						const error = JSON.parse(errorData);
						reject(new Error(error.error || 'Export failed'));
					} catch {
						reject(new Error(`HTTP ${res.statusCode}: ${errorData}`));
					}
					return;
				}

				const buffer = Buffer.concat(chunks);
				const finalPath = outputPath || `movie_${movieId}.${format}`;
				
				fs.writeFileSync(finalPath, buffer);
				resolve({
					success: true,
					path: finalPath,
					size: buffer.length,
					format,
					quality
				});
			});
		});

		req.on('error', reject);
		req.end();
	});
}

function getExportStatus(exportId) {
	return new Promise((resolve, reject) => {
		const hostname = process.env.VYOND_HOST || 'localhost';
		const port = process.env.PORT || 8080;
		const url = `/api/export/status/${exportId}`;

		const options = {
			hostname,
			port,
			path: url,
			method: 'GET'
		};

		const req = http.request(options, (res) => {
			let data = '';

			res.on('data', (chunk) => {
				data += chunk;
			});

			res.on('end', () => {
				if (res.statusCode === 200) {
					resolve(JSON.parse(data));
				} else {
					reject(new Error(`HTTP ${res.statusCode}`));
				}
			});
		});

		req.on('error', reject);
		req.end();
	});
}

// CLI Interface
const args = process.argv.slice(2);

if (args.length === 0) {
	console.log(`
Vyond Remastered - Video Export CLI

Usage:
  export <movieId> [options]          Export a movie
  status <exportId>                   Check export status
  help                                Show this help message

Options:
  --format <format>                   Video format: mp4, webm, mov (default: mp4)
  --quality <quality>                 Quality: low, medium, high (default: medium)
  --output <path>                     Output file path

Examples:
  export abc123
  export abc123 --format webm --quality high
  export abc123 --output my_video.mp4
  status a1b2c3d
	`);
	process.exit(0);
}

const command = args[0];

if (command === 'help') {
	console.log('Vyond Remastered - Video Export CLI\n');
	console.log('See usage above for command details');
	process.exit(0);
}

if (command === 'status') {
	if (args.length < 2) {
		console.error('Error: exportId required');
		process.exit(1);
	}

	const exportId = args[1];
	getExportStatus(exportId)
		.then(status => {
			console.log('Export Status:');
			console.log(JSON.stringify(status, null, 2));
		})
		.catch(error => {
			console.error('Error:', error.message);
			process.exit(1);
		});
} else if (command === 'export') {
	if (args.length < 2) {
		console.error('Error: movieId required');
		process.exit(1);
	}

	const movieId = args[1];
	let format = 'mp4';
	let quality = 'medium';
	let outputPath = null;

	// Parse options
	for (let i = 2; i < args.length; i++) {
		if (args[i] === '--format' && i + 1 < args.length) {
			format = args[++i];
		} else if (args[i] === '--quality' && i + 1 < args.length) {
			quality = args[++i];
		} else if (args[i] === '--output' && i + 1 < args.length) {
			outputPath = args[++i];
		}
	}

	console.log(`Exporting movie ${movieId} as ${format} (${quality})`);
	console.log('');

	exportMovie(movieId, format, quality, outputPath)
		.then(result => {
			console.log('✓ Export successful!');
			console.log(`  File: ${result.path}`);
			console.log(`  Size: ${(result.size / 1024 / 1024).toFixed(2)} MB`);
			console.log(`  Format: ${result.format}`);
			console.log(`  Quality: ${result.quality}`);
		})
		.catch(error => {
			console.error('✗ Export failed:', error.message);
			process.exit(1);
		});
} else {
	console.error(`Unknown command: ${command}`);
	console.error('Run with no arguments for help');
	process.exit(1);
}

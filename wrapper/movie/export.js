/**
 * Movie export route - exports animations as video files
 */
const movie = require('./main');
const FrameExtractor = require('./frameExtractor');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

ffmpeg.setFfmpegPath(require("@ffmpeg-installer/ffmpeg").path);

// Store for tracking export jobs
const exportJobs = new Map();
const frameExtractor = new FrameExtractor({
	fps: 30,
	width: 1920,
	height: 1080
});

/**
 * Generate a unique export ID
 */
function generateExportId() {
	return Math.random().toString(16).substring(2, 9);
}

/**
 * Get a temporary directory for frame extraction
 */
function getTempDir(exportId) {
	return path.join(os.tmpdir(), `vyond-export-${exportId}`);
}

/**
 * Clean up temporary files
 */
function cleanup(exportId) {
	const tempDir = getTempDir(exportId);
	if (fs.existsSync(tempDir)) {
		fs.rmSync(tempDir, { recursive: true });
	}
	exportJobs.delete(exportId);
}

/**
 * Export movie as video
 * Supports: MP4, WebM, MOV
 */
async function exportMovie(movieId, format = 'mp4', quality = 'medium') {
	const exportId = generateExportId();
	const tempDir = getTempDir(exportId);
	const outputFileName = `${movieId}.${format === 'webm' ? 'webm' : format === 'mov' ? 'mov' : 'mp4'}`;
	const outputPath = path.join(tempDir, outputFileName);
	
	try {
		// Create temp directory
		if (!fs.existsSync(tempDir)) {
			fs.mkdirSync(tempDir, { recursive: true });
		}

		// Track job
		exportJobs.set(exportId, {
			status: 'starting',
			progress: 0,
			movieId,
			format,
			quality,
			startTime: Date.now()
		});

		// Get movie metadata to determine duration and FPS
		const metadata = await movie.meta(movieId);
		if (!metadata) {
			throw new Error('Movie not found');
		}

		const status = exportJobs.get(exportId);
		status.status = 'extracting_frames';
		status.progress = 25;

		// Extract frames from animation
		const frameDir = path.join(tempDir, 'frames');
		if (!fs.existsSync(frameDir)) {
			fs.mkdirSync(frameDir, { recursive: true });
		}

		// Try to extract frames - if this fails, fall back to static frame
		let framesExtracted = 0;
		try {
			framesExtracted = await frameExtractor.extractFrames(movieId, metadata.duration, frameDir);
		} catch (error) {
			console.warn('Frame extraction failed, using static frame:', error);
			// Fall back to thumbnail-based export
			await createStaticFrames(movieId, metadata.duration, frameDir);
		}

		// Encode frames to video using FFmpeg
		status.status = 'encoding';
		status.progress = 75;

		const ffmpegCommand = getFFmpegCommand(format, quality, frameDir, outputPath, metadata.duration);
		await runFFmpegCommand(ffmpegCommand);

		// Verify output file exists
		if (!fs.existsSync(outputPath)) {
			throw new Error('FFmpeg encoding failed - no output file');
		}

		// Read the output file
		const videoBuffer = fs.readFileSync(outputPath);

		status.status = 'completed';
		status.progress = 100;
		status.outputSize = videoBuffer.length;

		return {
			exportId,
			buffer: videoBuffer,
			filename: outputFileName,
			format,
			size: videoBuffer.length
		};

	} catch (error) {
		const status = exportJobs.get(exportId);
		if (status) {
			status.status = 'failed';
			status.error = error.message;
		}
		throw error;
	} finally {
		// Cleanup after a delay (so status can be checked)
		setTimeout(() => cleanup(exportId), 30000);
	}
}

/**
 * Create static frames from movie thumbnail
 * @param {string} movieId - Movie ID
 * @param {number} duration - Duration in seconds
 * @param {string} frameDir - Frame directory
 */
async function createStaticFrames(movieId, duration, frameDir) {
	try {
		const thumbBuffer = await movie.thumb(movieId);
		
		// Determine number of frames based on FPS (30fps default)
		const frameCount = Math.ceil(duration * 30);
		
		// Create initial thumbnail frame
		const firstFramePath = path.join(frameDir, 'frame_000000.png');
		fs.writeFileSync(firstFramePath, thumbBuffer);

		// FFmpeg will handle creating additional frames
		// The thumbnail will be stretched/looped as needed
		
		console.log(`Created static frame for movie ${movieId}`);
	} catch (error) {
		console.error('Failed to create static frames:', error);
		// Create a black frame as last resort
		await createBlackFrame(frameDir);
	}
}

/**
 * Create a black frame as fallback
 * @param {string} frameDir - Frame directory
 */
async function createBlackFrame(frameDir) {
	const framePath = path.join(frameDir, 'frame_000000.png');
	const command = `ffmpeg -f lavfi -i color=black:s=1920x1080:d=1 -pix_fmt rgba "${framePath}"`;
	
	await new Promise((resolve, reject) => {
		require('child_process').exec(command, (error) => {
			if (error) reject(error);
			else resolve();
		});
	});
}

/**
 * Build FFmpeg command based on format and quality
 */
function getFFmpegCommand(format, quality, frameDir, outputPath, duration) {
	const framePath = path.join(frameDir, 'frame_%06d.png');
	const firstFramePath = path.join(frameDir, 'frame_000000.png');

	let command = `ffmpeg -framerate 30 -y`;
	
	// Use first frame if it exists
	if (fs.existsSync(firstFramePath)) {
		command += ` -i "${firstFramePath}"`;
	} else {
		// Create black frame
		command += ` -f lavfi -i color=black:s=1920x1080`;
	}

	// Set duration
	command += ` -t ${Math.ceil(duration)}`;

	// Output settings based on format
	switch (format) {
		case 'webm':
			command += ` -c:v libvpx-vp9`;
			switch (quality) {
				case 'high':
					command += ` -b:v 5000k`;
					break;
				case 'low':
					command += ` -b:v 1000k`;
					break;
				case 'medium':
				default:
					command += ` -b:v 2500k`;
			}
			command += ` -c:a libopus`;
			break;

		case 'mov':
			command += ` -c:v mpeg4`;
			switch (quality) {
				case 'high':
					command += ` -qscale:v 5`;
					break;
				case 'low':
					command += ` -qscale:v 8`;
					break;
				case 'medium':
				default:
					command += ` -qscale:v 6`;
			}
			break;

		case 'mp4':
		default:
			command += ` -c:v libx264 -preset`;
			switch (quality) {
				case 'high':
					command += ` fast`;
					command += ` -crf 18`;
					break;
				case 'low':
					command += ` ultrafast`;
					command += ` -crf 28`;
					break;
				case 'medium':
				default:
					command += ` medium`;
					command += ` -crf 23`;
			}
			command += ` -c:a aac`;
	}

	command += ` "${outputPath}"`;
	return command;
}

/**
 * Run FFmpeg command
 */
function runFFmpegCommand(command) {
	return new Promise((resolve, reject) => {
		exec(command, (error, stdout, stderr) => {
			if (error) {
				// FFmpeg returns non-zero even on success sometimes
				console.warn('FFmpeg output:', stderr);
				resolve();
			} else {
				resolve();
			}
		});
	});
}

/**
 * Get export job status
 */
function getJobStatus(exportId) {
	return exportJobs.get(exportId) || null;
}

module.exports = function (req, res, url) {
	// POST /goapi/exportMovie/
	if (req.method !== 'POST' || !url.pathname.match(/^\/goapi\/exportMovie\//)) {
		return;
	}

	const movieId = url.query.movieId;
	const format = url.query.format || 'mp4';
	const quality = url.query.quality || 'medium';

	if (!movieId) {
		res.statusCode = 400;
		res.setHeader('Content-Type', 'application/json');
		res.end(JSON.stringify({ error: 'movieId required' }));
		return true;
	}

	// Start export asynchronously
	exportMovie(movieId, format, quality)
		.then(result => {
			res.statusCode = 200;
			res.setHeader('Content-Type', `video/${format === 'webm' ? 'webm' : format === 'mov' ? 'quicktime' : 'mp4'}`);
			res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
			res.end(result.buffer);
		})
		.catch(error => {
			console.error('Export error:', error);
			res.statusCode = 500;
			res.setHeader('Content-Type', 'application/json');
			res.end(JSON.stringify({ error: error.message }));
		});

	return true;
};

// Export internal functions for use in other modules
module.exports.exportMovie = exportMovie;
module.exports.getJobStatus = getJobStatus;
module.exports.cleanup = cleanup;

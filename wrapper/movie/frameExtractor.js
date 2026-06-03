/**
 * Frame Extraction Service
 * Extracts animation frames from rendered Flash content
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const os = require('os');

class FrameExtractor {
	constructor(options = {}) {
		this.browser = null;
		this.options = {
			headless: true,
			width: 1920,
			height: 1080,
			fps: 30,
			...options
		};
	}

	/**
	 * Initialize Puppeteer browser
	 */
	async initialize() {
		try {
			this.browser = await puppeteer.launch({
				headless: this.options.headless,
				args: [
					'--no-sandbox',
					'--disable-setuid-sandbox',
					'--disable-dev-shm-usage',
					'--single-process'
				]
			});
		} catch (error) {
			console.error('Failed to initialize Puppeteer:', error);
			throw error;
		}
	}

	/**
	 * Close browser
	 */
	async cleanup() {
		if (this.browser) {
			await this.browser.close();
		}
	}

	/**
	 * Extract frames from animation
	 * @param {string} movieId - Movie ID
	 * @param {number} duration - Duration in seconds
	 * @param {string} outputDir - Output directory for frames
	 * @returns {Promise<number>} Number of frames extracted
	 */
	async extractFrames(movieId, duration = 5, outputDir) {
		if (!this.browser) {
			await this.initialize();
		}

		const frameCount = Math.ceil(duration * this.options.fps);
		let framesExtracted = 0;

		try {
			const page = await this.browser.newPage();
			
			// Set viewport
			await page.setViewport({
				width: this.options.width,
				height: this.options.height
			});

			// Navigate to the animation player
			const animationUrl = `http://localhost:${process.env.PORT || 8080}/player.html?movieId=${movieId}`;
			
			try {
				await page.goto(animationUrl, { 
					waitUntil: 'networkidle2',
					timeout: 30000 
				});
			} catch (error) {
				console.warn('Page load timeout, continuing with frame capture');
			}

			// Wait for animation to load
			await new Promise(resolve => setTimeout(resolve, 2000));

			// Capture frames
			for (let i = 0; i < frameCount; i++) {
				const frameTime = (i / this.options.fps) * 1000;
				const framePath = path.join(outputDir, `frame_${String(i).padStart(6, '0')}.png`);

				try {
					// Seek animation to current time (if player supports it)
					await page.evaluate((time) => {
						if (window.player && typeof window.player.seek === 'function') {
							window.player.seek(time);
						}
					}, frameTime);

					// Wait a bit for rendering
					await new Promise(resolve => setTimeout(resolve, 50));

					// Capture screenshot
					await page.screenshot({ path: framePath });
					framesExtracted++;
				} catch (error) {
					console.error(`Failed to capture frame ${i}:`, error);
				}
			}

			await page.close();
		} catch (error) {
			console.error('Frame extraction error:', error);
		}

		return framesExtracted;
	}

	/**
	 * Extract frame from static content (thumbnail)
	 * @param {Buffer} thumbnailBuffer - Thumbnail image buffer
	 * @param {string} outputPath - Output path for frame
	 */
	async extractStaticFrame(thumbnailBuffer, outputPath) {
		if (!thumbnailBuffer) {
			throw new Error('No thumbnail provided');
		}

		fs.writeFileSync(outputPath, thumbnailBuffer);
		return true;
	}
}

module.exports = FrameExtractor;

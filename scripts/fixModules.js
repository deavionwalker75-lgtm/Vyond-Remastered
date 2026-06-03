#!/usr/bin/env node

/**
 * Post-installation module fixes for Vyond Remastered
 * Handles native module setup, permissions, and dependency resolution
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.join(__dirname, '..');
const NODE_MODULES = path.join(PROJECT_ROOT, 'node_modules');

function log(message) {
	console.log(`[fixModules] ${message}`);
}

function warn(message) {
	console.warn(`[fixModules] WARNING: ${message}`);
}

function error(message) {
	console.error(`[fixModules] ERROR: ${message}`);
}

/**
 * Check if a module exists
 */
function moduleExists(moduleName) {
	try {
		require.resolve(moduleName);
		return true;
	} catch (e) {
		return false;
	}
}

/**
 * Fix FFmpeg and FFprobe installer modules
 */
function fixFFmpeg() {
	log('Checking FFmpeg setup...');
	
	try {
		const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
		const ffprobePath = require('@ffprobe-installer/ffprobe').path;
		
		if (fs.existsSync(ffmpegPath)) {
			log(`✓ FFmpeg found at: ${ffmpegPath}`);
		} else {
			warn(`FFmpeg executable not found at: ${ffmpegPath}`);
		}
		
		if (fs.existsSync(ffprobePath)) {
			log(`✓ FFprobe found at: ${ffprobePath}`);
		} else {
			warn(`FFprobe executable not found at: ${ffprobePath}`);
		}
		
		// Make FFmpeg executable on Unix-like systems
		if (os.platform() !== 'win32' && ffmpegPath && fs.existsSync(ffmpegPath)) {
			try {
				fs.chmodSync(ffmpegPath, 0o755);
				log('✓ FFmpeg executable permissions set');
			} catch (e) {
				warn(`Failed to set FFmpeg permissions: ${e.message}`);
			}
		}
	} catch (e) {
		error(`FFmpeg setup failed: ${e.message}`);
	}
}

/**
 * Fix sharp (image processing) module
 */
function fixSharp() {
	log('Checking Sharp setup...');
	
	try {
		const sharpPath = path.join(NODE_MODULES, 'sharp');
		
		if (fs.existsSync(sharpPath)) {
			log('✓ Sharp module found');
			
			// Try to validate Sharp installation
			try {
				require('sharp');
				log('✓ Sharp is functional');
			} catch (e) {
				warn(`Sharp validation failed: ${e.message}`);
				log('  Attempting to rebuild Sharp...');
				
				try {
					execSync('npm rebuild sharp', { 
						cwd: PROJECT_ROOT,
						stdio: 'inherit'
					});
					log('✓ Sharp rebuilt successfully');
				} catch (e) {
					warn(`Failed to rebuild Sharp: ${e.message}`);
				}
			}
		} else {
			warn('Sharp module not found');
		}
	} catch (e) {
		error(`Sharp setup failed: ${e.message}`);
	}
}

/**
 * Fix native modules that might have issues
 */
function fixNativeModules() {
	log('Checking native modules...');
	
	const nativeModules = ['sharp', 'brotli', 'sqlite3'];
	const problematicModules = [];
	
	nativeModules.forEach(moduleName => {
		try {
			require(moduleName);
			log(`✓ ${moduleName} is available`);
		} catch (e) {
			warn(`${moduleName} check failed: ${e.message}`);
			problematicModules.push(moduleName);
		}
	});
	
	// Try to rebuild problematic native modules
	if (problematicModules.length > 0) {
		log(`Attempting to rebuild ${problematicModules.length} native module(s)...`);
		
		problematicModules.forEach(moduleName => {
			try {
				log(`  Rebuilding ${moduleName}...`);
				execSync(`npm rebuild ${moduleName}`, {
					cwd: PROJECT_ROOT,
					stdio: 'pipe'
				});
				log(`  ✓ ${moduleName} rebuilt`);
			} catch (e) {
				warn(`  Failed to rebuild ${moduleName}: ${e.message}`);
			}
		});
	}
}

/**
 * Fix Puppeteer setup (used for video export)
 */
function fixPuppeteer() {
	log('Checking Puppeteer setup...');
	
	try {
		if (moduleExists('puppeteer')) {
			log('✓ Puppeteer module found');
			
			// Check if Chromium is available
			try {
				const puppeteer = require('puppeteer');
				
				// Puppeteer will download Chromium on first use if needed
				log('✓ Puppeteer is ready (Chromium will download on first export)');
			} catch (e) {
				warn(`Puppeteer validation failed: ${e.message}`);
			}
		} else {
			warn('Puppeteer module not found');
		}
	} catch (e) {
		error(`Puppeteer setup failed: ${e.message}`);
	}
}

/**
 * Fix module permissions on Unix
 */
function fixPermissions() {
	if (os.platform() === 'win32') {
		return; // Skip on Windows
	}
	
	log('Fixing module permissions on Unix...');
	
	const binaryPaths = [
		path.join(NODE_MODULES, 'sharp', 'build', 'Release', 'sharp.node'),
		path.join(NODE_MODULES, '.bin', 'sharp'),
	];
	
	binaryPaths.forEach(binaryPath => {
		if (fs.existsSync(binaryPath)) {
			try {
				fs.chmodSync(binaryPath, 0o755);
				log(`✓ Fixed permissions: ${path.basename(binaryPath)}`);
			} catch (e) {
				warn(`Failed to fix permissions for ${binaryPath}: ${e.message}`);
			}
		}
	});
}

/**
 * Validate project structure
 */
function validateStructure() {
	log('Validating project structure...');
	
	const requiredDirs = [
		'wrapper',
		'server',
		'_THEMES',
		'_ASSETS',
	];
	
	const requiredFiles = [
		'main.js',
		'package.json',
		'wrapper/server.js',
	];
	
	requiredDirs.forEach(dir => {
		const dirPath = path.join(PROJECT_ROOT, dir);
		if (fs.existsSync(dirPath)) {
			log(`✓ ${dir}/ exists`);
		} else {
			error(`Missing directory: ${dir}/`);
		}
	});
	
	requiredFiles.forEach(file => {
		const filePath = path.join(PROJECT_ROOT, file);
		if (fs.existsSync(filePath)) {
			log(`✓ ${file} exists`);
		} else {
			error(`Missing file: ${file}`);
		}
	});
}

/**
 * Main execution
 */
function main() {
	log('Starting post-installation fixes...');
	log(`Platform: ${os.platform()}`);
	log(`Node version: ${process.version}`);
	log('');
	
	try {
		fixFFmpeg();
		log('');
		
		fixPuppeteer();
		log('');
		
		fixSharp();
		log('');
		
		fixNativeModules();
		log('');
		
		fixPermissions();
		log('');
		
		validateStructure();
		log('');
		
		log('✓ Post-installation fixes completed!');
		process.exit(0);
	} catch (e) {
		error(`Unexpected error: ${e.message}`);
		console.error(e);
		process.exit(1);
	}
}

// Run if called directly
if (require.main === module) {
	main();
}

module.exports = { fixFFmpeg, fixSharp, fixNativeModules, fixPuppeteer };

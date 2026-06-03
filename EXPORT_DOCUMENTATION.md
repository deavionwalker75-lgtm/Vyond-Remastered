# Video Export Feature

## Overview

Vyond Remastered now includes video export functionality! This allows you to export your animations as video files in multiple formats (MP4, WebM, MOV).

## Features

- **Multiple Formats**: Export to MP4, WebM, or MOV
- **Quality Options**: Choose between high, medium, and low quality
- **Automatic Frame Extraction**: Frames are automatically extracted from your animations
- **FFmpeg Integration**: Uses industry-standard FFmpeg for encoding
- **Progress Tracking**: Monitor export job status

## API Usage

### Export a Movie

**Endpoint**: `POST /goapi/exportMovie/`

**Query Parameters**:
- `movieId` (required): The ID of the movie to export
- `format` (optional): Video format - `mp4`, `webm`, or `mov` (default: `mp4`)
- `quality` (optional): Video quality - `low`, `medium`, or `high` (default: `medium`)

**Example**:
```bash
curl -X POST "http://localhost:8080/goapi/exportMovie/?movieId=abc123&format=mp4&quality=high"
```

**Response**: Binary video file with appropriate Content-Type header

**Error Response**:
```json
{
  "error": "Error message describing the failure"
}
```

### Check Export Status

**Endpoint**: `GET /api/export/status/:exportId`

**Example**:
```bash
curl "http://localhost:8080/api/export/status/a1b2c3d"
```

**Response**:
```json
{
  "status": "encoding",
  "progress": 75,
  "movieId": "abc123",
  "format": "mp4",
  "quality": "high",
  "startTime": 1234567890000,
  "outputSize": 5242880
}
```

## Export Process

1. **Frame Extraction**: The system extracts frames from your animation
   - If Puppeteer is available, it will render actual animation frames
   - Otherwise, it uses the movie thumbnail as a base frame
   
2. **Video Encoding**: Frames are encoded using FFmpeg
   - Respects the specified quality settings
   - Optimizes for different output formats

3. **Delivery**: The final video file is downloaded

## Quality Settings

### MP4 Format
- **High**: Fast encoding, CRF 18 (best quality)
- **Medium**: Balanced encoding, CRF 23
- **Low**: Ultra-fast encoding, CRF 28 (smaller file size)

### WebM Format
- **High**: 5000 kbps
- **Medium**: 2500 kbps
- **Low**: 1000 kbps

### MOV Format
- **High**: qscale 5
- **Medium**: qscale 6
- **Low**: qscale 8

## System Requirements

- Node.js with FFmpeg installed
- Puppeteer (optional, for advanced frame extraction)
- Sufficient disk space for temporary files

## Troubleshooting

### Export Fails with "movieId required"
Make sure you're providing a valid `movieId` parameter in your request.

### Export Times Out
Large animations may take longer to export. Try with lower quality settings for faster processing.

### Video File is Corrupted
Check that FFmpeg is properly installed:
```bash
ffmpeg -version
```

### Frame Extraction Fails
The system will automatically fall back to using the movie thumbnail if Puppeteer frame extraction fails. This is expected behavior.

## Configuration

The export system uses these environment variables:
- `PORT`: Server port (default: 8080)
- `SAVED_FOLDER`: Where saved movies are stored

## Future Enhancements

- Real-time frame capture from Flash animations
- Multi-format simultaneous export
- Batch export functionality
- Custom audio track support
- Advanced encoding options UI

# Local Network File Browser with Thumbnails

A web application for browsing folders and files on your local network with thumbnail previews, including animated video loop thumbnails. Optimized for handling large directories with many videos through pagination and efficient thumbnail loading.

## Architecture

- **Backend**: Node.js/Fastify API server with TypeScript
- **Frontend**: React SPA with TypeScript and modern UI
- **Configuration**: JSON file for folder paths
- **Authentication**: Basic HTTP authentication with JWT
- **Thumbnails**: Generated on-demand with caching and batch processing
- **Performance**: Pagination, lazy loading, virtual scrolling, thumbnail caching

## Project Structure

```
previewd/
├── server/          # Fastify backend
│   ├── src/
│   ├── tsconfig.json
│   ├── biome.json
│   └── package.json
├── client/          # React frontend
│   ├── src/
│   ├── tsconfig.json
│   ├── biome.json
│   └── package.json
├── package.json     # Root workspace scripts
├── biome.json       # Root Biome config
└── README.md
```

## Prerequisites

- Node.js 18+ and npm
- FFmpeg (for video thumbnail generation)
  - Windows: Download from [ffmpeg.org](https://ffmpeg.org/download.html) and add to PATH
  - macOS: `brew install ffmpeg`
  - Linux: `sudo apt-get install ffmpeg` or `sudo yum install ffmpeg`

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure folders**:
   Edit `server/src/config/folders.json` to add your folder paths:
   ```json
   {
     "folders": [
       {
         "name": "Photos",
         "path": "C:/Users/Username/Pictures",
         "enabled": true
       }
     ]
   }
   ```

3. **Set up environment variables** (optional):
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

## Running the Application

Run the servers in **separate terminals** for better visibility and debugging:

**Terminal 1 - Backend Server:**
```bash
npm run dev:server
```
Starts the Fastify backend on port 3000.

**Terminal 2 - Frontend Server:**
```bash
npm run dev:client
```
Starts the Vite frontend on port 5173.

The frontend will automatically proxy API requests to the backend.

## Available Scripts

### Root Level
- `npm run dev` - Run both servers concurrently
- `npm run dev:server` - Run only backend server
- `npm run dev:client` - Run only frontend server
- `npm run build` - Build both projects
- `npm run lint` - Lint both projects
- `npm run format` - Format code in both projects
- `npm run format:check` - Check formatting without fixing
- `npm run check` - Run both lint and format check

### Server (cd server)
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Lint code
- `npm run format` - Format code

### Client (cd client)
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Lint code
- `npm run format` - Format code

## API Endpoints

- `GET /api/folders` - List configured folders
- `GET /api/browse` - Browse directory with pagination
  - Query params: `path`, `page`, `limit`, `sortBy`, `sortOrder`
- `GET /api/thumbnail` - Get thumbnail for single file
  - Query params: `path`, `width`, `height`
- `GET /api/thumbnails/batch` - Batch thumbnail generation
  - Query params: `paths[]`, `width`, `height`
- `GET /api/video-preview` - Get video loop preview
  - Query params: `path`, `duration`
- `POST /api/open-file` - Open file with system default application
  - Body: `{ path: string }`
- `POST /api/login` - Authentication
- `GET /api/config` - Get configuration (authenticated)
- `POST /api/config` - Update configuration (authenticated)

## Features

- **Pagination**: Efficient directory browsing with configurable page size
- **Thumbnail Generation**: On-demand thumbnail generation for images and videos
- **Video Previews**: Animated video loop thumbnails
- **Virtual Scrolling**: Smooth performance with large directories
- **Thumbnail Size Control**: Adjustable thumbnail size with slider
- **Auto-sizing**: Responsive grid that adapts to window size
- **Lazy Loading**: Thumbnails load only when visible
- **Batch Processing**: Multiple thumbnails requested in single API call
- **File Opening**: Open files with system default application
- **Authentication**: Secure access with JWT tokens
- **Configuration Management**: Web-based folder configuration

## Code Quality

This project uses [Biome](https://biomejs.dev/) for linting and formatting. Run `npm run check` to verify code quality before committing.

## Security

- Path validation prevents directory traversal attacks
- Authentication required for configuration changes
- CORS configured for local network access
- File paths are validated against configured folders

## License

MIT


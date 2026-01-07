# Stacks

AI-powered infinite canvas workspace for notes, images, and creative organization.

## Features

- Infinite canvas with zoom and pan
- Notes, sticky notes, and text items
- Image support with EXIF metadata
- AI-powered organization and analysis
- Connect items with visual links
- Auto-arrange with ELK layout engine
- Auto-save to local storage
- MCP server for AI integration

## Installation

### Run with npx (no installation)

```bash
npx stacks-ai
```

On first run, Electron will be downloaded automatically (~100MB). Subsequent runs are instant.

### Install globally

```bash
npm install -g stacks-ai
stacks-ai
```

### Install from source

```bash
git clone https://github.com/jasonkneen/stacks.git
cd stacks
npm install
npm run build
npm run electron
```

## Development

```bash
# Install dependencies
npm install

# Run dev server (web only)
npm run dev

# Run Electron in dev mode
npm run electron:dev

# Build for production
npm run build:prod

# Run MCP server
npm run mcp:dev
```

## Environment Variables

Create a `.env` file in the root directory:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

## Package Structure

- `bin/` - CLI launcher script
- `electron/` - Electron main process
- `dist/` - Built application assets
- `mcp/` - Model Context Protocol server

## How it works

When you run `npx stacks-ai` or `stacks-ai`:

1. The launcher script checks if Electron is installed
2. If not, it downloads Electron (~100MB, cached in `~/.stacks/`)
3. The MCP proxy starts for AI integration
4. Electron loads the built app from `dist/`
5. The app runs entirely locally - no internet required (except for AI features)

## License

MIT

## Author

Jason Kneen

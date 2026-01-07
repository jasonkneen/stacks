# Stacks

AI-powered infinite canvas workspace for notes, images, and creative organization.

Free to use for personal use, one-time license of $49 for unrestricted usage - bit.ly/4aNe23d

Please consider a license

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

**Stacks Community License v1.0**

- **Personal Use**: Free to use, modify, and distribute for personal, non-commercial purposes
- **Open Source Distribution**: Free to fork, rebrand, and publish under a different name, provided it remains open source under this same license
- **Commercial Use**: Requires a one-time license fee of $49 USD. Commercial use includes any use within a business, for-profit organization, or any revenue-generating activity. Purchase at [bit.ly/4aNe23d](http://bit.ly/4aNe23d)

Commercial license grants unrestricted use of the code for your business.

See [LICENSE](LICENSE) for full terms.

## Author

Jason Kneen

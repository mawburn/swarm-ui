# SwarmUI Electron Desktop App

This directory contains the Electron wrapper for running SwarmUI as a desktop application.

## Architecture

The Electron app works by:

1. Starting a Rails server on an available port (default: 3000)
2. Starting a ttyd server for terminal emulation (default: 8999)
3. Opening an Electron window that loads the Rails app
4. Managing the lifecycle of both servers

## Key Features

- **No Redis dependency**: Uses ActionCable's async adapter in production mode
- **Automatic port finding**: Finds available ports if defaults are in use
- **Process management**: Properly starts and stops Rails and ttyd servers
- **Error handling**: Shows user-friendly errors if Ruby/Bundler are missing

## Development

### Prerequisites

- Ruby and Bundler installed on your system
- Node.js and pnpm
- ttyd (optional, will work without it)

### Running in Development

```bash
# Install dependencies
pnpm install

# Run the Electron app
pnpm run electron
```

### Building for Distribution

```bash
# Prepare the build (bundles Ruby gems and ttyd)
pnpm run prepare-build

# Build the distributable
pnpm run build
```

## Distribution Challenges

### Current Limitations

1. **Ruby Runtime**: Currently requires Ruby to be installed on the target system
   - Future: Implement traveling-ruby or similar for self-contained distribution

2. **Native Gems**: Some gems require compilation on the target system
   - Future: Pre-compile native extensions for target platforms

3. **ttyd Binary**: Currently downloads platform-specific binaries
   - Bundled in `bundled/binaries/` directory

4. **GitHub CLI**: Optional dependency, app detects and works without it
   - Shows appropriate messages if webhook features are used

### Production Considerations

For a production-ready distribution:

1. Use traveling-ruby or similar to bundle Ruby runtime
2. Pre-compile all native gem extensions
3. Bundle all required binaries (ttyd, etc.)
4. Sign the application for macOS/Windows
5. Create proper installers for each platform

## File Structure

```
electron/
├── main.js              # Electron main process
├── preload.js           # Preload script for security
├── entitlements.mac.plist # macOS entitlements
└── icon.png             # Application icon

scripts/
├── bundle-ruby.sh       # Script to bundle Ruby dependencies
└── bundle-ttyd.sh       # Script to download ttyd binaries

bundled/                 # Created by prepare-build
├── gems/                # Bundled Ruby gems
└── binaries/            # Platform-specific binaries
```

## Environment Variables

The Electron app sets these environment variables for Rails:

- `RAILS_ENV=production`
- `RAILS_SERVE_STATIC_FILES=true`
- `ACTION_CABLE_ADAPTER=async` (to avoid Redis dependency)
- `ELECTRON_APP=true` (to detect Electron environment)
- `TTYD_PORT` (dynamic based on available port)

## Troubleshooting

### Ruby not found

- Install Ruby using your system's package manager or from ruby-lang.org

### Bundler not found

- Run: `gem install bundler`

### ttyd issues

- The app will work without ttyd, terminal features will be disabled
- To install ttyd manually, see: https://github.com/tsl0922/ttyd

### Build failures

- Ensure all native dependencies are installed
- Check that scripts have execute permissions
- Review logs in the console for specific errors

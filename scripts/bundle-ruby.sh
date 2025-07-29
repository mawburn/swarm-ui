#!/bin/bash
# Script to bundle Ruby runtime for Electron distribution
# This uses the system Ruby for now, but can be extended to use traveling-ruby

set -e

echo "Bundling Ruby runtime and dependencies..."

# Create bundled directory
mkdir -p bundled/ruby
mkdir -p bundled/gems

# For now, we'll rely on the system Ruby being installed
# In production, we'd use traveling-ruby or similar solution
echo "Note: This version requires Ruby to be installed on the target system"
echo "TODO: Implement traveling-ruby for self-contained distribution"

# Bundle all gems locally
echo "Bundling gems..."
bundle config set --local path 'bundled/gems'
bundle config set --local without 'development test'
bundle install

# Create a script to set up the Ruby environment
cat > bundled/setup-ruby-env.sh << 'EOF'
#!/bin/bash
# Set up Ruby environment for bundled app
export BUNDLE_PATH="$(dirname "$0")/gems"
export BUNDLE_WITHOUT="development:test"
export RAILS_ENV="production"
EOF

chmod +x bundled/setup-ruby-env.sh

echo "Ruby bundling complete!"
echo "Note: This is a simplified version that requires Ruby on the target system."
echo "For production, implement traveling-ruby or similar embedded Ruby solution."

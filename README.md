# Pull Before Edit

Prevents you from editing code when there are unpulled changes from GitHub.

## Features
- Automatically detects if remote has changes
- Blocks typing until you pull
- Shows warning notification with "Pull Now" button
- Status bar indicator

## Usage
Just install and open any git repository. The extension will:
1. Check for remote changes every 10 seconds
2. If changes exist, you can't type until you pull
3. Click "Pull Now" when prompted

## Requirements
- Git installed on your system
- VS Code 1.85.0 or newer
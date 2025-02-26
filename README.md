# Mio - Discord Music Bot

A feature-rich Discord music bot written in TypeScript that provides high-quality music playback and queue management capabilities.

## Features

- 🎵 **Music Playback**
  - Play songs from YouTube links
  - Add entire playlists with a single command
  - Smart queue system
  - Automatic download management

- 🎚️ **Playback Controls**
  - Pause/Resume playback
  - Skip current song
  - Stop playback and clear queue
  - Shuffle queue

- 📋 **Queue Management**
  - View current queue with song details
  - Clear queue
  - Shows total duration of queue
  - Track who requested each song

- 🎨 **User Interface**
  - Clean and modern embeds
  - Detailed song information
  - Duration formatting (HH:MM:SS)
  - Queue preview with next songs

## Commands

- `!play <youtube-url>` - Play a song or add it to queue
- `!playlist <playlist-url>` - Add an entire YouTube playlist to queue
- `!pause` - Pause the current song
- `!resume` - Resume playback
- `!skip` - Skip to the next song
- `!stop` - Stop playback and clear queue
- `!clear` - Clear the queue except current song
- `!shuffle` - Shuffle the songs in queue
- `!queue` - Display the current queue

## Installation

TODO

## Requirements

- Node.js 16.x or higher
- npm or yarn
- Discord Bot Token
- YouTube Data API Key

## Configuration

The bot can be configured through environment variables in the `.env` file:

1. Copy `.env.example` to `.env`
2. Fill in your Discord bot token and client ID
3. Add your YouTube API key (see below)
4. Adjust other settings as needed

### Getting a YouTube API Key

To use the search functionality, you need a YouTube Data API key:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Navigate to "APIs & Services" > "Library"
4. Search for "YouTube Data API v3" and enable it
5. Go to "APIs & Services" > "Credentials"
6. Click "Create Credentials" > "API Key"
7. Copy the generated API key
8. Add it to your `.env` file as `YOUTUBE_API_KEY=your_key_here`

Note: The YouTube Data API has quotas. The free tier allows for 10,000 units per day, with each search operation consuming around 100 units.

## Contributing

Contributions are welcome! Please feel free to submit a pull request.
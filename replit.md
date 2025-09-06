# Overview

SoundLink is a real-time peer-to-peer video chat application that enables users to connect with strangers through WebRTC technology. The platform features user authentication, profile management, and includes chat functionality with file sharing capabilities. Users can skip connections to find new chat partners, similar to platforms like Omegle but with enhanced features including user profiles and multimedia sharing.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The application uses a multi-page vanilla JavaScript architecture with separate concerns:
- **Main Chat Interface** (`index.html` + `script.js`): Handles the primary video chat experience with WebRTC peer connections
- **Authentication Interface** (`login.html` + `login-db.js`): Manages user login/signup with animated form transitions
- **Client-side WebRTC** (`client.js`): Implements peer-to-peer video calling, data channels for chat, and file transfer with chunking

## Backend Architecture
- **Express.js Server** (`server.js`): Serves static files and handles WebSocket connections for signaling
- **WebSocket Signaling**: Manages peer discovery, connection establishment, and message routing between clients
- **Client Management**: Tracks connected users and their search status using in-memory data structures

## Real-time Communication
- **WebRTC**: Peer-to-peer video/audio streaming with STUN/TURN servers for NAT traversal
- **WebSocket Signaling**: Server-mediated initial connection establishment and peer matching
- **Data Channels**: Text chat and file transfer functionality over WebRTC data channels
- **File Transfer**: Chunked file upload system (16KB chunks) for handling large files

## Authentication & User Management
- **Supabase Integration**: Cloud-based authentication service with user profiles
- **Profile System**: User profiles with usernames, profile pictures, and verification status
- **Session Management**: Client-side session handling with Supabase auth tokens

## UI/UX Design
- **Responsive Layout**: CSS Grid/Flexbox layout supporting video feeds and chat interface
- **Animated Login Forms**: CSS transitions for sign-in/sign-up form switching
- **Real-time Chat Interface**: Message display with system notifications and file sharing

# External Dependencies

## Cloud Services
- **Supabase**: Backend-as-a-Service providing user authentication and profile database storage
- **Google STUN Server**: NAT traversal for WebRTC connections (`stun:stun.l.google.com:19302`)
- **OpenRelay TURN Servers**: Relay servers for WebRTC connections when direct peer-to-peer fails

## JavaScript Libraries
- **Supabase JavaScript Client**: CDN-loaded client library for database and authentication
- **Express.js**: Node.js web application framework for server-side routing
- **WebSocket (ws)**: Node.js WebSocket library for real-time signaling

## Browser APIs
- **WebRTC APIs**: MediaStream, RTCPeerConnection, RTCDataChannel for peer-to-peer communication
- **WebSocket API**: Client-side WebSocket implementation for signaling server communication
- **Media APIs**: getUserMedia for camera/microphone access, screen sharing capabilities
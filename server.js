const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files from public directory
app.use(express.static('public'));

// Also serve root level files (like database.js, etc.)
app.use(express.static('.', {
  dotfiles: 'ignore',
  index: false,
  setHeaders: (res, path) => {
    // Set no-cache headers for development
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

// Default route to serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Store connected clients and their search status
const clients = new Map(); // clientId -> websocket
const clientUsers = new Map(); // clientId -> userId (Supabase ID)
const searchingClients = new Set();
const partnerships = new Map(); // Track client partnerships

wss.on('connection', (ws) => {
  const clientId = generateClientId();
  clients.set(clientId, ws);
  
  console.log(`🔌 Client ${clientId} connected`);
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log(`📩 Message from ${clientId}:`, data.type);
      
      switch (data.type) {
        case 'search':
          handleSearch(clientId, ws, data.userId);
          break;
          
        case 'stopSearch':
          handleStopSearch(clientId);
          break;
          
        case 'skipToNext':
          handleSkipToNext(clientId, ws);
          break;
          
        case 'offer':
        case 'answer':
        case 'candidate':
          // Forward signaling messages to the paired client
          forwardToPartner(clientId, data);
          break;
          
        default:
          console.log(`⚠️ Unknown message type: ${data.type}`);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });
  
  ws.on('close', () => {
    console.log(`🔌 Client ${clientId} disconnected`);
    searchingClients.delete(clientId);
    
    // Clean up partnership
    const partnerId = partnerships.get(clientId);
    if (partnerId) {
      partnerships.delete(clientId);
      partnerships.delete(partnerId);
      
      // Notify partner if still connected
      const partnerWs = clients.get(partnerId);
      if (partnerWs && partnerWs.readyState === WebSocket.OPEN) {
        partnerWs.send(JSON.stringify({ type: 'skipToNext' }));
      }
    }
    
    // Clean up all client data
    clients.delete(clientId);
    clientUsers.delete(clientId);
  });
  
  ws.on('error', (error) => {
    console.error(`❌ WebSocket error for client ${clientId}:`, error);
  });
});

function generateClientId() {
  return Math.random().toString(36).substring(2, 15);
}

function handleSearch(clientId, ws, userId = null) {
  console.log(`🔍 Client ${clientId} started searching`);
  
  // Store user ID if provided
  if (userId) {
    clientUsers.set(clientId, userId);
    console.log(`👤 Client ${clientId} identified as user ${userId}`);
  }
  
  searchingClients.add(clientId);
  
  // Try to find another searching client
  const availableClients = Array.from(searchingClients).filter(id => id !== clientId);
  
  if (availableClients.length > 0) {
    // Pair with the first available client
    const partnerId = availableClients[0];
    const partnerWs = clients.get(partnerId);
    
    if (partnerWs && partnerWs.readyState === WebSocket.OPEN) {
      // Remove both from searching
      searchingClients.delete(clientId);
      searchingClients.delete(partnerId);
      
      // Store the partnership
      partnerships.set(clientId, partnerId);
      partnerships.set(partnerId, clientId);
      
      // Get actual user IDs for profile loading
      const currentUserUserId = clientUsers.get(clientId);
      const partnerUserId = clientUsers.get(partnerId);
      
      console.log(`🤝 Pairing clients ${clientId} (user: ${currentUserUserId}) and ${partnerId} (user: ${partnerUserId})`);
      
      // Notify both clients they found a peer with actual user IDs
      ws.send(JSON.stringify({
        type: 'peerFound',
        peerId: partnerUserId || partnerId, // Use Supabase user ID if available
        isCaller: true
      }));
      
      partnerWs.send(JSON.stringify({
        type: 'peerFound',
        peerId: currentUserUserId || clientId, // Use Supabase user ID if available
        isCaller: false
      }));
    }
  }
}

function handleStopSearch(clientId) {
  console.log(`🛑 Client ${clientId} stopped searching`);
  searchingClients.delete(clientId);
}

function handleSkipToNext(clientId, ws) {
  console.log(`👉 Client ${clientId} skipped to next`);
  
  // Find and notify the partner
  const partnerId = findPartner(clientId);
  if (partnerId) {
    const partnerWs = clients.get(partnerId);
    if (partnerWs && partnerWs.readyState === WebSocket.OPEN) {
      partnerWs.send(JSON.stringify({ type: 'skipToNext' }));
    }
  }
  
  // Start searching again
  handleSearch(clientId, ws);
}

function forwardToPartner(clientId, data) {
  const partnerId = findPartner(clientId);
  if (partnerId) {
    const partnerWs = clients.get(partnerId);
    if (partnerWs && partnerWs.readyState === WebSocket.OPEN) {
      partnerWs.send(JSON.stringify(data));
    }
  }
}

function findPartner(clientId) {
  return partnerships.get(clientId) || null;
}

const PORT = process.env.PORT || 5000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  console.log(`🔌 WebSocket server ready for connections`);
});
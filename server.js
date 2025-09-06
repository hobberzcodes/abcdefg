// =======================
// Chat + WebRTC Client
// =======================
document.addEventListener("DOMContentLoaded", async () => {
    const input = document.querySelector(".chat-input input");
    const sendBtn = document.querySelector(".send-btn");
    const chatBox = document.querySelector(".chat-box");
    const skipButton = document.getElementById("skipButton");
    const localVideo = document.getElementById("localVideo");
    const remoteVideo = document.getElementById("remoteVideo");
    const audioUploadInput = document.getElementById("audioUpload");
    const imageUploadInput = document.getElementById("imageUpload");
    const imageUploadButton = document.querySelector('label[for="imageUpload"]');

    let localStream;
    let peerConnection;
    let dataChannel;
    let isSearching = false;
    let searchTimeout;
    
    // File transfer variables
    const chunkSize = 16 * 1024; // 16 KB chunks
    let fileQueue = [];
    let isSendingFile = false;
    let receivedFileBuffer = [];
    let receivedFileMetadata = null;
    let lastChunkReceived = null;
    let lastSentChunkId = null;

    const configuration = {
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    };

    let wsUrl = location.origin.replace(/^http/, "ws");
    if (location.protocol === "https:") {
        wsUrl = wsUrl.replace("ws://", "wss://");
    }
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
        console.log("🔌 Connected to signaling server");
        appendSystemMessage("✅ Connected to signaling server");
        startSearch();
    };

    socket.onclose = () => {
        console.log("🔌 Disconnected from signaling server");
        appendSystemMessage("❌ Disconnected from signaling server");
    };

    socket.onerror = (err) => {
        console.error("⚠️ WebSocket error:", err);
        appendSystemMessage("⚠️ WebSocket error — check server logs");
    };

    socket.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        console.log("📩 Signaling message:", data);

        if (data.type === "peerFound") {
            isSearching = false;
            clearTimeout(searchTimeout);
            console.log("🤝 Peer found:", data.peerId);
            if (data.isCaller) {
                appendSystemMessage("🤝 Found a peer! Initiating call...");
                createOffer();
            } else {
                appendSystemMessage("🤝 Found a peer! Waiting for call...");
            }
        } else if (data.type === "offer") {
            console.log("📡 Received offer");
            if (peerConnection) {
                peerConnection.close();
            }
            peerConnection = new RTCPeerConnection(configuration);
            setupPeerConnection();
            await peerConnection.setRemoteDescription(data.offer);
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            socket.send(
                JSON.stringify({
                    type: "answer",
                    answer: peerConnection.localDescription,
                }),
            );
        } else if (data.type === "answer") {
            console.log("📡 Received answer");
            if (peerConnection) {
                await peerConnection.setRemoteDescription(data.answer);
            }
        } else if (data.type === "candidate") {
            console.log("📡 Received ICE candidate");
            if (peerConnection) {
                try {
                    await peerConnection.addIceCandidate(data.candidate);
                } catch (err) {
                    console.error("❌ Error adding ICE candidate", err);
                }
            }
        } else if (data.type === "skipToNext") {
            console.log("👉 Other user skipped. Automatically searching for next peer...");
            appendSystemMessage("👋 The other user skipped. Searching for a new connection...");
            resetConnection();
            chatBox.innerHTML = "";
            startSearch();
        }
    };

    async function initMedia() {
        try {
            localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });
            localVideo.srcObject = localStream;
            await new Promise((resolve) => (localVideo.onloadedmetadata = resolve));
            console.log("🎤 Camera and mic initialized and ready.");
        } catch (err) {
            console.error("❌ Error accessing camera/mic:", err);
            appendSystemMessage("🚨 Error: Please allow access to your camera and microphone.");
        }
    }
    await initMedia();

    function setupPeerConnection() {
        localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));
        peerConnection.ontrack = (event) => {
            console.log("🎥 Remote stream received");
            remoteVideo.srcObject = event.streams[0];
        };
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.send(
                    JSON.stringify({ type: "candidate", candidate: event.candidate }),
                );
            }
        };
        peerConnection.ondatachannel = (event) => {
            console.log("💬 Data channel received from remote peer.");
            dataChannel = event.channel;
            setupDataChannelListeners();
        };
    }

    async function createOffer() {
        if (peerConnection) {
            peerConnection.close();
        }
        peerConnection = new RTCPeerConnection(configuration);
        setupPeerConnection();
        dataChannel = peerConnection.createDataChannel("chat");
        setupDataChannelListeners();

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.send(JSON.stringify({ type: "offer", offer }));
        console.log("📡 Sent offer");
    }

    function startSearch() {
        isSearching = true;
        appendSystemMessage("🔍 Searching for a new connection...");
        socket.send(JSON.stringify({ type: "search" }));
        searchTimeout = setTimeout(() => {
            if (isSearching) {
                appendSystemMessage("🤔 No one found. Searching again...");
                socket.send(JSON.stringify({ type: "search" }));
                startSearch();
            }
        }, 5000);
    }

    function resetConnection() {
        if (peerConnection) {
            peerConnection.close();
        }
        peerConnection = null;
        remoteVideo.srcObject = null;
        dataChannel = null;
        chatBox.innerHTML = "";
    }

    skipButton.addEventListener("click", () => {
        appendSystemMessage("📞 Disconnecting from current user.");
        socket.send(JSON.stringify({ type: "skipToNext" }));
        resetConnection();
        startSearch();
    });

    // =========================
    // Chat functions
    // =========================
    function appendMessage(text, sender = "You") {
        const msg = document.createElement("div");
        msg.classList.add("message");
        msg.innerHTML = `<span class="user ${sender === 'You' ? 'blue' : 'cyan'}">${sender}:</span> ${text}`;
        chatBox.appendChild(msg);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function appendAudioMessage(audioData, fileName, sender = "You") {
      const msg = document.createElement("div");
      msg.classList.add("message", "audio-message");

      const userSpan = document.createElement("span");
      userSpan.classList.add("user", sender === "You" ? "blue" : "cyan");
      userSpan.textContent = `${sender}:`;

      const audioPlayerContainer = document.createElement("div");
      audioPlayerContainer.classList.add("audio-player");

      const audioElement = new Audio(audioData);
      
      // Attempt to play the audio and catch any autoplay errors
      audioElement.play().catch(e => {
        console.warn('Autoplay prevented. The user must interact to play the audio.', e);
        // Optional: Provide a UI hint to the user to click the play button
      });

      audioPlayerContainer.innerHTML = `
        <div class="audio-controls">
            <button class="play-pause-btn">▶️</button>
            <div class="audio-time">
                <span class="current-time">0:00</span> / <span class="total-time">0:00</span>
            </div>
            <input type="range" class="audio-slider" value="0" step="0.01">
        </div>
        <a href="${audioData}" download="${fileName}" class="download-btn">⬇️</a>
      `;

      const playPauseBtn = audioPlayerContainer.querySelector(".play-pause-btn");
      const timeSlider = audioPlayerContainer.querySelector(".audio-slider");
      const currentTimeSpan = audioPlayerContainer.querySelector(".current-time");
      const totalTimeSpan = audioPlayerContainer.querySelector(".total-time");

      playPauseBtn.addEventListener("click", () => {
          if (audioElement.paused) {
              audioElement.play();
              playPauseBtn.textContent = "⏸️";
          } else {
              audioElement.pause();
              playPauseBtn.textContent = "▶️";
          }
      });

      audioElement.addEventListener("timeupdate", () => {
          const progress = (audioElement.currentTime / audioElement.duration) * 100;
          timeSlider.value = progress;

          const currentMinutes = Math.floor(audioElement.currentTime / 60);
          const currentSeconds = Math.floor(audioElement.currentTime % 60);
          currentTimeSpan.textContent = `${currentMinutes}:${currentSeconds < 10 ? '0' : ''}${currentSeconds}`;
      });

      audioElement.addEventListener("loadedmetadata", () => {
          const totalMinutes = Math.floor(audioElement.duration / 60);
          const totalSeconds = Math.floor(audioElement.duration % 60);
          totalTimeSpan.textContent = `${totalMinutes}:${totalSeconds < 10 ? '0' : ''}${totalSeconds}`;
      });

      timeSlider.addEventListener("input", () => {
          const newTime = (timeSlider.value / 100) * audioElement.duration;
          audioElement.currentTime = newTime;
      });

      msg.appendChild(userSpan);
      msg.appendChild(audioPlayerContainer);
      chatBox.appendChild(msg);
      chatBox.scrollTop = chatBox.scrollHeight;
    }

    function appendImageMessage(imageData, sender = "You") {
      const msg = document.createElement("div");
      msg.classList.add("message", "image-message");

      const userSpan = document.createElement("span");
      userSpan.classList.add("user", sender === "You" ? "blue" : "cyan");
      userSpan.textContent = `${sender}:`;

      const imageContainer = document.createElement("div");
      imageContainer.classList.add("image-container");

      const imageElement = document.createElement("img");
      imageElement.src = imageData;

      imageContainer.appendChild(imageElement);

      msg.appendChild(userSpan);
      msg.appendChild(imageContainer);
      chatBox.appendChild(msg);
      chatBox.scrollTop = chatBox.scrollHeight;
    }

    function appendSystemMessage(text) {
        const msg = document.createElement("div");
        msg.classList.add("message", "system");
        msg.innerHTML = `<span class="user red">[System]</span> ${text}`;
        chatBox.appendChild(msg);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function sendMessage() {
        const text = input.value.trim();
        if (text !== "" && dataChannel && dataChannel.readyState === "open") {
            const message = JSON.stringify({
                type: "textMessage",
                content: text
            });
            dataChannel.send(message);
            appendMessage(text, "You");
            input.value = "";
        } else if (!dataChannel || dataChannel.readyState !== "open") {
            appendSystemMessage("🚨 Cannot send message. Chat channel is not connected.");
        }
    }
    
    // Sends the next chunk in the queue
    function sendNextFileChunk() {
        if (!dataChannel || dataChannel.readyState !== 'open' || !fileQueue.length || isSendingFile) {
            return;
        }

        isSendingFile = true;
        const fileTransfer = fileQueue[0];
        const file = fileTransfer.file;
        const fileId = fileTransfer.id;
        const totalChunks = Math.ceil(file.size / chunkSize);

        const sendChunk = (i) => {
            if (i >= totalChunks) {
                console.log(`✅ File transfer complete for file ${fileId}`);
                isSendingFile = false;
                fileQueue.shift(); // Remove the completed transfer
                sendNextFileChunk(); // Start the next transfer in the queue
                return;
            }

            const start = i * chunkSize;
            const end = Math.min(file.size, start + chunkSize);
            const chunk = file.slice(start, end);
            const reader = new FileReader();

            reader.onload = (e) => {
                const chunkData = e.target.result;
                const message = JSON.stringify({
                    type: 'fileChunk',
                    fileId,
                    chunkIndex: i,
                    chunkData: Array.from(new Uint8Array(chunkData)), // Convert to array for JSON
                    totalChunks,
                    fileName: file.name,
                    fileType: file.type
                });

                // This logic is crucial for flow control
                if (dataChannel.bufferedAmount > 64 * 1024) {
                    // Pause sending if the buffer is full
                    console.log(`⏸️ DataChannel buffer full. Waiting...`);
                    dataChannel.onbufferedamountlow = () => {
                        dataChannel.onbufferedamountlow = null;
                        sendChunk(i);
                    };
                    return;
                }

                dataChannel.send(message);
                console.log(`📤 Sending chunk ${i + 1} of ${totalChunks}`);
                sendChunk(i + 1);
            };

            reader.readAsArrayBuffer(chunk);
        };

        // Start the transfer
        sendChunk(0);
    }
    
    // Receives a file chunk
    function receiveFileChunk(message) {
        const { fileId, chunkIndex, chunkData, totalChunks, fileName, fileType } = message;

        // Check for a new file transfer
        if (!receivedFileMetadata || receivedFileMetadata.id !== fileId) {
            receivedFileBuffer = new Array(totalChunks);
            receivedFileMetadata = { id: fileId, name: fileName, type: fileType, totalChunks };
            appendSystemMessage(`📦 Receiving new file: ${fileName} (${totalChunks} chunks)`);
        }
        
        // Store the chunk as a Uint8Array
        receivedFileBuffer[chunkIndex] = new Uint8Array(chunkData);

        // Check if all chunks have been received
        const receivedAllChunks = receivedFileBuffer.every(chunk => chunk !== undefined);
        if (receivedAllChunks) {
            // Reconstruct the file from the received chunks
            const fileBlob = new Blob(receivedFileBuffer, { type: receivedFileMetadata.type });
            const fileUrl = URL.createObjectURL(fileBlob);

            if (receivedFileMetadata.type.startsWith('audio/')) {
                appendAudioMessage(fileUrl, receivedFileMetadata.name, 'Friend');
            } else if (receivedFileMetadata.type.startsWith('image/')) {
                appendImageMessage(fileUrl, 'Friend');
            }
            
            appendSystemMessage(`✅ File received and displayed: ${receivedFileMetadata.name}`);
            
            // Reset for the next file
            receivedFileBuffer = [];
            receivedFileMetadata = null;
        }
    }


    function setupDataChannelListeners() {
        if (!dataChannel) return;
        dataChannel.onopen = () => {
            console.log("💬 Data channel open");
            appendSystemMessage("💬 Chat channel connected");
            sendNextFileChunk(); // Start sending any queued files
        };
        
        dataChannel.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.type === 'textMessage') {
                    appendMessage(message.content, "Friend");
                } else if (message.type === 'fileChunk') {
                    receiveFileChunk(message);
                }
            } catch (e) {
                console.error("Failed to parse message or handle file chunk:", e);
                // Handle non-JSON data as a regular chat message
                appendMessage(event.data, "Friend");
            }
        };

        dataChannel.onclose = () => {
            console.log("💬 Data channel closed");
            appendSystemMessage("❌ Chat channel closed.");
        };
        dataChannel.onerror = (error) => {
            console.error("❌ Data channel error:", error);
            appendSystemMessage("⚠️ Chat channel error.");
        };
    }
    
    // New function to handle both audio and image file uploads
    function handleFileUpload(file, fileType) {
        if (dataChannel && dataChannel.readyState === "open") {
            const fileId = Date.now(); // Unique ID for this transfer
            const fileTransfer = { file, id: fileId, fileType };
            fileQueue.push(fileTransfer);
            appendSystemMessage(`📤 Queued file for sending: ${file.name}`);
            sendNextFileChunk();
        } else {
            appendSystemMessage(`🚨 Cannot send ${fileType}. Chat channel is not connected.`);
        }
    }

    audioUploadInput.addEventListener("change", (event) => {
        const file = event.target.files[0];
        if (file) {
            handleFileUpload(file, 'audio');
        }
    });

    imageUploadInput.addEventListener("change", (event) => {
        const file = event.target.files[0];
        if (file) {
            handleFileUpload(file, 'image');
        }
    });


    sendBtn.addEventListener("click", sendMessage);
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") sendMessage();
    });
});
// Require dependencies
const colors = require("colors/safe");

// Declare variables
const TIME_LIMIT = 10; // How often the socket can emit an event (ms)

// Socket.io socket middleware
function throttleConnections(socket) {
  return (packet, next) => {
    if (canBeServed(socket, packet)) {
      next(); // Proceed with emitting the event
    } else {
      socket.emit(
        "notify-error",
        "Slow down! You must wait a while before doing that again."
      );
    }
  };
}


// If socket connection can be served
function canBeServed(socket, packet) {
  // If socket is marked for disconnect, deny access
  if (socket.markedForDisconnect) return false;

  // Get last request timestamp
  const previous = socket.lastAccess;
  const now = Date.now();

  // If socket had previous interaction
  if (previous) {
    // Get time difference
    const diff = now - previous;

    // If it was an auth packet
    if (typeof packet === "object" && packet[0] && packet[0] === "auth") {
      // Else add a last access timestamp and move on
      socket.lastAccess = now;
      return true;
    }

    // Check the time difference and disconnect if needed
    if (diff < TIME_LIMIT) {
      // Deny access
      return false;
    }
  }

  // Else add a last access timestamp and move on
  socket.lastAccess = now;
  return true;
}

// Export the functions
module.exports = throttleConnections;

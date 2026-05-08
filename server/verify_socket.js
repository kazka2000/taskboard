const { io } = require("socket.io-client");

const socket = io("http://localhost:3000");

socket.on("connect", () => {
    console.log("Connected to server with ID:", socket.id);

    // Join project room
    console.log("Joining project 1...");
    socket.emit("joinProject", 1);
});

socket.on("taskMoved", (data) => {
    console.log("Received taskMoved:", data);
    process.exit(0);
});

socket.on("taskCreated", (data) => {
    console.log("Received taskCreated:", data);
});

// Timeout if no event received
setTimeout(() => {
    console.log("Timeout waiting for events. Maybe try triggering one?");
    // We will manually trigger one via API if possible, or just check connection for now.
    process.exit(0);
}, 5000);

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const connectDB = require('./Config/database');
const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const { authenticateSocket } = require('./middleware/auth');

require('dotenv').config();





const app = express();
const server = http.createServer(app);

// CORS configuration
const corsOptions = {
  origin: 'https://chatrix-chat-application.vercel.app', // or '*'
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.get('/', (req, res) => {
  res.send("Hi How are you");
});

// Socket.IO setup with CORS
const io = socketIo(server, {
  cors: corsOptions
});

// Connect to MongoDB
connectDB();

// Middleware
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);

// Socket.IO connection handling
io.use(authenticateSocket);

const activeUsers = new Map();

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.user.email}`);
  
  // Store user socket
  activeUsers.set(socket.user.id, {
    socketId: socket.id,
    email: socket.user.email
  });

  // Emit updated user list
  io.emit('users_online', Array.from(activeUsers.values()));

  // Join user to their own room
  socket.join(socket.user.id);

  // Handle private messages
  socket.on('send_message', async (data) => {
    try {
      const { receiverId, message } = data;
      const senderId = socket.user.id;

      // Save message to database
      const Chat = require('./models/Chat');
      const newMessage = new Chat({
        sender: senderId,
        receiver: receiverId,
        message: message,
        timestamp: new Date()
      });

      await newMessage.save();
      await newMessage.populate(['sender', 'receiver']);

      // Send to receiver if online
      const receiverSocket = activeUsers.get(receiverId);
      if (receiverSocket) {
        io.to(receiverSocket.socketId).emit('receive_message', {
          id: newMessage._id,
          sender: {
            id: newMessage.sender._id,
            email: newMessage.sender.email
          },
          message: newMessage.message,
          timestamp: newMessage.timestamp
        });
      }

      // Send confirmation to sender
      socket.emit('message_sent', {
        id: newMessage._id,
        receiver: {
          id: newMessage.receiver._id,
          email: newMessage.receiver.email
        },
        message: newMessage.message,
        timestamp: newMessage.timestamp
      });

    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Handle typing indicators
  socket.on('typing_start', (data) => {
    const receiverSocket = activeUsers.get(data.receiverId);
    if (receiverSocket) {
      io.to(receiverSocket.socketId).emit('user_typing', {
        userId: socket.user.id,
        email: socket.user.email
      });
    }
  });

  socket.on('typing_stop', (data) => {
    const receiverSocket = activeUsers.get(data.receiverId);
    if (receiverSocket) {
      io.to(receiverSocket.socketId).emit('user_stopped_typing', {
        userId: socket.user.id
      });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.user.email}`);
    activeUsers.delete(socket.user.id);
    io.emit('users_online', Array.from(activeUsers.values()));
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
const Message = require('../models/Message');
const Chat = require('../models/Chat');
const User = require('../models/u');

const socketHandlers = (socket, io) => {
  
  // Join chat rooms
  socket.on('join_chat', async (chatId) => {
    try {
      // Verify user is part of this chat
      const chat = await Chat.findOne({
        _id: chatId,
        participants: socket.userId
      });

      if (chat) {
        socket.join(chatId);
        console.log(`User ${socket.userId} joined chat ${chatId}`);
      }
    } catch (error) {
      console.error('Join chat error:', error);
    }
  });

  // Leave chat room
  socket.on('leave_chat', (chatId) => {
    socket.leave(chatId);
    console.log(`User ${socket.userId} left chat ${chatId}`);
  });

  // Send message via socket
  socket.on('send_message', async (data) => {
    try {
      const { chatId, content, messageType = 'text', fileUrl, replyTo } = data;

      // Verify user is part of the chat
      const chat = await Chat.findOne({
        _id: chatId,
        participants: socket.userId
      });

      if (!chat) {
        socket.emit('error', { message: 'Chat not found or access denied' });
        return;
      }

      // Create new message
      const message = new Message({
        sender: socket.userId,
        chat: chatId,
        content,
        messageType,
        fileUrl: fileUrl || '',
        replyTo: replyTo || null
      });

      await message.save();

      // Update chat's last message
      chat.lastMessage = message._id;
      chat.lastMessageTime = new Date();
      await chat.save();

      // Populate message
      const populatedMessage = await Message.findById(message._id)
        .populate('sender', 'username userId profilePicture')
        .populate('replyTo');

      // Emit to all users in the chat
      io.to(chatId).emit('new_message', {
        message: populatedMessage,
        chatId: chatId
      });

      // Mark message as delivered to online users
      const participants = await Chat.findById(chatId).populate('participants');
      const deliveredTo = [];

      participants.participants.forEach(participant => {
        if (participant._id.toString() !== socket.userId && participant.isOnline) {
          deliveredTo.push({
            user: participant._id,
            deliveredAt: new Date()
          });
        }
      });

      if (deliveredTo.length > 0) {
        message.deliveredTo = deliveredTo;
        await message.save();
      }

    } catch (error) {
      console.error('Send message via socket error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Typing indicators
  socket.on('typing_start', (data) => {
    const { chatId } = data;
    socket.to(chatId).emit('user_typing', {
      userId: socket.userId,
      username: socket.user.username
    });
  });

  socket.on('typing_stop', (data) => {
    const { chatId } = data;
    socket.to(chatId).emit('user_stop_typing', {
      userId: socket.userId
    });
  });

  // Mark messages as read
  socket.on('mark_as_read', async (data) => {
    try {
      const { chatId, messageIds } = data;

      // Verify user is part of the chat
      const chat = await Chat.findOne({
        _id: chatId,
        participants: socket.userId
      });

      if (!chat) {
        return;
      }

      // Mark specific messages as read or all messages if no messageIds provided
      const query = messageIds && messageIds.length > 0 
        ? { _id: { $in: messageIds }, chat: chatId, sender: { $ne: socket.userId } }
        : { chat: chatId, sender: { $ne: socket.userId } };

      await Message.updateMany(
        {
          ...query,
          'readBy.user': { $ne: socket.userId }
        },
        {
          $push: {
            readBy: {
              user: socket.userId,
              readAt: new Date()
            }
          }
        }
      );

      // Emit read receipt to other users in the chat
      socket.to(chatId).emit('messages_read', {
        chatId: chatId,
        readBy: socket.userId,
        messageIds: messageIds
      });

    } catch (error) {
      console.error('Mark as read via socket error:', error);
    }
  });

  // Online status updates
  socket.on('update_status', async (status) => {
    try {
      const user = await User.findById(socket.userId);
      if (user) {
        user.isOnline = status === 'online';
        user.lastSeen = new Date();
        await user.save();

        // Broadcast status update to all connected users
        socket.broadcast.emit('user_status_update', {
          userId: socket.userId,
          isOnline: user.isOnline,
          lastSeen: user.lastSeen
        });
      }
    } catch (error) {
      console.error('Update status error:', error);
    }
  });

  // Handle disconnection
  socket.on('disconnect', async () => {
    try {
      console.log(`User ${socket.userId} disconnected`);
      
      // Update user's offline status
      const user = await User.findById(socket.userId);
      if (user) {
        user.isOnline = false;
        user.lastSeen = new Date();
        user.socketId = '';
        await user.save();

        // Broadcast offline status to all connected users
        socket.broadcast.emit('user_status_update', {
          userId: socket.userId,
          isOnline: false,
          lastSeen: user.lastSeen
        });
      }
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  });

  // Handle connection errors
  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
  });
};

module.exports = socketHandlers;
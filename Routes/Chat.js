const express = require('express');
const { authenticate } = require('../middleware/auth');
const Chat = require('../models/Chat');
const User = require('../models/User');
const mongoose=require("mongoose")
const router = express.Router();

// @route   GET /api/chat/users
// @desc    Get all users except current user
// @access  Private
router.get('/users', authenticate, async (req, res) => {
  try {
    const users = await User.find({ 
      _id: { $ne: req.user._id } 
    }).select('name email isOnline lastSeen');

    res.json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/chat/messages/:userId
// @desc    Get chat messages between current user and specified user
// @access  Private


// Utility to validate MongoDB ObjectIds
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// @route   GET /api/chat/users
// @desc    Get all users except current user
// @access  Private
router.get('/users', authenticate, async (req, res) => {
  try {
    const users = await User.find({ 
      _id: { $ne: req.user._id } 
    }).select('name email isOnline lastSeen');

    res.json({ success: true, users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/chat/messages/:userId
// @desc    Get chat messages between current user and specified user
// @access  Private
router.get('/messages/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    if (!isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const messages = await Chat.find({
      $or: [
        { sender: req.user._id, receiver: userId },
        { sender: userId, receiver: req.user._id }
      ]
    })
      .populate('sender', 'name email')
      .populate('receiver', 'name email')
      .sort({ timestamp: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    await Chat.updateMany(
      { sender: userId, receiver: req.user._id, isRead: false },
      { isRead: true }
    );

    res.json({
      success: true,
      messages: messages.reverse(),
      pagination: { page: parseInt(page), limit: parseInt(limit) }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/chat/send
// @desc    Send a message (HTTP endpoint as backup to Socket.IO)
// @access  Private
router.post('/send', authenticate, async (req, res) => {
  try {
    const { receiverId, message } = req.body;

    if (!receiverId || !message) {
      return res.status(400).json({ success: false, message: 'Receiver ID and message are required' });
    }

    if (!isValidObjectId(receiverId)) {
      return res.status(400).json({ success: false, message: 'Invalid receiver ID' });
    }

    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ success: false, message: 'Receiver not found' });
    }

    const newMessage = new Chat({
      sender: req.user._id,
      receiver: receiverId,
      message: message.trim()
    });

    await newMessage.save();
    await newMessage.populate(['sender', 'receiver']);

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: {
        id: newMessage._id,
        sender: {
          id: newMessage.sender._id,
          name: newMessage.sender.name,
          email: newMessage.sender.email
        },
        receiver: {
          id: newMessage.receiver._id,
          name: newMessage.receiver.name,
          email: newMessage.receiver.email
        },
        message: newMessage.message,
        timestamp: newMessage.timestamp,
        isRead: newMessage.isRead
      }
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/chat/conversations
// @desc    Get all conversations for current user
// @access  Private
router.get('/conversations', authenticate, async (req, res) => {
  try {
    const conversations = await Chat.aggregate([
      {
        $match: {
          $or: [
            { sender: req.user._id },
            { receiver: req.user._id }
          ]
        }
      },
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$sender', req.user._id] },
              '$receiver',
              '$sender'
            ]
          },
          lastMessage: { $first: '$message' },
          lastMessageTime: { $first: '$timestamp' },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$receiver', req.user._id] }, { $eq: ['$isRead', false] }] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          user: {
            id: '$user._id',
            name: '$user.name',
            email: '$user.email',
            isOnline: '$user.isOnline',
            lastSeen: '$user.lastSeen'
          },
          lastMessage: 1,
          lastMessageTime: 1,
          unreadCount: 1
        }
      },
      { $sort: { lastMessageTime: -1 } }
    ]);

    res.json({ success: true, conversations });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/chat/mark-read/:userId
// @desc    Mark all messages from a user as read
// @access  Private
router.put('/mark-read/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;

    if (!isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }

    await Chat.updateMany(
      { sender: userId, receiver: req.user._id, isRead: false },
      { isRead: true }
    );

    res.json({ success: true, message: 'Messages marked as read' });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});








// @route   POST /api/chat/send
// @desc    Send a message (HTTP endpoint as backup to Socket.IO)
// @access  Private
router.post('/send', authenticate, async (req, res) => {
  try {
    const { receiverId, message } = req.body;

    // Validate input
    if (!receiverId || !message) {
      return res.status(400).json({
        success: false,
        message: 'Receiver ID and message are required'
      });
    }

    // Check if receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: 'Receiver not found'
      });
    }

    // Create new message
    const newMessage = new Chat({
      sender: req.user._id,
      receiver: receiverId,
      message: message.trim()
    });

    await newMessage.save();
    await newMessage.populate(['sender', 'receiver']);

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: {
        id: newMessage._id,
        sender: {
          id: newMessage.sender._id,
          name: newMessage.sender.name,
          email: newMessage.sender.email
        },
        receiver: {
          id: newMessage.receiver._id,
          name: newMessage.receiver.name,
          email: newMessage.receiver.email
        },
        message: newMessage.message,
        timestamp: newMessage.timestamp,
        isRead: newMessage.isRead
      }
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/chat/conversations
// @desc    Get all conversations for current user
// @access  Private
router.get('/conversations', authenticate, async (req, res) => {
  try {
    // Get all unique users the current user has chatted with
    const conversations = await Chat.aggregate([
      {
        $match: {
          $or: [
            { sender: req.user._id },
            { receiver: req.user._id }
          ]
        }
      },
      {
        $sort: { timestamp: -1 }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$sender', req.user._id] },
              '$receiver',
              '$sender'
            ]
          },
          lastMessage: { $first: '$message' },
          lastMessageTime: { $first: '$timestamp' },
          unreadCount: {
            $sum: {
              $cond: [
                { 
                  $and: [
                    { $eq: ['$receiver', req.user._id] },
                    { $eq: ['$isRead', false] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          user: {
            id: '$user._id',
            name: '$user.name',
            email: '$user.email',
            isOnline: '$user.isOnline',
            lastSeen: '$user.lastSeen'
          },
          lastMessage: 1,
          lastMessageTime: 1,
          unreadCount: 1
        }
      },
      {
        $sort: { lastMessageTime: -1 }
      }
    ]);

    res.json({
      success: true,
      conversations
    });

  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/chat/mark-read/:userId
// @desc    Mark all messages from a user as read
// @access  Private
router.put('/mark-read/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;

    await Chat.updateMany(
      {
        sender: userId,
        receiver: req.user._id,
        isRead: false
      },
      { isRead: true }
    );

    res.json({
      success: true,
      message: 'Messages marked as read'
    });

  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
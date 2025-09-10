# WhatsApp-Like Chat Application Backend

A real-time chat application backend built with Node.js, Express, Socket.io, and MongoDB. Features include user registration, finding users by ID, real-time messaging, typing indicators, message read receipts, and online status updates.

## Features

- 🔐 User authentication (register/login)
- 👤 Find users by unique User ID (like Telegram)
- 💬 Real-time messaging with Socket.io
- 👥 One-on-one and group chats
- ✅ Message read receipts
- 📱 Online/offline status tracking
- ⌨️ Typing indicators
- 🗑️ Delete messages (for self or everyone)
- 📝 Reply to messages
- 🔍 Search users by ID, username, or email

## Tech Stack

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **Socket.io** - Real-time communication
- **MongoDB** - Database
- **Mongoose** - MongoDB object modeling
- **bcrypt** - Password hashing
- **JWT** - Authentication tokens
- **CORS** - Cross-origin resource sharing

## Installation

1. Clone the repository
```bash
git clone <repository-url>
cd whatsapp-like-chat-backend
```

2. Install dependencies
```bash
npm install
```

3. Create a `.env` file in the root directory:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/whatsapp-clone
JWT_SECRET=your-super-secret-jwt-key-here
```

4. Start MongoDB service on your system

5. Run the application
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## API Endpoints

### Authentication Routes (`/api/auth`)

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user info

### User Routes (`/api/users`)

- `GET /api/users/search/:query` - Search users by ID/username/email
- `GET /api/users/find/:userId` - Find user by exact User ID
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/status/:userId` - Get user's online status

### Chat Routes (`/api/chats`)

- `POST /api/chats/create` - Create or get existing chat
- `GET /api/chats` - Get user's chats
- `GET /api/chats/:chatId` - Get specific chat
- `POST /api/chats/group/create` - Create group chat
- `DELETE /api/chats/:chatId` - Delete chat

### Message Routes (`/api/messages`)

- `GET /api/messages/:chatId` - Get messages for a chat
- `POST /api/messages/send` - Send message
- `PUT /api/messages/read/:chatId` - Mark messages as read
- `DELETE /api/messages/:messageId` - Delete message

## Socket.io Events

### Client to Server Events

- `join_chat` - Join a chat room
- `leave_chat` - Leave a chat room
- `send_message` - Send a message
- `typing_start` - User starts typing
- `typing_stop` - User stops typing
- `mark_as_read` - Mark messages as read
- `update_status` - Update online status

### Server to Client Events

- `new_message` - New message received
- `user_typing` - User is typing
- `user_stop_typing` - User stopped typing
- `messages_read` - Messages marked as read
- `message_deleted` - Message was deleted
- `user_status_update` - User's online status changed

## Usage Examples

### 1. Register a User
```javascript
POST /api/auth/register
{
  "username": "john_doe",
  "userId": "john123",
  "email": "john@example.com",
  "password": "password123"
}
```

### 2. Login
```javascript
POST /api/auth/login
{
  "identifier": "john123", // Can be email, username, or userId
  "password": "password123"
}
```

### 3. Find a User by ID
```javascript
GET /api/users/find/jane456
Authorization: Bearer <token>
```

### 4. Create/Start a Chat
```javascript
POST /api/chats/create
Authorization: Bearer <token>
{
  "participantUserId": "jane456"
}
```

### 5. Send a Message
```javascript
POST /api/messages/send
Authorization: Bearer <token>
{
  "chatId": "60f7b1234567890123456789",
  "content": "Hello there!",
  "messageType": "text"
}
```

## Socket.io Client Connection

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: {
    token: 'your-jwt-token-here'
  }
});

// Join a chat
socket.emit('join_chat', 'chatId');

// Send a message
socket.emit('send_message', {
  chatId: 'chatId',
  content: 'Hello!',
  messageType: 'text'
});

// Listen for new messages
socket.on('new_message', (data) => {
  console.log('New message:', data.message);
});

// Listen for typing indicators
socket.on('user_typing', (data) => {
  console.log(`${data.username} is typing...`);
});
```

## Project Structure

```
├── models/
│   ├── User.js          # User model
│   ├── Chat.js          # Chat model
│   └── Message.js       # Message model
├── routes/
│   ├── auth.js          # Authentication routes
│   ├── user.js          # User routes
│   ├── chat.js          # Chat routes
│   └── message.js       # Message routes
├── middleware/
│   ├── auth.js          # JWT authentication middleware
│   └── socketAuth.js    # Socket authentication middleware
├── socket/
│   └── socketHandlers.js # Socket.io event handlers
├── utils/
│   └── jwt.js           # JWT utilities
├── server.js            # Main server file
├── package.json         # Dependencies
└── .env                 # Environment variables
```

## Security Features

- Password hashing with bcrypt (12 salt rounds)
- JWT token authentication
- Protected routes with middleware
- Socket authentication
- Input validation and sanitization
- CORS configuration

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.
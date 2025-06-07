import { FaPaperPlane, FaEllipsisV, FaSearch, FaPaperclip, FaSmile } from 'react-icons/fa';

const ChatScreen = () => {
  const messages = [
    { id: 1, sender: 'other', text: 'Hey there! How are you doing?', time: '10:30 AM' },
    { id: 2, sender: 'me', text: 'I\'m great! Just finished my morning coffee ☕', time: '10:32 AM' },
    { id: 3, sender: 'other', text: 'Nice! What are your plans for the weekend?', time: '10:35 AM' },
    { id: 4, sender: 'me', text: 'Thinking about hiking. Any suggestions?', time: '10:37 AM' },
    { id: 5, sender: 'other', text: 'There\'s a beautiful trail near the lake. I can show you!', time: '10:40 AM' },
  ];

  return (
    <div className="flex h-[calc(100vh-100px)] bg-white rounded-2xl shadow-lg overflow-hidden">
      {/* Conversation List */}
      <div className="w-1/3 border-r border-gray-100 flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-[var(--dark)]">Messages</h3>
        </div>
        
        <div className="p-3 border-b border-gray-100">
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search messages..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)]"
            />
          </div>
        </div>
        
        <div className="overflow-y-auto flex-1">
          {[1, 2, 3, 4, 5].map((item) => (
            <div 
              key={item} 
              className="p-4 border-b border-gray-100 hover:bg-[var(--light)] cursor-pointer transition-colors"
            >
              <div className="flex items-center">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] flex items-center justify-center text-white font-semibold">
                  A
                </div>
                <div className="ml-3 flex-1 min-w-0">
                  <div className="flex justify-between">
                    <h4 className="font-semibold">Alex Johnson</h4>
                    <span className="text-xs text-[var(--text-light)]">10:40 AM</span>
                  </div>
                  <p className="text-sm text-[var(--text-light)] truncate">There's a beautiful trail near the lake...</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] flex items-center justify-center text-white font-semibold">
              A
            </div>
            <div className="ml-3">
              <h4 className="font-semibold">Alex Johnson</h4>
              <p className="text-xs text-[var(--text-light)]">Online</p>
            </div>
          </div>
          <button className="text-gray-500 hover:text-[var(--primary)]">
            <FaEllipsisV />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 bg-[var(--light)]">
          <div className="space-y-4">
            {messages.map((message) => (
              <div 
                key={message.id} 
                className={`max-w-[80%] ${message.sender === 'me' ? 'ml-auto' : ''}`}
              >
                <div 
                  className={`p-4 rounded-2xl ${
                    message.sender === 'me' 
                      ? 'bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] text-white rounded-br-none' 
                      : 'bg-white rounded-bl-none'
                  }`}
                >
                  {message.text}
                </div>
                <p className={`text-xs mt-1 ${message.sender === 'me' ? 'text-right' : ''}`}>
                  {message.time}
                </p>
              </div>
            ))}
          </div>
        </div>
        
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center">
            <button className="text-gray-500 hover:text-[var(--primary)] p-2">
              <FaPaperclip />
            </button>
            <button className="text-gray-500 hover:text-[var(--primary)] p-2">
              <FaSmile />
            </button>
            <input
              type="text"
              placeholder="Type a message..."
              className="flex-1 mx-2 py-3 px-4 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)]"
            />
            <button className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] flex items-center justify-center text-white hover:shadow-lg">
              <FaPaperPlane />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatScreen;
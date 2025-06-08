// frontend/src/pages/Messages.jsx

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from "../contexts/AuthContext";
import { useParams, useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaPaperPlane, FaCheckDouble, FaEllipsisV, FaCommentSlash, FaClock } from 'react-icons/fa';
import { formatDistanceToNow, isValid } from 'date-fns';
import api from '../services/api';
import { webSocketService } from '../services/websocketService';
import chatService from '../services/chatService';
import { toast } from 'react-toastify';
import './Messages.css';

const Messages = () => {
    const [conversations, setConversations] = useState([]);
    const [activeConversation, setActiveConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [typingUsers, setTypingUsers] = useState({});
    const messagesEndRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const { currentUser } = useAuth();
    const { conversationId: paramConversationId } = useParams();
    const navigate = useNavigate();

    useEffect(() => {
        if (!webSocketService.isConnected()) {
            webSocketService.connect();
        }
        const unsubscribeMessage = webSocketService.on('NEW_MESSAGE', handleNewMessage);
        const unsubscribeTyping = webSocketService.on('TYPING', handleTyping);
        fetchConversations();
        
        return () => {
            unsubscribeMessage();
            unsubscribeTyping();
        };
    }, []);

    useEffect(() => {
        if (paramConversationId && conversations.length > 0) {
            const conversation = conversations.find(c => c.id === parseInt(paramConversationId));
            if (conversation) {
                if (activeConversation?.id !== conversation.id) {
                    setActiveConversation(conversation);
                    fetchMessages(conversation.id);
                }
            }
        }
    }, [paramConversationId, conversations]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleNewMessage = useCallback((message) => {
        setMessages(prevMessages => {
            const tempId = `temp-${message.conversationId}-${message.content}`;
            const optimisticIndex = prevMessages.findIndex(m => m.id === tempId || (m.isSending && m.content === message.content));

            if (optimisticIndex > -1) {
                const newMessages = [...prevMessages];
                newMessages[optimisticIndex] = message;
                return newMessages;
            } else if (!prevMessages.some(m => m.id === message.id)) {
                 if (activeConversation && message.conversationId === activeConversation.id) {
                     return [...prevMessages, message];
                }
            }
            return prevMessages;
        });

        setConversations(prev => 
            prev.map(conv => 
                conv.id === message.conversationId ? { ...conv, lastMessage: message.content, updatedAt: message.createdAt } : conv
            ).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        );
    }, [activeConversation]);

    const handleTyping = useCallback((data) => {
        if (activeConversation && data.conversationId === activeConversation.id && data.userId !== currentUser.id) {
            setTypingUsers(prev => ({ ...prev, [data.userId]: data.isTyping ? (data.userName || 'Someone') : false }));
            if (data.isTyping) {
                setTimeout(() => setTypingUsers(prev => ({ ...prev, [data.userId]: false })), 3000);
            }
        }
    }, [activeConversation, currentUser?.id]);

    const fetchConversations = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get('/api/messages/conversations');
            const fetchedConversations = response.data.data || [];
            setConversations(fetchedConversations);
            
            if (!paramConversationId && fetchedConversations.length > 0) {
                navigate(`/messages/${fetchedConversations[0].id}`, { replace: true });
            }
        } catch (err) {
            console.error('Error fetching conversations:', err);
            setError('Failed to load conversations.');
        } finally {
            setLoading(false);
        }
    };

    const fetchMessages = async (conversationId) => {
        try {
            setLoading(true);
            const response = await api.get(`/api/messages/${conversationId}/messages`);
            setMessages(response.data.data.reverse() || []);
        } catch (err) {
            console.error('Error fetching messages:', err);
            setError('Failed to load messages.');
        } finally {
            setLoading(false);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !activeConversation) return;

        const content = newMessage.trim();
        const tempId = `temp-${activeConversation.id}-${Date.now()}`;

        const optimisticMessage = {
            id: tempId,
            conversationId: activeConversation.id,
            senderId: currentUser.id,
            content: content,
            createdAt: new Date().toISOString(),
            isSending: true,
        };

        setMessages(prev => [...prev, optimisticMessage]);
        setNewMessage('');
        setIsSending(true);

        try {
            const response = await chatService.sendMessage(activeConversation.id, content);
            if (response.success) {
                setMessages(prev => prev.map(m => m.id === tempId ? response.data : m));
            } else {
                 throw new Error(response.error || 'Server rejected the message.');
            }
        } catch (err) {
            setMessages(prev => prev.filter(m => m.id !== tempId));
            setNewMessage(content);
            
            if (err.response?.status === 403 && err.response?.data?.code === 'MESSAGE_LIMIT_EXCEEDED') {
                toast.error(<div><p>Daily message limit reached.</p><button className="toast-upgrade-btn" onClick={() => navigate('/pricing')}>Upgrade</button></div>);
            } else {
                toast.error('Failed to send message.');
            }
        } finally {
            setIsSending(false);
        }
    };

    const handleTypingChange = () => {
        if (!activeConversation || !webSocketService.isConnected()) return;
        webSocketService.sendTypingIndicator(activeConversation.id, true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => webSocketService.sendTypingIndicator(activeConversation.id, false), 2000);
    };
    
    const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    const getOtherUser = (conversation) => conversation?.participants?.find(user => user.id !== currentUser.id) || {};
    
    const formatMessageTime = (timestamp) => {
        if (!timestamp) return '';
        try {
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) return '';
            return formatDistanceToNow(date, { addSuffix: true });
        } catch (error) {
            console.error("Could not format date:", timestamp, error);
            return '';
        }
    };
    
    const renderMessageStatus = (message) => {
        const messageSenderId = message.senderId || message.sender_id;
        if (messageSenderId !== currentUser.id) return null;

        if (message.isSending) return <FaClock className="message-status pending" />;
        if (message.readAt) return <FaCheckDouble className="message-status read" />;
        return <FaCheckDouble className="message-status delivered" />;
    };

    if (loading) {
        return <div className="messages-loading">Loading...</div>;
    }

    if (error) {
        return <div className="messages-error">{error}</div>;
    }

    if (!loading && conversations.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                <FaCommentSlash className="text-6xl mb-4 text-gray-400" />
                <h2 className="text-2xl font-semibold text-gray-700">No Conversations Yet</h2>
                <p className="mt-2">Start a conversation by visiting someone's profile or matching with them.</p>
                <button onClick={() => navigate('/discover')} className="mt-6 btn btn-primary">
                    Discover People
                </button>
            </div>
        );
    }

    return (
        <div className="messages-container">
            <div className={`conversations-sidebar ${activeConversation ? 'hide-on-mobile' : ''}`}>
                <div className="conversations-header"><h2>Messages</h2></div>
                <div className="conversations-list">
                    {conversations.map(conversation => {
                        const otherUser = getOtherUser(conversation);
                        return (
                            <div 
                                key={conversation.id}
                                className={`conversation-item ${activeConversation?.id === conversation.id ? 'active' : ''}`}
                                onClick={() => navigate(`/messages/${conversation.id}`)}
                            >
                                <div className="conversation-avatar">
                                    <img src={otherUser.profile_pic || '/default-avatar.png'} alt={otherUser.first_name || 'User'} />
                                </div>
                                <div className="conversation-details">
                                    <div className="conversation-header">
                                        <span className="conversation-name">{otherUser.first_name || 'User'}</span>
                                        <span className="conversation-time">{formatMessageTime(conversation.updatedAt)}</span>
                                    </div>
                                    <p className="conversation-preview">{conversation.lastMessage || 'No messages yet'}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            
            <div className={`chat-container ${!activeConversation ? 'hide-on-mobile' : ''}`}>
                {activeConversation ? (
                    <>
                        <div className="chat-header">
                            <button className="back-button" onClick={() => navigate('/messages')}><FaArrowLeft /></button>
                            <div className="chat-user-info">
                                <img src={getOtherUser(activeConversation).profile_pic || '/default-avatar.png'} alt={getOtherUser(activeConversation).first_name}/>
                                <div>
                                    <h3>{getOtherUser(activeConversation).first_name}</h3>
                                    {Object.values(typingUsers).some(Boolean) && <div className="typing-indicator">typing...</div>}
                                </div>
                            </div>
                            <button className="menu-button"><FaEllipsisV /></button>
                        </div>
                        <div className="messages-list">
                            {messages.map(message => {
                                // --- THIS IS THE FIX ---
                                // Check for both camelCase and snake_case property names.
                                const messageSenderId = message.senderId || message.sender_id;
                                const isSentByUser = messageSenderId === currentUser.id;

                                return (
                                    <div 
                                        key={message.id} 
                                        className={`message-wrapper ${isSentByUser ? 'sent' : 'received'}`}
                                    >
                                        <div className="message-content">
                                            {message.content}
                                            <div className="message-meta">
                                                <span className="message-time">{formatMessageTime(message.createdAt)}</span>
                                                {renderMessageStatus(message)}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>
                        <form className="message-input-container" onSubmit={handleSendMessage}>
                            <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={handleTypingChange} placeholder="Type a message..." className="message-input"/>
                            <button type="submit" className="send-button" disabled={!newMessage.trim() || isSending}>
                                <FaPaperPlane />
                            </button>
                        </form>
                    </>
                ) : (
                    <div className="no-conversation-selected">
                        <div className="no-conversation-message">
                            <h3>Select a conversation</h3>
                            <p>Choose from the list to start chatting.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Messages;
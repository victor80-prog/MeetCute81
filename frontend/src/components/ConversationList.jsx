import { useEffect, useState } from 'react';
import { useAuth } from "../contexts/AuthContext";
import { Link } from 'react-router-dom';

export default function ConversationList() {
  const { currentUser } = useAuth();
  const [conversations, setConversations] = useState([]);

  useEffect(() => {
    const fetchConversations = async () => {
      const res = await fetch('/api/messages/conversations', {
        headers: {
          'x-auth-token': currentUser.token
        }
      });
      const data = await res.json();
      setConversations(data);
    };
    fetchConversations();
  }, [currentUser]);

  return (
    <div className="space-y-2">
      {conversations.map(convo => (
        <Link
          key={convo.user_id}
          to={`/chat/${convo.user_id}`}
          className="flex items-center p-3 hover:bg-gray-100 rounded-lg"
        >
          <div className="w-10 h-10 bg-pink-500 rounded-full flex items-center justify-center text-white">
            {convo.first_name.charAt(0)}
          </div>
          <div className="ml-3">
            <h4 className="font-medium">{convo.first_name}</h4>
            <p className="text-sm text-gray-500 truncate max-w-xs">
              {convo.last_message}
            </p>
          </div>
          {convo.unread_count > 0 && (
            <span className="ml-auto bg-pink-500 text-white text-xs px-2 py-1 rounded-full">
              {convo.unread_count}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}
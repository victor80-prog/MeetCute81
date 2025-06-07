// /frontend/src/pages/Conversations.jsx
import ConversationList from '../components/ConversationList';

export default function Conversations() {
  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Your Conversations</h1>
      <ConversationList />
    </div>
  );
}
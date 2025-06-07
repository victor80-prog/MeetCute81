import React, { useState } from 'react';
import { FaGift, FaPlus } from 'react-icons/fa';
import { useAuth } from "../contexts/AuthContext";
import ReceivedGifts from '../components/Gifts/ReceivedGifts';
import SentGifts from '../components/Gifts/SentGifts';
import SendGiftModal from '../components/Gifts/SendGiftModal';

const Gifts = () => {
  const [activeTab, setActiveTab] = useState('received');
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [error, setError] = useState('');
  const { currentUser } = useAuth();

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setError('');
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'received':
        return <ReceivedGifts />;
      case 'sent':
        return <SentGifts />;
      default:
        return null;
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Please log in to view gifts</h2>
          <p className="mb-6 text-gray-600">You need to be logged in to send and receive gifts.</p>
          <a
            href="/login"
            className="bg-gradient-to-r from-blue-600 to-pink-600 hover:from-blue-700 hover:to-pink-700 text-white font-semibold py-2 px-6 rounded-lg shadow-lg transition-all duration-200"
          >
            Log In
          </a>
        </div>
      </div>
    );
  }

  const handleGiftSent = () => {
    // Refresh the sent gifts list when a new gift is sent
    setActiveTab('sent');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-8">
          <div className="text-center sm:text-left mb-4 sm:mb-0">
            <h1 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
              <FaGift className="inline-block mr-2 text-pink-500" />
              Gifts
            </h1>
            <p className="mt-2 text-xl text-gray-500">
              Send and receive gifts to show your appreciation
            </p>
          </div>
          <button
            onClick={() => setIsSendModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-full hover:from-pink-600 hover:to-purple-600 transition-all transform hover:scale-105 shadow-lg"
          >
            <FaPlus className="text-lg" />
            <span>Send Gift</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => handleTabChange('received')}
              className={`${
                activeTab === 'received'
                  ? 'border-pink-500 text-pink-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Received Gifts
            </button>
            <button
              onClick={() => handleTabChange('sent')}
              className={`${
                activeTab === 'sent'
                  ? 'border-pink-500 text-pink-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Sent Gifts
            </button>
          </nav>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content */}
        <div className="bg-white shadow rounded-lg p-6">
          {renderTabContent()}
        </div>
      </div>

      {/* Send Gift Modal */}
      <SendGiftModal
        isOpen={isSendModalOpen}
        onClose={() => setIsSendModalOpen(false)}
        onGiftSent={handleGiftSent}
      />
    </div>
  );
};

export default Gifts;

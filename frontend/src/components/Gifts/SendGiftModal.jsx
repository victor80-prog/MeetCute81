import { useState, useEffect } from 'react';
import { FaGift, FaTimes, FaSearch, FaUser, FaArrowLeft, FaCheck } from 'react-icons/fa';
import { giftsAPI, matchesAPI } from '../../services/api';

const SendGiftModal = ({ isOpen, onClose, onGiftSent }) => {
  const [giftItems, setGiftItems] = useState([]);
  const [selectedGift, setSelectedGift] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [matches, setMatches] = useState([]);
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (isOpen) {
      fetchGiftItems();
      fetchMatches();
    }
  }, [isOpen]);

  const fetchGiftItems = async () => {
    try {
      const items = await giftsAPI.getAvailableGifts();
      setGiftItems(Array.isArray(items) ? items : []);
    } catch (err) {
      console.error('Error fetching gift items:', err);
      setError('Failed to load gift items');
    }
  };

  const fetchMatches = async () => {
    try {
      const userMatches = await matchesAPI.getMatches();
      setMatches(Array.isArray(userMatches) ? userMatches : []);
    } catch (err) {
      console.error('Error fetching matches:', err);
      setError('Failed to load your matches');
    }
  };

  const handleSendGift = async () => {
    if (!selectedGift || !selectedRecipient) {
      setError('Please select both a gift and a recipient');
      return;
    }

    try {
      setIsSending(true);
      setError('');
      
      await giftsAPI.sendGift({
        recipientId: selectedRecipient.id,
        giftItemId: selectedGift.id,
        message: message || `Sending you a ${selectedGift.name}!`,
        isAnonymous: false,
        useSiteBalance: true
      });
      
      onGiftSent?.();
      onClose();
    } catch (err) {
      console.error('Error sending gift:', err);
      setError(err.response?.data?.error || 'Failed to send gift');
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center">
              {step > 1 && (
                <button 
                  onClick={() => setStep(step - 1)}
                  className="mr-4 text-gray-500 hover:text-gray-700"
                  disabled={isSending}
                >
                  <FaArrowLeft className="w-5 h-5" />
                </button>
              )}
              <h2 className="text-2xl font-bold text-gray-900">
                {step === 1 && 'Select a Gift'}
                {step === 2 && 'Select a Recipient'}
                {step === 3 && 'Add a Message'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              disabled={isSending}
            >
              <FaTimes className="w-6 h-6" />
            </button>
          </div>

          {/* Progress Steps */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              {[1, 2, 3].map((stepNum) => (
                <div key={stepNum} className="flex flex-col items-center">
                  <div 
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      step === stepNum 
                        ? 'bg-pink-600 text-white' 
                        : step > stepNum 
                          ? 'bg-green-500 text-white' 
                          : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {stepNum}
                  </div>
                  <span className="text-xs mt-1 text-gray-500">
                    {stepNum === 1 ? 'Gift' : stepNum === 2 ? 'Recipient' : 'Message'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-100 border-l-4 border-red-500 text-red-700">
              <p>{error}</p>
            </div>
          )}

          {/* Step 1: Select Gift */}
          {step === 1 && (
            <div>
              <div className="mb-4">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaSearch className="text-gray-400" />
                  </div>
                  <input
                    type="text"
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-pink-500 focus:border-pink-500 sm:text-sm"
                    placeholder="Search gifts..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-96 overflow-y-auto p-2">
                {giftItems
                  .filter(gift => 
                    gift.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    gift.description.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((gift) => (
                    <div
                      key={gift.id}
                      onClick={() => {
                        setSelectedGift(gift);
                        setStep(2);
                      }}
                      className={`p-3 border rounded-lg cursor-pointer transition-all ${
                        selectedGift?.id === gift.id
                          ? 'ring-2 ring-pink-500 border-transparent'
                          : 'hover:border-pink-300 hover:shadow-md'
                      }`}
                    >
                      <div className="w-full h-32 bg-gray-100 rounded-md mb-2 flex items-center justify-center">
                        {gift.image_url ? (
                          <img 
                            src={gift.image_url} 
                            alt={gift.name} 
                            className="w-full h-full object-cover rounded"
                          />
                        ) : (
                          <FaGift className="text-4xl text-gray-400" />
                        )}
                      </div>
                      <h3 className="font-medium text-gray-900">{gift.name}</h3>
                      <p className="text-sm text-gray-500">
                        ${typeof gift.price === 'number' ? gift.price.toFixed(2) : '0.00'}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Step 2: Select Recipient */}
          {step === 2 && (
            <div>
              <div className="mb-4">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaSearch className="text-gray-400" />
                  </div>
                  <input
                    type="text"
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-pink-500 focus:border-pink-500 sm:text-sm"
                    placeholder="Search matches..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto p-1">
                {matches
                  .filter(match => 
                    match.matchedUser?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    match.matchedUser?.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    match.matchedUser?.username?.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((match) => (
                    <div
                      key={match.matchedUser.id}
                      onClick={() => {
                        setSelectedRecipient(match.matchedUser);
                        setStep(3);
                      }}
                      className={`p-3 border rounded-lg cursor-pointer flex items-center space-x-3 ${
                        selectedRecipient?.id === match.matchedUser.id
                          ? 'ring-2 ring-pink-500 border-transparent'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                          {match.matchedUser.profilePicture ? (
                            <img 
                              src={match.matchedUser.profilePicture} 
                              alt={match.matchedUser.firstName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <FaUser className="text-gray-400 text-xl" />
                          )}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {match.matchedUser.firstName} {match.matchedUser.lastName}
                        </p>
                        <p className="text-sm text-gray-500 truncate">
                          @{match.matchedUser.username}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Step 3: Add Message */}
          {step === 3 && (
            <div>
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-16 h-16 bg-white rounded-lg border flex items-center justify-center">
                    {selectedGift.image_url ? (
                      <img 
                        src={selectedGift.image_url} 
                        alt={selectedGift.name}
                        className="w-full h-full object-cover rounded"
                      />
                    ) : (
                      <FaGift className="text-2xl text-gray-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Sending to {selectedRecipient.firstName}</h3>
                    <p className="text-sm text-gray-500">{selectedGift.name}</p>
                    <p className="text-sm font-medium text-pink-600">
                      ${typeof selectedGift.price === 'number' ? selectedGift.price.toFixed(2) : '0.00'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                  Add a message (optional)
                </label>
                <textarea
                  id="message"
                  rows="3"
                  className="shadow-sm focus:ring-pink-500 focus:border-pink-500 block w-full sm:text-sm border border-gray-300 rounded-md p-3"
                  placeholder={`Write a message for ${selectedRecipient.firstName}...`}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500"
                  disabled={isSending}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSendGift}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-pink-600 hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 disabled:opacity-50"
                  disabled={isSending}
                >
                  {isSending ? (
                    'Sending...'
                  ) : (
                    <>
                      <FaGift className="mr-2" />
                      Send Gift
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SendGiftModal;

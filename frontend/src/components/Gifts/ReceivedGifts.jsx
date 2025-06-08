import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaGift, FaExchangeAlt, FaRegCheckCircle } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import { giftsAPI } from '../../services/api';

const ReceivedGifts = () => {
  const { currentUser } = useAuth();
  const [gifts, setGifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeeming] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const fetchReceivedGifts = async () => {
      try {
        const gifts = await giftsAPI.getReceivedGifts();
        setGifts(Array.isArray(gifts) ? gifts : []);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching received gifts:', err);
        setError({ message: 'Failed to load received gifts', type: 'general' });
        setLoading(false);
      }
    };

    if (currentUser) {
      fetchReceivedGifts();
    }
  }, [currentUser]);

  const handleRedeem = async (giftId) => {
    try {
      setRedeeeming(giftId);
      setError('');
      
      // Call the redeem endpoint with the user_gifts.id
      const response = await giftsAPI.redeemGift(giftId);
      
      // Update the local state with the redeemed gift details
      setGifts(gifts.map(gift => 
        gift.id === giftId 
          ? { 
              ...gift, 
              is_redeemed: true, 
              redeemed_value: response.redeemedAmount || response.amount,
              redeemed_at: new Date().toISOString()
            } 
          : gift
      ));
      
      setSuccess(`Gift redeemed successfully! $${response.redeemedAmount || response.amount} has been added to your balance.`);
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      console.error('Error redeeming gift:', err);
      if (err.response?.status === 403 && err.response?.data?.code === 'UPGRADE_REQUIRED_FOR_GIFT_REDEMPTION') {
        setError({ message: err.response.data.error, code: err.response.data.code, type: 'upgrade' });
      } else if (err.response?.status === 403) { // Other 403 errors
        setError({ message: err.response.data.error || 'You are not authorized to perform this action.', type: 'general' });
        setTimeout(() => setError(null), 7000);
      } else {
        const errorMessage = err.response?.data?.error || err.message || 'Failed to redeem gift';
        setError({ message: errorMessage, type: 'general' });
        setTimeout(() => setError(null), 5000); // Clear other errors after 5s
      }
    } finally {
      setRedeeeming(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center p-4">Loading gifts...</div>;
  }

  

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4 flex items-center">
        <FaGift className="mr-2" /> Received Gifts
      </h2>

      {error && (
        <div className={`px-4 py-3 rounded mb-4 ${error.type === 'upgrade' ? 'bg-green-100 border border-green-400 text-green-700' : 'bg-red-100 border border-red-400 text-red-700'}`}>
          {error.message}
          {error.type === 'upgrade' && error.code === 'UPGRADE_REQUIRED_FOR_GIFT_REDEMPTION' && (
            <Link to="/pricing" className="font-bold underline ml-2 hover:text-green-800">
              Upgrade Now
            </Link>
          )}
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}

      {gifts.length === 0 ? (
        <div className="text-gray-500 text-center p-8">
          You haven't received any gifts yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {gifts.map((gift) => (
            <div 
              key={gift.id} 
              className="border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-lg">{gift.name}</h3>
                  <p className="text-gray-600">{gift.description}</p>
                  <p className="text-sm text-gray-500 mt-2">
                    From: {gift.is_anonymous ? 'Anonymous' : gift.sender_name}
                  </p>
                  {gift.message && (
                    <p className="mt-2 p-2 bg-gray-50 rounded italic">
                      "{gift.message}"
                    </p>
                  )}
                  <p className="mt-2 font-medium">
                    Value: ${(Number(gift.original_purchase_price) || 0).toFixed(2)}
                  </p>
                </div>
                <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center">
                  {gift.image_url ? (
                    <img 
                      src={gift.image_url} 
                      alt={gift.name} 
                      className="w-full h-full object-cover rounded"
                    />
                  ) : (
                    <FaGift className="text-3xl text-gray-400" />
                  )}
                </div>
              </div>
              
              <div className="mt-4 flex justify-between items-center">
                <span className="text-sm text-gray-500">
                  {new Date(gift.created_at).toLocaleDateString()}
                </span>
                {gift.is_redeemed ? (
                  <span className="flex items-center text-green-600 text-sm">
                    <FaRegCheckCircle className="mr-1" />
                    Redeemed (${(Number(gift.redeemed_value) || 0).toFixed(2)})
                  </span>
                ) : (
                  <button
                    onClick={() => handleRedeem(gift.id)}
                    disabled={redeeming === gift.id}
                    className={`flex items-center px-3 py-1 rounded text-sm transition-colors min-w-[100px] justify-center ${
                      redeeming === gift.id
                        ? 'bg-blue-400 text-white cursor-wait'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                  >
                    {redeeming === gift.id ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </>
                    ) : (
                      <>
                        <FaExchangeAlt className="mr-1" />
                        Redeem
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReceivedGifts;

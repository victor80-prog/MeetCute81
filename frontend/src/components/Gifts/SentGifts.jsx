import React, { useState, useEffect } from 'react';
import { FaGift, FaRegCheckCircle, FaRegClock } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import { giftsAPI } from '../../services/api';

const SentGifts = () => {
  const { currentUser } = useAuth();
  const [gifts, setGifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSentGifts = async () => {
      try {
        const sentGifts = await giftsAPI.getSentGifts();
        setGifts(Array.isArray(sentGifts) ? sentGifts : []);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching sent gifts:', err);
        setError('Failed to load sent gifts');
        setLoading(false);
      }
    };

    if (currentUser) {
      fetchSentGifts();
    }
  }, [currentUser]);

  if (loading) {
    return <div className="flex justify-center items-center p-4">Loading sent gifts...</div>;
  }

  if (error) {
    return <div className="text-red-500 p-4">{error}</div>;
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4 flex items-center">
        <FaGift className="mr-2" /> Sent Gifts
      </h2>

      {gifts.length === 0 ? (
        <div className="text-gray-500 text-center p-8">
          You haven't sent any gifts yet.
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
                    To: {gift.recipient_name}
                  </p>
                  {gift.message && (
                    <p className="mt-2 p-2 bg-gray-50 rounded italic">
                      "{gift.message}"
                    </p>
                  )}
                  <p className="mt-2 font-medium">
                    Value: ${parseFloat(gift.original_purchase_price || 0).toFixed(2)}
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
                <div className="flex items-center text-sm">
                  {gift.is_redeemed ? (
                    <span className="flex items-center text-green-600">
                      <FaRegCheckCircle className="mr-1" />
                      Redeemed
                    </span>
                  ) : (
                    <span className="flex items-center text-yellow-600">
                      <FaRegClock className="mr-1" />
                      Pending
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SentGifts;

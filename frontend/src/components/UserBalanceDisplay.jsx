import React, { useState, useEffect, useCallback } from 'react';
import { balanceAPI } from '../services/api'; // Import the balance API service
import { FaWallet } from 'react-icons/fa'; // Example icon

// Simple event emitter for balance updates (can be replaced by context)
export const balanceEventEmitter = {
    listeners: [],
    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    },
    emit() {
        this.listeners.forEach(listener => listener());
    }
};

const UserBalanceDisplay = ({ className }) => {
    const [balance, setBalance] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchBalance = useCallback(async () => {
        setLoading(true);
        try {
            console.log('[UserBalanceDisplay] Fetching balance...');
            const response = await balanceAPI.getBalance();
            console.log('[UserBalanceDisplay] Balance API response:', response);
            
            // Handle different possible response formats
            let balanceValue = 0;
            const responseData = response || {};
            
            // Try different response formats
            if (typeof responseData === 'number') {
                balanceValue = responseData;
            } else if (responseData.balance !== undefined) {
                balanceValue = parseFloat(responseData.balance);
            } else if (responseData.data?.balance !== undefined) {
                balanceValue = parseFloat(responseData.data.balance);
            } else if (responseData.amount !== undefined) {
                balanceValue = parseFloat(responseData.amount);
            } else {
                console.warn('[UserBalanceDisplay] Unexpected balance response format, using 0 as fallback:', responseData);
                balanceValue = 0;
            }
            
            console.log(`[UserBalanceDisplay] Parsed balance value: $${balanceValue.toFixed(2)}`);
            setBalance(balanceValue.toFixed(2));
            setError('');
        } catch (err) {
            const errorMessage = err.response?.data?.error || err.message || 'Failed to load balance';
            console.error('[UserBalanceDisplay] Error fetching balance:', {
                message: err.message,
                status: err.response?.status,
                statusText: err.response?.statusText,
                data: err.response?.data,
                config: {
                    url: err.config?.url,
                    method: err.config?.method,
                    headers: err.config?.headers
                }
            });
            
            // Only show error if it's not a 401 (unauthorized) which might be handled by auth interceptor
            if (err.response?.status !== 401) {
                setError(errorMessage);
            } else {
                console.log('[UserBalanceDisplay] Unauthorized - likely needs login, not showing error');
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchBalance();
        const unsubscribe = balanceEventEmitter.subscribe(fetchBalance);
        return unsubscribe; // Cleanup subscription
    }, [fetchBalance]);

    if (loading) {
        return <span className={`text-sm ${className || ''}`}>Loading balance...</span>;
    }
    if (error) {
        // Optionally, provide a retry button
        return <span className={`text-sm text-red-500 ${className || ''}`}>{error} <button onClick={fetchBalance} className="ml-1 underline">Retry</button></span>;
    }

    return (
        <div className={`flex items-center text-sm ${className || ''}`}>
            <FaWallet className="mr-1 text-yellow-500" />
            <span>Balance:</span>
            <span className="font-semibold ml-1">${balance !== null ? balance : 'N/A'}</span>
        </div>
    );
};
export default UserBalanceDisplay;

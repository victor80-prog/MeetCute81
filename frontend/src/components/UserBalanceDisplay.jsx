import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api'; // Assuming api util for authenticated calls
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
            console.log('Fetching balance from /api/balance/...');
            const response = await api.get('/api/balance/');
            console.log('Balance API response:', response.data);
            
            // Handle different possible response formats
            let balanceValue = 0;
            if (response.data && response.data.balance !== undefined) {
                balanceValue = parseFloat(response.data.balance);
            } else if (response.data && response.data.amount !== undefined) {
                balanceValue = parseFloat(response.data.amount);
            } else if (typeof response.data === 'number') {
                balanceValue = response.data;
            } else {
                throw new Error('Invalid response format from server');
            }
            
            setBalance(balanceValue.toFixed(2));
            setError('');
        } catch (err) {
            const errorMessage = err.response?.data?.error || err.message || 'Failed to load balance';
            setError(errorMessage);
            console.error('Error fetching balance:', {
                message: err.message,
                status: err.response?.status,
                statusText: err.response?.statusText,
                responseData: err.response?.data,
                stack: err.stack
            });
            setBalance(null); // Clear balance on error
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

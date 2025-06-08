import React, { useState, useEffect } from 'react';
import api from '../../services/api'; // Assuming api is in src/utils/api.js
import { FaPlusCircle, FaSpinner, FaExclamationTriangle } from 'react-icons/fa';

const GlobalPaymentMethodsManager = () => {
  const [globalTypes, setGlobalTypes] = useState([]);
  const [isLoadingTypes, setIsLoadingTypes] = useState(true);
  const [errorTypes, setErrorTypes] = useState(null);

  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeCode, setNewTypeCode] = useState('');
  const [newTypeDescription, setNewTypeDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const fetchGlobalTypes = async () => {
    setIsLoadingTypes(true);
    setErrorTypes(null);
    try {
      const response = await adminAPI.getPaymentMethodTypes();
      setGlobalTypes(response.data || []);
    } catch (err) {
      console.error('Error fetching global payment method types:', err);
      setErrorTypes(err.response?.data?.message || 'Failed to load global payment types.');
    } finally {
      setIsLoadingTypes(false);
    }
  };

  useEffect(() => {
    fetchGlobalTypes();
  }, []);

  const handleAddType = async (e) => {
    e.preventDefault();
    setSubmitError(null);

    if (!newTypeName.trim() || !newTypeCode.trim()) {
      setSubmitError('Name and Code are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      await adminAPI.createPaymentMethodType({
        name: newTypeName,
        code: newTypeCode.toUpperCase(),
        description: newTypeDescription,
        // isActive: true by default in backend model if not provided
      });
      setNewTypeName('');
      setNewTypeCode('');
      setNewTypeDescription('');
      await fetchGlobalTypes(); // Refresh the list
    } catch (err) {
      console.error('Error adding global payment type:', err);
      setSubmitError(err.response?.data?.message || 'Failed to add new payment type.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-xl font-semibold mb-4 text-slate-700">Global Payment Method Types</h3>

      {/* Form to Add New Global Type */}
      <form onSubmit={handleAddType} className="mb-8 p-4 border border-slate-200 rounded-md">
        <h4 className="text-md font-semibold mb-3 text-slate-600">Add New Global Type</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
          <div>
            <label htmlFor="newTypeName" className="block text-sm font-medium text-slate-700">Name</label>
            <input
              type="text"
              id="newTypeName"
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="e.g., M-Pesa, PayPal"
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label htmlFor="newTypeCode" className="block text-sm font-medium text-slate-700">Code</label>
            <input
              type="text"
              id="newTypeCode"
              value={newTypeCode}
              onChange={(e) => setNewTypeCode(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="e.g., MPESA, PAYPAL (unique)"
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label htmlFor="newTypeDescription" className="block text-sm font-medium text-slate-700">Description (Optional)</label>
            <input
              type="text"
              id="newTypeDescription"
              value={newTypeDescription}
              onChange={(e) => setNewTypeDescription(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Brief description"
              disabled={isSubmitting}
            />
          </div>
        </div>
        {submitError && (
          <p className="text-sm text-red-600 mb-3"><FaExclamationTriangle className="inline mr-1" />{submitError}</p>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {isSubmitting ? <FaSpinner className="animate-spin mr-2" /> : <FaPlusCircle className="mr-2" />}
          Add Global Type
        </button>
      </form>

      {/* List Existing Global Types */}
      <h4 className="text-md font-semibold mb-3 text-slate-600">Existing Global Types</h4>
      {isLoadingTypes && <p className="text-slate-500 flex items-center"><FaSpinner className="animate-spin mr-2" />Loading types...</p>}
      {errorTypes && <p className="text-red-600"><FaExclamationTriangle className="inline mr-1" /> {errorTypes}</p>}

      {!isLoadingTypes && !errorTypes && globalTypes.length === 0 && (
        <p className="text-slate-500">No global payment method types found.</p>
      )}

      {!isLoadingTypes && !errorTypes && globalTypes.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Name</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Code</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Description</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {globalTypes.map((type) => (
                <tr key={type.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{type.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{type.code}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{type.description || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {type.is_active ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Active</span>
                    ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Inactive</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default GlobalPaymentMethodsManager;

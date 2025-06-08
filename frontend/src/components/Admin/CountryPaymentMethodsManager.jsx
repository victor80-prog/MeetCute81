import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { FaPlus, FaEdit, FaTrash, FaSpinner, FaExclamationTriangle, FaTimes } from 'react-icons/fa';

const CountryPaymentMethodsManager = () => {
  const [countries, setCountries] = useState([]);
  const [selectedCountryId, setSelectedCountryId] = useState('');
  const [selectedCountryName, setSelectedCountryName] = useState('');
  const [configuredMethods, setConfiguredMethods] = useState([]);
  const [globalTypes, setGlobalTypes] = useState([]);

  const [isLoadingCountries, setIsLoadingCountries] = useState(true);
  const [isLoadingConfiguredMethods, setIsLoadingConfiguredMethods] = useState(false);
  const [isLoadingGlobalTypes, setIsLoadingGlobalTypes] = useState(true);

  const [errorCountries, setErrorCountries] = useState(null);
  const [errorConfiguredMethods, setErrorConfiguredMethods] = useState(null);
  const [errorGlobalTypes, setErrorGlobalTypes] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null); // null for new, object for edit
  const [isSubmittingModal, setIsSubmittingModal] = useState(false);
  const [modalError, setModalError] = useState(null);

  // Initial data fetching: Countries and Global Payment Types
  const fetchInitialData = useCallback(async () => {
    setIsLoadingCountries(true);
    setIsLoadingGlobalTypes(true);
    try {
      const [countriesRes, globalTypesRes] = await Promise.all([
        api.get('/api/countries'),
        api.get('/api/admin/payment-methods/types')
      ]);
      setCountries(countriesRes.data || []);
      setGlobalTypes(globalTypesRes.data || []);
      setErrorCountries(null);
      setErrorGlobalTypes(null);
    } catch (err) {
      console.error('Error fetching initial data:', err);
      const msg = err.response?.data?.message || 'Failed to load initial data.';
      setErrorCountries(msg);
      setErrorGlobalTypes(msg);
    } finally {
      setIsLoadingCountries(false);
      setIsLoadingGlobalTypes(false);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Fetch configured methods when selectedCountryId changes
  const fetchConfiguredMethodsForCountry = useCallback(async () => {
    if (!selectedCountryId) {
      setConfiguredMethods([]);
      return;
    }
    setIsLoadingConfiguredMethods(true);
    setErrorConfiguredMethods(null);
    try {
      const response = await api.get(`/api/admin/payment-methods/country/${selectedCountryId}`);
      setConfiguredMethods(response.data || []);
    } catch (err) {
      console.error(`Error fetching payment methods for country ${selectedCountryId}:`, err);
      setErrorConfiguredMethods(err.response?.data?.message || `Failed to load payment methods for ${selectedCountryName}.`);
    } finally {
      setIsLoadingConfiguredMethods(false);
    }
  }, [selectedCountryId, selectedCountryName]);

  useEffect(() => {
    fetchConfiguredMethodsForCountry();
  }, [fetchConfiguredMethodsForCountry]);


  const handleCountryChange = (e) => {
    const countryId = e.target.value;
    setSelectedCountryId(countryId);
    const country = countries.find(c => c.id.toString() === countryId);
    setSelectedCountryName(country ? country.name : '');
    setConfiguredMethods([]); // Clear previous methods
    setErrorConfiguredMethods(null); // Clear previous errors
    setEditingConfig(null); // Clear any editing state
  };

  const handleOpenModal = (configToEdit = null) => {
    setModalError(null);
    if (configToEdit) {
      // Deep copy configuration_details if it exists, ensure it's an object
      const configurationDetails = configToEdit.configuration_details ? { ...configToEdit.configuration_details } : {};
      setEditingConfig({ ...configToEdit, configuration_details: configurationDetails });
    } else {
      // Defaults for new configuration
      setEditingConfig({
        payment_method_id: '', // Needs to be selected from global types
        payment_method_code: '', // Will be set when global type is selected
        user_instructions: '',
        configuration_details: {}, // Initialize as empty object
        is_active: true,
        priority: 0,
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingConfig(null); // Clear editing state
    setModalError(null);
  };

  // Stub for now
  const handleModalInputChange = (e) => {
    const { name, value, type, checked } = e.target;
     if (name.startsWith("configDetail_")) {
        const detailKey = name.split('_')[1];
        setEditingConfig(prev => ({
            ...prev,
            configuration_details: {
                ...prev.configuration_details,
                [detailKey]: value
            }
        }));
    } else {
        setEditingConfig(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    }
  };

  const handleGlobalTypeSelectInModal = (e) => {
    const selectedId = e.target.value;
    const selectedType = globalTypes.find(gt => gt.id.toString() === selectedId);
    if (selectedType) {
        setEditingConfig(prev => ({
            ...prev,
            payment_method_id: selectedType.id,
            payment_method_code: selectedType.code, // Store code to drive dynamic fields
            configuration_details: {} // Reset/prepare config details based on new type
        }));
    } else {
         setEditingConfig(prev => ({
            ...prev,
            payment_method_id: '',
            payment_method_code: '',
            configuration_details: {}
        }));
    }
  };

  // Stub for now
  const handleModalSubmit = async (e) => {
    e.preventDefault();
    setIsSubmittingModal(true);
    setModalError(null);

    if (!editingConfig?.payment_method_id && !editingConfig?.id) { // id check for edit mode where payment_method_id might not be re-selected
        setModalError("Please select a global payment type.");
        setIsSubmittingModal(false);
        return;
    }

    const payload = {
      paymentMethodId: editingConfig.payment_method_id, // This is the global type ID
      userInstructions: editingConfig.user_instructions,
      configurationDetails: editingConfig.configuration_details,
      isActive: editingConfig.is_active,
      priority: parseInt(editingConfig.priority, 10) || 0,
    };

    try {
        if (editingConfig.country_id && editingConfig.payment_method_id) { // Indicates editing existing config
            // For PUT, the paymentMethodId in URL is the one we are updating.
            // The payload's paymentMethodId is the global type, which shouldn't change.
            await adminAPI.updateCountryPaymentMethod(selectedCountryId, editingConfig.payment_method_id, payload);
        } else { // Adding new config
            await adminAPI.addCountryPaymentMethod(selectedCountryId, payload);
        }
        await fetchConfiguredMethodsForCountry();
        handleCloseModal();
    } catch(err) {
        console.error("Error submitting payment method configuration:", err);
        setModalError(err.response?.data?.message || "Failed to save configuration.");
    } finally {
        setIsSubmittingModal(false);
    }
  };

  // Stub for now
  const handleDeleteConfig = async (methodToDel) => {
    if (!methodToDel || !methodToDel.payment_method_id) {
        console.error("Invalid method object for deletion:", methodToDel);
        return;
    }
    if (window.confirm(`Are you sure you want to remove ${methodToDel.payment_method_name} for ${selectedCountryName}?`)) {
        try {
            await api.delete(`/api/admin/payment-methods/country/${selectedCountryId}/method/${methodToDel.payment_method_id}`);
            await fetchConfiguredMethodsForCountry();
        } catch (err) {
            console.error("Error deleting payment method configuration:", err);
            // Display error to user, perhaps using a toast notification system
            alert(err.response?.data?.message || "Failed to delete configuration.");
        }
    }
  };

  // Dynamic form fields based on selected payment_method_code
  const renderDynamicConfigFields = () => {
    if (!editingConfig || !editingConfig.payment_method_code) return null;

    const code = editingConfig.payment_method_code.toUpperCase();
    const details = editingConfig.configuration_details || {};

    switch (code) {
      case 'PAYPAL':
        return (
          <div>
            <label htmlFor="configDetail_paypal_email" className="block text-sm font-medium text-slate-700">PayPal Email</label>
            <input type="email" name="configDetail_paypal_email" id="configDetail_paypal_email" value={details.paypal_email || ''} onChange={handleModalInputChange} className="mt-1 block w-full input-class" placeholder="paypal@example.com"/>
          </div>
        );
      case 'BTC':
        return (
          <div>
            <label htmlFor="configDetail_btc_address" className="block text-sm font-medium text-slate-700">BTC Address</label>
            <input type="text" name="configDetail_btc_address" id="configDetail_btc_address" value={details.btc_address || ''} onChange={handleModalInputChange} className="mt-1 block w-full input-class" placeholder="1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"/>
          </div>
        );
      case 'MPESA':
        return (
          <>
            <div>
              <label htmlFor="configDetail_paybill" className="block text-sm font-medium text-slate-700">PayBill Number</label>
              <input type="text" name="configDetail_paybill" id="configDetail_paybill" value={details.paybill || ''} onChange={handleModalInputChange} className="mt-1 block w-full input-class" placeholder="e.g., 123456"/>
            </div>
            <div>
              <label htmlFor="configDetail_account_number_instructions" className="block text-sm font-medium text-slate-700">Account Number Instructions</label>
              <input type="text" name="configDetail_account_number_instructions" id="configDetail_account_number_instructions" value={details.account_number_instructions || ''} onChange={handleModalInputChange} className="mt-1 block w-full input-class" placeholder="e.g., Use your User ID"/>
            </div>
          </>
        );
      case 'BANK_TRANSFER':
        return (
          <>
            <div><label htmlFor="configDetail_bank_name" className="block text-sm font-medium text-slate-700">Bank Name</label><input type="text" name="configDetail_bank_name" id="configDetail_bank_name" value={details.bank_name || ''} onChange={handleModalInputChange} className="mt-1 block w-full input-class"/></div>
            <div><label htmlFor="configDetail_account_number" className="block text-sm font-medium text-slate-700">Account Number</label><input type="text" name="configDetail_account_number" id="configDetail_account_number" value={details.account_number || ''} onChange={handleModalInputChange} className="mt-1 block w-full input-class"/></div>
            <div><label htmlFor="configDetail_beneficiary_name" className="block text-sm font-medium text-slate-700">Beneficiary Name</label><input type="text" name="configDetail_beneficiary_name" id="configDetail_beneficiary_name" value={details.beneficiary_name || ''} onChange={handleModalInputChange} className="mt-1 block w-full input-class"/></div>
            <div><label htmlFor="configDetail_swift_code" className="block text-sm font-medium text-slate-700">SWIFT/BIC Code</label><input type="text" name="configDetail_swift_code" id="configDetail_swift_code" value={details.swift_code || ''} onChange={handleModalInputChange} className="mt-1 block w-full input-class"/></div>
          </>
        );
      default:
        return <p className="text-sm text-slate-500">No specific configuration fields for this payment type, or it supports generic key-value pairs.</p>;
    }
  };


  return (
    <div className="mt-8 bg-white p-6 rounded-lg shadow">
      <h3 className="text-xl font-semibold mb-4 text-slate-700">Country-Specific Payment Methods</h3>

      {/* Country Selector */}
      <div className="mb-6">
        <label htmlFor="countrySelect" className="block text-sm font-medium text-slate-700">Select Country</label>
        <select
          id="countrySelect"
          value={selectedCountryId}
          onChange={handleCountryChange}
          disabled={isLoadingCountries}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md disabled:opacity-70"
        >
          <option value="">-- Select a Country --</option>
          {countries.map(country => (
            <option key={country.id} value={country.id}>{country.name}</option>
          ))}
        </select>
        {isLoadingCountries && <p className="text-sm text-slate-500 mt-1 flex items-center"><FaSpinner className="animate-spin mr-2" />Loading countries...</p>}
        {errorCountries && <p className="text-sm text-red-600 mt-1"><FaExclamationTriangle className="inline mr-1" />{errorCountries}</p>}
      </div>

      {selectedCountryId && (
        <>
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-lg font-semibold text-slate-600">Configured Methods for {selectedCountryName}</h4>
            <button
              onClick={() => handleOpenModal()}
              disabled={isLoadingGlobalTypes || globalTypes.length === 0}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              title={globalTypes.length === 0 ? "Load global types first or add some" : "Add payment method"}
            >
              <FaPlus className="mr-2" /> Add Method
            </button>
          </div>

          {isLoadingConfiguredMethods && <p className="text-slate-500 flex items-center"><FaSpinner className="animate-spin mr-2" />Loading configured methods...</p>}
          {errorConfiguredMethods && <p className="text-red-600"><FaExclamationTriangle className="inline mr-1" />{errorConfiguredMethods}</p>}

          {!isLoadingConfiguredMethods && !errorConfiguredMethods && configuredMethods.length === 0 && (
            <p className="text-slate-500">No payment methods configured for {selectedCountryName}.</p>
          )}

          {!isLoadingConfiguredMethods && !errorConfiguredMethods && configuredMethods.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Instructions (Excerpt)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Key Config</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Active</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Priority</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {configuredMethods.map(method => (
                    <tr key={`${method.country_id}-${method.payment_method_id}`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{method.payment_method_name} <span className="text-xs text-slate-500">({method.payment_method_code})</span></td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 truncate max-w-xs" title={method.user_instructions}>{method.user_instructions?.substring(0, 50) || '-'}...</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {method.configuration_details ? (
                            Object.entries(method.configuration_details).map(([key, value]) => (
                                <div key={key} className="text-xs"><span className="font-semibold">{key}:</span> {value.toString().substring(0,20)}{value.toString().length > 20 ? '...' : ''}</div>
                            ))
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {method.is_active ? <span className="status-badge-active">Active</span> : <span className="status-badge-inactive">Inactive</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{method.priority}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button onClick={() => handleOpenModal(method)} className="text-indigo-600 hover:text-indigo-900 mr-3"><FaEdit /></button>
                        <button onClick={() => handleDeleteConfig(method)} className="text-red-600 hover:text-red-900"><FaTrash /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Add/Edit Modal */}
      {showModal && editingConfig && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="relative bg-white rounded-lg shadow-xl p-8 max-w-2xl w-full">
            <button onClick={handleCloseModal} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <FaTimes size={20} />
            </button>
            <h4 className="text-xl font-semibold mb-6 text-slate-700">
              {editingConfig.country_id && editingConfig.payment_method_id ? `Edit Configuration for ${selectedCountryName}` : `Add New Payment Method to ${selectedCountryName}`}
            </h4>

            <form onSubmit={handleModalSubmit} className="space-y-4">
              <div>
                <label htmlFor="payment_method_id" className="block text-sm font-medium text-slate-700">Global Payment Type</label>
                <select
                  id="payment_method_id"
                  name="payment_method_id"
                  value={editingConfig.payment_method_id || ''}
                  onChange={handleGlobalTypeSelectInModal}
                  disabled={!!(editingConfig.country_id && editingConfig.payment_method_id) || isLoadingGlobalTypes} // Disable if editing existing
                  className="mt-1 block w-full input-class disabled:bg-slate-100"
                >
                  <option value="">-- Select Global Type --</option>
                  {globalTypes.map(gt => (
                    <option key={gt.id} value={gt.id}>{gt.name} ({gt.code})</option>
                  ))}
                </select>
                 {isLoadingGlobalTypes && <p className="text-xs text-slate-500">Loading global types...</p>}
              </div>

              {renderDynamicConfigFields()}

              <div>
                <label htmlFor="user_instructions" className="block text-sm font-medium text-slate-700">User Instructions</label>
                <textarea
                  id="user_instructions"
                  name="user_instructions"
                  rows="4"
                  value={editingConfig.user_instructions || ''}
                  onChange={handleModalInputChange}
                  className="mt-1 block w-full input-class"
                  placeholder="Step-by-step instructions for the user to make the payment."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="priority" className="block text-sm font-medium text-slate-700">Priority</label>
                  <input
                    type="number"
                    id="priority"
                    name="priority"
                    value={editingConfig.priority || 0}
                    onChange={handleModalInputChange}
                    className="mt-1 block w-full input-class"
                  />
                </div>
                <div className="flex items-center pt-6">
                  <input
                    id="is_active"
                    name="is_active"
                    type="checkbox"
                    checked={editingConfig.is_active || false}
                    onChange={handleModalInputChange}
                    className="h-4 w-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                  />
                  <label htmlFor="is_active" className="ml-2 block text-sm text-slate-900">Active for Country</label>
                </div>
              </div>

              {modalError && <p className="text-sm text-red-600"><FaExclamationTriangle className="inline mr-1" />{modalError}</p>}

              <div className="pt-5 flex justify-end space-x-3">
                <button type="button" onClick={handleCloseModal} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={isSubmittingModal} className="btn-primary disabled:opacity-50">
                  {isSubmittingModal ? <FaSpinner className="animate-spin mr-2" /> : (editingConfig.country_id && editingConfig.payment_method_id ? 'Save Changes' : 'Add Method')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Basic styling for input-class and status badges (can be moved to index.css or a shared CSS file)
const style = document.createElement('style');
style.textContent = `
  .input-class {
    display: block;
    width: 100%;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    line-height: 1.25rem;
    border: 1px solid #cbd5e1; /* slate-300 */
    border-radius: 0.375rem; /* rounded-md */
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); /* shadow-sm */
  }
  .input-class:focus {
    outline: 2px solid transparent;
    outline-offset: 2px;
    border-color: #6366f1; /* indigo-500 */
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2); /* ring-indigo-500 with opacity */
  }
  .status-badge-active {
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    line-height: 1;
    border-radius: 9999px;
    background-color: #dcfce7; /* green-100 */
    color: #166534; /* green-800 */
  }
  .status-badge-inactive {
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    line-height: 1;
    border-radius: 9999px;
    background-color: #fee2e2; /* red-100 */
    color: #991b1b; /* red-800 */
  }
  .btn-primary {
    display: inline-flex;
    align-items: center;
    padding: 0.5rem 1rem;
    border: 1px solid transparent;
    font-size: 0.875rem;
    font-weight: 500;
    border-radius: 0.375rem;
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    color: white;
    background-color: #4f46e5; /* indigo-600 */
  }
  .btn-primary:hover {
    background-color: #4338ca; /* indigo-700 */
  }
  .btn-secondary {
    display: inline-flex;
    align-items: center;
    padding: 0.5rem 1rem;
    border: 1px solid #e2e8f0; /* slate-300 */
    font-size: 0.875rem;
    font-weight: 500;
    border-radius: 0.375rem;
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    color: #334155; /* slate-700 */
    background-color: white;
  }
  .btn-secondary:hover {
    background-color: #f8fafc; /* slate-50 */
  }
`;
document.head.appendChild(style);


export default CountryPaymentMethodsManager;

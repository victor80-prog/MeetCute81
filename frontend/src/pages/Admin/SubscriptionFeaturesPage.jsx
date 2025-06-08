import React, { useState, useEffect, useCallback } from 'react';
import { adminAPI } from '../../services/api';
import { FaPlus, FaEdit, FaTrash, FaEye } from 'react-icons/fa'; // Example icons

const SubscriptionFeaturesPage = () => {
  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false); // Placeholder for now
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false); // Placeholder for now

  // Form data states
  const [newFeatureData, setNewFeatureData] = useState({
    feature_name: '', // This will serve as the key
    feature_description: '',
    package_id: '', // Added package_id
    // feature_key removed
    // premium_only removed
    // elite_only removed
  });
  const [currentFeature, setCurrentFeature] = useState(null); // For edit/delete
  const [editFeatureData, setEditFeatureData] = useState({
    id: null,
    feature_name: '', // This will serve as the key
    feature_description: '',
    package_id: '', // Added package_id
    // feature_key removed
    // premium_only removed
    // elite_only removed
  });
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');



  const fetchFeatures = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await adminAPI.listSubscriptionFeatures();
      setFeatures(response.data);
    } catch (err) {
      setError('Failed to fetch subscription features. ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeatures();
  }, [fetchFeatures]);

  const handleNewFeatureInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setNewFeatureData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleCreateFeature = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    // Basic validation
    if (!newFeatureData.feature_name.trim()) {
      setError('Feature name is required');
      setLoading(false);
      return;
    }

    try {
      // Add the feature_key based on the feature_name (lowercase, spaces to underscores)
      const featureToCreate = {
        ...newFeatureData,
        feature_key: newFeatureData.feature_name.toLowerCase().replace(/\s+/g, '_')
      };

      await adminAPI.createSubscriptionFeature(featureToCreate);
      setSuccessMessage('Feature created successfully!');
      setNewFeatureData({
        feature_name: '',
        feature_description: '',
        package_id: '',
      });
      setIsCreateModalOpen(false);
      fetchFeatures(); // Refresh the list
    } catch (err) {
      setError('Failed to create feature: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleEditInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditFeatureData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleOpenEditModal = (feature) => {
    setCurrentFeature(feature);
    setEditFeatureData({
      id: feature.id,
      feature_name: feature.feature_name, // This is the key
      feature_description: feature.feature_description,
      package_id: feature.package_id || '', // Added package_id population
      // feature_key removed
      // premium_only removed
      // elite_only removed
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateFeature = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    if (!currentFeature || !editFeatureData.feature_name.trim()) {
      setError('Feature name is required');
      setLoading(false);
      return;
    }

    try {
      // Add the feature_key based on the feature_name (lowercase, spaces to underscores)
      const featureToUpdate = {
        ...editFeatureData,
        feature_key: editFeatureData.feature_name.toLowerCase().replace(/\s+/g, '_')
      };

      await adminAPI.updateSubscriptionFeature(currentFeature.id, featureToUpdate);
      setSuccessMessage('Feature updated successfully!');
      setIsEditModalOpen(false);
      fetchFeatures(); // Refresh the list
    } catch (err) {
      setError('Failed to update feature: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDeleteModal = (feature) => {
    setCurrentFeature(feature);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteFeature = async () => {
    if (!currentFeature) return;

    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      await adminAPI.deleteSubscriptionFeature(currentFeature.id);
      setSuccessMessage('Feature deleted successfully!');
      setIsDeleteModalOpen(false);
      fetchFeatures(); // Refresh the list
    } catch (err) {
      setError('Failed to delete feature: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };


  if (loading) {
    return <div className="container mx-auto p-4"><p>Loading subscription features...</p></div>;
  }

  if (error) {
    return <div className="container mx-auto p-4 text-red-500"><p>{error}</p></div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Manage Subscription Features</h1>
      {successMessage && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">{successMessage}</div>}
      
      <div className="mb-4">
        <button 
          onClick={() => setIsCreateModalOpen(true)} 
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded flex items-center"
        >
          <FaPlus className="mr-2" /> Add New Feature
        </button>
      </div>

      {/* Features Table */} 
      {features.length === 0 && !loading ? (
        <p>No subscription features found.</p>
      ) : (
        <div className="overflow-x-auto shadow-md sm:rounded-lg mt-6">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                {/* Key, Premium Only, Elite Only columns removed from header */}
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {features.map((feature) => (
                <tr key={feature.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{feature.feature_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{feature.feature_description}</td>
                  {/* Key, Premium Only, Elite Only cells removed from body */}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button 
                      onClick={() => handleOpenEditModal(feature)}
                      className="text-indigo-600 hover:text-indigo-900 mr-3"
                    >
                      <FaEdit />
                    </button>
                    <button 
                      onClick={() => handleOpenDeleteModal(feature)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Feature Modal */} 
      {isCreateModalOpen && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleCreateFeature}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Add New Subscription Feature</h3>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="feature_name" className="block text-sm font-medium text-gray-700">Feature Name*</label>
                      <input type="text" name="feature_name" id="feature_name" value={newFeatureData.feature_name} onChange={handleNewFeatureInputChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                    </div>
                    <div>
                      <label htmlFor="feature_description" className="block text-sm font-medium text-gray-700">Description</label>
                      <textarea name="feature_description" id="feature_description" value={newFeatureData.feature_description} onChange={handleNewFeatureInputChange} rows="3" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"></textarea>
                    </div>
                    <div>
                      <label htmlFor="package_id" className="block text-sm font-medium text-gray-700">Package ID*</label>
                      <input type="number" name="package_id" id="package_id" value={newFeatureData.package_id} onChange={handleNewFeatureInputChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="Enter Package ID (e.g., 1, 2)" />
                    </div>
                    {/* Feature Key input removed - feature_name is now the key */}
                    {/* Premium Only checkbox removed */}
                    {/* Elite Only checkbox removed */}
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button type="submit" disabled={loading} className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50">
                    {loading ? 'Saving...' : 'Save Feature'}
                  </button>
                  <button type="button" onClick={() => setIsCreateModalOpen(false)} className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Feature Modal */} 
      {isEditModalOpen && currentFeature && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleUpdateFeature}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Edit Subscription Feature</h3>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="edit_feature_name" className="block text-sm font-medium text-gray-700">Feature Name*</label>
                      <input type="text" name="feature_name" id="edit_feature_name" value={editFeatureData.feature_name} onChange={handleEditInputChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                    </div>
                    <div>
                      <label htmlFor="edit_feature_description" className="block text-sm font-medium text-gray-700">Description</label>
                      <textarea name="feature_description" id="edit_feature_description" value={editFeatureData.feature_description} onChange={handleEditInputChange} rows="3" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"></textarea>
                    </div>
                    <div>
                      <label htmlFor="edit_package_id" className="block text-sm font-medium text-gray-700">Package ID*</label>
                      <input type="number" name="package_id" id="edit_package_id" value={editFeatureData.package_id} onChange={handleEditInputChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="Enter Package ID (e.g., 1, 2)" />
                    </div>
                    {/* Feature Key input removed - feature_name is now the key */}
                    {/* Premium Only checkbox removed */}
                    {/* Elite Only checkbox removed */}
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button type="submit" disabled={loading} className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50">
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button type="button" onClick={() => { setIsEditModalOpen(false); setCurrentFeature(null); }} className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */} 
      {isDeleteModalOpen && currentFeature && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <FaTrash className="h-6 w-6 text-red-600" aria-hidden="true" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                      Delete Subscription Feature
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Are you sure you want to delete the feature "<strong>{currentFeature.feature_name}</strong>"?
                        This action cannot be undone.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  disabled={loading}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                  onClick={handleDeleteFeature}
                >
                  {loading ? 'Deleting...' : 'Delete'}
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                  onClick={() => { setIsDeleteModalOpen(false); setCurrentFeature(null); }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SubscriptionFeaturesPage;

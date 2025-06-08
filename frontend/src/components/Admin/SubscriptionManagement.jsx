import React, { useState, useEffect } from 'react';
import { FaEdit, FaTrash, FaPlus } from 'react-icons/fa';
import { adminAPI } from '../../services/api';

const SubscriptionManagement = () => {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingPackage, setEditingPackage] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      const response = await adminAPI.getSubscriptionPlans();
      setPackages(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load subscription packages');
      console.error('Error fetching packages:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (pkg) => {
    setEditingPackage(pkg);
    setShowModal(true);
  };

  const handleCreate = () => {
    setEditingPackage(null);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const packageData = {
      name: formData.get('name'),
      price: parseFloat(formData.get('price')),
      billing_interval: formData.get('billing_interval'),
      description: formData.get('description'),
      features: formData.get('features').split('\n').map(feature => ({
        name: feature.trim(),
        description: ''
      })).filter(f => f.name)
    };

    try {
      if (editingPackage) {
        await adminAPI.updateSubscriptionPlan(editingPackage.id, packageData);
      } else {
        await adminAPI.createSubscriptionPlan(packageData);
      }
      
      setShowModal(false);
      setError(null);
      fetchPackages();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save package');
      console.error('Error saving package:', err);
    }
  };

  const handleToggleActive = async (pkg) => {
    try {
      await adminAPI.updateSubscriptionPlan(pkg.id, {
        ...pkg,
        is_active: !pkg.is_active
      });
      setError(null);
      fetchPackages();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update package status');
      console.error('Error updating package status:', err);
    }
  };
  
  const handleDelete = async (pkg) => {
    if (window.confirm(`Are you sure you want to delete the ${pkg.name} package? This cannot be undone.`)) {
      try {
        await adminAPI.deleteSubscriptionPlan(pkg.id);
        setError(null);
        fetchPackages();
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to delete package');
        console.error('Error deleting package:', err);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--primary)]"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-[var(--primary)]">
          Subscription Packages
        </h2>
        <button
          onClick={handleCreate}
          className="flex items-center px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-dark)] transition-colors"
        >
          <FaPlus className="mr-2" />
          Add Package
        </button>
      </div>

      {error && (
        <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {packages.map((pkg) => (
          <div
            key={pkg.id}
            className={`bg-white rounded-xl shadow-md overflow-hidden ${
              !pkg.is_active && 'opacity-60'
            }`}
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-semibold">{pkg.name}</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEdit(pkg)}
                    className="text-[var(--primary)] hover:text-[var(--primary-dark)]"
                    title="Edit package"
                  >
                    <FaEdit />
                  </button>
                  <button
                    onClick={() => handleDelete(pkg)}
                    className="text-red-500 hover:text-red-700"
                    title="Delete package"
                  >
                    <FaTrash />
                  </button>
                  <button
                    onClick={() => handleToggleActive(pkg)}
                    className={`${
                      pkg.is_active
                        ? 'text-red-500 hover:text-red-700'
                        : 'text-green-500 hover:text-green-700'
                    }`}
                    title={pkg.is_active ? 'Deactivate package' : 'Activate package'}
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <div className="text-2xl font-bold text-[var(--primary)] mb-2">
                  ${parseFloat(pkg.price || 0).toFixed(2)}
                  <span className="text-[var(--text-light)]">/{pkg.billing_interval}</span>
                </div>
                
                <div className="text-sm text-[var(--text-light)] mb-2">
                  {pkg.subscriber_count === 1 ? '1 subscriber' : `${pkg.subscriber_count || 0} subscribers`}
                </div>

                <ul className="space-y-2">
                  {Array.isArray(pkg.features) && pkg.features.length > 0 ? (
                    pkg.features.map((feature, index) => (
                      <li key={index} className="flex items-start text-[var(--text)]">
                        <span className="mr-2">•</span>
                        <span>{feature?.name || 'Feature ' + (index + 1)}</span>
                      </li>
                    ))
                  ) : (
                    // Default features based on subscription level
                    [...Array(pkg.name.toLowerCase().includes('basic') ? 4 :
                            pkg.name.toLowerCase().includes('premium') ? 7 :
                            pkg.name.toLowerCase().includes('elite') ? 10 : 5)].map((_, index) => (
                      <li key={index} className="flex items-start text-[var(--text)]">
                        <span className="mr-2">•</span>
                        <span>Feature {index + 1}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">
              {editingPackage ? 'Edit Package' : 'Create Package'}
            </h3>

            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Package Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    defaultValue={editingPackage?.name}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Price (USD)
                  </label>
                  <input
                    type="number"
                    name="price"
                    step="0.01"
                    min="0"
                    defaultValue={editingPackage?.price}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Billing Interval
                  </label>
                  <select
                    name="billing_interval"
                    defaultValue={editingPackage?.billing_interval || 'monthly'}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Description
                  </label>
                  <textarea
                    name="description"
                    defaultValue={editingPackage?.description || ''}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                    rows="3"
                    placeholder="Brief description of this subscription plan"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Features (one per line)
                  </label>
                  <textarea
                    name="features"
                    defaultValue={editingPackage?.features.map(f => f.name).join('\n')}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
                    rows="6"
                    required
                    placeholder="Enter each feature on a new line&#10;Example:&#10;Unlimited likes&#10;See who likes you&#10;Priority in discover feed"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-[var(--text)] hover:text-[var(--text-dark)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-dark)]"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionManagement; 
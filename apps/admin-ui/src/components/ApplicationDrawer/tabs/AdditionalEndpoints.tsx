import React, { useState, useEffect } from "react";
import { Plus, Trash2, Globe, CheckCircle, XCircle } from "lucide-react";

const AdditionalEndpoints = ({ vhost, formData, setFormData, isEditing }) => {
  const [endpoints, setEndpoints] = useState(formData?.additionalEndpoints || vhost?.additionalEndpoints || []);
  const [newEndpoint, setNewEndpoint] = useState({
    domain: "",
    port: "",
    enabled: true,
  });

  // Sync endpoints with formData
  useEffect(() => {
    if (formData?.additionalEndpoints) {
      setEndpoints(formData.additionalEndpoints);
    }
  }, [formData?.additionalEndpoints]);

  const addEndpoint = () => {
    if (!newEndpoint.domain || !newEndpoint.port) {
      alert("Domain and port are required");
      return;
    }

    const updatedEndpoints = [...endpoints, newEndpoint];
    setEndpoints(updatedEndpoints);
    setNewEndpoint({ domain: "", port: "", enabled: true });

    // Update formData with new endpoints
    setFormData({ ...formData, additionalEndpoints: updatedEndpoints });
  };

  const removeEndpoint = (index) => {
    const updatedEndpoints = endpoints.filter((_, i) => i !== index);
    setEndpoints(updatedEndpoints);
    setFormData({ ...formData, additionalEndpoints: updatedEndpoints });
  };

  const toggleEndpoint = (index) => {
    const updatedEndpoints = [...endpoints];
    updatedEndpoints[index] = {
      ...updatedEndpoints[index],
      enabled: !updatedEndpoints[index].enabled
    };
    setEndpoints(updatedEndpoints);
    setFormData({ ...formData, additionalEndpoints: updatedEndpoints });
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6">
      <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Globe className="h-5 w-5 text-blue-500" />
        Additional Container Endpoints
      </h3>

      {/* Existing Endpoints */}
      {endpoints.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Current Endpoints
          </h4>
          <div className="space-y-2">
            {endpoints.map((endpoint, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex items-center space-x-4">
                  {endpoint.enabled ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-gray-400" />
                  )}
                  <span className={`font-mono text-sm ${!endpoint.enabled ? 'text-gray-400 line-through' : ''}`}>
                    {endpoint.domain}
                  </span>
                  <span className="text-gray-500">→</span>
                  <span className={`font-mono text-sm ${!endpoint.enabled ? 'text-gray-400' : 'text-blue-600'}`}>
                    container:{endpoint.port}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {isEditing && (
                    <>
                      <button
                        onClick={() => toggleEndpoint(index)}
                        className={`px-2 py-1 text-xs rounded ${
                          endpoint.enabled 
                            ? 'bg-gray-100 hover:bg-gray-200 text-gray-700' 
                            : 'bg-green-100 hover:bg-green-200 text-green-700'
                        }`}
                      >
                        {endpoint.enabled ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => removeEndpoint(index)}
                        className="p-1 text-red-600 hover:bg-red-100 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add New Endpoint */}
      {isEditing && (
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200">
          <h5 className="text-sm font-semibold text-gray-800 mb-3">
            Add New Endpoint
          </h5>
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Domain
                </label>
                <input
                  type="text"
                  value={newEndpoint.domain}
                  onChange={(e) =>
                    setNewEndpoint({ ...newEndpoint, domain: e.target.value })
                  }
                  placeholder="api.example.com or admin.example.com"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Container Port
                </label>
                <input
                  type="number"
                  value={newEndpoint.port}
                  onChange={(e) =>
                    setNewEndpoint({ ...newEndpoint, port: e.target.value })
                  }
                  placeholder="8080"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              onClick={addEndpoint}
              disabled={!newEndpoint.domain || !newEndpoint.port}
              className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
            >
              <Plus className="h-4 w-4" />
              Add Endpoint
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-xs text-blue-800">
          <strong>Additional endpoints</strong> allow you to expose multiple ports from the same
          container on different domains. Perfect for applications with multiple services:
        </p>
        <ul className="mt-2 text-xs text-blue-700 space-y-1">
          <li>• Main app on example.com (port 3000)</li>
          <li>• API on api.example.com (port 8080)</li>
          <li>• Admin panel on admin.example.com (port 3001)</li>
          <li>• WebSocket server on ws.example.com (port 8081)</li>
        </ul>
      </div>
    </div>
  );
};

export default AdditionalEndpoints;

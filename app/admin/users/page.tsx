'use client';

import { useEffect, useState, startTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: string;
  email_verified: number;
  created_at: string;
  last_login: string;
}

interface UserPreferences {
  appointment_type: string;
  location: string;
  persons: number;
  email_enabled: number;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userPreferences, setUserPreferences] = useState<UserPreferences[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set());
  const [bulkActionInProgress, setBulkActionInProgress] = useState(false);

  const fetchUsers = async (token: string) => {
    try {
      const response = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setUsers(data.data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.role !== 'admin') {
        router.push('/');
        return;
      }
      startTransition(() => {
        setUser(payload);
        fetchUsers(token);
      });
    } catch (e) {
      router.push('/login');
    }
  }, [router]);

  const fetchUserPreferences = async (userId: number) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`/api/admin/users/${userId}/preferences`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setUserPreferences(data.data);
      }
    } catch (error) {
      console.error('Error fetching user preferences:', error);
    }
  };

  const handleViewUser = async (selectedUser: User) => {
    setSelectedUser(selectedUser);
    await fetchUserPreferences(selectedUser.id);
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user? This will also delete all their preferences and data.')) {
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        alert('User deleted successfully');
        fetchUsers(token);
        setSelectedUser(null);
      } else {
        alert('Failed to delete user: ' + data.message);
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Error deleting user');
    }
  };

  const handleVerifyUser = async (userId: number) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email_verified: true }),
      });
      const data = await response.json();
      if (data.success) {
        alert('User verified successfully');
        fetchUsers(token);
      } else {
        alert('Failed to verify user: ' + data.message);
      }
    } catch (error) {
      console.error('Error verifying user:', error);
      alert('Error verifying user');
    }
  };

  const handleBulkAction = async (action: 'delete' | 'verify' | 'unverify') => {
    if (selectedUsers.size === 0) {
      alert('Please select users first');
      return;
    }

    const actionText = action === 'delete' ? 'delete' : action === 'verify' ? 'verify' : 'unverify';
    if (!confirm(`Are you sure you want to ${actionText} ${selectedUsers.size} user(s)?`)) {
      return;
    }

    setBulkActionInProgress(true);
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch('/api/admin/users/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action,
          userIds: Array.from(selectedUsers),
        }),
      });
      const data = await response.json();
      if (data.success) {
        alert(data.message);
        setSelectedUsers(new Set());
        fetchUsers(token);
      } else {
        alert('Failed: ' + data.message);
      }
    } catch (error) {
      console.error('Bulk action error:', error);
      alert('Error performing bulk action');
    }
    setBulkActionInProgress(false);
  };

  const toggleUserSelection = (userId: number) => {
    const newSelection = new Set(selectedUsers);
    if (newSelection.has(userId)) {
      newSelection.delete(userId);
    } else {
      newSelection.add(userId);
    }
    setSelectedUsers(newSelection);
  };

  const toggleAllUsers = () => {
    if (selectedUsers.size === users.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(users.map(u => u.id)));
    }
  };

  if (!user || loading) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-blue-600">User Management</h1>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Manage system users and their preferences</p>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
              <Link
                href="/admin"
                className="px-3 sm:px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium min-h-[44px] flex items-center"
              >
                ← Back to Dashboard
              </Link>
              <span className="text-sm text-gray-600 dark:text-gray-400">{user.username}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {/* Users List */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
                  All Users ({users.length}) {selectedUsers.size > 0 && `(${selectedUsers.size} selected)`}
                </h2>
                {selectedUsers.size > 0 && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleBulkAction('verify')}
                      disabled={bulkActionInProgress}
                      className="px-3 py-2 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 min-h-[44px]"
                    >
                      Verify
                    </button>
                    <button
                      onClick={() => handleBulkAction('delete')}
                      disabled={bulkActionInProgress}
                      className="px-3 py-2 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 min-h-[44px]"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
              <div className="mt-2">
                <label className="flex items-center text-sm text-gray-600 dark:text-gray-400 cursor-pointer min-h-[44px] items-center">
                  <input
                    type="checkbox"
                    checked={selectedUsers.size === users.length && users.length > 0}
                    onChange={toggleAllUsers}
                    className="mr-2 h-5 w-5"
                  />
                  Select All
                </label>
              </div>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[500px] sm:max-h-[600px] overflow-y-auto">
              {users.map((u) => (
                <div
                  key={u.id}
                  className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                    selectedUser?.id === u.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedUsers.has(u.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleUserSelection(u.id);
                      }}
                      className="mt-1 h-5 w-5"
                    />
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => handleViewUser(u)}
                    >
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-gray-100 text-sm sm:text-base truncate">{u.username}</p>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">{u.email}</p>
                      {u.full_name && (
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">{u.full_name}</p>
                      )}
                    </div>
                    <div className="flex sm:flex-col items-start sm:items-end gap-1 sm:gap-1 flex-wrap">
                      <span
                        className={`px-2 py-1 text-xs rounded-full whitespace-nowrap ${
                          u.role === 'admin'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {u.role}
                      </span>
                      <span
                        className={`px-2 py-1 text-xs rounded-full whitespace-nowrap ${
                          u.email_verified
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {u.email_verified ? 'Verified' : 'Unverified'}
                      </span>
                    </div>
                  </div>
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        <div>Joined: {new Date(u.created_at).toLocaleDateString()}</div>
                        {u.last_login && (
                          <div>Last login: {new Date(u.last_login).toLocaleString()}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* User Details */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
                {selectedUser ? 'User Details' : 'Select a User'}
              </h2>
            </div>
            {selectedUser ? (
              <div className="p-4 sm:p-6">
                <div className="mb-6">
                  <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-4">Account Information</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">ID:</span>
                      <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">{selectedUser.id}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Username:</span>
                      <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">{selectedUser.username}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Email:</span>
                      <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">{selectedUser.email}</span>
                    </div>
                    {selectedUser.full_name && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Full Name:</span>
                        <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">{selectedUser.full_name}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Role:</span>
                      <span className="ml-2 font-medium capitalize text-gray-900 dark:text-gray-100">{selectedUser.role}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Email Verified:</span>
                      <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                        {selectedUser.email_verified ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    Notification Preferences ({userPreferences.length})
                  </h3>
                  {userPreferences.length > 0 ? (
                    <div className="space-y-3">
                      {userPreferences.map((pref, i) => (
                        <div key={i} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                              {pref.appointment_type}
                            </span>
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                              {pref.location}
                            </span>
                            <span className="text-gray-600 dark:text-gray-400">{pref.persons} person(s)</span>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Email: {pref.email_enabled ? 'Enabled' : 'Disabled'}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No preferences set</p>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                  {!selectedUser.email_verified && (
                    <button
                      onClick={() => handleVerifyUser(selectedUser.id)}
                      className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium min-h-[44px]"
                    >
                      Verify Email
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteUser(selectedUser.id)}
                    className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium min-h-[44px]"
                  >
                    Delete User
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                <p className="mt-4">Select a user to view details</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

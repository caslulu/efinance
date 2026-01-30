import { useEffect, useState } from 'react';
import { api } from '../../../api/api';
import type { Subscription } from '../../../types/Subscription';
import { CreateSubscriptionModal } from '../components/CreateSubscriptionModal';
import clsx from 'clsx';

export const SubscriptionsPage = () => {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchSubscriptions = async () => {
    try {
      const res = await api.get('/subscriptions');
      setSubscriptions(res.data);
    } catch (error) {
      console.error('Failed to fetch subscriptions');
    } finally {
      setLoading(false);
    }
  };

  const triggerCheck = async () => {
    try {
      await api.post('/subscriptions/trigger');
      alert('Subscription check triggered successfully');
      fetchSubscriptions();
    } catch (error) {
      alert('Failed to trigger check');
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Subscriptions</h1>
        <div className="flex gap-4">
          <button
            onClick={triggerCheck}
            className="rounded-lg bg-gray-100 px-4 py-2 font-medium text-gray-700 hover:bg-gray-200"
          >
            Trigger Check
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-blue-700"
          >
            + New Subscription
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-white shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Value</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Frequency</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Next Billing</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {subscriptions.map((sub) => (
              <tr key={sub.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">{sub.name}</td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">R$ {Number(sub.value).toFixed(2)}</td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{sub.frequency}</td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  <span className={clsx(
                    'rounded-full px-2 py-1 text-xs font-semibold',
                    sub.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  )}>
                    {sub.status}
                  </span>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  {new Date(sub.next_billing_date).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {subscriptions.length === 0 && !loading && (
          <div className="p-6 text-center text-gray-500">No subscriptions found.</div>
        )}
      </div>

      <CreateSubscriptionModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={fetchSubscriptions}
      />
    </div>
  );
};

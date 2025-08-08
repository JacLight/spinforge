import React from 'react';
import { useSiteStore } from '@/store/site-store';
import AccountSiteButtons from './sites-buttons';
import { twMerge } from 'tailwind-merge';
import { localStorageUtils } from '@/utils/localstorage';
import { IconRenderer } from '@/ui/icons/icon-renderer';
import { isEmpty } from '@/utils/helpers';
import { formatDistance } from 'date-fns';

// Temporary placeholder for missing utils
const statusColors = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  pending: 'bg-yellow-100 text-yellow-800',
};

const planColors = {
  free: 'bg-gray-100 text-gray-800',
  basic: 'bg-blue-100 text-blue-800',
  premium: 'bg-purple-100 text-purple-800',
  enterprise: 'bg-indigo-100 text-indigo-800',
};

export default function AccountSiteCard({ data, user }) {
  const handleDelete = async (name: string) => {
    // await deleteData(DataType.company, name);
    // setStateItem({ sites: sites.filter(item => item.name !== name) });
  };

  const onUpgrade = async site => {
    // const [subscription] = site.data.subscriptionData || [];
    // const upgradeInfo = { referenceId: site.data.name, email: site.data.email };
    // if (subscription) {
    //   upgradeInfo['plan'] = subscription.data.plan;
    //   upgradeInfo['number'] = subscription.data.name;
    // }
    // localStorageUtils.set('upgrade-site', upgradeInfo);
    // window.open('/pricing', '_blank');
  };

  const rounded = 'rounded-t-2xl rounded-b-none';
  return (
    <div className="">
      {isEmpty(data) && (
        <div className="flex justify-center items-center h-40 text-slate-400 gap-2">
          <div>You've not created any site yet.</div>{' '}
          <a target="_blank" href="https://template.appmint.io" rel="noopener noreferrer" className="text-indigo-600 flex justify-between items-center gap-2">
            <span>Create one</span> <IconRenderer icon="ExternalLink" className="w-4 h-4" />
          </a>
        </div>
      )}
      <div className="mx-auto mt-8 grid max-w-2xl grid-cols-1 gap-y-20 gap-x-8 lg:mx-0 lg:max-w-none lg:grid-cols-3">
        {data?.map((item: any) => (
          <div key={item.sk} className={`flex  p-2 flex-col items-start shadow-lg border-2 border-gray-300 min-w-96 ${rounded} shadow-product`}>
            <div className="relative w-full">
              <img src={item?.imageUrl || `https://picsum.photos/seed/${item.data.name}/800/600?blur=2`} alt="" className="aspect-[16/9] w-full rounded-t-2xl bg-gray-100 object-cover sm:aspect-[2/1] lg:aspect-[3/2]" />
            </div>
            <div className="flex items-center space-x-3 mb-2 p-2">
              <h2 className="text-xl font-semibold">{item?.data?.name}</h2>
              <span className={twMerge('px-2 py-1 text-sm rounded', statusColors[item?.data?.status])}>{item?.data?.status}</span>
              <span className={twMerge('px-2 py-1 text-sm rounded', planColors[item?.data?.plan])}>{item?.data?.plan}</span>
            </div>
            <div className="flex items-center space-x-4 text-sm mb-2 px-2 justify-between w-full">
              <button onClick={() => onUpgrade(item)} className="text-blue-600 hover:underline flex items-center gap-2">
                <IconRenderer icon="ExternalLink" className="w-4 h-4 text-gray-400" />
                <span>Upgrade - Compare Plans</span>
              </button>
            </div>
            <div className="flex items-center space-x-4 text-sm mb-2 px-2 justify-between w-full">
              <AccountSiteButtons site={item} />
            </div>
            <div className="flex w-full  justify-between  p-2 border-t border-t-gray-200 text-xs">
              <div className="group relative flex gap-2 items-center">
                <div className="rounded-full p-1 bg-gray-100 shadow">
                  <IconRenderer icon="Clock" className="w-3 h-3" />
                </div>
                <div className="">{formatDistance(new Date(item?.createdate), new Date())}</div>
              </div>
              <div className="group relative flex gap-2 items-center">
                <div className="rounded-full p-1 bg-gray-100 shadow">
                  <IconRenderer icon="User" className="w-3 h-3" />
                </div>
                <div className=" truncate">{item.data.email}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

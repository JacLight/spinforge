import AccountSiteButtons from './sites-buttons';
import { twMerge } from 'tailwind-merge';
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

export default function AccountSiteList({ data, user }) {
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
      <ul role="list" className="divide-y divide-gray-100">
        {data?.map((item: any) => (
          <li key={item.sk} className="flex items-center justify-between gap-x-6 py-5">
            <div className="flex gap-4 items-center  justify-between">
              <div className="relative w-36">
                <img src={item?.imageUrl || `https://picsum.photos/seed/${item.data.name}/800/600?blur=2`} alt={item.data.name} className="aspect-[16/9] w-full rounded bg-gray-100 object-cover sm:aspect-[2/1] lg:aspect-[3/2]" />
              </div>
              <div className="">
                <div className="flex items-center space-x-3 mb-2">
                  <h2 className="text-xl font-semibold">{item?.data?.name}</h2>
                  <span className={twMerge('px-2 py-1 text-sm rounded', statusColors[item?.data?.status])}>{item?.data?.status}</span>
                  <span className={twMerge('px-2 py-1 text-sm rounded', planColors[item?.data?.plan])}>{item?.data?.plan}</span>
                </div>

                <div className="flex items-center space-x-4 text-sm mb-2">
                  <button onClick={() => onUpgrade(item)} className="text-blue-600 hover:underline flex items-center gap-2">
                    <IconRenderer icon="ExternalLink" className="w-4 h-4 text-gray-400" />
                    <span>Upgrade - Compare Plans</span>
                  </button>
                </div>
                <p className=" p-0 m-0">{item.data.description}</p>
                <p className="whitespace-nowrap text-xs p-0 m-0 flex items-center gap-2">
                  <span>
                    Created on: <time dateTime={item.createdate}>{new Date(item.createdate).toDateString()}</time>,
                  </span>
                  <div className="rounded-full p-1 bg-gray-100 shadow">
                    <IconRenderer icon="FileText" className="w-3 h-3" />
                  </div>
                  <time dateTime={item.createdate}>{formatDistance(new Date(item?.createdate), new Date())}</time> ago
                  <div className="rounded-full p-1 bg-gray-100 shadow">
                    <IconRenderer icon="User" className="w-3 h-3" />
                  </div>
                  {item.data.email}
                </p>
              </div>
            </div>
            <AccountSiteButtons site={item} />
          </li>
        ))}
      </ul>
    </div>
  );
}

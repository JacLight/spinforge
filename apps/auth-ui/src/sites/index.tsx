import React, { useEffect, useState } from 'react';
import AccountSiteList from './sites-list';
import AccountSiteCard from './sites-card';
import { IconRenderer } from '@/ui/icons/icon-renderer';
import { useSiteStore } from '@/store/site-store';
import { useShallow } from 'zustand/shallow';
import { appEndpoints } from '@/request/api-endpoints';
import { requestQueueInstance } from '@/request/request-queue';
import { activeSession } from '@/request/appengine';
import { getResourcePath } from '@/request';

export const AccountSites = () => {
  const { userOrgs } = useSiteStore(useShallow(state => ({ userOrgs: state.userOrgs })));
  const [activeView, setActiveView] = useState('card');
  const user = activeSession().user;

  useEffect(() => {
    if (!userOrgs) {
      getData();
    }
  }, []);

  useEffect(() => {
    const email = new URLSearchParams(window.location.search).get('email');
    const password = new URLSearchParams(window.location.search).get('password');
    const token = new URLSearchParams(window.location.search).get('token');
  }, [window.location.search]);

  const getData = async () => {
     const path = getResourcePath(appEndpoints.get_org_by_email.name) + '/' + user?.data?.email;
    const response:any = await requestQueueInstance.processData(path);
    useSiteStore.getState().setStateItem({ userOrgs: response });
  };

  return (
    <div className="w-full h-full overflow-auto p-8 max-w-screen-xl mx-auto min-w-96">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-base font-semibold leading-6 text-gray-900">Appmint Apps</h1>
          <p className="mt-2 text-sm text-gray-700">Learn how to grow your business with our expert advice.</p>
        </div>

        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none flex gap-2">
          <a
            href={'register'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex justify-center items-center gap-2 rounded-md bg-indigo-600 py-2 px-3 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <IconRenderer icon="Globe" size={20} /> <span className="whitespace-nowrap">Create New App</span>
          </a>
        </div>
      </div>
      {/* <AccountSitesContent /> */}
      <div className="mt-5">
        <div className="flex justify-end items-center gap-2">
          <button onClick={e => getData()} className="p-[6px] bg-white shadow rounded-lg hover:bg-cyan-100">
            <IconRenderer icon="RefreshCw" size={14} />
          </button>
          <button onClick={e => setActiveView('list')} className="p-[6px] bg-white shadow rounded-lg hover:bg-cyan-100">
            <IconRenderer icon="List" size={14} />
          </button>
          <button onClick={e => setActiveView('card')} className="p-[6px] bg-white shadow rounded-lg hover:bg-cyan-100">
            <IconRenderer icon="Grid" size={14} />
          </button>
        </div>
        {activeView === 'list' && <AccountSiteList data={userOrgs} user={user} />}
        {activeView === 'card' && <AccountSiteCard data={userOrgs} user={user} />}
      </div>
    </div>
  );
};

export default AccountSites;

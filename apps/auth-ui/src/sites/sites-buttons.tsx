import React from 'react';
import { IconRenderer } from '@/ui/icons/icon-renderer';

export default function AccountSiteButtons({ site }) {
  const openDashboard = () => {
    const dashboardUrl = `https://websitemint.appmint.io/login?orgid=${site.data.name}`;
    window.open(dashboardUrl, '_blank');
  };

  const openPublicSite = () => {
    window.open(`https://${site.data.name}.appmint.app`, '_blank');
  };

  return (
    <div className="flex flex-none items-center gap-x-4">
      <button onClick={openDashboard} className="rounded-md bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:block">
        Goto Dashboard<span className="sr-only">, {site.data.name}</span>
      </button>
      <div className="relative flex items-center gap-2">
        <a href={'/' + site.data.name} className="rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 sm:block">
          <span className="flex items-center gap-2">
            <IconRenderer icon="Code" className="w-4 h-4" />
            View Code
          </span>
        </a>
        <button onClick={openPublicSite} className="rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 sm:block">
          <span className="flex items-center gap-2">
            <IconRenderer icon="ExternalLink" className="w-4 h-4" />
            View Site
          </span>
        </button>
      </div>
    </div>
  );
}

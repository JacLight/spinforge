import * as React from 'react';
import { lazyLoad } from '../utils/loadable';

export const LoginLoadable = lazyLoad(
  () => import('./Login'),
  module => module.Login,
  {
    fallback: <div className="login-page-loader flex items-center justify-center min-h-screen">
      <div className="animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full"></div>
    </div>,
  },
);

export const RegisterLoadable = lazyLoad(
  () => import('./Register'),
  module => module.Register,
  {
    fallback: <div className="register-page-loader flex items-center justify-center min-h-screen">
      <div className="animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full"></div>
    </div>,
  },
);

export const RecoverLoadable = lazyLoad(
  () => import('./Recover'),
  module => module.Recover,
  {
    fallback: <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full"></div>
    </div>,
  },
);

export const LockLoadable = lazyLoad(
  () => import('./Lock'),
  module => module.Lock,
  {
    fallback: <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full"></div>
    </div>,
  },
);

export const LogoutLoadable = lazyLoad(
  () => import('./Logout'),
  module => module.Logout,
  {
    fallback: <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full"></div>
    </div>,
  },
);

// export const VerifyLoadable = lazyLoad(
//   () => import('./Verify'),
//   module => module.Verify,
//   {
//     fallback: <div className="flex items-center justify-center min-h-screen">
//       <div className="animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full"></div>
//     </div>,
//   },
// );

export const ResetPasswordLoadable = lazyLoad(
  () => import('./ResetPassword'),
  module => module.ResetPassword,
  {
    fallback: <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full"></div>
    </div>,
  },
);

import { performLogout } from '@/request/appengine';
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function Logout() {
  let navigate = useNavigate();

  useEffect(() => {
    performLogout();
    window.location.href = '/auth/login';
  }, [navigate]);

  return <div>Logging out...</div>;
}

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import { LoadingIndicator } from '@/components/common/loading-indicator';
import { useNavigate } from 'react-router-dom';
import { appEndpoints } from '@/request/api-endpoints';
import { getResourcePath } from '@/request';

export function ResetPassword(props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm();
  const [resetData, setResetData] = useState({ orgId: null, email: null, token: null, timestamp: null });
  const [info, setInfo] = useState({ type: null, message: null, loading: false });
  let navigate = useNavigate();

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    if (search) {
      let orgId = search.get('orgId');
      orgId = !orgId ? new URLSearchParams(window.location.search).get('orgid') : orgId;
      const email = search.get('email');
      const token = search.get('token');
      setResetData({ orgId, email, token, timestamp: Date.now() });
    } else {
      setResetData({ orgId: null, email: null, token: null, timestamp: Date.now() });
    }
  }, [window.location]);

  async function ResetPassword(password: string, confirmPassword: string) {
    try {
      const path = getResourcePath(appEndpoints.password_reset.name);
      const recoverResponse: any = await axios.post(
        path,
        { ...resetData, password, confirmPassword },
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            orgid: resetData.orgId,
          },
        },
      );
      console.debug(recoverResponse);
      setInfo({ type: 'success', message: 'Your password has been reset successfully', loading: false });
    } catch (error) {
      console.error('error signing in', error);
      setInfo({ type: 'error', message: 'An error occurred while trying to reset your password', loading: false });
    }
  }

  const onSubmit = async data => {
    const { password, confirmPassword } = data;
    if (password && confirmPassword) {
      setInfo({ type: null, message: null, loading: true });
      await ResetPassword(password, confirmPassword);
    }
  };

  if (!resetData?.timestamp || info.loading) {
    return (
      <div>
        <LoadingIndicator />
      </div>
    );
  }

  if (!resetData?.orgId || !resetData?.email || !resetData?.token) {
    return <div className="bg-red-100 p-4 text-center ">Invalid reset link</div>;
  }

  //?email=imzee@durubata.com&orgid=stylesavvee&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImltemVlQGR1cnViYXRhLmNvbSIsImlkIjoiNjM2ODRhZjQxYWY0MmE5MDE4NDNiMGQ1IiwiZXhwaXJlcyI6MTcxODUzMzcyNjQwMywiaWF0IjoxNzE4NTMzMTI2LCJleHAiOjE3MTg1NDAzMjZ9.aOps1kkRhxJ71G3nnsZEMg2Jy9cVV41qlkFVwdkPz9A

  return (
    <div className="login-content min-w-96">
      <div className="login-header">
        <h1>Reset your Password</h1>
      </div>
      {info.type === 'error' && (
        <div className="login-alert">
          {' '}
          <div className="text-sm bg-red-100 p-4">{info.message}</div>
        </div>
      )}
      {info.type === 'success' && (
        <div className="login-alert">
          {' '}
          <div className="text-sm bg-green-100 p-4 text-center">{info.message}</div>
          <p className="p-2 text-center bg-white/90 mt-1">
            {' '}
            SignIn here?{' '}
            <a href="#" onClick={e => navigate('../login')}>
              Sign In
            </a>
          </p>
        </div>
      )}
      <div className="login-form flex items-center min-w-96 ">
        <div className="login-input w-full">
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="login-input">
              <input
                type="password"
                placeholder="New Password"
                {...register('password', {
                  required: 'You must specify a password',
                  minLength: {
                    value: 6,
                    message: 'Password must have at least 8 characters',
                  },
                })}
              />
            </div>
            {errors.password && <div className="form-error">{errors.password.message as any}</div>}
            <div className="login-input">
              <input
                type="password"
                placeholder="Repeat password"
                {...register('confirmPassword', {
                  required: 'You must specify a password',
                  validate: (val: string) => {
                    if (watch('password') != val) {
                      return 'Your passwords do no match';
                    }
                  },
                })}
              />
            </div>
            {errors.password_repeat && <div className="form-error">{errors.password_repeat.message as any}</div>}
            <div className="login-submit">
              <button type="submit">Reset my password</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

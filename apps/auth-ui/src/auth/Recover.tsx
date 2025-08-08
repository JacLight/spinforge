import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { LoadingIndicator } from '@/components/common/loading-indicator';
import { appEndpoints } from '@/request/api-endpoints';
import { getResourcePath } from '@/request';

export function Recover(props) {
  let navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();
  const [info, setInfo] = useState({ type: null, message: null, loading: false });

  async function recoverPassword(orgId: string, email: string) {
    try {
      const path = getResourcePath(appEndpoints.forgot_password.name) + '/' + email;
      const recoverResponse: any = await axios.get(path, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          orgid: orgId,
        },
      });
      console.debug(recoverResponse);
      setInfo({ type: 'success', message: 'If the email exists in our system, you will receive an email with instructions to reset your password', loading: false });
    } catch (error) {
      setInfo({ type: 'error', message: 'An error occurred while trying to recover your password', loading: false });
      console.error('error signing in', error);
    }
  }

  const onSubmit = async data => {
    if (data['orgId'] && data['email']) {
      setInfo({ type: null, message: null, loading: true });
      await recoverPassword(data['orgId'], data['email']);
    }
  };

  if (info.loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingIndicator />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md p-8 shadow-xl bg-white rounded-2xl">
      <div className="login-header">
        <h1>Recover Password</h1>
        <p>
          Already have an account?{' '}
          <a href="#" onClick={e => navigate('../login')}>
            Sign In
          </a>
        </p>
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
          <div className="text-sm bg-green-100 p-4">{info.message}</div>
        </div>
      )}
      <div className="login-form flex items-center w-full">
        <div className="login-input w-full">
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="login-input">
              <input type="text" placeholder="Org ID" {...register('orgId', { required: 'ORG ID is required', maxLength: 100 })} />
            </div>
            {errors.orgId && <div className="form-error">{errors.orgId.message as any}</div>}
            <div className="login-input">
              <input
                type="text"
                placeholder="Email"
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^\S+@\S+$/i,
                    message: 'Invalid Email',
                  },
                })}
              />
            </div>
            {errors.email && <div className="form-error">{errors.email.message as any}</div>}
            <div className="login-submit">
              <button type="submit">Recover my password</button>
            </div>
          </form>
        </div>
      </div>
      </div>
    </div>
  );
}

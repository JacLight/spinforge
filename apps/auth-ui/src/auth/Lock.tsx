import React from 'react';
import { useForm } from 'react-hook-form';

export function Lock() {
  const { register, handleSubmit } = useForm<FormData>();
  const onSubmit1 = data => console.debug('Verify', data);

  return <></>;
}

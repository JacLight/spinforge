import React from 'react';
import { ContainerTerminal } from './ContainerTerminal';
import { SpinForgeContainer } from './ContainerSlideoutPanel';

interface ContainerExecTabProps {
  container: SpinForgeContainer;
}

export function ContainerExecTab({ container }: ContainerExecTabProps) {
  return <ContainerTerminal container={container} />;
}
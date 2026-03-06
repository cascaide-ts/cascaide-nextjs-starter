
'use client'
import { clientWorkflowConfig } from '@/graphs/client/config';
import  {WorkflowProvider, WorkflowRenderer}  from '@cascaide-ts/react';

export default function HomePage() {
  return (
    <WorkflowProvider 
      initialNodeId="chat_init"
      initialNodeName="chat"
      config={clientWorkflowConfig}
      actionRelayEndpoint='/api/workflow/action'
      persistenceEndpoint='/api/workflow/persistence'
    >
      <WorkflowRenderer />
    </WorkflowProvider>
  );
}


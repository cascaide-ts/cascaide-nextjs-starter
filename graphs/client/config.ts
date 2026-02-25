// src/components/home/homeConfig.ts

import Chat from "@/components/cascaide-ui/chat/chat"
import { ClientWorkflowConfig } from '@cascaide-ts/react';
import BookingUi from "@/components/cascaide-ui/bookingUiNode";
import { clientWorkflowGraph } from "./graph";


export const clientWorkflowConfig: ClientWorkflowConfig = {
  clientWorkflowGraph: clientWorkflowGraph,
  uiComponentRegistry: {
    chat: Chat,
    bookingUiNode : BookingUi,
  },
};

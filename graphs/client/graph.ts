
import { ClientWorkflowGraph } from "@cascaide-ts/core";


export const clientWorkflowGraph: ClientWorkflowGraph = {
 
    chat: { name: 'chat', isUINode: true ,env:'client'},
    bookingUiNode: { name: 'bookingUiNode', isUINode: true,env:'client'},
    
    supervisorAgentNode: { name: 'supervisorAgentNode', isUINode: false,env:'server' },
    supervisorToolNode: { name: 'supervisorToolNode', isUINode: false,env:'server' },

    searchAgentNode: { name: 'searchAgentNode', isUINode: false,env:'server' },
    searchToolNode: { name: 'searchToolNode', isUINode: false,env:'server' },

    bookingAgentNode: { name: 'bookingAgentNode', isUINode: false,env:'server' },
    bookingToolNode: { name: 'bookingToolNode', isUINode: false,env:'server' },

    availabilityAgentNode: { name: 'availabilityAgentNode', isUINode: false,env:'server' },
    availabilityToolNode: { name: 'availabilityToolNode', isUINode: false,env:'server' },
}



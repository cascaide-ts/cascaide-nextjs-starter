
import { searchAgentNodeExec, searchAgentNodePrep, searchAgentNodePost, 
    searchToolNodePrep, searchToolNodeExec, searchToolNodePost
   } from '@/bubbles/search-agent/searchAgentNodes';
import { ServerWorkflowGraph } from '@cascaide-ts/core'



export const serverWorkflowGraph: ServerWorkflowGraph = {

    // supervisorAgentNode: {
    //   name: 'supervisorAgentNode',
    //   prep: { selector: supervisorAgentNodeSelector, fn: supervisorAgentNodePrep },
    //   exec: supervisorAgentNodeExec,
    //   post: supervisorAgentNodePost,
    //   isStreaming: false,
    //   isUINode:false,
    //   env:'server'
    // },
    // supervisorToolNode: {
    //   name: 'supervisorToolNode',
    //   prep: { selector: supervisorToolNodeSelector, fn: supervisorToolNodePrep },
    //   exec: supervisorToolNodeExec,
    //   post: supervisorToolNodePost,
    //   isUINode:false,
    //   isStreaming:false,
    //   env:'server'
    // },


    // bookingAgentNode: {
    //   name: 'bookingAgentNode',
    //   prep: { selector: bookingAgentNodeSelector, fn: bookingAgentNodePrep },
    //   exec: bookingAgentNodeExec,
    //   post: bookingAgentNodePost,
    //   isUINode:false,
    //   isStreaming:false,
    //   env:'server',
    // },
    // bookingToolNode: {
    //   name: 'bookingToolNode',
    //   prep: { selector: bookingToolNodeSelector, fn: bookingToolNodePrep },
    //   exec: bookingToolNodeExec,
    //   post: bookingToolNodePost,
    //   isUINode:false,
    //   isStreaming:false,
    //   env:'server'
    // },

    // availabilityAgentNode: {
    //   name: 'availabilityAgentNode',
    //   prep: { selector: availabilityAgentNodeSelector, fn: availabilityAgentNodePrep },
    //   exec: availabilityAgentNodeExec,
    //   post: availabilityAgentNodePost,
    //   isStreaming:true,
    //   env:'server',
    //   isUINode:false
    // },
    // availabilityToolNode: {
    //   name: 'availabilityToolNode',
    //   prep: { selector: availabilityToolNodeSelector, fn: availabilityToolNodePrep },
    //   exec: availabilityToolNodeExec,
    //   post: availabilityToolNodePost,
    //   isStreaming:false,
    //   env:'server',
    //   isUINode:false
    // },

    searchAgentNode: {
      name: 'searchAgentNode',
      prep:  searchAgentNodePrep,
      exec: searchAgentNodeExec,
      post: searchAgentNodePost,
      isStreaming: true,
      isUINode:false,
      env:'server'
    },
    searchToolNode: {
      name: 'searchToolNode',
      prep: searchToolNodePrep,
      exec: searchToolNodeExec,
      post: searchToolNodePost,
      isUINode:false,
      isStreaming:false,
      env:'server'
    },

    
  };
  